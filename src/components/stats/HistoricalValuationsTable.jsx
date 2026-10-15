import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Loader2, Pencil, Trash2, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { formatEur } from "@/utils/historicalValuation";
import {patchHistoricalPeerCache,HISTORICAL_PEER_KEY} from "@/utils/historicalPeerCache";
import { POSITION_OPTIONS, normalizeHistoricalPosition, positionTone } from "@/utils/historicalPositions";
import { nationalCompetition } from "@/utils/statsViews";
import HistoricalPositionEditor from "./HistoricalPositionEditor";
import CompetitionPositionEditor from "./CompetitionPositionEditor";

const VERIFICATION_LABELS = {
  pending: { text: "Pendiente", cls: "bg-amber-50 text-amber-700" },
  verified: { text: "Verificado", cls: "bg-emerald-50 text-emerald-700" },
  review: { text: "Revision", cls: "bg-blue-50 text-blue-700" },
};

const emptyForm = {
  fifa_fc_position: "",
  fifa_fc_overall: "",
  transfermarkt_value_eur: "",
  fifa_edition: "",
  market_value_as_of: "",
  fifa_source_url: "",
  transfermarkt_source_url: "",
  market_value_status: "",
  verification_status: "pending",
  notes: "",
};

// Tabla compacta de valoraciones historicas del jugador.
export default function HistoricalValuationsTable({
  valuations,
  loading,
  onRefresh,
  stats = [],
  fallbackPosition = "",
}) {
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const queryClient = useQueryClient();

  // Competiciones de club de la temporada abierta en el modal.
  const seasonCompetitions = useMemo(() => {
    if (!editing?.season) return [];
    return [...new Set(stats
      .filter((r) => r.season === editing.season && r.competition && !nationalCompetition(r.competition))
      .map((r) => String(r.competition)))].sort();
  }, [stats, editing?.season]);

  // La posición efectiva decide el arquetipo del Composite: se persiste y se
  // recalcula la comparación histórica de inmediato.
  const savePositions = async (record, patch) => {
    if (!record?.id) return;
    setSavingId(record.id);
    setError("");
    try {
      await base44.entities.PlayerHistoricalValuation.update(record.id, patch);
      if(!patchHistoricalPeerCache(queryClient,"PlayerHistoricalValuation",record.id,patch))
        queryClient.invalidateQueries({queryKey:HISTORICAL_PEER_KEY});
      setEditing((prev) => (prev && prev.id === record.id ? { ...prev, ...patch } : prev));
      onRefresh?.();
    } catch (e) {
      setError(e?.message || "No se pudo guardar la posición histórica.");
    } finally {
      setSavingId("");
    }
  };

  const openEdit = (record) => {
    setEditing(record);
    setForm({
      ...emptyForm,
      ...Object.fromEntries(
        Object.entries(record || {}).map(([k, v]) => [
          k,
          v === null || v === undefined ? "" : String(v),
        ])
      ),
    });
    setError("");
  };

  const closeEdit = () => {
    setEditing(null);
    setForm(emptyForm);
    setError("");
  };

  const saveEdit = async () => {
    if (!editing?.id) return;
    setBusy(true);
    setError("");
    try {
      const patch = {};
      patch.fifa_fc_position = normalizeHistoricalPosition(form.fifa_fc_position);
      if (form.fifa_fc_overall !== "")
        patch.fifa_fc_overall = parseInt(form.fifa_fc_overall, 10);
      if (form.transfermarkt_value_eur !== "")
        patch.transfermarkt_value_eur = parseInt(form.transfermarkt_value_eur, 10);
      if (form.fifa_edition) patch.fifa_edition = form.fifa_edition;
      if (form.market_value_as_of) patch.market_value_as_of = form.market_value_as_of;
      if (form.fifa_source_url) patch.fifa_source_url = form.fifa_source_url;
      if (form.transfermarkt_source_url)
        patch.transfermarkt_source_url = form.transfermarkt_source_url;
      if (form.market_value_status) patch.market_value_status = form.market_value_status;
      if (form.verification_status) patch.verification_status = form.verification_status;
      if (form.notes) patch.notes = form.notes;
      await base44.entities.PlayerHistoricalValuation.update(editing.id, patch);
      if(!patchHistoricalPeerCache(queryClient,"PlayerHistoricalValuation",editing.id,patch))
        queryClient.invalidateQueries({queryKey:HISTORICAL_PEER_KEY});
      closeEdit();
      onRefresh?.();
    } catch (e) {
      setError(e?.message || "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  };

  const deleteRecord = async () => {
    if (!editing?.id) return;
    if (!window.confirm(`¿Eliminar la valoracion de ${editing.season}?`)) return;
    setBusy(true);
    setError("");
    try {
      await base44.entities.PlayerHistoricalValuation.delete(editing.id);
      closeEdit();
      onRefresh?.();
    } catch (e) {
      setError(e?.message || "No se pudo eliminar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xs font-black uppercase tracking-widest text-[#003399]">
            Valoraciones historicas
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Una fila por temporada: Overall FIFA/FC, valor de Transfermarkt y la posicion historica que decide el arquetipo del Composite.
          </p>
        </div>
        {loading && <Loader2 size={14} className="animate-spin text-slate-400" />}
      </div>

      {valuations.length > 0 && (
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Temporadas", valuations.length, ""],
            ["Con posicion FIFA", valuations.filter((v) => normalizeHistoricalPosition(v.fifa_fc_position)).length, "text-emerald-700"],
            ["Verificadas", valuations.filter((v) => v.verification_status === "verified").length, "text-emerald-700"],
            ["Ultima edicion", valuations[0]?.fifa_edition || "—", "text-slate-700"],
          ].map(([label, value, tone]) => (
            <div key={label} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              <p className="text-[10px] font-bold uppercase text-slate-500">{label}</p>
              <p className={"mt-0.5 text-lg font-black tabular-nums " + (tone || "text-[#003399]")}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {valuations.length === 0 ? (
        <p className="py-4 text-center text-xs text-slate-400">
          No hay valoraciones historicas importadas para este jugador.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-xs">
            <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Temporada</th>
                <th className="px-3 py-2">Edicion FIFA/FC</th>
                <th className="px-3 py-2">Overall</th>
                <th className="px-3 py-2">Transfermarkt</th>
                <th className="px-3 py-2">Posicion FIFA</th>
                <th className="px-3 py-2">Posicion efectiva</th>
                <th className="px-3 py-2">Fecha valor</th>
                <th className="px-3 py-2">Verificacion</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {valuations.map((v) => (
                <tr key={v.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-bold text-slate-800">{v.season}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {v.fifa_edition || "—"}
                  </td>
                  <td className="px-3 py-2 font-bold text-[#003399]">
                    {v.fifa_fc_overall ?? "—"}
                  </td>
                  <td className="px-3 py-2 font-semibold text-slate-700">
                    {formatEur(v.transfermarkt_value_eur)}
                  </td>
                  <td className="px-3 py-2">
                    {normalizeHistoricalPosition(v.fifa_fc_position) ? (
                      <span className={"inline-flex h-6 min-w-[2.25rem] items-center justify-center rounded px-1.5 text-[11px] font-black ring-1 ring-inset " + positionTone(v.fifa_fc_position)}
                        title={"Posicion de la carta FIFA/FC de " + v.season}>
                        {normalizeHistoricalPosition(v.fifa_fc_position)}
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-slate-400">sin dato</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <HistoricalPositionEditor
                      valuation={v}
                      fallback={fallbackPosition}
                      busy={savingId === v.id}
                      onSave={(position) =>
                        savePositions(v, { historical_position_override: normalizeHistoricalPosition(position) })
                      }
                    />
                  </td>
                  <td className="px-3 py-2 text-slate-500">
                    {v.market_value_as_of || "—"}
                    {v.market_value_status === "provisional" && (
                      <span className="ml-1 rounded bg-amber-100 px-1 text-[9px] font-bold text-amber-800">
                        Prov.
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        "inline-block rounded-full px-2 py-0.5 text-[10px] font-bold " +
                        (VERIFICATION_LABELS[v.verification_status]?.cls || "")
                      }
                    >
                      {VERIFICATION_LABELS[v.verification_status]?.text || v.verification_status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => openEdit(v)}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-100"
                      aria-label={"Editar valoracion de " + v.season}
                    >
                      <Pencil size={11} /> Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de edicion */}
      {editing &&
        createPortal(
          <div
            className="fixed inset-0 z-[9998] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
          >
            <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
                <div>
                  <h3 className="text-sm font-black text-[#0d243b]">
                    Editar valoracion
                  </h3>
                  <p className="text-xs text-slate-500">{editing.season}</p>
                </div>
                <button onClick={closeEdit} disabled={busy} aria-label="Cerrar">
                  <X size={18} />
                </button>
              </div>
              <div className="max-h-[60vh] space-y-3 overflow-y-auto p-5">
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-xs font-bold text-slate-600">
                    Overall (1-99)
                    <input
                      type="number"
                      min="1"
                      max="99"
                      value={form.fifa_fc_overall}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, fifa_fc_overall: e.target.value }))
                      }
                      disabled={busy}
                      className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block text-xs font-bold text-slate-600">
                    Transfermarkt (EUR)
                    <input
                      type="number"
                      min="0"
                      value={form.transfermarkt_value_eur}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          transfermarkt_value_eur: e.target.value,
                        }))
                      }
                      disabled={busy}
                      className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </label>
                </div>
                <label className="block text-xs font-bold text-slate-600">
                  Edicion FIFA/FC
                  <input
                    type="text"
                    value={form.fifa_edition}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, fifa_edition: e.target.value }))
                    }
                    disabled={busy}
                    className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-xs font-bold text-slate-600">
                  Posicion FIFA/FC original
                  <select
                    value={normalizeHistoricalPosition(form.fifa_fc_position)}
                    onChange={(e) => setForm((f) => ({ ...f, fifa_fc_position: e.target.value }))}
                    disabled={busy}
                    className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="">Sin dato verificado</option>
                    {normalizeHistoricalPosition(form.fifa_fc_position) &&
                      !POSITION_OPTIONS.includes(normalizeHistoricalPosition(form.fifa_fc_position)) &&
                      <option value={normalizeHistoricalPosition(form.fifa_fc_position)}>{normalizeHistoricalPosition(form.fifa_fc_position)}</option>}
                    {POSITION_OPTIONS.map((code) => <option key={code} value={code}>{code}</option>)}
                  </select>
                  <span className="mt-1 block text-[11px] font-normal text-slate-500">
                    Solo la posicion de la carta. Vacio significa que no puede verificarse: nunca se inventa.
                  </span>
                </label>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="mb-2 text-xs font-bold text-slate-600">Posicion por competicion</p>
                  <CompetitionPositionEditor
                    competitions={seasonCompetitions}
                    valuation={editing}
                    busy={busy || savingId === editing?.id}
                    onSave={(list) => savePositions(editing, { competition_positions: list })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-xs font-bold text-slate-600">
                    Fecha del valor
                    <input
                      type="date"
                      value={form.market_value_as_of}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, market_value_as_of: e.target.value }))
                      }
                      disabled={busy}
                      className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block text-xs font-bold text-slate-600">
                    Estado del valor
                    <select
                      value={form.market_value_status}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, market_value_status: e.target.value }))
                      }
                      disabled={busy}
                      className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      <option value="">Sin especificar</option>
                      <option value="definitivo">Definitivo</option>
                      <option value="provisional">Provisional</option>
                    </select>
                  </label>
                </div>
                <label className="block text-xs font-bold text-slate-600">
                  Verificacion
                  <select
                    value={form.verification_status}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, verification_status: e.target.value }))
                    }
                    disabled={busy}
                    className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="pending">Pendiente</option>
                    <option value="verified">Verificado</option>
                    <option value="review">Revision</option>
                  </select>
                </label>
                <label className="block text-xs font-bold text-slate-600">
                  URL fuente FIFA/FC
                  <input
                    type="url"
                    value={form.fifa_source_url}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, fifa_source_url: e.target.value }))
                    }
                    disabled={busy}
                    className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-xs font-bold text-slate-600">
                  URL fuente Transfermarkt
                  <input
                    type="url"
                    value={form.transfermarkt_source_url}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        transfermarkt_source_url: e.target.value,
                      }))
                    }
                    disabled={busy}
                    className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-xs font-bold text-slate-600">
                  Notas
                  <textarea
                    value={form.notes}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, notes: e.target.value }))
                    }
                    disabled={busy}
                    rows={2}
                    className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
                {error && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                    {error}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-5 py-3">
                <button
                  type="button"
                  onClick={deleteRecord}
                  disabled={busy}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-40"
                >
                  <Trash2 size={14} /> Eliminar
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={closeEdit}
                    disabled={busy}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={saveEdit}
                    disabled={busy}
                    className="inline-flex items-center gap-1 rounded-lg bg-[#003399] px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
                  >
                    {busy ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={14} />
                    )}
                    Guardar
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </section>
  );
}