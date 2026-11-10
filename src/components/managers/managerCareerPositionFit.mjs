import {collectPlayerSeasonMetrics,linkedManagerFitRows} from "./managerFitHistorical.mjs";
import {evaluateRoleRequirements,deriveRoleRequirements} from "./managerRoleFit.mjs";

// A historical season must be classified in this position by the existing
// historical position resolver. A current FM26 position alone is not evidence.
const roleMatches=(historical,selected)=>
 historical===selected||(selected==="FB"&&historical==="WB")||
 (selected==="DM"&&historical==="CM")||
 (selected==="AM"&&historical==="CAM")||(selected==="WG"&&historical==="W");

// The STATS analysis already publishes validated, aligned per-90 indicators.
// Reuse those independently calculated player-season observations rather than
// requiring the second, narrower legacy-label parser to recognize them again.
const HIST_TO_V4={
 preventing:"goals_prevented_p90",passing:"accurate_passes_p90",
 longPassing:"accurate_long_balls_p90",buildup:"xg_buildup_p90",
 chain:"xg_chain_p90",xa:"xa_p90",xg:"npxg_p90",
 creation:"big_chances_created_p90",dribbles:"successful_dribbles_p90",
 pressure:"possession_won_final_3rd_p90",defense:"def_actions_poss_adj_p90",
 shot:"shots_on_target_p90"
};
export function historicalObservationMetrics(observation,raw={}){
 const result={...raw};
 for(const [metric,field] of Object.entries(HIST_TO_V4)){
  const value=observation?.values?.[field];
  if(typeof value==="number"&&Number.isFinite(value)&&value>=0){
   result[metric]={value,source:"STATS · histórico",minutes:Number(observation.minutes)||null,
    scope:"histórico por posición",season:observation.season};
  }
 }
 return result;
}
const key=(pid,season)=>String(pid)+"|"+String(season);
const nonEmptyId=x=>String(x??"").trim();
const validSeason=s=>/^\d{4}\/\d{4}$/.test(String(s));
const addTo=(map,k,row)=>{if(!map.has(k))map.set(k,[]);map.get(k).push(row)};

// Every player-season is scored separately against one role-specific historical
// reference per distinct peer (not a skewed count of the same player’s seasons).
export function careerPositionFitIndex({dataset,players=[],links=[],role,profile}={}){
 const empty=new Map();
 empty.diagnostics={total:dataset?.observations?.length||0,eligible:0,withTwoMetrics:0,scoredSeasons:0,roleRequirements:deriveRoleRequirements(profile,role).metricKeys.length};
 if(!dataset?.observations?.length||!profile)return empty;
 const relevant=dataset.observations.filter(o=>roleMatches(o.role,role)&&validSeason(o.season)&&nonEmptyId(o.playerId)&&Number(o.minutes)>=450&&!o.positionMixed);
 if(!relevant.length)return empty;
 empty.diagnostics.eligible=relevant.length;
 const chosen=new Set(relevant.map(o=>key(o.playerId,o.season)));
 const rawStats=linkedManagerFitRows(dataset.records?.PlayerSeasonStats||[],links,players);
 const rawUnder=linkedManagerFitRows(dataset.records?.UnderstatSeasonRate||[],links,players);
 const statsByKey=new Map(),underByKey=new Map();
 for(const r of rawStats){const k=key(r.player_id,r.season);if(chosen.has(k))addTo(statsByKey,k,r)}
 for(const r of rawUnder){const k=key(r.player_id,r.season);if(chosen.has(k))addTo(underByKey,k,r)}
 const metricsByKey=new Map(),byHistoricalPlayer=new Map();
 for(const obs of relevant){
  const k=key(obs.playerId,obs.season);
  const measured={...historicalObservationMetrics(obs,collectPlayerSeasonMetrics(statsByKey.get(k)||[],underByKey.get(k)||[],obs.season,obs.playerId)),__playerId:String(obs.playerId)};
  metricsByKey.set(k,measured);
  if(Object.values(measured).filter(x=>x&&typeof x.value==="number"&&Number.isFinite(x.value)).length>=2)empty.diagnostics.withTwoMetrics++;
  addTo(byHistoricalPlayer,String(obs.playerId),measured);
 }
 // Build one independent historical reference per comparable player.
 // Never combine incompatible providers or season-global vs competition scope.
 const peerReference=[];
 for(const [pid,seasonMetrics] of byHistoricalPlayer){
  const buckets=new Map();
  for(const record of seasonMetrics)for(const [metric,observation] of Object.entries(record)){
   if(metric==="__playerId"||!observation||typeof observation.value!=="number")continue;
   const group=metric+"|"+(observation.source||"")+"|"+(observation.scope||"");
   if(!buckets.has(group))buckets.set(group,[]);
   buckets.get(group).push(observation);
  }
  const preferred=new Map();
  for(const [group,values] of buckets){
   const metric=group.split("|")[0];
   const weight=values.reduce((total,v)=>total+Math.min(3000,Math.max(0,v.minutes||0)),0);
   const mean=weight>0?values.reduce((total,v)=>total+v.value*Math.min(3000,Math.max(0,v.minutes||0)),0)/weight:
    values.reduce((total,v)=>total+v.value,0)/values.length;
   const candidate={value:mean,source:values[0].source,scope:values[0].scope,minutes:weight||null};
   if(!preferred.has(metric)||weight>preferred.get(metric).weight)preferred.set(metric,{weight,candidate});
  }
  const peer={__playerId:pid};
  for(const [metric,entry] of preferred)peer[metric]=entry.candidate;
  peerReference.push(peer);
 }
 const byPlayer=new Map();
 for(const obs of relevant){
  const measured=metricsByKey.get(key(obs.playerId,obs.season));
  const fit=evaluateRoleRequirements(measured,peerReference,role,profile,{playerId:obs.playerId});
  if(fit.score===null)continue;
  empty.diagnostics.scoredSeasons++;
  addTo(byPlayer,String(obs.playerId),{season:obs.season,score:fit.score,coverage:fit.coverage,
   minutes:Math.min(3000,Number(obs.minutes)||0),fit});
 }
 const results=new Map();
 for(const [pid,seasons] of byPlayer){
  seasons.sort((a,b)=>b.score-a.score||b.coverage-a.coverage||b.season.localeCompare(a.season));
  const best=seasons[0];
  const weight=seasons.reduce((sum,r)=>sum+r.minutes,0);
  const career=weight>0?Math.round(seasons.reduce((sum,r)=>sum+r.score*r.minutes,0)/weight):null;
  // A single evaluated season is NOT represented as a multi-season average.
  const hasCareer=seasons.length>=2&&career!==null;
  results.set(pid,{score:hasCareer?Math.round(best.score*.7+career*.3):best.score,
   bestSeason:best.season,bestScore:best.score,careerScore:hasCareer?career:null,
   seasonCount:seasons.length,coverage:best.coverage,
   confidence:hasCareer?"medium":"low",historicalPosition:role,
   seasons:seasons.map(({season,score,coverage,minutes})=>({season,score,coverage,minutes})),
   fit:best.fit,method:hasCareer?"70% mejor campaña + 30% media de campañas evaluables por minutos":"Solo mejor campaña evaluable; trayectoria insuficiente"});
 }
 results.diagnostics=empty.diagnostics;
 return results;
}
