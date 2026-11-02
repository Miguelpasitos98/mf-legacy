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
export function normalizeDate(value){const text=String(value||'').trim();const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);return m?`${m[3]}-${m[2]}-${m[1]}`:text.slice(0,10);}
export async function applyApprovedLinks(db,input){
 if(!Array.isArray(input)||input.length>100||!input.length)throw Error('Lote de aprobaciones inválido.');
 const seenUid=new Set(),seenFid=new Set();
 for(const row of input){if(!validId(row.fm_uid)||!validId(row.fotmob_id)||typeof row.reason!=='string'||!row.reason.trim()||seenUid.has(row.fm_uid)||seenFid.has(row.fotmob_id))throw Error('Aprobaciones duplicadas o sin evidencia.');seenUid.add(row.fm_uid);seenFid.add(row.fotmob_id);}
 const players=rows(await db.Player.filter({fm26_uid:{$in:input.map(r=>r.fm_uid)}},undefined,200));
 const ids=players.map(p=>p.id),fids=input.map(r=>r.fotmob_id);
 const links=rows(await db.PlayerFotmobLink.filter({$or:[{player_id:{$in:ids}},{fotmob_player_id:{$in:fids}}]},undefined,300));
 if(players.length>=200||links.length>=300)throw Error('No se puede verificar la unicidad de los vínculos.');
 const candidates=rows(await db.Fm26IdentityCandidate.filter({fm26_uid:{$in:input.map(r=>r.fm_uid)}},undefined,200));
 const catalog=rows(await db.FotmobCatalogPlayer.filter({fotmob_id:{$in:fids}},undefined,200));
 if(candidates.length>=200||catalog.length>=200)throw Error('Catálogo ambiguo.');
 let created=0,unchanged=0;const blocked=[];
 for(const approval of input){
  const owners=players.filter(p=>p.fm26_uid===approval.fm_uid),player=owners[0];
  const block=reason=>blocked.push({fm26_uid:approval.fm_uid,fotmob_id:approval.fotmob_id,reason});
  if(owners.length!==1||approval.base44_id&&approval.base44_id!==player.id){block('Jugador ausente o ambiguo por UID FM26.');continue;}
  const relevant=links.filter(l=>l.player_id===player.id||l.fotmob_player_id===approval.fotmob_id);
  if(relevant.length){if(relevant.length===1&&relevant[0].player_id===player.id&&relevant[0].fotmob_player_id===approval.fotmob_id){unchanged++;continue;}block('Vínculo existente incompatible; no se modifica.');continue;}
  const evidence=candidates.filter(c=>c.fm26_uid===approval.fm_uid),source=catalog.filter(c=>c.fotmob_id===approval.fotmob_id);
  if(evidence.length!==1||source.length!==1||evidence[0].status!=='identidad_confirmada'||evidence[0].confirmed_fotmob_id!==approval.fotmob_id){block('Faltan fuentes y confirmación local compatibles.');continue;}
  const dates=[normalizeDate(player.date_of_birth),normalizeDate(evidence[0].fm26_birth_date),normalizeDate(source[0].birth_date)].filter(Boolean);
  if(new Set(dates).size>1){block('Fechas de nacimiento incompatibles.');continue;}
  const link=await db.PlayerFotmobLink.create({player_id:player.id,fotmob_player_id:approval.fotmob_id,fm26_uid:approval.fm_uid,player_name:player.name,verification:'manual',note:('Aprobación local sincronizada: '+approval.reason).slice(0,800)});
  links.push(link);created++;
 }
 return {received:input.length,created,unchanged,blocked};
}

