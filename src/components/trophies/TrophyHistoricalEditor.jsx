import React,{useMemo,useState} from "react";
import {useQuery,useQueryClient} from "@tanstack/react-query";
import {base44} from "@/api/base44Client";
import {completeRecordQueryOptions} from "@/utils/entityRecords";
import {CalendarDays,Plus,Save,X,Pencil,Search,Trophy,BookOpen,MapPin,Info,CheckCircle2,ChevronDown} from "lucide-react";
import {normalizeHistoricalSeason,findHistoricalDuplicate,buildHistoricalEditionPayload,historicalEventDefaults,buildHistoricalEventPayload} from "@/utils/trophyHistoricalForms";

const rows=value=>Array.isArray(value)?value:(value?.data||value?.items||[]);
const txt=value=>String(value||"").trim();
const norm=value=>txt(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("es");
const input="h-9 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const label="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500";
const baseButton="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-3 text-[11px] font-bold transition disabled:opacity-50";
const editorCard="rounded-xl border border-slate-200 bg-white";
const TYPES=[["historical_context","Contexto histórico"],["founding","Fundación"],["format_change","Cambio de formato"],["achievement","Hito deportivo"],["controversy","Acontecimiento / polémica"],["club_history","Historia de clubes"]];

function Field({title,children,className=""}){return <label className={className+" min-w-0"}><span className={label}>{title}</span>{children}</label>;}

function TeamField({title,value,selectedId,teams=[],onChange,onSelect}){
 const [focused,setFocused]=useState(false);
 const matches=useMemo(()=>{
  const q=norm(value);
  if(q.length<2)return [];
  return teams.filter(t=>norm(t.name).includes(q)).slice(0,7);
 },[value,teams]);
 const linked=selectedId&&teams.find(t=>String(t.id)===String(selectedId));
 return <div className="relative min-w-0">
  <span className={label}>{title} *</span>
  <input aria-label={title} autoComplete="off" className={input} value={value||""} onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}
    onChange={e=>onChange(e.target.value)} placeholder="Nombre histórico o buscar en Team" required/>
  {linked?<p className="mt-1 flex items-center gap-1 text-[10px] text-emerald-700"><CheckCircle2 size={11}/>Vinculado a Team: {linked.name}</p>:
   <p className="mt-1 text-[10px] text-slate-400">Sin vincular. Puedes conservar el nombre histórico.</p>}
  {focused&&matches.length>0&&<div className="absolute left-0 right-0 top-[calc(100%+.25rem)] z-40 max-h-40 overflow-auto rounded-lg border border-blue-200 bg-white p-1 shadow-xl" onMouseDown={e=>e.preventDefault()}>
    {matches.map(t=><button key={t.id} type="button" onClick={()=>{onSelect(t);setFocused(false);}} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[11px] text-slate-700 hover:bg-blue-50">
     {t.logo?<img src={t.logo} alt="" className="h-5 w-5 shrink-0 object-contain"/>:<Trophy size={13} className="text-slate-300"/>}{t.name}
    </button>)}
   </div>}
 </div>;
}

