import React, { useMemo, useState } from "react";
import { Search, X, ShieldCheck, AlertTriangle } from "lucide-react";
import PlayerPortrait from "./PlayerPortrait";

export function BalancePanel({ assessment, comparison, season }) {
  const {balance,quality,knownCA,total,fitScore,zoneCount,warnings}=assessment;
  const rank = quality!==null && knownCA>=8 && comparison.length>=3
    ? Math.round(100*comparison.filter(value=>value<=quality).length/comparison.length) : null;
  return <div className="space-y-3 text-slate-800" aria-label="Análisis del once">
    <div><p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Radiografía del once</p><h4 className="text-base font-black">Equilibrio táctico</h4></div>
    <div className="rounded-xl bg-slate-900 text-white p-3">
      <div className="flex justify-between items-baseline"><span className="font-semibold text-sm">Equilibrio estimado</span><strong className="text-2xl tabular-nums">{balance}<span className="text-sm text-slate-400">/100</span></strong></div>
      <div className="h-2 bg-white/20 rounded-full overflow-hidden mt-2"><div style={{width:balance+"%"}} className="h-full bg-lime-400 rounded-full"/></div>
      <p className="text-xs text-slate-300 mt-2">Heurística de cobertura, encaje y distribución; no predice resultados.</p>
    </div>
    <div className="grid grid-cols-2 gap-2">
      <div className="rounded-xl border p-3"><div className="text-xs text-slate-500">CA medio FM26</div><strong className="text-xl tabular-nums">{quality??"—"}<span className="text-xs text-slate-500"> / 200</span></strong><div className="text-[11px] text-slate-500">{knownCA}/{total} con CA</div></div>
      <div className="rounded-xl border p-3"><div className="text-xs text-slate-500">Adecuación a zona</div><strong className="text-xl tabular-nums">{fitScore}%</strong><div className="text-[11px] text-slate-500">Posiciones registradas</div></div>
    </div>
    <div className="grid grid-cols-4 gap-1 text-center">{Object.entries(zoneCount).map(([key,value])=><div className="border rounded-lg p-1.5" key={key}><div className="text-[10px] text-slate-500">{key}</div><strong>{value}</strong></div>)}</div>
    {rank!==null?<p className="rounded-lg bg-blue-50 p-2 text-xs">Tu XI supera en CA medio al <strong>{rank}%</strong> de las {comparison.length} plantillas comparables (referencia: sus mejores 11 CA disponibles).</p>:<p className="text-xs text-slate-500">Comparación entre equipos pendiente: se necesitan al menos 8 CA del XI y 3 plantillas rivales con datos suficientes.</p>}
    {season!=="2026/2027"&&<p className="text-xs rounded-lg bg-amber-50 p-2 text-amber-800">Atención: el CA procede de FM26, no es una valoración histórica de {season}.</p>}
    {warnings.length>0?<div className="rounded-lg bg-amber-50 p-2"><div className="flex gap-1 items-center text-xs font-bold text-amber-800"><AlertTriangle size={14}/> Aspectos a revisar</div>{warnings.slice(0,3).map(w=><p className="text-xs text-amber-800 mt-1" key={w}>• {w}</p>)}</div>:<div className="flex gap-2 items-center text-xs text-emerald-700"><ShieldCheck size={16}/> Sin alertas importantes de cobertura.</div>}
  </div>;
}

export function PlayerPicker({selected,roster,allPlayers,onPick,onClose,busy}) {
  const [query,setQuery]=useState("");
  const [pending,setPending]=useState(false);
  const [error,setError]=useState("");
  const rosterIds=useMemo(()=>new Set(roster.map(m=>String(m.player_id))),[roster]);
  const options=useMemo(()=>{
    const source=query.trim().length>=2?allPlayers:roster.map(m=>m.player).filter(Boolean);
    const searchText=query.toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
    return source.filter(p=>p?.id && (!searchText||String(p.name||"").toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").includes(searchText))).slice(0,60);
  },[query,allPlayers,roster]);
  const choose=async player=>{
    if(pending||busy)return;
    setPending(true);setError("");
    try{await onPick(player);setQuery("");}
    catch(e){setError(e.message||"No se pudo añadir el jugador")}
    finally{setPending(false)}
  };
  return <div className="flex flex-col min-h-0 h-full">
    <div className="flex justify-between items-center gap-2"><div><div className="text-xs font-bold text-blue-700">SELECCIONAR JUGADOR</div><h4 className="font-extrabold text-base">Posición {selected}</h4></div><button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-slate-100" aria-label="Cerrar selector"><X size={18}/></button></div>
    <div className="relative mt-3"><Search size={16} className="absolute left-3 top-3 text-slate-400"/><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar cualquier jugador..." aria-label="Buscar jugador para esta posición" className="w-full border rounded-xl px-9 py-2.5 text-sm"/></div>
    <p className="text-xs text-slate-500 my-2">{query.trim().length<2?"Jugadores de la plantilla. Escribe 2 letras para buscar en toda la base.":"Resultados de MF LEGACY"}</p>
    {error&&<p role="alert" className="text-xs text-red-600 mb-2">{error}</p>}
    <div className="overflow-y-auto overscroll-contain flex-1 min-h-[80px] max-h-[420px] space-y-1">
      {options.map(p=><button disabled={busy||pending} key={p.id} type="button" onClick={()=>choose(p)} className="w-full flex items-center gap-2 text-left p-2 hover:bg-blue-50 rounded-xl disabled:opacity-60">
        <PlayerPortrait player={p} className="w-10 h-10 rounded-full object-cover shrink-0"/>
        <span className="flex-1 min-w-0"><span className="font-bold block text-sm truncate">{p.name}</span><span className="text-[11px] text-slate-500">{p.position||"Sin posición"} · CA {p.ca??"—"}</span></span>
        <span className="text-[10px] shrink-0 text-blue-700">{rosterIds.has(String(p.id))?"Plantilla":"+ Añadir"}</span>
      </button>)}
      {!options.length&&<p className="p-3 text-sm text-slate-500">No se han encontrado jugadores.</p>}
    </div>
    {pending&&<div role="status" className="text-xs text-blue-700 pt-2">Asignando jugador y actualizando plantilla…</div>}
  </div>;
}
