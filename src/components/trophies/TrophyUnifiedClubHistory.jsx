import React,{useMemo,useState} from "react";
import {CheckCircle2,BookOpen,Shield,ChevronDown,ChevronUp,Info,Medal,Search,CalendarDays} from "lucide-react";
import {unifiedTrophyClubHistory} from "@/utils/trophyUnifiedHistory";

const meta={
 winner:{title:"Campeonatos",short:"Campeón",accent:"text-[#003399]",bg:"bg-blue-50",icon:Medal},
 runner_up:{title:"Subcampeonatos",short:"Subcampeón",accent:"text-slate-700",bg:"bg-slate-100",icon:Medal},
 third:{title:"Terceros puestos",short:"Tercer puesto",accent:"text-slate-600",bg:"bg-slate-100",icon:Medal}
};
const filters=[["all","Todos"],["verified","Contrastados"],["archive","Datos de archivo"]];
function YearBadge({record}){
 const tooltip=(record.verified?"Título contrastado"+(record.verifiedSeasons.length?" · "+record.verifiedSeasons.join(", "):""):"Resultado registrado en MF LEGACY a partir de su fuente histórica")+
  " · "+record.sources.map(s=>s==="official"?"MF LEGACY":s==="fm24"?"FM24":s==="rob_final"?"Rob":"Archivo").join(" + ");
 return <span title={tooltip} className={"inline-flex min-w-[42px] items-center justify-center gap-1 rounded-md border px-1.5 py-1 text-[10px] font-semibold tabular-nums transition "+
  (record.verified?"border-emerald-200 bg-emerald-50 text-emerald-800":"border-slate-200 bg-white text-slate-600")}>
  {record.year}{record.verified&&<CheckCircle2 size={11}/>}
 </span>;
}
function PositionPanel({type,records,showAll,limit=14}){
 const details=meta[type],Icon=details.icon;
 const shown=showAll?records:records.slice(0,limit);
 return <div className="min-w-0 rounded-xl border border-slate-200/90 bg-white p-3">
  <div className="mb-2.5 flex items-center gap-2">
   <span className={"grid h-7 w-7 place-items-center rounded-lg "+details.bg+" "+details.accent}><Icon size={15} strokeWidth={1.8}/></span>
   <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-slate-700">{details.title}</span>
   <strong className={"text-lg font-black tabular-nums "+details.accent}>{records.length}</strong>
  </div>
  {shown.length?<div className="flex flex-wrap gap-1.5">{shown.map(row=><YearBadge key={type+"-"+row.year} record={row}/>)}</div>:
   <p className="rounded-lg bg-slate-50 px-2 py-3 text-center text-[11px] text-slate-400">Sin registros</p>}
  {!showAll&&records.length>limit&&<p className="mt-2 text-[10px] font-medium text-slate-400">+{records.length-limit} años más</p>}
 </div>;
}
export default function TrophyUnifiedClubHistory({honours=[],palmares=[],editions=[],teams=[],loading=false,error=false,compact=false}){
 const model=useMemo(()=>unifiedTrophyClubHistory({honours,palmares,editions,teams}),[honours,palmares,editions,teams]);
 const [sourceFilter,setSourceFilter]=useState("all");
 const [openGroups,setOpenGroups]=useState({});
 const [expandedAll,setExpandedAll]=useState(false);
 const [showFullYears,setShowFullYears]=useState(!compact);
 const [search,setSearch]=useState("");
 const groups=useMemo(()=>{
  const needle=search.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
  return model.clubs.map(club=>{
   const visibleRecords=club.records.filter(r=>sourceFilter==="all"||sourceFilter==="verified"&&r.verified||sourceFilter==="archive"&&!r.verified);
   const byRank=key=>visibleRecords.filter(r=>r.rank===key);
   return {...club,visibleRecords,displayWinner:byRank("winner"),displayRunner:byRank("runner_up"),displayThird:byRank("third")};
  }).filter(c=>(sourceFilter!=="verified"||c.visibleRecords.length>0)&&(!needle||c.name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().includes(needle)));
 },[model.clubs,sourceFilter,search]);
 const visible=compact&&!expandedAll?groups.slice(0,5):groups;
 if(loading)return <section role="status" className="rounded-2xl border border-slate-200 bg-white p-5 text-xs text-slate-500">Uniendo y ordenando resultados históricos…</section>;
 if(error)return <section role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-xs text-amber-800">No se pudieron cargar todas las fuentes. Se ha evitado mostrar un palmarés incompleto.</section>;
 return <section aria-label="Palmarés unificado por equipos" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
  <header className="border-b border-slate-100 px-4 py-4 sm:px-5">
   <div className="flex flex-wrap items-start justify-between gap-3">
    <div>
     <div className="mb-1 flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#003399] text-white"><Medal size={18}/></span><h3 className="text-base font-black tracking-tight text-slate-900">Palmarés de clubes</h3></div>
     <p className="text-[11px] text-slate-500">Todos los resultados vinculados, agrupados por equipo y año, sin duplicados.</p>
    </div>
    <div className="flex flex-wrap gap-2 text-center">
     <div className="min-w-[72px] rounded-xl bg-blue-50 px-3 py-2"><strong className="block text-lg font-black tabular-nums text-[#003399]">{model.totals.winner}</strong><span className="text-[9px] font-semibold text-blue-700">Campeonatos</span></div>
     <div className="min-w-[72px] rounded-xl bg-emerald-50 px-3 py-2"><strong className="block text-lg font-black tabular-nums text-emerald-700">{model.totals.verified}</strong><span className="text-[9px] font-semibold text-emerald-700">Contrastados</span></div>
     <div className="min-w-[66px] rounded-xl bg-slate-100 px-3 py-2"><strong className="block text-lg font-black tabular-nums text-slate-700">{model.clubs.length}</strong><span className="text-[9px] font-semibold text-slate-500">Clubes</span></div>
    </div>
   </div>
   <div className="mt-3 flex flex-wrap items-center gap-2">
    <div role="group" aria-label="Filtrar resultados por procedencia" className="flex shrink-0 items-center gap-0.5 rounded-lg bg-slate-100 p-1">
     {filters.map(([value,label])=><button key={value} type="button" aria-pressed={sourceFilter===value} onClick={()=>{setSourceFilter(value);setExpandedAll(false);}} className={"rounded-md px-2.5 py-1.5 text-[10px] font-bold transition "+(sourceFilter===value?"bg-white text-[#003399] shadow-sm":"text-slate-500 hover:text-slate-800")}>{label}</button>)}
    </div>
    {model.clubs.length>5&&<label className="relative min-w-[145px] flex-1"><Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar club…" aria-label="Buscar club en palmarés" className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-2 text-[11px] outline-none focus:border-blue-300"/></label>}
    <button type="button" onClick={()=>setShowFullYears(v=>!v)} aria-pressed={showFullYears} className="ml-auto inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[10px] font-bold text-slate-600 hover:bg-slate-50"><CalendarDays size={13}/>{showFullYears?"Años resumidos":"Todos los años"}</button>
   </div>
  </header>
  <div className="flex flex-wrap items-center gap-3 bg-[#F8FAFD] px-4 py-2.5 text-[10px] text-slate-500 sm:px-5">
   <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={13} className="text-emerald-700"/> Verde: fuente contrastada</span>
   <span className="inline-flex items-center gap-1.5"><BookOpen size={13} className="text-slate-500"/> Gris: fuente FM24 / Rob</span>
   <span className="ml-auto text-[10px] font-medium">{groups.length} {groups.length===1?"club":"clubes"} en vista</span>
  </div>
  <div className="space-y-3 p-3 sm:p-4">
   {!groups.length&&<div className="rounded-xl border border-dashed border-slate-200 p-8 text-center"><Shield size={25} className="mx-auto text-slate-300"/><p className="mt-2 text-xs font-semibold text-slate-600">No hay resultados para este filtro.</p></div>}
   {visible.map((c,index)=>{
    const collapsed=Boolean(openGroups[c.team_id||c.name]);
    const ranks=[["winner",c.displayWinner],["runner_up",c.displayRunner],["third",c.displayThird]];
    return <article key={c.team_id||c.name} className="overflow-hidden rounded-xl border border-slate-200 bg-[#FAFBFD]">
     <button type="button" onClick={()=>setOpenGroups(current=>({...current,[c.team_id||c.name]:!collapsed}))} aria-expanded={!collapsed} className="flex w-full min-w-0 flex-wrap items-center gap-3 px-3 py-3 text-left transition hover:bg-blue-50/40 sm:px-4">
      <span className="w-5 shrink-0 text-center text-xs font-black text-slate-300">{index+1}</span>
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white p-1.5">{c.team?.logo?<img src={c.team.logo} alt="" loading="lazy" className="h-full w-full object-contain"/>:<Shield size={22} className="text-slate-300"/>}</span>
      <span className="min-w-[110px] flex-1"><strong className="block truncate text-sm font-black text-slate-900">{c.name}</strong><span className="mt-0.5 block text-[10px] text-slate-500">{c.winner.length} títulos registrados · {c.verifiedWins} contrastados</span></span>
      <span className="flex flex-wrap items-center gap-1.5">
       <span className="rounded-lg bg-blue-50 px-2.5 py-1.5 text-center"><strong className="block text-base font-black tabular-nums text-[#003399]">{c.displayWinner.length}</strong><span className="text-[9px] text-slate-500">Campeón</span></span>
       <span className="rounded-lg bg-white px-2.5 py-1.5 text-center"><strong className="block text-base font-black tabular-nums text-slate-700">{c.displayRunner.length}</strong><span className="text-[9px] text-slate-500">Subcampeón</span></span>
       <span className="rounded-lg bg-white px-2.5 py-1.5 text-center"><strong className="block text-base font-black tabular-nums text-slate-700">{c.displayThird.length}</strong><span className="text-[9px] text-slate-500">Tercero</span></span>
      </span>
      {collapsed?<ChevronDown size={16} className="shrink-0 text-slate-400"/>:<ChevronUp size={16} className="shrink-0 text-slate-400"/>}
     </button>
     {!collapsed&&<div className="grid gap-2 border-t border-slate-200/80 p-3 md:grid-cols-3 sm:p-3.5">
      {ranks.map(([rank,records])=><PositionPanel key={rank} type={rank} records={records} showAll={showFullYears} limit={compact?12:20}/>)}
     </div>}
    </article>;
   })}
  </div>
  {compact&&groups.length>visible.length&&<div className="border-t border-slate-100 px-4 py-3"><button type="button" onClick={()=>setExpandedAll(true)} className="flex w-full items-center justify-center gap-1 rounded-lg bg-slate-50 px-3 py-2.5 text-[11px] font-bold text-[#003399] hover:bg-blue-50">Ver todos los {groups.length} clubes <ChevronDown size={14}/></button></div>}
  <footer className="flex gap-2 border-t border-slate-100 bg-[#FAFBFD] px-4 py-3 text-[10px] leading-4 text-slate-500"><Info size={13} className="mt-0.5 shrink-0"/> El historial conserva la procedencia original de cada edición. Una vinculación aceptada no equivale a una comprobación federativa independiente. Pasa el cursor sobre cada año para consultar la fuente.</footer>
 </section>;
}
