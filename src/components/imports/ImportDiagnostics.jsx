import React,{useMemo} from "react";
import {useHistoricalPeerDataset} from "@/hooks/useHistoricalPeerDataset";
import {playerImportDiagnostics} from "@/utils/importDiagnostics";
export default function ImportDiagnostics({playerId,candidates,jobs}){
  const dataset=useHistoricalPeerDataset(Boolean(playerId));
  const report=useMemo(()=>playerImportDiagnostics(dataset.data,playerId,candidates,jobs),[dataset.data,playerId,candidates,jobs]);
  if(!playerId)return null;
  return <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
    <h3 className="font-semibold">Cobertura guardada y Composite</h3>
    {dataset.isLoading?<p role="status">Comprobando STATS y población de comparación…</p>:dataset.error?<p role="alert">No se pudo comprobar la cobertura: {dataset.error.message}</p>:<>
      <p className="text-xs text-slate-600">Trabajo seleccionado: {report.received} candidatos recibidos · {report.applied} conciliados · {report.pending} pendientes. Los candidatos repetidos no cuentan como estadísticas nuevas.</p>
      <div className="overflow-x-auto"><table className="w-full text-xs text-left"><thead><tr><th>Temporada</th><th>Competiciones</th><th>Valores en STATS</th><th>Indicadores disponibles</th><th>Usados por Composite</th></tr></thead><tbody>
        {report.seasons.map(s=><tr key={s.season} className="border-t"><td className="py-2">{s.season}</td><td>{s.competitions}</td><td>{s.saved_values}</td><td>{s.available}/{s.indicators.length} · {s.role||"Sin arquetipo"}</td><td>{s.used}</td></tr>)}
      </tbody></table></div>
      <p className="text-[11px] text-slate-500">Un indicador disponible puede necesitar más jugadores comparables para generar su percentil. Los datos de selecciones permanecen en STATS; Composite compara competiciones de clubes.</p>
      {report.seasons.map(s=><details key={s.season} className="text-xs"><summary className="cursor-pointer font-medium">{s.season}: fuentes, valores e indicadores ausentes</summary>
        <p className="my-2">Ausentes: {s.missing.join(", ")||"Ninguno"}</p>
        <ul className="max-h-64 overflow-auto space-y-1">{s.metrics.map((m,i)=><li key={i}>{m.name}: {m.total??"—"} {m.unit} · /90 {m.per90??"—"} · {m.source} · {m.competition} · {m.team} · minutos de fuente {m.minutes??"no documentados"}</li>)}</ul>
      </details>)}
    </>}
  </section>;
}
