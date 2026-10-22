import {studioImportManifest,splitStudioArchive,selectStudioWrites} from "./studioFullImport.js";
const responseRows=r=>Array.isArray(r)?r:r?.items||r?.data||r?.entities||r?.results||[];
const timeout=e=>/timed out|timeout|504|429|rate limit/i.test(String(e?.message||e));
const rateLimited=e=>/429|rate limit exceeded|retry after/i.test(String(e?.message||e));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const rateWait=(error,attempt)=>{
 const found=String(error?.message||error).match(/retry after\s+(\d+)\s*s/i);
 return Math.min(70000,Math.max(21000,found?Number(found[1])*1000+2000:21000*(attempt+1)));
};
async function updateWithRateLimit(entity,id,row,progress){
 for(let attempt=0;attempt<5;attempt++){
  try{return await entity.update(id,row);}
  catch(e){
   if(!rateLimited(e)||attempt===4)throw e;
   progress?.("Límite temporal de Base44; reanudando actualización",attempt+1,5);
   await sleep(rateWait(e,attempt));
  }
 }
}
export async function studioJsonSha256(source){
 const data=new TextEncoder().encode(source);
 const digest=await crypto.subtle.digest("SHA-256",data);
 return Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,"0")).join("");
}
async function findExisting(entity,keys){
 const result=[];
 for(let i=0;i<keys.length;i+=45){
  const page=responseRows(await entity.filter({record_key:{$in:keys.slice(i,i+45)}},{limit:100}));
  result.push(...page);
 }
 const unique=new Set();
 for(const item of result){
  if(unique.has(item.record_key))throw Error("Hay identificadores duplicados en el archivo histórico almacenado.");
  unique.add(item.record_key);
 }
 return result;
}
function batches(rows){
 const result=[],maxBytes=90000;
 let batch=[],total=0;
 for(const row of rows){
  const len=JSON.stringify(row).length;
  if(batch.length&&(batch.length>=5||total+len>maxBytes)){
   result.push(batch);batch=[];total=0;
  }
  batch.push(row);total+=len;
 }
 if(batch.length)result.push(batch);
 return result;
}
async function saveEntity(entity,records,progress){
 if(!records.length)return {created:0,updated:0,unchanged:0};
 const existing=await findExisting(entity,records.map(r=>r.record_key));
 const writes=selectStudioWrites(records,existing);
 let created=0,updated=0;
 for(const group of batches(writes.create)){
  try{
   if(group.length===1)await entity.create(group[0]);
   else await entity.bulkCreate(group);
   created+=group.length;
  }catch(e){
   // Uncertain writes can be committed even when the network timed out.
   // Never blindly replay a bulk operation.
   if(!timeout(e))throw e;
   const verified=await findExisting(entity,group.map(r=>r.record_key));
   const check=selectStudioWrites(group,verified);
   if(check.create.length||check.update.length)throw Error("No se pudo confirmar el último lote. Reimporta el mismo archivo para continuar sin duplicados. "+e.message);
   created+=group.length;
  }
  progress?.(created+updated+writes.unchanged.length,records.length);
 }
 for(const entry of writes.update){
  await updateWithRateLimit(entity,entry.id,entry.row);
  updated++;progress?.(created+updated+writes.unchanged.length,records.length);
 }
 return {created,updated,unchanged:writes.unchanged.length};
}
export async function importFullStudioFile(base44,input,originalText,{playerId="",fileName="",onProgress}={}){
 const raw=originalText||JSON.stringify(input);
 const fileHash=await studioJsonSha256(raw);
 const playerFotmobId=studioImportManifest(input,{playerId,fileHash}).pid;
 const recordKey="studio:file:"+playerFotmobId+":"+fileHash;
 const prior=await findExisting(base44.entities.PlayerSourceArchive,[recordKey]);
 let fileUri=prior[0]?.file_uri||"";
 // Use private Base44 storage; no large JSON is written to entity string
 // fields and the user's Studio export isn't exposed as a public URL.
 if(!fileUri){
  onProgress?.("Subiendo archivo original",0,1);
  const file=new File([raw],fileName||("MF_Legacy_"+playerFotmobId+".json"),{type:"application/json"});
  const uploaded=await base44.integrations.Core.UploadPrivateFile({file});
  fileUri=uploaded?.file_uri||"";
  if(!fileUri)throw Error("Base44 no devolvió la ubicación privada del archivo. No se guardaron estadísticas fuente parciales.");
 }
 const manifest=studioImportManifest(input,{playerId,fileHash,sourceFileUri:fileUri});
 const archive=[{record_key:recordKey,player_id:playerId,fotmob_player_id:playerFotmobId,
  file_hash:fileHash,source_file:fileName||"",file_uri:fileUri,
  archive_storage:"base44_private_file",original_file_bytes:new TextEncoder().encode(raw).length,
  record_count:manifest.records.length,source_sections:manifest.kinds,
  payload_json:JSON.stringify({file_uri:fileUri,sha256:fileHash,format:"mf_legacy_external_batch_v1"}),
  archive_status:"original_full_json",chunk_index:0,chunk_total:1,payload_length:raw.length,
  snapshot_date:input.snapshot_date||"",schema_version:input.schema}];
 const archived=await saveEntity(base44.entities.PlayerSourceArchive,archive,
  (done,total)=>onProgress?.("Archivo completo",done,total));
 const indexed=await saveEntity(base44.entities.PlayerProviderRecord,manifest.records,
  (done,total)=>onProgress?.("Fuentes normalizadas",done,total));
 return {fileHash,archiveFileUri:fileUri,sourceRows:manifest.records.length,
  kinds:manifest.kinds,archived,indexed};
}
