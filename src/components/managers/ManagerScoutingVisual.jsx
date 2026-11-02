import React,{useState} from "react";
import {Activity,BarChart3,ChevronDown,ChevronUp,ClipboardList,Info,Layers3,Users} from "lucide-react";
import PlayerPortrait from "@/components/teams/PlayerPortrait";

const CONFIDENCE={medium:"Media",low:"Baja",insufficient:"Sin datos suficientes"};
const modeName={role:"Encaje por ADN V4",historical:"Histórico V3",attributes:"FM26 orientativo V2",position:"Adecuación posicional V1"};
const modeDescription={
 role:"Requiere requisitos reconocibles del ADN, al menos dos métricas observadas y diez jugadores comparables por indicador.",
 historical:"Compara estadísticas de la misma temporada entre jugadores del mismo rol.",
 attributes:"Estima ajuste con atributos FM26 y señales generales del ADN; no es rendimiento histórico.",
 position:"Solo valora compatibilidad con la posición, no encaje con el entrenador."
};
export const scoutingScore=(item,mode)=>mode==="role"?item?.roleFit?.score??null:mode==="historical"?item?.historical?.score??null:mode==="attributes"?item?.advanced?.score??null:item?.fit??null;
export const scoutingCoverage=(item,mode)=>mode==="role"?item?.roleFit?.coverage??0:mode==="historical"?item?.historical?.coverage??0:mode==="attributes"?item?.advanced?.coverage??0:null;
export function ManagerScoutingSummary({scoreMode,visibility,roleRequirements,statsLoading,statsError,season}){
 const available=visibility.scoredCount||0,compatible=visibility.compatibleCount||0;
 const noV4Criteria=scoreMode==="role"&&!roleRequirements?.matched?.length;
 const pending=statsLoading;
 const status=scoreMode==="role"?(noV4Criteria?"No se reconocen criterios del rol":available?"V4 parcialmente evaluable":"Datos insuficientes para puntuar V4"):
 scoreMode==="historical"?(available?"Histórico calculado":"Sin muestra histórica suficiente"):
 scoreMode==="attributes"?(available?"Estimaciones FM26 disponibles":"Atributos FM26 insuficientes"):"Solo posición";
 const statusText=noV4Criteria?"El ADN de este rol aún no especifica indicadores que el sistema pueda relacionar de forma fiable con estadísticas.":
 pending?"Comprobando métricas de "+season+"…":
 scoreMode==="role"&&available===0?"Aunque existan jugadores compatibles, la V4 exige dos indicadores medidos y una muestra de al menos diez comparables por indicador. No sustituimos esa nota por el encaje posicional.":
 modeDescription[scoreMode];
 return <section className="space-y-3" aria-label="Estado del modelo táctico">
  <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
   {[
    {title:"Compatibles con el rol",number:compatible,detail:"Por posición"},
    {title:"Evaluables en este modo",number:available,detail:modeName[scoreMode]},
    {title:"Sin puntuación",number:visibility.unscoredCount||0,detail:"No implica bajo rendimiento"},
    {title:"En pantalla",number:visibility.shownCount||0,detail:visibility.fallback?"Orden posicional provisional":"Según el modo elegido"}
   ].map((x,i)=><div key={x.title} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
    <div className="flex items-center justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{x.title}</span>{i===0?<Users size={14} className="text-slate-400"/>:i===1?<BarChart3 size={14} className="text-slate-400"/>:i===2?<Activity size={14} className="text-slate-400"/>:<Layers3 size={14} className="text-slate-400"/>}</div>
    <p className="mt-1.5 text-2xl font-black tabular-nums tracking-tight text-slate-900">{x.number}</p>
    <p className="text-[10px] text-slate-500">{x.detail}</p>
   </div>)}
  </div>
  <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-[#f4f7fc] p-3 sm:p-4">
   <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[#003399]"><Info size={18}/></div>
   <div className="min-w-0 flex-1">
    <div className="flex flex-wrap items-center gap-2">
     <strong className="text-sm text-slate-900">{status}</strong>
     <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600">{modeName[scoreMode]}</span>
    </div>
    <p className="mt-1 text-xs leading-5 text-slate-600">{statusText}</p>
    {scoreMode==="role"&&<p className="mt-1.5 text-[11px] text-slate-600"><strong>Indicadores reconocidos:</strong> {roleRequirements?.matched?.length?roleRequirements.matched.map(x=>x.label).join(" · "):"Ninguno para este rol"}</p>}
    {statsError&&<p role="alert" className="mt-2 text-xs text-red-700">{statsError}</p>}
   </div>
  </div>
 </section>;
}
export function ScoutingCandidateCard({item,scoreMode,selected,compareDisabled,onCompare,onReport,age,valueText}){
 const [more,setMore]=useState(false);
 const measured=scoutingScore(item,scoreMode);
 const score=typeof measured==="number"&&Number.isFinite(measured)?measured:null;
 const coverage=scoutingCoverage(item,scoreMode);
 const isPositional=scoreMode==="position";
 const label=isPositional?"Encaje posicional":scoreMode==="attributes"?"Estimación FM26":scoreMode==="role"?"Encaje V4":"Histórico V3";
 const evidence=scoreMode==="role"?item.roleFit:scoreMode==="historical"?item.historical:scoreMode==="attributes"?item.advanced:null;
 return <article className="flex min-w-0 flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm transition hover:border-blue-200 hover:shadow-md">
  <div className="flex min-w-0 gap-3">
   <PlayerPortrait player={item.player} className="h-14 w-14 shrink-0 rounded-xl border border-slate-100 bg-slate-50 object-cover" fallback={String(item.player.name||"?").charAt(0)}/>
   <div className="min-w-0 flex-1">
    <h3 title={item.player.name} className="truncate text-sm font-black text-slate-900">{item.player.name}</h3>
    <p className="mt-1 text-[11px] text-slate-500">{item.player.position||"Sin posición"} · {age??"—"} años · CA {item.quality??"—"}/200</p>
    <p className="mt-0.5 text-[11px] text-slate-500">Valor histórico: {valueText}</p>
   </div>
   <div className="shrink-0 text-right">
    <strong className={"block text-xl font-black tabular-nums "+(score===null?"text-slate-400":"text-[#003399]")}>{score===null?"—":score}</strong>
    <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">{score===null?"Sin evaluación":"/100 "+label}</p>
   </div>
  </div>
  <div className="rounded-lg bg-slate-50 px-3 py-2">
   <div className="flex flex-wrap items-center justify-between gap-2">
    <span className="text-[11px] font-semibold text-slate-700">{score===null?"Sin datos suficientes para puntuar":label}</span>
    {scoreMode!=="position"&&<span className="text-[10px] text-slate-500">Cobertura {coverage}%</span>}
   </div>
   {scoreMode!=="position"&&<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-[#3a6eae]" style={{width:Math.max(0,Math.min(100,coverage))+"%"}}/></div>}
   {score===null&&<p className="mt-1 text-[10px] text-slate-500">Ordenación auxiliar por adecuación posicional, sin convertirla en nota {label}.</p>}
   {scoreMode==="attributes"&&score!==null&&<p className="mt-1 text-[10px] text-slate-500">Modelo experimental, no predicción de rendimiento.</p>}
  </div>
  <div className="flex flex-wrap items-center justify-between gap-2">
   <span className="text-[10px] text-slate-500">Compatibilidad posicional: {item.fit??"—"}/100</span>
   <button type="button" aria-expanded={more} onClick={()=>setMore(v=>!v)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#003399]">{more?"Menos detalle":"Detalle técnico"} {more?<ChevronUp size={14}/>:<ChevronDown size={14}/>}</button>
  </div>
  {more&&<div className="space-y-1 border-t border-slate-100 pt-2 text-[11px] leading-5 text-slate-600">
   <p><strong>Confianza:</strong> {CONFIDENCE[evidence?.confidence||item.reliability]||"No determinada"}</p>
   {scoreMode==="role"&&<><p><strong>Métricas:</strong> {item.roleFit.breakdown.length}/{item.roleFit.requested} observadas y comparables</p><p>{item.roleFit.breakdown.length?item.roleFit.breakdown.map(m=>m.key+" P"+m.percentile).join(" · "):item.roleFit.limitation}</p></>}
   {scoreMode==="historical"&&<p><strong>Histórico:</strong> {item.historical.breakdown.length?item.historical.breakdown.map(m=>m.key+" P"+m.percentile).join(" · "):"Sin indicadores históricos evaluables"}</p>}
   {scoreMode==="attributes"&&<p>Posición {item.advanced.position??"—"} · Atributos {item.advanced.attributes??"—"} · ADN {item.advanced.style??"—"}</p>}
   {scoreMode==="position"&&<p>{item.evidence}</p>}
  </div>}
  <div className="mt-auto flex gap-2 border-t border-slate-100 pt-3">
   <button type="button" aria-pressed={selected} disabled={compareDisabled} onClick={onCompare} className={"flex-1 rounded-lg border px-2.5 py-2 text-[11px] font-bold disabled:opacity-40 "+(selected?"border-[#003399] bg-blue-50 text-[#003399]":"border-slate-200 text-slate-700 hover:bg-slate-50")}>{selected?"Quitar de comparación":"Comparar +"}</button>
   <button type="button" onClick={onReport} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#003399] px-2.5 py-2 text-[11px] font-bold text-white hover:bg-[#002771]"><ClipboardList size={13}/> Informe</button>
  </div>
 </article>;
}
export function ManagerMethodsPanel(){
 return <details className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
  <summary className="cursor-pointer font-bold text-slate-800">Metodología y limitaciones de V4, V3, FM26 y posición</summary>
  <div className="mt-3 space-y-2 leading-5">
   <p><strong>V4 · Requisitos del ADN:</strong> relaciona únicamente frases explícitas del rol con proxies estadísticos comprobables. No utiliza IA durante la búsqueda. Exige al menos dos indicadores observados y diez jugadores comparables por métrica; sin ellos deja la nota sin calcular.</p>
   <p><strong>V3 · Histórico:</strong> percentiles de una misma temporada y rol. No miden directamente la adaptación a la filosofía del entrenador.</p>
   <p><strong>V2 · FM26:</strong> estimación a partir de posición, atributos del videojuego y parámetros generales de ADN. No sustituye mediciones históricas y mantiene el CA independiente.</p>
   <p><strong>V1 · Posición:</strong> compatibilidad posicional sin evaluación de requisitos del entrenador.</p>
   <p>Una nota ausente (—) significa evidencia insuficiente, nunca cero ni mal rendimiento. Ninguna nota predice fichajes, disponibilidad ni rendimiento futuro.</p>
  </div>
 </details>;
}
