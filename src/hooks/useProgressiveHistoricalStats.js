import {useEffect,useState} from "react";
import {base44} from "@/api/base44Client";

import {availableHistoricalSeasons,loadCompleteSeason} from "@/utils/progressiveHistoricalStats.mjs";

const first=["2022/2023","2023/2024","2024/2025","2025/2026"];
const ordered=seasons=>[
 ...first.filter(s=>seasons.includes(s)),
 ...seasons.filter(s=>!first.includes(s))
];

export function useProgressiveHistoricalStats(enabled=true){
 const [generation,setGeneration]=useState(0);
 const [state,setState]=useState({rows:[],loadedSeasons:[],totalSeasons:null,loading:true,complete:false,error:null,failedSeasons:[]});
 useEffect(()=>{
  if(!enabled)return;
  let live=true;
  const entity=base44.entities.PlayerSeasonStats;
  setState({rows:[],loadedSeasons:[],totalSeasons:null,loading:true,complete:false,error:null,failedSeasons:[]});
  (async()=>{
   const seasons=ordered(await availableHistoricalSeasons(entity));
   if(live)setState(p=>({...p,totalSeasons:seasons.length}));
   if(!seasons.length)throw Error("No se encontraron temporadas de STATS");
   const all=[],loaded=[],failed=[];
   for(const season of seasons){
    if(!live)return;
    try{
     const rows=await loadCompleteSeason(entity,season);
     if(!live)return;
     all.push(...rows);loaded.push(season);
     setState({rows:all.slice(),loadedSeasons:loaded.slice(),totalSeasons:seasons.length,
      loading:false,complete:false,error:null,failedSeasons:failed.slice()});
    }catch(error){
     failed.push({season,message:String(error?.message||error)});
     if(live)setState(p=>({...p,loading:false,error:"No se pudo cargar "+season+": "+String(error?.message||error),failedSeasons:failed.slice()}));
    }
   }
   if(live)setState(p=>({...p,loading:false,complete:failed.length===0,
    error:failed.length?failed.length+" temporadas no se cargaron completas":null,failedSeasons:failed.slice()}));
  })().catch(error=>{if(live)setState(p=>({...p,loading:false,error:String(error?.message||error)}))});
  return ()=>{live=false};
 },[enabled,generation]);
 return {...state,retry:()=>setGeneration(n=>n+1)};
}
