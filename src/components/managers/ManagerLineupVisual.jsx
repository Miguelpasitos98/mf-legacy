import React,{useState} from "react";
import {Link} from "react-router-dom";
import {ArrowUpRight,ChevronDown,ChevronUp,Info,Layers,ShieldCheck,Users} from "lucide-react";
import PlayerPortrait from "@/components/teams/PlayerPortrait";
import {ROLE_LABELS} from "@/components/managers/managerFit.mjs";
import {isExternalCandidate} from "@/components/managers/managerCandidatePool.mjs";

const hasNumber=value=>typeof value==="number"&&Number.isFinite(value);
const confidenceLabel=value=>value==="medium"?"Confianza media":value==="low"?"Confianza baja":"Sin evidencia suficiente";
const detailUrl=(plan,role,season)=>"/manager-fit?"+new URLSearchParams({
 ...(plan.manager?{manager:String(plan.manager.id)}:{}),
 ...(plan.profile?{profile:String(plan.profile.id)}:{}),role,season
});
function Progress({value,label="Cobertura de atributos FM26"}){
 const valid=hasNumber(value);
 return <div className="space-y-1" aria-label={label+": "+(valid?value+"%":"sin datos")}>
  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
   <div className="h-full rounded-full bg-[#3767b8] transition-[width]" style={{width:(valid?Math.max(0,Math.min(100,value)):0)+"%"}}/>
  </div>
 </div>;
}
function PitchPlayer({slot}){
 const current=slot.primary;
 const fit=current?.estimatedFit;
 const external=current&&isExternalCandidate(current);
 const photo=current?.player;
 return <article className="relative flex w-[min(100%,160px)] min-w-0 flex-col items-center justify-center rounded-xl border border-white/60 bg-white/95 px-1.5 py-2 text-center shadow-[0_5px_18px_rgba(5,35,45,.1)] sm:px-2"
  aria-label={ROLE_LABELS[slot.role]+": "+(photo?.name||"Vacante")}>
  <div className="relative mb-1">
   {photo?<PlayerPortrait player={photo} fallback={String(photo.name||"?").charAt(0)} className="h-9 w-9 rounded-full object-cover ring-2 ring-slate-100 sm:h-11 sm:w-11"/>:
   <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-dashed border-slate-300 text-sm text-slate-400">?</div>}
  </div>
  <span className="block max-w-full truncate text-[9px] font-semibold uppercase tracking-wide text-slate-500">{ROLE_LABELS[slot.role]}</span>
  <strong className="block max-w-full truncate text-[11px] leading-5 text-slate-900 sm:text-xs" title={photo?.name||"Vacante"}>{photo?.name||"Vacante"}</strong>
  <div className="mt-1 flex max-w-full flex-wrap items-center justify-center gap-1">
   <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-[#154185]">{hasNumber(fit)?fit+"/100 FM26":"Sin nota FM26"}</span>
   {external&&<span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-800">Externo</span>}
  </div>
 </article>;
}
export function ManagerLineupVisual({draft,plan,season,activeScenario,includeCandidates,externalCount}){
 const [showDetail,setShowDetail]=useState(false);
 const slots=draft?.assignments||[];
 const lines=[...new Set(slots.map(slot=>slot.line))].sort((a,b)=>b-a);
 const externalPlayers=slots.filter(slot=>slot.primary&&isExternalCandidate(slot.primary)).length;
 const measured=slots.filter(slot=>hasNumber(slot.primary?.estimatedFit)).length;
 return <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 md:p-5" aria-label="Once orientativo visual">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div>
    <p className="text-[10px] font-extrabold uppercase tracking-[.13em] text-[#315fa7]">Manager Fit · Alineación hipotética</p>
    <h3 className="mt-1 text-base font-black text-slate-900">Once orientativo <span className="text-slate-400">· Escenario {activeScenario} · {draft.formation||"Sin formación"}</span></h3>
   </div>
   <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-600">Simulación, no fichajes</span>
  </div>
  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
   {[
    {label:"Once cubierto",value:(draft.filled??0)+"/11",sub:(draft.vacancies??0)+" vacantes"},
    {label:"FM26 con nota",value:measured+"/11",sub:"estimación disponible"},
    {label:"Externos en el once",value:String(externalPlayers),sub:includeCandidates?externalCount+" en bolsa":"bolsa desactivada"},
    {label:"ADN aplicado",value:plan.profile?"Sí":"No",sub:plan.profile?"Orientativo FM26":"Selecciona un perfil"}
   ].map(item=><div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3">
    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{item.label}</p>
    <p className="mt-1 text-2xl font-black tabular-nums tracking-tight text-slate-900">{item.value}</p>
    <p className="text-[10px] text-slate-500">{item.sub}</p>
   </div>)}
  </div>
  <div className="rounded-2xl border border-emerald-200 bg-[#e7f2eb] p-3 sm:p-4">
   <div className="relative overflow-hidden rounded-xl border border-white/60 bg-[linear-gradient(180deg,#e6f3ed_0%,#dbece3_100%)] px-2 py-4 sm:px-4">
    <div aria-hidden="true" className="pointer-events-none absolute inset-3 rounded-md border border-emerald-600/20"/>
    <div aria-hidden="true" className="pointer-events-none absolute left-3 right-3 top-1/2 border-t border-emerald-600/20"/>
    <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-600/20"/>
    <div className="relative z-10 flex flex-col gap-3 sm:gap-4">
     {lines.map(line=><div key={line} className="flex w-full justify-around gap-1 sm:gap-2">
      {slots.filter(slot=>slot.line===line).map(slot=><PitchPlayer key={slot.id} slot={slot}/>)}
     </div>)}
    </div>
   </div>
  </div>
  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
   <p className="flex items-start gap-1.5"><Info size={14} className="mt-0.5 shrink-0 text-blue-700"/>Las cifras del campo son estimaciones de encaje FM26 + ADN; <strong>no son puntuaciones V4 históricas</strong>.</p>
   <button type="button" onClick={()=>setShowDetail(x=>!x)} aria-expanded={showDetail} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 font-bold text-[#003399] hover:bg-slate-50">
    {showDetail?"Ocultar detalle por puesto":"Ver roles y alternativas"} {showDetail?<ChevronUp size={15}/>:<ChevronDown size={15}/>}
   </button>
  </div>
  {showDetail&&<div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3" aria-label="Detalle técnico de los puestos">
   {slots.map(slot=>{
    const role=slot.advanced?.recommendation;
    return <article key={slot.id} className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5">
     <div className="flex items-start justify-between gap-3">
      <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{ROLE_LABELS[slot.role]}</p>
       <h4 className="mt-1 truncate text-sm font-extrabold text-slate-900">{slot.primary?.player.name||"Vacante"}</h4></div>
      <div className="shrink-0 text-right"><span className="block text-lg font-black tabular-nums text-[#194a93]">{hasNumber(role?.score)?role.score:"—"}</span>
       <span className="text-[9px] text-slate-500">Función FM26 /100</span></div>
     </div>
     <p className="mt-2 text-xs font-semibold text-slate-700">{role?.name||"Sin función evaluable"}</p>
     <p className="mt-1 text-[11px] text-slate-500">{confidenceLabel(role?.confidence)} · {role?.coverage??0}% de atributos de la función</p>
     <div className="mt-2"><Progress value={role?.coverage}/></div>
     <p className="mt-3 text-[11px] text-slate-600"><strong>Alternativas:</strong> {slot.alternatives?.map(alt=>alt.player.name).join(", ")||"No hay alternativas registradas"}</p>
     <Link className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold text-[#003399] hover:underline" to={detailUrl(plan,slot.role,season)}>Buscar refuerzos <ArrowUpRight size={13}/></Link>
     <details className="mt-3 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
      <summary className="cursor-pointer font-semibold text-slate-600">Por qué se propone esta función</summary>
      <p className="mt-2">{slot.advanced?.preferred?.length?"Preferencias reconocidas: "+slot.advanced.preferred.join(", "):"No hay preferencias explícitas reconocidas: se comparan funciones genéricas del puesto."} Son atributos del videojuego, no rendimiento observado.</p>
     </details>
    </article>;
   })}
  </div>}
 </section>;
}
