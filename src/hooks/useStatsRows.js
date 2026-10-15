import {useEffect,useMemo} from "react";
import {useInfiniteQuery,useQueryClient} from "@tanstack/react-query";
import {base44} from "@/api/base44Client";
import {STATS_ROWS_STALE_MS,STATS_CACHE_GC_MS,statsRowsKey,flattenStatsPages,patchStatsCaches} from "@/utils/statsRowsCache";

const unpack=result=>Array.isArray(result)?result:result?.items||result?.data||result?.results||[];
const parseData=row=>({...row,metrics:Array.isArray(row.metrics)?row.metrics:[]});
const PAGE_SIZE=500; // Hasta 500 registros en una consulta (la mayoría de bases actuales caben aquí).
const MAX_AUTO_PAGES=40;

async function fetchStatsPage({season,competition,pageParam}){
  const filter={};
  if(season!=="Todas")filter.season=season;
  if(competition!=="Todas")filter.competition=competition;
  const args={limit:PAGE_SIZE,...(pageParam?{cursor:pageParam}:{})};
  const response=Object.keys(filter).length
    ?await base44.entities.PlayerSeasonStats.filter(filter,args)
    :await base44.entities.PlayerSeasonStats.list(args);
  const rows=unpack(response).map(parseData);
  const cursor=response?.next_cursor||response?.nextCursor||null;
  if((response?.has_more===true || rows.length===PAGE_SIZE && response?.has_more!==false)&&!cursor)
    throw Error("Base44 podría tener más estadísticas, pero no devolvió un cursor; no se dará por completo un ranking incompleto.");
  if(pageParam&&cursor===pageParam)throw Error("Paginación de STATS inconsistente.");
  return {rows,nextCursor:cursor,done:!cursor};
}

export function useStatsRows(season,competition){
  const client=useQueryClient();
  const query=useInfiniteQuery({
    queryKey:statsRowsKey(season,competition),
    initialPageParam:null,
    queryFn:({pageParam})=>fetchStatsPage({season,competition,pageParam}),
    getNextPageParam:lastPage=>lastPage.nextCursor||undefined,
    staleTime:STATS_ROWS_STALE_MS,
    gcTime:STATS_CACHE_GC_MS,
    refetchOnWindowFocus:false,
    refetchOnReconnect:false,
    retry:1,
  });
  const pagesLoaded=query.data?.pages?.length||0;
  const rows=useMemo(()=>flattenStatsPages(query.data),[query.data]);
  // Pages remain cached, even when the STATS route is unmounted.
  // Continue paging only while there are more and no failed request.
  useEffect(()=>{
    if(query.hasNextPage&&!query.isFetching&&!query.isError&&pagesLoaded<MAX_AUTO_PAGES)
      void query.fetchNextPage().catch(()=>{});
  },[query.hasNextPage,query.isFetching,query.isError,pagesLoaded,query.fetchNextPage]);
  const applyLocalRecord=(id,patch)=>patchStatsCaches(client,id,patch);
  const loadMore=()=>query.hasNextPage&&!query.isFetching?query.fetchNextPage():undefined;
  const refresh=()=>client.invalidateQueries({queryKey:statsRowsKey(season,competition),exact:true});
  return {
    rows,
    hasMore:Boolean(query.hasNextPage),
    loadMore,
    applyLocalRecord,
    refresh,
    busy:query.isFetching || (query.hasNextPage && pagesLoaded<MAX_AUTO_PAGES&&!query.isError),
    error:query.error?.message||"",
    cached:Boolean(query.data),
    refreshedAt:query.dataUpdatedAt||null,
    pagesLoaded
  };
}
