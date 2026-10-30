import {buildHistoricalObservations} from "./historicalPeers.js";

// One shared, versioned React Query cache for all the comparison views.
// Raw inputs remain in-memory only, allowing safe recalculation after a
// single successful entity update without another full Base44 download.
export const HISTORICAL_PEER_KEY=["mf-legacy","historical-peer-dataset","v15-st-understat-fallback-20261030"];
export const PEER_ENTITIES=["Player","PlayerSeasonStats","PlayerHistoricalValuation","TeamSeasonMatches","Team","TeamSeasonPossession","UnderstatSeasonRate"];

export function createHistoricalPeerDataset(records, date=new Date().toISOString()){
  const loadedCounts=Object.fromEntries(PEER_ENTITIES.map(name=>[name,(records[name]||[]).length]));
  const observations=buildHistoricalObservations({
    players:records.Player||[],
    stats:records.PlayerSeasonStats||[],
    valuations:records.PlayerHistoricalValuation||[],
    teamMatches:records.TeamSeasonMatches||[],
    teams:records.Team||[],
    teamPossessions:records.TeamSeasonPossession||[],
    understatRates:records.UnderstatSeasonRate||[]
  });
  return {observations,loadedCounts,loadedAt:date,records};
}

// Updates only a row that already exists in the COMPLETE cached population.
// Never inject a new player/season from a partial result: those require a
// subsequent confirmed full refresh to preserve complete global percentiles.
export function patchedHistoricalPeerDataset(dataset,entityName,id,patch){
  if(!dataset?.records || !PEER_ENTITIES.includes(entityName) || !id)return dataset;
  const input=dataset.records[entityName];
  if(!Array.isArray(input))return dataset;
  const rowIndex=input.findIndex(r=>String(r.id)===String(id));
  if(rowIndex<0)return dataset;
  const nextRows=input.slice();
  nextRows[rowIndex]={...nextRows[rowIndex],...patch};
  return createHistoricalPeerDataset({...dataset.records,[entityName]:nextRows},new Date().toISOString());
}
export function patchHistoricalPeerCache(queryClient,entityName,id,patch){
  let applied=false;
  queryClient.setQueryData(HISTORICAL_PEER_KEY,previous=>{
    const next=patchedHistoricalPeerDataset(previous,entityName,id,patch);
    if(next!==previous)applied=true;
    return next;
  });
  return applied;
}
