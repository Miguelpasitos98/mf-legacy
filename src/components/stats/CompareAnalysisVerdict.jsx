import React from "react";
import {Trophy} from "lucide-react";
import {shortSeason} from "@/utils/compareMetrics";

const fmt=(value,decimals=1)=>value===null||value===undefined||!Number.isFinite(Number(value))?"—":Number(value).toLocaleString("es-ES",{minimumFractionDigits:decimals,maximumFractionDigits:decimals});
const barTone=score=>score>=85?"bg-emerald-500":score>=70?"bg-cyan-500":score>=50?"bg-sky-500":score>=30?"bg-amber-400":"bg-rose-400";

// Veredicto visual: quién es mejor, por cuánto y en qué indicadores gana.
export default function CompareAnalysisVerdict({model}){
 if(!model||!model.ranking.length)return null;
 const {ranking,leader,headline,biggest,averageGap,contested}=model;
 const nameOf=season=>season.player?.name||season.summary?.player_name||"Jugador";
 return <section className="mb-4 rounded-xl border-2 border-[#003399]/25 bg-white p-4 shadow-sm">
  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
   <h3 className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-wide text-[#003399]"><Trophy size={16}/> Quién es mejor y por cuánto</h3>
   <span className="text-[11px] text-slate-500">{contested} indicador{contested===1?"":"es"} con comparación directa</span>
  </div>
  {headline&&<p className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900">
   <strong>{nameOf(headline.winner)} ({shortSeason(headline.winner.summary.season)})</strong> es mejor que <strong>{nameOf(headline.loser)} ({shortSeason(headline.loser.summary.season)})</strong> por <strong>{fmt(headline.gap,1)} puntos</strong> de Composite{headline.relative!==null?" ("+fmt(headline.relative,1)+" % más)":""} y gana {headline.winner.wins} de {contested} indicadores comparables.
  </p>}
  <div className="space-y-2">
   {ranking.map(season=><article key={season.summary.id} className={"flex flex-wrap items-center gap-3 rounded-lg border p-3 "+(season.rank===1?"border-emerald-300 bg-emerald-50/60":"border-slate-200 bg-slate-50/60")}>
    <span className={"inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black "+(season.rank===1?"bg-emerald-600 text-white":"bg-slate-200 text-slate-700")} title={"Puesto "+season.rank+" de "+ranking.length+" por Composite MF LEGACY"}>{season.rank}º</span>
    <div className="min-w-[150px] flex-1">
     <p className="truncate text-sm font-black text-[#0f3156]" title={nameOf(season)}>{nameOf(season)}<span className="ml-2 text-[11px] font-semibold text-slate-500">{shortSeason(season.summary.season)}</span></p>
     <p className="truncate text-[11px] text-slate-500" title="Arquetipo, cobertura e indicadores valorables">{season.role||"Sin arquetipo"} · cobertura {fmt(season.coverage,1)} % · {fmt(season.count,0)}/{fmt(season.total,0)} indicadores</p>
    </div>
    <div className="flex items-center gap-2" title={"Composite MF LEGACY "+fmt(season.score,1)+" de 100"}>
     <div className="h-3 w-28 overflow-hidden rounded-full bg-slate-200 sm:w-40"><div className={"h-full rounded-full "+barTone(season.score)} style={{width:Math.max(0,Math.min(100,season.score))+"%"}}/></div>
     <span className="w-14 text-right text-base font-black tabular-nums text-[#003399]">{fmt(season.score,1)}</span>
    </div>
    <div className="w-28 shrink-0 text-right">
     {season.rank===1?<span className="inline-flex items-center rounded-full bg-emerald-600 px-2 py-1 text-[10px] font-black tracking-wide text-white">LÍDER</span>
      :<><span className="block text-sm font-black tabular-nums text-rose-700" title="Diferencia de Composite frente al líder">−{fmt(Math.abs(season.gapToLeader),1)} pts</span><span className="block text-[10px] text-slate-500">{leader?.score?fmt(Math.abs(season.gapToLeader)/leader.score*100,1)+" % menos":"mismo Composite"}</span></>}
    </div>
    <div className="w-20 shrink-0 text-right" title="Indicadores en los que esta temporada logra el mejor percentil">
     <span className="block text-[10px] font-bold uppercase text-slate-500">Ganados</span>
     <span className="block text-sm font-black tabular-nums text-slate-800">{season.wins}<span className="text-[10px] font-normal text-slate-500">/{contested}</span></span>
    </div>
   </article>)}
  </div>
  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
   {[
    ["Ventaja del líder",headline?fmt(headline.gap,1)+" pts":"—",headline?"sobre el 2º puesto en el Composite":"sin segundo Composite"],
    ["Indicadores ganados",leader?leader.wins+" de "+contested:"—",leader?"por "+nameOf(leader):"sin líder"],
    ["Mayor diferencia",biggest?"+"+fmt(biggest.gap,1):"—",biggest?biggest.name+" (puntos de percentil)":"sin indicadores comparables"],
    ["Diferencia media",averageGap===null?"—":fmt(averageGap,1),contested?"puntos de percentil por indicador":"sin indicadores comparables"],
   ].map(([label,value,hint])=><div key={label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
    <p className="text-[10px] font-bold uppercase text-slate-500">{label}</p>
    <p className="text-lg font-black tabular-nums text-[#003399]">{value}</p>
    <p className="truncate text-[10px] text-slate-500" title={hint}>{hint}</p>
   </div>)}
  </div>
 </section>;
}