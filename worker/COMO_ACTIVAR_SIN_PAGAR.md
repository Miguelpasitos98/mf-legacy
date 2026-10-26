# MF LEGACY V3 — Activación sin proveedores comerciales de pago

El motor reutiliza los módulos existentes de MF Legacy Studio (Python). No incorpora API-Football ni API-Sports.

## Instalación en tu ordenador Windows

1. Descarga el repositorio MF Legacy de GitHub y abre la carpeta worker. Mantén juntos mf_v3_worker.py, MF_V3_LOCAL.ps1 y los tres archivos BAT.
2. Ejecuta INSTALAR_TRABAJADOR_V3.bat una vez. Introduce la ruta de Studio (la carpeta que contiene app/profile.py y datos).
3. En Base44 publica import-control, import-worker e import-review si todavía no lo están. Obtén la URL HTTPS real de import-worker del editor de Base44; no la inventes.
4. El instalador genera un token aleatorio: cópialo SOLO en Base44 → Secrets con nombre MF_V3_WORKER_TOKEN. En el PC queda cifrado mediante DPAPI para tu usuario de Windows. No lo envíes por chat.
5. Ejecuta COMPROBAR_TRABAJADOR_V3.bat. Valida archivos, Python, URL y token sin consultar ningún proveedor.
6. Ejecuta INICIAR_TRABAJADOR_V3.bat y deja la consola encendida mientras uses el servicio.
7. En Base44 → IMPORT vincula el jugador con su ID FotMob y pulsa Solicitar datos NUEVOS desde Studio (PC). El trabajador recogerá el trabajo, procesará un jugador cada vez y guardará observaciones para revisar.

## Cobertura real actual

- FotMob: reutiliza los módulos ya existentes de Studio para peticiones individuales explícitas, con caché persistente y límite de ocho recursos nuevos por trabajo. Sus endpoints internos pueden cambiar o estar sujetos a términos de acceso; no usar para rastreo masivo ni superar bloqueos.
- Understat: usa observaciones verificadas que ya existan en la caché de Studio; la primera descarga cuando no hay caché sigue pendiente.
- FIFA/FC y Transfermarkt: usan catálogos históricos verificados que haya disponibles, sin llamadas a proveedores comerciales de pago. No se inventan valores.
- Base44: guarda candidatos y permite su revisión antes de actualizar STATS; conserva lo anterior.

## Estados y problemas frecuentes

- En cola: aún no se ha conectado el trabajador local o la URL/credencial no coincide.
- Revisión pendiente: observaciones reales recibidas, todavía sin incorporar a STATS.
- Error: revisar los detalles y la consola del trabajador.
- Completado sin datos: el origen no tenía datos comprobables dentro de los límites configurados.

No se cambia una cifra verificada por otra, ni se traduce una ausencia a cero, ni se fusionan clubes o competiciones por semejanza del nombre.
