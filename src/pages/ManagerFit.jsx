import React,{useEffect,useMemo,useState} from "react";
import {Link,useSearchParams} from "react-router-dom";
import {base44} from "@/api/base44Client";
import PlayerPortrait from "@/components/teams/PlayerPortrait";
import {ROLE_LABELS,rankPlayers} from "@/components/managers/managerFit.mjs";
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
 const [role,setRole]=useState("FB");
 const [search,setSearch]=useState("");
 const [minCA,setMinCA]=useState(0);
 const [showUnknown,setShowUnknown]=useState(false);
 const [scoreMode,setScoreMode]=useState("attributes");
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
 const results=useMemo(()=>{
  if(!profile)return [];
  const rows=rankPlayers(players,role,profile,{search,minCA,showUnknown:true})
   .map(item=>({...item,advanced:managerFitAttributes(item.player,role,profile)}))
   .filter(item=>showUnknown||(scoreMode==="attributes"?item.advanced.score!==null:item.fit!==null))
   .sort((a,b)=>scoreMode==="attributes"?(b.advanced.score??-1)-(a.advanced.score??-1)||(b.fit??-1)-(a.fit??-1):(b.fit??-1)-(a.fit??-1));
  return rows.slice(0,100);
 },[players,role,profile,search,minCA,showUnknown,scoreMode]);
 const chooseManager=id=>{
  const first=profiles.find(p=>String(p.manager_id)===String(id)&&p.is_default)||profiles.find(p=>String(p.manager_id)===String(id));
  setParams({manager:id,...(first?{profile:String(first.id)}:{})});
 };
 return <main className="mx-auto max-w-[1550px] px-3 md:px-6 py-4 text-slate-900 space-y-4">
  <header className="rounded-2xl bg-[#091e1b] text-white p-5">
   <p className="text-xs font-bold tracking-widest text-lime-300">MF LEGACY · MANAGER FIT</p>
   <h1 className="text-2xl md:text-3xl font-black mt-1">Scouting según el entrenador</h1>
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
   <div className="flex gap-2 flex-wrap text-sm"><button type="button" aria-pressed={scoreMode==="attributes"} className={`rounded-lg px-3 py-2 border ${scoreMode==="attributes"?"bg-blue-900 text-white":"bg-white"}`} onClick={()=>setScoreMode("attributes")}>Encaje FM26 + ADN (experimental)</button><button type="button" aria-pressed={scoreMode==="position"} className={`rounded-lg px-3 py-2 border ${scoreMode==="position"?"bg-blue-900 text-white":"bg-white"}`} onClick={()=>setScoreMode("position")}>Solo posición (V1)</button></div>
   <div className="flex flex-wrap gap-3 items-center"><input aria-label="Buscar jugador" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar futbolista por nombre…" className="border rounded-lg p-2 text-sm flex-1 min-w-[180px]"/><label className="text-sm flex items-center gap-2"><input type="checkbox" checked={showUnknown} onChange={e=>setShowUnknown(e.target.checked)}/> Incluir encaje no evaluable</label></div>
   {manager&&profile?<div className="text-xs rounded-lg bg-blue-50 p-3"><strong>{manager.name} · {profile.name}</strong><p className="mt-1"><strong>Lo que busca en {ROLE_LABELS[role].toLowerCase()}:</strong> {(()=>{try{return JSON.parse(profile.player_role_priorities||"{}")[role]||"Sin descripción específica"}catch{return "Sin descripción específica"}})()}</p></div>:!loading&&<p className="text-sm text-amber-700">Necesitas un entrenador con un ADN guardado antes de evaluar futbolistas. <Link className="underline" to="/managers">Abrir MANAGERS</Link>.</p>}
  </section>
  <section className="border rounded-2xl bg-white p-3 md:p-4 space-y-3">
   <div className="flex gap-2 items-center justify-between flex-wrap"><h2 className="font-bold">Resultados {loading?"· Cargando…":"· "+results.length+" mostrados"}</h2><span className="text-xs text-slate-500">Criterios auditables · No predice rendimiento</span></div>
   <p className="text-xs bg-amber-50 border border-amber-100 rounded-lg p-3 text-amber-900"><strong>V2 experimental:</strong> combina adecuación posicional, atributos técnicos/físicos/mentales disponibles en FM26 y preferencias generales del ADN (ej. presión o posesión). Se muestra la cobertura y la confianza. No mide todavía datos históricos por temporada ni comprende automáticamente las descripciones de roles. El CA se mantiene independiente del resultado.</p>
   <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
    {results.map(item=><div key={item.player.id} className="rounded-xl border p-3 flex gap-3 min-w-0">
     <PlayerPortrait player={item.player} className="h-14 w-14 rounded-full object-cover shrink-0"/>
     <div className="flex-1 min-w-0">
      <div className="flex justify-between gap-2"><strong className="truncate text-sm">{item.player.name}</strong><strong className="text-blue-700 tabular-nums">{scoreMode==="attributes"?(item.advanced.score===null?"—":item.advanced.score+"/100"):(item.fit===null?"—":item.fit+"/100")}</strong></div>
      <p className="text-xs text-slate-500">Posición {item.player.position||"—"} · CA {item.quality??"—"}/200</p>
      <p className="text-[11px] text-slate-500 mt-1">{scoreMode==="attributes"?"Posición "+(item.advanced.position??"—")+" · Atributos "+(item.advanced.attributes??"—")+" · ADN "+(item.advanced.style??"—"):item.evidence}</p>
      {scoreMode==="attributes"&&<p className="text-[11px] text-slate-500">Cobertura de atributos: {item.advanced.coverage}% · Confianza {item.advanced.confidence==="medium"?"media":item.advanced.confidence==="low"?"baja":"insuficiente"}</p>}
      <p className="text-[11px] text-slate-500">Confianza {item.reliability==="medium"?"media":item.reliability==="low"?"baja":"insuficiente"}</p>
     </div>
    </div>)}
   </div>
   {!loading&&!results.length&&<p className="p-5 text-center text-slate-500 text-sm">No hay jugadores que cumplan esos filtros y tengan datos suficientes.</p>}
  </section>
 </main>;
}
