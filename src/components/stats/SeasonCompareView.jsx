import React,{useMemo} from "react";
import {createPortal} from "react-dom";
import {X} from "lucide-react";
import ComparePlayerCard from "@/components/stats/ComparePlayerCard";
import CompareAnalysisVerdict from "@/components/stats/CompareAnalysisVerdict";
import CompareAnalysisTable from "@/components/stats/CompareAnalysisTable";
import CompareMetricsTable from "@/components/stats/CompareMetricsTable";
import {compositeSeasonKey} from "@/utils/statsCompositeRanking";
import {buildCompareAnalysis} from "@/utils/compareAnalysis";

// Vista detallada de las temporadas seleccionadas en STATS. Solo lectura:
// reutiliza los resúmenes, el Composite y las fórmulas ya calculados.
export default function SeasonCompareView({entries=[],compositeBySeason=new Map(),config,observations=[],peerLoading=false,peerError=null,onClose,onOpenDetail,onTeam}){
 const players=new Set(entries.map(({summary})=>String(summary.player_id||summary.fotmob_player_id||summary.id||""))).size;
 // Un único cálculo del análisis alimenta el veredicto y la tabla.
 const model=useMemo(()=>buildCompareAnalysis(entries,observations),[entries,observations]);
 return createPortal(
  <div className="mf-modal-overlay fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Comparativa detallada de jugadores seleccionados">
   <div className="mf-modal-panel flex max-h-[95dvh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
    <header className="shrink-0 bg-[#0e2844] px-4 py-4 text-white sm:px-6">
     <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
       <p className="text-[10px] font-bold uppercase tracking-[.15em] text-blue-200">MF LEGACY · COMPARATIVA</p>
       <h2 className="mt-0.5 text-lg font-black sm:text-xl">Vista detallada de los jugadores seleccionados</h2>
       <p className="mt-1 text-[11px] text-blue-200/85">{entries.length} temporada{entries.length===1?"":"s"} · {players} jugador{players===1?"":"es"} · mismos cálculos, fórmulas y coberturas que en STATS</p>
      </div>
      <button type="button" onClick={onClose} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-blue-100 hover:bg-white/10" aria-label="Cerrar comparativa"><X size={20}/></button>
     </div>
    </header>
    <div className="flex-1 overflow-y-auto p-4 sm:p-5">
     <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {entries.map(({summary,player})=><ComparePlayerCard key={summary.id} summary={summary} player={player} composite={compositeBySeason.get(compositeSeasonKey(summary.player_id,summary.season))||null} onOpen={onOpenDetail} onTeam={onTeam}/>)}
     </div>
     <CompareAnalysisVerdict model={model}/>
     <CompareAnalysisTable model={model} observations={observations} peerLoading={peerLoading} peerError={peerError}/>
     <h3 className="mb-2 mt-5 text-sm font-black uppercase tracking-wide text-[#0d315b]">Estadísticas de origen comparadas</h3>
     {entries.length>8&&<p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">Comparación amplia: usa el desplazamiento horizontal de la tabla para ver todas las columnas.</p>}
     <CompareMetricsTable entries={entries} config={config}/>
     <p className="mt-3 text-[11px] text-slate-500">Cada indicador utiliza solo las competiciones que disponen de esa estadística y de sus minutos. Un guion significa que no hay dato y nunca se interpreta como cero. La marca ▲ señala el mejor valor de cada fila; en goles encajados el mejor es el más bajo.</p>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3">
     <span className="text-xs text-slate-500">Fuente: archivos FotMob Studio · registros sujetos a revisión.</span>
     <button type="button" onClick={onClose} className="rounded-lg bg-[#003399] px-5 py-2 text-xs font-bold text-white">Cerrar</button>
    </div>
   </div>
  </div>,document.body);
}