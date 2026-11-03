import React,{useEffect,useMemo,useState} from "react";
import {useSearchParams} from "react-router-dom";
import {useQuery,useQueryClient} from "@tanstack/react-query";
import {Search,Trophy,Plus,ChevronRight,ChevronDown,X,Save,Filter,AlertCircle,Trash2,Upload,Medal,Users,Link2,RotateCcw,Globe2} from "lucide-react";
import {base44} from "@/api/base44Client";
import {completeRecordQueryOptions} from "@/utils/entityRecords";
import {useLeaguesQuery,useCountriesQuery,useTeamsQuery} from "@/hooks/useSharedData";
import {groupTrophies} from "@/utils/trophyGrouping";
import {trophyViewGroups,TROPHY_CATALOG_VIEW_MODES} from "@/utils/trophyViews";
import TrophyClubCatalogView from "@/components/trophies/TrophyClubCatalogView";
import {countryTrophyIdsFromSections,verifiedTeamTrophyIds} from "@/utils/trophyCatalogFilters";
import TrophySyncWorkbench from "@/components/trophies/TrophySyncWorkbench";
import TeamSearchPicker from "@/components/trophies/TeamSearchPicker";
import CountrySearchPicker from "@/components/trophies/CountrySearchPicker";
import TrophyCountryPicker from "@/components/trophies/TrophyCountryPicker";
import {estimateTrophyReputation,REPUTATION_METHOD} from "@/utils/trophyResearch";
import TrophyDetailVisual from "@/components/trophies/TrophyDetailVisual";
import TrophyHistoricalEditor from "@/components/trophies/TrophyHistoricalEditor";
import TrophyImageManager from "@/components/trophies/TrophyImageManager";
import TrophyArchiveOverview from "@/components/trophies/TrophyArchiveOverview";
import TrophyReviewCenter from "@/components/trophies/TrophyReviewCenter";
import {expandTrophyVisualCards,isFifaClubWorldCup,fifaCwcVariantForSeason} from "@/utils/trophyVisualVariants";
import {TROPHY_CSV_URL,TROPHY_TYPES,TROPHY_CATEGORIES,parseTrophyCatalog,mergeTrophyCatalog,trophyImageUrl,normaliseSearch} from "@/utils/trophyCatalog";
import {statusOf,trophyImageShouldHide} from "@/utils/trophyImages";

const TROPHY_KEY=["mf-legacy","trophies","definitions"];
const HONOURS_KEY=["mf-legacy","trophies","honours"];
const emptyTrophy=()=>({source_id:"",name:"",trophy_type:"",category:"",country:"",country_id:"",country_resolution:"pending",region:"",reputation:"",reputation_method:REPUTATION_METHOD,reputation_basis:"",research_source_url:"",organizer:"",competition_id:"",description:"",image_url:"",image_override_url:"",image_status:"auto",image_source_type:"catalog",image_source_reference:"",image_notes:"",image_last_reviewed_at:"",identification_status:"Manual",is_active:true});
const emptyHonour=(trophy)=>({season:"",recipient_type:trophy?.trophy_type==="Individual Trophy"?"Player":"Team",recipient_id:"",recipient_name:"",award_rank:"",goals:"",edition_label:"",verified:false,source_url:"",notes:""});
const rows=result=>Array.isArray(result)?result:(result?.items||result?.data||[]);
const input="h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-[#003399] focus:ring-2 focus:ring-[#003399]/10";
const label="mb-1.5 block text-[11px] font-bold uppercase tracking-[.12em] text-slate-500";

