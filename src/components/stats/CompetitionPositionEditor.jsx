import React from "react";
import { POSITION_OPTIONS, competitionPosition, withCompetitionPosition } from "@/utils/historicalPositions";

// Correcciones de posición por competición dentro de una misma temporada.
// Cada cambio se persiste de inmediato; solo afecta a esa competición.
export default function CompetitionPositionEditor({ competitions = [], valuation, busy = false, onSave }) {
  if (!competitions.length) {
    return <p className="text-xs text-slate-500">No hay competiciones de club registradas para esta temporada.</p>;
  }
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
    </div>
  );
}