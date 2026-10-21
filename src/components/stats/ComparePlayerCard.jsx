import React,{useState} from "react";
import {ArrowRight,Shield} from "lucide-react";
import {displaySeasonPosition} from "@/utils/statsCompositeRanking";
import {seasonActive} from "@/utils/statsViews";
import {statDisplay} from "@/utils/statsSeason";
import {compareFormat,shortSeason} from "@/utils/compareMetrics";

const POSITION_TITLES={
 competition:"Posición manual por competición",
 season:"Posición histórica manual",
 fifa:"Posición de la carta FIFA/FC",
 fallback:"Posición actual, solo respaldo provisional"
};

export default function ComparePlayerCard({summary,player,composite,onOpen,onTeam}){
 const [broken,setBroken]=useState(false);
 const name=player?.name||summary?.player_name||"Jugador";
 const photo=player?.card_photo_url||player?.cardPhotoUrl||player?.photo_url||player?.photoUrl||"";
 const club=summary?.mainClub;
 const score=composite?.score??null;
 return <article className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
  <div className="flex items-start gap-3">
   <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#e9f0f9] font-black text-[#31557b]">
    {photo&&!broken?<img src={photo} alt="" className="h-full w-full object-cover" loading="lazy" onError={()=>setBroken(true)}/>:String(name).slice(0,2).toUpperCase()}
   </div>
   <div className="min-w-0 flex-1">
    <p className="truncate text-sm font-black text-[#0f3156]" title={name}>{name}</p>
    <p className="text-[11px] font-semibold text-slate-500">{shortSeason(summary?.season)}{seasonActive(summary?.season)&&<span className="ml-1 font-normal text-blue-700">(en curso)</span>}</p>
    {club?<button type="button" onClick={()=>onTeam(club.id)} className="mt-1 inline-flex max-w-full items-center gap-1.5 text-[11px] font-semibold text-slate-700 hover:text-[#003399] hover:underline"><Shield size={12} className="shrink-0 text-slate-400"/><span className="truncate">{club.name}</span></button>:<p className="mt-1 text-[11px] text-amber-700">Sin club confirmado</p>}
    {(summary?.otherClubs?.length>0||summary?.unresolvedTeams>0)&&<p className="text-[10px] text-amber-700">{summary.otherClubs.length>0?"+"+summary.otherClubs.length+" club(es)":""} {summary.unresolvedTeams>0?"· "+summary.unresolvedTeams+" competiciones sin club confirmado":""}</p>}
   </div>
  </div>
  <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-2 text-center">
   {[["PJ",statDisplay(summary,"appearances"),0],["Min",statDisplay(summary,"minutes"),0],["Nota",statDisplay(summary,"rating"),2]].map(([label,value,decimals])=><div key={label}>
    <p className="text-[10px] font-bold uppercase text-slate-500">{label}</p>
    <p className="text-sm font-black tabular-nums text-slate-800">{compareFormat(value,decimals)}</p>
   </div>)}
  </div>
  <div className="flex items-center justify-between gap-2 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2">
   <div className="min-w-0">
    <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-700">Composite MF LEGACY</p>
    <p className="text-xl font-black tabular-nums text-[#003399]">{score===null?"—":compareFormat(score,1)}{score!==null&&<span className="text-[10px] font-normal text-slate-500"> /100</span>}</p>
    <p className="truncate text-[10px] text-slate-500" title="Arquetipo y cobertura usados en la comparación">{composite?.role||"Sin arquetipo"}{composite?.coverage!=null?" · cobertura "+compareFormat(composite.coverage,1)+" %":""}</p>
   </div>
   <div className="shrink-0 text-right">
    <p className="text-[10px] font-bold uppercase text-slate-500">Posición</p>
    <p className="text-base font-black text-slate-700" title={POSITION_TITLES[composite?.source]||"Posición histórica no disponible"}>{displaySeasonPosition(composite?.position)}{composite?.source==="fallback"&&<span className="text-amber-600">*</span>}</p>
   </div>
  </div>
  <button type="button" onClick={()=>onOpen(summary,player)} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-[#003399] hover:bg-blue-50">Desglose completo <ArrowRight size={13}/></button>
 </article>;
}