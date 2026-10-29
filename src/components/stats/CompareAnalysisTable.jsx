import React,{useState} from "react";
import {AlertTriangle,Crown} from "lucide-react";
import {strengthOf} from "@/utils/compareAnalysis";
import {shortSeason} from "@/utils/compareMetrics";
import CompareDuelBar,{seasonColor} from "@/components/stats/CompareDuelBar";
import IndicatorHistoricalRankingModal from "@/components/stats/IndicatorHistoricalRankingModal";


// Comparativa del análisis MF LEGACY: cada temporada se compara con su propio
// arquetipo histórico, con el mismo motor que el Composite de STATS. Solo lectura.
const fmt=(value,decimals=0)=>value===null||value===undefined||value===""||!Number.isFinite(Number(value))?"—":Number(value).toLocaleString("es-ES",{minimumFractionDigits:decimals,maximumFractionDigits:decimals});
const signed=value=>(value>0?"+":"")+fmt(value,1);
// Suma directa de los aportes de todos los indicadores valorables de la temporada.
const contributionSum=season=>(season?.analysis?.rows||[]).reduce((total,row)=>total+(Number.isFinite(Number(row.contribution))?Number(row.contribution):0),0);

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


// Summary comparisons are meaningful only for comparable numeric measures.
// Do not invent weights for these descriptive rows or compare unequal denominators.
const summaryValue=(row,season,seasons)=>{
 if(!season.analysis)return null;
 if(row.key==="coverage")return season.coverage;
 if(row.key==="average")return season.average;
 if(row.key==="count"){
  if(!seasons.every(s=>s.analysis&&s.total===season.total))return null;
  return season.count;
 }
 if(row.key==="wins"){
  if(!seasons.every(s=>s.analysis&&s.contested===season.contested))return null;
  return season.wins;
 }
 return null;
};
const summaryDuel=(row,seasons)=>{
 const ranked=seasons.map((season,index)=>({index,strength:summaryValue(row,season,seasons)}))
  .filter(item=>item.strength!==null&&item.strength!==undefined&&Number.isFinite(Number(item.strength)))
  .sort((a,b)=>b.strength-a.strength||a.index-b.index);
 return ranked.length>=2?{best:ranked[0],second:ranked[1],gap:ranked[0].strength-ranked[1].strength}:null;
};

