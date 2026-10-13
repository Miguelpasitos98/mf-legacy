import React from "react";
import { Building2, ExternalLink } from "lucide-react";
import { MOVEMENT_LABELS } from "@/utils/careerImport";

const normalizeImageUrl = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (/^(https?:|data:|blob:)/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

const formatDate = (record) => {
  const parts = [];
  if (record.start_date || record.start_year) {
    parts.push(record.start_date || String(record.start_year || "—"));
  } else {
    parts.push("Inicio desconocido");
  }
  if (record.end_date || record.end_year) {
    parts.push(record.end_date || String(record.end_year));
  } else {
    parts.push("Actualidad");
  }
  return parts.join(" → ");
};

// Cronología visual de etapas de un jugador.
// Props: stages (PlayerCareer[]), teamById (Map id->team), onOpenTeam(id), loading.
export default function CareerTimeline({ stages, teamById, onOpenTeam, loading }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-xl border border-slate-200 bg-slate-100"
          />
        ))}
      </div>
    );
  }

  if (!stages || !stages.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-8 text-center">
        <Building2 size={28} className="mx-auto mb-2 text-slate-300" />
        <p className="text-sm font-semibold text-slate-600">
          Este jugador todavía no tiene historial de clubes
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Importa un lote desde la administración para ver su trayectoria aquí.
        </p>
      </div>
    );
  }

  // Ordenar temporalmente: por start_year/start_date descendente.
  const sorted = [...stages].sort((a, b) => {
    const key = (s) => s.start_year || s.start_date || "";
    return String(key(b)).localeCompare(String(key(a)));
  });

  return (
    <ol className="relative space-y-4 border-l-2 border-slate-200 pl-5">
      {sorted.map((stage, index) => {
        const team = stage.team_id ? teamById.get(String(stage.team_id)) : null;
        const logo = normalizeImageUrl(team?.logo);
        const isLoan = stage.movement_type === "cesion" || stage.loan === true;
        const clubLabel = team?.name || stage.club_name || "Club sin identificar";
        const canOpen = Boolean(team?.id);

        return (
          <li key={stage.id || stage.external_stage_id || index} className="relative">
            <span
              className={`absolute -left-[27px] top-3 h-3.5 w-3.5 rounded-full border-2 border-white ${
                isLoan ? "bg-amber-500" : "bg-[#003399]"
              }`}
            />

            <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300 sm:p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50">
                  {logo ? (
                    <img
                      src={logo}
                      alt=""
                      className="h-8 w-8 object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <Building2 size={18} className="text-slate-400" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  {canOpen ? (
                    <button
                      type="button"
                      onClick={() => onOpenTeam?.(team.id)}
                      className="block truncate text-left text-sm font-extrabold text-slate-900 hover:text-[#003399]"
                      title={`Abrir ficha de ${clubLabel}`}
                    >
                      {clubLabel}
                    </button>
                  ) : (
                    <p className="truncate text-sm font-extrabold text-slate-700">
                      {clubLabel}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-slate-500">
                    {formatDate(stage)}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1">
                  {isLoan && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                      Cesión
                    </span>
                  )}
                  {stage.is_reserve && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                      Filial
                    </span>
                  )}
                  {stage.movement_type && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      {MOVEMENT_LABELS[stage.movement_type] || stage.movement_type}
                    </span>
                  )}
                </div>
              </div>

              {stage.source_url && (
                <a
                  href={stage.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-[11px] text-[#003399] hover:underline"
                >
                  <ExternalLink size={11} />
                  Fuente
                </a>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}