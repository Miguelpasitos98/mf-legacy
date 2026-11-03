import {useEffect} from "react";
import {base44} from "@/api/base44Client";
import {STATS_SNAPSHOT_KEY,RECORD_KEYS} from "@/api/recordQueries";
import {HISTORICAL_PEER_KEY} from "@/utils/historicalPeerCache";
const listeners=new WeakMap();
// Share subscriptions between STATS and player cards. Coalesce large imports
// into one invalidation, and let React Query retain a complete prior snapshot.
export function useImportDataSync(client,enabled=true){
  useEffect(()=>{
    if(!enabled)return;
    let state=listeners.get(client);
    if(!state){
      state={refs:0,timer:null,stops:[]};
      const invalidate=()=>{
        clearTimeout(state.timer);
        state.timer=setTimeout(()=>{
          for(const key of [STATS_SNAPSHOT_KEY,...Object.values(RECORD_KEYS),HISTORICAL_PEER_KEY])
            client.invalidateQueries({queryKey:key,exact:true});
        },800);
      };
      for(const name of ["PlayerSeasonStats","PlayerHistoricalValuation","UnderstatSeasonRate","TeamSeasonMatches","TeamSeasonPossession"]){
        try{state.stops.push(base44.entities[name].subscribe(invalidate));}catch{/* Explicit refresh remains available if realtime is temporarily unavailable. */}
      }
      const visible=()=>{if(document.visibilityState==="visible")invalidate();};
      document.addEventListener("visibilitychange",visible);
      state.stops.push(()=>document.removeEventListener("visibilitychange",visible));
      listeners.set(client,state);
    }
    state.refs++;
    return ()=>{
      if(--state.refs===0){clearTimeout(state.timer);state.stops.forEach(stop=>{if(typeof stop==="function")stop();});listeners.delete(client);}
    };
  },[client,enabled]);
}
