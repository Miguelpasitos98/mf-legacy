import React,{useEffect,useMemo,useState} from "react";
import {useQuery,useQueryClient} from "@tanstack/react-query";
import {Search,Trophy,Plus,ChevronRight,X,Save,Image as ImageIcon,Filter,AlertCircle,Trash2,Upload,Medal,Users,Link2,RotateCcw} from "lucide-react";
import {base44} from "@/api/base44Client";
import {completeRecordQueryOptions} from "@/utils/entityRecords";
import {useLeaguesQuery,useCountriesQuery} from "@/hooks/useSharedData";
import {groupTrophies} from "@/utils/trophyGrouping";
import TrophySyncWorkbench from "@/components/trophies/TrophySyncWorkbench";
import TrophyDetailVisual from "@/components/trophies/TrophyDetailVisual";
import {TROPHY_CSV_URL,TROPHY_TYPES,TROPHY_CATEGORIES,parseTrophyCatalog,mergeTrophyCatalog,trophyImageUrl,normaliseSearch} from "@/utils/trophyCatalog";

const TROPHY_KEY=["mf-legacy","trophies","definitions"];
const HONOURS_KEY=["mf-legacy","trophies","honours"];
const emptyTrophy=()=>({source_id:"",name:"",trophy_type:"",category:"",country:"",organizer:"",competition_id:"",description:"",image_url:"",identification_status:"Manual",is_active:true});
const emptyHonour=(trophy)=>({season:"",recipient_type:trophy?.trophy_type==="Individual Trophy"?"Player":"Team",recipient_id:"",recipient_name:"",award_rank:"",goals:"",edition_label:"",verified:false,source_url:"",notes:""});
const rows=result=>Array.isArray(result)?result:(result?.items||result?.data||[]);
const cls=(active)=>"whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition "+(active?"bg-[#003399] text-white":"text-slate-500 hover:bg-slate-100 hover:text-slate-900");
const input="h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-[#003399] focus:ring-2 focus:ring-[#003399]/10";
const label="mb-1.5 block text-[11px] font-bold uppercase tracking-[.12em] text-slate-500";

