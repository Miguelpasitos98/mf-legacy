import React,{useMemo,useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {base44} from "@/api/base44Client";
import {Activity,ArrowRight,BarChart3,CalendarDays,ChevronRight,Database,Pencil,Plus,TrendingUp} from "lucide-react";
import {useHistoricalPeerDataset} from "@/hooks/useHistoricalPeerDataset";
import {overviewHistoricalModel} from "@/utils/statsOverviewModel";
import {historicalRole} from "@/utils/historicalPeers";
import {advancedTotals} from "@/utils/statsAdvanced";
import {aggregate,seasonActive,metricsValue,nationalCompetition} from "@/utils/statsViews";
import OverviewManualEditor from "./OverviewManualEditor";
import {formatEur} from "@/utils/historicalValuation";
import CraftedfcOverview from "./CraftedfcOverview";
import HistoricalValuationsTable from "./HistoricalValuationsTable";

const show=(v,d=0)=>v==null||!Number.isFinite(Number(v))?"—":Number(v).toLocaleString("es-ES",{minimumFractionDigits:d,maximumFractionDigits:d});
const tone=p=>p>=85?"bg-emerald-500":p>=65?"bg-cyan-500":p>=40?"bg-blue-500":p>=20?"bg-amber-400":"bg-rose-400";
function Kpi({title,value,meta,emphasis=false,onEdit}){
 return <div className={"min-w-0 rounded-xl border p-3 "+(emphasis?"border-blue-200 bg-blue-50":"border-slate-200 bg-white")}>
   <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{title}</p>
   {onEdit?<button type="button" onClick={onEdit} title={"Añadir o modificar "+title} className="group mt-1 flex w-full items-center gap-2 rounded-md text-left text-2xl font-black tabular-nums text-[#12365a] hover:text-[#003399] focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"><span className="truncate">{value==="—"?"Añadir +":value}</span><Pencil size={13} className="shrink-0 text-blue-500 opacity-60 group-hover:opacity-100"/></button>:<div className="mt-1 truncate text-2xl font-black tabular-nums text-[#12365a]">{value}</div>}
   {meta&&<p className="mt-1 truncate text-[10px] text-slate-500" title={meta}>{meta}</p>}
 </div>;
}
const Heading=({icon:Icon,children,action})=><div className="mb-3 flex flex-wrap items-center justify-between gap-2">
  <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#003399]"><Icon size={17}/>{children}</h3>
  {action}
</div>;
export default function MfLegacyOverview({playerId,position,season,competition,scope,shown=[],historicalValuations=[],estimatedRating=null,
 snapshot=null,cfcStatus="idle",onSeasonChange,onPerformance,onAnalysis,historicalLoading=false,historicalRefresh,editableRows=[],onSetMetric}){
 const [showValuationHistory,setShowValuationHistory]=useState(false);
 const [manualMode,setManualMode]=useState(null);
 const {data:understatRows=[]}=useQuery({
  queryKey:["understat-season-rates",playerId,season],
  enabled:!!playerId&&season!=="Todas",
  queryFn:async()=>{
   const response=await base44.entities.UnderstatSeasonRate.filter({player_id:playerId,season},{limit:250});
   return Array.isArray(response)?response:response?.items||response?.data||[];
  },
  staleTime:60000
 });
 const singleRate=understatRows.length===1?understatRows[0]:null;
 const {data,isFetching,error}=useHistoricalPeerDataset(true);
 const model=useMemo(()=>overviewHistoricalModel(data,playerId,season,8),[data,playerId,season]);
 const {result,indicators,trend}=model;
 const composite=result?.composite;
 const role=historicalRole(position);
 const totals=useMemo(()=>aggregate(shown,["goals","assists","xg","xa","shots","appearances","minutes"]),[shown]);
 const advanced=useMemo(()=>advancedTotals(shown,{includeSeasonRates:competition==="Todas"}),[shown,competition]);
 const summary=name=>totals[name]?.value??null;
 const selectedValuation=season==="Todas"?null:historicalValuations.find(v=>String(v.season)===String(season));
 const normalizedValue=selectedValuation?.transfermarkt_value_eur!=null?formatEur(selectedValuation.transfermarkt_value_eur):"—";
 const hasSeason=season!=="Todas";
 const gaAligned=shown.filter(r=>Number(r.minutes)>0 && metricsValue(r,"goals")!==null && metricsValue(r,"assists")!==null);
 const gaMinutes=gaAligned.reduce((acc,r)=>acc+Number(r.minutes),0);
 const gaPer90=gaMinutes>0?gaAligned.reduce((acc,r)=>acc+metricsValue(r,"goals")+metricsValue(r,"assists"),0)*90/gaMinutes:null;
 const noStat=shown.length===0;
 const manualRows=useMemo(()=>editableRows.filter(r=>(season==="Todas"||r.season===season)&&(competition==="Todas"||r.competition===competition)&&(scope==="all"||!nationalCompetition(r.competition))),[editableRows,season,competition,scope]);
 const edit=mode=>setManualMode(mode);
 const score=composite?.score??null;
 const ring=score===null?"rgba(255,255,255,.15)":"conic-gradient(#34d399 "+Math.max(0,Math.min(100,score))+"%,rgba(255,255,255,.18) 0)";
 return <div className="space-y-4">
   <section className="overflow-hidden rounded-2xl border-2 border-blue-200 bg-[#f6f9fe]">
     <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
       <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-[#003399]"><BarChart3 size={18}/> Resumen MF LEGACY <span className="rounded-full bg-white px-2 py-1 text-[10px] text-blue-700 ring-1 ring-blue-100">vs {role||"posición desconocida"}</span></h3>
     </div>
     <div className="grid gap-3 p-3 lg:grid-cols-[270px_minmax(0,1fr)]">
       <div className="flex flex-col justify-between gap-4 rounded-xl bg-[#102e51] p-4 text-white">
         <div><p className="text-[10px] font-black uppercase tracking-widest text-blue-200">Composite MF LEGACY</p><p className="mt-1 text-xs text-blue-100">{hasSeason?season:"Elige una temporada"} · {role||"—"}</p></div>
         <div className="flex items-center gap-3">
           <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full p-[7px]" style={{background:ring}}
             role={score!==null?"progressbar":undefined} aria-valuenow={score??undefined} aria-valuemin={0} aria-valuemax={100} aria-label="Composite MF LEGACY">
             <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-[#102e51]"><span className="text-3xl font-black tabular-nums">{show(score,1)}</span><span className="text-[10px] text-blue-200">de 100</span></div>
           </div>
           <div><p className="text-xs font-semibold">Índice propio</p><p className="mt-1 text-[11px] text-blue-200">Cobertura {show(composite?.coverage,1)} %</p><p className="mt-1 text-[11px] text-blue-200">{composite?composite.count+"/"+composite.total:"—"} indicadores</p></div>
         </div>
         <p className="border-t border-white/20 pt-2 text-[11px] leading-relaxed text-blue-100">
           {!hasSeason?"Selecciona una temporada para comparar.":
           error?"La comparación no está disponible.":
           !data?"Cargando la base completa…":
           !result?"No hay observación histórica comparable.":
           result.population+" temporadas de "+result.players+" jugadores. "+(result.players<10?"Muestra pequeña: valoración provisional.":"Pesos experimentales, no rating oficial.")}
         </p>
         <button type="button" onClick={onAnalysis} className="flex items-center justify-center gap-1 rounded-lg bg-white px-3 py-2 text-xs font-black text-blue-900 hover:bg-blue-50">Ver análisis completo <ArrowRight size={14}/></button>
       </div>
       <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
         <Kpi title="Partidos" value={show(summary("appearances"))} meta={(totals.appearances?.available||0)+"/"+shown.length+" competiciones"} onEdit={()=>edit("appearances")}/>
         <Kpi title="Minutos" value={show(summary("minutes"))} meta="Minutos registrados" onEdit={()=>edit("minutes")}/>
         <Kpi title="Nota FotMob" value={show(estimatedRating,2)} meta="Media ponderada por PJ" emphasis onEdit={()=>edit("rating")}/>
         <Kpi title="Goles" value={show(summary("goals"))} meta={(totals.goals?.available||0)+"/"+shown.length+" competiciones"} onEdit={()=>edit("goals")}/>
         <Kpi title="Asistencias" value={show(summary("assists"))} meta={(totals.assists?.available||0)+"/"+shown.length+" competiciones"} onEdit={()=>edit("assists")}/>
         <Kpi title="G+A /90" value={show(gaPer90,2)} meta="G, A y minutos alineados"/>
       </div>
     </div>
     <div className="flex flex-wrap items-center gap-2 border-t border-blue-100 bg-white px-4 py-2 text-[11px] text-slate-600">
       <strong>{hasSeason?season:"Histórico disponible"}</strong><span>· {competition==="Todas"?"Total filtrado":competition}</span>
       <span>· {scope==="all"?"Clubes y selecciones":"Solo clubes"}</span>
       {hasSeason&&seasonActive(season)&&<span className="rounded bg-amber-100 px-2 py-0.5 font-bold text-amber-900">En curso</span>}
       {noStat&&<span className="text-amber-700">Sin registros en estos filtros</span>}
       <span className="ml-auto text-slate-400">KPIs: filtros activos · Composite: temporada completa de clubes</span>
     </div>
   </section>

   {hasSeason&&understatRows.length>0&&<section className="rounded-xl border border-blue-200 bg-white p-4">
    <h4 className="mb-2 text-xs font-black uppercase text-blue-900">Understat · datos independientes de temporada y equipo</h4>
    <p className="mb-3 text-xs text-slate-500">No son una media de Champions, Liga y copas. Cada equipo conserva sus propios valores y nunca se promedian sin minutos.</p>
    <div className="grid gap-2 sm:grid-cols-2">{understatRows.map(r=><div key={r.id||r.team} className="rounded-lg border bg-slate-50 p-3">
     <strong className="text-xs">{r.team} · {r.season}</strong>
     <div className="mt-2 flex gap-4 text-xs"><span>xG Chain /90: <b>{show(r.xg_chain_p90,2)}</b></span><span>xG Buildup /90: <b>{show(r.xg_buildup_p90,2)}</b></span></div>
    </div>)}</div>
   </section>}
   {error&&<p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">No se pudieron cargar los percentiles: {error.message}. El rendimiento sigue disponible.</p>}

   <div className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
     <section className="rounded-xl border border-slate-200 bg-white p-4">
       <Heading icon={TrendingUp} action={<button type="button" onClick={onAnalysis} className="flex items-center gap-1 text-[11px] font-bold text-[#003399] hover:underline">Todos los indicadores <ChevronRight size={13}/></button>}>Indicadores destacados · vs {role||"posición"}</Heading>
       <p className="mb-3 text-[11px] text-slate-500">Comparación global por arquetipo. Los percentiles corresponden a la temporada completa.</p>
       {!hasSeason||!data||!result?<div className="rounded-lg bg-slate-50 p-6 text-center text-xs text-slate-500">{!hasSeason?"Selecciona una temporada para ver percentiles.":isFetching?"Cargando comparación…":"No hay datos comparables para esta selección."}</div>:
       <div className="space-y-3">
         {indicators.map(metric=><div key={metric.key} className="grid grid-cols-[minmax(0,1fr)_85px] items-center gap-3">
           <div><div className="mb-1 flex justify-between gap-2"><span className="truncate text-xs font-semibold text-slate-700" title={metric.name}>{metric.name}</span><span className="shrink-0 text-[11px] text-slate-500">{metric.weight>0?"+":""}{metric.weight}%</span></div>
             <div className="h-2.5 overflow-hidden rounded-full bg-slate-100" role="meter" aria-label={"Percentil de "+metric.name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={metric.percentile}>
               <div className={"h-full rounded-full "+tone(metric.penalty?100-metric.percentile:metric.percentile)} style={{width:Math.max(0,Math.min(100,metric.percentile))+"%"}}/>
             </div></div>
           <div className="text-right"><p className="text-sm font-black text-[#0f3c6c]">{show(metric.percentile,1)}º{metric.provisional&&<span className="text-amber-600">*</span>}</p><p className="text-[10px] text-slate-500">{metric.rank}º / {metric.n} temp.</p></div>
         </div>)}
         {indicators.length===0&&<p className="text-xs text-slate-500">Sin percentiles disponibles.</p>}
         {result.players<10&&<p className="rounded-lg bg-amber-50 p-2 text-[11px] text-amber-800">* Percentiles provisionales: solo {result.players} jugadores distintos. Cada métrica tiene su propia muestra.</p>}
       </div>}
     </section>
     <section className="rounded-xl border border-slate-200 bg-white p-4">
       <Heading icon={Activity} action={<button type="button" onClick={onPerformance} className="flex items-center gap-1 text-[11px] font-bold text-[#003399] hover:underline">Ver Performance <ChevronRight size={13}/></button>}>Producción y creación</Heading>
       <div className="grid grid-cols-2 gap-2">
         <Kpi title="xG" value={show(summary("xg"),2)} meta={(totals.xg?.available||0)+"/"+shown.length+" competiciones"} onEdit={()=>edit("xg")}/>
         <Kpi title="xA" value={show(summary("xa"),2)} meta={(totals.xa?.available||0)+"/"+shown.length+" competiciones"} onEdit={()=>edit("xa")}/>
         <Kpi title="xG Chain /90" value={show(advanced.xg_chain_p90,2)} meta={"Understat · "+advanced.understatRows+"/"+shown.length+" competiciones"} onEdit={()=>edit("chain")}/>
         <Kpi title="xG Buildup /90" value={show(advanced.xg_buildup_p90,2)} meta={"Understat · "+advanced.buildupRows+"/"+shown.length+" competiciones"} onEdit={()=>edit("buildup")}/>
       </div>
       <div className="mt-2 rounded-lg bg-slate-50 p-3">
         <div className="flex items-end justify-between gap-2"><div><p className="text-[10px] font-bold uppercase text-slate-500">Duelos terrestres ganados</p><button type="button" onClick={()=>edit("ground")} title="Añadir o modificar duelos terrestres de una competición" className="mt-1 flex items-center gap-2 rounded text-left text-2xl font-black text-[#003399] hover:text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500">{advanced.ground_duels_won_pct==null?"Añadir +":show(advanced.ground_duels_won_pct,1)+" %"}<Pencil size={13}/></button></div><p className="text-[10px] text-slate-500">{advanced.duelRows+"/"+shown.length+" competiciones"}</p></div>
         {advanced.ground_duels_won_pct!=null&&<div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-sky-500" style={{width:Math.max(0,Math.min(100,advanced.ground_duels_won_pct))+"%"}}/></div>}
         <p className="mt-1 text-[10px] text-slate-500">FotMob derivado · {advanced.duelsWon}/{advanced.duelsTotal} duelos</p>
       </div>
     </section>
   </div>

   <div className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
     <section className="rounded-xl border border-slate-200 bg-white p-4">
       <Heading icon={CalendarDays}>Evolución histórica MF LEGACY</Heading>
       {data&&trend.length>0?<div className="grid grid-cols-7 gap-1">
         {trend.map(t=><button key={t.season} type="button" onClick={()=>onSeasonChange(t.season)}
           className={"group rounded-lg p-1.5 text-center hover:bg-blue-50 "+(t.selected?"bg-blue-50 ring-1 ring-blue-300":"")}
           aria-label={"Ver temporada "+t.season+" · índice "+show(t.score,1)} title={"Cobertura "+show(t.coverage,1)+" % · "+t.players+" jugadores"}>
           <div className="mx-auto flex h-24 max-w-[36px] flex-col justify-end rounded bg-slate-100">{t.score!==null&&<div className={"min-h-[2px] rounded-t "+(t.selected?"bg-[#003399]":"bg-sky-400")} style={{height:Math.max(2,Math.min(100,t.score))+"%"}}/>}</div>
           <p className="mt-1 text-[10px] font-black text-[#163452]">{show(t.score)}</p>
           <p className="text-[9px] text-slate-500">{t.season.replace("/20","/")}</p>
         </button>)}
       </div>:<p className="rounded-lg bg-slate-50 p-4 text-xs text-slate-500">Sin temporadas comparables en la base.</p>}
       <p className="mt-2 text-[10px] text-slate-500">Pulsa una barra para cambiar la temporada. Las puntuaciones son experimentales y pueden tener distinta cobertura.</p>
     </section>
     <section className="rounded-xl border border-slate-200 bg-white p-4">
       <Heading icon={Database}>Valores históricos · temporada</Heading>
       <div className="grid grid-cols-2 gap-2">
         <Kpi title="FC Overall" value={show(selectedValuation?.fifa_fc_overall)} meta={selectedValuation?.fifa_edition||"Sin registro"}/>
         <Kpi title="Transfermarkt" value={normalizedValue} meta={selectedValuation?.market_value_as_of||"Sin fecha"}/>
       </div>
       {selectedValuation?.verification_status!=="verified"&&<p className="mt-2 rounded-lg bg-amber-50 p-2 text-[11px] text-amber-800">{selectedValuation?"Datos pendientes de verificación.":"No hay valoraciones para esta temporada."}</p>}
       <button type="button" onClick={()=>setShowValuationHistory(v=>!v)} aria-expanded={showValuationHistory} className="mt-3 flex items-center gap-1 text-xs font-bold text-[#003399] hover:underline">{showValuationHistory?"Ocultar valoraciones":"Ver todas las valoraciones"} <ArrowRight size={13}/></button>
       {showValuationHistory&&<div className="mt-2 max-h-[360px] overflow-auto"><HistoricalValuationsTable valuations={historicalValuations} loading={historicalLoading} onRefresh={historicalRefresh} stats={editableRows} fallbackPosition={position}/></div>}
     </section>
   </div>
   <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-blue-200 bg-blue-50/50 px-4 py-3"><span className="text-xs text-slate-600">¿Falta otra estadística histórica? Puedes incorporarla sin salir del Overview.</span><button type="button" onClick={()=>edit("other")} className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-xs font-bold text-[#003399] ring-1 ring-blue-200"><Plus size={14}/> Añadir otra estadística</button></div>
   <details className="rounded-xl border border-slate-200 bg-slate-50 p-4">
     <summary className="cursor-pointer text-xs font-bold text-slate-600">Referencia externa CraftedFC (opcional)</summary>
     <div className="mt-3"><CraftedfcOverview snapshot={snapshot} status={cfcStatus} fotmobRating={estimatedRating}/></div>
   </details>
   <OverviewManualEditor mode={manualMode} records={manualRows} onClose={()=>setManualMode(null)} onSave={onSetMetric}/>
 </div>;
}