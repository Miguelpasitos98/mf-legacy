import {createClientFromRequest} from 'npm:@base44/sdk';
import {ARCHIVE_URL,ARCHIVE_SHA256,readArchive,deriveRates,deriveStatsBackfill,teamKey,leagueKey} from './core.mjs';
import {planHistoricalMissing,checkedImportCandidate,archiveMetrics,missingMetrics,externalArchiveId} from './missingPlan.mjs';
import {automaticHistoricalImport} from './autoSafe.mjs';

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
  if(body?.action==='auto-safe-player'){
    const jobId=txt(body.job_id);
    if(!/^[a-f0-9]{24}$/i.test(jobId))return reply({ok:false,error:'Trabajo inválido'},400);
    const db=sdk.asServiceRole.entities;
    const job=await db.ImportJob.get(jobId);
    if(!job)return reply({ok:false,error:'Trabajo no encontrado'},404);
    if(!['review','completed'].includes(job.status))
      return reply({ok:true,status:'waiting',reason:'Trabajo todavía en curso'});
    // This lock is shared with the existing review reconciliation. Never let
    // two browser tabs auto-create the same season at the same time.
    const token=crypto.randomUUID(),now=new Date().toISOString();
    await db.ImportJob.updateMany(
      {id:jobId,$or:[{review_lock_until:{$exists:false}},{review_lock_until:null},
        {review_lock_until:""},{review_lock_until:{$lt:now}}]},
      {$set:{review_lock_id:token,review_lock_until:new Date(Date.now()+120000).toISOString()}});
    if((await db.ImportJob.get(jobId)).review_lock_id!==token)
      return reply({ok:true,status:'busy',reason:'Otra conciliación está activa'});
    try{
      const result=await automaticHistoricalImport(db,job,await archiveText(),{maxRows:4});
      if(result.audit&&!['partial','finished'].includes(result.status)){
        const latest=await db.ImportJob.get(jobId);
        if(['review','completed'].includes(latest?.status)&&latest.phase===job.phase)
          await db.ImportJob.update(jobId,{source_results:{
            ...(latest.source_results||{}),understat_gap_audit:result.audit
          }});
      }
      if(result.status==='identity_required'&&!result.audit){
        const latest=await db.ImportJob.get(jobId);
        if(['review','completed'].includes(latest?.status)&&latest.phase===job.phase)
          await db.ImportJob.update(jobId,{source_results:{
            ...(latest.source_results||{}),understat_gap_audit:{
              status:'needs_fotmob_link',job_phase:job.phase,
              checked_at:new Date().toISOString(),proposals:0,
              note:result.reason||'Identidad FotMob pendiente'}
          }});
      }
      return reply({...result,job_id:jobId});
    }finally{
      try{
        const latest=await db.ImportJob.get(jobId);
        if(latest?.review_lock_id===token)
          await db.ImportJob.update(jobId,{review_lock_id:"",review_lock_until:""});
      }catch(e){console.warn('Understat bulk lock expires naturally',String(e?.message||e).slice(0,100))}
    }
  }

  // Persist a small, source-scoped audit in the existing ImportJob so the
  // queue can display missing seasons even after the browser is reopened.
  // Audits are read-only for STATS; only the diagnostic field of the job changes.
  if(body?.action==='audit-job'){
    const jobId=txt(body.job_id);
    if(!/^[a-f0-9]{24}$/i.test(jobId))return reply({ok:false,error:'Trabajo inválido'},400);
    const db=sdk.asServiceRole.entities;
    const job=await db.ImportJob.get(jobId);
    if(!job)return reply({ok:false,error:'Trabajo no encontrado'},404);
    if(['queued','running'].includes(job.status))return reply({ok:true,status:'waiting_job',job_id:jobId});
    if(!['review','completed'].includes(job.status))return reply({ok:true,status:'not_finished',job_id:jobId});
    // The final continuation block may only list FotMob even though the root
    // job included Understat. Audit the resulting player history regardless.
    const playerId=txt(job.player_id),pid=txt(job.fotmob_player_id);
    if(!/^[a-f0-9]{24}$/i.test(playerId)||!/^[0-9]{1,15}$/.test(pid))
      return reply({ok:true,status:'unlinked',job_id:jobId});
    const playerJobs=rows(await db.ImportJob.filter({player_id:playerId},undefined,150));
    if(playerJobs.some(j=>['queued','running'].includes(j.status)))
      return reply({ok:true,status:'waiting_job',job_id:jobId});
    const current=await db.ImportJob.get(jobId);
    // Recheck the same job after reading; the worker might still be finishing.
    if(!['review','completed'].includes(current?.status))return reply({ok:true,status:'waiting_job',job_id:jobId});
    const [player,links,back,stats]=await Promise.all([
      db.Player.get(playerId),
      db.PlayerFotmobLink.filter({player_id:playerId},undefined,30),
      db.PlayerFotmobLink.filter({fotmob_player_id:pid},undefined,30),
      db.PlayerSeasonStats.filter({player_id:playerId},undefined,350)
    ]);
    const saved=rows(stats),linkRows=rows(links),backRows=rows(back);
    const approved=new Set(['verified','confirmed','manual','manual_confirmada','confirmada','automatic_exact_name_unique','automatic_existing_stats_unique']);
    let audit={status:'needs_fotmob_link',proposals:0,new_seasons:0,existing_seasons:0,
      checked_at:new Date().toISOString(),source_revision:ARCHIVE_SHA256,
      note:'Identidad FotMob no confirmada'};
    const ids=new Set(linkRows.map(l=>txt(l.fotmob_player_id)).filter(Boolean));
    if(player&&saved.length<350&&ids.size===1&&ids.has(pid)&&
       linkRows.some(l=>approved.has(txt(l.verification).toLowerCase()))&&
       !backRows.some(l=>txt(l.player_id)!==playerId)&&
       !saved.some(r=>txt(r.fotmob_player_id)&&txt(r.fotmob_player_id)!==pid)){
      // An explicitly approved Understat observation already on the player's
      // STATS record is sufficient to recover the previously reviewed source
      // identity on future scans, even without two FotMob seasons.
      const priorIds=new Set();
      for(const row of saved){
        for(const m of row.metrics||[]){
          const p=m?.provenance;
          if(p?.provider==='understat_archive'&&p.sha256===ARCHIVE_SHA256&&
              /^\d+$/.test(txt(p.player_id)))priorIds.add(txt(p.player_id));
        }
      }
      const archive=readArchive(await archiveText(),player.name);
      const verifiedOptions=priorIds.size===1&&archive.has([...priorIds][0])?
        {understat_id:[...priorIds][0],confirm_identity:true}:{};
      const plan=planHistoricalMissing(archive,saved,verifiedOptions);
      const count=plan.proposals?.length||0;
      audit={
        status:['verified','manually_confirmed'].includes(plan.status)?
          (count?'pending':'no_detected_gaps'):
          !archive.size?'not_covered':
          plan.status==='needs_identity_confirmation'?'needs_identity_confirmation':'needs_review',
        proposals:count,
        new_seasons:(plan.proposals||[]).filter(x=>x.action==='create').length,
        existing_seasons:(plan.proposals||[]).filter(x=>x.action==='complete').length,
        excluded:(plan.skipped||[]).length,
        checked_at:new Date().toISOString(),source_revision:ARCHIVE_SHA256,
        understat_id:plan.understat_id||'',
        note:['verified','manually_confirmed'].includes(plan.status)?
          'Archivo histórico contrastado contra STATS (solo ligas cubiertas)':plan.reason||'Identidad o cobertura pendiente'
      };
    }else if(saved.length>=350){
      audit={...audit,status:'needs_review',note:'Más de 349 filas STATS; requiere diagnóstico manual'};
    }
    const latest=await db.ImportJob.get(jobId);
    if(!latest||latest.phase!==job.phase||!['review','completed'].includes(latest.status))
      return reply({ok:true,status:'waiting_job',job_id:jobId});
    audit.job_phase=String(job.phase||"");
    await db.ImportJob.update(jobId,{
      source_results:{...(latest.source_results||{}),understat_gap_audit:audit}
    });
    return reply({ok:true,status:'audited',job_id:jobId,audit});
  }

  const isSupplement=['preview-missing','apply-missing'].includes(body?.action);
  if(!isSupplement&&body?.action!=='enrich')return reply({ok:false,error:'Operación desconocida'},400);
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
  if(!isSupplement&&!seasons.length)return reply({ok:true,status:'no_stats',saved:0,reason:'Importa primero las temporadas FotMob'});
  if(seasons.some(s=>txt(s.fotmob_player_id)&&txt(s.fotmob_player_id)!==pid))
   return reply({ok:false,error:'Historial con IDs FotMob contradictorios'},409);
  const candidates=readArchive(await archiveText(),player.name);
  if(isSupplement){
    const options={understat_id:txt(body.understat_id),confirm_identity:body.confirm_identity===true};
    const plan=planHistoricalMissing(candidates,seasons,options);
    if(body.action==='preview-missing')
      return reply({ok:true,...plan,source_url:ARCHIVE_URL});
    if(body.confirm_apply!==true)return reply({ok:false,error:'La incorporación exige autorización explícita por temporada'},400);
    if(txt(body.source_revision)!==ARCHIVE_SHA256)return reply({ok:false,error:'La versión del archivo cambió: actualiza la vista previa'},409);
    const key=txt(body.row_key);
    // Recheck current source and database immediately before modifying one row.
    const latest=rows(await db.PlayerSeasonStats.filter({player_id:playerId},undefined,350));
    if(latest.some(r=>txt(r.fotmob_player_id)&&txt(r.fotmob_player_id)!==pid))return reply({ok:false,error:'Los IDs FotMob de STATS son contradictorios'},409);
    if(latest.length>=350)return reply({ok:false,error:'Historial demasiado amplio para una importación segura'},409);
    const fresh=planHistoricalMissing(candidates,latest,options);
    const proposal=checkedImportCandidate(fresh,key);
    if(!proposal)return reply({ok:false,error:'La propuesta ya no está disponible o no supera la revisión de identidad'},409);
    const source=(candidates.get(fresh.understat_id)||[]).find(x=>x.season===proposal.season&&x.league===proposal.league_key&&
      // Proposed and source team refer to the exact same archived observation.
      x.team===proposal.team);
    if(!source)return reply({ok:false,error:'El registro original ya no coincide'},409);
    const incoming=archiveMetrics(source,fresh.understat_id);
    if(proposal.action==='create'){
      const external=externalArchiveId(fresh.understat_id,proposal);
      const duplicate=rows(await db.PlayerSeasonStats.filter({external_record_id:external},undefined,5));
      if(duplicate.length)return reply({ok:false,error:'La temporada de archivo ya existe, actualiza la vista previa'},409);
      const saved=await db.PlayerSeasonStats.create({
        external_record_id:external,player_id:playerId,fotmob_player_id:pid,
        player_name:player.name,season:proposal.season,competition:proposal.league,
        team_name:proposal.team,minutes:source.minutes,appearances:Number.isInteger(source.stats?.games)?source.stats.games:null,
        metrics:incoming,source:'understat',verification_status:'verified',
        review_status:'approved',is_national_team:false
      });
      return reply({ok:true,status:'created',season:proposal.season,
        team:proposal.team,record_id:saved.id,metrics_added:incoming.length,
        notice:'Nueva temporada de liga creada desde Understat. Club pendiente de vinculación cuando no exista ID verificado.'});
    }
    if(proposal.action!=='complete'||!proposal.existing_id)return reply({ok:false,error:'Acción no reconocida'},409);
    const record=await db.PlayerSeasonStats.get(proposal.existing_id);
    if(!record||txt(record.player_id)!==playerId||record.season!==proposal.season||
       teamKey(record.team_name)!==teamKey(proposal.team)||leagueKey(record.competition)!==proposal.league_key)return reply({ok:false,error:'La ficha cambió; actualiza la vista previa'},409);
    const existing=Array.isArray(record.metrics)?record.metrics:[];
    const additions=missingMetrics(existing,incoming);
    if(!additions.length)return reply({ok:true,status:'unchanged',season:proposal.season,metrics_added:0});
    // Replace only placeholders with an absent value; never replace real numbers (including 0).
    const replaced=existing.map(m=>{
      const add=additions.find(a=>String(a.name).toLowerCase()===String(m.name).toLowerCase());
      return add&&(m.value===null||m.value===undefined||m.value==='')?add:m;
    });
    const existingNames=new Set(existing.map(m=>String(m.name||'').toLowerCase()));
    const next=[...replaced,...additions.filter(m=>!existingNames.has(String(m.name).toLowerCase()))];
    await db.PlayerSeasonStats.update(record.id,{metrics:next});
    return reply({ok:true,status:'completed',season:proposal.season,
      team:proposal.team,record_id:record.id,metrics_added:additions.length});
  }
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
  // Safely enrich pre-existing league rows. No season creation, no overwrites,
  // and no assumption that Understat and FotMob definitions are interchangeable.
  let statsUpdated=0,metricsAdded=0,statsConflicts=0;
  const metricKey=x=>txt(x).toLowerCase().replace(/[^a-z0-9]/g,'');
  for(const candidate of backfill.entries){
   const current=await db.PlayerSeasonStats.get(candidate.id);
   if(!current||txt(current.player_id)!==playerId||
      (txt(current.fotmob_player_id)&&txt(current.fotmob_player_id)!==pid)||
      current.season!==candidate.season||current.competition!==candidate.competition||
      current.team_name!==candidate.team_name||current.is_national_team===true){
    skipped.push({season:candidate.season,reason:'El registro cambió durante la conciliación; revisar'});continue;
   }
   const previous=Array.isArray(current.metrics)?current.metrics:[];
   const known=new Map(previous.filter(m=>m?.name).map(m=>[metricKey(m.name),m]));
   const additions=[];
   for(const metric of candidate.metrics){
    const existingMetric=known.get(metricKey(metric.name));
    if(existingMetric){
     if(existingMetric.value!=null&&Number(existingMetric.value)!==Number(metric.value))statsConflicts++;
     continue;
    }
    known.set(metricKey(metric.name),metric);
    additions.push(metric);
   }
   if(!additions.length)continue;
   await db.PlayerSeasonStats.update(current.id,{metrics:[...previous,...additions]});
   statsUpdated++;metricsAdded+=additions.length;
  }
  return reply({ok:true,status:'verified',player:player.name,understat_player_id:result.understat_id,
   saved,updated,unchanged,skipped:[...skipped,...backfill.skipped].slice(0,100),
   stats_updated:statsUpdated,stats_metrics_added:metricsAdded,stats_conflicts:statsConflicts,
   source_revision:ARCHIVE_SHA256,
   last_full_season:'2024/2025',verified_season_rates:result.rates.length});
 }catch(e){
  const message=String(e?.message||e);
  const throttled=e?.status===429||/rate limit exceeded|entity_list allows|retry after/i.test(message);
  if(throttled){
   const after=Math.max(30,Math.min(600,(Number(message.match(/retry after\s+(\d+)s?/i)?.[1])||60)+3));
   console.warn('Understat audit deferred by Base44 quota; seconds',after);
   return reply({ok:false,code:'ENTITY_RATE_LIMIT',retry_after_seconds:after,
    error:'Límite de consultas de Base44 alcanzado temporalmente. No se han sobrescrito estadísticas. Reintento disponible después de '+after+'s.'},429);
  }
  console.error('understat-auto failed',message.slice(0,300));
  return reply({ok:false,error:'No se completó la consulta Understat: '+message.slice(0,220)},502);
 }
}
