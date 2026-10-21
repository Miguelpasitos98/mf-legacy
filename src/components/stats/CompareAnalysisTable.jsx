import React from "react";
import {AlertTriangle,Crown} from "lucide-react";
import {strengthOf} from "@/utils/compareAnalysis";
import {shortSeason} from "@/utils/compareMetrics";

// Comparativa del análisis MF LEGACY: cada temporada se compara con su propio
// arquetipo histórico, con el mismo motor que el Composite de STATS. Solo lectura.
const fmt=(value,decimals=0)=>value===null||value===undefined||value===""||!Number.isFinite(Number(value))?"—":Number(value).toLocaleString("es-ES",{minimumFractionDigits:decimals,maximumFractionDigits:decimals});
// Mismo criterio de color que el desglose individual del Composite.
const barColor=value=>value>=85?"bg-emerald-500":value>=65?"bg-cyan-500":value>=40?"bg-sky-500":value>=20?"bg-amber-400":"bg-rose-400";
const signed=value=>(value>0?"+":"")+fmt(value,1);

const SUMMARY_ROWS=[
 {key:"role",label:"Arquetipo de la temporada",get:season=>season.role||"—"},
 {key:"population",label:"Temporadas comparables",get:season=>season.population===null?"—":fmt(season.population,0)},
 {key:"players",label:"Jugadores distintos",get:season=>season.players===null?"—":fmt(season.players,0)},
 {key:"count",label:"Indicadores valorables",get:season=>season.count===null?"—":fmt(season.count,0)+" / "+fmt(season.total,0)},
 {key:"coverage",label:"Cobertura del Composite",get:season=>season.coverage===null?"—":fmt(season.coverage,1)+" %"},
 {key:"average",label:"Percentil medio",get:season=>season.average===null?"—":fmt(season.average,1)+" de 100"},
 {key:"strongest",label:"Indicador más fuerte",get:season=>season.strongest?season.strongest.name+" · "+fmt(strengthOf(season.strongest),1):"—"},
 {key:"weakest",label:"Indicador más débil",get:season=>season.weakest?season.weakest.name+" · "+fmt(strengthOf(season.weakest),1):"—"},
 {key:"wins",label:"Indicadores ganados",get:season=>season.score===null?"—":fmt(season.wins,0)+" / "+fmt(season.contested,0)}
];

