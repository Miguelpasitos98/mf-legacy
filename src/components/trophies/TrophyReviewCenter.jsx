import React,{useMemo,useState} from "react";
import {useQuery,useQueryClient} from "@tanstack/react-query";
import {useNavigate} from "react-router-dom";
import {AlertTriangle,ArrowUpRight,CheckCheck,CheckCircle2,ClipboardCheck,Clock3,ExternalLink,Filter,RefreshCw,Search,Shield,ShieldCheck,Trophy,Users,XCircle} from "lucide-react";
import {base44} from "@/api/base44Client";
import {completeRecordQueryOptions} from "@/utils/entityRecords";
import {trophyImageUrl} from "@/utils/trophyCatalog";
import {filterTrophyReviews,prepareTrophyDecision,safeBulkTrophyPlan,trophyReviewRows,validTrophyEvidenceUrl} from "@/utils/trophyReview";
import {normalizeImageUrl} from "@/components/teams/teamUtils";
import TeamSearchPicker from "@/components/trophies/TeamSearchPicker";

const CREDIT_KEY=["mf-legacy","trophies","credits"];
const TEAM_KEY=["mf-legacy","teams"];
const PLAYER_KEY=["mf-legacy","players"];
const HONOUR_KEY=["mf-legacy","trophies","honours"];
const statusLabels={candidate:"Candidatos",confirmed:"Confirmados",excluded:"Excluidos",all:"Todos"};
const rowStatus={candidate:"Pendiente",confirmed:"Confirmado",excluded:"Excluido"};
const btn="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-700 hover:border-blue-200 hover:text-[#003399] disabled:cursor-not-allowed disabled:opacity-40";
const prim="rounded-lg bg-[#003399] px-3 py-2 text-[11px] font-bold text-white hover:bg-[#002978] disabled:cursor-not-allowed disabled:opacity-40";
const id=x=>String(x??"").trim();
function Thumbnail({src,icon:Icon=Shield}){
 const [bad,setBad]=useState(false);
 const url=normalizeImageUrl(src);
 return <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-[#f5f7fa]">
  {url&&!bad?<img src={url} loading="lazy" alt="" onError={()=>setBad(true)} className="h-[88%] w-[88%] object-contain"/>:<Icon size={20} className="text-slate-300" strokeWidth={1.4}/>}
 </span>;
}
function Counter({value,label,icon:Icon,tone=""}){
 return <div className="rounded-xl border border-slate-200 bg-white p-3">
  <div className="flex justify-between gap-2"><p className="text-[10px] font-bold uppercase tracking-[.1em] text-slate-400">{label}</p><Icon size={15} className="text-slate-300"/></div>
  <p className={"mt-2 text-2xl font-black tabular-nums "+(tone||"text-[#12345b]")}>{value}</p>
 </div>;
}
function PhotoOfTrophy({trophy,manifest}){
 const [bad,setBad]=useState(false);
 return <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#f6f8fc]">
  {!bad&&trophy?<img src={trophyImageUrl(trophy,manifest)} loading="lazy" alt="" onError={()=>setBad(true)} className="h-full w-full object-contain p-1"/>:<Trophy size={22} className="text-slate-300"/>}
 </span>;
}
export default function TrophyReviewCenter({honours=[],honoursLoading=false,honoursError=false,catalog=[],imageManifest,onSync}){
 const qc=useQueryClient(),navigate=useNavigate();
 const [status,setStatus]=useState("candidate"),[teamId,setTeamId]=useState(""),[trophyId,setTrophyId]=useState("all");
 const [season,setSeason]=useState("all"),[query,setQuery]=useState(""),[showBlocked,setShowBlocked]=useState("all");
 const [expanded,setExpanded]=useState([]),[selected,setSelected]=useState([]);
 const [drafts,setDrafts]=useState({}),[processing,setProcessing]=useState(false),[feedback,setFeedback]=useState(""),[error,setError]=useState("");
 const [visible,setVisible]=useState(30);
 const creditsQuery=useQuery({...completeRecordQueryOptions(base44.entities.PlayerTrophyCredit,CREDIT_KEY),retry:false});
 const teamsQuery=useQuery({...completeRecordQueryOptions(base44.entities.Team,TEAM_KEY),retry:false});
 const playersQuery=useQuery({...completeRecordQueryOptions(base44.entities.Player,PLAYER_KEY),retry:false});
 const readsError=creditsQuery.isError||teamsQuery.isError||playersQuery.isError||honoursError;
 const loading=creditsQuery.isLoading||teamsQuery.isLoading||playersQuery.isLoading||honoursLoading;
 const records=useMemo(()=>trophyReviewRows({
  credits:creditsQuery.data||[],honours,teams:teamsQuery.data||[],players:playersQuery.data||[],catalog
 }),[creditsQuery.data,honours,teamsQuery.data,playersQuery.data,catalog]);
 const optionsTrophy=useMemo(()=>{
  const items=new Map();
  for(const row of records)if(id(row.trophy_source_id||row.honour?.trophy_source_id))items.set(
   id(row.trophy_source_id||row.honour?.trophy_source_id),
   row.trophy_name
  );
  return [...items].sort((a,b)=>a[1].localeCompare(b[1],"es"));
 },[records]);
 const seasons=useMemo(()=>[...new Set(records.map(row=>row.season).filter(Boolean))]
  .sort((a,b)=>b.localeCompare(a,"es",{numeric:true})),[records]);
 const filtered=useMemo(()=>filterTrophyReviews(records,{
  status,team:teamId||"all",trophy:trophyId,season,query,blocked:showBlocked
 }),[records,status,teamId,trophyId,season,query,showBlocked]);
 const selectedRows=useMemo(()=>filtered.filter(row=>selected.includes(id(row.id))&&row.pending&&!row.blocked),[filtered,selected]);
 const visibleRows=filtered.slice(0,visible);
 const candidateCount=records.filter(row=>row.pending).length;
 const blockedCount=records.filter(row=>row.pending&&row.blocked).length;
 const pendingReady=records.filter(row=>row.pending&&!row.blocked).length;
 const confirmedCount=records.filter(row=>row.status==="confirmed"&&row.verified===true).length;
 const excludedCount=records.filter(row=>row.status==="excluded").length;
 const resetSelection=()=>{setSelected([]);setVisible(30);};
 const clearFeedback=()=>{setError("");setFeedback("");};
 const updateDraft=(creditId,key,value)=>{setDrafts(old=>({...old,[creditId]:{...old[creditId],[key]:value}}));};
 const currentDecision=row=>{
  const draft=drafts[row.id]||{};
  return {status:"confirmed",source:draft.url||row.source_url||"",acknowledged:draft.acknowledged===true};
 };
 const checkedPlan=()=>safeBulkTrophyPlan(selectedRows,Object.fromEntries(selectedRows.map(row=>[id(row.id),currentDecision(row)])));
 const apply=async(plan,{confirmMessage=""}={})=>{
  if(processing||!plan.length||readsError)return;
  if(confirmMessage&&!window.confirm(confirmMessage))return;
  setProcessing(true);clearFeedback();
  let done=0;
  try{
   // Revalidate identity and status against a fresh, complete snapshot before
   // writing anything. Partial pages never replace the current cache.
   const [freshCredits,freshHonours]=await Promise.all([
    qc.fetchQuery({...completeRecordQueryOptions(base44.entities.PlayerTrophyCredit,CREDIT_KEY),staleTime:0}),
    qc.fetchQuery({...completeRecordQueryOptions(base44.entities.TrophyHonour,HONOUR_KEY),staleTime:0})
   ]);
   const freshRows=trophyReviewRows({
    credits:freshCredits,honours:freshHonours,teams:teamsQuery.data||[],
    players:playersQuery.data||[],catalog
   });
   const freshById=new Map(freshRows.map(row=>[id(row.id),row]));
   for(const entry of plan){
    const row=freshById.get(id(entry.id));
    if(!row||!row.pending||row.blocked)throw Error("Una adjudicación ha cambiado o ya no se puede revisar. Actualiza antes de continuar.");
    // The plan and its evidence were checked prior to the first write.
    prepareTrophyDecision(row,{
     status:entry.payload.status,
     source:entry.payload.source_url,acknowledged:entry.payload.status==="confirmed"
    });
   }
   for(const entry of plan){
    await base44.entities.PlayerTrophyCredit.update(entry.id,entry.payload);
    done++;
   }
   await qc.invalidateQueries({queryKey:CREDIT_KEY});
   setSelected([]);setExpanded([]);setDrafts({});
   setFeedback(done+" adjudicaciones revisadas y guardadas. El palmarés se actualizará con los títulos confirmados.");
  }catch(e){
   setError((done?"Se guardaron "+done+" de "+plan.length+" adjudicaciones antes del error. ":"")+"No se completó la revisión: "+(e?.message||e));
  }finally{
   await qc.invalidateQueries({queryKey:CREDIT_KEY});
   setProcessing(false);
  }
 };
 const decideOne=(row,kind)=>{
  clearFeedback();
  try{
   if(kind==="confirmed")return apply([{id:row.id,payload:prepareTrophyDecision(row,currentDecision(row))}]);
   if(kind==="excluded")return apply([{id:row.id,payload:prepareTrophyDecision(row,{status:"excluded"})}],{
    confirmMessage:"¿Excluir la adjudicación de "+row.player_name+" para "+row.trophy_name+" ("+row.season+")? Esta acción no acredita ningún título."
   });
  }catch(e){setError(e.message);}
 };
 const confirmSelected=()=>{
  clearFeedback();
  try{
   if(!selectedRows.length)return;
   const plan=checkedPlan();
   return apply(plan,{confirmMessage:"¿Confirmar "+plan.length+" adjudicaciones? Has indicado una fuente y comprobado individualmente la elegibilidad para cada una."});
  }catch(e){setError(e.message);}
 };
 const excludeSelected=()=>{
  clearFeedback();
  try{
   if(!selectedRows.length)return;
   const plan=safeBulkTrophyPlan(selectedRows,Object.fromEntries(selectedRows.map(row=>[id(row.id),{status:"excluded"}])));
   return apply(plan,{confirmMessage:"¿Excluir "+plan.length+" adjudicaciones seleccionadas? No se contabilizarán como títulos de los futbolistas."});
  }catch(e){setError(e.message);}
 };
 const toggle=idValue=>setSelected(previous=>previous.includes(idValue)?previous.filter(x=>x!==idValue):previous.length<50?[...previous,idValue]:previous);
 const toggleRow=idValue=>setExpanded(previous=>previous.includes(idValue)?previous.filter(x=>x!==idValue):[...previous,idValue]);
 const selectVisible=()=>{
  const available=visibleRows.filter(row=>row.pending&&!row.blocked).slice(0,50).map(row=>id(row.id));
  const already=available.length>0&&available.every(value=>selected.includes(value));
  setSelected(already?selected.filter(value=>!available.includes(value)):Array.from(new Set([...selected,...available])).slice(0,50));
 };
 return <section className="space-y-4 pb-8">
  <header className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#102e57] via-[#1b416e] to-[#42648d] p-5 text-white md:p-7">
   <div className="pointer-events-none absolute -right-10 -top-28 h-64 w-64 rounded-full border border-white/15"/>
   <div className="relative flex flex-wrap items-center justify-between gap-5">
    <div className="max-w-[700px]">
     <p className="text-[10px] font-bold uppercase tracking-[.18em] text-blue-200">MF LEGACY · CENTRO DE VALIDACIÓN</p>
     <h2 className="mt-2 flex items-center gap-2 text-2xl font-black md:text-3xl"><ClipboardCheck size={26}/> Revisión de adjudicaciones</h2>
     <p className="mt-2 text-[12px] leading-5 text-white/75">Revisa quién puede figurar como ganador de cada título. Las participaciones en STATS generan candidatos, nunca confirmaciones automáticas.</p>
    </div>
    <button type="button" onClick={()=>onSync?.()}
     className="rounded-lg border border-white/25 bg-white/10 px-4 py-2 text-[11px] font-bold hover:bg-white/20">Generar candidatos desde STATS <ArrowUpRight size={13} className="ml-1 inline"/></button>
   </div>
  </header>
  <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
   <Counter value={candidateCount} label="Pendientes" icon={Clock3} tone="text-amber-700"/>
   <Counter value={pendingReady} label="Listos para revisar" icon={ShieldCheck}/>
   <Counter value={confirmedCount} label="Confirmados" icon={CheckCircle2} tone="text-emerald-700"/>
   <Counter value={blockedCount} label="Con incidencias" icon={AlertTriangle} tone={blockedCount?"text-red-700":""}/>
  </div>
  {feedback&&<p role="status" className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-900">{feedback}</p>}
  {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">{error}</p>}
  {readsError&&<p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">No se ha podido cargar una instantánea completa de jugadores, clubes o adjudicaciones. Se han desactivado las modificaciones hasta que estén disponibles todos los datos.</p>}
  <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3 md:p-4">
   <div className="flex flex-wrap items-center justify-between gap-3">
    <div className="flex gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1">
     {Object.entries(statusLabels).map(([key,value])=><button type="button" key={key}
      aria-pressed={status===key} onClick={()=>{setStatus(key);resetSelection();}}
      className={"shrink-0 rounded-md px-3 py-2 text-[11px] font-bold "+(status===key?"bg-[#003399] text-white":"text-slate-500 hover:bg-white")}>{value}</button>)}
    </div>
    <button type="button" disabled={processing||loading} onClick={async()=>{clearFeedback();try{await Promise.all([
     qc.invalidateQueries({queryKey:CREDIT_KEY}),qc.invalidateQueries({queryKey:TEAM_KEY}),qc.invalidateQueries({queryKey:PLAYER_KEY}),qc.invalidateQueries({queryKey:HONOUR_KEY})
    ]);}catch(e){setError("No se pudo actualizar: "+e.message);}}} className={btn}>
     <RefreshCw size={13} className="mr-1 inline"/> Actualizar
    </button>
   </div>
   <div className="grid items-end gap-2 md:grid-cols-2 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,.9fr)_minmax(0,.9fr)]">
    <div><label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Club</label>
     <TeamSearchPicker teams={teamsQuery.data||[]} value={teamId} loading={teamsQuery.isLoading}
      error={teamsQuery.isError} ariaLabel="Filtrar adjudicaciones por equipo" placeholder="Buscar equipo…"
      onChange={value=>{setTeamId(value);resetSelection();}}/>
    </div>
    <label className="block min-w-0"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Trofeo o competición</span>
     <select value={trophyId} onChange={e=>{setTrophyId(e.target.value);resetSelection();}} className="h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-[11px] text-slate-700">
      <option value="all">Todas las competiciones</option>{optionsTrophy.map(([key,name])=><option key={key} value={key}>{name}</option>)}
     </select></label>
    <label className="block"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Temporada</span>
     <select value={season} onChange={e=>{setSeason(e.target.value);resetSelection();}} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[11px] text-slate-700">
      <option value="all">Todas las temporadas</option>{seasons.map(value=><option key={value} value={value}>{value}</option>)}
     </select></label>
    <label className="block"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Integridad</span>
     <select value={showBlocked} onChange={e=>{setShowBlocked(e.target.value);resetSelection();}} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[11px] text-slate-700">
      <option value="all">Todas</option><option value="ready">Sin incidencias</option><option value="blocked">Con incidencias</option>
     </select></label>
   </div>
   <label className="relative block"><Search size={15} className="absolute left-3 top-3 text-slate-400"/>
    <input type="search" placeholder="Buscar jugador, equipo, trofeo o referencia…" value={query}
     onChange={e=>{setQuery(e.target.value);resetSelection();}} className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-xs outline-none focus:border-[#003399]"/></label>
   <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
    <p className="text-[11px] text-slate-500">{loading?"Consultando registros…":filtered.length.toLocaleString("es-ES")+" adjudicaciones encontradas"}</p>
    {status==="candidate"&&filtered.some(row=>row.pending&&!row.blocked)&&<label className="inline-flex items-center gap-2 text-[11px] font-bold text-slate-600">
     <input type="checkbox" disabled={processing||readsError} checked={visibleRows.some(row=>row.pending&&!row.blocked)&&visibleRows.filter(row=>row.pending&&!row.blocked).every(row=>selected.includes(id(row.id)))}
      onChange={selectVisible}/> Seleccionar visibles (máx. 50)
    </label>}
   </div>
  </div>
  {selectedRows.length>0&&<div className="sticky top-2 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 shadow-sm">
   <p className="text-xs font-bold text-[#003399]">{selectedRows.length} candidatos seleccionados</p>
   <div className="flex flex-wrap gap-2">
    <button type="button" disabled={processing||readsError} onClick={confirmSelected} className={prim}><CheckCheck size={14} className="mr-1 inline"/> Confirmar con fuentes individuales</button>
    <button type="button" disabled={processing||readsError} onClick={excludeSelected} className={btn}><XCircle size={14} className="mr-1 inline"/> Excluir seleccionados</button>
    <button type="button" onClick={()=>setSelected([])} className={btn}>Limpiar</button>
   </div>
  </div>}
  {!loading&&!readsError&&records.length===0&&<div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-12 text-center">
   <Users size={33} className="mx-auto text-slate-300"/>
   <h3 className="mt-3 text-sm font-black text-slate-700">Aún no hay jugadores vinculados a títulos</h3>
   <p className="mx-auto mt-2 max-w-[570px] text-xs leading-5 text-slate-500">Los campeones de equipos ya pueden estar registrados. Para adjudicar títulos a futbolistas, entra en Sincronizar → Jugadores elegibles, selecciona una edición verificada, cruza con STATS y registra los candidatos.</p>
   <button type="button" onClick={()=>onSync?.()} className={prim+" mt-4"}>Crear candidatos desde STATS</button>
  </div>}
  {!loading&&!readsError&&records.length>0&&!filtered.length&&<div className="rounded-xl border border-slate-200 bg-white px-5 py-10 text-center text-xs text-slate-500">No hay adjudicaciones para estos filtros. Prueba otra temporada, competición o estado.</div>}
  {!loading&&!readsError&&visibleRows.length>0&&<div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
   {visibleRows.map(row=>{
    const open=expanded.includes(id(row.id));
    const draft=drafts[row.id]||{};
    const url=draft.url??row.source_url??"";
    const ack=draft.acknowledged===true;
    const ready=row.pending&&!row.blocked;
    const image=row.player?.photo_url||row.player?.photoUrl||row.player?.card_photo_url;
    return <article key={row.id} className={"min-w-0 overflow-hidden rounded-2xl border bg-white "+(row.blocked?"border-amber-300":"border-slate-200")}>
     <div className="space-y-3 p-4">
      <div className="flex items-center gap-2">
       {status==="candidate"&&<input type="checkbox" aria-label={"Seleccionar a "+row.player_name} disabled={!ready||processing}
        checked={selected.includes(id(row.id))} onChange={()=>toggle(id(row.id))}/>}
       <PhotoOfTrophy trophy={row.trophy} manifest={imageManifest}/>
       <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-black text-slate-900" title={row.trophy_name}>{row.trophy_name}</p>
        <p className="mt-1 text-[10px] font-semibold tabular-nums text-slate-500">{row.season}</p>
       </div>
       <span className={"shrink-0 rounded-md px-2 py-1 text-[9px] font-extrabold "+(row.status==="confirmed"?"bg-emerald-50 text-emerald-700":row.status==="excluded"?"bg-slate-100 text-slate-500":"bg-amber-50 text-amber-700")}>{rowStatus[row.status]||row.status}</span>
      </div>
      <div className="flex items-center gap-3 border-t border-slate-100 pt-3">
       <Thumbnail src={image} icon={Users}/>
       <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-black text-slate-800">{row.player_name}</p>
        <div className="mt-1 flex items-center gap-2"><Thumbnail src={row.team?.logo||row.team?.logo_url} icon={Shield}/><span className="min-w-0 truncate text-[10px] text-slate-500">{row.team_name}</span></div>
       </div>
       {row.player&&<button type="button" onClick={()=>navigate("/players?stats_player="+encodeURIComponent(row.player_id))}
        title="Abrir ficha de jugador" className="shrink-0 rounded-lg p-2 text-[#003399] hover:bg-blue-50"><ArrowUpRight size={15}/></button>}
      </div>
      {row.blocked&&<div className="rounded-lg bg-amber-50 px-3 py-2 text-[10px] text-amber-900">
       <p className="flex items-center gap-1 font-bold"><AlertTriangle size={13}/> Requiere corregir datos antes de aprobar</p>
       <p className="mt-1">{row.reasons.join(" · ")}</p></div>}
      {row.evidence_note&&<p className="line-clamp-2 text-[10px] leading-4 text-slate-500">{row.evidence_note}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2">
       {row.honour?.source_url&&<a href={row.honour.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] font-bold text-[#003399] hover:underline">
        Fuente del campeón <ExternalLink size={12}/></a>}
       {validTrophyEvidenceUrl(row.source_url)&&<a href={row.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:underline">Fuente del jugador <ExternalLink size={12}/></a>}
       {ready&&<button type="button" onClick={()=>toggleRow(id(row.id))}
        aria-expanded={open} className="ml-auto rounded-lg bg-[#edf3fb] px-3 py-1.5 text-[10px] font-bold text-[#003399] hover:bg-blue-100">
        {open?"Ocultar revisión":"Revisar candidato"}</button>}
      </div>
     </div>
     {ready&&open&&<div className="space-y-3 border-t border-blue-100 bg-[#f9fbfe] p-4">
      <label className="block text-[10px] font-bold text-slate-600">URL de evidencia individual del jugador
       <input type="url" value={url} onChange={e=>updateDraft(row.id,"url",e.target.value)}
        placeholder="https://... (plantilla, acta o federación)" className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-normal outline-none focus:border-[#003399]"/>
      </label>
      <label className="flex items-start gap-2 text-[11px] leading-4 text-slate-600">
       <input type="checkbox" checked={ack} onChange={e=>updateDraft(row.id,"acknowledged",e.target.checked)} className="mt-0.5"/>
       He revisado esta fuente y confirma que el jugador es elegible para este título y edición concretos.
      </label>
      <div className="flex gap-2">
       <button type="button" disabled={processing||!ack||!validTrophyEvidenceUrl(url)||readsError}
        onClick={()=>decideOne(row,"confirmed")} className={prim+" flex-1"}><CheckCircle2 size={13} className="mr-1 inline"/> Confirmar</button>
       <button type="button" disabled={processing||readsError} onClick={()=>decideOne(row,"excluded")} className={btn}><XCircle size={13} className="mr-1 inline"/> Excluir</button>
      </div>
      <p className="text-[10px] text-slate-400">Cada aprobación requiere una fuente y una comprobación explícita. No basta con aparecer en STATS.</p>
     </div>}
    </article>;
   })}
  </div>}
  {filtered.length>visible&&!loading&&<div className="flex justify-center"><button type="button" onClick={()=>setVisible(v=>v+30)} className={btn}>Mostrar más ({filtered.length-visible} restantes)</button></div>}
  {records.length>0&&<p className="flex items-start gap-2 text-[10px] text-slate-500">
   <Filter size={13} className="shrink-0"/> {excludedCount} adjudicaciones excluidas. Los títulos del club y los historiales de STATS no se modifican desde esta pantalla. Los registros con discrepancias de identidad quedan bloqueados hasta su corrección.
  </p>}
 </section>;
}
