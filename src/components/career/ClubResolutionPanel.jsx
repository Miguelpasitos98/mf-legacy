import React from "react";
import {
  Link2,
  PlusCircle,
  Upload,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { CLUB_STATUS_LABELS } from "@/utils/clubResolution";

// Panel de resolución masiva de clubes detectados en el lote.
// Muestra la simulación (recuentos por estado), los grupos clasificados
// y los botones de acción masiva con confirmación previa.
export default function ClubResolutionPanel({
  clubStats,
  clubGroups,
  resolvedTeamByKey,
  pendingAction,
  busy,
  onAutoLinkSafe,
  onCreateMissing,
  onSelectAllValid,
  onImportAllValid,
  onConfirmAction,
  onCancelAction,
  validStageCount,
}) {
  const matchedCount = clubStats.matched || 0;
  const creatableCount = clubStats.creatable || 0;

  const statCards = [
    ["linked", clubStats.linked || 0, "bg-emerald-50 text-emerald-700"],
    ["matched", matchedCount, "bg-blue-50 text-blue-700"],
    ["creatable", creatableCount, "bg-violet-50 text-violet-700"],
    ["ambiguous", clubStats.ambiguous || 0, "bg-amber-50 text-amber-700"],
    ["unidentified", clubStats.unidentified || 0, "bg-slate-100 text-slate-600"],
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center gap-2">
        <ShieldCheck size={16} className="text-[#003399]" />
        <h3 className="text-sm font-extrabold text-slate-900">Clubes detectados</h3>
        <span className="text-xs text-slate-400">
          Simulación previa · no se crea ni modifica nada hasta confirmar
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {statCards.map(([key, value, color]) => (
          <div key={key} className={`rounded-xl px-3 py-2.5 ${color}`}>
            <p className="text-[10px] font-bold uppercase tracking-wide opacity-80">
              {CLUB_STATUS_LABELS[key]}
            </p>
            <p className="mt-0.5 text-xl font-extrabold">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || matchedCount === 0}
          onClick={onAutoLinkSafe}
          className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800 hover:bg-blue-100 disabled:opacity-40"
        >
          <Link2 size={14} /> Vincular automáticamente clubes seguros ({matchedCount})
        </button>
        <button
          type="button"
          disabled={busy || creatableCount === 0}
          onClick={onCreateMissing}
          className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-800 hover:bg-violet-100 disabled:opacity-40"
        >
          <PlusCircle size={14} /> Crear clubes faltantes ({creatableCount})
        </button>
        <button
          type="button"
          disabled={busy || validStageCount === 0}
          onClick={onSelectAllValid}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          Seleccionar todas las válidas ({validStageCount})
        </button>
        <button
          type="button"
          disabled={busy || validStageCount === 0}
          onClick={onImportAllValid}
          className="inline-flex items-center gap-2 rounded-xl bg-[#003399] px-3 py-2 text-xs font-bold text-white hover:bg-[#002477] disabled:opacity-40"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          Importar todas las etapas válidas
        </button>
      </div>

      {pendingAction && (
        <div className="mt-4 rounded-xl border border-slate-300 bg-slate-50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-slate-600" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-extrabold text-slate-900">
                {pendingAction.type === "auto-link"
                  ? "Confirmar vinculación automática"
                  : pendingAction.type === "create-clubs"
                    ? "Confirmar creación de clubes"
                    : "Confirmar importación masiva"}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-600">
                {pendingAction.summary}
              </p>

              {pendingAction.groups?.length > 0 && (
                <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2">
                  <ul className="space-y-1">
                    {pendingAction.groups.slice(0, 50).map((g) => (
                      <li key={g.key} className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="truncate font-semibold text-slate-700">{g.club_name}</span>
                        <span className="shrink-0 text-slate-400">
                          {g.club_qid ? `QID ${g.club_qid}` : "sin QID"} · {g.stageIds.length} etapas
                        </span>
                      </li>
                    ))}
                    {pendingAction.groups.length > 50 && (
                      <li className="text-[11px] text-slate-400">
                        …y {pendingAction.groups.length - 50} más
                      </li>
                    )}
                  </ul>
                </div>
              )}

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={onConfirmAction}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#003399] px-3 py-2 text-xs font-bold text-white hover:bg-[#002477] disabled:opacity-40"
                >
                  {busy ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                  Confirmar
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={onCancelAction}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <details className="mt-4 group">
        <summary className="cursor-pointer text-xs font-bold text-slate-500 hover:text-slate-700">
          Ver detalle de clubes detectados ({clubGroups.length})
        </summary>
        <div className="mt-2 max-h-72 space-y-1.5 overflow-y-auto">
          {clubGroups.map((g) => {
            const res = resolvedTeamByKey[g.key] || {};
            const color =
              res.status === "linked"
                ? "bg-emerald-50 text-emerald-700"
                : res.status === "matched" || res.status === "resolved"
                  ? "bg-blue-50 text-blue-700"
                  : res.status === "creatable"
                    ? "bg-violet-50 text-violet-700"
                    : res.status === "ambiguous"
                      ? "bg-amber-50 text-amber-700"
                      : "bg-slate-100 text-slate-600";
            return (
              <div
                key={g.key}
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-1.5 text-[11px]"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-800">
                    {g.club_name || "Sin nombre"}
                  </p>
                  <p className="text-slate-400">
                    {g.club_qid ? `QID ${g.club_qid}` : "sin QID"} · {g.stageIds.length} etapas
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 font-bold ${color}`}>
                  {CLUB_STATUS_LABELS[res.status] || res.status}
                  {res.team ? ` · ${res.team.name}` : ""}
                </span>
              </div>
            );
          })}
        </div>
      </details>
    </div>
  );
}