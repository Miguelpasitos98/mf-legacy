import {useMemo} from "react";
import {useQuery,useQueryClient} from "@tanstack/react-query";
import {statsSnapshotOptions,refreshStatsDataset} from "@/api/recordQueries";
import {flattenStatsPages,patchStatsCaches,selectStatsRows} from "@/utils/statsRowsCache";

export function useStatsRows(season,competition){
  const client=useQueryClient();
  const query=useQuery(statsSnapshotOptions());
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