function TrophyArtwork({trophy,manifest,className="h-24 w-full",onError}){
 const [bad,setBad]=useState(false);
 useEffect(()=>setBad(false),[trophy?.source_id,trophy?.image_url]);
 return <div className={"flex items-center justify-center overflow-hidden "+className}>
   {bad?<Trophy size={42} strokeWidth={1.1} className="text-slate-300"/>:<img loading="lazy" src={trophyImageUrl(trophy,manifest)} alt="" className="h-full w-full object-contain drop-shadow-[0_8px_10px_rgba(15,23,42,0.10)]" onError={()=>{setBad(true);onError?.();}}/>}
 </div>;
}
function Metric({value,label:caption,icon:Icon}){
 return <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3">
  <div className="flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-400">{caption}</span><Icon size={14} className="text-slate-300"/></div>
  <div className="mt-2 text-xl font-black tabular-nums text-slate-900">{value}</div>
 </div>;
}
function TrophyCard({trophy,manifest,open,count}){
 return <button type="button" onClick={open} className="group relative flex min-h-[195px] w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-left transition hover:-translate-y-0.5 hover:border-[#003399]/30 hover:shadow-[0_12px_35px_rgba(20,35,65,.09)]">
   <div className="relative flex h-32 items-center justify-center bg-gradient-to-b from-[#F8F9FC] to-white px-5 pt-3">
    <TrophyArtwork trophy={trophy} manifest={manifest} className="h-[110px] w-full"/>
    {trophy.identification_status==="Pending"&&<span className="absolute right-2 top-2 rounded-md bg-amber-50 px-1.5 py-1 text-[9px] font-bold text-amber-700">PENDIENTE</span>}
    {trophy.id&&<span className="absolute left-2 top-2 rounded-md bg-blue-50 px-1.5 py-1 text-[9px] font-bold text-blue-800">FICHA</span>}
   </div>
   <div className="flex flex-1 flex-col px-3.5 pb-3.5 pt-1">
    <h3 title={trophy.name} className="line-clamp-2 text-[12px] font-extrabold leading-4 text-slate-900">{trophy.name}</h3>
    <div className="mt-auto flex items-end justify-between gap-1 pt-3">
      <span className="max-w-[75%] truncate text-[10px] text-slate-400">{trophy.category||trophy.country||trophy.trophy_type||"ID "+trophy.source_id}</span>
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#003399]">{count>0?<><Medal size={12}/>{count}</>:<ChevronRight size={14}/>}</span>
    </div>
   </div>
 </button>;
}
function DetailsField({title,children,wide}){
 return <div className={wide?"sm:col-span-2":""}><label className={label}>{title}</label>{children}</div>;
}
export default function Trophies(){
 const qc=useQueryClient();
 const [catalog,setCatalog]=useState([]);
 const [imageManifest,setImageManifest]=useState(null);
 const [catalogError,setCatalogError]=useState("");
 const [catalogLoading,setCatalogLoading]=useState(true);
 const [query,setQuery]=useState("");
 const [tab,setTab]=useState("verified");
 const [type,setType]=useState("all");
 const [category,setCategory]=useState("all");
 const [expandedGroups,setExpandedGroups]=useState({});
 const [selectedId,setSelectedId]=useState("");
 const [newRecord,setNewRecord]=useState(false);
 const [draft,setDraft]=useState(null);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState("");
 const [honourDraft,setHonourDraft]=useState(null);
 const [recipientQuery,setRecipientQuery]=useState("");
 const [honourSaving,setHonourSaving]=useState(false);
 const [showHonours,setShowHonours]=useState(true);
 const [detailTab,setDetailTab]=useState("Resumen");
 const leaguesQuery=useLeaguesQuery(),countriesQuery=useCountriesQuery();
 const trophyQuery=useQuery({...completeRecordQueryOptions(base44.entities.Trophy,TROPHY_KEY),retry:false});
 const honourQuery=useQuery({...completeRecordQueryOptions(base44.entities.TrophyHonour,HONOURS_KEY),retry:false});

 useEffect(()=>{
  const controller=new AbortController();
  fetch("/trophy-images.json",{signal:controller.signal}).then(r=>r.ok?r.json():null).then(data=>{if(!controller.signal.aborted)setImageManifest(data);}).catch(()=>{});
  return ()=>controller.abort();
 },[]);
 useEffect(()=>{
  const controller=new AbortController();setCatalogLoading(true);
  fetch(TROPHY_CSV_URL,{signal:controller.signal}).then(r=>{if(!r.ok)throw Error("HTTP "+r.status);return r.text();})
    .then(txt=>{const parsed=parseTrophyCatalog(txt);if(parsed.length!==2181)throw Error("El catálogo no contiene las 2.181 entradas esperadas: "+parsed.length);setCatalog(parsed);setCatalogError("");})
    .catch(e=>{if(e?.name!=="AbortError")setCatalogError("No se pudo cargar el catálogo original: "+e.message);})
    .finally(()=>{if(!controller.signal.aborted)setCatalogLoading(false);});
  return ()=>controller.abort();
 },[]);
 const all=useMemo(()=>mergeTrophyCatalog(catalog,rows(trophyQuery.data)),[catalog,trophyQuery.data]);
 const honours=useMemo(()=>rows(honourQuery.data),[honourQuery.data]);
 const honourCounts=useMemo(()=>{const m=new Map();for(const a of honours){const k=String(a.trophy_source_id||"");m.set(k,(m.get(k)||0)+1);}return m;},[honours]);
 const counts=useMemo(()=>({
  total:all.length,
  identified:all.filter(t=>t.identification_status!=="Pending").length,
  pending:all.filter(t=>t.identification_status==="Pending").length,
  created:all.filter(t=>Boolean(t.id)).length
 }),[all]);
 const filtered=useMemo(()=>all.filter(t=>{
  if(tab==="verified"&&t.identification_status==="Pending")return false;
  if(tab==="pending"&&t.identification_status!=="Pending")return false;
  if(tab==="registered"&&!t.id)return false;
  if(type!=="all"&&t.trophy_type!==type)return false;
  if(category!=="all"&&t.category!==category)return false;
  const q=normaliseSearch(query);
  return !q||normaliseSearch([t.name,t.source_name,t.source_id,t.country,t.organizer,t.category].join(" ")).includes(q);
 }).sort((a,b)=>a.name.localeCompare(b.name,"es",{numeric:true})),[all,tab,type,category,query]);
 const grouped=useMemo(()=>groupTrophies(filtered,rows(leaguesQuery.data),rows(countriesQuery.data)),[filtered,leaguesQuery.data,countriesQuery.data]);
 
 const selected=useMemo(()=>all.find(t=>String(t.source_id)===String(selectedId))||null,[all,selectedId]);
 const selectedHonours=useMemo(()=>honours.filter(h=>String(h.trophy_source_id)===String(selectedId)).sort((a,b)=>String(b.season).localeCompare(String(a.season),"es",{numeric:true})),[honours,selectedId]);
 const recipientType=honourDraft?.recipient_type||"Team";
 const candidateQuery=useQuery({...completeRecordQueryOptions(base44.entities[recipientType],["mf-legacy","trophies","recipients",recipientType]),enabled:Boolean(honourDraft),retry:false});
 const candidates=useMemo(()=>rows(candidateQuery.data).filter(x=>normaliseSearch(x.name).includes(normaliseSearch(recipientQuery))).slice(0,8),[candidateQuery.data,recipientQuery]);

 const open=t=>{setSelectedId(String(t.source_id));setDraft({...t});setNewRecord(false);setHonourDraft(null);setError("");setShowHonours(true);setDetailTab("Resumen");};
 const create=()=>{const d=emptyTrophy();setSelectedId("");setDraft(d);setNewRecord(true);setHonourDraft(null);setError("");setDetailTab("Editar");};
 const close=()=>{if(saving||honourSaving)return;setDraft(null);setSelectedId("");setHonourDraft(null);setNewRecord(false);setError("");};
 const save=async e=>{
  e.preventDefault();if(saving)return;setError("");
  const source_id=String(draft.source_id||"").trim(),name=String(draft.name||"").trim();
  if(!source_id||!name||!TROPHY_TYPES.includes(draft.trophy_type)){setError("Introduce ID, nombre y Trophy Type válido.");return;}
  if(!draft.id&&all.some(t=>String(t.source_id)===source_id&&Boolean(t.id))){setError("Ya existe una ficha guardada con este ID.");return;}
  setSaving(true);
  try{
   const payload={source_id,name,trophy_type:draft.trophy_type,category:draft.category||"",country:draft.country||"",organizer:draft.organizer||"",competition_id:draft.competition_id||"",description:draft.description||"",image_url:draft.image_url||"",source_name:draft.source_name||"",identification_status:draft.identification_status==="Pending"?"Pending":draft.identification_status==="Manual"?"Manual":"Verified",is_active:draft.is_active!==false,notes:draft.notes||""};
   if(draft.id)await base44.entities.Trophy.update(draft.id,payload);
   else await base44.entities.Trophy.create(payload);
   await qc.invalidateQueries({queryKey:TROPHY_KEY});setDraft(null);setSelectedId("");setNewRecord(false);
  }catch(e){setError("No se pudo guardar en Base44: "+(e?.message||e));}
  finally{setSaving(false);}
 };
 const startHonour=()=>{setDetailTab("Editar");if(!selected?.id){setError("Guarda primero la ficha del trofeo para registrar sus ganadores.");return;}setError("");setHonourDraft(emptyHonour(selected));setRecipientQuery("");};
 const saveHonour=async e=>{
  e.preventDefault();if(honourSaving||!selected?.id)return;
  setError("");
  if(!honourDraft?.season?.trim()||!honourDraft?.recipient_id){setError("Indica la edición y selecciona un equipo o jugador existente.");return;}
  if(selectedHonours.some(h=>String(h.season)===honourDraft.season.trim()&&String(h.recipient_type)===honourDraft.recipient_type&&String(h.recipient_id)===String(honourDraft.recipient_id))){setError("Ese ganador ya está registrado en esta edición.");return;}
  setHonourSaving(true);
  try{
   const a=honourDraft;
   await base44.entities.TrophyHonour.create({
    trophy_id:String(selected.id),trophy_source_id:String(selected.source_id),season:a.season.trim(),
    recipient_type:a.recipient_type,recipient_id:String(a.recipient_id),recipient_name:String(a.recipient_name||""),
    award_rank:a.award_rank===""?null:Number(a.award_rank),goals:a.goals===""?null:Number(a.goals),
    edition_label:a.edition_label||"",verified:Boolean(a.verified),source_url:a.source_url||"",notes:a.notes||""
   });
   await qc.invalidateQueries({queryKey:HONOURS_KEY});setHonourDraft(null);setRecipientQuery("");
  }catch(e){setError("No se pudo registrar el título: "+(e?.message||e));}finally{setHonourSaving(false);}
 };
 const verifyHonour=async award=>{
  if(!award?.id||!/^https:\/\/[^\s]+$/i.test(String(award.source_url||"")))return;
  if(!window.confirm("¿Has comprobado en la fuente que este equipo ganó el título en esa edición?"))return;
  setError("");setHonourSaving(true);
  try{
   await base44.entities.TrophyHonour.update(award.id,{verified:true});
   await qc.invalidateQueries({queryKey:HONOURS_KEY});
  }catch(e){setError("No se pudo verificar la adjudicación: "+(e?.message||e));}
  finally{setHonourSaving(false);}
 };
 const deleteHonour=async award=>{
  if(!window.confirm("¿Eliminar esta adjudicación histórica? Esta acción no se puede deshacer."))return;
  setError("");
  try{await base44.entities.TrophyHonour.delete(award.id);await qc.invalidateQueries({queryKey:HONOURS_KEY});}
  catch(e){setError("No se pudo eliminar: "+(e?.message||e));}
 };
 const importLocal=async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try{const parsed=parseTrophyCatalog(await file.text());setCatalog(parsed);setCatalogError("");setTab("verified");}
  catch(err){setCatalogError("CSV no válido: "+err.message);}
  e.target.value="";
 };
 return <div className="flex h-full min-h-0 flex-col bg-[#F5F6F8] text-slate-900">
  <div className="flex shrink-0 items-center gap-3 border-b border-slate-200/80 bg-white px-4 py-2 md:px-6">
   <div className="flex shrink-0 items-center gap-2.5"><div className="grid h-9 w-9 place-items-center rounded-xl bg-[#003399] text-white"><Trophy size={19}/></div><div><p className="text-[9px] font-bold uppercase tracking-[.17em] text-slate-400">MF LEGACY / ARCHIVE</p><h1 className="text-lg font-black leading-tight tracking-tight">Trophies</h1></div></div>
   <div className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-[#F8F9FC] px-2.5 py-2">
    <div className="flex flex-wrap items-center justify-between gap-1.5">
     <div className="flex gap-1 overflow-x-auto">{[["verified","Identificados"],["all","Todos"],["pending","Pendientes"],["registered","Con ficha"]].map(([k,v])=><button key={k} type="button" className={cls(tab===k)} onClick={()=>setTab(k)}>{v}</button>)}</div>
     <span className="text-[11px] font-semibold tabular-nums text-slate-400">{filtered.length.toLocaleString("es-ES")} resultados</span>
    </div>
    <div className="mt-1.5 flex flex-wrap gap-1.5">
     <label className="relative min-w-[210px] flex-1"><Search size={16} className="absolute left-3 top-3 text-slate-400"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar nombre, país o ID original…" className={input+" h-8 pl-9 text-xs"}/></label>
     <label className="relative min-w-[155px]"><Filter size={13} className="pointer-events-none absolute left-2.5 top-3.5 text-slate-400"/><select value={type} onChange={e=>setType(e.target.value)} className={input+" h-8 pl-8 text-xs"}><option value="all">Todos los tipos</option>{TROPHY_TYPES.map(v=><option key={v} value={v}>{v}</option>)}</select></label>
     <select value={category} onChange={e=>setCategory(e.target.value)} className={input+" h-8 min-w-[145px] w-auto text-xs"}><option value="all">Todas las categorías</option>{TROPHY_CATEGORIES.map(v=><option key={v} value={v}>{v}</option>)}</select>
     {(query||type!=="all"||category!=="all")&&<button type="button" onClick={()=>{setQuery("");setType("all");setCategory("all");}} className="rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-500" title="Limpiar filtros"><RotateCcw size={15}/></button>}
    </div>
   </div>
   <div className="flex shrink-0 items-center gap-1.5"><label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-50"><Upload size={14}/> Importar CSV<input type="file" accept=".csv,text/csv" className="hidden" onChange={importLocal}/></label><button type="button" onClick={create} className="inline-flex items-center gap-1.5 rounded-lg bg-[#003399] px-2.5 py-2 text-[11px] font-bold text-white hover:bg-[#002977]"><Plus size={14}/> Nuevo trofeo</button></div>
  </div>
  <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3 md:px-7">
   <TrophySyncWorkbench catalog={catalog} trophies={rows(trophyQuery.data)} honours={honours}/>
   {catalogLoading&&catalog.length===0&&<div className="mt-4 rounded-xl bg-white px-5 py-6 text-sm text-slate-500">Cargando catálogo de trofeos…</div>}
   {catalogError&&<div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800"><AlertCircle size={16}/><span>{catalogError} Puedes importarlo manualmente con «Importar CSV».</span></div>}
   {(trophyQuery.isError||honourQuery.isError)&&<div className="mt-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-[11px] text-slate-500">El catálogo puede consultarse; la base de fichas o ganadores aún no está disponible. Los cambios requieren las entidades Trophy y TrophyHonour sincronizadas en Base44.</div>}
   {filtered.length>0?<div className="mt-4 space-y-7">{grouped.map(group=><section key={group.key}>
     <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
      <div className="flex items-baseline gap-2"><h2 className="text-sm font-black uppercase tracking-[.08em] text-slate-900">{group.title}</h2><span className="text-[10px] font-medium text-slate-400">{group.items.length} trofeos</span></div>
      {group.kind==="country"&&<span className="text-[10px] text-slate-400">{group.reputation!=null?"Reputación de liga: "+group.reputation:"Sin reputación de liga registrada"}</span>}
     </div>
     <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-7">{group.items.slice(0,expandedGroups[group.key]?group.items.length:24).map(t=><TrophyCard key={t.source_id} trophy={t} manifest={imageManifest} count={honourCounts.get(String(t.source_id))||0} open={()=>open(t)}/>)}</div>
     {group.items.length>24&&<button type="button" onClick={()=>setExpandedGroups(current=>({...current,[group.key]:!current[group.key]}))} className="mt-3 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-[#003399] hover:bg-slate-50">{expandedGroups[group.key]?"Mostrar menos":"Ver todos los "+group.items.length+" trofeos"}</button>}
    </section>)}</div>:!catalogLoading&&<div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-xs text-slate-500">No hay trofeos con estos filtros.</div>}
   <div className="my-6 flex items-center gap-2 text-[10px] text-slate-400"><ImageIcon size={13}/> Imágenes desde GitHub: <code>public/assets/trophies/ID.png</code>. Los archivos aún no incorporados muestran un icono neutro. Los datos originales no se modifican.</div>
  </div>

  {draft&&<div className="fixed inset-0 z-[9997] flex items-center justify-center bg-slate-950/40 p-3 backdrop-blur-[2px]" onMouseDown={e=>{if(e.target===e.currentTarget)close();}}>
   <div role="dialog" aria-modal="true" aria-label="Ficha de trofeo" className="flex max-h-[min(94vh,920px)] w-full max-w-[1050px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_25px_90px_rgba(0,0,0,.2)]">
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5 md:px-7">
     <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">{newRecord?"NUEVA FICHA":"TROPHY ARCHIVE · "+draft.source_id}</p><h2 className="max-w-[720px] truncate text-lg font-black text-slate-900">{draft.name||"Nuevo trofeo"}</h2></div>
     <button type="button" onClick={close} aria-label="Cerrar ficha del trofeo" className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={19}/></button>
    </div>
    <nav aria-label="Secciones del trofeo" className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-slate-200 bg-white px-4 py-2 md:px-7">
     {(newRecord?["Editar"]:["Resumen","Ediciones","Clubes","Jugadores","Editar"]).map(section=>
      <button key={section} type="button" onClick={()=>{setDetailTab(section);setError("");}}
       aria-current={detailTab===section?"page":undefined}
       className={"shrink-0 rounded-lg px-3 py-2 text-[11px] font-bold transition "+(detailTab===section?"bg-[#003399] text-white":"text-slate-500 hover:bg-slate-100 hover:text-slate-800")}>
       {section}
      </button>
     )}
    </nav>
    {detailTab==="Editar"?<div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[1fr_1.05fr] lg:overflow-hidden">
     <div className="min-h-0 overflow-y-auto border-b border-slate-100 p-5 lg:border-b-0 lg:border-r md:p-7">
      <div className="mb-4 flex items-center gap-5 rounded-xl bg-[#F5F7FA] p-4">
       <TrophyArtwork trophy={draft} manifest={imageManifest} className="h-28 w-28 shrink-0"/>
       <div className="min-w-0"><p className="text-xs font-black text-slate-800">{draft.name}</p><p className="mt-1 text-[11px] text-slate-500">{draft.trophy_type||"Trophy Type pendiente"} · {draft.category||"Sin categoría"}</p><p className="mt-2 break-all font-mono text-[10px] text-slate-400">ID {draft.source_id}</p></div>
      </div>
      <form id="trophy-form" onSubmit={save} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
       <DetailsField title="ID original"><input className={input} value={draft.source_id||""} disabled={!newRecord} onChange={e=>setDraft(v=>({...v,source_id:e.target.value}))} required/></DetailsField>
       <DetailsField title="Trophy Type *"><select className={input} required value={draft.trophy_type||""} onChange={e=>setDraft(v=>({...v,trophy_type:e.target.value}))}><option value="">Seleccionar tipo</option>{TROPHY_TYPES.map(v=><option value={v} key={v}>{v}</option>)}</select></DetailsField>
       <DetailsField title="Nombre oficial" wide><input className={input} value={draft.name||""} required onChange={e=>setDraft(v=>({...v,name:e.target.value}))}/></DetailsField>
       <DetailsField title="Categoría"><select className={input} value={draft.category||""} onChange={e=>setDraft(v=>({...v,category:e.target.value}))}><option value="">Sin clasificar</option>{TROPHY_CATEGORIES.map(v=><option key={v} value={v}>{v}</option>)}</select></DetailsField>
       <DetailsField title="País / región"><input className={input} value={draft.country||""} onChange={e=>setDraft(v=>({...v,country:e.target.value}))} placeholder="Sin especificar"/></DetailsField>
       <DetailsField title="Organizador"><input className={input} value={draft.organizer||""} onChange={e=>setDraft(v=>({...v,organizer:e.target.value}))} placeholder="FIFA, UEFA, federación…"/></DetailsField>
       <DetailsField title="ID de competición"><input className={input} value={draft.competition_id||""} onChange={e=>setDraft(v=>({...v,competition_id:e.target.value}))} placeholder="Opcional · League ID"/></DetailsField>
       <DetailsField title="Imagen (URL opcional)" wide><input className={input} value={draft.image_url||""} onChange={e=>setDraft(v=>({...v,image_url:e.target.value}))} placeholder={trophyImageUrl({source_id:draft.source_id})}/></DetailsField>
       <DetailsField title="Descripción" wide><textarea className={input+" min-h-20 py-2"} value={draft.description||""} onChange={e=>setDraft(v=>({...v,description:e.target.value}))} placeholder="Historia, relevancia o características del trofeo…"/></DetailsField>
       <DetailsField title="Notas privadas" wide><textarea className={input+" min-h-16 py-2"} value={draft.notes||""} onChange={e=>setDraft(v=>({...v,notes:e.target.value}))} placeholder="Pendientes de investigación…"/></DetailsField>
       <div className="sm:col-span-2 flex items-center justify-between gap-3 pt-2"><span className="text-[10px] text-slate-400">{draft.source_path||"Imagen enlazable desde GitHub por ID original"}</span><button type="submit" disabled={saving} className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[#003399] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"><Save size={15}/>{saving?"Guardando…":"Guardar ficha"}</button></div>
      </form>
     </div>
     <div className="min-h-0 overflow-y-auto p-5 md:p-7">
      <div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.17em] text-slate-400">HISTORIAL VERIFICABLE</p><h3 className="mt-1 text-base font-black">Ediciones y ganadores</h3></div><button type="button" onClick={startHonour} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-700 hover:bg-slate-50"><Plus size={14}/> Añadir</button></div>
      {error&&<p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-xs font-medium text-red-700">{error}</p>}
      {honourDraft?<form onSubmit={saveHonour} className="mb-4 space-y-3 rounded-xl border border-blue-200 bg-[#F8FAFF] p-4">
       <div className="flex items-center justify-between"><span className="text-xs font-black">Añadir campeón / premiado</span><button type="button" onClick={()=>setHonourDraft(null)}><X size={15}/></button></div>
       <div className="grid grid-cols-2 gap-3"><DetailsField title="Temporada o edición *"><input className={input} value={honourDraft.season} placeholder="2024/2025" required onChange={e=>setHonourDraft(v=>({...v,season:e.target.value}))}/></DetailsField><DetailsField title="Ganador"><select className={input} value={honourDraft.recipient_type} onChange={e=>{setHonourDraft(v=>({...v,recipient_type:e.target.value,recipient_id:"",recipient_name:""}));setRecipientQuery("");}}><option value="Team">Equipo</option><option value="Player">Jugador</option></select></DetailsField></div>
       <DetailsField title="Buscar entidad de MF Legacy *"><input className={input} value={recipientQuery} onChange={e=>setRecipientQuery(e.target.value)} placeholder={"Buscar "+(recipientType==="Team"?"club":"jugador")+"…"}/></DetailsField>
       {honourDraft.recipient_id?<div className="flex items-center justify-between rounded-lg bg-blue-50 p-2 text-xs text-blue-800"><span>Seleccionado: <strong>{honourDraft.recipient_name}</strong></span><button type="button" onClick={()=>setHonourDraft(v=>({...v,recipient_id:"",recipient_name:""}))}><X size={14}/></button></div>:
        <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-200 bg-white">{candidateQuery.isLoading?<p className="px-3 py-3 text-xs text-slate-400">Buscando entidades…</p>:candidates.map(item=><button key={item.id} type="button" className="flex w-full items-center gap-2 border-b border-slate-50 px-3 py-2 text-left text-xs hover:bg-slate-50" onClick={()=>{setHonourDraft(v=>({...v,recipient_id:String(item.id),recipient_name:item.name}));setRecipientQuery(item.name);}}><Users size={13} className="text-slate-400"/>{item.name}</button>)}{!candidateQuery.isLoading&&!candidates.length&&<p className="p-3 text-xs text-slate-400">No se han encontrado coincidencias.</p>}</div>}
       <div className="grid grid-cols-2 gap-3"><DetailsField title="Puesto (opcional)"><input className={input} type="number" min="1" value={honourDraft.award_rank} onChange={e=>setHonourDraft(v=>({...v,award_rank:e.target.value}))}/></DetailsField><DetailsField title="Goles (opcional)"><input className={input} type="number" min="0" value={honourDraft.goals} onChange={e=>setHonourDraft(v=>({...v,goals:e.target.value}))}/></DetailsField></div>
       <DetailsField title="Fuente verificable"><input className={input} type="url" value={honourDraft.source_url} onChange={e=>setHonourDraft(v=>({...v,source_url:e.target.value}))} placeholder="https://…"/></DetailsField>
       <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={honourDraft.verified} onChange={e=>setHonourDraft(v=>({...v,verified:e.target.checked}))}/> Resultado confirmado con fuente</label>
       <button type="submit" disabled={honourSaving} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#003399] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"><Save size={14}/>{honourSaving?"Guardando…":"Registrar adjudicación"}</button>
      </form>:null}
      {selectedHonours.length===0?<div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center"><Medal size={24} className="mx-auto text-slate-300"/><p className="mt-3 text-xs font-semibold text-slate-500">Sin ganadores registrados</p><p className="mt-1 text-[11px] leading-5 text-slate-400">Los títulos históricos no se generan automáticamente ni se asignan a jugadores sin evidencias.</p></div>:
       <div className="space-y-2">{selectedHonours.map(a=><div key={a.id} className="flex items-start justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3"><div><div className="flex items-center gap-2 text-xs font-extrabold text-slate-800">{a.season}<span className={"rounded px-1.5 py-0.5 text-[9px] font-bold "+(a.verified?"bg-emerald-50 text-emerald-700":"bg-slate-100 text-slate-400")}>{a.verified?"VERIFICADO":"SIN VERIFICAR"}</span></div><p className="mt-1 text-xs text-slate-600">{a.recipient_name||a.recipient_id}{a.award_rank?" · "+a.award_rank+".º":""}{a.goals!=null?" · "+a.goals+" goles":""}</p>{a.source_url&&<a className="mt-1 inline-flex items-center gap-1 text-[10px] text-blue-700 hover:underline" target="_blank" rel="noreferrer" href={a.source_url}><Link2 size={10}/> Fuente</a>}</div>{!a.verified&&a.source_url&&<button type="button" disabled={honourSaving} className="rounded-lg border border-emerald-200 px-2 py-1 text-[10px] font-semibold text-emerald-700 disabled:opacity-50" onClick={()=>verifyHonour(a)}>Verificar</button>}<button type="button" className="p-1 text-slate-300 hover:text-red-600" title="Eliminar adjudicación" onClick={()=>deleteHonour(a)}><Trash2 size={15}/></button></div>)}</div>}
      <div className="mt-4 rounded-xl bg-slate-50 p-3 text-[11px] leading-5 text-slate-500">Los palmarés de Teams y Players podrán calcularse utilizando <strong>TrophyHonour</strong> por ID, sin duplicar registros.</div>
     </div>
    </div>:<TrophyDetailVisual
      key={selectedId} trophy={selected||draft} manifest={imageManifest}
      tab={detailTab} honours={selectedHonours} onEdit={()=>setDetailTab("Editar")}
      onAdd={startHonour} onVerify={verifyHonour} honourSaving={honourSaving}
    />}
   </div>
  </div>}
 </div>;
}
