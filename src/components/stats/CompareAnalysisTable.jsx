import React,{useMemo} from "react";
import {AlertTriangle} from "lucide-react";
import {compareHistoricalObservation} from "@/utils/historicalPeers";

// Comparativa del análisis MF LEGACY: cada temporada se compara con su propio
// arquetipo histórico, con el mismo motor que el Composite de STATS. Solo lectura.
const fmt=(v,d=0)=>v===null||v===undefined||v===""||!Number.isFinite(Number(v))?"—":Number(v).toLocaleString("es-ES",{minimumFractionDigits:d,maximumFractionDigits:d});
// Mismo criterio de color que el desglose individual del Composite.
const strengthOf=item=>item.penalty?100-item.percentile:item.percentile;
const barColor=value=>value>=85?"bg-emerald-500":value>=65?"bg-cyan-500":value>=40?"bg-sky-500":value>=20?"bg-amber-400":"bg-rose-400";

const SUMMARY_ROWS=[
 {key:"role",label:"Arquetipo de la temporada",get:a=>a?.role||"—"},
 {key:"population",label:"Temporadas comparables",get:a=>a?fmt(a.population,0):"—"},
 {key:"players",label:"Jugadores distintos",get:a=>a?fmt(a.players,0):"—"},
 {key:"count",label:"Indicadores valorables",get:a=>a?.composite?fmt(a.composite.count,0)+" / "+fmt(a.composite.total,0):"—"},
 {key:"coverage",label:"Cobertura del Composite",get:a=>a?.composite?.coverage!=null?fmt(a.composite.coverage,1)+" %":"—"},
 {key:"score",label:"Composite MF LEGACY",get:a=>a?.composite?.score!=null?fmt(a.composite.score,1)+" / 100":"—"}
];

