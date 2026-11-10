import React,{useEffect,useMemo,useState} from "react";
import {Link,useSearchParams} from "react-router-dom";
import {base44} from "@/api/base44Client";
import {useHistoricalPeerDataset} from "@/hooks/useHistoricalPeerDataset";
import {useProgressiveHistoricalStats} from "@/hooks/useProgressiveHistoricalStats";
import {useQuery} from "@tanstack/react-query";
import {statsSnapshotOptions} from "@/api/recordQueries";
import {flattenStatsPages} from "@/utils/statsRowsCache";
import {buildHistoricalObservations} from "@/utils/historicalPeers";
import {ManagerScoutingSummary,ScoutingCandidateCard,ManagerMethodsPanel} from "@/components/managers/ManagerScoutingVisual";
import {ROLE_LABELS,rankPlayers} from "@/components/managers/managerFit.mjs";
import {collectPlayerSeasonMetrics,seasonPercentiles,historicalRoleCandidates,linkedManagerFitRows} from "@/components/managers/managerFitHistorical.mjs";
import {evaluateRoleRequirements,deriveRoleRequirements} from "@/components/managers/managerRoleFit.mjs";
import {buildScoutingReport,compareManagerProfiles,SCOUT_METRIC_NAMES} from "@/components/managers/managerScoutingReport.mjs";
import {ageOnSeason,valuationForSeason,filterScoutingCandidates,formatTransferValue} from "@/components/managers/managerTransferScout.mjs";
import {MAX_COMPARE,toggleCandidate,compareCandidates,candidateOverview} from "@/components/managers/managerCandidateCompare.mjs";
import {managerFitAttributes} from "@/components/managers/managerFitAttributes.mjs";
import {profileScopeLabel} from "@/components/managers/managerModel.mjs";
import {visibleManagerFitCandidates} from "@/components/managers/managerFitVisibility.mjs";
import {managerScoutingPool,managerScoutingCandidateIds} from "@/components/managers/managerScoutingPool.mjs";
import {DEEP_FIT_PRESETS,DEEP_COMPONENT_LABELS,evaluateDeepFit} from "@/components/managers/managerFitDeep.mjs";
import {managerFitTemporalScope} from "@/components/managers/managerFitTemporalScope.mjs";
import {careerPositionFitIndex} from "@/components/managers/managerCareerPositionFit.mjs";
import {evaluatePlayerSeasonHybrid} from "@/components/managers/managerPlayerSeasonHybrid.mjs";
import {activeAssignment,indexManagerPlayerAssignments,filterManagerPlayerAssignments,countManagerPlayerAssignments,saveManagerPlayerDecision} from "@/components/managers/managerPlayerAssignments.mjs";
const all=async(entity,query={})=>{
 const output=[];
 for(let skip=0;skip<100000;skip+=200){
  const raw=await entity.filter(query,undefined,200,skip);
  const rows=Array.isArray(raw)?raw:raw?.data||raw?.items||[];
  output.push(...rows);
  if(rows.length<200)return output;
 }
 throw Error("Catálogo demasiado grande para cargar completamente.");
};
export default function ManagerFit(){
 const [params,setParams]=useSearchParams();
 const [managers,setManagers]=useState([]);
 const [profiles,setProfiles]=useState([]);
 const [players,setPlayers]=useState([]);
 const [fotmobLinks,setFotmobLinks]=useState([]);
 const [linkError,setLinkError]=useState("");
 const [playerAssignments,setPlayerAssignments]=useState([]);
 const [assignmentLoading,setAssignmentLoading]=useState(true);
 const [assignmentError,setAssignmentError]=useState("");
 const [assignmentNotice,setAssignmentNotice]=useState("");
 const [assignmentFilter,setAssignmentFilter]=useState("available");
 const [assignmentBusy,setAssignmentBusy]=useState("");

 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [role,setRole]=useState(()=>["GK","CB","FB","DM","AM","WG","ST"].includes(params.get("role"))?params.get("role"):"FB");
 const [search,setSearch]=useState("");
 const [minCA,setMinCA]=useState(0);
 const [showUnknown,setShowUnknown]=useState(false);
 const [resultSort,setResultSort]=useState("score");
 const [showAllResults,setShowAllResults]=useState(false);
 const [scoreMode,setScoreMode]=useState("hybrid");
 const [deepPreset,setDeepPreset]=useState("balanced");
 const [customDeepWeights,setCustomDeepWeights]=useState({...DEEP_FIT_PRESETS.balanced});
 const deepWeights=deepPreset==="custom"?customDeepWeights:DEEP_FIT_PRESETS[deepPreset]||DEEP_FIT_PRESETS.balanced;
 const [season,setSeason]=useState(()=>params.get("season")||"2025/2026");
 // The main 70/30 mode does NOT need seven massive historical downloads.
 // Read each historical season completely before publishing it into the comparison.
 const progressiveMode=scoreMode==="hybrid"||scoreMode==="career";
 const progressive=useProgressiveHistoricalStats(progressiveMode);
 const {data:historicalDataset,isFetching:fullHistoryLoading,error:historicalError}=useHistoricalPeerDataset(!progressiveMode);
 const {data:statsSnapshot,isFetching:rawStatsLoading,error:rawStatsError,refetch:reloadStats}=useQuery({...statsSnapshotOptions(),enabled:!progressiveMode});
 const rawHistoricalStats=useMemo(()=>progressiveMode?progressive.rows:(statsSnapshot?flattenStatsPages(statsSnapshot):[]),[progressiveMode,progressive.rows,statsSnapshot]);
 const coreDataset=useMemo(()=>{
  if(!players.length||!rawHistoricalStats.length)return null;
  const resolved=linkedManagerFitRows(rawHistoricalStats,fotmobLinks,players);
  return {observations:buildHistoricalObservations({players,stats:resolved}),
   records:{PlayerSeasonStats:resolved,UnderstatSeasonRate:[],PlayerHistoricalValuation:[]}};
 },[rawHistoricalStats,players,fotmobLinks]);
 const fitDataset=progressiveMode?(coreDataset||historicalDataset):historicalDataset||coreDataset;
 const statsLoading=!fitDataset&&(progressiveMode?progressive.loading:(fullHistoryLoading||rawStatsLoading));
 const statsError=progressiveMode?progressive.error:(historicalError?.message||rawStatsError?.message||"");
 const seasonStats=useMemo(()=>fitDataset?.records?.PlayerSeasonStats?.filter(row=>row.season===season)||[],[fitDataset,season]);
 const understatRows=useMemo(()=>fitDataset?.records?.UnderstatSeasonRate?.filter(row=>row.season===season)||[],[fitDataset,season]);
 const valuationRows=useMemo(()=>fitDataset?.records?.PlayerHistoricalValuation?.filter(row=>row.season===season)||[],[fitDataset,season]);
 const [scoutingPlayerId,setScoutingPlayerId]=useState("");
 const [minAge,setMinAge]=useState("");
 const [maxAge,setMaxAge]=useState("");
 const [maxValueM,setMaxValueM]=useState("");
 const [knownValueOnly,setKnownValueOnly]=useState(false);
 const [minimumCoverage,setMinimumCoverage]=useState(0);
 const [comparedIds,setComparedIds]=useState([]);
 const [totalBudget,setTotalBudget]=useState("");
 const managerId=params.get("manager")||"";
 const profileId=params.get("profile")||"";
 const manager=managers.find(m=>String(m.id)===managerId);
 const profileOptions=profiles.filter(p=>String(p.manager_id)===String(managerId));
 const profile=profileOptions.find(p=>String(p.id)===profileId)||null;
 const assignmentsIndex=useMemo(()=>indexManagerPlayerAssignments(playerAssignments),[playerAssignments]);
 const assignmentCounts=useMemo(()=>countManagerPlayerAssignments(assignmentsIndex,managerId),[assignmentsIndex,managerId]);
 const managerAssignments=useMemo(()=>playerAssignments.filter(a=>activeAssignment(a)&&String(a.manager_id)===String(managerId))
  .sort((a,b)=>a.status===b.status?String(b.decision_at||"").localeCompare(String(a.decision_at||"")):a.status==="linked"?-1:1),[playerAssignments,managerId]);
 const nameByManager=useMemo(()=>new Map(managers.map(m=>[String(m.id),m.display_name||m.name])),[managers]);
 const nameByPlayer=useMemo(()=>new Map(players.map(p=>[String(p.id),p.name])),[players]);
 const reloadAssignments=async()=>{
  setAssignmentLoading(true);setAssignmentError("");
  try{
   const latest=await all(base44.entities.ManagerPlayerAssignment);
   setPlayerAssignments(latest);
  }catch(e){
   setAssignmentError("No se pudieron cargar las adjudicaciones: "+(e.message||"Error de Base44")+". No se permitirá vincular hasta recuperar los datos.");
  }finally{setAssignmentLoading(false)}
 };
 const managePlayerAssignment=async(playerId,action,selectedRole=role)=>{
  if(!manager||assignmentLoading||assignmentError||assignmentBusy)return;
  const player=players.find(p=>String(p.id)===String(playerId));
  if(!player)return;
  if(assignmentsIndex.conflicts.has(String(playerId))){
   setAssignmentError("El jugador tiene adjudicaciones duplicadas. Deben revisarse antes de modificar su vínculo.");
   return;
  }
  const current=assignmentsIndex.byPlayer.get(String(playerId));
  const occupied=activeAssignment(current)&&String(current.manager_id)!==String(managerId);
  if(occupied){
   const other=nameByManager.get(String(current.manager_id))||"otro entrenador";
   if(!window.confirm(player.name+" ya está adjudicado a "+other+". ¿Reasignarlo a "+(manager.display_name||manager.name)+"? El cambio se guardará en su historial."))return;
  }else if(action==="release"){
   if(!window.confirm("¿Desvincular a "+player.name+" de "+(manager.display_name||manager.name)+"? Volverá a estar disponible."))return;
  }
  setAssignmentBusy(String(playerId));setAssignmentError("");setAssignmentNotice("");
  try{
   await saveManagerPlayerDecision(base44.entities.ManagerPlayerAssignment,{
    playerId:String(playerId),managerId:String(managerId),profileId:String(profileId),
    role:selectedRole,action,confirmReassign:occupied
   });
   const fresh=await all(base44.entities.ManagerPlayerAssignment);
   setPlayerAssignments(fresh);
   setAssignmentNotice(player.name+(action==="release"?" está disponible de nuevo.":action==="preselect"?" está preseleccionado para "+(manager.display_name||manager.name)+".":" está vinculado a "+(manager.display_name||manager.name)+"."));
  }catch(e){
   setAssignmentError("No se pudo guardar la adjudicación de "+player.name+": "+(e.message||"Error del servidor"));
  }finally{setAssignmentBusy("")}
 };
 useEffect(()=>{
  let live=true;
  setAssignmentLoading(true);
  all(base44.entities.ManagerPlayerAssignment).then(rows=>{
   if(live){setPlayerAssignments(rows);setAssignmentError("")}
  }).catch(e=>{
   if(live)setAssignmentError("No se pudieron cargar las adjudicaciones: "+(e.message||"Error")+". Reintenta antes de vincular.");
  }).finally(()=>{if(live)setAssignmentLoading(false)});
  return()=>{live=false};
 },[]);

 useEffect(()=>{
  let active=true;
  Promise.all([all(base44.entities.Manager),all(base44.entities.ManagerTacticalProfile),all(base44.entities.Player)])
   .then(([m,p,pl])=>{if(!active)return;setManagers(m);setProfiles(p);setPlayers(pl)})
   .catch(e=>{if(active)setError(e.message||"No se pudo cargar scouting")})
   .finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[]);
 useEffect(()=>{
  let active=true;
  all(base44.entities.PlayerFotmobLink).then(links=>{if(active)setFotmobLinks(links)})
   .catch(e=>{if(active)setLinkError("No se pudieron cargar los vínculos FotMob–Base44: "+(e.message||"error desconocido"))});
  return()=>{active=false};
 },[]);
 useEffect(()=>{
  if(loading||!managers.length)return;
  const selected=managers.find(m=>String(m.id)===managerId)||managers[0];
  if(!selected)return;
  const selectedProfiles=profiles.filter(p=>String(p.manager_id)===String(selected.id));
  const next=selectedProfiles.find(p=>String(p.id)===profileId)||selectedProfiles.find(p=>p.is_default)||selectedProfiles[0];
  if(String(selected.id)!==managerId||String(next?.id||"")!==profileId)
   setParams({manager:String(selected.id),...(next?{profile:String(next.id)}:{})},{replace:true});
 },[loading,managers,profiles,managerId,profileId,setParams]);
 // Build statistical reference from the full role cohort, never from the
 // manually chosen scouting pool: restricting peers to the bag biases percentiles.
 const linkedSeasonStats=useMemo(()=>linkedManagerFitRows(seasonStats,fotmobLinks,players),[seasonStats,fotmobLinks,players]);
 const linkedUnderstat=useMemo(()=>linkedManagerFitRows(understatRows,fotmobLinks,players),[understatRows,fotmobLinks,players]);
 const historicalIndex=useMemo(()=>{
  const peers=historicalRoleCandidates(players,role);
  const result=new Map();
  for(const p of peers)result.set(String(p.id),{...collectPlayerSeasonMetrics(linkedSeasonStats,linkedUnderstat,season,p.id),__playerId:String(p.id)});
  return result;
 },[players,role,linkedSeasonStats,linkedUnderstat,season]);
 const historicalPeerMetrics=useMemo(()=>[...historicalIndex.values()],[historicalIndex]);
 const statsDiagnosis=useMemo(()=>{
  const playerIds=new Set(players.map(p=>String(p.id)));
  const matched=linkedSeasonStats.filter(r=>playerIds.has(String(r.player_id)));
  const unresolved=linkedSeasonStats.filter(r=>!playerIds.has(String(r.player_id)));
  const measured=historicalPeerMetrics.filter(r=>Object.values(r).some(v=>v&&typeof v==="object"&&typeof v.value==="number")).length;
  return {total:seasonStats.length,matched:matched.length,unresolved:unresolved.length,measured,peers:historicalPeerMetrics.length,links:fotmobLinks.length};
 },[linkedSeasonStats,seasonStats,players,historicalPeerMetrics,fotmobLinks]);
 const careerIndex=useMemo(()=>careerPositionFitIndex({dataset:fitDataset,players,links:fotmobLinks,role,profile}),[fitDataset,players,fotmobLinks,role,profile]);
 const roleRequirements=useMemo(()=>deriveRoleRequirements(profile,role),[profile,role]);
 const temporalContext=useMemo(()=>managerFitTemporalScope(profile,season),[profile,season]);
 const candidates=useMemo(()=>managerScoutingPool(players),[players]);
 const candidateIds=useMemo(()=>managerScoutingCandidateIds(players),[players]);
 const resultLimit=showAllResults?Number.POSITIVE_INFINITY:48;
 useEffect(()=>setShowAllResults(false),[role,profileId,season,scoreMode,search,minCA,minAge,maxAge,maxValueM,knownValueOnly,minimumCoverage,assignmentFilter]);
 const visibility=useMemo(()=>{
  if(!profile)return {rows:[],fallback:false,compatibleCount:0,scoredCount:0,unscoredCount:0,shownCount:0,displayCount:0};
  const rows=rankPlayers(candidates,role,profile,{search,minCA,showUnknown:true})
   .map(item=>{
    const evidence=historicalIndex.get(String(item.player.id))||{};
    const advanced=managerFitAttributes(item.player,role,profile);
    const roleFit=evaluateRoleRequirements(evidence,historicalPeerMetrics,role,profile,{playerId:item.player.id});
    const career=careerIndex.get(String(item.player.id))||null;
    return {...item,valuation:valuationForSeason(valuationRows,item.player.id,season),
     career,hybrid:evaluatePlayerSeasonHybrid({player:item.player,role,profile,advanced,career}),
     advanced,roleFit,
     historical:seasonPercentiles(evidence,historicalPeerMetrics,role,profile),
     deep:evaluateDeepFit({player:item.player,role,profile,roleFit,advanced,weights:deepWeights,season})};
   });
  const eligible=filterScoutingCandidates(rows,{season,
    minAge:minAge===""?null:Number(minAge),maxAge:maxAge===""?null:Number(maxAge),
    maxValueM:maxValueM===""?null:Number(maxValueM),knownValueOnly,minimumCoverage,coverageMode:scoreMode});
  const reservable=filterManagerPlayerAssignments(eligible,assignmentsIndex,managerId,assignmentFilter);
  return visibleManagerFitCandidates(reservable,{scoreMode,showUnknown:assignmentFilter==="available"?showUnknown:true,sortMode:resultSort,limit:resultLimit});
 },[candidates,role,profile,search,minCA,showUnknown,scoreMode,historicalIndex,historicalPeerMetrics,
    valuationRows,season,minAge,maxAge,maxValueM,knownValueOnly,minimumCoverage,resultSort,resultLimit,deepWeights,careerIndex,assignmentsIndex,assignmentFilter,managerId]);
 const results=visibility.rows;
 const comparedRows=useMemo(()=>{
  if(!profile||!comparedIds.length)return [];
  return compareCandidates(comparedIds.map(playerId=>{
   const player=players.find(p=>String(p.id)===String(playerId));
   if(!player||!candidateIds.has(String(player.id)))return null;
   const evidence=historicalIndex.get(String(player.id))||{};
   const roleFit=evaluateRoleRequirements(evidence,historicalPeerMetrics,role,profile,{playerId:player.id});
   const advanced=managerFitAttributes(player,role,profile);
   const career=careerIndex.get(String(player.id))||null;
   return {player,valuation:valuationForSeason(valuationRows,player.id,season),career,
    hybrid:evaluatePlayerSeasonHybrid({player,role,profile,advanced,career}),
    roleFit,advanced,deep:evaluateDeepFit({player,role,profile,roleFit,advanced,weights:deepWeights,season}),
    historical:seasonPercentiles(evidence,historicalPeerMetrics,role,profile)};
  }).filter(Boolean),comparedIds);
 },[profile,comparedIds,players,candidateIds,valuationRows,season,historicalIndex,historicalPeerMetrics,role,deepWeights,careerIndex]);
 const comparisonBudget=candidateOverview(comparedRows,totalBudget);
 const scoutingPlayer=candidates.find(p=>String(p.id)===scoutingPlayerId)||null;
 const scoutingRow=scoutingPlayer&&profile?{
  player:scoutingPlayer,advanced:managerFitAttributes(scoutingPlayer,role,profile),
  historical:seasonPercentiles(historicalIndex.get(String(scoutingPlayer.id))||{},historicalPeerMetrics,role,profile),
  roleFit:evaluateRoleRequirements(historicalIndex.get(String(scoutingPlayer.id))||{},historicalPeerMetrics,role,profile,{playerId:scoutingPlayer.id})
 }:null;
 const scoutingCareer=scoutingPlayer?careerIndex.get(String(scoutingPlayer.id))||null:null;
 const scoutingHybrid=scoutingRow?evaluatePlayerSeasonHybrid({player:scoutingPlayer,role,profile,advanced:scoutingRow.advanced,career:scoutingCareer}):null;
 const scoutingDeep=scoutingRow?evaluateDeepFit({player:scoutingPlayer,role,profile,
  roleFit:scoutingRow.roleFit,advanced:scoutingRow.advanced,weights:deepWeights,season}):null;
 const scoutingReport=scoutingRow?buildScoutingReport(scoutingPlayer,role,profile,season,scoutingRow.roleFit,scoutingRow.historical,scoutingRow.advanced):null;
 const scoutingComparison=scoutingRow?compareManagerProfiles(scoutingPlayer,role,season,profileOptions,historicalIndex.get(String(scoutingPlayer.id))||{},historicalPeerMetrics,evaluateRoleRequirements):[];
 const chooseManager=id=>{setScoutingPlayerId("");setComparedIds([]);
  const first=profiles.find(p=>String(p.manager_id)===String(id)&&p.is_default)||profiles.find(p=>String(p.manager_id)===String(id));
  setParams({manager:id,...(first?{profile:String(first.id)}:{})});
 };
 return <main className="mx-auto max-w-[1550px] px-3 md:px-6 py-2 text-slate-900 space-y-3">
  <div className="flex flex-wrap items-center justify-between gap-2">
   <h1 className="text-sm font-black tracking-wide text-slate-800">Manager Fit · Scouting táctico</h1>
   <Link to="/squad-planner" className="text-xs font-bold text-blue-700 hover:underline">Abrir planificador de plantilla</Link>
  </div>
  {error&&<p role="alert" className="p-3 border border-red-200 bg-red-50 rounded-lg text-sm text-red-800">{error}</p>}
  {assignmentNotice&&<div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-900">{assignmentNotice}</div>}
  {assignmentError&&<div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"><span>{assignmentError}</span><button type="button" onClick={reloadAssignments} className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 font-semibold">Reintentar lectura</button></div>}

  <section className="rounded-xl border border-slate-200 bg-white p-3 md:p-4 space-y-3" aria-label="Buscador de encaje táctico">
   <div className="flex flex-wrap items-center justify-between gap-2">
    <div><h2 className="text-sm font-black text-slate-900">Encuentra los futbolistas ideales</h2><p className="text-[11px] text-slate-500">Selecciona un entrenador, su etapa y una posición. El perfil histórico óptimo se calcula automáticamente.</p></div>
    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-800">{candidates.length} en tu bolsa</span>
   </div>
   <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
    <label className="text-xs font-bold">Entrenador<select aria-label="Entrenador" value={managerId} onChange={e=>chooseManager(e.target.value)} className="block w-full border rounded-lg p-2 mt-1 text-sm"><option value="">Seleccionar…</option>{managers.map(m=><option key={m.id} value={m.id}>{m.display_name||m.name}</option>)}</select></label>
    <label className="text-xs font-bold">ADN táctico<select aria-label="ADN táctico" value={profileId} onChange={e=>setParams({manager:managerId,profile:e.target.value})} className="block w-full border rounded-lg p-2 mt-1 text-sm"><option value="">Seleccionar…</option>{profileOptions.map(p=><option key={p.id} value={p.id}>{p.name} · {profileScopeLabel(p)}</option>)}</select></label>
   </div>
   <div className="space-y-2">
    <p className="text-xs font-bold text-slate-700">Posición buscada · <span className="text-blue-800">{ROLE_LABELS[role]}</span></p>
    <div className="flex flex-wrap gap-2" role="group" aria-label="Posición buscada">
     {Object.entries(ROLE_LABELS).map(([code,name])=><button key={code} type="button" aria-pressed={role===code} title={name} onClick={()=>setRole(code)} className={"rounded-lg border px-3 py-2 text-xs font-bold transition "+(role===code?"border-[#003399] bg-[#003399] text-white":"border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50")}>{code}</button>)}
    </div>
   </div>
   <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#f2f6fc] px-3 py-2">
    <div className="min-w-0"><strong className="text-xs text-blue-950">{scoreMode==="hybrid"?"Encaje integral 70/30":scoreMode==="career"?"Histórico de carrera":scoreMode==="deep"?"Deep Fit experimental":scoreMode==="role"?"ADN táctico V4":scoreMode==="historical"?"Histórico V3":scoreMode==="attributes"?"Atributos FM26 V2":"Adecuación posicional"}</strong><p className="text-[11px] text-slate-600">{scoreMode==="hybrid"?"70% atributos del jugador (FM26) + 30% rendimiento de su mejor temporada":scoreMode==="career"?"Histórico: mejor campaña y trayectoria":"Modo alternativo elegido en herramientas avanzadas"}</p></div>
    <button type="button" onClick={()=>{setScoreMode("hybrid");setResultSort("score")}} disabled={scoreMode==="hybrid"} className="rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-blue-800 disabled:opacity-50">{scoreMode==="hybrid"?"Modo principal":"Volver al principal"}</button>
   </div>
   <div className="flex flex-wrap items-center gap-2">
    <input aria-label="Buscar jugador" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar futbolista en tu bolsa…" className="min-w-[200px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"/>
    <Link to="/players?view=candidates" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-50">Gestionar bolsa</Link>
   </div>
   <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-100 bg-blue-50/50 px-3 py-2" aria-label="Estado de las adjudicaciones">
    <div className="flex flex-wrap items-center gap-2 text-xs"><strong className="text-blue-950">Proyecto de {manager?.display_name||manager?.name||"entrenador"}</strong>
     <span className="rounded-full bg-white px-2 py-1 font-bold text-blue-900">{assignmentCounts.linked} vinculados</span>
     <span className="rounded-full bg-white px-2 py-1 font-bold text-slate-700">{assignmentCounts.preselected} preseleccionados</span>
     {assignmentCounts.conflicts>0&&<span className="text-red-800">{assignmentCounts.conflicts} adjudicaciones por revisar</span>}
    </div>
    <span className="text-[10px] text-slate-500">{assignmentLoading?"Comprobando registros…":"Los vínculos no alteran plantillas ni puntuaciones"}</span>
   </div>
   <details className="rounded-xl border border-slate-200 bg-white p-3" aria-label="Jugadores adjudicados a este entrenador">
    <summary className="cursor-pointer text-xs font-bold text-slate-800">Mis jugadores vinculados y preseleccionados · {managerAssignments.length} <span className="font-normal text-slate-500">(todas las posiciones)</span></summary>
    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
     {managerAssignments.length===0?<p className="text-xs text-slate-500">Todavía no has adjudicado jugadores a este entrenador.</p>:managerAssignments.map(link=><div key={link.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2">
      <div className="min-w-0"><strong className="block truncate text-xs">{nameByPlayer.get(String(link.player_id))||"Jugador "+link.player_id}</strong><span className="text-[10px] text-slate-500">{link.role||"Sin rol"} · {link.status==="linked"?"Vinculado":"Preseleccionado"} · {link.history?.length||0} decisiones registradas</span></div>
      <div className="flex gap-1">
       {link.status==="preselected"&&<button type="button" disabled={!!assignmentBusy||assignmentLoading||!!assignmentError} onClick={()=>managePlayerAssignment(link.player_id,"link",link.role||role)} className="rounded-md border border-blue-200 bg-white px-2 py-1 text-[10px] font-semibold text-blue-800">Confirmar</button>}
       <button type="button" disabled={!!assignmentBusy||assignmentLoading||!!assignmentError} onClick={()=>managePlayerAssignment(link.player_id,"release",link.role||role)} className="rounded-md border border-red-200 bg-white px-2 py-1 text-[10px] font-semibold text-red-700">Liberar</button>
      </div>
      {Array.isArray(link.history)&&link.history.length>0&&<details className="w-full border-t border-slate-200 pt-1 text-[10px] text-slate-600"><summary className="cursor-pointer font-semibold">Ver historial ({link.history.length})</summary><div className="mt-1 space-y-1">{link.history.slice().reverse().map((event,i)=><p key={i}>{event.at?.slice(0,10)||"Sin fecha"} · {event.action==="link"?"Vinculado":event.action==="preselect"?"Preseleccionado":"Liberado"} · {nameByManager.get(String(event.from_manager_id))||"Sin entrenador previo"} → {nameByManager.get(String(event.to_manager_id))||"Sin entrenador"} · {event.role||"Sin rol"}</p>)}</div></details>}
     </div>)}
    </div>
   </details>
      {manager&&profile?<div className="text-xs rounded-lg bg-blue-50 p-3"><strong>{manager.name} · {profile.name}</strong><p className="mt-1"><strong>Lo que busca en {ROLE_LABELS[role].toLowerCase()}:</strong> {(()=>{try{return JSON.parse(profile.player_role_priorities||"{}")[role]||"Sin descripción específica"}catch{return "Sin descripción específica"}})()}</p></div>:!loading&&<p className="text-sm text-amber-700">Necesitas un entrenador con un ADN guardado antes de evaluar futbolistas. <Link className="underline" to="/managers">Abrir MANAGERS</Link>.</p>}

   <details className="group rounded-lg border border-slate-200 bg-slate-50/70 p-3" aria-label="Filtros avanzados">
    <summary className="cursor-pointer text-xs font-bold text-slate-700">Filtros avanzados · Edad, valor, CA y temporada</summary>
    <div className="mt-3 space-y-3">
        <div className="flex gap-2 flex-wrap text-sm"><label className="text-xs font-bold">{scoreMode==="career"||scoreMode==="hybrid"?"Temporada de referencia para filtros":"Temporada histórica"} <input aria-label="Temporada histórica" className="block rounded-lg border p-2 mt-1" value={season} onChange={e=>setSeason(e.target.value)} placeholder="2025/2026"/></label></div>

     <div className="max-w-[230px]">    <label className="text-xs font-bold">CA mínimo (FM26)<input aria-label="CA mínimo" type="number" min="0" max="200" value={minCA} onChange={e=>setMinCA(Math.max(0,Math.min(200,Number(e.target.value)||0)))} className="block w-full border rounded-lg p-2 mt-1 text-sm"/></label>
</div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 rounded-xl border bg-slate-50 p-3">
    <label className="text-xs font-bold">Edad mínima<input aria-label="Edad mínima" className="block border bg-white rounded-lg p-2 w-full mt-1" type="number" min="0" max="60" value={minAge} onChange={e=>setMinAge(e.target.value)}/></label>
    <label className="text-xs font-bold">Edad máxima<input aria-label="Edad máxima" className="block border bg-white rounded-lg p-2 w-full mt-1" type="number" min="0" max="60" value={maxAge} onChange={e=>setMaxAge(e.target.value)}/></label>
    <label className="text-xs font-bold">Valor máximo (M€)<input aria-label="Valor máximo" className="block border bg-white rounded-lg p-2 w-full mt-1" type="number" min="0" step="0.5" value={maxValueM} onChange={e=>setMaxValueM(e.target.value)}/></label>
    <label className="text-xs font-bold">Cobertura mínima<select aria-label="Cobertura mínima" className="block border bg-white rounded-lg p-2 w-full mt-1" value={minimumCoverage} onChange={e=>setMinimumCoverage(Number(e.target.value))}>{[0,25,50,75,100].map(x=><option key={x} value={x}>{x}%</option>)}</select></label>
    <label className="text-xs font-bold flex flex-col justify-center gap-2"><span>Valor histórico</span><span className="flex gap-2 font-normal items-center"><input type="checkbox" checked={knownValueOnly} onChange={e=>setKnownValueOnly(e.target.checked)}/> Solo con valor</span></label>
   </div>

     <p className="text-[11px] text-slate-500">En el modo principal 70/30, la temporada del selector solo afecta a los filtros de edad y valor; el 30% procede de la mejor campaña histórica evaluable. No limita la búsqueda de la mejor campaña.</p>
    </div>
   </details>
   <details className="rounded-lg border border-slate-200 bg-white p-3" aria-label="Modelos y herramientas avanzadas">
    <summary className="cursor-pointer text-xs font-bold text-slate-700">Modelos y herramientas avanzadas · V1–V4 y Deep Fit</summary>
    <div className="mt-3 space-y-3">
     <p className="text-[11px] text-slate-600">El encaje integral 70/30 es el modo principal. Los modelos históricos y experimentales se mantienen para análisis específicos.</p>
   <div className="grid grid-cols-2 gap-2 lg:grid-cols-7" role="group" aria-label="Modelo de evaluación">
    {[
     {key:"hybrid",title:"ENCAJE INTEGRAL 70/30",note:"70% atributos FM26 + 30% mejor temporada real"},
     {key:"career",title:"Histórico de carrera",note:"70% mejor temporada + 30% trayectoria en la posición"},
     {key:"deep",title:"Deep Fit · Cruce real + FM26",note:"Funciones tácticas · 2 fuentes · experimental"},
     {key:"role",title:"V4 · ADN del entrenador",note:"Requisitos medidos · experimental"},
     {key:"historical",title:"V3 · Histórico",note:"FotMob + Understat · por temporada"},
     {key:"attributes",title:"V2 · Atributos FM26",note:"Estimación del videojuego"},
     {key:"position",title:"V1 · Posición",note:"Adecuación básica"}
    ].map(model=><button key={model.key} type="button" aria-pressed={scoreMode===model.key}
     onClick={()=>{setScoreMode(model.key);setResultSort("score")}}
     className={"rounded-xl border px-3 py-3 text-left transition "+(scoreMode===model.key?"border-[#003399] bg-[#003399] text-white shadow-sm":"border-slate-200 bg-slate-50 text-slate-900 hover:border-blue-200 hover:bg-white")}>
      <span className="block text-[12px] font-extrabold">{model.title}</span>
      <span className={"mt-1 block text-[10px] leading-4 "+(scoreMode===model.key?"text-blue-100":"text-slate-500")}>{model.note}</span>
    </button>)}
   </div>
   {scoreMode==="deep"&&<section aria-label="Laboratorio Deep Fit" className="rounded-xl border border-blue-200 bg-[#f1f5fb] p-3 space-y-3">
    <div className="flex flex-wrap items-start justify-between gap-2">
     <div><h3 className="text-sm font-black text-blue-950">Deep Fit · Laboratorio de encaje táctico</h3>
      <p className="mt-1 text-xs text-slate-700">Una función del ADN debe ser evaluable tanto en las estadísticas históricas V4 como en los atributos FM26. La nota conjunta es experimental: no predice el rendimiento ni cambia tu bolsa.</p>
      <p className="mt-1 text-[11px] text-slate-600">Datos FM26 actuales frente a registros históricos de {season}. No se asume que los atributos del videojuego fueran idénticos en temporadas anteriores.</p>
     </div>
     <span className="rounded-lg border border-blue-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-blue-900">{profileScopeLabel(profile)} · {season}</span>
    </div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Ponderación del encaje">
     {[["balanced","Equilibrado"],["historical","Prioridad datos reales"],["tactical","Prioridad ADN FM26"],["custom","Personalizar"]].map(([key,label])=>
      <button key={key} type="button" aria-pressed={deepPreset===key}
       onClick={()=>{if(key==="custom"&&deepPreset!=="custom")setCustomDeepWeights({...deepWeights});setDeepPreset(key)}}
       className={"rounded-lg border px-2 py-2 text-xs font-bold "+(deepPreset===key?"border-blue-800 bg-blue-900 text-white":"border-slate-200 bg-white text-slate-700 hover:border-blue-400")}>{label}</button>)}
    </div>
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
     {Object.entries(DEEP_COMPONENT_LABELS).map(([key,label])=><label key={key}
      className="rounded-lg border border-slate-200 bg-white p-2 text-[11px] text-slate-600">
      <span className="block min-h-[33px] font-semibold text-slate-800">{label}</span>
      <strong className="text-base tabular-nums text-blue-900">{Math.round(100*(deepWeights[key]||0)/Object.values(deepWeights).reduce((sum,n)=>sum+n,0)||0)}%</strong>
      {deepPreset==="custom"&&<input aria-label={"Peso "+label} type="range" min={key==="historical"||key==="functions"?5:0} max="100" step="5"
       value={deepWeights[key]} onChange={e=>setCustomDeepWeights(p=>({...p,[key]:Number(e.target.value)}))}
       className="mt-1 block w-full accent-blue-800"/>}
     </label>)}
    </div>
    <p className={"rounded-lg border px-3 py-2 text-[11px] "+(temporalContext.status==="counterfactual"?"border-amber-200 bg-amber-50 text-amber-900":"border-slate-200 bg-white text-slate-700")}>
     <strong>{temporalContext.label}.</strong> {temporalContext.warning}
    </p>
    <p className="text-[11px] text-slate-600">Se normalizan los pesos que elijas; si falta el estilo FM26, ese peso se redistribuye entre factores disponibles. Datos reales V4 y atributos funcionales FM26 son obligatorios. CA, valor de mercado, fama y precio no entran en la nota.</p>
   </section>}

    </div>
   </details>
  </section>
  <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4 md:p-5 space-y-4">
   <div className="flex flex-wrap items-center justify-between gap-2">
    <div><p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#315fa7]">Manager Fit · Análisis comparativo</p>
     <h2 className="mt-1 text-base font-black text-slate-900">Resultados {loading?"· Cargando…":"· "+results.length+" mostrados"}</h2><p className="text-[11px] text-slate-500">{visibility.compatibleCount} compatibles en la bolsa · {visibility.scoredCount} evaluables en el modelo seleccionado · {players.length} jugadores del catálogo para la muestra histórica</p></div>
    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-semibold text-slate-600">Modelo auditable · No predice rendimiento</span>
   </div>
   <details className="rounded-lg border border-slate-200 bg-slate-50/70 p-3" aria-label="Diagnóstico y metodología de evaluación">
    <summary className="cursor-pointer text-xs font-semibold text-slate-700">Metodología y diagnóstico · Ver evidencia detallada</summary>
    <div className="mt-3 space-y-3">
   {scoreMode==="hybrid"&&<p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-950">Nota principal: 70% atributos FM26 del jugador para la posición (incluidas las funciones del ADN cuando hay datos) + 30% rendimiento real de su mejor temporada histórica evaluable. Ambos componentes son obligatorios. CA, PA y mercado no forman parte de la puntuación; las fuentes y épocas se muestran por separado.</p>}
   {scoreMode==="career"&&<p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-950">Perfil histórico por posición: cada campaña se puntúa por separado frente a una referencia histórica de otros jugadores del mismo rol (cada jugador comparable cuenta una vez). Se utiliza el 70% de la mejor campaña evaluable y el 30% de la media de campañas evaluables ponderada por minutos (máximo 3000 por campaña). Se requieren dos métricas y diez jugadores históricos comparables por indicador, al menos 450 minutos y posición histórica identificada. Una única campaña válida se señala como tal.</p>}
   <ManagerScoutingSummary scoreMode={scoreMode} visibility={visibility} roleRequirements={roleRequirements} statsLoading={statsLoading} statsError={statsError} season={season}/>
   {scoreMode==="career"&&<p className="text-[11px] text-slate-600">Evaluación histórica: {careerIndex.size} jugadores con nota · {careerIndex.diagnostics?.eligible??0} temporadas compatibles con el rol · {careerIndex.diagnostics?.withTwoMetrics??0} temporadas con al menos dos indicadores detectados · {careerIndex.diagnostics?.scoredSeasons??0} temporadas puntuadas · {careerIndex.diagnostics?.roleRequirements??0} indicadores exigidos por el ADN. La temporada del selector solo afecta a los filtros de edad y valor.</p>}
   <details className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
    <summary className="cursor-pointer font-semibold">Diagnóstico de datos · {statsDiagnosis.matched}/{statsDiagnosis.total} registros vinculados · {statsDiagnosis.measured} jugadores con métricas reconocidas</summary>
    <p className="mt-2">Temporada {season}: {statsDiagnosis.total} registros FotMob; {statsDiagnosis.matched} asociados a jugadores de MF Legacy; {statsDiagnosis.unresolved} sin vínculo resoluble; {statsDiagnosis.links} relaciones FotMob–Base44; {statsDiagnosis.measured}/{statsDiagnosis.peers} jugadores de la cohorte con al menos una métrica reconocida.</p>
    <p className="mt-1">Los registros sin vínculo no se asignan por similitud de nombre. Cada nota V4 requiere además dos métricas válidas y diez comparables externos por indicador.</p>
    {linkError&&<p role="alert" className="mt-1 text-red-700">{linkError}</p>}
   </details>
    </div>
   </details>
   {progressiveMode&&<div role="status" className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-950">
    <strong>{progressive.complete?"Historial cargado":"Historial en actualización"}:</strong> {progressive.loadedSeasons.length}/{progressive.totalSeasons??"?"} temporadas completas · {progressive.rows.length} registros de STATS · {careerIndex.diagnostics?.eligible??0} campañas compatibles con el rol · {careerIndex.diagnostics?.scoredSeasons??0} campañas puntuables · {careerIndex.size} jugadores con evaluación histórica.
    {!progressive.complete&&<span> Las puntuaciones pueden cambiar al incorporar otras temporadas; todavía no se confirma la mejor campaña histórica.</span>}
    {statsError&&<p className="mt-1 text-amber-900">Error de carga: {statsError}</p>}
    {progressive.failedSeasons.length>0&&<p className="mt-1">Temporadas pendientes: {progressive.failedSeasons.map(x=>x.season).join(", ")}.</p>}
    <button type="button" onClick={progressive.retry} className="ml-2 rounded border border-blue-300 bg-white px-2 py-1 font-bold">Recargar temporadas de STATS</button>
   </div>}
   {assignmentFilter==="available"&&visibility.fallback&&!statsLoading&&<p role="status" className="rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 text-xs text-slate-700">
    {scoreMode==="deep"?<>
     El cruce entre fuentes todavía no permite calcular una nota Deep Fit. Los candidatos se ordenan como <strong>preselección funcional FM26</strong> cuando el ADN dispone de atributos medibles; después por adecuación posicional. No se confunden estas notas del videojuego con rendimiento histórico.
    </>:<>
     Los resultados se presentan por <strong>adecuación posicional</strong> porque este modo todavía no puede asignar puntuación con la evidencia disponible. No se ha inventado ninguna nota táctica.
    </>}
   </p>}
   {!loading&&!statsLoading&&!visibility.fallback&&visibility.unscoredCount>0&&visibility.scoredCount>0&&!showUnknown&&<p className="text-xs text-slate-500">Hay {visibility.unscoredCount} jugadores compatibles sin evaluación. Activa «Incluir encaje no evaluable» para mostrarlos.</p>}
   <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar por adjudicación">
    {[["available","Disponibles"],["preselected","Preseleccionados"],["linked","Vinculados"],["all","Todos"]].map(([value,label])=>
     <button key={value} type="button" aria-pressed={assignmentFilter===value} onClick={()=>setAssignmentFilter(value)} className={"rounded-lg border px-3 py-2 text-xs font-semibold "+(assignmentFilter===value?"border-[#003399] bg-[#003399] text-white":"border-slate-200 bg-white text-slate-700 hover:bg-slate-50")}>{label}</button>)}
    <span className="text-[11px] text-slate-500">La adjudicación es manual y no depende de la nota.</span>
   </div>
   <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
    <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-700">Ordenar resultados
     <select aria-label="Orden de resultados V4" value={resultSort} onChange={e=>setResultSort(e.target.value)}
      className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs">
      <option value="score">Mayor encaje en el modo</option>
      {(scoreMode==="role"||scoreMode==="deep")&&<option value="coverage">Mayor cobertura de requisitos {scoreMode==="deep"?"FM26":"V4"}</option>}
      {scoreMode==="deep"&&<option value="functions">Mayor aptitud funcional FM26</option>}
      <option value="position">Mayor adecuación posicional FM26</option>
     </select>
    </label>
    {assignmentFilter==="available"&&visibility.unscoredCount>0&&scoreMode!=="position"&&
     <button type="button" onClick={()=>{setShowUnknown(v=>!v);setShowAllResults(!showUnknown)}}
      className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-[11px] font-bold text-blue-800 hover:bg-blue-50">
      {showUnknown?"Ocultar jugadores sin nota":"Mostrar todos los "+visibility.unscoredCount+" compatibles sin puntuación de la bolsa"}
     </button>}
   </div>
   {statsLoading&&<p role="status" className="text-xs font-semibold text-blue-700">Cargando métricas históricas de {season}…</p>}
   <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
    {results.map(item=><ScoutingCandidateCard key={item.player.id} item={item} scoreMode={scoreMode}
     age={ageOnSeason(item.player,season)}
     valueText={formatTransferValue(item.valuation?.eur)}
     selected={comparedIds.includes(String(item.player.id))}
     compareDisabled={!comparedIds.includes(String(item.player.id))&&comparedIds.length>=MAX_COMPARE}
     onCompare={()=>setComparedIds(prev=>toggleCandidate(prev,item.player.id))}
     onReport={()=>setScoutingPlayerId(String(item.player.id))}
     assignment={assignmentsIndex.byPlayer.get(String(item.player.id))||null}
     assignmentConflict={assignmentsIndex.conflicts.has(String(item.player.id))}
     assignmentOwner={nameByManager.get(String(assignmentsIndex.byPlayer.get(String(item.player.id))?.manager_id))||""}
     currentManagerId={managerId}
     assignmentDisabled={assignmentLoading||!!assignmentError||!!assignmentBusy}
     assignmentBusy={assignmentBusy===String(item.player.id)}
     onPreselect={()=>managePlayerAssignment(item.player.id,"preselect")}
     onLink={()=>managePlayerAssignment(item.player.id,"link")}
     onRelease={()=>managePlayerAssignment(item.player.id,"release")}/>)}
   </div>
   {!loading&&visibility.displayCount>visibility.shownCount&&<div className="flex flex-col items-center gap-2 border-t border-slate-100 pt-4">
    <span className="text-xs text-slate-500">Mostrando {visibility.shownCount} de {visibility.displayCount} jugadores del filtro actual.</span>
    <button type="button" onClick={()=>setShowAllResults(true)}
     className="rounded-lg border border-blue-200 bg-blue-50 px-5 py-2.5 text-xs font-bold text-blue-900 hover:bg-blue-100">
     Mostrar todos los {visibility.displayCount} resultados de la bolsa
    </button>
   </div>}
   <ManagerMethodsPanel/>
   <section className="mt-5 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-3 md:p-4 space-y-3" aria-label="Comparador de fichajes">
     <div className="flex flex-wrap justify-between items-start gap-2"><div><h3 className="font-black">Comparador de candidatos · V7</h3><p className="text-xs text-slate-600">{comparedIds.length}/{MAX_COMPARE} seleccionados · Misma temporada, rol y ADN del entrenador.</p></div><button type="button" className="text-xs font-bold rounded-lg border px-3 py-2 bg-white" onClick={()=>setComparedIds([])} disabled={!comparedIds.length}>Limpiar selección</button></div>
     <div className="flex flex-wrap items-center gap-3 text-xs">
      <label className="font-bold">Presupuesto total (M€) <input aria-label="Presupuesto total" type="number" min="0" step="0.5" className="border rounded-lg p-2 ml-2 w-28 bg-white" value={totalBudget} onChange={e=>setTotalBudget(e.target.value)}/></label>
      <span>{comparisonBudget.priced}/{comparisonBudget.selected} candidatos con valor histórico · Total conocido {formatTransferValue(comparisonBudget.totalKnownEur)}</span>
      {comparisonBudget.budgetEur!==null&&<strong>{comparisonBudget.withinBudget===null?"Presupuesto no comprobable: faltan valores":comparisonBudget.withinBudget?"Importes conocidos dentro del límite":"Los valores históricos superan el presupuesto"}</strong>}
     </div>
     {comparedRows.length?<div className="overflow-x-auto"><table className="min-w-[650px] w-full text-xs bg-white rounded-lg border border-collapse"><thead><tr className="bg-slate-100"><th className="p-3 text-left">Indicador</th>{comparedRows.map(r=><th className="p-3 text-left" key={r.player.id}>{r.player.name}</th>)}</tr></thead><tbody>
      {[
       ["Encaje integral 70/30",r=>r.hybrid?.score===null||r.hybrid?.score===undefined?"—":r.hybrid.score+"/100"],
       ["70% · Atributos FM26",r=>r.hybrid?.fmScore===null||r.hybrid?.fmScore===undefined?"—":r.hybrid.fmScore+"/100"],
       ["30% · Rendimiento real",r=>r.hybrid?.seasonScore===null||r.hybrid?.seasonScore===undefined?"—":r.hybrid.seasonScore+"/100 · "+r.hybrid.season],
       ["Deep Fit combinado",r=>r.deep.score===null?"—":r.deep.score+"/100"],
       ["Funciones ADN en FM26",r=>r.deep.functions.score===null?"—":r.deep.functions.score+"/100"],
       ["Preselección funcional FM26",r=>r.deep.preliminaryScore===null?"—":r.deep.preliminaryScore+"/100"],
       ["Rasgos FM26 sin medida histórica",r=>r.deep.fmOnlyTraits.score===null?"—":r.deep.fmOnlyTraits.score+"/100"],
       ["Confianza Deep Fit",r=>r.deep.confidence],
       ["Encaje rol V4",r=>r.roleFit.score===null?"—":r.roleFit.score+"/100"],
       ["Cobertura del rol",r=>r.roleFit.coverage+"%"],
       ["Confianza",r=>r.roleFit.confidence],
       ["Histórico general V3",r=>r.historical.score===null?"—":r.historical.score+"/100"],
       ["Atributos FM26 V2",r=>r.advanced.score===null?"—":r.advanced.score+"/100"],
       ["CA de FM26",r=>r.advanced.quality??"—"],
       ["Edad histórica",r=>ageOnSeason(r.player,season)??"—"],
       ["Valor Transfermarkt",r=>formatTransferValue(r.valuation?.eur)],
       ["Estado valor",r=>r.valuation?.status||"Sin datos"]
      ].map(([name,fn])=><tr key={name} className="border-t"><th className="p-2 text-left font-semibold whitespace-nowrap">{name}</th>{comparedRows.map(r=><td key={r.player.id} className="p-2 tabular-nums">{fn(r)}</td>)}</tr>)}
     </tbody></table></div>:<p className="text-xs text-slate-500 bg-white rounded-lg border p-4">Selecciona entre dos y cuatro jugadores con «Comparar +» para enfrentarlos en una tabla. También puedes evaluar uno solo.</p>}
     <p className="text-[11px] text-slate-600">Las notas se mantienen separadas. La suma de valores históricos no equivale a un precio de compra ni incluye salarios. Si falta alguna valoración, no se confirma que el presupuesto sea suficiente.</p>
   </section>
   {scoutingReport&&<section className="mt-5 rounded-2xl border-2 border-blue-200 bg-slate-50 p-4 space-y-4" aria-label="Informe individual de scouting">
     <div className="flex flex-wrap justify-between gap-2 items-start">
      <div><p className="text-[11px] uppercase font-bold text-blue-700">Informe individual · {season}</p>
       <h3 className="font-black text-xl">{scoutingReport.playerName}</h3>
       <p className="text-xs text-slate-600">{scoutingReport.profileName} · {ROLE_LABELS[role]}</p></div>
      <button type="button" onClick={()=>setScoutingPlayerId("")} className="rounded-lg border px-3 py-2 text-xs font-bold bg-white">Cerrar informe</button>
     </div>
     <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
      {[["Deep Fit experimental",scoutingDeep?.score===null?"—":scoutingDeep?.score+"/100"],["Encaje por requisitos",scoutingReport.fit===null?"—":scoutingReport.fit+"/100"],["Histórico general",scoutingReport.historicalScore===null?"—":scoutingReport.historicalScore+"/100"],["Atributos FM26",scoutingReport.attributeScore===null?"—":scoutingReport.attributeScore+"/100"],["CA independiente",scoutingReport.ca===null?"—":scoutingReport.ca+"/200"]].map(([k,v])=><div key={k} className="rounded-xl bg-white border p-3"><p className="text-[11px] text-slate-500">{k}</p><strong className="text-xl tabular-nums">{v}</strong></div>)}
     </div>
     {scoutingHybrid&&<section className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs space-y-1" aria-label="Encaje integral 70 30"><h4 className="font-black text-blue-900">Encaje integral 70/30 · {scoutingHybrid.score===null?"Sin valoración conjunta":scoutingHybrid.score+"/100"}</h4><p><strong>70% FM26:</strong> {scoutingHybrid.fmScore===null?"Sin datos suficientes":scoutingHybrid.fmScore+"/100"} · <strong>30% rendimiento real:</strong> {scoutingHybrid.seasonScore===null?"Sin campaña evaluable":scoutingHybrid.seasonScore+"/100 · "+scoutingHybrid.season}</p><p>La mejor campaña real se evalúa por separado. {scoutingHybrid.seasonBasis==="position"?"Referencia estadística por posición; ADN no medible en ese rol.":"El histórico utiliza los requisitos de ADN medibles."} No se sustituyen datos ausentes por cero.</p></section>}
     {scoutingCareer&&<section className="rounded-lg border border-blue-200 bg-white p-3 text-xs space-y-1" aria-label="Perfil histórico óptimo del jugador">
      <h4 className="font-black text-blue-900">Perfil histórico óptimo · {scoutingCareer.score}/100</h4>
      <p><strong>Mejor campaña ({scoutingCareer.bestSeason}):</strong> {scoutingCareer.bestScore}/100 · <strong>Trayectoria en esta posición:</strong> {scoutingCareer.careerScore===null?"una campaña válida":scoutingCareer.careerScore+"/100 en "+scoutingCareer.seasonCount+" campañas"}.</p>
      <p>{scoutingCareer.method}. Referencia histórica de jugadores distintos del mismo rol; las métricas reales pertenecen a cada campaña y no se mezclan como si fueran una temporada.</p>
      <p>Campañas evaluables: {scoutingCareer.seasons.map(r=>r.season+" ("+r.score+"/100)").join(" · ")}</p>
     </section>}
     <p className="text-sm font-medium">{scoutingReport.fitLabel}. {scoutingReport.summary}</p>
     {scoutingDeep&&<section aria-label="Informe Deep Fit por fuentes" className="rounded-xl border border-blue-200 bg-white p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3"><h4 className="font-bold text-sm">Deep Fit · Evidencia histórica y perfil funcional FM26</h4>
       <strong className="text-sm text-blue-900">{scoutingDeep.score===null?"Sin nota conjunta":scoutingDeep.score+"/100 · Confianza "+(scoutingDeep.confidence==="medium"?"media":"baja")}</strong>
      </div>
      <p className="text-xs text-slate-600">{scoutingDeep.explanation} Requisitos compartidos entre fuentes: {scoutingDeep.sharedFunctions.length}.</p>
      {scoutingDeep.sensitivityRange&&<div className="rounded-lg border border-indigo-100 bg-indigo-50/50 px-3 py-2 text-xs text-indigo-900">
       <strong>Sensibilidad de ponderaciones: {scoutingDeep.sensitivityRange.min}–{scoutingDeep.sensitivityRange.max}/100.</strong>
       {" "}Equilibrado {scoutingDeep.sensitivity.balanced} · Datos reales {scoutingDeep.sensitivity.historical} · Funciones FM26 {scoutingDeep.sensitivity.tactical}.
       Este intervalo es una prueba de sensibilidad entre escenarios, NO un intervalo estadístico de confianza.
      </div>}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">{scoutingDeep.components.map(component=>
       <div key={component.key} className="rounded-lg bg-slate-50 p-2">
        <p className="min-h-[34px] text-[11px] font-semibold text-slate-700">{DEEP_COMPONENT_LABELS[component.key]}</p>
        <strong className="text-xl tabular-nums text-blue-950">{component.score===null?"—":component.score+"/100"}</strong>
        <p className="text-[10px] text-slate-500">Peso efectivo: {component.effectiveWeight}%</p>
       </div>)}</div>
      <div className="space-y-2">
       <h5 className="text-xs font-bold text-slate-800">Requisitos del entrenador y atributos FM26 asociados</h5>
       {scoutingDeep.functions.families.length?scoutingDeep.functions.families.map(family=>
        <div key={family.id} className="rounded-lg border border-slate-100 p-2.5 space-y-1">
         <div className="flex items-start justify-between gap-2"><strong className="text-xs text-slate-800">{family.label}</strong><strong className="text-xs tabular-nums text-blue-900">{family.score===null?"—":family.score+"/100"}</strong></div>
         <p className="text-[11px] text-slate-600">{family.found}/{family.requested} atributos FM26 observados · No es una medición de rendimiento real</p>
         <div className="flex flex-wrap gap-1">{family.evidence.map(attribute=><span key={attribute.key} className="rounded-md bg-slate-50 px-2 py-1 text-[11px] text-slate-700">{attribute.label} <strong>{attribute.raw??"—"}/20</strong></span>)}</div>
        </div>):<p className="text-xs text-amber-900">El ADN del entrenador no describe funciones vinculables a estos atributos.</p>}
      </div>
      {!!scoutingDeep.fmOnlyTraits.families.length&&<div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3 space-y-2">
       <h5 className="text-xs font-bold text-amber-950">Rasgos solicitados sin medida histórica · Evaluación SOLO FM26</h5>
       {scoutingDeep.fmOnlyTraits.families.map(f=><div key={f.label} className="rounded-lg bg-white p-2">
        <div className="flex justify-between gap-2 text-xs"><strong>{f.label}</strong><strong>{f.score===null?"—":f.score+"/100 FM26"}</strong></div>
        <p className="mt-1 text-[11px] text-slate-700">{f.evidence.map(x=>x.label+" "+(x.raw??"—")+"/20").join(" · ")}</p>
       </div>)}
       <p className="text-[11px] text-amber-900">Estos rasgos ayudan a preseleccionar candidatos, pero NO se añaden como estadísticas observadas ni compensan datos históricos ausentes.</p>
      </div>}
      {!!scoutingDeep.missing.length&&<div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900"><strong>Qué impide calcular el encaje combinado:</strong>{scoutingDeep.missing.map(x=><p key={x} className="mt-1">{x}</p>)}</div>}
      {!!scoutingDeep.caution.length&&<div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600"><strong>Advertencias de interpretación:</strong>{scoutingDeep.caution.map(x=><p key={x} className="mt-1">{x}</p>)}</div>}
     </section>}
     {!!scoutingReport.functionBreakdown.length&&<div className="rounded-xl border bg-white p-3 space-y-2">
      <h4 className="text-sm font-bold">Ajuste por funciones exigidas en el ADN (V4.1)</h4>
      <p className="text-[11px] text-slate-500">Cada función evaluable tiene el mismo peso, independientemente de cuántas métricas incluye. Los valores «—» no se completan con estimaciones.</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
       {scoutingReport.functionBreakdown.map(f=><div key={f.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
        <div className="flex items-start justify-between gap-2">
         <p className="text-xs font-semibold text-slate-800">{f.label}</p>
         <strong className="shrink-0 tabular-nums text-blue-900">{f.score===null?"—":f.score+"/100"}</strong>
        </div>
        <p className="mt-1 text-[11px] text-slate-500">{f.measured}/{f.requested} indicadores con muestra suficiente</p>
        <div className="mt-2 h-1.5 rounded-full bg-slate-200 overflow-hidden"><div className="h-full bg-blue-600" style={{width:f.coverage+"%"}}/></div>
       </div>)}
      </div>
     </div>}
     <p className="text-xs text-slate-600">Cobertura de requisitos {scoutingReport.coverage}% · Confianza {scoutingReport.confidence} · {scoutingReport.minimumPeers||"—"} comparables externos como mínimo · {scoutingReport.unmeasured} indicadores no evaluados</p>
     <div className="grid md:grid-cols-2 gap-3">
      <div className="rounded-xl border bg-white p-3"><h4 className="text-sm font-bold text-emerald-800">Fortalezas observadas (P70+)</h4>
       {scoutingReport.strengths.length?<ul className="mt-2 space-y-1 text-xs">{scoutingReport.strengths.map(m=><li key={m.key}>{SCOUT_METRIC_NAMES[m.key]||m.key}: <b>P{m.percentile}</b> · {m.source||"Fuente no indicada"} · {m.peerCount} comparables</li>)}</ul>:<p className="text-xs text-slate-500 mt-2">Sin indicadores evaluados en P70 o superior.</p>}
      </div>
      <div className="rounded-xl border bg-white p-3"><h4 className="text-sm font-bold text-amber-800">Áreas de menor rendimiento relativo (P35 o menos)</h4>
       {scoutingReport.weaknesses.length?<ul className="mt-2 space-y-1 text-xs">{scoutingReport.weaknesses.map(m=><li key={m.key}>{SCOUT_METRIC_NAMES[m.key]||m.key}: <b>P{m.percentile}</b> · {m.source||"Fuente no indicada"} · {m.peerCount} comparables</li>)}</ul>:<p className="text-xs text-slate-500 mt-2">Sin indicadores evaluados en P35 o inferior; no implica ausencia de debilidades.</p>}
      </div>
     </div>
     <div className="rounded-xl border bg-white p-3"><h4 className="text-sm font-bold">Comparación del mismo jugador entre los ADN del entrenador</h4>
      <p className="text-xs text-slate-500 mt-1">Misma temporada y rol; los requisitos cambian según el modelo. Un «—» significa evidencia insuficiente.</p>
      <div className="mt-2 space-y-2">{scoutingComparison.map(m=><div key={m.id} className="flex gap-3 items-center justify-between border-b pb-2 text-xs"><div className="min-w-0"><strong>{m.name}</strong> {m.is_default?"· Principal":""}<p className="text-slate-500">Cobertura {m.coverage}% · {m.evaluated} métricas</p></div><strong className="text-sm tabular-nums">{m.fit===null?"—":m.fit+"/100"}</strong></div>)}</div>
     </div>
     <p className="text-xs border-l-2 border-amber-400 pl-3 text-slate-600">{scoutingReport.limitations} Los percentiles son relativos a la muestra disponible, no equivalen a predicciones de éxito bajo el entrenador. Las descripciones sin métricas comprobables no se puntúan.</p>
   </section>}
   {!loading&&!results.length&&!statsLoading&&<div className="p-5 text-center text-slate-600 text-sm space-y-2">
    <p>{candidates.length===0?"Tu bolsa de candidatos está vacía. Añade futbolistas desde PLAYERS para comenzar.":
      "No hay futbolistas de tu bolsa que cumplan el rol y los filtros actuales. Prueba a cambiar el rol o los filtros; los demás jugadores del catálogo no se incorporan automáticamente."}</p>
    <Link to="/players?view=candidates" className="inline-block rounded-lg border border-blue-200 px-3 py-2 font-bold text-blue-800 hover:bg-blue-50">Ver bolsa de candidatos en PLAYERS</Link>
   </div>}
  </section>
 </main>;
}
