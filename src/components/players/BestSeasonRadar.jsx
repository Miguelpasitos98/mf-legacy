import React, {useMemo} from "react";
import {useHistoricalPeerDataset} from "@/hooks/useHistoricalPeerDataset";
import {compareHistoricalObservation,historicalPercentile} from "@/utils/historicalPeers";

// The radar and the season ranking share the Stats historical peer dataset.
// All values are genuine within-role peer percentiles; missing axes are not fabricated.
const AXES=[
 ["Attacking",["npxg_p90","shots_on_target_p90","xgot_p90"]],
 ["Creativity",["xa_p90","big_chances_created_p90"]],
 ["Passing",["accurate_passes_p90","accurate_long_balls_p90","xg_buildup_p90"]],
 ["Dribbling",["successful_dribbles_p90","dispossessed_p90"]],
 ["Defending",["def_actions_poss_adj_p90","possession_won_final_3rd_p90"]],
 ["Ground duels",["ground_duels_won_pct"]],
 ["Aerial",["aerial_duels_won_pct"]],
 ["Build-up",["xg_chain_p90","xg_buildup_p90"]],
];
const CB_AXES=[
 ["Attacking",["npxg_p90","shots_on_target_p90"]],
 ["Creativity",["xa_p90"]],
 ["Passing",["accurate_passes_p90","accurate_long_balls_p90"]],
 ["Build-up",["xg_buildup_p90","xg_chain_p90"]],
 ["Defending",["def_actions_poss_adj_p90"]],
 ["Ground duels",["ground_duels_won_pct"]],
 ["Aerial",["aerial_duels_won_pct"]],
 ["Ball security",["dispossessed_p90","dribbled_past_p90"]],
];
const GK_AXES=[
 ["Shot stop",["goals_prevented_p90","save_pct"]],
 ["Saving",["save_pct"]],
 ["Passing",["accurate_passes_p90","accurate_long_balls_p90"]],
 ["Long balls",["accurate_long_balls_p90"]],
 ["Prevention",["goals_prevented_p90"]],
 ["Activity",["play_share"]],
];
const pt=(i,r,n)=>{const a=-Math.PI/2+i*2*Math.PI/n;return [125+Math.cos(a)*r,128+Math.sin(a)*r];};
const points=(values,r=87)=>values.map((v,i)=>pt(i,r*(v/100),values.length).join(",")).join(" ");
const NEGATIVE=new Set(["dispossessed_p90","dribbled_past_p90"]);
const scoreAxis=(keys,observation,peers)=>{
 const eligible=keys.flatMap(key=>{
   const current=observation.values?.[key];
   if(current===null||current===undefined||!Number.isFinite(Number(current)))return [];
   const comparable=peers.filter(p=>Number.isFinite(Number(p.values?.[key]))&&p.values[key]!==null);
   if(new Set(comparable.map(p=>p.playerId)).size<10)return [];
   const percentile=historicalPercentile(Number(current),comparable.map(p=>Number(p.values[key])));
   return percentile===null?[]:[NEGATIVE.has(key)?100-percentile:percentile];
 });
 return eligible.length?Math.round(eligible.reduce((a,b)=>a+b,0)/eligible.length):null;
};
const RADAR_POSITION_KEY="mf-legacy-player-profile-position-v1";
const RADAR_SIZE_KEY="mf-legacy-player-profile-size-v1";
const DEFAULT_SIZE={width:240,height:296};
const readSize=()=>{try{const v=JSON.parse(window.localStorage.getItem(RADAR_SIZE_KEY)||"null");return Number.isFinite(v?.width)&&Number.isFinite(v?.height)?{width:Math.max(200,Math.min(650,v.width)),height:Math.max(240,Math.min(750,v.height))}:DEFAULT_SIZE;}catch{return DEFAULT_SIZE;}};
const DEFAULT_POSITION={x:16,y:130};
const readPosition=()=>{
 try {
   const stored=JSON.parse(window.localStorage.getItem(RADAR_POSITION_KEY)||"null");
   return Number.isFinite(stored?.x)&&Number.isFinite(stored?.y)?stored:DEFAULT_POSITION;
 } catch {return DEFAULT_POSITION;}
};
export default function BestSeasonRadar({playerId, color="#D62828"}){
 const position=useMemo(readPosition,[]);
 const size=useMemo(readSize,[]);
 const {data,isLoading,isError}=useHistoricalPeerDataset(Boolean(playerId));
 const result=useMemo(()=>{
   const obs=data?.observations||[];
   const own=obs.filter(o=>String(o.playerId)===String(playerId) && o.minutes>=450);
   const seasons=own.map(o=>({o,c:compareHistoricalObservation(o,obs,10)}))
      .filter(x=>Number.isFinite(x.c?.composite?.score) && x.c?.composite?.coverage>=40);
   seasons.sort((a,b)=>b.c.composite.score-a.c.composite.score||b.o.minutes-a.o.minutes||String(b.o.season).localeCompare(String(a.o.season)));
   if(!seasons.length)return null;
   const best=seasons[0], axes=best.o.role==="GK"?GK_AXES:best.o.role==="CB"?CB_AXES:AXES;
   return {season:best.o.season,role:best.o.role,composite:best.c.composite.score,
      axes:axes.map(([name,keys])=>({name,value:scoreAxis(keys,best.o,obs.filter(o=>o.role===best.o.role))}))};
 },[data,playerId]);
 const valid=result?.axes.filter(a=>a.value!==null).length||0;
 return <div className="pointer-events-none absolute z-10 flex flex-col overflow-hidden rounded-xl bg-white" style={{left:position.x,top:position.y,width:size.width,height:size.height,color:"#334155",zIndex:30}}>
   <div className="flex shrink-0 items-center justify-between gap-2 px-3 pt-3">
     <span className="truncate text-[11px] font-black tracking-wide">PLAYER PROFILE</span>
     <span className="shrink-0 text-[10px] font-semibold text-slate-500">{result?.season||""}</span>
   </div>
   {isLoading?<div className="grid flex-1 place-items-center text-[11px] text-slate-400">Cargando Stats…</div>:
   isError?<div className="grid flex-1 place-items-center px-3 text-center text-[11px] text-slate-500">No se pudo consultar Stats</div>:
   !result?<div className="grid flex-1 place-items-center px-3 text-center text-[11px] text-slate-500">Sin temporada con Composite suficiente</div>:
   <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
     <svg viewBox="0 0 250 245" className="min-h-0 w-full flex-1" role="img" aria-label={`Perfil estadístico de ${result.season}: ${valid} de ${result.axes.length} categorías`}>
       {valid===result.axes.length&&<polygon points={points(result.axes.map(a=>a.value))} fill={color} fillOpacity=".30" stroke="none"/>}
       {result.axes.map((a,i)=>{
         const [x,y]=pt(i,111,result.axes.length);
         const [vx,vy]=pt(i,87*(a.value||0)/100,result.axes.length);
         return <g key={a.name}>
           <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="9.8" fontWeight="600" fill={a.value===null?"#A1A1AA":"#64748b"}>{a.name}</text>
           {a.value!==null&&<circle cx={vx} cy={vy} r="3.6" fill={color} stroke="white" strokeWidth="1"/>}
         </g>;
       })}
     </svg>
     <div className="shrink-0 px-2 pb-2 text-center text-[10px] font-medium text-slate-500">{valid}/{result.axes.length} categorías · {result.role} · {result.composite.toFixed(1)} Composite</div>
   </div>}

 </div>;
}
