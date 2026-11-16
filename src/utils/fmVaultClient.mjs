export const VAULT_KEY_STORAGE="mf_legacy_fm_vault_key_v1";
export const VAULT_CHUNK_BYTES=2*1024*1024;
export const VAULT_MAX_BYTES=1024*1024*1024;
export const vaultKey=value=>String(value||"").trim().toLowerCase().replace(/[^a-f0-9]/g,"");
const body=async(base44,key,action,fields={})=>{
  const response=await base44.functions.invoke("fm-save-vault",{vault_key:vaultKey(key),action,...fields});
  const value=response?.data||response;
  if(value?.ok!==true)throw Error(value?.error||"No se pudo conectar con la biblioteca.");
  return value;
};
const base64Bytes=buffer=>{
 const bytes=new Uint8Array(buffer);let result="";
 for(let i=0;i<bytes.length;i+=0x8000)result+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
 return btoa(result);
};
export const checkVault=(api,key)=>body(api,key,"health");
export const listVault=(api,key)=>body(api,key,"list");
export async function uploadVault(api,key,file,meta,progress=()=>{}){
 if(!file||file.size>VAULT_MAX_BYTES||file.size<=0)throw Error("La partida está vacía o supera 1 GB.");
 const begin=await body(api,key,"begin",{filename:file.name,size_bytes:file.size,last_modified:Number(file.lastModified||0),game:meta.game,build:meta.build,in_game_date:meta.date,players_count:meta.players_count||0});
 const entry=begin.entry,total=entry.part_count;
 if(entry.status==="ready")return {alreadySaved:true,entry};
 if(begin.chunk_bytes!==VAULT_CHUNK_BYTES)throw Error("La versión del servidor no coincide con el tamaño de los fragmentos.");
 for(let i=entry.parts_saved;i<total;i++){
  const start=i*VAULT_CHUNK_BYTES;
  const bytes=await file.slice(start,Math.min(start+VAULT_CHUNK_BYTES,file.size)).arrayBuffer();
  const encoded=base64Bytes(bytes);
  for(let attempt=0;attempt<3;attempt++){
   try{await body(api,key,"upload",{id:entry.id,index:i,base64:encoded});break;}
   catch(error){if(attempt===2)throw Error(`No se pudo guardar el fragmento ${i+1} tras 3 intentos: ${error.message}`);await new Promise(resolve=>setTimeout(resolve,1000*(attempt+1)));}
  }
  progress(i+1,total);
 }
 await body(api,key,"finish",{id:entry.id});
 return {alreadySaved:false,entry};
}
export async function downloadVault(api,key,entry,progress=()=>{}){
 if(!entry||entry.status!=="ready"||entry.part_count<1)throw Error("Partida incompleta.");
 const chunks=new Array(entry.part_count);let completed=0;
 const concurrency=Math.min(6,entry.part_count);
 let cursor=0;
 await Promise.all(Array.from({length:concurrency},async()=>{
  while(cursor<entry.part_count){
   const i=cursor++;
   let blob;
   for(let attempt=0;attempt<3;attempt++){
    try{
     const response=await body(api,key,"url",{id:entry.id,index:i});
     const fetchResponse=await fetch(response.url);
     if(!fetchResponse.ok)throw Error("Error de descarga "+fetchResponse.status);
     blob=await fetchResponse.blob();
     if(blob.size!==response.size_bytes)throw Error("Tamaño incorrecto.");
     break;
    }catch(error){if(attempt===2)throw Error("No se pudo descargar el fragmento "+(i+1)+": "+error.message);await new Promise(resolve=>setTimeout(resolve,(attempt+1)*800));}
   }
   chunks[i]=blob;completed++;progress(completed,entry.part_count);
  }
 }));
 const totalBytes=chunks.reduce((sum,blob)=>sum+blob.size,0);
 if(totalBytes!==entry.size_bytes)throw Error("El archivo recuperado está incompleto.");
 return new File(chunks,entry.filename,{type:"application/octet-stream",lastModified:entry.last_modified||Date.now()});
}
