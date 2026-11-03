import {buildHistoricalObservations,compareHistoricalObservation} from "./historicalPeers.js";
import {WEIGHTS_BY_ROLE,METRIC_NAMES} from "./compositeEngine.js";
const available=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v));
export function playerImportDiagnostics(dataset,playerId,candidates=[],jobs=[]){
  const records=dataset?.records||{};
  const stats=(records.PlayerSeasonStats||[]).filter(r=>r.player_id===playerId);
  const observations=dataset?.observations||buildHistoricalObservations({stats,players:records.Player||[]});
  const seasons=[...new Set(stats.map(r=>r.season))].sort().reverse().map(season=>{
    const rows=stats.filter(r=>r.season===season);
    const observation=observations.find(o=>o.playerId===playerId&&o.season===season);
    const comparison=observation?compareHistoricalObservation(observation,observations):null;
    const keys=[...Object.keys(WEIGHTS_BY_ROLE[observation?.role]||{}).filter(k=>WEIGHTS_BY_ROLE[observation.role][k]!==0),"rating"];
    const indicators=keys.map(key=>({key,name:METRIC_NAMES[key]||key,value:observation?.values?.[key]??null,used:comparison?.rows.some(r=>r.key===key&&r.percentile!==null&&r.weight!==0)||false}));
    const metrics=rows.flatMap(r=>(r.metrics||[]).map(m=>({name:m.name,source:m.source||m.provenance?.provider||r.source||"Sin fuente documentada",competition:r.competition,team:r.team_name,total:m.value??null,per90:m.per90??null,unit:m.unit||"",minutes:m.provider_minutes??m.provenance?.provider_minutes??null,url:m.source_url||null})));
    return {season,role:observation?.role||null,competitions:rows.length,saved_values:rows.reduce((sum,r)=>sum+(r.metrics||[]).reduce((n,m)=>n+["value","per90","per_match"].filter(k=>available(m[k])).length,0),0),indicators,available:indicators.filter(i=>available(i.value)).length,used:indicators.filter(i=>i.used).length,missing:indicators.filter(i=>!available(i.value)).map(i=>i.name),metrics};
  });
  const diagnostics=jobs.filter(j=>j.player_id===playerId).flatMap(j=>Object.entries(j.source_results||{}).flatMap(([source,s])=>(s.diagnostics||[]).map(d=>({...d,source}))));
  return {seasons,received:candidates.length,applied:candidates.filter(c=>c.review_status==="applied").length,pending:candidates.filter(c=>c.review_status==="pending").length,conflicts:candidates.filter(c=>c.verification_status==="conflict").length,diagnostics};
}
