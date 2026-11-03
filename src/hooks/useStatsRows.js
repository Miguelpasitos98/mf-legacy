import {useEffect,useMemo,useRef} from "react";
import {useQuery,useQueryClient} from "@tanstack/react-query";
import {statsSnapshotOptions,refreshStatsDataset} from "@/api/recordQueries";
import {flattenStatsPages,patchStatsCaches,selectStatsRows} from "@/utils/statsRowsCache";
import {HISTORICAL_PEER_KEY} from "@/utils/historicalPeerCache";

export function useStatsRows(season,competition){
  const client=useQueryClient();
  const query=useQuery(statsSnapshotOptions());
  const lastPeerRevision=useRef(0);
  // A fresh STATS snapshot can contain whole seasons imported by another process.
  // Composite must rebuild from the same new rows instead of a 30-minute-old peer cache.
  useEffect(()=>{
    if(!query.dataUpdatedAt||query.dataUpdatedAt===lastPeerRevision.current)return;
    lastPeerRevision.current=query.dataUpdatedAt;
    void client.invalidateQueries({queryKey:HISTORICAL_PEER_KEY});
  },[client,query.dataUpdatedAt]);
  const complete=useMemo(()=>flattenStatsPages(query.data),[query.data]);
  const rows=useMemo(()=>selectStatsRows(complete,season,competition),[complete,season,competition]);
  return {rows,allRows:complete,hasMore:false,loadMore:()=>undefined,
    applyLocalRecord:async(id,patch)=>{
      await client.cancelQueries({queryKey:statsSnapshotOptions().queryKey,exact:true});
      patchStatsCaches(client,id,patch);
    },
    refresh:()=>refreshStatsDataset(client),busy:query.isFetching,
    error:query.error?.message||"",cached:Boolean(query.data),
    refreshedAt:query.dataUpdatedAt||null,pagesLoaded:query.data?1:0};
}
