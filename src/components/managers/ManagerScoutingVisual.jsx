import React,{useState} from "react";
import {Activity,BarChart3,ChevronDown,ChevronUp,ClipboardList,Info,Layers3,Users} from "lucide-react";
import PlayerPortrait from "@/components/teams/PlayerPortrait";
import {v4MissingMetricExplanations} from "./managerV4MetricExplanation.mjs";
import {V4_METRIC_LABELS} from "./managerRoleRules.mjs";

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
 const hasDescription=Boolean(roleRequirements?.text?.trim());
 const pending=statsLoading;
 const status=scoreMode==="role"?(noV4Criteria?"ADN del rol sin indicadores históricos evaluables":available?"V4 parcialmente evaluable":"Datos insuficientes para puntuar V4"):
 scoreMode==="historical"?(available?"Histórico calculado":"Sin muestra histórica suficiente"):
 scoreMode==="attributes"?(available?"Estimaciones FM26 disponibles":"Atributos FM26 insuficientes"):"Solo posición";
 const statusText=noV4Criteria?(hasDescription?
  "El entrenador solicita «"+roleRequirements.text+"», pero no hay indicadores históricos suficientemente directos para ese rasgo, o falta reconocer alguna expresión. Esto NO significa que los jugadores carezcan de estadísticas. V4 no puede asignarles una nota táctica con esta descripción.":
  "El ADN guardado no contiene descripción específica para este rol. Completa el perfil del entrenador antes de calcular un encaje V4."):
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
    {scoreMode==="role"&&roleRequirements?.metricKeys?.length>0&&<p className="mt-1.5 text-[11px] text-slate-700">
     <strong>Qué se pide medir:</strong> {roleRequirements.metricKeys.map(key=>V4_METRIC_LABELS[key]||key).join(" · ")}.
     Que se solicite un indicador no significa que exista una muestra suficiente para puntuarlo.
    </p>}
    {scoreMode==="role"&&<><p className="mt-1.5 text-[11px] text-slate-600"><strong>Requisitos reconocidos:</strong> {roleRequirements?.matched?.length?roleRequirements.matched.map(x=>x.label).join(" · "):"Ningún indicador histórico directo para la descripción actual"}</p><p className="mt-1 text-[11px] text-slate-500"><strong>Indicadores solicitados:</strong> {roleRequirements?.metricKeys?.length||0} · Solo se puntúan si hay observaciones y al menos diez comparables por métrica.</p>{roleRequirements?.unmeasuredTraits?.length>0&&<p className="mt-1 text-[11px] text-slate-600"><strong>No medible con estas estadísticas:</strong> {roleRequirements.unmeasuredTraits.join(" · ")}</p>}</>}
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
 const v4Missing=scoreMode==="role"?v4MissingMetricExplanations(item.roleFit):[];
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
    <span className="text-[11px] font-semibold text-slate-700">{score===null?
    (scoreMode==="role"&&item.roleFit?.unmatched?"ADN sin métricas reconocibles":
     "Evidencia insuficiente para puntuar"):label}</span>
    {scoreMode!=="position"&&<span className="text-[10px] text-slate-500">{scoreMode==="role"&&item.roleFit?.requested===0?"Cobertura no aplicable":"Cobertura "+coverage+"%"}</span>}
   </div>
   {scoreMode!=="position"&&<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-[#3a6eae]" style={{width:Math.max(0,Math.min(100,coverage))+"%"}}/></div>}
   {scoreMode==="role"&&item.roleFit?.requested>0&&<p className="mt-1.5 text-[10px] text-slate-600">
    <strong>{item.roleFit.breakdown.length}/{item.roleFit.requested} métricas</strong> ·
    {" "}{item.roleFit.evaluatedFunctions??0}/{item.roleFit.requestedFunctions??0} funciones evaluadas ·
    {" "}{item.roleFit.minimumPeers??"—"} comparables mínimo ·
    {" "}Confianza {CONFIDENCE[item.roleFit.confidence]?.toLowerCase()||"sin determinar"}
   </p>}
   {scoreMode==="role"&&item.roleFit?.requested>0&&<p className="mt-1.5 text-[10px] leading-4 text-slate-600">
    <strong>¿Por qué {item.roleFit.breakdown.length}/{item.roleFit.requested}?</strong>
    {" "}De los {item.roleFit.requested} indicadores solicitados, solo {item.roleFit.breakdown.length} tienen dato individual y muestra comparable suficiente. Los demás no entran en la puntuación.
   </p>}
   {v4Missing.length>0&&<div className="mt-2 space-y-1.5 border-t border-slate-200 pt-2">
    {v4Missing.slice(0,4).map(metric=><p key={metric.key} className="text-[10px] leading-4 text-amber-900">
     <strong>{metric.name}:</strong> {metric.reason}
    </p>)}
    {v4Missing.length>4&&<p className="text-[10px] text-slate-500">+{v4Missing.length-4} indicadores sin evaluar en Detalle técnico</p>}
   </div>}
   {score===null&&<p className="mt-1 text-[10px] text-slate-500">Ordenación auxiliar por adecuación posicional, sin convertirla en nota {label}.</p>}
   {scoreMode==="attributes"&&score!==null&&<p className="mt-1 text-[10px] text-slate-500">Modelo experimental, no predicción de rendimiento.</p>}
  </div>
  {scoreMode==="role"&&!!item.roleFit.requirementBreakdown?.length&&
   <div className="flex flex-wrap gap-1.5" aria-label="Funciones del ADN evaluadas">
    {item.roleFit.requirementBreakdown.slice(0,4).map(family=><span key={family.id}
     title={family.label+" · "+family.measured+"/"+family.requested+" indicadores"}
     className="inline-flex min-w-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-600">
     <span className="max-w-[210px] truncate">{family.label.replace(/ \(proxy(?: parcial)?\)/gi,"")}</span>
     <strong className="tabular-nums text-slate-800">{family.score===null?"—":family.score}</strong>
    </span>)}
    {item.roleFit.requirementBreakdown.length>4&&<span className="self-center text-[10px] text-slate-500">+{item.roleFit.requirementBreakdown.length-4} funciones</span>}
   </div>}
  <div className="flex flex-wrap items-center justify-between gap-2">
   <span className="text-[10px] text-slate-500">Adecuación de posición FM26: {item.fit??"—"}/100</span>
   <button type="button" aria-expanded={more} onClick={()=>setMore(v=>!v)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#003399]">{more?"Menos detalle":"Detalle técnico"} {more?<ChevronUp size={14}/>:<ChevronDown size={14}/>}</button>
  </div>
  {more&&<div className="space-y-1 border-t border-slate-100 pt-2 text-[11px] leading-5 text-slate-600">
   <p><strong>Confianza:</strong> {CONFIDENCE[evidence?.confidence||item.reliability]||"No determinada"}</p>
   {scoreMode==="role"&&<div className="space-y-2">
    <p><strong>Cómo se ha puntuado V4:</strong> {item.roleFit.breakdown.length}/{item.roleFit.requested} métricas con muestra suficiente. Se calcula una media por función táctica y después se ponderan por igual las funciones evaluadas. {item.roleFit.limitation}</p>
    {!!item.roleFit.requirementBreakdown?.length&&<div className="overflow-hidden rounded-lg border border-blue-100 bg-blue-50/40">
     <p className="px-2.5 pt-2 font-semibold text-slate-700">Funciones solicitadas por el entrenador</p>
     {item.roleFit.requirementBreakdown.map(family=><div key={family.id} className="flex items-center justify-between gap-2 border-b border-blue-100 p-2.5 last:border-b-0">
      <span className="min-w-0 flex-1 text-slate-700">{family.label}<span className="ml-1 text-slate-500">({family.measured}/{family.requested} indicadores)</span></span>
      <strong className="tabular-nums">{family.score===null?"Sin nota":family.score+"/100"}</strong>
     </div>)}
    </div>}
    {!!item.roleFit.metricDiagnostics?.length&&<div className="overflow-hidden rounded-lg border border-slate-200">
     {item.roleFit.metricDiagnostics.map(metric=><div key={metric.key} className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 border-b border-slate-100 px-2.5 py-2 last:border-b-0">
      <span className="min-w-0 flex-1 font-medium text-slate-700">{metric.label}</span>
      <span className={"shrink-0 font-bold tabular-nums "+(metric.status==="measured"?"text-[#225baa]":"text-slate-500")}>
       {metric.status==="measured"?"P"+item.roleFit.breakdown.find(row=>row.key===metric.key)?.percentile:metric.status==="missing_player"?"Sin dato del jugador":"Muestra insuficiente ("+metric.peerCount+"/10 comparables)"}
      </span>
      <span className="w-full text-[10px] text-slate-500">{metric.peerCount} comparables externos (mínimo 10) · {metric.source||"Fuente pendiente"}{metric.scope?" · "+metric.scope:""}{typeof metric.minutes==="number"?" · "+Math.round(metric.minutes)+" minutos registrados":""}</span>
     </div>)}
    </div>}
    {!item.roleFit.metricDiagnostics?.length&&<p>El ADN no contiene requisitos asociados con seguridad a métricas observadas. No es una ausencia general de datos del jugador.</p>}
    {!!item.roleFit.unmeasuredTraits?.length&&<p><strong>Sin medida histórica directa:</strong> {item.roleFit.unmeasuredTraits.join(" · ")}</p>}
   </div>}
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
   <p><strong>V4.1 · Requisitos del ADN:</strong> identifica funciones descritas explícitamente por el entrenador y calcula un percentil para cada indicador comprobable. Después promedia los indicadores disponibles dentro de cada función y da el mismo peso a cada función evaluada. Se requieren al menos dos indicadores distintos y diez compañeros comparables externos por métrica (cuando se conoce el ID). La cobertura indica la fracción medida, no la calidad del futbolista. Fuentes y alcance deben ser comparables; pocos minutos reducen la confianza.</p>
   <p><strong>V3 · Histórico:</strong> percentiles de una misma temporada y rol. No miden directamente la adaptación a la filosofía del entrenador.</p>
   <p><strong>V2 · FM26:</strong> estimación a partir de posición, atributos del videojuego y parámetros generales de ADN. No sustituye mediciones históricas y mantiene el CA independiente.</p>
   <p><strong>V1 · Posición:</strong> compatibilidad posicional sin evaluación de requisitos del entrenador.</p>
   <p>Una nota ausente (—) significa evidencia insuficiente, nunca cero ni mal rendimiento. Ninguna nota predice fichajes, disponibilidad ni rendimiento futuro.</p>
  </div>
 </details>;
}
