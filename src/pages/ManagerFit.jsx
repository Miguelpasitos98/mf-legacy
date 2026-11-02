import React,{useEffect,useMemo,useState} from "react";
import {Link,useSearchParams} from "react-router-dom";
import {base44} from "@/api/base44Client";
import PlayerPortrait from "@/components/teams/PlayerPortrait";
import {ManagerScoutingSummary,ScoutingCandidateCard,ManagerMethodsPanel} from "@/components/managers/ManagerScoutingVisual";
import {ROLE_LABELS,rankPlayers} from "@/components/managers/managerFit.mjs";
import {collectPlayerSeasonMetrics,seasonPercentiles,historicalRoleCandidates} from "@/components/managers/managerFitHistorical.mjs";
import {evaluateRoleRequirements,deriveRoleRequirements} from "@/components/managers/managerRoleFit.mjs";
import {buildScoutingReport,compareManagerProfiles,SCOUT_METRIC_NAMES} from "@/components/managers/managerScoutingReport.mjs";
import {ageOnSeason,valuationForSeason,filterScoutingCandidates,formatTransferValue} from "@/components/managers/managerTransferScout.mjs";
import {MAX_COMPARE,toggleCandidate,compareCandidates,candidateOverview} from "@/components/managers/managerCandidateCompare.mjs";
import {managerFitAttributes} from "@/components/managers/managerFitAttributes.mjs";
import {profileScopeLabel} from "@/components/managers/managerModel.mjs";
import {visibleManagerFitCandidates} from "@/components/managers/managerFitVisibility.mjs";
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
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [role,setRole]=useState(()=>["GK","CB","FB","DM","AM","WG","ST"].includes(params.get("role"))?params.get("role"):"FB");
 const [search,setSearch]=useState("");
 const [minCA,setMinCA]=useState(0);
 const [showUnknown,setShowUnknown]=useState(false);
 const [scoreMode,setScoreMode]=useState("role");
 const [season,setSeason]=useState(()=>params.get("season")||"2025/2026");
 const [seasonStats,setSeasonStats]=useState([]);
 const [understatRows,setUnderstatRows]=useState([]);
 const [statsLoading,setStatsLoading]=useState(false);
 const [statsError,setStatsError]=useState("");
 const [scoutingPlayerId,setScoutingPlayerId]=useState("");
 const [valuationRows,setValuationRows]=useState([]);
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
 useEffect(()=>{
  let active=true;
  Promise.all([all(base44.entities.Manager),all(base44.entities.ManagerTacticalProfile),all(base44.entities.Player)])
   .then(([m,p,pl])=>{if(!active)return;setManagers(m);setProfiles(p);setPlayers(pl)})
   .catch(e=>{if(active)setError(e.message||"No se pudo cargar scouting")})
   .finally(()=>{if(active)setLoading(false)});
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
 useEffect(()=>{
  let active=true;setStatsLoading(true);setStatsError("");setSeasonStats([]);setUnderstatRows([]);setValuationRows([]);
  Promise.all([
   all(base44.entities.PlayerSeasonStats,{season}),
   all(base44.entities.UnderstatSeasonRate,{season}),
   all(base44.entities.PlayerHistoricalValuation,{season})
  ]).then(([stats,under,valuations])=>{if(active){setSeasonStats(stats);setUnderstatRows(under);setValuationRows(valuations)}})
  .catch(e=>{if(active)setStatsError(e.message||"No se cargaron los datos históricos")})
  .finally(()=>{if(active)setStatsLoading(false)});
  return ()=>{active=false};
 },[season]);
 const historicalIndex=useMemo(()=>{
  const peers=historicalRoleCandidates(players,role);
  const result=new Map();
  for(const p of peers)result.set(String(p.id),collectPlayerSeasonMetrics(seasonStats,understatRows,season,p.id));
  return result;
 },[players,role,seasonStats,understatRows,season]);
 const historicalPeerMetrics=useMemo(()=>[...historicalIndex.values()],[historicalIndex]);
 const roleRequirements=useMemo(()=>deriveRoleRequirements(profile,role),[profile,role]);
 const visibility=useMemo(()=>{
  if(!profile)return {rows:[],fallback:false,compatibleCount:0,scoredCount:0,unscoredCount:0,shownCount:0};
  const rows=rankPlayers(players,role,profile,{search,minCA,showUnknown:true})
   .map(item=>({...item,valuation:valuationForSeason(valuationRows,item.player.id,season),
     advanced:managerFitAttributes(item.player,role,profile),
     historical:seasonPercentiles(historicalIndex.get(String(item.player.id))||{},historicalPeerMetrics,role,profile),
     roleFit:evaluateRoleRequirements(historicalIndex.get(String(item.player.id))||{},historicalPeerMetrics,role,profile)}));
  const eligible=filterScoutingCandidates(rows,{season,
    minAge:minAge===""?null:Number(minAge),maxAge:maxAge===""?null:Number(maxAge),
    maxValueM:maxValueM===""?null:Number(maxValueM),knownValueOnly,minimumCoverage,coverageMode:scoreMode});
  return visibleManagerFitCandidates(eligible,{scoreMode,showUnknown});
 },[players,role,profile,search,minCA,showUnknown,scoreMode,historicalIndex,historicalPeerMetrics,
    valuationRows,season,minAge,maxAge,maxValueM,knownValueOnly,minimumCoverage]);
 const results=visibility.rows;
 const comparedRows=useMemo(()=>{
  if(!profile||!comparedIds.length)return [];
  return compareCandidates(comparedIds.map(playerId=>{
   const player=players.find(p=>String(p.id)===String(playerId));
   return player?{player,valuation:valuationForSeason(valuationRows,player.id,season),
    roleFit:evaluateRoleRequirements(historicalIndex.get(String(player.id))||{},historicalPeerMetrics,role,profile),
    historical:seasonPercentiles(historicalIndex.get(String(player.id))||{},historicalPeerMetrics,role,profile),
    advanced:managerFitAttributes(player,role,profile)}:null;
  }).filter(Boolean),comparedIds);
 },[profile,comparedIds,players,valuationRows,season,historicalIndex,historicalPeerMetrics,role]);
 const comparisonBudget=candidateOverview(comparedRows,totalBudget);
 const scoutingPlayer=players.find(p=>String(p.id)===scoutingPlayerId)||null;
 const scoutingRow=scoutingPlayer&&profile?{
  player:scoutingPlayer,advanced:managerFitAttributes(scoutingPlayer,role,profile),
  historical:seasonPercentiles(historicalIndex.get(String(scoutingPlayer.id))||{},historicalPeerMetrics,role,profile),
  roleFit:evaluateRoleRequirements(historicalIndex.get(String(scoutingPlayer.id))||{},historicalPeerMetrics,role,profile)
 }:null;
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
  <section className="rounded-xl border bg-white p-3 md:p-4 space-y-3">
   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
    <label className="text-xs font-bold">Entrenador<select aria-label="Entrenador" value={managerId} onChange={e=>chooseManager(e.target.value)} className="block w-full border rounded-lg p-2 mt-1 text-sm"><option value="">Seleccionar…</option>{managers.map(m=><option key={m.id} value={m.id}>{m.display_name||m.name}</option>)}</select></label>
    <label className="text-xs font-bold">ADN táctico<select aria-label="ADN táctico" value={profileId} onChange={e=>setParams({manager:managerId,profile:e.target.value})} className="block w-full border rounded-lg p-2 mt-1 text-sm"><option value="">Seleccionar…</option>{profileOptions.map(p=><option key={p.id} value={p.id}>{p.name} · {profileScopeLabel(p)}</option>)}</select></label>
    <label className="text-xs font-bold">Rol buscado<select aria-label="Rol buscado" value={role} onChange={e=>setRole(e.target.value)} className="block w-full border rounded-lg p-2 mt-1 text-sm">{Object.entries(ROLE_LABELS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
    <label className="text-xs font-bold">CA mínimo (FM26)<input aria-label="CA mínimo" type="number" min="0" max="200" value={minCA} onChange={e=>setMinCA(Math.max(0,Math.min(200,Number(e.target.value)||0)))} className="block w-full border rounded-lg p-2 mt-1 text-sm"/></label>
   </div>
   <div className="flex gap-2 flex-wrap text-sm"><label className="text-xs font-bold">Temporada histórica <input aria-label="Temporada histórica" className="block rounded-lg border p-2 mt-1" value={season} onChange={e=>setSeason(e.target.value)} placeholder="2025/2026"/></label></div>
   <div className="flex gap-2 flex-wrap text-sm"><button type="button" aria-pressed={scoreMode==="role"} className={`rounded-lg px-3 py-2 border ${scoreMode==="role"?"bg-blue-900 text-white":"bg-white"}`} onClick={()=>setScoreMode("role")}>Perfil deseado por entrenador (V4)</button><button type="button" aria-pressed={scoreMode==="historical"} className={`rounded-lg px-3 py-2 border ${scoreMode==="historical"?"bg-blue-900 text-white":"bg-white"}`} onClick={()=>setScoreMode("historical")}>Histórico FotMob + Understat (V3)</button><button type="button" aria-pressed={scoreMode==="attributes"} className={`rounded-lg px-3 py-2 border ${scoreMode==="attributes"?"bg-blue-900 text-white":"bg-white"}`} onClick={()=>setScoreMode("attributes")}>Encaje FM26 + ADN (experimental)</button><button type="button" aria-pressed={scoreMode==="position"} className={`rounded-lg px-3 py-2 border ${scoreMode==="position"?"bg-blue-900 text-white":"bg-white"}`} onClick={()=>setScoreMode("position")}>Solo posición (V1)</button></div>
   <div className="grid grid-cols-2 md:grid-cols-5 gap-2 rounded-xl border bg-slate-50 p-3">
    <label className="text-xs font-bold">Edad mínima<input aria-label="Edad mínima" className="block border bg-white rounded-lg p-2 w-full mt-1" type="number" min="0" max="60" value={minAge} onChange={e=>setMinAge(e.target.value)}/></label>
    <label className="text-xs font-bold">Edad máxima<input aria-label="Edad máxima" className="block border bg-white rounded-lg p-2 w-full mt-1" type="number" min="0" max="60" value={maxAge} onChange={e=>setMaxAge(e.target.value)}/></label>
    <label className="text-xs font-bold">Valor máximo (M€)<input aria-label="Valor máximo" className="block border bg-white rounded-lg p-2 w-full mt-1" type="number" min="0" step="0.5" value={maxValueM} onChange={e=>setMaxValueM(e.target.value)}/></label>
    <label className="text-xs font-bold">Cobertura mínima<select aria-label="Cobertura mínima" className="block border bg-white rounded-lg p-2 w-full mt-1" value={minimumCoverage} onChange={e=>setMinimumCoverage(Number(e.target.value))}>{[0,25,50,75,100].map(x=><option key={x} value={x}>{x}%</option>)}</select></label>
    <label className="text-xs font-bold flex flex-col justify-center gap-2"><span>Valor histórico</span><span className="flex gap-2 font-normal items-center"><input type="checkbox" checked={knownValueOnly} onChange={e=>setKnownValueOnly(e.target.checked)}/> Solo con valor</span></label>
   </div>
   <p className="text-[11px] text-slate-500">Edad calculada al cierre de la temporada indicada. Valor de mercado histórico de esa misma campaña, no precio de traspaso ni valor actual. Los registros sin fecha o importe verificable no se estiman.</p>
   <div className="flex flex-wrap gap-3 items-center"><input aria-label="Buscar jugador" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar futbolista por nombre…" className="border rounded-lg p-2 text-sm flex-1 min-w-[180px]"/><label className="text-sm flex items-center gap-2"><input type="checkbox" checked={showUnknown} onChange={e=>setShowUnknown(e.target.checked)}/> Incluir encaje no evaluable</label></div>
   {manager&&profile?<div className="text-xs rounded-lg bg-blue-50 p-3"><strong>{manager.name} · {profile.name}</strong><p className="mt-1"><strong>Lo que busca en {ROLE_LABELS[role].toLowerCase()}:</strong> {(()=>{try{return JSON.parse(profile.player_role_priorities||"{}")[role]||"Sin descripción específica"}catch{return "Sin descripción específica"}})()}</p></div>:!loading&&<p className="text-sm text-amber-700">Necesitas un entrenador con un ADN guardado antes de evaluar futbolistas. <Link className="underline" to="/managers">Abrir MANAGERS</Link>.</p>}
  </section>
  <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4 md:p-5 space-y-4">
   <div className="flex flex-wrap items-center justify-between gap-2">
    <div><p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#315fa7]">Manager Fit · Análisis comparativo</p>
     <h2 className="mt-1 text-base font-black text-slate-900">Resultados {loading?"· Cargando…":"· "+results.length+" mostrados"}</h2></div>
    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-semibold text-slate-600">Modelo auditable · No predice rendimiento</span>
   </div>
   <ManagerScoutingSummary scoreMode={scoreMode} visibility={visibility} roleRequirements={roleRequirements} statsLoading={statsLoading} statsError={statsError} season={season}/>
   {visibility.fallback&&!statsLoading&&<p role="status" className="rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 text-xs text-slate-700">
    Los resultados se presentan por <strong>adecuación posicional</strong> porque este modo todavía no puede asignar puntuación con la evidencia disponible. No se ha inventado ninguna nota táctica.
   </p>}
   {!loading&&!statsLoading&&!visibility.fallback&&visibility.unscoredCount>0&&visibility.scoredCount>0&&!showUnknown&&<p className="text-xs text-slate-500">Hay {visibility.unscoredCount} jugadores compatibles sin evaluación. Activa «Incluir encaje no evaluable» para mostrarlos.</p>}
   {statsLoading&&<p role="status" className="text-xs font-semibold text-blue-700">Cargando métricas históricas de {season}…</p>}
   <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
    {results.map(item=><ScoutingCandidateCard key={item.player.id} item={item} scoreMode={scoreMode}
     age={ageOnSeason(item.player,season)}
     valueText={formatTransferValue(item.valuation?.eur)}
     selected={comparedIds.includes(String(item.player.id))}
     compareDisabled={!comparedIds.includes(String(item.player.id))&&comparedIds.length>=MAX_COMPARE}
     onCompare={()=>setComparedIds(prev=>toggleCandidate(prev,item.player.id))}
     onReport={()=>setScoutingPlayerId(String(item.player.id))}/>)}
   </div>
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
     <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      {[["Encaje por requisitos",scoutingReport.fit===null?"—":scoutingReport.fit+"/100"],["Histórico general",scoutingReport.historicalScore===null?"—":scoutingReport.historicalScore+"/100"],["Atributos FM26",scoutingReport.attributeScore===null?"—":scoutingReport.attributeScore+"/100"],["CA independiente",scoutingReport.ca===null?"—":scoutingReport.ca+"/200"]].map(([k,v])=><div key={k} className="rounded-xl bg-white border p-3"><p className="text-[11px] text-slate-500">{k}</p><strong className="text-xl tabular-nums">{v}</strong></div>)}
     </div>
     <p className="text-sm font-medium">{scoutingReport.fitLabel}. {scoutingReport.summary}</p>
     <p className="text-xs text-slate-600">Cobertura de requisitos {scoutingReport.coverage}% · Confianza {scoutingReport.confidence} · {scoutingReport.unmeasured} indicadores no evaluados</p>
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
   {!loading&&!results.length&&!statsLoading&&<p className="p-5 text-center text-slate-500 text-sm">
    No se encontraron jugadores compatibles con la posición y los filtros actuales. Prueba a quitar filtros de edad, valoración, CA o cobertura, o selecciona otro rol.
   </p>}
  </section>
 </main>;
}
