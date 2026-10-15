import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ClipboardPaste,
  Eraser,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import {
  buildRowsFromParsed,
  compareWithExisting,
  formatEur,
  parsePastedData,
  validateRow,
} from "@/utils/historicalValuation";
import TeamMatchesImporter from "./TeamMatchesImporter";

const unpack = (r) => (Array.isArray(r) ? r : r?.items || r?.data || []);

const STATUS_LABELS = {
  new: { text: "Nuevo", cls: "bg-emerald-50 text-emerald-700" },
  same: { text: "Ya existe sin cambios", cls: "bg-slate-100 text-slate-600" },
  update: { text: "Actualizacion", cls: "bg-blue-50 text-blue-700" },
  conflict: { text: "Requiere revision", cls: "bg-amber-50 text-amber-800" },
  error: { text: "Error", cls: "bg-red-50 text-red-700" },
};

const EXAMPLE = `season,fifa_fc_overall,transfermarkt_value_eur
2016,,200000
2020/2021,84,130000000
2022/2023,88,180000000
2023/2024,91,180000000`;

// Modal de importacion de valoraciones historicas para un jugador concreto.
export default function HistoricalValuationImporter({
  open,
  onClose,
  player,
  fotmobPlayerId,
  fm26Uid,
  onSaved,
  stats = [],
  teams = [],
}) {
  const [rawText, setRawText] = useState("");
  const [parsedRows, setParsedRows] = useState([]);
  const [existing, setExisting] = useState([]);
  const [parseError, setParseError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [report, setReport] = useState(null);
  const [excluded, setExcluded] = useState(new Set());
  const [edits, setEdits] = useState({});
  const [activeTab, setActiveTab] = useState("valuations");

  const playerId = String(player?.id || "");

  // Carga los registros existentes del jugador para comparar.
  useEffect(() => {
    if (!open || !playerId) return;
    let active = true;
    (async () => {
      try {
        const r = await base44.entities.PlayerHistoricalValuation.filter(
          { player_id: playerId },
          { sort: "-season", limit: 100 }
        );
        if (active) setExisting(unpack(r));
      } catch {
        if (active) setExisting([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [open, playerId]);

  const existingBySeason = useMemo(() => {
    const m = new Map();
    for (const v of existing) m.set(String(v.season), v);
    return m;
  }, [existing]);

  // Filas con validacion, comparacion y estado.
  const rows = useMemo(() => {
    if (!parsedRows.length) return [];
    const seen = new Map();
    return parsedRows.map((raw) => {
      const edit = edits[raw.rowIndex] || {};
      const row = { ...raw, ...edit };
      row.season = row.season || raw.season;
      const errors = validateRow(row);

      // Deteccion de duplicados dentro del lote
      const dupKey = String(row.season || "").toLowerCase();
      const dupCount = (seen.get(dupKey) || 0) + 1;
      seen.set(dupKey, dupCount);
      if (dupCount > 1 && row.season)
        errors.unshift("Temporada duplicada en el lote.");

      const existingRec = existingBySeason.get(String(row.season));
      const cmp = compareWithExisting(row, existingRec);
      const status =
        errors.length > 0
          ? "error"
          : dupCount > 1
            ? "conflict"
            : cmp.status;
      return {
        ...row,
        errors,
        status,
        reason: cmp.reason,
        existing: cmp.existing,
      };
    });
  }, [parsedRows, edits, existingBySeason]);

  const summary = useMemo(() => {
    const counts = { new: 0, same: 0, update: 0, conflict: 0, error: 0, excluded: 0 };
    for (const r of rows) {
      if (excluded.has(r.rowIndex)) {
        counts.excluded += 1;
        continue;
      }
      if (counts[r.status] !== undefined) counts[r.status] += 1;
    }
    return counts;
  }, [rows, excluded]);

  const handleAnalyze = () => {
    setParseError("");
    setReport(null);
    setEdits({});
    setExcluded(new Set());
    try {
      const parsed = parsePastedData(rawText);
      if (parsed.errors.length) {
        setParseError(parsed.errors.join(" "));
        setParsedRows([]);
        return;
      }
      const built = buildRowsFromParsed(parsed);
      if (!built.length) {
        setParseError("No se detectaron filas con datos.");
        setParsedRows([]);
        return;
      }
      setParsedRows(built);
    } catch (e) {
      setParseError(`No se pudo analizar: ${e.message}`);
      setParsedRows([]);
    }
  };

  const handleClear = () => {
    setRawText("");
    setParsedRows([]);
    setParseError("");
    setReport(null);
    setEdits({});
    setExcluded(new Set());
  };

  const toggleExclude = (rowIndex) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(rowIndex)) next.delete(rowIndex);
      else next.add(rowIndex);
      return next;
    });
  };

  const updateEdit = (rowIndex, field, value) => {
    setEdits((prev) => ({
      ...prev,
      [rowIndex]: { ...prev[rowIndex], [field]: value },
    }));
  };

  const handleSave = async () => {
    const toSave = rows.filter(
      (r) => !excluded.has(r.rowIndex) && r.errors.length === 0 && r.status !== "same"
    );
    if (!toSave.length || busy) return;

    setBusy(true);
    setReport(null);
    setProgress({ done: 0, total: toSave.length, created: 0, updated: 0, errors: [] });

    const result = { created: 0, updated: 0, failed: 0, details: [] };

    for (let i = 0; i < toSave.length; i++) {
      const row = toSave[i];
      setProgress((p) => ({
        ...p,
        done: i,
        label: `Guardando ${i + 1}/${toSave.length}: ${row.season}`,
      }));

      const patch = {};
      if (row.fifa_fc_overall !== null)
        patch.fifa_fc_overall = row.fifa_fc_overall;
      if (row.transfermarkt_value_eur !== null)
        patch.transfermarkt_value_eur = row.transfermarkt_value_eur;
      if (row.fifa_edition) patch.fifa_edition = row.fifa_edition;
      if (row.fifa_fc_position) patch.fifa_fc_position = row.fifa_fc_position;
      if (row.market_value_as_of) patch.market_value_as_of = row.market_value_as_of;
      if (row.fifa_source_url) patch.fifa_source_url = row.fifa_source_url;
      if (row.transfermarkt_source_url)
        patch.transfermarkt_source_url = row.transfermarkt_source_url;
      if (row.market_value_status) patch.market_value_status = row.market_value_status;
      if (row.notes) patch.notes = row.notes;
      patch.verification_status = "pending";

      try {
        if (row.existing?.id) {
          await base44.entities.PlayerHistoricalValuation.update(
            row.existing.id,
            patch
          );
          result.updated += 1;
        } else {
          await base44.entities.PlayerHistoricalValuation.create({
            player_id: playerId,
            fotmob_player_id: fotmobPlayerId || "",
            fm26_uid: fm26Uid || "",
            season: row.season,
            ...patch,
          });
          result.created += 1;
        }
      } catch (e) {
        result.failed += 1;
        result.details.push(`${row.season}: ${e?.message || "error"}`);
      }
      setProgress((p) => ({
        ...p,
        done: i + 1,
        created: result.created,
        updated: result.updated,
        errors: [...result.details],
      }));
    }

    setBusy(false);
    setReport(result);

    // Recargar existentes para reflejar los cambios
    if (result.created || result.updated) {
      try {
        const r = await base44.entities.PlayerHistoricalValuation.filter(
          { player_id: playerId },
          { sort: "-season", limit: 100 }
        );
        setExisting(unpack(r));
      } catch {
        /* ignore */
      }
      onSaved?.();
    }
  };

  if (!open || typeof document === "undefined") return null;

  const subtitle = `${player?.name || "Jugador"}${fotmobPlayerId ? ` · FotMob ${fotmobPlayerId}` : ""}`;

  return createPortal(
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Importar valores historicos"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-[#0d243b] px-5 py-4 text-white">
          <div className="min-w-0">
            <h2 className="text-lg font-black">IMPORTAR VALORES HISTORICOS</h2>
            <p className="truncate text-xs text-blue-200">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-lg p-2 hover:bg-white/10 disabled:opacity-40"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="mb-4 flex gap-1 border-b border-slate-200">
            <button type="button" onClick={()=>setActiveTab("valuations")} className={"rounded-t-lg px-4 py-2 text-xs font-bold "+(activeTab==="valuations"?"border-b-2 border-[#003399] text-[#003399]":"text-slate-500 hover:text-slate-700")}>FIFA/FC + Transfermarkt</button>
            <button type="button" onClick={()=>setActiveTab("team-matches")} className={"rounded-t-lg px-4 py-2 text-xs font-bold "+(activeTab==="team-matches"?"border-b-2 border-[#003399] text-[#003399]":"text-slate-500 hover:text-slate-700")}>PJ Equipo</button>
          </div>
          {activeTab==="valuations"&&<>
          {/* A. Pegar datos */}
          <section className="mb-5">
            <h3 className="mb-2 text-xs font-black uppercase tracking-widest text-[#003399]">
              A. Pegar datos
            </h3>
            <p className="mb-2 text-xs text-slate-500">
              Pega aqui la tabla de ChatGPT. Se admiten CSV (coma o punto y coma), TSV y tablas Markdown.
            </p>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={EXAMPLE}
              disabled={busy}
              className="h-40 w-full rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-800 outline-none focus:border-[#003399] disabled:opacity-50"
            />
            {parseError && (
              <p className="mt-2 flex items-center gap-2 text-xs text-rose-700">
                <AlertCircle size={14} /> {parseError}
              </p>
            )}
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={busy || !rawText.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-[#003399] px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
              >
                <ClipboardPaste size={15} /> Analizar datos
              </button>
              <button
                type="button"
                onClick={handleClear}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                <Eraser size={15} /> Limpiar
              </button>
            </div>
          </section>

          {/* B. Vista previa */}
          {rows.length > 0 && (
            <section className="mb-5">
              <h3 className="mb-2 text-xs font-black uppercase tracking-widest text-[#003399]">
                B. Vista previa y validacion
              </h3>

              {/* Resumen */}
              <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                {[
                  ["Nuevos", summary.new],
                  ["Actualizar", summary.update],
                  ["Sin cambios", summary.same],
                  ["Revision", summary.conflict],
                  ["Errores", summary.error],
                  ["Excluidos", summary.excluded],
                ].map(([label, val]) => (
                  <div
                    key={label}
                    className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-center"
                  >
                    <p className="text-[10px] font-bold uppercase text-slate-400">
                      {label}
                    </p>
                    <p className="text-lg font-black text-slate-800">{val}</p>
                  </div>
                ))}
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full min-w-[1020px] text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="w-8 px-2 py-2"></th>
                      <th className="px-2 py-2">Temporada</th>
                      <th className="px-2 py-2">Edicion FIFA/FC</th>
                      <th className="px-2 py-2">Posicion FIFA</th>
                      <th className="px-2 py-2">Overall</th>
                      <th className="px-2 py-2">Transfermarkt</th>
                      <th className="px-2 py-2">Fecha valor</th>
                      <th className="px-2 py-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((r) => {
                      const isExcluded = excluded.has(r.rowIndex);
                      return (
                        <tr
                          key={r.rowIndex}
                          className={
                            isExcluded
                              ? "opacity-40"
                              : r.errors.length
                                ? "bg-red-50/30"
                                : r.status === "update"
                                  ? "bg-blue-50/30"
                                  : ""
                          }
                        >
                          <td className="px-2 py-2">
                            <input
                              type="checkbox"
                              checked={!isExcluded}
                              disabled={r.errors.length > 0}
                              onChange={() => toggleExclude(r.rowIndex)}
                              className="h-4 w-4 rounded border-slate-300 text-[#003399]"
                              aria-label="Incluir fila"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="text"
                              value={r.season}
                              onChange={(e) =>
                                updateEdit(r.rowIndex, "season", e.target.value)
                              }
                              disabled={busy}
                              className="w-24 rounded border border-slate-200 px-2 py-1 text-xs disabled:bg-slate-50"
                            />
                            {r.existing && (
                              <span className="block text-[9px] text-slate-400">
                                Existe: OVR {r.existing.fifa_fc_overall ?? "—"} ·{" "}
                                {formatEur(r.existing.transfermarkt_value_eur)}
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="text"
                              value={r.fifa_edition}
                              onChange={(e) =>
                                updateEdit(r.rowIndex, "fifa_edition", e.target.value)
                              }
                              disabled={busy}
                              className="w-24 rounded border border-slate-200 px-2 py-1 text-xs disabled:bg-slate-50"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="text"
                              value={r.fifa_fc_position || ""}
                              onChange={(e) =>
                                updateEdit(r.rowIndex, "fifa_fc_position", e.target.value.toUpperCase())
                              }
                              disabled={busy}
                              placeholder="CAM"
                              aria-label="Posicion FIFA/FC"
                              className="w-20 rounded border border-slate-200 px-2 py-1 text-xs disabled:bg-slate-50"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              min="1"
                              max="99"
                              value={
                                r.fifa_fc_overall ?? ""
                              }
                              onChange={(e) =>
                                updateEdit(r.rowIndex, "fifa_fc_overall", e.target.value)
                              }
                              disabled={busy}
                              className="w-16 rounded border border-slate-200 px-2 py-1 text-xs disabled:bg-slate-50"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="text"
                              value={r.transfermarkt_value_eur ?? ""}
                              onChange={(e) =>
                                updateEdit(
                                  r.rowIndex,
                                  "transfermarkt_value_eur",
                                  e.target.value
                                )
                              }
                              disabled={busy}
                              className="w-32 rounded border border-slate-200 px-2 py-1 text-xs disabled:bg-slate-50"
                            />
                            <span className="block text-[9px] text-slate-400">
                              {formatEur(r.transfermarkt_value_eur)}
                            </span>
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="date"
                              value={r.market_value_as_of}
                              onChange={(e) =>
                                updateEdit(r.rowIndex, "market_value_as_of", e.target.value)
                              }
                              disabled={busy}
                              className="w-36 rounded border border-slate-200 px-2 py-1 text-xs disabled:bg-slate-50"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <span
                              className={
                                "inline-block rounded-full px-2 py-0.5 text-[10px] font-bold " +
                                (STATUS_LABELS[r.status]?.cls || "")
                              }
                            >
                              {STATUS_LABELS[r.status]?.text || r.status}
                            </span>
                            {r.errors.length > 0 && (
                              <ul className="mt-1 space-y-0.5">
                                {r.errors.map((err, i) => (
                                  <li key={i} className="text-[9px] text-red-600">
                                    {err}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* C. Confirmacion */}
          {rows.length > 0 && (
            <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <h3 className="mb-2 text-xs font-black uppercase tracking-widest text-[#003399]">
                C. Confirmacion
              </h3>
              <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-5">
                <div>
                  <p className="text-slate-400">Analizadas</p>
                  <p className="text-lg font-black text-slate-800">{rows.length}</p>
                </div>
                <div>
                  <p className="text-slate-400">Nuevas</p>
                  <p className="text-lg font-black text-emerald-700">{summary.new}</p>
                </div>
                <div>
                  <p className="text-slate-400">Actualizar</p>
                  <p className="text-lg font-black text-blue-700">{summary.update}</p>
                </div>
                <div>
                  <p className="text-slate-400">Sin cambios</p>
                  <p className="text-lg font-black text-slate-500">{summary.same}</p>
                </div>
                <div>
                  <p className="text-slate-400">Errores</p>
                  <p className="text-lg font-black text-red-600">{summary.error}</p>
                </div>
              </div>

              {progress && (
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-xs font-semibold text-slate-700">
                    <span>{progress.label || "Procesando..."}</span>
                    <span>
                      {progress.done}/{progress.total}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-[#003399] transition-all"
                      style={{
                        width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {report && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="font-bold">
                      Guardado completado: {report.created} creadas · {report.updated} actualizadas ·{" "}
                      {report.failed} fallos
                    </p>
                    {report.details.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {report.details.slice(0, 5).map((d, i) => (
                          <li key={i} className="text-red-600">
                            {d}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={busy}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={
                    busy ||
                    summary.new + summary.update === 0
                  }
                  className="inline-flex items-center gap-2 rounded-lg bg-[#003399] px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
                >
                  {busy ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Upload size={15} />
                  )}
                  Guardar valores historicos
                </button>
              </div>
            </section>
          )}

          <p className="mt-4 text-xs text-slate-400">
            Los valores vacios no sobrescriben datos existentes. La importacion es idempotente: repetirla
            no crea duplicados. Los datos pegados no se marcan como verificados.
          </p>
          </>}
          {activeTab==="team-matches"&&<TeamMatchesImporter player={player} stats={stats} teams={teams} onSaved={onSaved}/>}
        </div>
      </div>
    </div>,
    document.body
  );
}