import { useQuery, useQueryClient } from "@tanstack/react-query";
import {recordQueryOptions,statsSnapshotOptions} from "@/api/recordQueries";
import {flattenStatsPages} from "@/utils/statsRowsCache";
import {createHistoricalPeerDataset,HISTORICAL_PEER_KEY,PEER_ENTITIES} from "@/utils/historicalPeerCache";

export function useHistoricalPeerDataset(enabled = false) {
  const client=useQueryClient();
  return useQuery({
    queryKey:HISTORICAL_PEER_KEY,
    queryFn:async()=>{
      // Two parallel reads at a time: faster than four sequential entities,
      // without the 4+ simultaneous queries that caused 429s.
      const entries=await Promise.all(PEER_ENTITIES.map(async name=>{
        if(name==="PlayerSeasonStats")return [name,flattenStatsPages(await client.fetchQuery(statsSnapshotOptions()))];
        const options=recordQueryOptions(name);
        // Supporting inputs may have changed in an editor that invalidates
        // the derived comparison. Player/Team/STATS share their live caches.
        const fresh=["Player","Team"].includes(name)?options:{...options,staleTime:0};
        return [name,await client.fetchQuery(fresh)];
      }));
      const loaded=Object.fromEntries(entries);
      return createHistoricalPeerDataset(loaded);
    },
    enabled,staleTime:30*60*1000,gcTime:60*60*1000,
    refetchOnWindowFocus:false,refetchOnReconnect:false,retry:false,
  });
}
