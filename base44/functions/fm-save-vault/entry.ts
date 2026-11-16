import {createClientFromRequest} from "npm:@base44/sdk";
const ID="miguel-vault-v1";
// Subidas de 2 MB confirmadas contra el almacenamiento real de Base44.
const CHUNK=2*1024*1024;
const LIMIT=1024*1024*1024;
const out=(data,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store"}});
const fail=(error,status=400)=>out({ok:false,error},status);
const rows=value=>Array.isArray(value)?value:value?.items||value?.data||value?.entities||[];
const safe=value=>String(value||"").trim();
const validId=id=>/^[a-f0-9]{24}$/i.test(safe(id));
const validGame=game=>game==="FM26"||game==="FM27";
function publicRow(row){return {id:row.id,record_key:row.record_key,filename:row.filename,size_bytes:row.size_bytes,last_modified:row.last_modified,game:row.game,build:row.build,in_game_date:row.in_game_date,players_count:row.players_count,part_count:row.part_count,parts_saved:row.parts?.length||0,status:row.status,index_status:row.index_status,index_part_count:row.index_part_count,index_size_bytes:row.index_size_bytes,uploaded_at:row.uploaded_at};}
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
  if(action==="remove-obsolete-fm27-betis"){
   const target=await db.get("6afae6f19d0c2647bc7447fc");
   if(!target||target.id!=="6afae6f19d0c2647bc7447fc"||target.kind!=="save"||target.vault_id!==ID||target.game!=="FM27"||target.filename!=="Miguel Núñez - Real Betis.fm"||target.status!=="ready")return fail("La partida no coincide con el registro autorizado.",409);
   await db.delete(target.id);
   return out({ok:true,deleted_id:target.id});
  }
  if(action==="list"){
   const values=rows(await db.filter({kind:"save",vault_id:ID},"-uploaded_at",500));
   return out({ok:true,items:values.map(publicRow)});
  }
  if(action==="begin"){
   const filename=safe(data.filename),game=safe(data.game),size=Number(data.size_bytes),last=Number(data.last_modified||0);
   if(!validGame(game)||!filename.toLowerCase().endsWith(".fm")||filename.length>220||!Number.isSafeInteger(size)||size<1||size>LIMIT)return fail("Archivo FM26/FM27 no válido o superior a 1 GB.");
   if(!Number.isFinite(last)||last<0)return fail("Fecha de archivo no válida.");
   const record_key=[game,filename.toLowerCase(),size,last,"chunk2m-v3"].join("|");
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
  if(action==="index-begin"){
   if(entry.status!=="ready")return fail("Guarda primero la partida completa.",409);
   if(entry.index_status==="ready")return out({ok:true,already_saved:true,index_part_count:entry.index_part_count});
   const size=Number(data.size_bytes),chunk=512*1024;
   if(!Number.isSafeInteger(size)||size<1||size>40*1024*1024)return fail("Índice fuera de rango.");
   if(entry.index_size_bytes&&entry.index_size_bytes!==size)return fail("El tamaño del índice ha cambiado.",409);
   const count=Math.ceil(size/chunk);
   if(!entry.index_size_bytes)await db.update(id,{index_size_bytes:size,index_part_count:count,index_parts:[],index_status:"uploading"});
   return out({ok:true,already_saved:false,index_part_count:count,index_parts_saved:entry.index_parts?.length||0,chunk_bytes:chunk});
  }
  if(action==="index-upload"){
   if(entry.status!=="ready")return fail("Partida incompleta.",409);
   if(entry.index_status==="ready")return out({ok:true,already_saved:true});
   const index=Number(data.index),parts=entry.index_parts||[],chunk=512*1024;
   if(!Number.isInteger(index)||index<0||index>=entry.index_part_count)return fail("Índice de fragmento inválido.");
   if(index<parts.length)return out({ok:true,already_saved:true});
   if(index!==parts.length)return fail("Fragmentos fuera de orden.",409);
   const encoded=safe(data.base64);
   if(encoded.length>Math.ceil(chunk*4/3)+16)return fail("Fragmento de índice demasiado grande.");
   let raw;try{raw=atob(encoded);}catch{return fail("Fragmento de índice inválido.");}
   const expected=Math.min(chunk,entry.index_size_bytes-index*chunk);
   if(raw.length!==expected)return fail("Tamaño del índice incorrecto.");
   const bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
   const upload=await api.asServiceRole.integrations.Core.UploadPrivateFile({file:new File([bytes],"fm-index-"+id+"-"+index+".gz",{type:"application/gzip"})});
   if(typeof upload?.file_uri!=="string"||upload.file_uri.length<3)return fail("No se almacenó el índice.",502);
   await db.update(id,{index_parts:[...parts,{index,file_uri:upload.file_uri,size_bytes:expected}]});
   return out({ok:true});
  }
  if(action==="index-finish"){
   if(entry.index_status==="ready")return out({ok:true});
   const parts=entry.index_parts||[];
   if(!entry.index_part_count||parts.length!==entry.index_part_count)return fail("Índice pendiente.",409);
   await db.update(id,{index_status:"ready"});
   return out({ok:true});
  }
  if(action==="index-url"){
   if(entry.index_status!=="ready")return fail("Índice no disponible.",404);
   const index=Number(data.index),part=entry.index_parts?.[index];
   if(!Number.isInteger(index)||index<0||!part||part.index!==index)return fail("Fragmento de índice inválido.");
   const signed=await api.asServiceRole.integrations.Core.CreateFileSignedUrl({file_uri:part.file_uri,expires_in:300});
   if(!signed?.signed_url)return fail("No se pudo recuperar el índice.",502);
   return out({ok:true,url:signed.signed_url,size_bytes:part.size_bytes});
  }
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
