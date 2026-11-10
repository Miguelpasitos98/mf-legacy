import {useEffect,useState} from "react";
import {base44} from "@/api/base44Client";

const fallbackSeasons=Array.from({length:17},(_,i)=>{
 const year=2025-i;
 return `${year}/${year+1}`;
});
const isSeason=value=>/^(19|20)\d\d\/(19|20)\d\d$/.test(String(value||""));
const rowsOf=value=>Array.isArray(value)?value:value?.items||value?.data||value?.results||null;

// A COMPLETE season is the smallest safe unit for a historical comparison:
// never expose half a competition or a half-loaded season as statistical data.
export async function loadCompleteSeason(entity,season,{pageSize=300,maxRows=9000}={}){
 const all=[],ids=new Set();
 for(let skip=0;skip<maxRows;skip+=pageSize){
  const response=await entity.filter({season},"-created_date",pageSize,skip);
  const rows=rowsOf(response);
  if(!Array.isArray(rows))throw Error("Respuesta inválida para temporada "+season);
  for(const row of rows){
   const id=String(row.id||"");
   if(!id||ids.has(id)||row.season!==season)throw Error("Paginación incoherente en "+season);
   ids.add(id);all.push(row);
  }
  if(rows.length<pageSize)return all;
 }
 throw Error("Límite de filas por temporada: "+season);
}

export async function availableHistoricalSeasons(entity){
 try{
  const response=await entity.list({distinct:"season",limit:500});
  const rows=rowsOf(response);
  if(!Array.isArray(rows)||response?.has_more||rows.length>=500)throw Error("Temporadas incompletas");
  const seasons=[...new Set(rows.filter(isSeason))];
  return seasons.sort((a,b)=>b.localeCompare(a));
 }catch{
  // Fallback only when distinct is unavailable. A season is still downloaded
  // and validated independently; no numbers are estimated or fabricated.
  return fallbackSeasons;
 }
}

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
