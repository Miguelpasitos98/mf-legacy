import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import CareerTimeline from "./CareerTimeline";

// Modal con el historial de clubes de un jugador, leído de la entidad PlayerCareer.
export default function PlayerCareerHistoryModal({
  open,
  onClose,
  player,
  teams,
  onOpenTeam,
}) {
  const [state, setState] = useState({ status: "idle", stages: [], message: "" });

  const teamById = useMemo(
    () => new Map((teams || []).map((t) => [String(t.id), t])),
    [teams]
  );

  const playerId = String(player?.id || "");

  useEffect(() => {
    if (!open || !playerId) return undefined;
    const controller = new AbortController();
    setState({ status: "loading", stages: [], message: "" });

    (async () => {
      try {
        const result = await base44.entities.PlayerCareer.filter(
          { player_id: playerId },
          { sort: "-start_year", limit: 200 }
        );
        if (controller.signal.aborted) return;
        const items = Array.isArray(result)
          ? result
          : result?.items || result?.data || [];
        const approved = items.filter(
          (stage) => !stage.review_status || stage.review_status === "approved"
        );
        setState({
          status: "ready",
          stages: approved,
          message: approved.length ? "" : "Todavía no hay historial importado.",
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          stages: [],
          message: `No se ha podido cargar el historial: ${
            error?.message || "error"
          }`,
        });
      }
    })();

    return () => controller.abort();
  }, [open, playerId]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9997] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[88vh] w-full max-w-[680px] flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.17em] text-[#003399]">
              MF LEGACY · Historial de clubes
            </p>
            <h2 className="mt-1 truncate text-xl font-extrabold text-slate-900">
              {player?.name || "Jugador"}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Cerrar historial"
            onClick={onClose}
            className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          {state.status === "loading" && (
            <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
              <Loader2 size={16} className="animate-spin text-[#003399]" />
              Cargando historial...
            </div>
          )}
          {state.status === "error" && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {state.message}
            </div>
          )}
          {state.status === "ready" && (
            <CareerTimeline
              stages={state.stages}
              teamById={teamById}
              onOpenTeam={onOpenTeam}
              loading={false}
            />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}