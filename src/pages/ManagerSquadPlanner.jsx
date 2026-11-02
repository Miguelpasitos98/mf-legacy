import React,{useEffect,useMemo,useState} from "react";
import {Link,useSearchParams} from "react-router-dom";
import {base44} from "@/api/base44Client";
import {isCustomTeam} from "@/components/managers/managerModel.mjs";
import {planSquad} from "@/components/managers/managerSquadPlanner.mjs";
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
 const plan=useMemo(()=>planSquad({team,season,players,memberships:members,assignments,managers,profiles}),[team,season,players,members,assignments,managers,profiles]);
 return <main className="mx-auto max-w-[1550px] p-4 md:p-6 text-slate-900 space-y-4">
 <header className="bg-[#091e1b] text-white rounded-2xl p-5"><p className="text-xs text-lime-300 font-bold tracking-widest">MF LEGACY · MANAGER FIT</p><h1 className="text-2xl font-black">Planificador de plantilla · V8</h1><p className="text-sm text-slate-300 mt-1">Diagnóstico orientativo de la plantilla por rol y acceso directo a scouting histórico de refuerzos.</p></header>
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
