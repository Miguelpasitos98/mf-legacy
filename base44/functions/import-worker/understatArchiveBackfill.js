import {ARCHIVE_URL,ARCHIVE_SHA256,readArchive,deriveStatsBackfill} from './understatArchiveCore.mjs';

// Server-only, add-only fallback for previously created league rows.
// Caller must authenticate the worker and verify its lease before invoking us.
const txt=v=>String(v??'').trim();
const rows=v=>Array.isArray(v)?v:v?.items||v?.data||v?.entities||[];
const metricKey=x=>txt(x).toLowerCase().replace(/[^a-z0-9]/g,'');
const APPROVED=new Set(['verified','confirmed','manual','manual_confirmada','confirmada','automatic_exact_name_unique','automatic_existing_stats_unique']);
export function planArchiveAdditions(previous,incoming){
 const old=Array.isArray(previous)?previous:[];
 const known=new Map(old.filter(x=>x?.name).map(x=>[metricKey(x.name),x]));
 const nativeNames={
  'understatgoals':['goals','goles'],'understatassists':['assists','asistencias'],
  'understatxg':['xg','expectedgoals'],'understatxa':['xa','expectedassists'],
  'understatnpxg':['xgexclpenalty','nonpenaltyxg','npxg'],
  'understatshots':['shots','tiros']};
 const additions=[];let conflicts=0;
 for(const metric of incoming||[]){
  const key=metricKey(metric.name),exact=known.get(key);
  if(exact){
   if(exact.value!=null&&Number(exact.value)!==Number(metric.value))conflicts++;
   continue;
  }
  if((nativeNames[key]||[]).some(alias=>{
    const val=known.get(alias)?.value;return val!==null&&val!==undefined&&val!=='';
  }))continue;
  additions.push(metric);known.set(key,metric);
 }
 return {additions,conflicts};
}
let cachedArchive=null,cachedAt=0;
async function archiveText(){
 if(cachedArchive&&Date.now()-cachedAt<1800000)return cachedArchive;
 const result=await fetch(ARCHIVE_URL,{headers:{Accept:'text/csv'},signal:AbortSignal.timeout(24000)});
 if(!result.ok)throw Error('Archivo histórico no disponible (HTTP '+result.status+')');
 const bytes=await result.arrayBuffer();
 if(bytes.byteLength<1000||bytes.byteLength>11000000)throw Error('Tamaño de archivo histórico incorrecto');
 const sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
 if(sha!==ARCHIVE_SHA256)throw Error('SHA-256 histórico incompatible');
 cachedArchive=new TextDecoder().decode(bytes);
 cachedAt=Date.now();
 return cachedArchive;
}
async function allRows(entity,query,cap=350){
 const result=[];
 for(let skip=0;skip<cap;skip+=100){
  const batch=rows(await entity.filter(query,'id',100,skip));
  result.push(...batch);
  if(batch.length<100)return result;
 }
 throw Error('Historial de jugador demasiado grande para completar automáticamente');
}
export async function runHistoricalArchiveBackfill(db,job){
 const result={status:'skipped',rows_updated:0,metrics_added:0,conflicts:0,skipped:0,reason:''};
 const playerId=txt(job.player_id),pid=txt(job.fotmob_player_id);
 if(!/^[a-f0-9]{24}$/i.test(playerId)||!/^\d{1,15}$/.test(pid))return {...result,reason:'Identidad inválida'};
 const [player,links,backlinks,stats]=await Promise.all([
  db.Player.get(playerId),allRows(db.PlayerFotmobLink,{player_id:playerId},100),
  allRows(db.PlayerFotmobLink,{fotmob_player_id:pid},100),
  allRows(db.PlayerSeasonStats,{player_id:playerId})]);
 if(!player||!stats.length)return {...result,reason:'Todavía no hay temporadas en STATS'};
 const distinct=[...new Set(links.map(x=>txt(x.fotmob_player_id)).filter(Boolean))];
 if(distinct.length!==1||distinct[0]!==pid||
   !links.some(x=>APPROVED.has(txt(x.verification).toLowerCase()))||
   backlinks.some(x=>txt(x.player_id)!==playerId)||
   stats.some(x=>txt(x.fotmob_player_id)&&txt(x.fotmob_player_id)!==pid))
   return {...result,reason:'Vinculación FotMob inconsistente'};
 const plan=deriveStatsBackfill(readArchive(await archiveText(),player.name),stats);
 if(plan.status!=='verified')return {...result,status:plan.status,reason:'No hay identidad histórica única en Understat'};
 result.status='verified';
 result.skipped=plan.skipped.length;
 for(const item of plan.entries){
  // Reload to avoid losing new FotMob metrics written since planning.
  const current=await db.PlayerSeasonStats.get(item.id);
  if(!current||txt(current.player_id)!==playerId||
    (txt(current.fotmob_player_id)&&txt(current.fotmob_player_id)!==pid)||
    current.season!==item.season||current.competition!==item.competition||
    current.team_name!==item.team_name||current.is_national_team===true){
    result.skipped++;continue;
  }
  const old=Array.isArray(current.metrics)?current.metrics:[];
  const {additions,conflicts}=planArchiveAdditions(old,item.metrics);
  result.conflicts+=conflicts;
  if(!additions.length)continue;
  await db.PlayerSeasonStats.update(current.id,{metrics:[...old,...additions]});
  result.rows_updated++;
  result.metrics_added+=additions.length;
 }
 return result;
}
