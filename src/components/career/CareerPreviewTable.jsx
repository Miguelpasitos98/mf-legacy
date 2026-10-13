import React from "react";
import { AlertCircle, CheckCircle2, Link2 } from "lucide-react";
import EntityPicker from "./EntityPicker";
import { MOVEMENT_LABELS, REVIEW_STATUS_LABELS } from "@/utils/careerImport";

const normalizeImageUrl = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (/^(https?:|data:|blob:)/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

const StageStatus = ({ row }) => {
  if (row.errors.length) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
        <AlertCircle size={11} /> Inválido
      </span>
    );
  }
  if (row.exists) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
        Existente
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
      <CheckCircle2 size={11} /> Nueva
    </span>
  );
};

// Tabla de previsualización de etapas a importar.
// rows: [{ record, player, playerStatus, team, teamStatus, suggestion, exists, selected, provisionalIdentity, reviewStatus, errors }]
export default function CareerPreviewTable({
  rows,
  onToggleRow,
  onPlayerOverride,
  onTeamOverride,
  players,
  teams,
  disabled,
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="w-full min-w-[920px] border-collapse text-left text-xs">
        <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="w-8 px-3 py-3"></th>
            <th className="px-3 py-3">Jugador</th>
            <th className="px-3 py-3">Club</th>
            <th className="px-3 py-3">Inicio</th>
            <th className="px-3 py-3">Fin</th>
            <th className="px-3 py-3">Movimiento</th>
            <th className="px-3 py-3">Estado</th>
            <th className="px-3 py-3">Origen</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, index) => {
            const key = row.record.external_stage_id || index;
            const playerMissing = !row.player;
            return (
              <tr
                key={key}
                className={`align-top transition ${
                  row.selected ? "bg-[#003399]/[0.02]" : ""
                } ${row.errors.length ? "opacity-70" : ""}`}
              >
                <td className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={row.selected}
                    disabled={disabled || row.errors.length > 0 || playerMissing}
                    onChange={() => onToggleRow(row.record.external_stage_id)}
                    className="h-4 w-4 rounded border-slate-300 text-[#003399] focus:ring-[#003399]/30"
                    aria-label="Seleccionar etapa"
                  />
                </td>

                <td className="px-3 py-3">
                  {row.player ? (
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900">
                        {row.player.name}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {row.playerMethod === "fm26_uid"
                          ? `FM26 ${row.player.fm26_uid}`
                          : "ID confirmado"}
                      </span>
                    </div>
                  ) : (
                    <div className="w-44">
                      <EntityPicker
                        value={row.playerOverride || ""}
                        onChange={(value) =>
                          onPlayerOverride(row.record.external_stage_id, value)
                        }
                        options={players}
                        placeholder="Vincular jugador..."
                        getLabel={(item) => item.name}
                        getImage={(item) => normalizeImageUrl(item?.logo)}
                        disabled={disabled}
                      />
                    </div>
                  )}
                  {row.provisionalIdentity && (
                    <span className="mt-1 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                      Identidad provisional
                    </span>
                  )}
                </td>

                <td className="px-3 py-3">
                  {row.team ? (
                    <div className="flex items-center gap-2">
                      {normalizeImageUrl(row.team.logo) && (
                        <img
                          src={normalizeImageUrl(row.team.logo)}
                          alt=""
                          className="h-4 w-4 object-contain"
                        />
                      )}
                      <span className="font-semibold text-slate-800">
                        {row.team.name}
                      </span>
                    </div>
                  ) : (
                    <div className="w-44">
                      <EntityPicker
                        value={row.teamOverride || ""}
                        onChange={(value) =>
                          onTeamOverride(row.record.external_stage_id, value)
                        }
                        options={teams}
                        placeholder="Vincular club..."
                        getLabel={(item) => item.name}
                        getImage={(item) => normalizeImageUrl(item?.logo)}
                        disabled={disabled}
                      />
                      {row.suggestion?.team && !row.teamOverride && (
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() =>
                            onTeamOverride(
                              row.record.external_stage_id,
                              row.suggestion.team.id
                            )
                          }
                          className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-[#003399] hover:underline"
                        >
                          <Link2 size={10} /> Sugerir: {row.suggestion.team.name}
                          {row.suggestion.ambiguous ? " (ambiguo)" : ""}
                        </button>
                      )}
                    </div>
                  )}
                  {!row.team && !row.suggestion?.team && (
                    <p className="text-[10px] text-slate-400">
                      {row.record.club_name || "Club sin nombre"} · pendiente
                    </p>
                  )}
                </td>

                <td className="px-3 py-3 text-slate-600">
                  {row.record.start_date || row.record.start_year || "—"}
                  {row.record.start_precision &&
                    row.record.start_precision !== "dia" && (
                      <span className="block text-[9px] text-slate-400">
                        {row.record.start_precision}
                      </span>
                    )}
                </td>
                <td className="px-3 py-3 text-slate-600">
                  {row.record.end_date || row.record.end_year || "—"}
                  {row.record.end_precision &&
                    row.record.end_precision !== "dia" && (
                      <span className="block text-[9px] text-slate-400">
                        {row.record.end_precision}
                      </span>
                    )}
                </td>
                <td className="px-3 py-3 text-slate-600">
                  {MOVEMENT_LABELS[row.record.movement_type] || "—"}
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-col gap-1">
                    <StageStatus row={row} />
                    <span className="text-[10px] text-slate-400">
                      {REVIEW_STATUS_LABELS[row.reviewStatus] || row.reviewStatus}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-3 text-slate-500">
                  {row.record.source || "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}