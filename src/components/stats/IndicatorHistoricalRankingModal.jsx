import React,{useMemo,useState} from "react";
import {createPortal} from "react-dom";
import {Search,X} from "lucide-react";
import {indicatorHistoricalRanking} from "@/utils/indicatorHistoricalRanking";
import {indicatorExplanation} from "@/utils/indicatorDescriptions";
const display=(v,d=2)=>v===null||v===undefined?"—":Number(v).toLocaleString("es-ES",{maximumFractionDigits:d,minimumFractionDigits:d});
export default function IndicatorHistoricalRankingModal({indicator,role,observations=[],selectedPlayerIds=[],onClose}){
 const [search,setSearch]=useState("");
 const [unique,setUnique]=useState(false);
 const explanation=indicatorExplanation(indicator.key);
 const ranked=useMemo(()=>indicatorHistoricalRanking(observations,role,indicator.key,indicator.penalty),[observations,role,indicator]);
 const shown=useMemo(()=>{
  const seen=new Set();
  return ranked.filter(o=>{
   if(unique){if(seen.has(o.playerId))return false;seen.add(o.playerId);}
   return (o.playerName+" "+o.season).toLowerCase().includes(search.trim().toLowerCase());
  });
 },[ranked,search,unique]);
 const players=new Set(ranked.map(x=>x.playerId)).size;
 return createPortal(<div className="fixed inset-0 z-[10001] flex items-center justify-center bg-slate-950/75 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={"Ranking histórico de "+indicator.name} onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
  <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
   <div className="flex shrink-0 items-start justify-between gap-3 bg-[#0e2844] px-5 py-4 text-white">
    <div><p className="text-[10px] font-bold uppercase tracking-widest text-blue-200">MF LEGACY · RANKING HISTÓRICO</p><h2 className="mt-1 text-lg font-black">{indicator.name}</h2><p className="mt-1 text-xs text-blue-100">Arquetipo {role} · {ranked.length} temporadas válidas · {players} jugadores distintos · {indicator.penalty?"Menor valor es mejor":"Mayor valor es mejor"}</p></div>
    <button type="button" onClick={onClose} aria-label="Cerrar ranking" className="rounded-lg p-2 hover:bg-white/10"><X size={20}/></button>
   </div>
   {explanation&&<div className="shrink-0 space-y-0.5 border-b border-slate-100 bg-slate-50/50 px-5 py-2.5 text-[11px] leading-relaxed text-slate-500">
    <p><span className="font-semibold text-slate-600">Qué mide:</span> {explanation.description}</p>
    <p><span className="font-semibold text-slate-600">Cálculo:</span> {explanation.formula}</p>
   </div>}
   <div className="flex flex-wrap gap-3 border-b border-slate-200 p-3">
    <label className="flex min-w-[210px] flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"><Search size={16} className="text-slate-400"/><input autoFocus className="w-full outline-none" placeholder="Buscar jugador o temporada…" value={search} onChange={e=>setSearch(e.target.value)}/></label>
    <label className="flex items-center gap-2 text-xs font-semibold text-slate-600"><input type="checkbox" checked={unique} onChange={e=>setUnique(e.target.checked)}/>Mejor temporada por jugador</label>
   </div>
   <div className="min-h-0 flex-1 overflow-auto">
    <table className="w-full text-left text-xs"><thead className="sticky top-0 z-10 bg-slate-100 text-slate-600"><tr><th className="px-3 py-3">Puesto</th><th className="px-3 py-3">Jugador</th><th className="px-3 py-3">Temporada</th><th className="px-3 py-3 text-right">Valor</th><th className="px-3 py-3 text-right">Percentil</th></tr></thead>
     <tbody>{shown.map(o=><tr key={o.key||o.playerId+"-"+o.season} className={"border-t border-slate-100 "+(selectedPlayerIds.includes(o.playerId)?"bg-blue-50":"hover:bg-slate-50")}>
      <td className="px-3 py-3 font-black tabular-nums text-[#003399]">#{o.rank}</td><td className="px-3 py-3 font-bold text-slate-800">{o.playerName||"Jugador"}{selectedPlayerIds.includes(o.playerId)&&<span className="ml-2 text-[10px] font-semibold text-blue-700">EN COMPARACIÓN</span>}</td><td className="px-3 py-3 text-slate-600">{o.season}</td><td className="px-3 py-3 text-right font-bold tabular-nums">{display(o.value,3)}</td><td className="px-3 py-3 text-right tabular-nums">{o.percentile===null?"—":display(o.percentile,1)}</td>
     </tr>)}</tbody>
    </table>
    {!shown.length&&<p className="p-6 text-center text-sm text-slate-500">No hay resultados para esta búsqueda.</p>}
   </div>
   <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-3 text-[11px] text-slate-600">Clasificación por temporadas de jugadores de la misma posición; los empates comparten puesto. Se utiliza el mismo valor de origen que el Composite, sin modificar estadísticas.</div>
  </div>
 </div>,document.body);
}
