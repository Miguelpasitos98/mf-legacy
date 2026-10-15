import React from "react";
import { RotateCcw } from "lucide-react";
import {
  MF_LEGACY_POSITIONS,
  FIFA_EQUIVALENT_POSITIONS,
  POSITION_OPTIONS,
  POSITION_SOURCES,
  normalizeHistoricalPosition,
  resolveHistoricalPosition,
} from "@/utils/historicalPositions";

const SOURCE_CLASS = {
  competition: "bg-violet-100 text-violet-800",
  season: "bg-blue-100 text-blue-800",
  fifa: "bg-emerald-100 text-emerald-800",
  fallback: "bg-amber-100 text-amber-900",
  none: "bg-slate-100 text-slate-500",
};

// Selector editable de la posición histórica efectiva de una temporada.
// Vacío = automática (posición FIFA). Guarda en la entidad, no solo en pantalla.
export default function HistoricalPositionEditor({ valuation, fallback = "", busy = false, onSave }) {
  const effective = resolveHistoricalPosition({ valuation, fallback });
  const override = normalizeHistoricalPosition(valuation?.historical_position_override);
  const source = POSITION_SOURCES[effective.source] || POSITION_SOURCES.none;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <strong className="text-sm font-black text-[#0f3156]">{effective.position || "—"}</strong>
        <span className={"rounded-full px-2 py-0.5 text-[9px] font-bold uppercase " + (SOURCE_CLASS[effective.source] || SOURCE_CLASS.none)}
          title={source.label}>
          {source.short}
        </span>
      </div>
      <select
        value={override}
        disabled={busy}
        onChange={(event) => onSave(event.target.value)}
        aria-label={"Posición histórica efectiva de " + (valuation?.season || "")}
        title={source.label}
        className="w-36 rounded border border-slate-200 px-2 py-1 text-xs disabled:bg-slate-50"
      >
        <option value="">Automática (FIFA/FC)</option>
        {override && !POSITION_OPTIONS.includes(override) && <option value={override}>{override}</option>}
        <optgroup label="Catálogo MF LEGACY">
          {MF_LEGACY_POSITIONS.map((code) => <option key={code} value={code}>{code}</option>)}
        </optgroup>
        <optgroup label="Equivalencias FIFA/FC">
          {FIFA_EQUIVALENT_POSITIONS.map((code) => <option key={code} value={code}>{code}</option>)}
        </optgroup>
      </select>
      {override && (
        <button type="button" disabled={busy} onClick={() => onSave("")}
          className="inline-flex items-center gap-1 self-start text-[10px] font-bold text-slate-500 hover:text-[#003399] disabled:opacity-40">
          <RotateCcw size={10} /> Restaurar FIFA original
        </button>
      )}
    </div>
  );
}