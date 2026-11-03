import React,{useMemo,useState} from "react";
import {CalendarDays,Search,MapPin,Download,AlertCircle,ChevronDown} from "lucide-react";

const normalize=v=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const unique=items=>[...new Set(items.filter(Boolean))];
const raw=records=>Array.isArray(records)?records:(records?.items||records?.data||[]);
const csvCell=v=>'"'+String(v??"").replace(/"/g,'""')+'"';
function exportRows(rows,filename,columns){
 const content="\ufeff"+columns.map(c=>csvCell(c[0])).join(";")+"\n"+rows.map(row=>columns.map(([,key])=>csvCell(row[key])).join(";")).join("\n");
 const blob=new Blob([content],{type:"text/csv;charset=utf-8"});
 const url=URL.createObjectURL(blob),anchor=document.createElement("a");
 anchor.href=url;anchor.download=filename;document.body.appendChild(anchor);anchor.click();anchor.remove();
 URL.revokeObjectURL(url);
}
function Source({count}){
 return <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200/70 bg-amber-50/50 px-3 py-2">
  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-800"><AlertCircle size={13}/> Datos de Rob / FM24 · sin contrastar externamente</span>
  <span className="text-[10px] font-semibold text-amber-700">{count} registros</span>
 </div>;
}
function Person({name,role,team}){
 return <div className="flex min-w-0 items-center gap-2">{team?.logo&&<img src={team.logo} loading="lazy" alt="" className="h-7 w-7 shrink-0 object-contain"/>}<div className="min-w-0"><p className="truncate text-xs font-bold text-slate-800" title={name||"Desconocido"}>{name||"—"}</p><span className="text-[9px] font-medium uppercase tracking-wider text-slate-400">{role}</span></div></div>;
}
export default function TrophyHistoricalArchive({mode="editions",editions=[],events=[],teams=[],loading=false,error=false,trophySourceId=""}){
 const [filter,setFilter]=useState("");
 const [openRows,setOpenRows]=useState({});
 const teamMap=useMemo(()=>new Map(raw(teams).map(team=>[String(team.id),team])),[teams]);
 const finals=useMemo(()=>raw(editions).filter(r=>r.trophy_source_id===String(trophySourceId)).sort((a,b)=>(b.edition_year||0)-(a.edition_year||0)),[editions,trophySourceId]);
 const narratives=useMemo(()=>raw(events).filter(r=>r.trophy_source_id===String(trophySourceId)).sort((a,b)=>String(b.season).localeCompare(String(a.season),"es",{numeric:true})),[events,trophySourceId]);
 const data=mode==="events"?narratives:finals;
 const query=normalize(filter).trim();
 const displayed=useMemo(()=>data.filter(row=>!query||normalize(mode==="events"?[row.season,row.description_es,row.event_type].join(" "):[row.season,row.champion_name,row.runner_up_name,row.city,row.country,row.stadium_name].join(" ")).includes(query)),[data,query,mode]);
 const exporting=()=>{
  const cols=mode==="events"?[["Temporada","season"],["Tipo de evento","event_type"],["Descripción","description_es"],["Fuente","source_dataset"],["Estado","verification_status"]]:
   [["Temporada","season"],["Campeón","champion_name"],["Campeón FM24","champion_raw"],["Subcampeón","runner_up_name"],["Subcampeón FM24","runner_up_raw"],["Estadio","stadium_name"],["Ciudad","city"],["País","country"],["Fuente","source_dataset"],["Estado","verification_status"]];
  exportRows(displayed,mode==="events"?"champions_rob_acontecimientos.csv":"champions_rob_finales.csv",cols);
 };
 if(loading)return <div className="rounded-xl bg-white px-4 py-6 text-xs text-slate-500">Cargando historial histórico…</div>;
 if(error)return <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">No se pudo cargar el historial importado desde FM24. El palmarés verificado no se ha modificado.</div>;
 return <section className="space-y-3">
  <div className="flex flex-wrap items-center justify-between gap-2">
   <div><h3 className="text-sm font-black text-slate-900">{mode==="events"?"Historia y acontecimientos":"Finales históricas"}</h3>
    <p className="text-[11px] text-slate-500">{mode==="events"?"Anotaciones originales de Rob resumidas en español":"Campeones, subcampeones y sedes extraídos de capturas de FM24"}</p>
   </div>
   {data.length>0&&<button type="button" onClick={exporting} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"><Download size={13}/> Exportar CSV</button>}
  </div>
  {data.length===0?<div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-xs text-slate-500">Todavía no hay datos históricos de Rob para este trofeo. Las ediciones oficiales verificadas se mantienen aparte.</div>:<>
   <Source count={data.length}/>
   <label className="relative block">
    <Search size={15} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
    <input aria-label={mode==="events"?"Buscar acontecimientos":"Buscar temporada, club o estadio"} value={filter} onChange={e=>setFilter(e.target.value)} placeholder={mode==="events"?"Buscar año o acontecimiento…":"Buscar temporada, club, estadio o ciudad…"} className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-800 outline-none focus:border-[#003399]"/>
   </label>
   {mode==="editions"?<div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
    <div className="hidden grid-cols-[72px_minmax(125px,1fr)_minmax(125px,1fr)_minmax(160px,1.2fr)] gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 md:grid">
     <span>Temporada</span><span>Campeón</span><span>Subcampeón</span><span>Sede</span>
    </div>
    {displayed.map(row=><div key={row.edition_key} className="grid grid-cols-[75px_minmax(0,1fr)] gap-2 border-b border-slate-100 px-3 py-3 last:border-b-0 md:grid-cols-[72px_minmax(125px,1fr)_minmax(125px,1fr)_minmax(160px,1.2fr)] md:items-center md:gap-3">
     <span className="inline-flex h-fit items-center gap-1 whitespace-nowrap text-[11px] font-black tabular-nums text-[#003399]"><CalendarDays size={12}/>{row.season}</span>
     <Person name={row.champion_name} role="Campeón" team={teamMap.get(String(row.champion_team_id||""))}/>
     <div className="col-start-2 md:col-auto"><Person name={row.runner_up_name} role="Subcampeón" team={teamMap.get(String(row.runner_up_team_id||""))}/></div>
     <div className="col-start-2 flex min-w-0 items-start gap-1.5 text-[11px] text-slate-500 md:col-auto"><MapPin size={12} className="mt-0.5 shrink-0"/><span><span className="font-semibold text-slate-700">{row.stadium_name||"Sede pendiente"}</span><br/>{unique([row.city,row.country]).join(" · ")}</span></div>
    </div>)}
   </div>:<div className="space-y-2">{displayed.map(row=><article key={row.event_key} className="rounded-xl border border-slate-200 bg-white">
     <button type="button" onClick={()=>setOpenRows(s=>({...s,[row.event_key]:!s[row.event_key]}))} aria-expanded={Boolean(openRows[row.event_key])} className="flex w-full items-center gap-3 px-4 py-3 text-left">
      <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-700">{row.season}</span>
      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-700">{row.description_es}</span>
      <ChevronDown size={14} className={"shrink-0 text-slate-400 transition "+(openRows[row.event_key]?"rotate-180":"")}/>
     </button>
     {openRows[row.event_key]&&<div className="border-t border-slate-100 px-4 py-3"><p className="text-xs leading-5 text-slate-700">{row.description_es}</p><p className="mt-2 text-[10px] text-slate-400">Tipo: {row.event_type}. Fuente: Rob FM24. Resumen traducido, pendiente de contraste histórico. No representa una edición cancelada.</p></div>}
    </article>)}</div>}
   {displayed.length===0&&<p className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-xs text-slate-500">Sin coincidencias para esa búsqueda.</p>}
   <p className="text-[10px] text-slate-400">{displayed.length} de {data.length} registros · Los datos de esta sección no incrementan los títulos oficiales de Clubs o Players.</p>
  </>}
 </section>;
}