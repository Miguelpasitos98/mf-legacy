import React,{useMemo,useState,useEffect} from "react";
import {useQuery,useQueryClient} from "@tanstack/react-query";
import {BookOpenCheck,ChevronDown,FileJson,Link2,Search,ShieldAlert,Upload,Download,RefreshCcw,Unlink2} from "lucide-react";
import {base44} from "@/api/base44Client";
import TeamSearchPicker from "./TeamSearchPicker";
import {completeRecordQueryOptions} from "@/utils/entityRecords";
import {previewPalmaresBatch,materializePalmaresEntries,palmaresImportPlan,validatePalmaresBatch,normalizePalmaresBatch} from "@/utils/trophyPalmaresImport";

const QUERY=["mf-legacy","trophies","fm24-palmares-entries"];
const slug=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("es").trim();
const outline="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-600 hover:bg-slate-50";
const primary="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#003399] px-3 text-[11px] font-bold text-white hover:bg-[#002977] disabled:cursor-not-allowed disabled:opacity-40";
const rows=value=>Array.isArray(value)?value:(value?.data||value?.items||[]);
const rankTitle={winner:"Campeón",runner_up:"Subcampeón",third:"Tercer puesto"};
function CompactResults({competition}){
 return <span className="flex flex-wrap gap-1.5">{competition.placements.map((p,i)=><span key={i} className="rounded-md bg-slate-100 px-1.5 py-1 text-[10px] text-slate-500">{rankTitle[p.rank]} <b className="text-slate-800">{p.years.length}</b></span>)}</span>;
}
function TrophyChoice({group,catalog,onChoose}){
 const [search,setSearch]=useState("");
 const suggestions=useMemo(()=>{
  const q=slug(search);
  if(q.length>=2)return catalog.filter(x=>slug(x.name).includes(q)||String(x.source_id).includes(q)).slice(0,12);
  return group.suggestions||[];
 },[group.suggestions,catalog,search]);
 return <div className="min-w-0 space-y-1.5">
  <div className="relative"><Search size={12} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/><input type="text" aria-label={"Buscar trofeo para "+group.raw_name} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar trofeo o ID original…" className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-2 text-[11px] outline-none focus:border-blue-400"/></div>
  <select aria-label={"Vincular "+group.raw_name} value={group.trophy?.source_id||""}
   onChange={e=>{const trophy=catalog.find(x=>String(x.source_id)===e.target.value);onChoose(trophy||null);}}
   className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-[11px] text-slate-700">
   <option value="">Sin vincular · requiere selección</option>
   {group.trophy&&!suggestions.some(x=>String(x.source_id)===String(group.trophy.source_id))&&<option value={group.trophy.source_id}>{group.trophy.name} · ID {group.trophy.source_id}</option>}
   {suggestions.map(x=><option key={x.source_id} value={x.source_id}>{x.name} · ID {x.source_id}</option>)}
  </select>
 </div>;
}
export default function TrophyPalmaresImportWorkbench({catalog=[],teams=[]}){
 const qc=useQueryClient();
 const existingQuery=useQuery({...completeRecordQueryOptions(base44.entities.TrophyPalmaresEntry,QUERY),retry:false});
 const existing=useMemo(()=>rows(existingQuery.data),[existingQuery.data]);
 const [batch,setBatch]=useState(null),[groups,setGroups]=useState([]);
 const [error,setError]=useState(""),[notice,setNotice]=useState(""),[saving,setSaving]=useState(false);
 const [showAll,setShowAll]=useState(false),[filter,setFilter]=useState("");
 const [onlyReview,setOnlyReview]=useState(true);
 const [savedFilter,setSavedFilter]=useState("pending");
 const [openSaved,setOpenSaved]=useState(false);
 useEffect(()=>{
  setGroups(old=>old.map(g=>{
   if(["manual_linked","ignored"].includes(g.status)||!batch)return g;
   try{const found=previewPalmaresBatch(batch,catalog,teams).groups[g.index];return found||g;}catch{return g;}
  }));
 // Deliberately recompute proposals only when catalog/team records change, preserving manual choices.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[catalog,teams]);
 const loaded=useMemo(()=>{
  if(!batch)return null;
  try{return previewPalmaresBatch(batch,catalog,teams);}
  catch(e){return {error:e.message};}
 },[batch,catalog,teams]);
 const readBatch=(input)=>{
  validatePalmaresBatch(input);
  const sameName=teams.filter(t=>slug(t.name)===slug(input.team.name));
  const selected=teams.find(t=>String(t.id)===String(input.team.id))||(sameName.length===1?sameName[0]:null);
  const data={...input,team:{...input.team,id:selected?.id||"",name:selected?.name||input.team.name}};
  setBatch(data);setGroups(selected?previewPalmaresBatch(data,catalog,teams).groups:[]);setShowAll(false);setOnlyReview(true);setFilter("");setError("");
  setNotice(normalized.changes.length||normalized.pending.length
   ?"Formato corregido automáticamente: "+normalized.changes.filter(x=>!x.startsWith("Sin años:")).length+" puestos normalizados y "+normalized.pending.length+" competiciones sin resultados conservadas para revisión."
   :"JSON validado. Revisa las coincidencias antes de importarlo.");
 };
 const loadExample=async()=>{
  setError("");setNotice("");
  try{
   const response=await fetch("/data/fm24_real_madrid_palmares_v1.json");
   if(!response.ok)throw Error("No se pudo cargar el JSON de ejemplo.");
   readBatch(await response.json());
   setNotice("Capturas del Real Madrid cargadas: revisa las vinculaciones propuestas antes de guardarlas.");
  }catch(e){setError(e.message||String(e));}
 };
 const upload=async event=>{
  const file=event.target.files?.[0];event.target.value="";if(!file)return;
  try{if(file.size>2*1024*1024)throw Error("El JSON supera 2 MB.");const content=await file.text();
    let json;try{json=JSON.parse(content);}catch(parseError){throw Error(parseError instanceof SyntaxError?"JSON incompleto o mal cerrado: vuelve a descargar el archivo completo. "+parseError.message:parseError.message);}
    readBatch(json);}
  catch(e){setError("No se pudo abrir el JSON: "+(e?.message||e));}
 };
 const chooseTeam=id=>{
  const team=teams.find(t=>String(t.id)===String(id));
  if(!team||!batch)return;
  const next={...batch,team:{...batch.team,id:team.id,name:team.name}};
  const preview=previewPalmaresBatch(next,catalog,teams);
  setBatch(next);setGroups(preview.groups);setError("");setNotice("Equipo vinculado a "+team.name+". Comprueba las propuestas antes de importar.");
 };
 const decide=(index,trophy)=>{
  setGroups(previous=>previous.map(g=>g.index===index?{...g,trophy,status:trophy?"manual_linked":"needs_review",confidence:trophy?100:0,reason:trophy?"Vinculación seleccionada manualmente":"Sin vinculación"}:g));
 };
 const ignore=index=>setGroups(previous=>previous.map(g=>g.index===index?{...g,trophy:null,status:"ignored",reason:"Marcado como no aplicable por el usuario",confidence:100}:g));
 const reset=index=>{
  setGroups(previous=>previous.map(g=>g.index===index?{...g,...previewPalmaresBatch(batch,catalog,teams).groups[index]}:g));
 };
 const suggested=groups.filter(g=>g.status==="auto_linked").length,manual=groups.filter(g=>g.status==="manual_linked").length,
       requiresReview=groups.filter(g=>g.status==="needs_review"||g.status==="unmatched").length,
       entries=useMemo(()=>batch?materializePalmaresEntries(batch,groups):[],[batch,groups]),
       plan=useMemo(()=>palmaresImportPlan(entries,existing),[entries,existing]);
 const showGroups=useMemo(()=>{
  const found=groups.filter(g=>(!onlyReview||["needs_review","unmatched"].includes(g.status))&&(!filter||slug(g.raw_name).includes(slug(filter))||String(g.trophy?.name||"").toLowerCase().includes(filter.toLowerCase())));
  return showAll?found:found.slice(0,20);
 },[groups,filter,showAll,onlyReview]);
 const save=async()=>{
  if(saving||!batch||loaded?.error||existingQuery.isLoading||existingQuery.isError)return;
  if(!window.confirm("¿Importar "+plan.pending.length+" registros FM24 para "+batch.team.name+"? Se guardarán como datos de Rob sin verificar; NO generan TrophyHonour."))return;
  setSaving(true);setError("");setNotice("");let inserted=0;
  try{
   // Read the latest complete snapshot before ANY writes, not a stale cache.
   const fresh=await qc.fetchQuery({...completeRecordQueryOptions(base44.entities.TrophyPalmaresEntry,QUERY),staleTime:0});
   const freshPlan=palmaresImportPlan(entries,fresh);
   for(let i=0;i<freshPlan.pending.length;i+=50){
    const chunk=freshPlan.pending.slice(i,i+50);
    await base44.entities.TrophyPalmaresEntry.bulkCreate(chunk);inserted+=chunk.length;
   }
   await qc.invalidateQueries({queryKey:QUERY});
   setNotice(inserted+" resultados importados; "+freshPlan.skipped+" repetidos omitidos. "+requiresReview+" competiciones pendientes de resolver. No se han creado adjudicaciones verificadas.");
   setOpenSaved(true);
  }catch(e){
   await qc.invalidateQueries({queryKey:QUERY});
   setError((inserted?inserted+" registros guardados antes del error; puedes repetir para continuar sin duplicarlos. ":"")+"Error al importar: "+(e?.message||e));
  }finally{setSaving(false);}
 };
 const savedGroups=useMemo(()=>{
  const map=new Map();
  for(const entry of existing){
   if(savedFilter==="pending"&&!["unmatched","needs_review"].includes(entry.match_status))continue;
   if(savedFilter==="linked"&&!["auto_linked","manual_linked"].includes(entry.match_status))continue;
   const key=[entry.team_id,entry.trophy_name_raw].join(" | ");
   if(!map.has(key))map.set(key,{key,team_id:entry.team_id,team_name:entry.team_name,name:entry.trophy_name_raw,entries:[],matched:entry.trophy_name_matched,sourceId:entry.trophy_source_id,status:entry.match_status});
   map.get(key).entries.push(entry);
  }
  return [...map.values()].sort((a,b)=>b.entries.length-a.entries.length);
 },[existing,savedFilter]);
 const relinkSaved=async(group,trophy)=>{
  if(saving||!trophy?.source_id)return;
  if(!window.confirm("¿Vincular "+group.entries.length+" resultados de «"+group.name+"» al trofeo "+trophy.name+"? No los verificará oficialmente."))return;
  setError("");setNotice("");setSaving(true);let done=0;
  try{
   for(const entry of group.entries){
    await base44.entities.TrophyPalmaresEntry.update(entry.id,{
     trophy_source_id:String(trophy.source_id),trophy_id:String(trophy.id||""),
     trophy_name_matched:trophy.name,match_status:"manual_linked",manually_reviewed:true,match_confidence:100,
     review_reason:"Correspondencia aprobada manualmente por el usuario; evidencia FM24"
    });done++;
   }
   await qc.invalidateQueries({queryKey:QUERY});
   setNotice(done+" puestos vinculados a "+trophy.name+". La verificación oficial sigue pendiente.");
  }catch(e){setError(done+" vinculaciones guardadas. "+(e?.message||e));await qc.invalidateQueries({queryKey:QUERY});}
  finally{setSaving(false);}
 };
 const download=()=>{
  if(!batch)return;
  const url=URL.createObjectURL(new Blob([JSON.stringify(batch,null,2)],{type:"application/json"}));
  const a=document.createElement("a");a.href=url;a.download="MF_LEGACY_FM24_"+batch.team.name.replace(/\s+/g,"_")+".json";a.click();URL.revokeObjectURL(url);
 };
 const pendingSaved=existing.filter(e=>["needs_review","unmatched"].includes(e.match_status)).length;
 return <section className="space-y-4" aria-label="Importador de palmarés FM24 por equipos">
  <div className="rounded-xl border border-slate-200 bg-white p-4">
   <div className="flex flex-wrap items-start justify-between gap-3">
    <div><h3 className="flex items-center gap-2 text-sm font-black text-slate-900"><FileJson size={17}/> Importar palmarés FM24 por equipo</h3>
     <p className="mt-1 max-w-[720px] text-[11px] leading-5 text-slate-600">Convierte el historial de Rob en puestos por año, detecta el trofeo y autovincula las correspondencias únicas. Los nombres dudosos quedan para tu selección. No añade títulos a TrophyHonour ni a jugadores.</p>
    </div>
    <div className="flex flex-wrap gap-2">
     <button className={outline} type="button" onClick={loadExample}><BookOpenCheck size={13}/> Real Madrid · 3 capturas</button>
     <label className={outline+" cursor-pointer"}><Upload size={13}/> Subir JSON<input type="file" accept=".json,application/json" onChange={upload} className="sr-only"/></label>
    </div>
   </div>
   {batch&&<div className="mt-3 max-w-[460px] border-t border-slate-100 pt-3"><p className="mb-1.5 text-[11px] font-bold text-slate-700">Club de destino en Teams · obligatorio</p><TeamSearchPicker fieldId="fm24-palmares-import-team" teams={teams} value={batch.team.id||""} onChange={chooseTeam} ariaLabel="Elegir equipo de destino para importación FM24" placeholder="Buscar y seleccionar el equipo existente…"/></div>}
   {batch&&loaded&&!loaded.error&&<div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
    <span className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-bold text-[#003399]">{batch.team.name}</span>
    <span className="text-[11px] text-slate-500">{loaded.competitions} competiciones · {loaded.entries} registros · {suggested} coincidencias automáticas · {manual} vinculadas manualmente · {requiresReview} por revisar</span>
    <button type="button" onClick={download} className="ml-auto inline-flex items-center gap-1 text-[11px] font-bold text-[#003399]"><Download size={12}/> Descargar JSON</button>
   </div>}
  </div>
  {error&&<div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>}
  {notice&&<div role="status" className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">{notice}</div>}
  {loaded?.error&&<div role="alert" className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">{loaded.error}</div>}
  {batch&&loaded&&!loaded.error&&<div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
   <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
    <div><h4 className="text-xs font-black text-slate-900">Detector de trofeos · revisión de coincidencias</h4><p className="mt-1 text-[11px] text-slate-500">Azul: coincidencia única. Ámbar: revisar. Puedes cambiar cualquier asignación antes de importar.</p></div>
    <div className="flex gap-2"><span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] text-slate-600">{plan.pending.length} nuevos · {plan.skipped} ya existentes</span></div>
   </div>
   <div className="mb-3 flex flex-wrap gap-2"><button type="button" aria-pressed={onlyReview} onClick={()=>{setOnlyReview(v=>!v);setShowAll(false);}} className={onlyReview?primary:outline}>{onlyReview?"Solo discordancias ("+requiresReview+")":"Ver todas las competiciones"}</button><input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Buscar competición…" aria-label="Buscar una competición del JSON" className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-blue-300"/><button type="button" className={outline} onClick={()=>setShowAll(x=>!x)}>{showAll?"Ver primeras 20":"Ver todas"}</button></div>
   <div className="space-y-2">
    {showGroups.map(g=><div key={g.index} className="grid grid-cols-1 gap-2 rounded-xl border border-slate-100 bg-slate-50/70 p-3 md:grid-cols-[minmax(180px,1fr)_minmax(220px,1.3fr)_auto] md:items-center">
     <div className="min-w-0"><p className="truncate text-[11px] font-black text-slate-800" title={g.raw_name}>{g.raw_name}</p><p className="mt-1 text-[10px] text-slate-500">{g.count} puestos/años · captura {batch.competitions[g.index].capture_index||"—"}</p><div className="mt-1.5"><CompactResults competition={batch.competitions[g.index]}/></div></div>
     <div className="min-w-0"><div className="mb-1 flex flex-wrap items-center gap-2"><span className={"text-[10px] font-bold "+(g.status==="auto_linked"?"text-blue-700":g.status==="manual_linked"?"text-emerald-700":"text-amber-700")}>{g.status==="auto_linked"?"AUTOVINCULADO":g.status==="manual_linked"?"ELEGIDO":g.status==="ignored"?"IGNORADO":"REVISAR"}</span><span className="text-[10px] text-slate-400">{g.reason}</span></div>
      <TrophyChoice key={g.index} group={g} catalog={catalog} onChoose={t=>decide(g.index,t)}/></div>
     <div className="flex gap-1 md:flex-col">{g.trophy&&g.status==="needs_review"&&<button type="button" title="Confirmar este trofeo sugerido" onClick={()=>decide(g.index,g.trophy)} className="rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100">Confirmar propuesta</button>}<button type="button" title="Restablecer sugerencia automática" onClick={()=>reset(g.index)} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-100"><RefreshCcw size={14}/></button><button type="button" title="Ignorar esta competición" onClick={()=>ignore(g.index)} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-100"><Unlink2 size={14}/></button></div>
    </div>)}
   </div>
   <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
    <p className="flex max-w-[680px] items-start gap-1.5 text-[11px] leading-5 text-slate-500"><ShieldAlert size={14} className="mt-0.5 shrink-0"/> Los años de FM24 se guardan como años naturales, no como temporadas deducidas. Los segundos y terceros puestos nunca se cuentan como títulos. Las vinculaciones pendientes quedan localizables para corregirlas.</p>
    <button className={primary} type="button" onClick={save} disabled={saving||existingQuery.isError||existingQuery.isLoading||plan.pending.length===0}><Link2 size={14}/>{saving?"Importando…":"Guardar "+plan.pending.length+" registros sin verificar"}</button>
   </div>
  </div>}
  <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
   <button type="button" onClick={()=>setOpenSaved(x=>!x)} aria-expanded={openSaved} className="flex w-full flex-wrap items-center justify-between gap-2 text-left">
    <span><strong className="block text-xs font-black text-slate-900">Revisión de palmarés FM24 guardado</strong><span className="mt-1 block text-[11px] text-slate-500">{existing.length} registros · {pendingSaved} sin vincular o por revisar</span></span>
    <ChevronDown size={16} className={"text-slate-400 "+(openSaved?"rotate-180":"")}/>
   </button>
   {openSaved&&<div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
    <select aria-label="Filtrar resultados FM24" value={savedFilter} onChange={e=>setSavedFilter(e.target.value)} className="h-9 rounded-lg border border-slate-200 px-2 text-xs"><option value="pending">Pendientes</option><option value="linked">Vinculados</option><option value="all">Todos</option></select>
    {existingQuery.isLoading&&<p className="text-xs text-slate-500">Cargando importaciones guardadas…</p>}
    {existingQuery.isError&&<p role="alert" className="text-xs text-red-700">No se pudo leer la tabla TrophyPalmaresEntry.</p>}
    {savedGroups.slice(0,60).map(g=><div className="grid gap-2 rounded-lg border border-slate-200 p-2.5 sm:grid-cols-[minmax(160px,1fr)_minmax(230px,1fr)]" key={g.key}>
     <div><p className="text-[11px] font-bold text-slate-800">{g.name}</p><p className="text-[10px] text-slate-500">{g.team_name} · {g.entries.length} resultados · {g.sourceId?"ID "+g.sourceId:"Sin trofeo vinculado"}</p></div>
     <TrophyChoice key={g.key} group={{raw_name:g.name,trophy:catalog.find(t=>String(t.source_id)===String(g.sourceId)),suggestions:catalog.filter(t=>slug(t.name)===slug(g.name))}} catalog={catalog} onChoose={t=>relinkSaved(g,t)}/>
    </div>)}
    {!existingQuery.isLoading&&savedGroups.length===0&&<p className="rounded-lg bg-slate-50 p-4 text-xs text-slate-500">No hay registros para ese estado.</p>}
   </div>}
  </div>
 </section>;
}