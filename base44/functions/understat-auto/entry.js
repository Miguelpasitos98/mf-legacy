import {createClientFromRequest} from 'npm:@base44/sdk';
import {ARCHIVE_URL,ARCHIVE_SHA256,readArchive,deriveRates,deriveStatsBackfill} from './core.mjs';

const txt=x=>String(x??'').trim();
const rows=x=>Array.isArray(x)?x:x?.items||x?.data||x?.entities||[];
const reply=(x,status=200)=>Response.json(x,{status,headers:{'Cache-Control':'private, no-store'}});
let archiveCache=null,archiveFetchedAt=0;
async function archiveText(){
 if(archiveCache&&Date.now()-archiveFetchedAt<1800000)return archiveCache;
 const response=await fetch(ARCHIVE_URL,{headers:{'Accept':'text/csv'},signal:AbortSignal.timeout(24000)});
 if(!response.ok)throw Error('El archivo histórico no responde: '+response.status);
 const data=await response.arrayBuffer();
 if(data.byteLength>11000000||!data.byteLength)throw Error('Tamaño del archivo histórico incorrecto');
 const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',data));
 const sha=[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
 if(sha!==ARCHIVE_SHA256)throw Error('SHA-256 del archivo histórico no coincide: se ha evitado importar datos');
 archiveCache=new TextDecoder().decode(data);archiveFetchedAt=Date.now();
 return archiveCache;
}
export default async function(req){
 if(req.method!=='POST')return reply({ok:false,error:'Solo POST'},405);
 try{
  const sdk=createClientFromRequest(req);
  let user;
  try{user=await sdk.auth.me();}catch{return reply({ok:false,error:'Debes iniciar sesión'},401);}
  if(!user)return reply({ok:false,error:'Debes iniciar sesión'},401);
  if(user.role!=='admin')return reply({ok:false,error:'Solo administradores'},403);
  const body=await req.json();
  if(body?.action==='health')return reply({ok:true,source:'Understat · archivo histórico verificado',last_full_season:'2024/2025'});
  if(body?.action!=='enrich')return reply({ok:false,error:'Operación desconocida'},400);
  const playerId=txt(body.player_id),pid=txt(body.fotmob_player_id);
  if(!/^[a-f0-9]{24}$/i.test(playerId)||! /^\d{1,15}$/.test(pid))return reply({ok:false,error:'Identidad inválida'},400);
  const db=sdk.asServiceRole.entities;
  const player=await db.Player.get(playerId);
  if(!player?.id)return reply({ok:false,error:'Jugador no encontrado'},404);
  const links=rows(await db.PlayerFotmobLink.filter({player_id:playerId},undefined,30));
  const linkedIds=[...new Set(links.map(x=>txt(x.fotmob_player_id)).filter(Boolean))];
  const back=rows(await db.PlayerFotmobLink.filter({fotmob_player_id:pid},undefined,30));
  const approved=new Set(['verified','confirmed','manual','manual_confirmada','confirmada','automatic_exact_name_unique','automatic_existing_stats_unique']);
  if(linkedIds.length!==1||linkedIds[0]!==pid||!links.some(l=>approved.has(txt(l.verification).toLowerCase()))||back.some(l=>l.player_id!==playerId))
   return reply({ok:false,error:'Primero confirma una vinculación FotMob única'},409);
  const seasons=rows(await db.PlayerSeasonStats.filter({player_id:playerId},undefined,350));
  if(seasons.length>=350)return reply({ok:false,error:'Historial demasiado amplio para verificar íntegramente'},409);
  if(!seasons.length)return reply({ok:true,status:'no_stats',saved:0,reason:'Importa primero las temporadas FotMob'});
  if(seasons.some(s=>txt(s.fotmob_player_id)&&txt(s.fotmob_player_id)!==pid))
   return reply({ok:false,error:'Historial con IDs FotMob contradictorios'},409);
  const candidates=readArchive(await archiveText(),player.name);
  const result=deriveRates(candidates,seasons);
  const backfill=deriveStatsBackfill(candidates,seasons);
  if(result.status!=='verified')return reply({ok:true,status:result.status,saved:0,
   reason:'Understat no pudo identificar inequívocamente al jugador con al menos dos clubes/temporadas compatibles; requiere revisión'});
  const existing=rows(await db.UnderstatSeasonRate.filter({player_id:playerId},undefined,250));
  if(existing.length>=250)return reply({ok:false,error:'Demasiadas tasas históricas para conciliar'},409);
  let saved=0,updated=0,unchanged=0;const skipped=[...result.skipped];
  for(const r of result.rates){
   const found=existing.filter(x=>x.season===r.season);
   if(found.length>1||found.length===1&&txt(found[0].team_key)!=='season-global'){
    skipped.push({season:r.season,reason:'Ya existen tasas de club; requiere conciliación sin sobrescribirlas'});continue;
   }
   const incoming={xg_chain_p90:r.xg_chain_p90,xg_buildup_p90:r.xg_buildup_p90,
     ...(r.xg_total!==null?{xg_total:r.xg_total}:{}),...(r.xa_total!==null?{xa_total:r.xa_total}:{})};
   if(found.length){
    const old=found[0],patch={};
    for(const [field,value] of Object.entries(incoming))
     if(old[field]===null||old[field]===undefined||old[field]==='')patch[field]=value;
    if(Object.keys(patch).length){await db.UnderstatSeasonRate.update(old.id,patch);updated++;}
    else unchanged++;
   }else{
    await db.UnderstatSeasonRate.create({player_id:playerId,fotmob_player_id:pid,
     season:r.season,team:'Temporada',team_key:'season-global',
     source:'Understat · archivo histórico verificado',
     source_scope:'Ligas cubiertas · '+ARCHIVE_SHA256+' · '+ARCHIVE_URL,
     ...incoming});
    saved++;
   }
  }
  return reply({ok:true,status:'verified',player:player.name,understat_player_id:result.understat_id,
   saved,updated,unchanged,skipped:[...skipped,...backfill.skipped].slice(0,100),
   stats_updated:statsUpdated,stats_metrics_added:metricsAdded,stats_conflicts:statsConflicts,
   source_revision:ARCHIVE_SHA256,
   last_full_season:'2024/2025',verified_season_rates:result.rates.length});
 }catch(e){
  console.error('understat-auto failed',String(e?.message||e).slice(0,300));
  return reply({ok:false,error:'No se completó la consulta Understat: '+String(e?.message||e).slice(0,220)},502);
 }
}
