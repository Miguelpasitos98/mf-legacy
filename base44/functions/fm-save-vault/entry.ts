import {createClientFromRequest} from "npm:@base44/sdk";
const ID="miguel-vault-v1";
// Fragmentos pequeños para evitar los límites de payload/tiempo del gateway de funciones.
const CHUNK=256*1024;
const LIMIT=1024*1024*1024;
const out=(data,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store"}});
const fail=(error,status=400)=>out({ok:false,error},status);
const rows=value=>Array.isArray(value)?value:value?.items||value?.data||value?.entities||[];
const safe=value=>String(value||"").trim();
const validId=id=>/^[a-f0-9]{24}$/i.test(safe(id));
const validGame=game=>game==="FM26"||game==="FM27";
function publicRow(row){return {id:row.id,record_key:row.record_key,filename:row.filename,size_bytes:row.size_bytes,last_modified:row.last_modified,game:row.game,build:row.build,in_game_date:row.in_game_date,players_count:row.players_count,part_count:row.part_count,parts_saved:row.parts?.length||0,status:row.status,uploaded_at:row.uploaded_at};}
export default async function(req){
 if(req.method!=="POST")return fail("Solo POST",405);
 try{
  const data=await req.json();
  const api=createClientFromRequest(req);
  const db=api.asServiceRole.entities.FmSaveVault;
  // Biblioteca compartida sin cuenta ni contraseña, solicitada expresamente por el propietario.
  // El acceso al enlace de la web también permite usar esta biblioteca.
  const action=safe(data.action);
  if(action==="health")return out({ok:true});
  if(action==="diagnostic-upload"){
   try{const result=await api.asServiceRole.integrations.Core.UploadPrivateFile({file:new File([new Uint8Array([77,70])],"mf-test.bin",{type:"application/octet-stream"})});const signed=await api.asServiceRole.integrations.Core.CreateFileSignedUrl({file_uri:result.file_uri,expires_in:60});return out({ok:true,has_uri:typeof result?.file_uri==="string",has_signed_url:!!signed?.signed_url,uri_prefix:safe(result?.file_uri).split("/")[0],keys:Object.keys(result||{})});}
   catch(error){return out({ok:false,message:String(error?.message||error),status:error?.response?.status||null,detail:String(error?.response?.data?.error||"").slice(0,300)});}
  }
  if(action==="list"){
   const values=rows(await db.filter({kind:"save",vault_id:ID},"-uploaded_at",500));
   return out({ok:true,items:values.map(publicRow)});
  }
  if(action==="begin"){
   const filename=safe(data.filename),game=safe(data.game),size=Number(data.size_bytes),last=Number(data.last_modified||0);
   if(!validGame(game)||!filename.toLowerCase().endsWith(".fm")||filename.length>220||!Number.isSafeInteger(size)||size<1||size>LIMIT)return fail("Archivo FM26/FM27 no válido o superior a 1 GB.");
   if(!Number.isFinite(last)||last<0)return fail("Fecha de archivo no válida.");
   const record_key=[game,filename.toLowerCase(),size,last,"chunk256k-v2"].join("|");
   const matches=rows(await db.filter({kind:"save",vault_id:ID,record_key},undefined,3));
   if(matches.length>1)return fail("Se detectaron partidas duplicadas. Revisa la biblioteca.",409);
   let entry=matches[0];
   if(!entry)entry=await db.create({kind:"save",vault_id:ID,record_key,filename,size_bytes:size,last_modified:last,game,
    build:safe(data.build).slice(0,100),in_game_date:safe(data.in_game_date).slice(0,80),players_count:Math.max(0,Number(data.players_count)||0),
    part_count:Math.ceil(size/CHUNK),parts:[],status:"uploading",uploaded_at:new Date().toISOString()});
   return out({ok:true,entry:publicRow(entry),chunk_bytes:CHUNK});
  }
  const id=safe(data.id);
  if(!validId(id))return fail("ID de partida no válido.");
  const entry=await db.get(id);
  if(!entry||entry.kind!=="save"||entry.vault_id!==ID)return fail("Partida no encontrada.",404);
  if(action==="upload"){
   if(entry.status==="ready")return fail("La partida ya está completa.",409);
   const index=Number(data.index),parts=entry.parts||[];
   if(!Number.isInteger(index)||index<0||index>=entry.part_count)return fail("Índice no válido.");
   if(index<parts.length)return out({ok:true,index,already_saved:true,parts_saved:parts.length});
   if(index!==parts.length)return fail("Subida fuera de orden.",409);
   const encoded=safe(data.base64);
   const expected=Math.min(CHUNK,entry.size_bytes-index*CHUNK);
   if(encoded.length>Math.ceil(CHUNK*4/3)+16)return fail("Fragmento demasiado grande.");
   let raw;try{raw=atob(encoded);}catch{return fail("Fragmento no válido.");}
   if(raw.length!==expected)return fail("Tamaño del fragmento incorrecto.");
   const bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
   const file=new File([bytes],entry.filename+".part-"+String(index+1).padStart(4,"0"),{type:"application/octet-stream"});
   const response=await api.asServiceRole.integrations.Core.UploadPrivateFile({file});
   const uri=response?.file_uri;
   if(typeof uri!=="string"||uri.length<3)return fail("Base44 no confirmó el almacenamiento del fragmento.",502);
   const next=[...parts,{index,file_uri:uri,size_bytes:expected}];
   await db.update(id,{parts:next});
   return out({ok:true,index,parts_saved:next.length});
  }
  if(action==="finish"){
   const parts=entry.parts||[];
   if(parts.length!==entry.part_count)return fail("La partida todavía tiene fragmentos pendientes.",409);
   for(let i=0;i<parts.length;i++)if(parts[i]?.index!==i||parts[i]?.size_bytes!==Math.min(CHUNK,entry.size_bytes-i*CHUNK)||typeof parts[i]?.file_uri!=="string"||parts[i].file_uri.length<3)return fail("Partida incompleta.",409);
   await db.update(id,{status:"ready",uploaded_at:new Date().toISOString()});
   return out({ok:true});
  }
  if(action==="url"){
   if(entry.status!=="ready")return fail("La partida todavía no está completa.",409);
   const index=Number(data.index),part=entry.parts?.[index];
   if(!Number.isInteger(index)||index<0||!part||part.index!==index)return fail("Fragmento no válido.");
   const result=await api.asServiceRole.integrations.Core.CreateFileSignedUrl({file_uri:part.file_uri,expires_in:300});
   if(!result?.signed_url)return fail("No se pudo autorizar la descarga.",502);
   return out({ok:true,url:result.signed_url,size_bytes:part.size_bytes});
  }
  return fail("Acción no reconocida.",400);
 }catch(error){console.error("fm-save-vault failure",error?.message);return fail("Error de almacenamiento: "+String(error?.message||"desconocido").slice(0,200),500);}
}