const editionTemplate=trophy=>({
 season:"",competition_name_at_time:trophy?.name||"",champion_name:"",champion_raw:"",champion_team_id:"",
 runner_up_name:"",runner_up_raw:"",runner_up_team_id:"",stadium_name:"",stadium_id:"",city:"",
 country:"",country_id:"",final_score:"",notes:"",evidence_note:"",is_officially_verified:false,
 verification_status:"needs_review",source_dataset:"MF LEGACY · edición manual",evidence_type:"manual"
});
export default function TrophyHistoricalEditor({trophy,teams=[],countries=[]}){
 const qc=useQueryClient();
 const sourceId=String(trophy?.source_id||"");
 const canEdit=Boolean(trophy?.id&&sourceId);
 const editionKey=["mf-legacy","trophies","historical-editions",sourceId];
 const eventKey=["mf-legacy","trophies","historical-events",sourceId];
 const editionQuery=useQuery({...completeRecordQueryOptions({list:opts=>base44.entities.TrophyEdition.filter({trophy_source_id:sourceId},opts)},editionKey),enabled:canEdit,retry:false});
 const eventQuery=useQuery({...completeRecordQueryOptions({list:opts=>base44.entities.TrophyHistoricalEvent.filter({trophy_source_id:sourceId},opts)},eventKey),enabled:canEdit,retry:false});
 const editions=useMemo(()=>rows(editionQuery.data).filter(x=>String(x.trophy_source_id)===sourceId).sort((a,b)=>Number(b.edition_year)-Number(a.edition_year)),[editionQuery.data,sourceId]);
 const events=useMemo(()=>rows(eventQuery.data).filter(x=>String(x.trophy_source_id)===sourceId).sort((a,b)=>String(b.season).localeCompare(String(a.season),"es",{numeric:true})),[eventQuery.data,sourceId]);
 const [pane,setPane]=useState("finals");
 const [search,setSearch]=useState("");
 const [editionDraft,setEditionDraft]=useState(null);
 const [eventDraft,setEventDraft]=useState(null);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState("");
 const [success,setSuccess]=useState("");
 const [expanded,setExpanded]=useState(false);
 const term=norm(search);
 const list=useMemo(()=>{
  const data=pane==="events"?events:editions;
  const matches=data.filter(x=>!term||(pane==="events"?norm([x.season,x.description_es,x.event_type].join(" ")):norm([x.season,x.champion_name,x.runner_up_name,x.stadium_name,x.city].join(" "))).includes(term));
  return expanded||term?matches:matches.slice(0,16);
 },[events,editions,term,pane,expanded]);
 const switchPane=next=>{setPane(next);setSearch("");setExpanded(false);setEditionDraft(null);setEventDraft(null);setError("");setSuccess("");};
 const newEdition=()=>{setPane("finals");setEditionDraft(editionTemplate(trophy));setEventDraft(null);setError("");setSuccess("");};
 const editEdition=row=>{setPane("finals");setEditionDraft({...row});setEventDraft(null);setError("");setSuccess("");};
 const newEvent=()=>{setPane("events");setEventDraft(historicalEventDefaults(trophy));setEditionDraft(null);setError("");setSuccess("");};
 const editEvent=row=>{setPane("events");setEventDraft({...row});setEditionDraft(null);setError("");setSuccess("");};
 const saveEdition=async e=>{
  e.preventDefault();if(saving||!canEdit)return;setError("");setSuccess("");setSaving(true);
  try{
   const payload=buildHistoricalEditionPayload({draft:editionDraft,trophy,teams,countries});
   const duplicate=findHistoricalDuplicate(editions,payload.season,editionDraft?.id);
   if(duplicate)throw Error("Ya existe la final "+payload.season+". Pulsa «Editar» sobre esa temporada en lugar de duplicarla.");
   // Original FM24 names remain a separate source field on existing records.
   if(editionDraft?.id)await base44.entities.TrophyEdition.update(editionDraft.id,payload);
   else await base44.entities.TrophyEdition.create(payload);
   await qc.invalidateQueries({queryKey:editionKey});
   setEditionDraft(null);setSearch("");setExpanded(false);setSuccess("Final guardada. Los datos seguirán separados del palmarés verificado.");
  }catch(err){setError("No se pudo guardar: "+(err?.message||err));}
  finally{setSaving(false);}
 };
 const saveEvent=async e=>{
  e.preventDefault();if(saving||!canEdit)return;setError("");setSuccess("");setSaving(true);
  try{
   const payload=buildHistoricalEventPayload({draft:eventDraft,trophy});
   if(eventDraft?.id)await base44.entities.TrophyHistoricalEvent.update(eventDraft.id,payload);
   else await base44.entities.TrophyHistoricalEvent.create(payload);
   await qc.invalidateQueries({queryKey:eventKey});
   setEventDraft(null);setSearch("");setExpanded(false);setSuccess("Acontecimiento histórico guardado.");
  }catch(err){setError("No se pudo guardar: "+(err?.message||err));}
  finally{setSaving(false);}
 };
 if(!canEdit)return <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-xs text-slate-600">Guarda primero la ficha del trofeo para añadir finales y acontecimientos históricos.</div>;
 return <section className="space-y-3" aria-label="Edición de finales y acontecimientos históricos">
  <div className="flex flex-wrap items-center justify-between gap-2">
   <div><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">ARCHIVO HISTÓRICO</p><h3 className="mt-1 text-sm font-black text-slate-900">Finales y acontecimientos</h3></div>
   <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[10px] font-semibold text-slate-600">{editions.length} finales · {events.length} notas</span>
  </div>
  <div role="tablist" aria-label="Datos históricos editables" className="grid grid-cols-2 rounded-lg bg-slate-100 p-1">
   <button type="button" role="tab" aria-selected={pane==="finals"} onClick={()=>switchPane("finals")} className={"rounded-md py-2 text-[11px] font-bold "+(pane==="finals"?"bg-white text-[#003399] shadow-sm":"text-slate-500")}>Finales ({editions.length})</button>
   <button type="button" role="tab" aria-selected={pane==="events"} onClick={()=>switchPane("events")} className={"rounded-md py-2 text-[11px] font-bold "+(pane==="events"?"bg-white text-[#003399] shadow-sm":"text-slate-500")}>Acontecimientos ({events.length})</button>
  </div>
  {error&&<p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</p>}
  {success&&<p role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-800">{success}</p>}
  {pane==="finals"&&<div className="space-y-3">
   {!editionDraft&&<div className="flex items-center gap-2">
    <label className="relative min-w-0 flex-1"><Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/><input aria-label="Buscar finales" className={input+" pl-8"} placeholder="Año, campeón, finalista, estadio…" value={search} onChange={e=>setSearch(e.target.value)}/></label>
    <button type="button" onClick={newEdition} className={baseButton+" shrink-0 bg-[#003399] text-white"}><Plus size={14}/> Añadir final</button>
   </div>}
   {editionDraft?<form onSubmit={saveEdition} className={editorCard+" space-y-3 p-3.5"}>
    <div className="flex items-center justify-between gap-2"><h4 className="text-xs font-black text-slate-900">{editionDraft.id?"Editar final "+editionDraft.season:"Nueva final histórica"}</h4><button type="button" disabled={saving} onClick={()=>setEditionDraft(null)} className="rounded p-1 text-slate-400 hover:bg-slate-100" aria-label="Cerrar formulario de final"><X size={17}/></button></div>
    <div className="grid grid-cols-2 gap-3">
     <Field title="Temporada *"><input className={input} value={editionDraft.season||""} onChange={e=>setEditionDraft(x=>({...x,season:e.target.value}))} placeholder="2023/24" required/></Field>
     <Field title="Resultado de la final"><input className={input} value={editionDraft.final_score||""} onChange={e=>setEditionDraft(x=>({...x,final_score:e.target.value}))} placeholder="2-1, 1-1 (pen. 5-4)…"/></Field>
    </div>
    <Field title="Nombre de la competición en esa edición"><input className={input} value={editionDraft.competition_name_at_time||""} onChange={e=>setEditionDraft(x=>({...x,competition_name_at_time:e.target.value}))} placeholder="Copa de Europa / UEFA Champions League"/></Field>
    <TeamField title="Campeón" value={editionDraft.champion_name} selectedId={editionDraft.champion_team_id} teams={teams}
      onChange={value=>setEditionDraft(x=>({...x,champion_name:value,champion_team_id:""}))}
      onSelect={team=>setEditionDraft(x=>({...x,champion_name:team.name,champion_team_id:String(team.id)}))}/>
    <TeamField title="Subcampeón" value={editionDraft.runner_up_name} selectedId={editionDraft.runner_up_team_id} teams={teams}
      onChange={value=>setEditionDraft(x=>({...x,runner_up_name:value,runner_up_team_id:""}))}
      onSelect={team=>setEditionDraft(x=>({...x,runner_up_name:team.name,runner_up_team_id:String(team.id)}))}/>
    <div className="border-t border-slate-100 pt-3"><h4 className="mb-2 flex items-center gap-1.5 text-xs font-black text-slate-700"><MapPin size={14}/> Sede de la final</h4>
     <div className="grid grid-cols-2 gap-2.5">
      <Field className="col-span-2" title="Estadio"><input className={input} value={editionDraft.stadium_name||""} onChange={e=>setEditionDraft(x=>({...x,stadium_name:e.target.value,stadium_id:""}))} placeholder="Estadio Olímpico Atatürk"/></Field>
      <Field title="Ciudad"><input className={input} value={editionDraft.city||""} onChange={e=>setEditionDraft(x=>({...x,city:e.target.value}))} placeholder="Estambul"/></Field>
      <Field title="País"><input className={input} list="trophy-final-country-names" value={editionDraft.country||""} onChange={e=>setEditionDraft(x=>({...x,country:e.target.value,country_id:""}))} placeholder="Turquía"/><datalist id="trophy-final-country-names">{countries.map(c=><option key={c.id} value={c.name}/>)}</datalist></Field>
      <Field className="col-span-2" title="ID de Stadium (opcional)"><input className={input} value={editionDraft.stadium_id||""} onChange={e=>setEditionDraft(x=>({...x,stadium_id:e.target.value}))} placeholder="Solo si has comprobado el ID interno del estadio"/></Field>
     </div>
    </div>
    <details className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
     <summary className="cursor-pointer text-[11px] font-semibold text-slate-700">Datos de procedencia y notas</summary>
     <div className="mt-3 space-y-2">
      <Field title="Nombre original del campeón en FM24"><input className={input} value={editionDraft.champion_raw||""} onChange={e=>setEditionDraft(x=>({...x,champion_raw:e.target.value}))}/></Field>
      <Field title="Nombre original del subcampeón en FM24"><input className={input} value={editionDraft.runner_up_raw||""} onChange={e=>setEditionDraft(x=>({...x,runner_up_raw:e.target.value}))}/></Field>
      <Field title="Fuente del registro"><input className={input} value={editionDraft.source_dataset||""} onChange={e=>setEditionDraft(x=>({...x,source_dataset:e.target.value}))}/></Field>
      <Field title="Observaciones"><textarea className={input+" min-h-[60px] py-2"} value={editionDraft.notes||""} onChange={e=>setEditionDraft(x=>({...x,notes:e.target.value}))}/></Field>
     </div>
    </details>
    <p className="flex gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-[10px] leading-4 text-amber-800"><Info size={13} className="shrink-0"/> {editionDraft.is_officially_verified?"Esta edición figura como verificada externamente; editar sus datos no cambia su estado.":"Registro histórico pendiente de verificación. Guardarlo no genera TrophyHonour ni títulos de jugadores."}</p>
    <div className="flex justify-end gap-2"><button type="button" disabled={saving} className={baseButton+" border border-slate-200 text-slate-600"} onClick={()=>setEditionDraft(null)}>Cancelar</button><button type="submit" disabled={saving} className={baseButton+" bg-[#003399] text-white"}><Save size={14}/>{saving?"Guardando…":"Guardar final"}</button></div>
   </form>:<div className={editorCard+" overflow-hidden"}>
    {editionQuery.isLoading?<p className="p-4 text-xs text-slate-400">Cargando finales del archivo…</p>:editionQuery.isError?<p role="alert" className="p-4 text-xs text-red-700">No se ha podido leer TrophyEdition.</p>:list.length?list.map(row=><div key={row.id||row.edition_key} className="flex items-center gap-2.5 border-b border-slate-100 px-3 py-2.5 last:border-b-0">
     <CalendarDays size={13} className="shrink-0 text-slate-300"/>
     <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-bold text-slate-800">{row.season} · {row.champion_name} <span className="font-normal text-slate-400">vs</span> {row.runner_up_name}</p><p className="mt-0.5 truncate text-[10px] text-slate-400">{[row.stadium_name,row.city,row.country].filter(Boolean).join(" · ")||"Sin sede"}</p></div>
     <button type="button" onClick={()=>editEdition(row)} aria-label={"Editar final "+row.season} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:bg-blue-50 hover:text-[#003399]"><Pencil size={13}/></button>
    </div>):<p className="p-5 text-center text-xs text-slate-500">{term?"Sin resultados para esta búsqueda.":"No hay finales registradas. Pulsa «Añadir final» para crear la primera."}</p>}
   </div>}
   {!editionDraft&&!term&&editions.length>16&&<button type="button" onClick={()=>setExpanded(v=>!v)} className="flex w-full items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-[#003399] hover:bg-slate-50">{expanded?"Mostrar 16 recientes":"Ver las "+editions.length+" finales"}<ChevronDown size={13} className={expanded?"rotate-180":""}/></button>}
  </div>}
  {pane==="events"&&<div className="space-y-3">
   {!eventDraft&&<div className="flex gap-2">
    <label className="relative min-w-0 flex-1"><Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/><input aria-label="Buscar acontecimientos" className={input+" pl-8"} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Año o texto histórico…"/></label>
    <button type="button" onClick={newEvent} className={baseButton+" shrink-0 bg-[#003399] text-white"}><Plus size={14}/> Añadir nota</button>
   </div>}
   {eventDraft?<form onSubmit={saveEvent} className={editorCard+" space-y-3 p-3.5"}>
    <div className="flex items-center justify-between"><h4 className="text-xs font-black">{eventDraft.id?"Editar acontecimiento":"Nuevo acontecimiento histórico"}</h4><button type="button" disabled={saving} onClick={()=>setEventDraft(null)} aria-label="Cerrar formulario de acontecimiento" className="text-slate-400"><X size={16}/></button></div>
    <div className="grid grid-cols-2 gap-2">
     <Field title="Temporada de referencia *"><input className={input} value={eventDraft.season||""} onChange={e=>setEventDraft(x=>({...x,season:e.target.value}))} placeholder="2022/23" required/></Field>
     <Field title="Tipo de acontecimiento"><select className={input} value={eventDraft.event_type||"historical_context"} onChange={e=>setEventDraft(x=>({...x,event_type:e.target.value}))}>{TYPES.map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></Field>
    </div>
    <Field title="Descripción en español *"><textarea className={input+" min-h-[88px] py-2"} value={eventDraft.description_es||""} onChange={e=>setEventDraft(x=>({...x,description_es:e.target.value}))} required placeholder="Resumen histórico de esta época o final"/></Field>
    <Field title="Texto original de Rob / FM24"><textarea className={input+" min-h-[105px] py-2"} value={eventDraft.original_text||""} onChange={e=>setEventDraft(x=>({...x,original_text:e.target.value}))} placeholder="Conservar también la descripción original en inglés"/></Field>
    <Field title="Notas y fuentes"><textarea className={input+" min-h-[55px] py-2"} value={eventDraft.notes||""} onChange={e=>setEventDraft(x=>({...x,notes:e.target.value}))}/></Field>
    <p className="flex gap-1 rounded-lg bg-amber-50 px-3 py-2 text-[10px] text-amber-800"><Info size={12} className="shrink-0"/>Las anotaciones «No se celebró la competición» de Rob no son cancelaciones verificadas.</p>
    <div className="flex justify-end gap-2"><button type="button" disabled={saving} onClick={()=>setEventDraft(null)} className={baseButton+" border border-slate-200 text-slate-600"}>Cancelar</button><button type="submit" disabled={saving} className={baseButton+" bg-[#003399] text-white"}><Save size={14}/>{saving?"Guardando…":"Guardar acontecimiento"}</button></div>
   </form>:<div className={editorCard+" overflow-hidden"}>
    {eventQuery.isLoading?<p className="p-4 text-xs text-slate-400">Cargando acontecimientos…</p>:eventQuery.isError?<p role="alert" className="p-4 text-xs text-red-700">No se pudo leer TrophyHistoricalEvent.</p>:list.length?list.map(row=><div key={row.id||row.event_key} className="flex items-center gap-2.5 border-b border-slate-100 px-3 py-2.5 last:border-b-0">
     <BookOpen size={14} className="shrink-0 text-slate-300"/><div className="min-w-0 flex-1"><p className="text-[11px] font-bold text-slate-700">{row.season}</p><p className="mt-0.5 line-clamp-2 text-[10px] text-slate-500">{row.description_es}</p></div>
     <button type="button" onClick={()=>editEvent(row)} aria-label={"Editar acontecimiento "+row.season} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:bg-blue-50 hover:text-[#003399]"><Pencil size={13}/></button>
    </div>):<p className="p-5 text-center text-xs text-slate-500">{term?"Sin coincidencias.":"Sin acontecimientos registrados."}</p>}
   </div>}
   {!eventDraft&&!term&&events.length>16&&<button type="button" onClick={()=>setExpanded(v=>!v)} className="flex w-full items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-[#003399] hover:bg-slate-50">{expanded?"Mostrar 16 recientes":"Ver los "+events.length+" acontecimientos"}<ChevronDown size={13} className={expanded?"rotate-180":""}/></button>}
  </div>}
 </section>;
}