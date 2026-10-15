import {studioImportManifest,splitStudioArchive,selectStudioWrites} from "./studioFullImport.js";
const responseRows=r=>Array.isArray(r)?r:r?.items||r?.data||r?.entities||r?.results||[];
const timeout=e=>/timed out|timeout|504|429|rate limit/i.test(String(e?.message||e));
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
  await entity.update(entry.id,entry.row);
  updated++;progress?.(created+updated+writes.unchanged.length,records.length);
 }
 return {created,updated,unchanged:writes.unchanged.length};
}
export async function importFullStudioFile(base44,input,originalText,{playerId="",fileName="",onProgress}={}){
 const raw=originalText||JSON.stringify(input);
 const fileHash=await studioJsonSha256(raw);
 const manifest=studioImportManifest(input,{playerId,fileHash});
 const archive=splitStudioArchive(input,{playerId,fileHash,sourceFile:fileName});
 // Preserve complete source before any normalized writer runs.
 const archived=await saveEntity(base44.entities.PlayerSourceArchive,archive,
  (done,total)=>onProgress?.("Archivo completo",done,total));
 const indexed=await saveEntity(base44.entities.PlayerProviderRecord,manifest.records,
  (done,total)=>onProgress?.("Fuentes normalizadas",done,total));
 return {fileHash,archiveChunks:archive.length,sourceRows:manifest.records.length,
  kinds:manifest.kinds,archived,indexed};
}
