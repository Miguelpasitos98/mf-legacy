import { compareHistoricalObservation } from "./historicalPeers.js";

const order = (a,b) => String(a||"").localeCompare(String(b||""),"es",{numeric:true});
export function overviewHistoricalModel(dataset, playerId, selectedSeason, limit=7) {
  const observations=dataset?.observations||[];
  const individual=observations.filter(o=>o.playerId===String(playerId));
  const season=selectedSeason==="Todas" ? null : selectedSeason;
  const picked=season?individual.find(o=>o.season===season):null;
  const result=picked?compareHistoricalObservation(picked,observations,10):null;
  const indicators=(result?.rows||[])
    .filter(m=>m.percentile!==null && m.weight!==null)
    .sort((a,b)=>Math.abs(b.weight)-Math.abs(a.weight)||order(a.name,b.name))
    .slice(0,limit);
  const lastSeasons=[...individual].sort((a,b)=>order(a.season,b.season)).slice(-7);
  const trend=lastSeasons.map(o=>{
    const comparison=compareHistoricalObservation(o,observations,10);
    return {
      season:o.season,score:comparison?.composite?.score??null,
      coverage:comparison?.composite?.coverage??null,
      population:comparison?.population??0,
      players:comparison?.players??0,
      selected:o.season===season,
    };
  });
  return {result,indicators,trend,picked,hasPopulation:observations.length>0};
}
