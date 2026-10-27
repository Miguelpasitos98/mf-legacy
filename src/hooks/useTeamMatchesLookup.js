import {useMemo,useCallback} from "react";
import {useQuery} from "@tanstack/react-query";
import {recordQueryOptions} from "@/api/recordQueries";
import {canonicalHistoricalCompetition} from "@/utils/historicalJson";

// The same complete input is used by the table, editor and Composite.
export function useTeamMatchesLookup(stats){
  const query=useQuery({...recordQueryOptions("TeamSeasonMatches"),enabled:Boolean(stats?.length)});
  const lookup=useMemo(()=>{
    const map=new Map();
    for(const row of query.data||[]){
      const competition=canonicalHistoricalCompetition(row.competition);
      for(const id of [row.team_id,row.fotmob_team_id].filter(Boolean)){
        const key=String(id)+"|"+row.season+"|"+competition;
        if(map.has(key)&&map.get(key)?.id!==row.id)map.set(key,null);
        else if(!map.has(key))map.set(key,row);
      }
    }
    return map;
  },[query.data]);
  const getTeamMatches=useCallback(record=>{
    if(!record)return null;
    for(const id of [record.team_id,record.fotmob_team_id].filter(Boolean)){
      const key=String(id)+"|"+record.season+"|"+canonicalHistoricalCompetition(record.competition);
      if(lookup.has(key))return lookup.get(key);
    }
    return null;
  },[lookup]);
  return {getTeamMatches,loading:query.isFetching,error:query.error,refresh:()=>query.refetch()};
}
