param(
  [switch]$Configurar,
  [switch]$UnaVez,
  [switch]$Comprobar,
  [switch]$SincronizarRevisiones,
  [switch]$SoloLocal,
  [string]$Diagnosticar,
  [string]$Salida,
  [string]$Trabajo
)
$ErrorActionPreference="Stop"
# A process launched from PowerShell 7 may inherit its module paths even when
# this script runs under Windows PowerShell 5. Load the matching bundled module
# explicitly; importing the other engine's Security module duplicates TypeData.
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Security\Microsoft.PowerShell.Security.psd1') -ErrorAction Stop
$homeDir=Join-Path $env:APPDATA "MF_Legacy_V3"
$configPath=Join-Path $homeDir "config.json"
$tokenPath=Join-Path $homeDir "token.dpapi"
$workerPath=Join-Path $PSScriptRoot "mf_v3_worker.py"
function Preguntar($prompt,$default="") {
  if($default){$v=Read-Host "$prompt [$default]";if(!$v){return $default};return $v}
  return Read-Host $prompt
}
function LeerConfig {
 if(!(Test-Path $configPath)){throw "Falta la configuracion local. Ejecuta INSTALAR_TRABAJADOR_V3.bat"}
 return Get-Content $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
}
function Registrar {
 New-Item -ItemType Directory -Path $homeDir -Force | Out-Null
 Write-Host "CONFIGURACION MF LEGACY V3 - SIN API COMERCIAL" -ForegroundColor Cyan
 Write-Host "Tu PC ejecutara el Studio para trabajos pedidos desde Base44."
 $studio=Preguntar "Ruta completa de MF_Legacy_Studio_Unificado (contiene app y datos)"
 $studio=$studio.Trim('"')
 if(!(Test-Path (Join-Path $studio "app\profile.py"))){throw "Ruta no valida. Falta app\profile.py en $studio"}
 $url=Preguntar "URL HTTPS real de la funcion import-worker de Base44"
 if($url -notmatch '^https://[^ ]+$'){throw "La URL de Base44 debe empezar por https://"}
 Write-Host "Generando un secreto para proteger las comunicaciones con Base44..."
 $bytes=New-Object byte[] 36
 [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
 $token=[Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_')
 $secure=ConvertTo-SecureString $token -AsPlainText -Force
 ConvertFrom-SecureString $secure | Set-Content -Path $tokenPath -Encoding UTF8
 $config=@{studio_root=$studio;endpoint=$url;max_requests=8;interval_seconds=30}
 $config|ConvertTo-Json|Set-Content -Path $configPath -Encoding UTF8
 Write-Host ""
 Write-Host "TOKEN CREADO. Solo en Base44, en Secretos, agrega MF_V3_WORKER_TOKEN con este valor:" -ForegroundColor Yellow
 Write-Host $token
 Write-Host "Se muestra solo ahora. No lo publiques ni lo envíes por chat." -ForegroundColor Yellow
 Write-Host "Guardado cifrado mediante DPAPI para el usuario Windows actual." -ForegroundColor Green
}
function Ejecutar {
 $env:PYTHONIOENCODING="utf-8"
 $config=LeerConfig
 if(!(Test-Path (Join-Path $config.studio_root "app\profile.py"))){throw "No se localiza MF Legacy Studio: $($config.studio_root)"}
 if(!(Test-Path $workerPath)){throw "Falta mf_v3_worker.py junto al lanzador."}
 if($Diagnosticar){
  if($Diagnosticar -notmatch '^\d{1,15}$'){throw "ID FotMob no valido."}
  $env:MF_STUDIO_ROOT=$config.studio_root
  $diagnosticArgs=@($workerPath,"--dry-run",$Diagnosticar)
  if($Salida){$diagnosticArgs+=@("--output",$Salida)}
  & python @diagnosticArgs
  if($LASTEXITCODE -ne 0){throw "El diagnostico local fallo."}
  return
 }
 if(!(Test-Path $tokenPath)){throw "No se encuentra el secreto local cifrado. Repite la configuracion."}
 $secure=(Get-Content $tokenPath -Raw).Trim()|ConvertTo-SecureString
 $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
 try{$token=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)}
 finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)}
 if($token.Length -lt 32){throw "Token local no valido."}
 $env:MF_V3_WORKER_URL=$config.endpoint
 $env:MF_V3_WORKER_TOKEN=$token
 $env:MF_STUDIO_ROOT=$config.studio_root
 # Pide solo los datos nuevos de un jugador solicitado explícitamente.
 # Consulta limitado a ocho recursos por trabajo. No es una extracción masiva.
 $requestLimit=if($SoloLocal){0}elseif($null -ne $config.max_requests){[Math]::Max(0,[Math]::Min(15,[int]$config.max_requests))}else{8}
 $env:MF_V3_ALLOW_FOTMOB_NETWORK=if($requestLimit -gt 0){"1"}else{"0"}
 $env:MF_V3_MAX_FOTMOB_REQUESTS=[string]$requestLimit
 # Fixed public catalogue files are cached once; SoloLocal disables all reads.
 $env:MF_V3_ALLOW_PUBLIC_ARCHIVES=if($SoloLocal){"0"}else{"1"}
 $pythonArgs=@($workerPath)
 if($Trabajo){$pythonArgs+=@("--job-id",$Trabajo)}
 if($UnaVez){$pythonArgs+= "--once"}
 elseif($Comprobar){$pythonArgs+="--check-config"}
 elseif($SincronizarRevisiones){$pythonArgs+="--sync-reviews"}
 $pythonExe=Get-Command python -ErrorAction SilentlyContinue
 if(!$pythonExe){$pythonExe=Get-Command py -ErrorAction SilentlyContinue}
 if(!$pythonExe){throw "Python no está disponible en PATH. Instala Python 3.10+ o añádelo a PATH."}
 if($pythonExe.Name -eq "py.exe"){$pythonArgs = @("-3") + $pythonArgs}
 Write-Host "Trabajador de MF Legacy iniciado. Para detener, Ctrl+C." -ForegroundColor Cyan
 try{
  & $pythonExe.Source @pythonArgs
  if($LASTEXITCODE -ne 0){throw "El worker termino con error ($LASTEXITCODE)."}
 } finally {
  Remove-Item Env:MF_V3_WORKER_TOKEN -ErrorAction SilentlyContinue
  Remove-Item Env:MF_V3_WORKER_URL -ErrorAction SilentlyContinue
 }
}
try{
 if($Configurar){Registrar}
 else{Ejecutar}
} catch {
 Write-Host ("ERROR: "+$_.Exception.Message) -ForegroundColor Red
 exit 1
}
