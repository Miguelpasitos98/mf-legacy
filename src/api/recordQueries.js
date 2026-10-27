import {base44} from "./base44Client";
import {completeRecordQueryOptions,completeStatsQueryOptions} from "../utils/entityRecords.js";
import {STATS_ROWS_KEY,STATS_ROWS_STALE_MS,STATS_CACHE_GC_MS} from "../utils/statsRowsCache.js";
import {HISTORICAL_PEER_KEY} from "../utils/historicalPeerCache.js";

export const RECORD_KEYS={
  Player:["mf-legacy","players"],Team:["mf-legacy","teams"],
  Country:["mf-legacy","countries"],League:["mf-legacy","leagues"],
  TeamLeague:["mf-legacy","team-leagues"],
  PlayerHistoricalValuation:["mf-legacy","records","valuations"],
  TeamSeasonMatches:["mf-legacy","records","team-matches"],
  TeamSeasonPossession:["mf-legacy","records","possessions"],
  UnderstatSeasonRate:["mf-legacy","records","understat-rates"]
};
export const STATS_SNAPSHOT_KEY=[...STATS_ROWS_KEY,"Todas","Todas"];
const baseOptions={staleTime:STATS_ROWS_STALE_MS,gcTime:STATS_CACHE_GC_MS,
  refetchOnWindowFocus:false,refetchOnReconnect:false,retry:false};
export function recordQueryOptions(name){
  if(!RECORD_KEYS[name])throw Error("Entidad sin caché registrada: "+name);
  return completeRecordQueryOptions(base44.entities[name],RECORD_KEYS[name],baseOptions);
}
export const statsSnapshotOptions=()=>completeStatsQueryOptions(base44.entities.PlayerSeasonStats,STATS_SNAPSHOT_KEY,baseOptions);
export async function refreshStatsDataset(client){
  // Mark raw inputs stale before the single derived rebuild. Concurrent users
  // of each key share one in-flight promise instead of downloading twice.
  await Promise.all(Object.values(RECORD_KEYS).map(queryKey=>client.invalidateQueries({queryKey,exact:true,refetchType:"none"})));
  await client.invalidateQueries({queryKey:STATS_SNAPSHOT_KEY,exact:true,refetchType:"none"});
  return Promise.all([
    client.refetchQueries({queryKey:STATS_SNAPSHOT_KEY,exact:true,type:"active"}),
    client.invalidateQueries({queryKey:HISTORICAL_PEER_KEY,exact:true})
  ]);
}
