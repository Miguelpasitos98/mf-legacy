import React, {useMemo} from "react";
import {useHistoricalPeerDataset} from "@/hooks/useHistoricalPeerDataset";
import {compareHistoricalObservation} from "@/utils/historicalPeers";

// The radar and the season ranking share the Stats historical peer dataset.
// All values are genuine within-role peer percentiles; missing axes are not fabricated.
const AXES=[
 ["Attacking",["npxg_p90","shots_on_target_p90","xgot_p90"]],
 ["Creativity",["xa_p90","big_chances_created_p90"]],
 ["Passing",["accurate_passes_p90","accurate_long_balls_p90","xg_buildup_p90"]],
 ["Dribbling",["successful_dribbles_p90","dispossessed_p90"]],
 ["Defending",["def_actions_poss_adj_p90","possession_won_final_3rd_p90"]],
 ["Physical",["ground_duels_won_pct","play_share"]],
 ["Aerial",["aerial_duels_won_pct"]],
 ["Finishing",["finishing_xgot_minus_npxg"]],
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
const scoreAxis=(keys,rows)=>{
 const found=keys.map(k=>rows.find(r=>r.key===k)).filter(r=>r?.percentile!=null && r?.status==="ready" && !r?.estimated);
 if(!found.length)return null;
 return Math.round(found.reduce((sum,r)=>sum+(r.penalty?100-r.percentile:r.percentile),0)/found.length);
};
export default function BestSeasonRadar({playerId, color="#D62828"}){
 const {data,isLoading,isError}=useHistoricalPeerDataset(Boolean(playerId));
 const result=useMemo(()=>{
   const obs=data?.observations||[];
   const own=obs.filter(o=>String(o.playerId)===String(playerId) && o.minutes>=450);
   const seasons=own.map(o=>({o,c:compareHistoricalObservation(o,obs,10)}))
      .filter(x=>Number.isFinite(x.c?.composite?.score) && x.c?.composite?.coverage>=40);
   seasons.sort((a,b)=>b.c.composite.score-a.c.composite.score||b.o.minutes-a.o.minutes||String(b.o.season).localeCompare(String(a.o.season)));
   if(!seasons.length)return null;
   const best=seasons[0], axes=best.o.role==="GK"?GK_AXES:AXES;
   return {season:best.o.season,role:best.o.role,composite:best.c.composite.score,
      axes:axes.map(([name,keys])=>({name,value:scoreAxis(keys,best.c.rows||[])}))};
 },[data,playerId]);
 return <div className="pointer-events-auto absolute z-10 overflow-hidden rounded-xl" style={{left:"2.5%",top:"34%",width:"34.5%",height:"48%",color:"#334155"}}>
   <div className="flex items-center justify-between gap-1 px-2 pt-2">
     <span className="truncate text-[10px] font-black tracking-wide">PLAYER PROFILE</span>
     <span className="shrink-0 text-[9px] font-semibold text-slate-500">{result?.season||""}</span>
   </div>
   {isLoading?<div className="grid h-4/5 place-items-center text-[10px] text-slate-400">Cargando Stats…</div>:
   isError?<div className="grid h-4/5 place-items-center px-3 text-center text-[10px] text-slate-500">No se pudo consultar Stats</div>:
   !result?<div className="grid h-4/5 place-items-center px-3 text-center text-[10px] text-slate-500">Sin temporada con Composite y cobertura suficientes</div>:
   <svg viewBox="0 0 250 255" className="h-[90%] w-full" role="img" aria-label={`Perfil estadístico de ${result.season}; ${result.axes.filter(a=>a.value!=null).length} categorías con datos`}>
      {[.25,.5,.75,1].map(level=><polygon key={level} points={points(result.axes.map(()=>100*level))} fill="none" stroke="#94a3b8" strokeOpacity=".2"/>)}
      {result.axes.map((a,i)=>{const [x,y]=pt(i,87,result.axes.length);return <line key={a.name} x1="125" y1="128" x2={x} y2={y} stroke="#94a3b8" strokeOpacity=".22"/>;})}
      {result.axes.every(a=>a.value!=null)&&<polygon points={points(result.axes.map(a=>a.value))} fill={color} fillOpacity=".32" stroke={color} strokeWidth="2" strokeLinejoin="round"/>}
      {result.axes.map((a,i)=>{const [x,y]=pt(i,111,result.axes.length);return <text key={a.name} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="8.4" fill={a.value==null?"#94a3b8":"#64748b"}>{a.name}{a.value==null?" –":""}</text>;})}
      {result.axes.some(a=>a.value==null)&&<text x="125" y="244" textAnchor="middle" fontSize="8" fill="#64748b">Radar incompleto · datos insuficientes</text>}
   </svg>}
 </div>;
}
