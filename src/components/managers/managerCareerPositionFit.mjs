import {collectPlayerSeasonMetrics,linkedManagerFitRows} from "./managerFitHistorical.mjs";
import {evaluateRoleRequirements} from "./managerRoleFit.mjs";

// A historical season must be classified in this position by the existing
// historical position resolver. A current FM26 position alone is not evidence.
const roleMatches=(historical,selected)=>
 historical===selected||(selected==="FB"&&historical==="WB")||
 (selected==="AM"&&historical==="CAM")||(selected==="WG"&&historical==="W");
const key=(pid,season)=>String(pid)+"|"+String(season);
const nonEmptyId=x=>String(x??"").trim();
const validSeason=s=>/^\d{4}\/\d{4}$/.test(String(s));
const addTo=(map,k,row)=>{if(!map.has(k))map.set(k,[]);map.get(k).push(row)};

// Only scored years (>=2 measured indicators with >=10 same-season peers)
// contribute to the blend. Every season is evaluated independently first.
export function careerPositionFitIndex({dataset,players=[],links=[],role,profile}={}){
 const empty=new Map();
 if(!dataset?.observations?.length||!profile)return empty;
 const relevant=dataset.observations.filter(o=>roleMatches(o.role,role)&&validSeason(o.season)&&nonEmptyId(o.playerId)&&Number(o.minutes)>=450&&!o.positionMixed);
 if(!relevant.length)return empty;
 const chosen=new Set(relevant.map(o=>key(o.playerId,o.season)));
 const observationsBySeason=new Map();
 for(const o of relevant)addTo(observationsBySeason,o.season,o);
 const rawStats=linkedManagerFitRows(dataset.records?.PlayerSeasonStats||[],links,players);
 const rawUnder=linkedManagerFitRows(dataset.records?.UnderstatSeasonRate||[],links,players);
 const statsByKey=new Map(),underByKey=new Map();
 for(const r of rawStats){const k=key(r.player_id,r.season);if(chosen.has(k))addTo(statsByKey,k,r)}
 for(const r of rawUnder){const k=key(r.player_id,r.season);if(chosen.has(k))addTo(underByKey,k,r)}
 const metricsByKey=new Map(),cohorts=new Map();
 for(const obs of relevant){
  const k=key(obs.playerId,obs.season);
  const measured={...collectPlayerSeasonMetrics(statsByKey.get(k)||[],underByKey.get(k)||[],obs.season,obs.playerId),__playerId:String(obs.playerId)};
  metricsByKey.set(k,measured);
  addTo(cohorts,obs.season,measured);
 }
 const byPlayer=new Map();
 for(const obs of relevant){
  const measured=metricsByKey.get(key(obs.playerId,obs.season));
  const fit=evaluateRoleRequirements(measured,cohorts.get(obs.season)||[],role,profile,{playerId:obs.playerId});
  if(fit.score===null)continue;
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
 return results;
}
