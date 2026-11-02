import React,{useEffect,useMemo,useState} from "react";
import {Link,useSearchParams} from "react-router-dom";
import {base44} from "@/api/base44Client";
import {isCustomTeam} from "@/components/managers/managerModel.mjs";
import {planSquad} from "@/components/managers/managerSquadPlanner.mjs";
import {applyLineupOverrides,canChooseLineupPlayer} from "@/components/managers/managerLineupSandbox.mjs";
import {analyzeTeamBalance,compareTeamBalance} from "@/components/managers/managerTeamBalance.mjs";
import {analyzeTacticalPartnerships} from "@/components/managers/managerChemistry.mjs";
import {suggestFormationXI} from "@/components/managers/managerFormationPlanner.mjs";
import {ROLE_LABELS} from "@/components/managers/managerFit.mjs";
const loadAll=async(entity,query={})=>{
 const out=[];for(let skip=0;skip<=100000;skip+=200){
  const raw=await entity.filter(query,undefined,200,skip),part=Array.isArray(raw)?raw:raw?.data||raw?.items||[];
  out.push(...part);if(part.length<200)return out;
 }throw Error("No se pudo cargar el catálogo completo.");
};
export default function ManagerSquadPlanner(){
 const [params,setParams]=useSearchParams();
 const [teams,setTeams]=useState([]),[players,setPlayers]=useState([]),[managers,setManagers]=useState([]),[profiles,setProfiles]=useState([]);
 const [members,setMembers]=useState([]),[assignments,setAssignments]=useState([]);
 const [loading,setLoading]=useState(true),[error,setError]=useState("");
 const [overrides,setOverrides]=useState({});
 const season=params.get("season")||"2026/2027",teamId=params.get("team")||"";
 const customTeams=useMemo(()=>teams.filter(isCustomTeam),[teams]);
 const team=customTeams.find(t=>String(t.id)===teamId);
 useEffect(()=>{let live=true;
  Promise.all([loadAll(base44.entities.Team),loadAll(base44.entities.Player),loadAll(base44.entities.Manager),loadAll(base44.entities.ManagerTacticalProfile)])
  .then(([t,p,m,pro])=>{if(live){setTeams(t);setPlayers(p);setManagers(m);setProfiles(pro)}})
  .catch(e=>{if(live)setError(e.message||"Error al cargar datos")}).finally(()=>{if(live)setLoading(false)});
  return()=>{live=false};
 },[]);
 useEffect(()=>{if(!customTeams.length)return;if(!team){setParams({team:String(customTeams[0].id),season},{replace:true})}},[customTeams,team,season,setParams]);
 useEffect(()=>{if(!team||!/^\d{4}\/\d{4}$/.test(season)){setMembers([]);setAssignments([]);return;}
  let live=true;setLoading(true);
  Promise.all([loadAll(base44.entities.TeamSquadMembership,{team_type:"club",team_id:String(team.id),season}),loadAll(base44.entities.TeamManagerAssignment,{team_type:"club",team_id:String(team.id),season})])
   .then(([a,b])=>{if(live){setMembers(a);setAssignments(b)}})
   .catch(e=>{if(live)setError(e.message||"Error al cargar plantilla")}).finally(()=>{if(live)setLoading(false)});
  return()=>{live=false};
 },[team?.id,season]);
 useEffect(()=>{setOverrides({})},[teamId,season]);
 const plan=useMemo(()=>planSquad({team,season,players,memberships:members,assignments,managers,profiles}),[team,season,players,members,assignments,managers,profiles]);
 const formationPlan=useMemo(()=>suggestFormationXI(plan,plan.profile?.formation||""),[plan]);
 const lineupRoster=useMemo(()=>plan.valid?plan.roleSummary.flatMap(x=>x.roster):[],[plan]);
 const draft=useMemo(()=>applyLineupOverrides(formationPlan,lineupRoster,plan.profile,overrides),[formationPlan,lineupRoster,plan.profile,overrides]);
 const chemistry=useMemo(()=>analyzeTacticalPartnerships(draft),[draft]);
 const balance=useMemo(()=>analyzeTeamBalance(draft),[draft]);
 const alternative=useMemo(()=>analyzeTeamBalance(suggestFormationXI(plan,"4-2-3-1")),[plan]);
 const differences=useMemo(()=>compareTeamBalance(balance,alternative),[balance,alternative]);
 return <main className="mx-auto max-w-[1550px] p-4 md:p-6 text-slate-900 space-y-4">
 <header className="bg-[#091e1b] text-white rounded-2xl p-5"><p className="text-xs text-lime-300 font-bold tracking-widest">MF LEGACY · MANAGER FIT</p><h1 className="text-2xl font-black">Planificador de plantilla · V13</h1><p className="text-sm text-slate-300 mt-1">Diagnóstico orientativo de la plantilla por rol y acceso directo a scouting histórico de refuerzos.</p></header>
 {error&&<p role="alert" className="p-3 border bg-red-50 rounded-lg text-red-800">{error}</p>}
 <div className="rounded-xl border p-4 bg-white grid grid-cols-1 sm:grid-cols-2 gap-3">
 <label className="text-xs font-bold">Club personalizado<select className="block w-full border rounded-lg p-2 mt-1" aria-label="Club personalizado" value={teamId} onChange={e=>setParams({team:e.target.value,season})}><option value="">Selecciona equipo</option>{customTeams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
 <label className="text-xs font-bold">Temporada<input aria-label="Temporada" className="block w-full border rounded-lg p-2 mt-1" value={season} onChange={e=>setParams({team:teamId,season:e.target.value})}/></label>
 </div>
 {loading?<p role="status">Cargando plantilla…</p>:plan.valid&&<>
 <div className="rounded-xl border p-4 bg-white space-y-2"><h2 className="font-bold">{team.name} · {season}</h2>
 <p className="text-sm">Entrenador: <strong>{plan.manager?.name||"Sin entrenador principal asignado"}</strong> · ADN: <strong>{plan.profile?.name||"Sin ADN asignado"}</strong></p>
 <p className="text-xs text-slate-500">{plan.rosterCount} registros en la plantilla · {plan.linkedCount} jugadores clasificados por rol. Los roles se deducen de la posición principal registrada, no de la alineación titular.</p>
 {!plan.profile&&<p className="text-sm bg-amber-50 p-3 rounded-lg">Asigna un entrenador con ADN táctico en <Link to="/managers" className="underline font-semibold">MANAGERS</Link> para evaluar compatibilidad.</p>}</div>
 <section className="rounded-xl border bg-white p-4 space-y-3">
 <h3 className="font-black">Once orientativo por formación · {plan.profile?.formation||"Sin formación"}</h3>
 <p className="text-xs text-slate-600">Propuesta automática sin modificar la alineación guardada. Un jugador solo puede ocupar una plaza; las alternativas no están asignadas. La selección utiliza posición y, cuando existen, atributos FM26.</p>
 {formationPlan.valid?<><p className="text-sm font-semibold">{draft.filled}/11 plazas con candidatos · {draft.vacancies} sin candidato posicional</p>
 <div className="space-y-2 rounded-xl bg-[#e8f3ed] border border-emerald-200 p-3">{Array.from(new Set(draft.assignments.map(s=>s.line))).sort((a,b)=>b-a).map(line=>
 <div key={line} className="flex justify-around gap-1 flex-wrap">{draft.assignments.filter(s=>s.line===line).map(slot=>
 <div key={slot.id} className="rounded-lg bg-white/95 border border-emerald-100 p-2 text-center w-[min(160px,46%)] min-w-[95px]">
 <p className="text-[10px] font-bold text-emerald-800">{ROLE_LABELS[slot.role]}</p>
 <p className="text-xs font-bold truncate" title={slot.primary?.player.name||"Vacante"}>{slot.primary?.player.name||"Vacante"}</p>
 <p className="text-[10px] text-slate-500">Encaje {slot.primary?.estimatedFit??"—"}/100</p>
 <p className="text-[10px] text-blue-700 truncate" title={slot.advanced?.recommendation?.name||"Sin función evaluable"}>{slot.advanced?.recommendation?.name||"Función no evaluable"}</p>
 </div>)}</div>)}</div>
 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">{draft.assignments.map(slot=><div key={slot.id} className="border rounded-lg p-3 text-xs">
 <strong>{ROLE_LABELS[slot.role]} · {slot.primary?.player.name||"Vacante"}</strong>
 {slot.advanced&&<div className="mt-1 rounded bg-slate-50 p-2"><p className="font-semibold">Función orientativa: {slot.advanced.recommendation?.name||"No evaluable"} · {slot.advanced.recommendation?.score??"—"}/100</p>
 <p className="text-slate-600">Preferencias reconocidas: {slot.advanced.preferred.join(", ")||"Ninguna explícita; se muestran alternativas genéricas"}</p>
 <p className="text-slate-500">Cobertura {slot.advanced.recommendation?.coverage??0}% · Basado únicamente en atributos FM26 disponibles, no en rendimiento observado</p></div>}
 <p className="text-slate-600 mt-1">Alternativas disponibles: {slot.alternatives.map(a=>a.player.name).join(", ")||"Ninguna identificada"}</p>
 <Link className="text-blue-700 font-bold underline inline-block mt-2" to={`/manager-fit?${new URLSearchParams({...(plan.manager?{manager:String(plan.manager.id)}:{}),...(plan.profile?{profile:String(plan.profile.id)}:{}),role:slot.role,season})}`}>Buscar refuerzos</Link>
 </div>)}</div></>:<p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">{formationPlan.reason||"Guarda un ADN con una formación válida para generar una propuesta."}</p>}
 </section>
 <section className="rounded-xl border bg-white p-4 space-y-3" aria-label="Laboratorio de cambios en el once">
 <div className="flex items-center justify-between gap-2 flex-wrap"><h3 className="font-black">Laboratorio de sustituciones · V13</h3><button type="button" disabled={!Object.keys(overrides).length} onClick={()=>setOverrides({})} className="text-xs px-3 py-2 border rounded-lg">Restablecer once</button></div>
 <p className="text-xs text-slate-600">Prueba diferentes jugadores de la plantilla. El equilibrio y las parejas se recalculan al instante; los cambios solo existen en esta pantalla.</p>
 <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">{draft.assignments?.map(slot=><label key={slot.id} className="text-xs border rounded-lg p-3">
 <span className="font-semibold">{ROLE_LABELS[slot.role]} · {slot.id}</span>
 <select aria-label={"Jugador para "+slot.id} className="mt-2 block w-full border rounded-lg p-2" value={slot.primary?.player.id||""} onChange={e=>setOverrides(prev=>({...prev,[slot.id]:e.target.value}))}>
 <option value="">Vacante</option>{lineupRoster.filter(x=>canChooseLineupPlayer(slot.id,x.player.id,overrides,formationPlan)).map(x=><option key={x.player.id} value={x.player.id}>{x.player.name}</option>)}
 </select>
 </label>)}</div>
 <p className="text-xs text-slate-600">Plazas ocupadas: {draft.filled||0}/11. Ningún futbolista se puede asignar dos veces.</p>
 </section>
 <section className="rounded-xl border bg-white p-4 space-y-3">
 <h3 className="font-black">Equilibrio del once · V12</h3>
 <p className="text-xs text-slate-600">Comparación experimental de funciones FM26 con el sistema 4-2-3-1; no mide rendimiento colectivo observado.</p>
 <p className="text-xs">Dimensiones evaluables: {balance.assessed}/6 frente a {alternative.assessed}/6.</p>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-2">{differences.map(d=><div key={d.key} className="border rounded-lg p-3">
 <strong className="text-xs">{d.key}</strong>
 <p className="text-xs">Actual: {d.first===null?"—":d.first+"/100"} · 4-2-3-1: {d.second===null?"—":d.second+"/100"}</p>
 <p className="text-xs text-slate-500">Diferencia: {d.delta===null?"Sin datos":d.delta}</p>
 </div>)}</div>
 </section>
 <section className="rounded-xl border bg-white p-4 space-y-3" aria-label="Compatibilidad entre compañeros">
 <h3 className="font-black">Conexiones y complementariedad táctica · V11</h3>
 <p className="text-xs text-slate-600">Analiza combinaciones de funciones entre centrales, pivotes, laterales-extremos y mediocentros-mediapuntas. Son hipótesis sobre atributos FM26, no estadísticas de química real entre jugadores.</p>
 <p className="text-sm font-semibold">{chemistry.evaluated} parejas evaluadas · {chemistry.unavailable} sin datos suficientes</p>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{chemistry.pairs.map((pair,i)=><article key={pair.type+"-"+pair.ids.join("-")+i} className="rounded-xl border p-3 space-y-1">
 <p className="font-bold text-sm">{pair.type}</p>
 <p className="text-xs">{pair.players.join(" + ")}</p>
 <p className="text-xs">Compatibilidad funcional orientativa: <strong>{pair.score===null?"—":pair.score+"/100"}</strong> · Cobertura {pair.coverage}%</p>
 <p className="text-xs text-slate-600">{pair.functions.length?pair.functions.join(" + "):"No hay evidencia suficiente para valorar esta combinación."}</p>
 </article>)}</div>
 {!chemistry.pairs.length&&<p className="text-xs text-slate-500">No hay parejas tácticas reconocibles en esta formación o no se ha podido construir el once.</p>}
 </section>
 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">{plan.roleSummary.map(item=>{
 const reason=item.needsReview==="empty"?"Sin jugadores registrados":item.needsReview==="missing_data"?"Faltan atributos evaluables":item.needsReview==="low_fit"?"Mejor encaje estimado inferior a 60": "Cobertura básica";
 return <article key={item.role} className="bg-white border rounded-xl p-4 space-y-2">
 <div className="flex justify-between gap-2 items-center"><h3 className="font-bold">{ROLE_LABELS[item.role]}</h3><span className="text-xs rounded bg-slate-100 px-2 py-1">{item.count} jugadores</span></div>
 <p className="text-xs text-slate-600">{reason} · {item.evaluated} evaluados</p>
 <p className="text-sm">Mejor referencia: <strong>{item.best?.player.name||"—"}</strong> · Encaje FM26 + ADN <b>{item.best?.score??"—"}/100</b></p>
 <Link to={`/manager-fit?${new URLSearchParams({...(plan.manager?{manager:String(plan.manager.id)}:{}),...(plan.profile?{profile:String(plan.profile.id)}:{}),role:item.role,season})}`} className="inline-flex rounded-lg border border-blue-300 px-3 py-2 text-xs font-bold text-blue-700">Abrir scouting de {ROLE_LABELS[item.role].toLowerCase()}</Link>
 </article>;
 })}</div>
 <p className="text-xs bg-amber-50 p-3 rounded-lg border border-amber-100">La detección de necesidades es una señal inicial, no una conclusión deportiva. Una plaza sin datos no equivale a un futbolista deficiente; tampoco se infieren titulares, contratos o presupuesto disponible. No se ha modificado ningún registro.</p>
 </>}
 {!loading&&!customTeams.length&&<p className="text-sm">Aún no hay clubes personalizados que analizar. <Link className="underline" to="/squads">Abrir plantillas</Link>.</p>}
 </main>;
}
