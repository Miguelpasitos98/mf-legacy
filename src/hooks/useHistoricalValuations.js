import {useCallback,useMemo} from "react";
import {useQuery} from "@tanstack/react-query";
import {recordQueryOptions} from "@/api/recordQueries";

// Shared complete snapshot: an unsuccessful refresh retains the last good data.
export function useHistoricalValuations(playerId){
  const query=useQuery({...recordQueryOptions("PlayerHistoricalValuation"),enabled:Boolean(playerId)});
  const valuations=useMemo(()=>(query.data||[]).filter(row=>String(row.player_id)===String(playerId||""))
    .sort((a,b)=>String(b.season||"").localeCompare(String(a.season||""))),[query.data,playerId]);
  const refresh=useCallback(()=>query.refetch(),[query.refetch]);
  return {valuations,loading:query.isFetching,error:query.error,refresh};
}