export default function CompareAnalysisTable({model,observations=[],peerLoading=false,peerError=null,onOpen}){
 const [rankingIndicator,setRankingIndicator]=useState(null);
 if(!model)return null;
 const {seasons=[],indicators=[],contested=0}=model;
 const nameOf=season=>season.player?.name||season.summary?.player_name||"Jugador";
 return <section className="rounded-xl border-2 border-indigo-200 bg-[#f8faff] p-4">
  <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
   <div>
    <h3 className="text-sm font-black uppercase tracking-wide text-[#003399]">Análisis MF LEGACY comparado</h3>
    <p className="mt-1 text-xs text-slate-600">Percentiles propios calculados con todas las temporadas de clubes de nuestra base. Cada temporada se compara con su propio arquetipo, igual que en el desglose individual. La columna «Líder» indica quién gana cada indicador y la línea «aporta» de cada casilla, los puntos que esa estadística suma al Composite de esa temporada. En el Composite, «suma» es el total de esos aportes antes de reescalar.</p>
   </div>
   <span role="status" className="text-[11px] text-slate-500">{peerLoading?"Actualizando la base histórica…":peerError?"Comparación previa en caché · revisar sincronización":"Base histórica cargada"}</span>
  </div>
  {!seasons.length&&<p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">La base histórica todavía no está cargada, así que no se puede comparar el análisis. Vuelve a abrir esta vista cuando termine la sincronización.</p>}
  {peerError&&<p role="alert" className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"><AlertTriangle size={15} className="shrink-0"/>{peerError.message||"No se pudo sincronizar por completo la base histórica; se conserva la comparación ya cargada."}</p>}
  {seasons.some(season=>!season.analysis)&&<p className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">Las temporadas marcadas con «—» no tienen una temporada comparable con jugador y posición confirmados; no se les calcula Composite.</p>}
  <div aria-label="Leyenda de la comparación" className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600"><span><strong className="text-[#003399]">Percentil</strong> · rendimiento frente al arquetipo</span><span><strong className="text-slate-700">Valor</strong> · cifra original</span><span><strong className="text-slate-700">#Puesto / N</strong> · ranking histórico por temporadas</span><span><strong className="text-[#003399]">Aporta</strong> · puntos sumados al Composite</span><span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500"/> Mejor percentil en la fila</span></div>
  <div className="mt-2 max-w-full overflow-x-auto rounded-xl border border-slate-200 bg-white">
   <table className="w-full min-w-[860px] text-left text-xs">
    <thead className="sticky top-0 z-10 bg-[#003399] text-white">
     <tr>
      <th className="px-3 py-3">Análisis MF LEGACY</th>
      <th className="px-2 py-3 text-center">Peso</th>
      <th className="min-w-[150px] px-3 py-3 text-left" title="Temporada con el mejor percentil del indicador y ventaja sobre la segunda">Líder · ventaja</th>
      <th className="min-w-[190px] px-3 py-3 text-left" title="Una sola barra por indicador: se extiende hacia el jugador que gana, con su color, y su longitud mide la diferencia">Diferencia</th>
      {seasons.map(season=><th key={season.summary.id} className="min-w-[120px] px-3 py-3 text-right" style={{color:seasonColor(season.index)}}>
       <span className="block truncate text-white" title={nameOf(season)}>{nameOf(season)}</span>
       <span className="block text-[10px] font-normal text-blue-100">{shortSeason(season.summary.season)}{season.rank?" · "+season.rank+"º":""}</span>
      </th>)}
     </tr>
    </thead>
    <tbody>
     <tr className="bg-[#e2eaf6]"><td colSpan={seasons.length+4} className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[#173B67]">Resumen del análisis</td></tr>
     {SUMMARY_ROWS.map(row=>{
      const duel=summaryDuel(row,seasons);
      const leader=duel?seasons[duel.best.index]:null;
      return <tr key={row.key} className="border-t border-slate-100 odd:bg-white even:bg-[#f7f9fc]">
       <td className="px-3 py-2 font-semibold text-slate-700">{row.label}</td>
       <td className="px-2 py-2 text-center text-slate-400" title="Las filas resumen no tienen peso estadístico">—</td>
       <td className="px-3 py-2 text-[11px]">{leader?<span className="font-bold text-slate-800" title={nameOf(leader)}>
        {duel.gap===0?"Empate":nameOf(leader)}
        <span className="block text-[10px] font-normal text-slate-500">{duel.gap===0?"sin ventaja":"+"+fmt(duel.gap,1)+" "+(row.key==="coverage"?"p. p.":row.key==="average"?"puntos":"indicadores")}</span>
       </span>:<span className="text-slate-400">—</span>}</td>
       <td className="px-3 py-2">{duel?<CompareDuelBar seasons={seasons} nameOf={index=>nameOf(seasons[index])} best={duel.best} second={duel.second}/>:<span className="text-slate-400">—</span>}</td>
       {seasons.map(season=><td key={season.summary.id} className={"px-3 py-2 text-right "+(row.key==="wins"?"font-black text-emerald-800":"font-bold tabular-nums text-slate-800")}>{row.get(season)}</td>)}
      </tr>;
     })}
     <tr className="border-t-2 border-[#003399]/25 bg-[#eaf0fb]">
      <td className="px-3 py-2 font-black text-[#0d315b]">Composite MF LEGACY</td>
      <td className="px-2 py-2 text-center text-slate-400">—</td>
      <td className="px-3 py-2 text-[11px] font-bold text-emerald-800" title="Diferencia de Composite entre el primer y el segundo puesto">{model.headline?model.headline.winner.rank+"º vs 2º · "+signed(model.headline.gap)+" pts":"—"}</td>
      <td className="px-3 py-2">{model.headline
       ?<CompareDuelBar seasons={seasons} nameOf={index=>nameOf(seasons[index])}
         best={{index:model.headline.winner.index,strength:model.headline.winner.score}}
         second={{index:model.headline.loser.index,strength:model.headline.loser.score}}/>
       :<span className="text-[10px] font-semibold text-slate-400">sin segundo Composite</span>}</td>
      {seasons.map(season=><td key={season.summary.id} className="px-3 py-2 text-right">
       <span className="block text-base font-black tabular-nums text-[#003399]">{season.score===null?"—":fmt(season.score,1)}</span>
       <span className={"block text-[10px] font-bold "+(season.rank===1?"text-emerald-700":"text-rose-700")}>{season.rank===1?"Líder":season.gapToLeader!==null?"−"+fmt(Math.abs(season.gapToLeader),1)+" pts":"—"}</span>
       {season.score!==null&&<span className="block text-[10px] font-semibold tabular-nums text-slate-500" title={"Suma de los aportes de los "+fmt(season.count,0)+" indicadores valorables: "+signed(contributionSum(season))+" puntos. El Composite reescala esa suma según el peso disponible de la temporada."}>suma {signed(contributionSum(season))}</span>}
      </td>)}
     </tr>
     <tr className="bg-[#e2eaf6]"><td colSpan={seasons.length+4} className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[#173B67]">Indicadores del Composite · percentil frente a su arquetipo · {contested} comparables</td></tr>
     {indicators.map(indicator=>{
      const leaderCell=indicator.best?seasons[indicator.best.index]:null;
      return <tr key={indicator.key} className="border-t border-slate-100 odd:bg-white even:bg-[#f7f9fc]">
       <td className="px-3 py-2 font-semibold text-slate-700"><button type="button" className="text-left font-bold text-[#003399] underline decoration-blue-200 underline-offset-2 hover:decoration-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500" title={"Ver ranking histórico de "+indicator.name} onClick={()=>setRankingIndicator({indicator,role:seasons.find(x=>x.analysis?.rows?.some(r=>r.key===indicator.key))?.role})}>{indicator.name}</button>{indicator.penalty&&<span className="ml-1 text-[10px] text-rose-700">(penalización)</span>}</td>
       <td className="px-2 py-2 text-center tabular-nums text-slate-500">{indicator.weight===null?"—":(indicator.weight>0?"+":"")+indicator.weight+" %"}</td>
       <td className="px-3 py-2">
        {leaderCell?<>
         <span className="flex items-center gap-1.5"><Crown size={13} className="shrink-0 text-amber-500"/><span className="truncate font-bold text-slate-800" title={nameOf(leaderCell)}>{nameOf(leaderCell)}</span></span>
         <span className="block text-[10px] text-slate-500">{indicator.gap===null?"sin segunda cifra":indicator.gap===0?"empate con el 2º":"gana el indicador"}</span>
        </>:<span className="text-slate-400">—</span>}
       </td>
       <td className="px-3 py-2"><CompareDuelBar best={indicator.best} second={indicator.second} seasons={seasons} nameOf={index=>nameOf(seasons[index])}/></td>
       {indicator.cells.map(cell=>{
        const season=seasons[cell.index];
        const row=cell.row;
        if(!row||row.percentile===null)return <td key={season.summary.id} className="px-3 py-2 text-right text-slate-400" title={row?"Percentil no calculable con la población actual":"Temporada sin análisis comparable"}>{row&&row.value!==null?<span className="text-slate-600">{fmt(row.value,2)}<span className="block text-[10px] text-slate-400">sin percentil</span></span>:"—"}</td>;
        const strength=cell.strength;
        const isBest=indicator.best!==null&&strength===indicator.best.strength;
        const delta=indicator.best!==null?strength-indicator.best.strength:null;
        const title="Percentil bruto "+fmt(row.percentile,2)+" de 100 · valor "+fmt(row.value,2)+" · puesto "+row.rank+" de "+row.n+" temporadas de "+row.nPlayers+" jugadores"+(row.penalty?" · indicador penalizado (menos es mejor)":"")+" · aporta "+fmt(row.contribution,2)+(row.provisional?" · muestra reducida":"");
        return <td key={season.summary.id} className={"min-w-[146px] px-3 py-3 text-right align-middle "+(isBest?"bg-emerald-50/80 ring-1 ring-inset ring-emerald-100":"")} title={title}><div className="flex flex-col items-end gap-1">
         <span className="block text-base leading-tight tabular-nums" style={{color:isBest?undefined:seasonColor(cell.index)}}>
          <span className={isBest?"font-black text-emerald-800":"font-bold"}>{fmt(row.percentile,1)}</span>
         </span>
         <span className="block text-[11px] font-medium tabular-nums text-slate-600" title="Valor real del indicador">Valor {fmt(row.value,2)}{row.provisional&&<span className="text-amber-600"> *</span>}</span>
         {Number.isInteger(row.rank)&&Number.isInteger(row.n)&&row.n>0&&<span className="mt-1 inline-flex items-baseline gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 font-semibold tabular-nums text-slate-700" title={"Puesto histórico de esta temporada en "+indicator.name+": "+row.rank+" de "+row.n+" temporadas comparables · "+row.nPlayers+" jugadores distintos"+(row.penalty?" · menos es mejor":"")}><span className="text-[11px] font-black text-[#003399]">#{row.rank}</span><span className="text-[10px] text-slate-500">/ {row.n}</span></span>}
         <span className={"inline-block rounded px-2 py-0.5 text-[11px] font-bold tabular-nums "+(isBest?"bg-emerald-700 text-white":"bg-slate-100 text-slate-600")} title={isBest?"Mejor percentil de la fila":"Diferencia en puntos de percentil frente al mejor de la fila"}>{isBest?"MEJOR":signed(delta)+" p. p."}</span>
         <span className={"mt-1 inline-flex items-center justify-end gap-1 rounded-md border px-2 py-1 text-[12px] font-extrabold tabular-nums "+(row.contribution===null?"border-slate-200 bg-slate-50 text-slate-500":row.contribution<0?"border-rose-200 bg-rose-50 text-rose-800":"border-blue-200 bg-blue-50 text-[#003399]")} title={"Aporte de "+indicator.name+" al Composite de "+season.summary.season+": percentil "+fmt(row.percentile,1)+" × peso "+(indicator.weight===null?"—":indicator.weight+" %")+" = "+signed(row.contribution)+" puntos"}><span className="text-[10px] font-semibold uppercase tracking-wide">Aporta</span><span>{signed(row.contribution)}</span></span>
        </div></td>;
       })}
      </tr>;
     })}
     {!indicators.length&&<tr><td colSpan={seasons.length+4} className="px-3 py-8 text-center text-slate-500">No hay indicadores de Composite que comparar con la base histórica actual.</td></tr>}
    </tbody>
   </table>
  </div>
  <p className="mt-2 text-[11px] text-slate-500">Una sola barra por indicador: el centro es el empate y la barra se extiende hacia el jugador que gana, pintada con su color, con la diferencia en puntos de percentil a su lado. Si los valores son iguales la barra se queda quieta en el medio. El color identifica a cada jugador en toda la tabla, la corona señala al mejor de cada fila y la cifra roja es la diferencia exacta frente a ese mejor. Los percentiles comparan temporadas de jugadores distintos, no partidos sueltos.</p>
  {rankingIndicator?.role&&<IndicatorHistoricalRankingModal indicator={rankingIndicator.indicator} role={rankingIndicator.role} observations={observations} selectedPlayerIds={seasons.map(x=>String(x.summary.player_id))} onClose={()=>setRankingIndicator(null)}/>}
  {onOpen&&<p className="mt-1 text-[11px] text-slate-500">Pulsa «Desglose completo» en cualquier ficha para ver el análisis detallado con la muestra completa.</p>}
 </section>;
}