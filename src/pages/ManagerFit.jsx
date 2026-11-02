import React,{useEffect,useMemo,useState} from "react";
import {Link,useSearchParams} from "react-router-dom";
import {base44} from "@/api/base44Client";
import PlayerPortrait from "@/components/teams/PlayerPortrait";
import {ROLE_LABELS,rankPlayers} from "@/components/managers/managerFit.mjs";
import {collectPlayerSeasonMetrics,seasonPercentiles,historicalRoleCandidates} from "@/components/managers/managerFitHistorical.mjs";
import {evaluateRoleRequirements,deriveRoleRequirements} from "@/components/managers/managerRoleFit.mjs";
import {buildScoutingReport,compareManagerProfiles,SCOUT_METRIC_NAMES} from "@/components/managers/managerScoutingReport.mjs";
import {ageOnSeason,valuationForSeason,filterScoutingCandidates,formatTransferValue} from "@/components/managers/managerTransferScout.mjs";
import {MAX_COMPARE,toggleCandidate,compareCandidates,candidateOverview} from "@/components/managers/managerCandidateCompare.mjs";
import {managerFitAttributes} from "@/components/managers/managerFitAttributes.mjs";
import {profileScopeLabel} from "@/components/managers/managerModel.mjs";
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
 const results=useMemo(()=>{
  if(!profile)return [];
  const rows=rankPlayers(players,role,profile,{search,minCA,showUnknown:true})
   .map(item=>({...item,valuation:valuationForSeason(valuationRows,item.player.id,season),advanced:managerFitAttributes(item.player,role,profile),
     historical:seasonPercentiles(historicalIndex.get(String(item.player.id))||{},historicalPeerMetrics,role,profile),
     roleFit:evaluateRoleRequirements(historicalIndex.get(String(item.player.id))||{},historicalPeerMetrics,role,profile)}))
   .filter(item=>showUnknown||(scoreMode==="role"?item.roleFit.score!==null:scoreMode==="historical"?item.historical.score!==null:scoreMode==="attributes"?item.advanced.score!==null:item.fit!==null));
  return filterScoutingCandidates(rows,{season,
    minAge:minAge===""?null:Number(minAge),maxAge:maxAge===""?null:Number(maxAge),
    maxValueM:maxValueM===""?null:Number(maxValueM),knownValueOnly,minimumCoverage})
   .sort((a,b)=>scoreMode==="role"?(b.roleFit.score??-1)-(a.roleFit.score??-1)||(b.roleFit.coverage-a.roleFit.coverage):scoreMode==="historical"?(b.historical.score??-1)-(a.historical.score??-1)||(b.historical.coverage-a.historical.coverage):scoreMode==="attributes"?(b.advanced.score??-1)-(a.advanced.score??-1)||(b.fit??-1)-(a.fit??-1):(b.fit??-1)-(a.fit??-1))
  .slice(0,100);
 },[players,role,profile,search,minCA,showUnknown,scoreMode,historicalIndex,historicalPeerMetrics,
    valuationRows,season,minAge,maxAge,maxValueM,knownValueOnly,minimumCoverage]);
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
 return <main className="mx-auto max-w-[1550px] px-3 md:px-6 py-4 text-slate-900 space-y-4">
  <header className="rounded-2xl bg-[#091e1b] text-white p-5">
   <p className="text-xs font-bold tracking-widest text-lime-300">MF LEGACY · MANAGER FIT</p>
   <h1 className="text-2xl md:text-3xl font-black mt-1">Scouting según el entrenador</h1>
   <Link to="/squad-planner" className="inline-block mt-2 text-xs font-bold underline text-lime-300">Planificar plantilla por entrenador</Link>
   <p className="text-sm text-slate-300 mt-1">Dos lecturas separadas: adecuación posicional y encaje estimado con atributos FM26 y el ADN del entrenador.</p>
  </header>
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
  <section className="border rounded-2xl bg-white p-3 md:p-4 space-y-3">
   <div className="flex gap-2 items-center justify-between flex-wrap"><h2 className="font-bold">Resultados {loading?"· Cargando…":"· "+results.length+" mostrados"}</h2><span className="text-xs text-slate-500">Criterios auditables · No predice rendimiento</span></div>
   {scoreMode==="role"&&<div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-xs"><strong>Criterios identificados:</strong> {roleRequirements.matched.length?roleRequirements.matched.map(x=>x.label).join(" · "):"Ninguno reconocido de forma fiable"}<p className="mt-1 text-slate-600">Solo se consideran indicadores vinculados explícitamente al rol; esta interpretación no utiliza IA en cada búsqueda ni altera el perfil guardado.</p></div>}
   {statsError&&<p role="alert" className="text-sm bg-red-50 border rounded-lg p-3">{statsError}</p>}
   {statsLoading&&<p role="status" className="text-xs text-blue-700">Cargando métricas de {season}…</p>}
   <p className="text-xs bg-amber-50 border border-amber-100 rounded-lg p-3 text-amber-900"><strong>V4 experimental:</strong> vincula frases reconocibles de las preferencias por posición a proxies estadísticos por temporada; no infiere capacidades sin mediciones. <strong>V3 histórico:</strong> selecciona una campaña para comparar únicamente registros de esa misma temporada y rol, con al menos 10 observaciones por indicador. La nota se basa en percentiles de métricas disponibles; es una estimación, no una medida directa de la filosofía del entrenador. Sin suficientes indicadores aparece «—». <strong>V2 experimental:</strong> combina adecuación posicional, atributos técnicos/físicos/mentales disponibles en FM26 y preferencias generales del ADN (ej. presión o posesión). Se muestra la cobertura y la confianza. No mide todavía datos históricos por temporada ni comprende automáticamente las descripciones de roles. El CA se mantiene independiente del resultado.</p>
   <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
    {results.map(item=><div key={item.player.id} className="rounded-xl border p-3 flex gap-3 min-w-0">
     <PlayerPortrait player={item.player} className="h-14 w-14 rounded-full object-cover shrink-0"/>
     <div className="flex-1 min-w-0">
      <div className="flex justify-between gap-2"><strong className="truncate text-sm">{item.player.name}</strong><strong className="text-blue-700 tabular-nums">{scoreMode==="role"?(item.roleFit.score===null?"—":item.roleFit.score+"/100"):scoreMode==="historical"?(item.historical.score===null?"—":item.historical.score+"/100"):scoreMode==="attributes"?(item.advanced.score===null?"—":item.advanced.score+"/100"):(item.fit===null?"—":item.fit+"/100")}</strong></div>
      <p className="text-xs text-slate-500">Posición {item.player.position||"—"} · CA {item.quality??"—"}/200</p>
      <p className="text-[11px] text-slate-600">Edad {ageOnSeason(item.player,season)??"—"} · Valor {formatTransferValue(item.valuation?.eur)}{item.valuation?.status==="verified"?" · verificado":""}</p>
      <p className="text-[11px] text-slate-500 mt-1">{scoreMode==="role"?"Indicadores del rol: "+item.roleFit.breakdown.length+"/"+item.roleFit.requested+" · Cobertura "+item.roleFit.coverage+"% · Confianza "+item.roleFit.confidence:scoreMode==="historical"?"Métricas comparables: "+item.historical.breakdown.length+" · Cobertura "+item.historical.coverage+"% · Confianza "+item.historical.confidence:scoreMode==="attributes"?"Posición "+(item.advanced.position??"—")+" · Atributos "+(item.advanced.attributes??"—")+" · ADN "+(item.advanced.style??"—"):item.evidence}</p>
      {scoreMode==="role"&&<p className="text-[11px] text-slate-600">{item.roleFit.breakdown.length?item.roleFit.breakdown.map(m=>m.key+" P"+m.percentile).join(" · "):item.roleFit.limitation}</p>}
      {scoreMode==="historical"&&item.historical.breakdown.length>0&&<p className="text-[11px] text-slate-600">{item.historical.breakdown.slice(0,3).map(m=>m.key+" P"+m.percentile).join(" · ")}</p>}
      {scoreMode==="attributes"&&<p className="text-[11px] text-slate-500">Cobertura de atributos: {item.advanced.coverage}% · Confianza {item.advanced.confidence==="medium"?"media":item.advanced.confidence==="low"?"baja":"insuficiente"}</p>}
      <p className="text-[11px] text-slate-500">Confianza posicional {item.reliability==="medium"?"media":item.reliability==="low"?"baja":"insuficiente"}</p>
      <button type="button" aria-pressed={comparedIds.includes(String(item.player.id))} disabled={!comparedIds.includes(String(item.player.id))&&comparedIds.length>=MAX_COMPARE} className={`mt-2 mr-2 rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-40 ${comparedIds.includes(String(item.player.id))?"bg-emerald-50 border-emerald-300 text-emerald-900":"bg-white text-slate-700"}`} onClick={()=>setComparedIds(prev=>toggleCandidate(prev,item.player.id))}>{comparedIds.includes(String(item.player.id))?"Quitar de comparación":"Comparar +"}</button>
      <button type="button" className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100" onClick={()=>setScoutingPlayerId(String(item.player.id))}>Informe de scouting</button>
     </div>
    </div>)}
   </div>
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
   {!loading&&!results.length&&<p className="p-5 text-center text-slate-500 text-sm">No hay jugadores que cumplan esos filtros y tengan datos suficientes.</p>}
  </section>
 </main>;
}