export default function CompareAnalysisTable({model,peerLoading=false,peerError=null,onOpen}){
 if(!model)return null;
 const {seasons=[],indicators=[],contested=0}=model;
 const nameOf=season=>season.player?.name||season.summary?.player_name||"Jugador";
 return <section className="rounded-xl border-2 border-indigo-200 bg-[#f8faff] p-4">
  <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
   <div>
    <h3 className="text-sm font-black uppercase tracking-wide text-[#003399]">Análisis MF LEGACY comparado</h3>
    <p className="mt-1 text-xs text-slate-600">Percentiles propios calculados con todas las temporadas de clubes de nuestra base. Cada temporada se compara con su propio arquetipo, igual que en el desglose individual. La columna «Líder» indica quién gana cada indicador y por cuántos puntos de percentil.</p>
   </div>
   <span role="status" className="text-[11px] text-slate-500">{peerLoading?"Actualizando la base histórica…":peerError?"Comparación previa en caché · revisar sincronización":"Base histórica cargada"}</span>
  </div>
  {!seasons.length&&<p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">La base histórica todavía no está cargada, así que no se puede comparar el análisis. Vuelve a abrir esta vista cuando termine la sincronización.</p>}
  {peerError&&<p role="alert" className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"><AlertTriangle size={15} className="shrink-0"/>{peerError.message||"No se pudo sincronizar por completo la base histórica; se conserva la comparación ya cargada."}</p>}
  {seasons.some(season=>!season.analysis)&&<p className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">Las temporadas marcadas con «—» no tienen una temporada comparable con jugador y posición confirmados; no se les calcula Composite.</p>}
  <div className="mt-3 max-w-full overflow-x-auto rounded-xl border border-slate-200 bg-white">
   <table className="w-full min-w-[760px] text-left text-xs">
    <thead className="sticky top-0 z-10 bg-[#003399] text-white">
     <tr>
      <th className="px-3 py-3">Análisis MF LEGACY</th>
      <th className="px-2 py-3 text-center">Peso</th>
      <th className="min-w-[150px] px-3 py-3 text-left" title="Temporada con el mejor percentil del indicador y ventaja sobre la segunda">Líder · ventaja</th>
      {seasons.map(season=><th key={season.summary.id} className="min-w-[136px] px-3 py-3 text-right">
       <span className="block truncate">{nameOf(season)}</span>
       <span className="block text-[10px] font-normal text-blue-100">{shortSeason(season.summary.season)}{season.rank?" · "+season.rank+"º":""}</span>
      </th>)}
     </tr>
    </thead>
    <tbody>
     <tr className="bg-[#e2eaf6]"><td colSpan={seasons.length+3} className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[#173B67]">Resumen del análisis</td></tr>
     {SUMMARY_ROWS.map(row=><tr key={row.key} className="border-t border-slate-100 odd:bg-white even:bg-[#f7f9fc]">
      <td className="px-3 py-2 font-semibold text-slate-700">{row.label}</td>
      <td className="px-2 py-2 text-center text-slate-400">—</td>
      <td className="px-3 py-2 text-slate-400">—</td>
      {seasons.map(season=><td key={season.summary.id} className={"px-3 py-2 text-right "+(row.key==="wins"?"font-black text-emerald-800":"font-bold tabular-nums text-slate-800")}>{row.get(season)}</td>)}
     </tr>)}
     <tr className="border-t-2 border-[#003399]/25 bg-[#eaf0fb]">
      <td className="px-3 py-2 font-black text-[#0d315b]">Composite MF LEGACY</td>
      <td className="px-2 py-2 text-center text-slate-400">—</td>
      <td className="px-3 py-2 text-[11px] font-bold text-emerald-800" title="Diferencia de Composite entre el primer y el segundo puesto">{model.headline?model.headline.winner.rank+"º vs 2º · "+signed(model.headline.gap)+" pts":"—"}</td>
      {seasons.map(season=><td key={season.summary.id} className="px-3 py-2 text-right">
       <span className="block text-base font-black tabular-nums text-[#003399]">{season.score===null?"—":fmt(season.score,1)}</span>
       <span className={"block text-[10px] font-bold "+(season.rank===1?"text-emerald-700":"text-rose-700")}>{season.rank===1?"Líder":season.gapToLeader!==null?"−"+fmt(Math.abs(season.gapToLeader),1)+" pts":"—"}</span>
      </td>)}
     </tr>
     <tr className="bg-[#e2eaf6]"><td colSpan={seasons.length+3} className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[#173B67]">Indicadores del Composite · percentil frente a su arquetipo · {contested} comparables</td></tr>
     {indicators.map(indicator=>{
      const leaderCell=indicator.best?seasons[indicator.best.index]:null;
      return <tr key={indicator.key} className="border-t border-slate-100 odd:bg-white even:bg-[#f7f9fc]">
       <td className="px-3 py-2 font-semibold text-slate-700">{indicator.name}{indicator.penalty&&<span className="ml-1 text-[10px] text-rose-700">(penalización)</span>}</td>
       <td className="px-2 py-2 text-center tabular-nums text-slate-500">{indicator.weight===null?"—":(indicator.weight>0?"+":"")+indicator.weight+" %"}</td>
       <td className="px-3 py-2">
        {leaderCell?<>
         <span className="flex items-center gap-1.5"><Crown size={13} className="shrink-0 text-amber-500"/><span className="truncate font-bold text-slate-800" title={nameOf(leaderCell)}>{nameOf(leaderCell)}</span></span>
         <span className="block text-[10px] text-slate-500">{indicator.gap===null?"sin segunda cifra":indicator.gap===0?"empate con el 2º":signed(indicator.gap)+" pts de percentil"}</span>
        </>:<span className="text-slate-400">—</span>}
       </td>
       {indicator.cells.map(cell=>{
        const season=seasons[cell.index];
        const row=cell.row;
        if(!row||row.percentile===null)return <td key={season.summary.id} className="px-3 py-2 text-right text-slate-400" title={row?"Percentil no calculable con la población actual":"Temporada sin análisis comparable"}>{row&&row.value!==null?<span className="text-slate-600">{fmt(row.value,2)}<span className="block text-[10px] text-slate-400">sin percentil</span></span>:"—"}</td>;
        const strength=cell.strength;
        const isBest=indicator.best!==null&&strength===indicator.best.strength;
        const delta=indicator.best!==null?strength-indicator.best.strength:null;
        const title="Percentil bruto "+fmt(row.percentile,2)+" de 100 · valor "+fmt(row.value,2)+" · puesto "+row.rank+" de "+row.n+" temporadas de "+row.nPlayers+" jugadores"+(row.penalty?" · indicador penalizado (menos es mejor)":"")+" · aporta "+fmt(row.contribution,2)+(row.provisional?" · muestra reducida":"");
        return <td key={season.summary.id} className={"px-3 py-2 "+(isBest?"bg-emerald-50":"")} title={title}>
         <div className="flex items-center justify-end gap-2">
          <div className="h-2.5 w-14 shrink-0 overflow-hidden rounded-full bg-slate-200"><div className={"h-full rounded-full "+barColor(strength)} style={{width:Math.max(0,Math.min(100,row.percentile))+"%"}}/></div>
          <span className={"w-12 text-right tabular-nums "+(isBest?"font-black text-emerald-800":"font-bold text-slate-800")}>{fmt(row.percentile,1)}</span>
         </div>
         <div className="mt-0.5 flex items-center justify-end gap-1.5 text-[10px]">
          <span className="text-slate-500">{fmt(row.value,2)}{row.provisional&&<span className="text-amber-600"> *</span>}</span>
          {isBest?<span className="rounded bg-emerald-600 px-1.5 font-black uppercase tracking-wide text-white" title="Mejor percentil de la fila">mejor</span>
           :delta!==null&&<span className="rounded bg-rose-100 px-1.5 font-bold tabular-nums text-rose-800" title="Diferencia en puntos de percentil frente al mejor de la fila">{signed(delta)}</span>}
         </div>
        </td>;
       })}
      </tr>;
     })}
     {!indicators.length&&<tr><td colSpan={seasons.length+3} className="px-3 py-8 text-center text-slate-500">No hay indicadores de Composite que comparar con la base histórica actual.</td></tr>}
    </tbody>
   </table>
  </div>
  <p className="mt-2 text-[11px] text-slate-500">La corona y la marca verde señalan el mejor percentil de cada fila; la cifra roja es la diferencia exacta en puntos de percentil frente a ese mejor. El peso y la penalización son los del arquetipo de cada temporada y el valor bajo cada percentil es el indicador de origen. Los percentiles comparan temporadas de jugadores distintos, no partidos sueltos.</p>
  {onOpen&&<p className="mt-1 text-[11px] text-slate-500">Pulsa «Desglose completo» en cualquier ficha para ver el análisis detallado con la muestra completa.</p>}
 </section>;
}