function TrophyArtwork({trophy,manifest,className="h-24 w-full",onError}){
 const [bad,setBad]=useState(false);
 useEffect(()=>setBad(false),[trophy?.source_id,trophy?.image_url,trophy?.image_override_url,trophy?.image_status,trophy?.visual_variant_id]);
 return <div className={"flex items-center justify-center overflow-hidden "+className}>
   {bad||trophyImageShouldHide(trophy)?<Trophy size={42} strokeWidth={1.1} className="text-slate-300"/>:<img loading="lazy" src={trophyImageUrl(trophy,manifest)} alt="" className="h-full w-full object-contain drop-shadow-[0_8px_10px_rgba(15,23,42,0.10)]" onError={()=>{setBad(true);onError?.();}}/>}
 </div>;
}
function Metric({value,label:caption,icon:Icon}){
 return <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3">
  <div className="flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-400">{caption}</span><Icon size={14} className="text-slate-300"/></div>
  <div className="mt-2 text-xl font-black tabular-nums text-slate-900">{value}</div>
 </div>;
}
function TrophyCard({trophy,manifest,open,count,country}){
 const editorial=estimateTrophyReputation(trophy);
 return <button type="button" onClick={open} className="group relative flex min-h-[195px] w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-left transition hover:-translate-y-0.5 hover:border-[#003399]/30 hover:shadow-[0_12px_35px_rgba(20,35,65,.09)]">
   <div className="relative flex h-32 items-center justify-center bg-gradient-to-b from-[#F8F9FC] to-white px-5 pt-3">
    <TrophyArtwork trophy={trophy} manifest={manifest} className="h-[110px] w-full"/>
    {trophy.identification_status==="Pending"&&<span className="absolute right-2 top-2 rounded-md bg-amber-50 px-1.5 py-1 text-[9px] font-bold text-amber-700" title="La correspondencia entre imagen, nombre e ID de FM24 necesita revisión">REVISAR ID</span>}
    {trophy.id&&<span className="absolute left-2 top-2 rounded-md bg-blue-50 px-1.5 py-1 text-[9px] font-bold text-blue-800">FICHA</span>}
    {trophy.visual_variant_years&&<span className="absolute bottom-1.5 left-2 rounded-md bg-slate-900/75 px-1.5 py-0.5 text-[9px] font-bold text-white">{trophy.visual_variant_years}</span>}
   </div>
   <div className="flex flex-1 flex-col px-3.5 pb-3.5 pt-1">
    <h3 title={trophy.name} className="line-clamp-2 text-[12px] font-extrabold leading-4 text-slate-900">{trophy.name}</h3>
    <div className="mt-auto flex items-end justify-between gap-1 pt-3">
      <span className="flex min-w-0 items-center gap-1 text-[10px] text-slate-400">{country?.flag&&<img loading="lazy" src={country.flag} alt={country.name} className="h-3.5 w-5 shrink-0 rounded-sm object-cover"/>}<span className="truncate">{country?.name||trophy.category||trophy.country||trophy.trophy_type||"ID "+trophy.source_id}</span></span><span className="shrink-0 rounded bg-slate-100 px-1 py-0.5 text-[9px] font-bold tabular-nums text-slate-600" title="Reputación editorial MF LEGACY, no oficial de Football Manager">{editorial.score}/200</span>
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#003399]">{count>0?<><Medal size={12}/>{count}</>:<ChevronRight size={14}/>}</span>
    </div>
   </div>
 </button>;
}
function DetailsField({title,children,wide}){
 return <div className={wide?"sm:col-span-2":""}><label className={label}>{title}</label>{children}</div>;
}
export default function Trophies(){
 const [searchParams]=useSearchParams();
 const rawTrophyView=searchParams.get("view");
 const viewMode=TROPHY_CATALOG_VIEW_MODES.includes(rawTrophyView)?rawTrophyView:"gallery";
 const qc=useQueryClient();
 const [catalog,setCatalog]=useState([]);
 const [imageManifest,setImageManifest]=useState(null);
 const [catalogError,setCatalogError]=useState("");
 const [catalogLoading,setCatalogLoading]=useState(true);
 const [query,setQuery]=useState("");
 const [section,setSection]=useState("catalog");
 const [syncPhase,setSyncPhase]=useState("champions");
 const [tab,setTab]=useState("verified");
 const [type,setType]=useState("all");
 const [category,setCategory]=useState("all");
 const [sortMode,setSortMode]=useState("name");
 const [showFilters,setShowFilters]=useState(false);
 const [focusedGroup,setFocusedGroup]=useState("");
 const [showAllViewGroups,setShowAllViewGroups]=useState(false);
 const [countryFilter,setCountryFilter]=useState("all");
 const [teamFilter,setTeamFilter]=useState("");
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
 const [editorPane,setEditorPane]=useState("historical");
 const leaguesQuery=useLeaguesQuery(),countriesQuery=useCountriesQuery(),teamsQuery=useTeamsQuery();
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
    .then(txt=>{const parsed=parseTrophyCatalog(txt);if(parsed.length!==2180)throw Error("El catálogo de GitHub no contiene las 2.180 entradas esperadas: "+parsed.length);setCatalog(parsed);setCatalogError("");})
    .catch(e=>{if(e?.name!=="AbortError")setCatalogError("No se pudo cargar el catálogo de GitHub: "+e.message);})
    .finally(()=>{if(!controller.signal.aborted)setCatalogLoading(false);});
  return ()=>controller.abort();
 },[]);
 const all=useMemo(()=>mergeTrophyCatalog(catalog,rows(trophyQuery.data)),[catalog,trophyQuery.data]);
 const countryRecords=useMemo(()=>rows(countriesQuery.data),[countriesQuery.data]);
 const countryMap=useMemo(()=>new Map(countryRecords.map(country=>[String(country.id),country])),[countryRecords]);
 const visualCatalog=useMemo(()=>expandTrophyVisualCards(all),[all]);
 const honours=useMemo(()=>rows(honourQuery.data),[honourQuery.data]);
 const honourCounts=useMemo(()=>{const m=new Map();for(const a of honours){const k=String(a.trophy_source_id||"");m.set(k,(m.get(k)||0)+1);}return m;},[honours]);
 // The country groups are the same ones used by the gallery: no guessed nationality from club names.
 const countrySections=useMemo(()=>groupTrophies(all,rows(leaguesQuery.data),rows(countriesQuery.data)),[all,leaguesQuery.data,countriesQuery.data]);
 const countryOptions=useMemo(()=>{
  const byKey=new Map(countrySections.filter(g=>g.kind==="country").map(group=>[group.key,{value:group.key,label:group.title,count:group.items.length}]));
  for(const country of countryRecords){const key="country:"+normaliseSearch(country.name);const option=byKey.get(key);byKey.set(key,{value:key,label:country.name,count:option?.count||0,flag:country.flag||"",code:country.code||""});}
  return [...byKey.values()].sort((a,b)=>a.label.localeCompare(b.label,"es"));
 },[countrySections,countryRecords]);
 const activeFilterCount=[type!=="all",category!=="all",countryFilter!=="all",Boolean(teamFilter&&viewMode!=="clubs")].filter(Boolean).length;
 useEffect(()=>{setFocusedGroup("");setShowAllViewGroups(false);setExpandedGroups({});setTab("all");setTeamFilter("");},[viewMode]);
 const clearFilters=()=>{setType("all");setCategory("all");setCountryFilter("all");setTeamFilter("");setSortMode("name");};
 const countryTrophyIds=useMemo(()=>countryTrophyIdsFromSections(countrySections,countryFilter),[countrySections,countryFilter]);
 // A team's filter means verified trophies actually awarded to that exact Base44 Team.
 const verifiedTeamTrophies=useMemo(()=>verifiedTeamTrophyIds(honours,teamFilter),[honours,teamFilter]);
 const counts=useMemo(()=>({
  total:all.length,
  identified:all.filter(t=>t.identification_status!=="Pending").length,
  pending:all.filter(t=>t.identification_status==="Pending").length,
  created:all.filter(t=>Boolean(t.id)).length
 }),[all]);
 const filtered=useMemo(()=>visualCatalog.filter(t=>{
  if(tab==="verified"&&t.identification_status==="Pending")return false;
  if(tab==="pending"&&t.identification_status!=="Pending")return false;
  if(tab==="registered"&&!t.id)return false;
  if(type!=="all"&&t.trophy_type!==type)return false;
  if(category!=="all"&&t.category!==category)return false;
  if(countryTrophyIds&&!countryTrophyIds.has(String(t.source_id)))return false;
  if(viewMode!=="clubs"&&teamFilter&&!verifiedTeamTrophies.has(String(t.source_id)))return false;
  const q=normaliseSearch(query);
  return !q||normaliseSearch([t.name,t.source_name,t.source_id,t.country,countryMap.get(String(t.country_id||""))?.name,t.region,t.organizer,t.category].join(" ")).includes(q);
 }).sort((a,b)=>a.name.localeCompare(b.name,"es",{numeric:true})),[visualCatalog,tab,type,category,query,countryTrophyIds,teamFilter,verifiedTeamTrophies,countryMap,viewMode]);
 const grouped=useMemo(()=>trophyViewGroups(filtered,viewMode,rows(leaguesQuery.data),countryRecords,sortMode),[filtered,viewMode,leaguesQuery.data,countryRecords,sortMode]);
 const selectableGroupView=viewMode==="countries"||viewMode==="leagues";
 const visibleModeGroups=selectableGroupView?(focusedGroup?grouped.filter(g=>g.key===focusedGroup):[]):grouped;
 const allowedClubSourceIds=useMemo(()=>new Set(filtered.map(t=>String(t.source_id))),[filtered]);
 useEffect(()=>{if(focusedGroup&&!grouped.some(group=>group.key===focusedGroup))setFocusedGroup("");},[focusedGroup,grouped]);
 const teamSelectionName=rows(teamsQuery.data).find(t=>String(t.id)===String(teamFilter))?.name||"";
 
 const selected=useMemo(()=>all.find(t=>String(t.source_id)===String(selectedId))||null,[all,selectedId]);
 const selectedHonours=useMemo(()=>honours.filter(h=>String(h.trophy_source_id)===String(selectedId)).sort((a,b)=>String(b.season).localeCompare(String(a.season),"es",{numeric:true})),[honours,selectedId]);
 const recipientType=honourDraft?.recipient_type||"Team";
 const candidateQuery=useQuery({...completeRecordQueryOptions(base44.entities[recipientType],["mf-legacy","trophies","recipients",recipientType]),enabled:Boolean(honourDraft),retry:false});
 const candidates=useMemo(()=>rows(candidateQuery.data).filter(x=>normaliseSearch(x.name).includes(normaliseSearch(recipientQuery))).slice(0,8),[candidateQuery.data,recipientQuery]);

 const open=t=>{const canonical=all.find(row=>String(row.source_id)===String(t.source_id))||t;
  setSelectedId(String(t.source_id));setDraft({...canonical,reputation:canonical.reputation??estimateTrophyReputation(canonical).score,reputation_basis:canonical.reputation_basis||estimateTrophyReputation(canonical).basis,reputation_method:canonical.reputation_method||REPUTATION_METHOD,visual_variant_id:t.visual_variant_id||""});setNewRecord(false);setHonourDraft(null);setError("");setShowHonours(true);setEditorPane("historical");setDetailTab("Resumen");};
 const create=()=>{const d=emptyTrophy();setSelectedId("");setDraft(d);setNewRecord(true);setHonourDraft(null);setError("");setEditorPane("historical");setDetailTab("Editar");};
 const close=()=>{if(saving||honourSaving)return;setDraft(null);setSelectedId("");setHonourDraft(null);setNewRecord(false);setError("");};
 const save=async e=>{
  e.preventDefault();if(saving)return;setError("");
  const source_id=String(draft.source_id||"").trim(),name=String(draft.name||"").trim();
  if(!source_id||!name||!TROPHY_TYPES.includes(draft.trophy_type)){setError("Introduce ID, nombre y Trophy Type válido.");return;}
  if(!draft.id&&all.some(t=>String(t.source_id)===source_id&&Boolean(t.id))){setError("Ya existe una ficha guardada con este ID.");return;}
  setSaving(true);
  try{
   if(draft.reputation!==""&&draft.reputation!=null&&!Number.isFinite(Number(draft.reputation))){setError("La reputación debe ser un número de 0 a 200.");return;}
   const payload={source_id,name,trophy_type:draft.trophy_type,category:draft.category||"",country:draft.country||"",organizer:draft.organizer||"",competition_id:draft.competition_id||"",description:draft.description||"",image_url:draft.image_url||"",image_override_url:draft.image_override_url||"",image_status:statusOf(draft),image_source_type:draft.image_source_type||"catalog",image_source_reference:draft.image_source_reference||"",image_notes:draft.image_notes||"",image_last_reviewed_at:draft.image_last_reviewed_at||"",source_name:draft.source_name||"",identification_status:draft.identification_status==="Pending"?"Pending":draft.identification_status==="Manual"?"Manual":"Verified",is_active:draft.is_active!==false,notes:draft.notes||"",country_id:draft.country_id||"",country_resolution:draft.country_resolution||"pending",region:draft.region||"",reputation:draft.reputation===""||draft.reputation==null?null:Math.min(200,Math.max(0,Math.round(Number(draft.reputation)))),reputation_basis:draft.reputation_basis||"",reputation_method:draft.reputation_method||REPUTATION_METHOD,research_source_url:draft.research_source_url||""};
   if(draft.id)await base44.entities.Trophy.update(draft.id,payload);
   else await base44.entities.Trophy.create(payload);
   await qc.invalidateQueries({queryKey:TROPHY_KEY});setDraft(null);setSelectedId("");setNewRecord(false);
  }catch(e){setError("No se pudo guardar en Base44: "+(e?.message||e));}
  finally{setSaving(false);}
 };
 const saveImage=async imageData=>{
  if(!draft?.source_id)throw Error("Guarda antes el ID original del trofeo.");
  const current=rows(trophyQuery.data).find(row=>String(row.source_id)===String(draft.source_id));
  if(current?.id){await base44.entities.Trophy.update(current.id,imageData);}
  else{
   const others={source_id:String(draft.source_id),name:String(draft.name||"Trofeo sin identificar"),trophy_type:TROPHY_TYPES.includes(draft.trophy_type)?draft.trophy_type:"Team Trophy",category:draft.category||"",identification_status:draft.identification_status==="Pending"?"Pending":draft.identification_status==="Verified"?"Verified":"Manual",is_active:true};
   await base44.entities.Trophy.create({...others,...imageData});
  }
  setDraft(old=>({...old,...imageData,id:old.id||current?.id||old.id}));
  await qc.invalidateQueries({queryKey:TROPHY_KEY});
 };
 const startHonour=()=>{setDetailTab("Editar");setEditorPane("honours");if(!selected?.id){setError("Guarda primero la ficha del trofeo para registrar sus ganadores.");return;}setError("");setHonourDraft(emptyHonour(selected));setRecipientQuery("");};
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
 return <div className="mf-trophies flex h-full min-h-0 flex-col bg-[#F5F6F8] text-slate-900">
  <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3 md:px-7">
   <div className="flex items-center gap-2.5">
    <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#003399] text-white"><Trophy size={19}/></span>
    <span><span className="block text-[9px] font-bold uppercase tracking-[.17em] text-slate-400">MF LEGACY / ARCHIVE</span><strong className="block text-lg font-black leading-tight">Trophies</strong></span>
   </div>
   <nav aria-label="Vistas de Trophies" className="flex shrink-0 items-center gap-1 rounded-xl bg-slate-100 p-1">
    {[["catalog","Catálogo"],["palmares","Palmarés"],["sync","Sincronizar"],["review","Revisar"]].map(([key,name])=>
     <button key={key} type="button" aria-current={section===key?"page":undefined}
      onClick={()=>setSection(key)}
      className={"rounded-lg px-4 py-2 text-[11px] font-bold transition "+(section===key?"bg-[#003399] text-white shadow-sm":"text-slate-500 hover:bg-white/70 hover:text-slate-900")}>{name}</button>)}
   </nav>
  </header>
  {section==="catalog"&&<div className="relative z-20 shrink-0 border-b border-slate-200 bg-white px-4 py-2 md:px-7">
   <div className="flex w-full flex-wrap items-center gap-2">
    <div aria-label="Estado del catálogo" className="flex max-w-full shrink-0 items-center gap-0.5 overflow-x-auto rounded-lg bg-slate-100/80 p-0.5">
     {[["all","Todos"],["verified","Identificados"],["pending","Revisar ID"],["registered","Con ficha"]].map(([key,title])=>
      <button key={key} type="button" aria-pressed={tab===key} onClick={()=>setTab(key)} className={"shrink-0 rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition "+(tab===key?"bg-[#003399] text-white shadow-sm":"text-slate-500 hover:bg-white hover:text-slate-800")}>{title}</button>)}
    </div>
    <label className="relative min-w-[190px] flex-[1_1_280px]">
     <Search size={15} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
     <input aria-label="Buscar trofeos" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar trofeo, país o ID…" className={input+" h-9 pl-9 pr-9 text-xs"}/>
     {query&&<button type="button" onClick={()=>setQuery("")} aria-label="Borrar búsqueda" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={13}/></button>}
    </label>
    <button type="button" aria-expanded={showFilters} aria-controls="trophy-advanced-filters" onClick={()=>setShowFilters(v=>!v)}
     className={"inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-[11px] font-semibold transition "+(showFilters||activeFilterCount?"border-blue-200 bg-blue-50 text-[#003399]":"border-slate-200 bg-white text-slate-600 hover:bg-slate-50")}>
     <Filter size={14}/><span>Filtros</span>{activeFilterCount>0&&<span className="grid min-w-[17px] place-items-center rounded bg-[#003399] px-1 py-0.5 text-[10px] leading-none text-white">{activeFilterCount}</span>}
     <ChevronDown size={13} className={"transition-transform "+(showFilters?"rotate-180":"")}/>
    </button>
    {activeFilterCount>0&&!showFilters&&<button type="button" onClick={clearFilters} aria-label="Restablecer filtros" title="Limpiar filtros" className="grid h-9 w-8 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-800"><RotateCcw size={14}/></button>}
    <span role="status" className="ml-auto shrink-0 text-[11px] font-medium tabular-nums text-slate-400">{viewMode==="clubs"?"Por club":viewMode==="leagues"?grouped.reduce((sum,g)=>sum+g.items.length,0).toLocaleString("es-ES")+" ligas":filtered.length.toLocaleString("es-ES")+" resultados"}</span>
    <label title="Importar catálogo CSV" className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50" aria-label="Importar catálogo CSV">
     <Upload size={15}/><span className="sr-only">Importar catálogo CSV</span><input type="file" accept=".csv,text/csv" className="hidden" onChange={importLocal}/>
    </label>
    <button type="button" onClick={create} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[#003399] px-3 text-[11px] font-bold text-white transition hover:bg-[#002977]"><Plus size={15}/> Nuevo trofeo</button>
   </div>
   {showFilters&&<div id="trophy-advanced-filters" className="mt-2 rounded-lg border border-slate-200 bg-[#F8F9FC] p-3">
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
     <label className="min-w-0"><span className="mb-1 block text-[10px] font-semibold text-slate-500">Tipo</span>
      <select value={type} onChange={e=>setType(e.target.value)} className={input+" h-9 text-xs"}><option value="all">Todos los tipos</option>{TROPHY_TYPES.map(v=><option key={v} value={v}>{v}</option>)}</select>
     </label>
     <label className="min-w-0"><span className="mb-1 block text-[10px] font-semibold text-slate-500">Categoría</span>
      <select value={category} onChange={e=>setCategory(e.target.value)} className={input+" h-9 text-xs"}><option value="all">Todas</option>{TROPHY_CATEGORIES.map(v=><option key={v} value={v}>{v}</option>)}</select>
     </label>
     <div className="min-w-0"><span className="mb-1 block text-[10px] font-semibold text-slate-500">País</span>
      <CountrySearchPicker options={[{value:"all",label:"Todos los países"},...countryOptions,{value:"international",label:"Internacionales · confederaciones"},{value:"unclassified",label:"Sin país confirmado"}]} value={countryFilter} onChange={setCountryFilter}/>
     </div>
     {viewMode!=="clubs"&&<div className="min-w-0"><span className="mb-1 block text-[10px] font-semibold text-slate-500">Club campeón verificado</span>
      <TeamSearchPicker teams={rows(teamsQuery.data)} value={teamFilter} onChange={setTeamFilter} loading={teamsQuery.isLoading} error={teamsQuery.isError} ariaLabel="Filtrar por club campeón verificado" placeholder="Buscar club…"/>
     </div>}
     <label className="min-w-0"><span className="mb-1 block text-[10px] font-semibold text-slate-500">Orden</span>
      <select aria-label="Ordenar trofeos" value={sortMode} onChange={e=>setSortMode(e.target.value)} className={input+" h-9 text-xs"}>
       <option value="name">Nombre (A–Z)</option><option value="reputation_desc">Mayor reputación</option><option value="reputation_asc">Menor reputación</option>
      </select>
     </label>
    </div>
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
     <p className="text-[10px] text-slate-400">{teamFilter?"Solo títulos verificados de "+(teamSelectionName||"este club"):"El filtro de club solo muestra títulos ganados y verificados."}</p>
     <button type="button" disabled={!activeFilterCount&&sortMode==="name"} onClick={clearFilters} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-semibold text-slate-500 hover:bg-slate-200/70 disabled:cursor-default disabled:opacity-40"><RotateCcw size={12}/> Restablecer</button>
    </div>
   </div>}
  </div>}
  <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3 md:px-7">
   {section==="catalog"&&<>
   {catalogLoading&&catalog.length===0&&<div className="mt-4 rounded-xl bg-white px-5 py-6 text-sm text-slate-500">Cargando catálogo de trofeos…</div>}
   {catalogError&&<div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800"><AlertCircle size={16}/><span>{catalogError} Puedes importarlo manualmente con «Importar CSV».</span></div>}
   {(trophyQuery.isError||honourQuery.isError)&&<div className="mt-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-[11px] text-slate-500">El catálogo puede consultarse; la base de fichas o ganadores aún no está disponible. Los cambios requieren las entidades Trophy y TrophyHonour sincronizadas en Base44.</div>}
   {teamFilter&&honourQuery.isLoading&&<div className="mt-3 text-xs text-slate-500">Consultando los títulos del equipo…</div>}
   {viewMode==="clubs"?<TrophyClubCatalogView teams={rows(teamsQuery.data)} honours={honours} catalog={all} manifest={imageManifest} onOpen={open} Card={TrophyCard} allowedIds={allowedClubSourceIds} loading={teamsQuery.isLoading} error={teamsQuery.isError}/>:
   <>
    {(viewMode==="reputation"||viewMode==="scope")&&<p className="mt-3 text-[11px] leading-4 text-slate-500">{viewMode==="reputation"?"Reputación editorial de MF LEGACY (0–200), estimada cuando no existe valoración individual.":"Ámbito aproximado según competición, organizador y país vinculado; los casos dudosos permanecen sin determinar."}</p>}
    {selectableGroupView&&grouped.length>0&&<div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
     <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
      <div><p className="text-xs font-black text-slate-800">{viewMode==="leagues"?"Ligas por país":"Trofeos por país"}</p><p className="mt-0.5 text-[10px] text-slate-400">Pulsa un país para ver sus {viewMode==="leagues"?"ligas":"trofeos"}. Cada competición conserva su ficha original.</p></div>
      {focusedGroup&&<button type="button" onClick={()=>setFocusedGroup("")} className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-semibold text-[#003399]">Cambiar país</button>}
     </div>
     <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {(showAllViewGroups?grouped:grouped.slice(0,18)).map(group=>{
       const country=countryRecords.find(c=>normaliseSearch(c.name)===normaliseSearch(group.title));
       const isSelected=focusedGroup===group.key;
       return <button key={group.key} type="button" aria-pressed={isSelected} onClick={()=>{setFocusedGroup(isSelected?"":group.key);setExpandedGroups({});}}
        className={"flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition "+(isSelected?"border-blue-300 bg-blue-50 text-[#003399]":"border-slate-200 bg-slate-50/50 text-slate-600 hover:border-blue-200 hover:bg-white")}>
        {country?.flag?<img src={country.flag} alt="" loading="lazy" className="h-4 w-6 shrink-0 rounded-sm object-cover"/>:<Globe2 size={14} className="shrink-0 text-slate-400"/>}
        <span className="min-w-0 flex-1 truncate text-[11px] font-semibold">{group.title}</span>
        <span className="shrink-0 rounded bg-white px-1.5 py-0.5 text-[10px] font-black tabular-nums text-slate-500">{group.items.length}</span>
       </button>;
      })}
     </div>
     {grouped.length>18&&<button type="button" onClick={()=>setShowAllViewGroups(v=>!v)} className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#003399] hover:underline">{showAllViewGroups?"Mostrar menos":"Mostrar los "+grouped.length+" grupos"}<ChevronDown size={13} className={showAllViewGroups?"rotate-180":""}/></button>}
    </div>}
    {selectableGroupView&&!focusedGroup&&grouped.length>0&&<div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-xs text-slate-500">Selecciona uno de los grupos para explorar sus competiciones.</div>}
    {visibleModeGroups.length>0&&<div className="mt-4 space-y-7">{visibleModeGroups.map(group=><section key={group.key}>
     <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
      <div className="flex min-w-0 items-center gap-2">
       {countryRecords.find(c=>normaliseSearch(c.name)===normaliseSearch(group.title))?.flag&&<img loading="lazy" src={countryRecords.find(c=>normaliseSearch(c.name)===normaliseSearch(group.title)).flag} alt="" className="h-4 w-6 shrink-0 rounded-sm border border-slate-100 object-cover"/>}
       <h2 className="truncate text-sm font-black uppercase tracking-[.06em] text-slate-900">{group.title}</h2>
       <span className="shrink-0 text-[10px] font-medium text-slate-400">{group.items.length} trofeos</span>
      </div>
      {group.detail&&<span className="hidden text-[10px] text-slate-400 md:inline">{group.detail}</span>}
     </div>
     <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-7">{group.items.slice(0,expandedGroups[group.key]?group.items.length:24).map(t=><TrophyCard key={t.visual_variant_id||t.source_id} trophy={t} manifest={imageManifest} country={countryMap.get(String(t.country_id||""))}
      count={isFifaClubWorldCup(t)&&t.visual_variant_id?honours.filter(h=>h.verified===true&&String(h.trophy_source_id)===String(t.source_id)&&fifaCwcVariantForSeason(h.season)?.id===t.visual_variant_id).length:honourCounts.get(String(t.source_id))||0} open={()=>open(t)}/>)}</div>
     {group.items.length>24&&<button type="button" onClick={()=>setExpandedGroups(current=>({...current,[group.key]:!current[group.key]}))} className="mt-3 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-[#003399] hover:bg-slate-50">{expandedGroups[group.key]?"Mostrar menos":"Ver todos los "+group.items.length+" trofeos"}</button>}
    </section>)}</div>}
    {!catalogLoading&&filtered.length===0&&<div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-xs text-slate-500">No hay trofeos con estos filtros.</div>}
    {!catalogLoading&&viewMode==="leagues"&&filtered.length>0&&grouped.length===0&&<div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-xs text-slate-500">No hay competiciones clasificadas como liga en estos filtros. Puedes revisar la categoría de los trofeos pendientes desde Editar.</div>}
   </>}
   </>}
   {section==="palmares"&&<TrophyArchiveOverview
     honours={honours} catalog={all} imageManifest={imageManifest}
     onOpenTrophy={open}
     onSync={phase=>{setSyncPhase(phase||"champions");setSection("sync");}}
   />}
   {section==="sync"&&<div className="mx-auto max-w-[1150px] space-y-4">
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-5 md:px-6">
     <p className="text-[10px] font-bold uppercase tracking-[.17em] text-[#003399]">MF LEGACY · HISTORICAL RESEARCH</p>
     <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">Sincronización histórica</h2>
     <p className="mt-2 max-w-[800px] text-xs leading-5 text-slate-500">Investiga campeones oficiales, importa las adjudicaciones verificables y enlázalas con los jugadores de STATS. Los registros sin evidencia se mantienen pendientes, nunca se confirman automáticamente.</p>
    </div>
    <TrophySyncWorkbench key={syncPhase} standalone initialPhase={syncPhase} catalog={catalog} trophies={rows(trophyQuery.data)} honours={honours}/>
   </div>}
   {section==="review"&&<TrophyReviewCenter honours={honours} honoursLoading={honourQuery.isLoading} honoursError={honourQuery.isError}
    catalog={all} catalogReady={!catalogLoading&&!catalogError&&!trophyQuery.isLoading&&!trophyQuery.isError} imageManifest={imageManifest} onOpenTrophy={open}
    onSync={()=>{setSyncPhase("players");setSection("sync");}}/>}
  </div>

  {draft&&<div className="mf-modal-overlay fixed inset-0 z-[9997] flex items-center justify-center bg-slate-950/40 p-3 backdrop-blur-[2px]" onMouseDown={e=>{if(e.target===e.currentTarget)close();}}>
   <div role="dialog" aria-modal="true" aria-label="Ficha de trofeo" className="mf-modal-panel flex max-h-[min(94dvh,920px)] w-full max-w-[1050px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_25px_90px_rgba(0,0,0,.2)]">
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5 md:px-7">
     <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">{newRecord?"NUEVA FICHA":"TROPHY ARCHIVE · "+draft.source_id}</p><h2 className="max-w-[720px] truncate text-lg font-black text-slate-900">{draft.name||"Nuevo trofeo"}</h2></div>
     <button type="button" onClick={close} aria-label="Cerrar ficha del trofeo" className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={19}/></button>
    </div>
    <nav aria-label="Secciones del trofeo" className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-slate-200 bg-white px-4 py-2 md:px-7">
     {(newRecord?["Editar"]:["Resumen","Ediciones","Historia","Clubes","Jugadores","Editar"]).map(section=>
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
       <DetailsField title="Estado de identificación"><select className={input} value={draft.identification_status||"Pending"} onChange={e=>{const v=e.target.value;if(v==="Verified"&&draft.identification_status!=="Verified"&&!window.confirm("Confirma solo después de contrastar la identidad y el ID del trofeo en FM24 o con su documentación original. ¿Marcar como verificado?"))return;setDraft(current=>({...current,identification_status:v}));}}><option value="Pending">Pendiente · revisar ID</option><option value="Verified">Identificado · comprobado</option><option value="Manual">Ficha manual</option></select></DetailsField>
       <DetailsField title="Categoría"><select className={input} value={draft.category||""} onChange={e=>setDraft(v=>({...v,category:e.target.value}))}><option value="">Sin clasificar</option>{TROPHY_CATEGORIES.map(v=><option key={v} value={v}>{v}</option>)}</select></DetailsField>
       <DetailsField title="País · vinculado a Country">
        <TrophyCountryPicker countries={countryRecords} value={draft.country_id||""} scope={draft.country_resolution||"pending"}
         onChange={(country,mode)=>setDraft(v=>({...v,country_id:country?.id||"",country:country?.name||"",country_resolution:mode,region:country? v.region:""}))}/>
        {!draft.country_id&&draft.country&&<p className="mt-1 text-[10px] text-amber-600">Nombre anterior sin vincular: {draft.country}</p>}
       </DetailsField>
       <DetailsField title="Región / sede (opcional)"><input className={input} value={draft.region||""} onChange={e=>setDraft(v=>({...v,region:e.target.value}))} placeholder="Ej. Cádiz, Cataluña, Baviera…"/></DetailsField>
       <DetailsField title="Reputación · 0 a 200"><div className="flex h-10 items-center gap-3 rounded-lg border border-slate-200 px-3"><input aria-label="Reputación editorial del trofeo, de cero a doscientos" type="range" min="0" max="200" step="1" value={draft.reputation==null||draft.reputation===""?estimateTrophyReputation(draft).score:Number(draft.reputation)} onChange={e=>setDraft(v=>({...v,reputation:Number(e.target.value),reputation_method:'manual_editorial'}))} className="min-w-0 flex-1 accent-[#003399]"/><input aria-label="Nota numérica de reputación" type="number" min="0" max="200" step="1" value={draft.reputation??""} placeholder={String(estimateTrophyReputation(draft).score)} onChange={e=>setDraft(v=>({...v,reputation:e.target.value===""?"":Math.max(0,Math.min(200,Number(e.target.value))),reputation_method:'manual_editorial'}))} className="w-14 border-l border-slate-200 pl-2 text-right text-sm font-black tabular-nums outline-none"/></div><p className="mt-1 text-[10px] text-slate-400">Fama estimada por MF LEGACY, no valor oficial del juego.</p></DetailsField>
       <DetailsField title="Criterio de reputación" wide><textarea className={input+" min-h-16 py-2"} value={draft.reputation_basis||""} onChange={e=>setDraft(v=>({...v,reputation_basis:e.target.value}))} placeholder={estimateTrophyReputation(draft).basis}/></DetailsField>
       <DetailsField title="Organizador"><input className={input} value={draft.organizer||""} onChange={e=>setDraft(v=>({...v,organizer:e.target.value}))} placeholder="FIFA, UEFA, federación…"/></DetailsField>
       <DetailsField title="ID de competición"><input className={input} value={draft.competition_id||""} onChange={e=>setDraft(v=>({...v,competition_id:e.target.value}))} placeholder="Opcional · League ID"/></DetailsField>
       <div className="sm:col-span-2"><TrophyImageManager key={String(draft.source_id||"new")} trophy={draft} manifest={imageManifest} onSave={saveImage} disabled={saving}/></div>
       <DetailsField title="Fuente de investigación (opcional)" wide><input className={input} type="url" value={draft.research_source_url||""} onChange={e=>setDraft(v=>({...v,research_source_url:e.target.value}))} placeholder="https://federación o club oficial…"/></DetailsField>
       <DetailsField title="Descripción" wide><textarea className={input+" min-h-20 py-2"} value={draft.description||""} onChange={e=>setDraft(v=>({...v,description:e.target.value}))} placeholder="Historia, relevancia o características del trofeo…"/></DetailsField>
       <DetailsField title="Notas privadas" wide><textarea className={input+" min-h-16 py-2"} value={draft.notes||""} onChange={e=>setDraft(v=>({...v,notes:e.target.value}))} placeholder="Pendientes de investigación…"/></DetailsField>
       <div className="sm:col-span-2 flex items-center justify-between gap-3 pt-2"><span className="text-[10px] text-slate-400">{draft.source_path||"Imagen enlazable desde GitHub por ID original"}</span><button type="submit" disabled={saving} className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[#003399] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"><Save size={15}/>{saving?"Guardando…":"Guardar ficha"}</button></div>
      </form>
     </div>
     <div className="min-h-0 overflow-y-auto p-5 md:p-7">
      {!newRecord&&<div role="tablist" aria-label="Editor de datos de la competición" className="mb-4 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
       <button type="button" role="tab" aria-selected={editorPane==="historical"} onClick={()=>{setEditorPane("historical");setHonourDraft(null);setError("");}} className={"rounded-lg py-2.5 text-[11px] font-bold transition "+(editorPane==="historical"?"bg-white text-[#003399] shadow-sm":"text-slate-500 hover:bg-white/60")}>Finales e historia</button>
       <button type="button" role="tab" aria-selected={editorPane==="honours"} onClick={()=>{setEditorPane("honours");setError("");}} className={"rounded-lg py-2.5 text-[11px] font-bold transition "+(editorPane==="honours"?"bg-white text-[#003399] shadow-sm":"text-slate-500 hover:bg-white/60")}>Palmarés verificable</button>
      </div>}
      {!newRecord&&editorPane==="historical"?<TrophyHistoricalEditor key={String(selected?.source_id||"")} trophy={selected||draft} teams={rows(teamsQuery.data)} countries={countryRecords}/>:
      <div>

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
      </div>}

     </div>
    </div>:<TrophyDetailVisual
      key={selectedId} trophy={draft||selected} manifest={imageManifest} countries={countryRecords}
      onSelectVisualVariant={variantId=>setDraft(current=>({...current,visual_variant_id:variantId}))}
      tab={detailTab} honours={selectedHonours} onEdit={()=>setDetailTab("Editar")}
      onAdd={startHonour} onVerify={verifyHonour} onNavigate={setDetailTab} honourSaving={honourSaving}
    />}
   </div>
  </div>}
 </div>;
}
