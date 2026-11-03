import React,{useMemo,useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {BookOpen,ChevronDown,Shield,Search,Trophy,AlertTriangle,CheckCircle2} from "lucide-react";
import {base44} from "@/api/base44Client";
import {completeRecordQueryOptions} from "@/utils/entityRecords";
import {fm24PalmaresOverview} from "@/utils/trophyFm24Overview";
import {trophyImageUrl} from "@/utils/trophyCatalog";

const select="h-9 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700";
const yearText=years=>years.length?years.join(", "):"—";
function TrophyThumbnail({trophy,manifest}){
 const [bad,setBad]=useState(false);
 const src=trophyImageUrl(trophy,manifest);
 return <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-[#F7F9FC]">
  {src&&!bad?<img src={src} alt="" loading="lazy" onError={()=>setBad(true)} className="h-full w-full object-contain p-1.5"/>:<Trophy size={28} className="text-slate-300"/>}
 </span>;
}
export default function TrophyFm24PalmaresArchive({catalog=[],imageManifest,onOpenTrophy,onSync}){
 const [query,setQuery]=useState(""),[rank,setRank]=useState("all"),[season,setSeason]=useState("all");
 const [collapsed,setCollapsed]=useState([]),[showAll,setShowAll]=useState(false);
 const entriesQuery=useQuery({...completeRecordQueryOptions(base44.entities.TrophyPalmaresEntry,["mf-legacy","trophies","fm24-palmares-entries"]),retry:false});
 const teamsQuery=useQuery({...completeRecordQueryOptions(base44.entities.Team,["mf-legacy","teams"]),retry:false});
 const entries=useMemo(()=>Array.isArray(entriesQuery.data)?entriesQuery.data:[],[entriesQuery.data]);
 const teams=useMemo(()=>Array.isArray(teamsQuery.data)?teamsQuery.data:[],[teamsQuery.data]);
 const seasons=useMemo(()=>[...new Set(entries.map(x=>Number(x.calendar_year)).filter(Number.isInteger))].sort((a,b)=>b-a),[entries]);
 const summary=useMemo(()=>fm24PalmaresOverview(entries,catalog,teams,{query,rank,season}),[entries,catalog,teams,query,rank,season]);
 const isLoading=entriesQuery.isLoading||teamsQuery.isLoading;
 const isError=entriesQuery.isError||teamsQuery.isError;
 const toggle=id=>setCollapsed(old=>old.includes(id)?old.filter(x=>x!==id):[...old,id]);
 const shown=showAll?summary.teams:summary.teams.slice(0,20);
 return <section className="space-y-4 pb-6" aria-label="Palmarés histórico FM24">
  <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 sm:p-4">
   <h3 className="flex items-center gap-2 text-sm font-black text-amber-900"><BookOpen size={17}/> Archivo histórico Rob / FM24</h3>
   <p className="mt-1 max-w-[870px] text-[11px] leading-5 text-amber-800">Resultados extraídos de capturas y vinculados al catálogo, pendientes de verificación externa. Los ganadores, subcampeones y terceros puestos aparecen por separado. No se suman al palmarés oficial ni a los créditos de jugadores.</p>
  </div>
  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
   {[["Campeonatos FM24",summary.totals.winner],["Subcampeonatos",summary.totals.runner_up],["Terceros puestos",summary.totals.third],["Competiciones por club",summary.totals.competitions]].map(([label,count])=>
    <div key={label} className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><strong className="mt-2 block text-xl font-black tabular-nums text-slate-800">{count}</strong></div>)}
  </div>
  <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
   <div className="flex flex-wrap items-center gap-2">
    <label className="relative min-w-[180px] flex-1">
     <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
     <input type="search" aria-label="Buscar club o competición en palmarés FM24" placeholder="Buscar club o competición…" value={query} onChange={e=>{setQuery(e.target.value);setShowAll(false);}} className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none focus:border-blue-300"/>
    </label>
    <select value={rank} onChange={e=>setRank(e.target.value)} aria-label="Filtrar puesto FM24" className={select}>
     <option value="all">Todos los puestos</option><option value="winner">Ganadores</option><option value="runner_up">Subcampeones</option><option value="third">Terceros puestos</option>
    </select>
    <select value={season} onChange={e=>setSeason(e.target.value)} aria-label="Filtrar año FM24" className={select}>
     <option value="all">Todos los años</option>{seasons.map(y=><option key={y} value={String(y)}>{y}</option>)}
    </select>
   </div>
   <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
    <span><strong className="text-slate-900">{summary.totals.teams}</strong> clubes mostrados</span>
    <span><strong className="text-slate-900">{summary.source.linked}</strong> registros vinculados</span>
    <span className="inline-flex items-center gap-1 text-amber-700"><AlertTriangle size={12}/>{summary.source.pending} pendientes de vincular</span>
    {summary.source.ignored>0&&<span>{summary.source.ignored} ignorados</span>}
   </div>
  </div>
  {isLoading&&<p role="status" className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600">Cargando resultados históricos de FM24…</p>}
  {isError&&<p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">No se pudo consultar el historial de FM24 o los equipos completos. Reintenta la vista; no se mostrará un listado parcial.</p>}
  {!isLoading&&!isError&&entries.length===0&&<div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center">
   <BookOpen size={27} className="mx-auto mb-3 text-slate-300"/><p className="text-sm font-bold text-slate-700">No hay resultados de FM24 importados.</p>
   <button type="button" onClick={()=>onSync?.("fm24")} className="mt-3 rounded-lg bg-[#003399] px-4 py-2 text-xs font-bold text-white">Ir al importador FM24</button>
  </div>}
  {!isLoading&&!isError&&entries.length>0&&summary.teams.length===0&&<p className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-xs text-slate-500">No hay coincidencias vinculadas con estos filtros. Puedes revisar los nombres pendientes desde Sincronizar.</p>}
  {!isError&&!isLoading&&shown.map(group=><section key={group.team_id} className="space-y-3">
   <button type="button" onClick={()=>toggle(group.team_id)} aria-expanded={!collapsed.includes(group.team_id)} className="flex w-full flex-wrap items-center gap-3 border-b border-slate-200 pb-2 text-left">
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white p-1">{group.team.logo?<img src={group.team.logo} alt="" loading="lazy" className="h-full w-full object-contain"/>:<Shield size={20} className="text-slate-300"/>}</span>
    <span className="flex-1"><strong className="block text-sm font-black text-slate-900">{group.team.name}</strong><span className="text-[10px] text-slate-400">{group.competitions.length} competiciones · {group.total} registros</span></span>
    <ChevronDown size={16} className={"text-slate-400 "+(collapsed.includes(group.team_id)?"-rotate-90":"")}/>
   </button>
   {!collapsed.includes(group.team_id)&&<div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
    {group.competitions.map(item=><article key={item.source_id} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3">
     <button type="button" onClick={()=>onOpenTrophy?.(item.trophy)} className="flex items-center gap-3 text-left">
      <TrophyThumbnail trophy={item.trophy} manifest={imageManifest}/>
      <span className="min-w-0 flex-1"><strong className="block text-xs font-black text-slate-800">{item.trophy.name}</strong><span className="mt-1 block text-[10px] text-slate-400">ID {item.source_id} · Rob FM24</span></span>
     </button>
     <div className="grid grid-cols-3 gap-1.5">
      {[["Campeón",item.winner],["Subcampeón",item.runner_up],["Tercero",item.third]].map(([title,years])=>
       <div key={title} className="rounded-lg bg-slate-50 px-2 py-2"><div className="flex justify-between gap-1"><span className="text-[9px] font-semibold text-slate-500">{title}</span><b className="text-[10px] tabular-nums text-[#003399]">{years.length}</b></div><p title={yearText(years)} className="mt-1 text-[10px] leading-4 text-slate-600">{yearText(years)}</p></div>)}
     </div>
     {item.description&&<p className="line-clamp-2 border-t border-slate-100 pt-1.5 text-[10px] text-slate-500" title={item.description}>{item.description}</p>}
    </article>)}
   </div>}
  </section>)}
  {summary.teams.length>shown.length&&!isError&&!isLoading&&<button type="button" onClick={()=>setShowAll(true)} className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-[#003399]">Ver todos los {summary.teams.length} clubes</button>}
  <p className="flex items-center gap-2 text-[10px] text-slate-400"><CheckCircle2 size={13}/> Los títulos oficiales continúan separados en «Palmarés verificado». Los datos FM24 se presentan únicamente como historial de referencia.</p>
 </section>;
}
