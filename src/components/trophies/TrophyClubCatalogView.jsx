import React,{useMemo,useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {AlertCircle,BookOpen,ChevronDown,Info,Medal,Search,Shield,SlidersHorizontal,Trophy} from "lucide-react";
import {base44} from "@/api/base44Client";
import {completeRecordQueryOptions} from "@/utils/entityRecords";
import {groupTrophiesByTeamReputation} from "@/utils/trophyTeamGroups";

const rows=r=>Array.isArray(r)?r:(r?.items||r?.data||[]);
const choices=[["all","Todos"],["verified","Verificados"],["historical","Archivo Rob"]];
const showName=count=>count===1?"trofeo":"trofeos";

export default function TrophyClubCatalogView({teams=[],catalog=[],honours=[],manifest,onOpen,Card,allowedIds=null,loading=false,error=false,query=""}){
 const [sourceMode,setSourceMode]=useState("all");
 const [onlyWithTrophies,setOnlyWithTrophies]=useState(false);
 const [collapsed,setCollapsed]=useState([]);
 const editionQuery=useQuery({
  ...completeRecordQueryOptions(base44.entities.TrophyEdition,["mf-legacy","trophies","all-historical-club-editions"]),
  enabled:teams.length>0,retry:false
 });
 const editions=useMemo(()=>rows(editionQuery.data),[editionQuery.data]);
 const groups=useMemo(()=>groupTrophiesByTeamReputation({teams,catalog,honours,editions,allowedIds,query,sourceMode}),
  [teams,catalog,honours,editions,allowedIds,query,sourceMode]);
 const shown=useMemo(()=>onlyWithTrophies?groups.filter(group=>group.items.length>0):groups,[groups,onlyWithTrophies]);
 const selectedCount=shown.reduce((total,group)=>total+group.items.length,0);
 const toggle=id=>setCollapsed(old=>old.includes(id)?old.filter(x=>x!==id):[...old,id]);
 const isPending=loading||editionQuery.isLoading;
 return <section className="w-full space-y-5 pb-6">
  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 sm:px-4">
   <div className="min-w-0">
    <h2 className="flex items-center gap-2 text-sm font-black text-slate-900"><Shield size={16}/> Trofeos agrupados por equipos</h2>
    <p className="mt-1 text-[11px] text-slate-500">Todos los clubes de Teams, ordenados por reputación de mayor a menor, como en Players.</p>
   </div>
   <div className="flex flex-wrap items-center gap-2">
    <div role="group" aria-label="Origen de los títulos" className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1">
     {choices.map(([id,title])=><button type="button" key={id} aria-pressed={sourceMode===id} onClick={()=>setSourceMode(id)} className={"rounded-md px-2.5 py-1.5 text-[10px] font-bold "+(sourceMode===id?"bg-white text-[#003399] shadow-sm":"text-slate-500")}>{title}</button>)}
    </div>
    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-2 text-[10px] font-semibold text-slate-600">
     <input type="checkbox" checked={onlyWithTrophies} onChange={e=>setOnlyWithTrophies(e.target.checked)} className="accent-[#003399]"/> Solo con trofeos
    </label>
   </div>
  </div>
  <div className="flex flex-wrap items-center justify-between gap-2 px-1">
   <p className="text-[11px] text-slate-500">{shown.length} clubes · {selectedCount} trofeos vinculados en la vista</p>
   <span className="text-[10px] font-semibold text-slate-400">Orden: reputación de Team (0–10.000) <SlidersHorizontal size={12} className="ml-1 inline"/></span>
  </div>
  {isPending&&<p role="status" className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">Cargando clubes y finales históricas…</p>}
  {error&&<p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">No se pudieron cargar todos los equipos; el catálogo podría estar incompleto.</p>}
  {editionQuery.isError&&<p role="alert" className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800"><AlertCircle size={14}/> No se ha podido cargar el archivo de Rob. Los títulos verificados siguen visibles.</p>}
  {!isPending&&shown.length===0&&<div className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center"><Search size={22} className="mx-auto text-slate-300"/><p className="mt-2 text-xs font-semibold text-slate-600">No hay equipos con estos filtros.</p></div>}
  <div className="space-y-6">
   {shown.map(group=>{
    const isClosed=collapsed.includes(group.id);
    return <section key={group.id} className="min-w-0" aria-label={"Trofeos de "+group.team.name}>
     <div className="mb-3 flex min-w-0 items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
      <button type="button" onClick={()=>toggle(group.id)} aria-expanded={!isClosed} aria-label={(isClosed?"Expandir ":"Contraer ")+group.team.name} className="flex min-w-0 items-center gap-3 text-left">
       <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-1">
        {group.team.logo?<img src={group.team.logo} alt="" loading="lazy" className="h-full w-full object-contain"/>:<Shield size={20} className="text-slate-300"/>}
       </span>
       <span className="min-w-0"><strong className="block truncate text-sm font-extrabold text-slate-900">{group.team.name}</strong><span className="mt-0.5 block text-[10px] text-slate-400">Reputación: {group.reputation.toLocaleString("es-ES")}</span></span>
       <ChevronDown size={15} className={"shrink-0 text-slate-400 transition "+(isClosed?"-rotate-90":"")}/>
      </button>
      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[.08em] text-slate-400">{group.items.length} {showName(group.items.length)}</span>
     </div>
     {!isClosed&&(group.items.length>0?
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-7">
       {group.items.map(item=><div key={item.trophy.source_id} className="min-w-0 space-y-1.5">
        <Card trophy={item.trophy} manifest={manifest} open={()=>onOpen(item.trophy)} count={item.verifiedCount}/>
        <div className="flex flex-wrap items-center gap-1">
         {item.verifiedCount>0&&<span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-1 text-[9px] font-bold text-emerald-700"><Medal size={10}/>{item.verifiedCount} verificados</span>}
         {item.historicalCount>0&&<span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-1 text-[9px] font-bold text-amber-700"><BookOpen size={10}/>{item.historicalCount} Rob · provisional</span>}
        </div>
       </div>)}
      </div>:
      <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-white/60 px-4 py-3 text-[11px] text-slate-400"><Trophy size={14}/> Sin trofeos vinculados en MF LEGACY para este filtro.</div>
     )}
    </section>;
   })}
  </div>
  <p className="flex items-start gap-1.5 text-[11px] leading-5 text-slate-500"><Info size={13} className="mt-0.5 shrink-0"/> Los títulos verificados proceden de TrophyHonour. Las finales de Rob solo aparecen cuando tienen un Team.id del campeón correctamente vinculado; no se consideran títulos acreditados. Los clubes sin vínculos siguen visibles.</p>
 </section>;
}
