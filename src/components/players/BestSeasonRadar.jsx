import React, {useMemo,useRef,useState} from "react";
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
const DEFAULT_POSITION={x:16,y:130};
const readPosition=()=>{
 try {
   const stored=JSON.parse(window.localStorage.getItem(RADAR_POSITION_KEY)||"null");
   return Number.isFinite(stored?.x)&&Number.isFinite(stored?.y)?stored:DEFAULT_POSITION;
 } catch {return DEFAULT_POSITION;}
};
export default function BestSeasonRadar({playerId, color="#D62828"}){
 const [position,setPosition]=useState(readPosition);
 const drag=useRef(null);
 const onPointerDown=e=>{
   if(e.button!==0 && e.pointerType==="mouse")return;
   e.preventDefault();
   drag.current={pointer:e.pointerId,startX:e.clientX,startY:e.clientY,x:position.x,y:position.y};
   e.currentTarget.setPointerCapture(e.pointerId);
 };
 const onPointerMove=e=>{
   if(!drag.current||drag.current.pointer!==e.pointerId)return;
   setPosition({x:drag.current.x+e.clientX-drag.current.startX,y:drag.current.y+e.clientY-drag.current.startY});
 };
 const onPointerEnd=e=>{
   if(!drag.current||drag.current.pointer!==e.pointerId)return;
   const next={x:drag.current.x+e.clientX-drag.current.startX,y:drag.current.y+e.clientY-drag.current.startY};
   drag.current=null;
   setPosition(next);
   try {window.localStorage.setItem(RADAR_POSITION_KEY,JSON.stringify(next));}catch{}
 };
 const resetPosition=()=>{
   setPosition(DEFAULT_POSITION);
   try{window.localStorage.removeItem(RADAR_POSITION_KEY);}catch{}
 };
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
 return <div className="pointer-events-auto absolute z-10 flex flex-col overflow-hidden rounded-xl bg-white" style={{left:position.x,top:position.y,width:240,height:296,color:"#334155",zIndex:30}}>
   <div onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd} className="flex shrink-0 cursor-grab select-none items-center justify-between gap-2 rounded-t-xl bg-slate-50 px-3 py-2 active:cursor-grabbing" style={{touchAction:"none"}} title="Arrastra para mover el radar">
     <span className="truncate text-[11px] font-black tracking-wide">PLAYER PROFILE</span>
     <div className="flex items-center gap-2"><span className="shrink-0 text-[10px] font-semibold text-slate-500">{result?.season||""}</span><button type="button" onPointerDown={e=>e.stopPropagation()} onClick={resetPosition} className="cursor-pointer rounded px-1 text-[10px] text-slate-500 hover:bg-slate-200" title="Restablecer posición">↺</button></div>
   </div>
   {isLoading?<div className="grid flex-1 place-items-center text-[11px] text-slate-400">Cargando Stats…</div>:
   isError?<div className="grid flex-1 place-items-center px-3 text-center text-[11px] text-slate-500">No se pudo consultar Stats</div>:
   !result?<div className="grid flex-1 place-items-center px-3 text-center text-[11px] text-slate-500">Sin temporada con Composite suficiente</div>:
   <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
     <svg viewBox="0 0 250 245" className="min-h-0 w-full flex-1" role="img" aria-label={`Perfil estadístico de ${result.season}: ${valid} de ${result.axes.length} categorías`}>
       {[.25,.5,.75,1].map(level=><polygon key={level} points={points(result.axes.map(()=>100*level))} fill="none" stroke="#94a3b8" strokeOpacity=".25"/>)}
       {result.axes.map((a,i)=>{const [x,y]=pt(i,87,result.axes.length);return <line key={a.name} x1="125" y1="128" x2={x} y2={y} stroke="#94a3b8" strokeOpacity=".25"/>;})}
       {valid===result.axes.length&&<polygon points={points(result.axes.map(a=>a.value))} fill={color} fillOpacity=".30" stroke={color} strokeWidth="2.5" strokeLinejoin="round"/>}
       {result.axes.map((a,i)=>{
         const b=result.axes[(i+1)%result.axes.length];
         if(a.value===null||b.value===null)return null;
         const [x1,y1]=pt(i,87*a.value/100,result.axes.length);
         const [x2,y2]=pt((i+1)%result.axes.length,87*b.value/100,result.axes.length);
         return <line key={"edge"+i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="2.5" strokeLinecap="round"/>;
       })}
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
