import React,{useMemo,useState} from "react";
import {CheckCircle2,BookOpen,Shield,ChevronDown,Info} from "lucide-react";
import {unifiedTrophyClubHistory} from "@/utils/trophyUnifiedHistory";

const positions=[["winner","Ganador"],["runner_up","Subcampeón"],["third","Tercer puesto"]];
function Years({records=[]}){
 if(!records.length)return <span className="text-[10px] text-slate-300">—</span>;
 return <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
  {records.map((r,i)=><span key={r.year+"-"+r.rank} title={(r.verified?"Adjudicación verificada"+(r.verifiedSeasons.length?" · Temporada "+r.verifiedSeasons.join(", "):""):"Pendiente de verificación externa")+" · Origen: "+r.sources.join(" + ")}
    className={"inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] tabular-nums "+(r.verified?"bg-emerald-50 font-semibold text-emerald-800":"bg-slate-100 text-slate-600")}>
   {r.year}{r.verified&&<CheckCircle2 size={10} aria-label="Verificado"/>}{i!==records.length-1?",":""}
  </span>)}
 </div>;
}
export default function TrophyUnifiedClubHistory({honours=[],palmares=[],editions=[],teams=[],loading=false,error=false,compact=false,onNavigate}){
 const model=useMemo(()=>unifiedTrophyClubHistory({honours,palmares,editions,teams}),[honours,palmares,editions,teams]);
 const [expanded,setExpanded]=useState(false);
 const [onlyVerified,setOnlyVerified]=useState(false);
 const visible=(compact&&!expanded?model.clubs.slice(0,5):model.clubs);
 if(loading)return <section className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500" role="status">Unificando el historial del trofeo…</section>;
 if(error)return <section role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">No se han podido cargar todas las fuentes del historial. Para evitar datos incompletos, vuelve a intentar esta vista.</section>;
 return <section aria-label="Palmarés unificado por equipos" className="space-y-3 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4">
  <div className="flex flex-wrap items-start justify-between gap-2">
   <div><h3 className="text-sm font-black text-slate-900">Palmarés por club</h3><p className="mt-1 text-[11px] text-slate-500">Historial unificado: títulos verificados y archivo FM24 / Rob, sin duplicados por año y puesto.</p></div>
   <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500">{model.clubs.length} clubes · {model.totals.winner} campeonatos</span>
  </div>
  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
   <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
    <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 size={12}/> Año contrastado</span>
    <span className="inline-flex items-center gap-1 text-slate-500"><BookOpen size={12}/> Año de archivo FM24 o Rob</span>
   </div>
   <label className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-600"><input type="checkbox" checked={onlyVerified} onChange={e=>setOnlyVerified(e.target.checked)} className="accent-[#003399]"/> Solo campeonatos verificados</label>
  </div>
  {model.clubs.length===0&&<div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
   <Shield size={20} className="mx-auto text-slate-300"/><p className="mt-2 text-xs font-semibold text-slate-600">Todavía no hay resultados vinculados a clubes.</p>
   <p className="mt-1 text-[10px] text-slate-400">Importa resultados de FM24 o adjudicaciones verificadas desde Sincronizar.</p>
  </div>}
  <div className="space-y-2.5">
   {visible.filter(c=>!onlyVerified||c.verifiedWins>0).map(c=><div key={c.team_id||c.name} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
    <div className="mb-2 flex flex-wrap items-center gap-2">
     <span className="grid h-9 w-9 place-items-center rounded-lg bg-white">{c.team?.logo?<img loading="lazy" src={c.team.logo} alt="" className="h-7 w-7 object-contain"/>:<Shield size={17} className="text-slate-300"/>}</span>
     <strong className="min-w-0 flex-1 text-[12px] font-black text-slate-800">{c.name}</strong>
     <span className="text-[11px] font-extrabold tabular-nums text-[#003399]">{c.winner.length} {c.winner.length===1?"título registrado":"títulos registrados"}</span>
     <span className="rounded-md bg-emerald-50 px-1.5 py-1 text-[10px] font-semibold text-emerald-700">{c.verifiedWins} verificados</span>
    </div>
    <div className="grid gap-2 sm:grid-cols-3">
     {positions.map(([key,label])=><div key={key} className="rounded-lg border border-slate-100 bg-white p-2.5">
      <div className="mb-2 flex items-center justify-between gap-2"><span className="text-[10px] font-bold text-slate-500">{label}</span><span className="text-[11px] font-black tabular-nums text-[#003399]">{onlyVerified?c[key].filter(r=>r.verified).length:c[key].length}</span></div>
      <Years records={onlyVerified?c[key].filter(r=>r.verified):c[key]}/>
     </div>)}
    </div>
   </div>)}
  </div>
  {compact&&!expanded&&model.clubs.length>5&&<button type="button" onClick={()=>setExpanded(true)} className="flex w-full items-center justify-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-bold text-[#003399]">Ver los {model.clubs.length} clubes <ChevronDown size={13}/></button>}
  <p className="flex items-start gap-1.5 text-[10px] leading-4 text-slate-500"><Info size={12} className="mt-0.5 shrink-0"/> El verde identifica la edición acreditada en TrophyHonour. Los demás años mantienen su fuente provisional; nunca se asignan títulos a Players ni se consideran verificaciones oficiales automáticamente.</p>
 </section>;
}
