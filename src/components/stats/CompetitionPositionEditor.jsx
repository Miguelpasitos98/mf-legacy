import React from "react";
import {
  POSITION_OPTIONS,
  competitionPosition,
  positionTone,
  withCompetitionPosition,
} from "@/utils/historicalPositions";

// Correcciones de posición por competición dentro de una misma temporada.
// Cada cambio se persiste de inmediato; solo afecta a esa competición.
export default function CompetitionPositionEditor({ competitions = [], valuation, busy = false, onSave }) {
  if (!competitions.length) {
    return <p className="text-xs text-slate-500">No hay competiciones de club registradas para esta temporada.</p>;
  }
  const overrides = competitions.map((name) => competitionPosition(valuation, name)).filter(Boolean);
  const mixed = [...new Set(overrides)].length > 1;
  return (
    <div className="space-y-2">
      <p className="text-[11px] leading-relaxed text-slate-500">
        Prioridad máxima: si el jugador desempeñó otro rol en una competición concreta, indícalo aquí. La posición de
        la temporada se mantiene como referencia común.
      </p>
      {competitions.map((name) => {
        const current = competitionPosition(valuation, name);
        return (
          <div key={name} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-700" title={name}>{name}</span>
            {current ? (
              <span
                className={
                  "inline-flex h-6 min-w-[2.25rem] items-center justify-center rounded px-1.5 text-[11px] font-black ring-1 ring-inset " +
                  positionTone(current)
                }
                title={"Posición corregida en " + name}
              >
                {current}
              </span>
            ) : (
              <span className="inline-flex h-6 items-center rounded bg-slate-100 px-1.5 text-[10px] font-bold text-slate-400">
                hereda
              </span>
            )}
            <select
              value={current}
              disabled={busy}
              onChange={(event) => onSave(withCompetitionPosition(valuation, name, event.target.value))}
              aria-label={"Posición histórica en " + name}
              className="w-36 rounded border border-slate-200 px-2 py-1 text-xs disabled:bg-slate-50"
            >
              <option value="">Sin corrección</option>
              {POSITION_OPTIONS.map((code) => <option key={code} value={code}>{code}</option>)}
            </select>
          </div>
        );
      })}
      {mixed && (
        <p className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-[11px] text-violet-900">
          Esta temporada tiene posiciones distintas según la competición: el Composite usará la posición de referencia
          de la temporada y avisará de la discrepancia.
        </p>
      )}
    </div>
  );
}