export default function CompareAnalysisTable({entries=[],observations=[],peerLoading=false,peerError=null,onOpen}){
 const analyses=useMemo(()=>entries.map(({summary,player})=>{
  if(!summary||!observations.length)return {summary,player,analysis:null};
  const observation=observations.find(o=>o.playerId===String(summary.player_id)&&o.season===summary.season);
  if(!observation)return {summary,player,analysis:null};
  try{return {summary,player,analysis:compareHistoricalObservation(observation,observations,10)};}
  catch(e){console.error("Error en la comparación MF LEGACY de",summary.season,e);return {summary,player,analysis:null};}
 }),[entries,observations]);
 // Orden estable de indicadores: el del primer análisis que los define.
 const indicators=useMemo(()=>{
  const list=[];
  for(const {analysis} of analyses)for(const row of analysis?.rows||[])
   if(!list.some(x=>x.key===row.key))list.push({key:row.key,name:row.name,penalty:row.penalty});
  return list;
 },[analyses]);
 const bestOf=key=>{
  const values=analyses.map(({analysis})=>{
   const row=analysis?.rows.find(r=>r.key===key);
   return row&&row.percentile!==null?strengthOf(row):null;
  }).filter(v=>v!==null);
  return values.length<2?null:Math.max(...values);
 };
 return <section className="rounded-xl border-2 border-indigo-200 bg-[#f8faff] p-4">
  <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
   <div>
    <h3 className="text-sm font-black uppercase tracking-wide text-[#003399]">Análisis MF LEGACY comparado</h3>
    <p className="mt-1 text-xs text-slate-600">Percentiles propios calculados con todas las temporadas de clubes de nuestra base. Cada temporada se compara con su propio arquetipo, igual que en el desglose individual.</p>
   </div>
   <span role="status" className="text-[11px] text-slate-500">{peerLoading?"Actualizando la base histórica…":peerError?"Comparación previa en caché · revisar sincronización":"Base histórica cargada"}</span>
  </div>
  {!observations.length&&<p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">La base histórica todavía no está cargada, así que no se puede comparar el análisis. Vuelve a abrir esta vista cuando termine la sincronización.</p>}
  {peerError&&<p role="alert" className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"><AlertTriangle size={15} className="shrink-0"/>{peerError.message||"No se pudo sincronizar por completo la base histórica; se conserva la comparación ya cargada."}</p>}
  {analyses.some(a=>!a.analysis)&&<p className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">Las temporadas marcadas con «—» no tienen una temporada comparable con jugador y posición confirmados; no se les calcula Composite.</p>}
  <div className="mt-3 max-w-full overflow-x-auto rounded-xl border border-slate-200 bg-white">
   <table className="w-full min-w-[640px] text-left text-xs">
    <thead className="sticky top-0 z-10 bg-[#003399] text-white">
     <tr>
      <th className="px-3 py-3">Análisis MF LEGACY</th>
      <th className="px-2 py-3 text-center">Peso</th>
      {entries.map(({summary,player})=><th key={summary.id} className="min-w-[132px] px-3 py-3 text-right">
       <span className="block truncate">{player?.name||summary.player_name||"Jugador"}</span>
       <span className="block text-[10px] font-normal text-blue-100">{summary.season}</span>
      </th>)}
     </tr>
    </thead>
    <tbody>
     <tr className="bg-[#e2eaf6]"><td colSpan={entries.length+2} className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[#173B67]">Resumen del análisis</td></tr>
     {SUMMARY_ROWS.map(row=><tr key={row.key} className="border-t border-slate-100 odd:bg-white even:bg-[#f7f9fc]">
      <td className="px-3 py-2 font-semibold text-slate-700">{row.label}</td>
      <td className="px-2 py-2 text-center text-slate-400">—</td>
      {analyses.map(({summary,analysis})=><td key={summary.id} className={"px-3 py-2 text-right "+(row.key==="score"?"text-base font-black text-[#003399]":"font-bold tabular-nums text-slate-800")}>{row.get(analysis)}</td>)}
     </tr>)}
     <tr className="bg-[#e2eaf6]"><td colSpan={entries.length+2} className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[#173B67]">Indicadores del Composite · percentil frente a su arquetipo</td></tr>
     {indicators.map(indicator=>{
      const best=bestOf(indicator.key);
      const weight=analyses.map(({analysis})=>analysis?.rows.find(r=>r.key===indicator.key)?.weight).find(w=>w!==null&&w!==undefined);
      return <tr key={indicator.key} className="border-t border-slate-100 odd:bg-white even:bg-[#f7f9fc]">
       <td className="px-3 py-2 font-semibold text-slate-700">{indicator.name}{indicator.penalty&&<span className="ml-1 text-[10px] text-rose-700">(penalización)</span>}</td>
       <td className="px-2 py-2 text-center tabular-nums text-slate-500">{weight===undefined||weight===null?"—":(weight>0?"+":"")+weight+" %"}</td>
       {analyses.map(({summary,analysis})=>{
        const row=analysis?.rows.find(r=>r.key===indicator.key)||null;
        if(!row||row.percentile===null)return <td key={summary.id} className="px-3 py-2 text-right text-slate-400" title={row?"Percentil no calculable con la población actual":"Temporada sin análisis comparable"}>{row&&row.value!==null?<span className="text-slate-600">{fmt(row.value,2)}<span className="block text-[10px] text-slate-400">sin percentil</span></span>:"—"}</td>;
        const strength=strengthOf(row);
        const isBest=best!==null&&strength===best;
        const title="Percentil bruto "+fmt(row.percentile,2)+" de 100 · valor "+fmt(row.value,2)+" · puesto "+row.rank+" de "+row.n+" temporadas de "+row.nPlayers+" jugadores"+(row.penalty?" · indicador penalizado (menos es mejor)":"")+" · aporta "+fmt(row.contribution,2)+(row.provisional?" · muestra reducida":"");
        return <td key={summary.id} className={"px-3 py-2 "+(isBest?"bg-emerald-50":"")} title={title}>
         <div className="flex items-center justify-end gap-2">
          <div className="h-2.5 w-14 shrink-0 overflow-hidden rounded-full bg-slate-200"><div className={"h-full rounded-full "+barColor(strength)} style={{width:Math.max(0,Math.min(100,row.percentile))+"%"}}/></div>
          <span className={"w-12 text-right tabular-nums "+(isBest?"font-black text-emerald-800":"font-bold text-slate-800")}>{fmt(row.percentile,1)}</span>
         </div>
         <p className="mt-0.5 text-right text-[10px] text-slate-500">{fmt(row.value,2)}{row.provisional&&<span className="text-amber-600"> *</span>}</p>
        </td>;
       })}
      </tr>;
     })}
     {!indicators.length&&<tr><td colSpan={entries.length+2} className="px-3 py-8 text-center text-slate-500">No hay indicadores de Composite que comparar con la base histórica actual.</td></tr>}
    </tbody>
   </table>
  </div>
  <p className="mt-2 text-[11px] text-slate-500">El peso y la penalización son los del arquetipo de cada temporada; el valor bajo cada percentil es el indicador de origen. La marca verde señala el mejor percentil de la fila. Los percentiles comparan temporadas de jugadores distintos, no partidos sueltos.</p>
  {onOpen&&<p className="mt-1 text-[11px] text-slate-500">Pulsa «Desglose completo» en cualquier ficha para ver el análisis detallado con la muestra completa.</p>}
 </section>;
}