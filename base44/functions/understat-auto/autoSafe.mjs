import {ARCHIVE_SHA256,readArchive,teamKey,leagueKey} from "./core.mjs";
import {planHistoricalMissing,archiveMetrics,missingMetrics,externalArchiveId} from "./missingPlan.mjs";

const txt=v=>String(v??"").trim();
const rows=v=>Array.isArray(v)?v:v?.items||v?.data||v?.entities||[];
export const APPROVED_FOTMOB=new Set(["verified","confirmed","manual","manual_confirmada",
 "confirmada","automatic_exact_name_unique","automatic_existing_stats_unique"]);
export function priorApprovedUnderstatId(stats,archive){
 const matched=new Set();
 for(const r of stats)for(const m of r.metrics||[]){
  const p=m?.provenance;
  if(p?.provider==="understat_archive"&&p.sha256===ARCHIVE_SHA256&&
     /^\d+$/.test(txt(p.player_id))&&archive.has(txt(p.player_id)))
   matched.add(txt(p.player_id));
 }
 return matched.size===1?[...matched][0]:null;
}
export function safeAutomaticPlan(archive,stats){
 const approved=priorApprovedUnderstatId(stats,archive);
 const plan=planHistoricalMissing(archive,stats,approved?{understat_id:approved,confirm_identity:true}:{});
 // Never auto-approve arbitrary same-name IDs. Two independent, exact
 // FotMob season+club confirmations or a previously approved source ID only.
 if(!["verified","manually_confirmed"].includes(plan.status))
  return {...plan,automatic_allowed:false};
 return {...plan,automatic_allowed:true};
}
export function auditFromPlan(plan,phase,extra={}){
 const count=plan.proposals?.length||0;
 return {
  status:plan.automatic_allowed?(count?"pending":"no_detected_gaps"):
    plan.status==="needs_identity_confirmation"?"needs_identity_confirmation":
    plan.candidates?.length?"needs_review":"not_covered",
  proposals:count,new_seasons:(plan.proposals||[]).filter(p=>p.action==="create").length,
  existing_seasons:(plan.proposals||[]).filter(p=>p.action==="complete").length,
  excluded:(plan.skipped||[]).length,
  understat_id:plan.understat_id||"",source_revision:ARCHIVE_SHA256,
  checked_at:new Date().toISOString(),job_phase:txt(phase),note:plan.automatic_allowed?
   "Revisión automática contrastada, solo temporadas de ligas cubiertas":
   "Identidad o cobertura pendiente de revisión manual",
  ...extra
 };
}
export function renderAutoResult(status,audit={},extra={}){
 return {ok:true,status,audit,...extra};
}
// Called by one authenticated request per player. One request processes at most
// 4 league-season rows to limit DB writes. The UI walks players sequentially.
export async function automaticHistoricalImport(db,job,csv,{maxRows=4}={}){
 if(!["review","completed"].includes(job?.status))
  return renderAutoResult("waiting",null,{reason:"El trabajo no ha finalizado"});
 const pid=txt(job.fotmob_player_id),playerId=txt(job.player_id);
 if(!/^\d{1,15}$/.test(pid)||!/^[a-f0-9]{24}$/i.test(playerId))
  return renderAutoResult("identity_required",null,{reason:"Identidad incompleta"});
 const otherJobs=rows(await db.ImportJob.filter({player_id:playerId},undefined,150));
 if(otherJobs.some(j=>["queued","running"].includes(j.status)))
  return renderAutoResult("waiting",null,{reason:"El jugador sigue en la cola de Studio"});
 const [player,links,backlinks,stats]=await Promise.all([
  db.Player.get(playerId),db.PlayerFotmobLink.filter({player_id:playerId},undefined,30),
  db.PlayerFotmobLink.filter({fotmob_player_id:pid},undefined,30),
  db.PlayerSeasonStats.filter({player_id:playerId},undefined,350)
 ]);
 const currentStats=rows(stats),linkRows=rows(links),backRows=rows(backlinks);
 if(!player||currentStats.length>=350)
  return renderAutoResult("needs_review",null,{reason:"Historial muy amplio o jugador no disponible"});
 const linkIds=[...new Set(linkRows.map(l=>txt(l.fotmob_player_id)).filter(Boolean))];
 if(linkIds.length!==1||linkIds[0]!==pid||
  !linkRows.some(l=>APPROVED_FOTMOB.has(txt(l.verification).toLowerCase()))||
  backRows.some(l=>txt(l.player_id)!==playerId)||
  currentStats.some(r=>txt(r.fotmob_player_id)&&txt(r.fotmob_player_id)!==pid))
  return renderAutoResult("identity_required",null,{reason:"Vinculación FotMob no verificada o contradictoria"});
 const archive=readArchive(csv,player.name);
 const plan=safeAutomaticPlan(archive,currentStats);
 if(!plan.automatic_allowed){
  return renderAutoResult("manual_review",auditFromPlan(plan,job.phase),
   {reason:plan.reason||"Sin identidad Understat independiente verificada"});
 }
 const totals={created:0,completed:0,metrics_added:0,errors:[]};
 const cap=Math.max(1,Math.min(4,Math.floor(maxRows)||4));
 for(const proposed of plan.proposals.slice(0,cap)){
  const source=(archive.get(plan.understat_id)||[]).find(x=>
    x.season===proposed.season&&x.league===proposed.league_key&&x.team===proposed.team);
  if(!source){totals.errors.push({key:proposed.key,reason:"Fuente histórica no encontrada"});continue}
  const incoming=archiveMetrics(source,plan.understat_id);
  try{
   if(proposed.action==="complete"){
    const current=await db.PlayerSeasonStats.get(proposed.existing_id);
    if(!current||txt(current.player_id)!==playerId||
      (txt(current.fotmob_player_id)&&txt(current.fotmob_player_id)!==pid)||
      current.season!==proposed.season||
      teamKey(current.team_name)!==teamKey(proposed.team)||
      leagueKey(current.competition)!==proposed.league_key){
      totals.errors.push({key:proposed.key,reason:"La temporada cambió mientras se revisaba"});continue;
    }
    const previous=Array.isArray(current.metrics)?current.metrics:[];
    const additions=missingMetrics(previous,incoming);
    if(!additions.length)continue;
    const names=new Set(previous.map(m=>txt(m.name).toLowerCase()));
    const updated=previous.map(m=>{
     const addition=additions.find(a=>txt(a.name).toLowerCase()===txt(m.name).toLowerCase());
     return addition&&(m.value===null||m.value===undefined||m.value==="")?addition:m;
    });
    await db.PlayerSeasonStats.update(current.id,{
      metrics:[...updated,...additions.filter(a=>!names.has(txt(a.name).toLowerCase()))]
    });
    totals.completed++;totals.metrics_added+=additions.length;
   }else if(proposed.action==="create"){
    const external=externalArchiveId(plan.understat_id,proposed);
    const already=rows(await db.PlayerSeasonStats.filter({external_record_id:external},undefined,2));
    if(already.length){totals.errors.push({key:proposed.key,reason:"La temporada ya existe"});continue}
    const comparable=currentStats.filter(r=>r.season===proposed.season&&
      leagueKey(r.competition)===proposed.league_key);
    if(comparable.length){totals.errors.push({key:proposed.key,reason:"Otra fila de esta liga necesita conciliación"});continue}
    const created=await db.PlayerSeasonStats.create({
      external_record_id:external,player_id:playerId,fotmob_player_id:pid,
      player_name:player.name,season:proposed.season,competition:proposed.league,
      team_name:proposed.team,minutes:source.minutes,
      ...(Number.isInteger(source.stats?.games)?{appearances:source.stats.games}:{}),
      metrics:incoming,source:"understat",verification_status:"verified",
      review_status:"approved",is_national_team:false
    });
    currentStats.push({...created,season:proposed.season,competition:proposed.league,team_name:proposed.team});
    totals.created++;totals.metrics_added+=incoming.length;
   }
  }catch(e){
   const message=txt(e?.message||e);
   if(/rate limit exceeded|entity_list allows|retry after/i.test(message))throw e;
   totals.errors.push({key:proposed.key,reason:message.slice(0,140)});
  }
 }
 // No full refetch after writes: use updated in-memory records solely to
 // display remaining potential gaps (the next call revalidates against DB).
 // This avoids a quota-consuming read after each group of writes.
 const next=await db.PlayerSeasonStats.filter({player_id:playerId},undefined,350);
 const after=safeAutomaticPlan(archive,rows(next));
 const audit=auditFromPlan(after,job.phase,{
  last_auto_run:new Date().toISOString(),last_added:totals.metrics_added,
  last_created:totals.created,last_completed:totals.completed,
  last_errors:totals.errors.slice(0,8)
 });
 const latest=await db.ImportJob.get(job.id);
 if(latest&&["review","completed"].includes(latest.status)&&latest.phase===job.phase)
  await db.ImportJob.update(job.id,{
   source_results:{...(latest.source_results||{}),understat_gap_audit:audit}
  });
 return renderAutoResult(after.proposals?.length?"partial":"finished",audit,
  {...totals,remaining:after.proposals?.length||0});
}
