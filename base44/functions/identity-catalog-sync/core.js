export const CATALOG_FIELDS = ['fotmob_id','player_name','normalized_name','aliases','birth_date','country','position','teams','source_files','source_updated_at'];
export const MATCH_FIELDS = ['fm26_uid','fm26_unique_id','fm26_name','fm26_birth_date','status','proposed_fotmob_id','confirmed_fotmob_id','confidence','candidates','reason','source_warnings','source_updated_at'];
const STATES=new Set(['identidad_confirmada','alta_confianza','probable','revision_necesaria','conflicto','sin_candidato']);
export const rows=value=>Array.isArray(value)?value:value?.items||value?.data||[];
const validId=value=>typeof value==='string'&&/^[0-9]{1,30}$/.test(value);
export function validateBatch(kind,input){
  if(!['fotmob','fm26'].includes(kind)||!Array.isArray(input)||!input.length||input.length>100)throw Error('Lote inválido: máximo 100 registros.');
  const fields=kind==='fotmob'?CATALOG_FIELDS:MATCH_FIELDS,key=kind==='fotmob'?'fotmob_id':'fm26_uid';
  const seen=new Set();
  return input.map(row=>{
    if(!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).some(k=>!fields.includes(k))||!validId(row[key])||seen.has(row[key]))throw Error('Campos o identificadores no válidos.');
    seen.add(row[key]);
    if(kind==='fotmob'&&(typeof row.player_name!=='string'||!row.player_name.trim()||row.player_name.length>300))throw Error('Nombre FotMob ausente.');
    if(kind==='fm26'&&(!STATES.has(row.status)||typeof row.fm26_name!=='string'||!Number.isFinite(row.confidence)||row.confidence<0||row.confidence>1||!Array.isArray(row.candidates)||row.candidates.length>8))throw Error('Evidencia de correspondencia inválida.');
    for(const field of ['proposed_fotmob_id','confirmed_fotmob_id','fm26_unique_id'])if(row[field]&&!validId(row[field]))throw Error('Identificador externo inválido.');
    if(JSON.stringify(row).length>14000)throw Error('Registro demasiado grande.');
    return Object.fromEntries(fields.filter(k=>row[k]!==undefined).map(k=>[k,row[k]]));
  });
}
export async function upsertBatch(entity,kind,input,hash){
  const records=validateBatch(kind,input),key=kind==='fotmob'?'fotmob_id':'fm26_uid';
  const existing=rows(await entity.filter({[key]:{$in:records.map(r=>r[key])}},undefined,200));
  if(existing.length>=200)throw Error('Demasiados registros para comprobar unicidad.');
  const index=new Map();
  for(const row of existing){if(index.has(row[key]))throw Error('Clave duplicada en el catálogo remoto.');index.set(row[key],row);}
  const create=[],update=[];let unchanged=0;
  for(const row of records){const content_hash=await hash(row),old=index.get(row[key]);
    if(old?.content_hash===content_hash){unchanged++;continue;}
    const data={...row,content_hash,synced_at:new Date().toISOString()};
    if(old)update.push({id:old.id,...data});else create.push(data);
  }
  if(create.length)await entity.bulkCreate(create);
  if(update.length)await entity.bulkUpdate(update);
  return {received:records.length,created:create.length,updated:update.length,unchanged};
}

