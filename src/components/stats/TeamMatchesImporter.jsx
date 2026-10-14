import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardPaste,
  Eraser,
  Loader2,
  Upload,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import {
  buildTeamMatchesRows,
  normalizeSeason,
  parsePastedData,
  validateTeamMatchesRow,
} from "@/utils/historicalValuation";

const unpack = (r) => (Array.isArray(r) ? r : r?.items || r?.data || []);
const normalizeName = (v) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const STATUS_LABELS = {
  new: { text: "Nuevo", cls: "bg-emerald-50 text-emerald-700" },
  same: { text: "Ya existe", cls: "bg-slate-100 text-slate-600" },
  update: { text: "Actualizar", cls: "bg-blue-50 text-blue-700" },
  unmatched: { text: "Sin vincular", cls: "bg-amber-50 text-amber-800" },
  duplicate: { text: "Duplicado", cls: "bg-amber-50 text-amber-800" },
  error: { text: "Error", cls: "bg-red-50 text-red-700" },
};

const EXAMPLE = `season,competition,team_name,team_matches
2022/2023,Premier League,Manchester City,38
2022/2023,Champions League,Manchester City,13
2022/2023,FA Cup,Manchester City,6`;

// Importador de PJ Equipo a nivel de club (TeamSeasonMatches).
// Los datos se almacenan por equipo+temporada+competicion y se reutilizan
// automaticamente para todos los jugadores del mismo equipo.
export default function TeamMatchesImporter({ player, stats = [], teams = [], onSaved }) {
  const [rawText, setRawText] = useState("");
  const [parsedRows, setParsedRows] = useState([]);
  const [existing, setExisting] = useState([]);
  const [parseError, setParseError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [report, setReport] = useState(null);
  const [excluded, setExcluded] = useState(new Set());
  const [edits, setEdits] = useState({});

  // Lookup de equipos desde las estadisticas del jugador y la lista de equipos.
  const teamLookup = useMemo(() => {
    const byFotmobId = new Map();
    const byName = new Map();
    const add = (teamId, fotmobTeamId, teamName) => {
      if (fotmobTeamId) {
        const fid = String(fotmobTeamId);
        if (!byFotmobId.has(fid))
          byFotmobId.set(fid, { team_id: teamId, fotmob_team_id: fid, team_name: teamName });
      }
      if (teamName) {
        const key = normalizeName(teamName);
        if (!byName.has(key))
          byName.set(key, { team_id: teamId, fotmob_team_id: fotmobTeamId ? String(fotmobTeamId) : "", team_name: teamName });
      }
    };
    for (const r of stats) {
      add(r.team_id, r.fotmob_team_id, r.team_name);
    }
    for (const t of teams) {
      add(t.id, t.fotmob_id, t.name);
    }
    return { byFotmobId, byName };
  }, [stats, teams]);

  // Carga TeamSeasonMatches existentes para los equipos del jugador.
  useEffect(() => {
    const ids = [...new Set((stats || []).map((r) => String(r.team_id || "")).filter(Boolean))];
    if (!ids.length) {
      setExisting([]);
      return;
    }
    let active = true;
    (async () => {
      try {
        const all = [];
        for (let i = 0; i < ids.length; i += 100) {
          const chunk = ids.slice(i, i + 100);
          const r = await base44.entities.TeamSeasonMatches.filter(
            { team_id: { $in: chunk } },
            { limit: 500 }
          );
          all.push(...unpack(r));
        }
        if (active) setExisting(all);
      } catch {
        if (active) setExisting([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [stats]);

  const existingByKey = useMemo(() => {
    const map = new Map();
    for (const e of existing) {
      if (e.team_id) map.set(`${e.team_id}|${e.season}|${e.competition}`, e);
      if (e.fotmob_team_id) map.set(`${e.fotmob_team_id}|${e.season}|${e.competition}`, e);
    }
    return map;
  }, [existing]);

  // Resuelve el equipo de cada fila importada.
  const matchTeam = (row) => {
    if (row.fotmob_team_id) {
      const m = teamLookup.byFotmobId.get(String(row.fotmob_team_id));
      if (m) return { team: m, method: "fotmob_id" };
    }
    if (row.team_name) {
      const m = teamLookup.byName.get(normalizeName(row.team_name));
      if (m) return { team: m, method: "name" };
    }
    return { team: null, method: null };
  };

  // Filas con validacion, matching y estado.
  const rows = useMemo(() => {
    if (!parsedRows.length) return [];
    const seen = new Map();
    return parsedRows.map((raw) => {
      const edit = edits[raw.rowIndex] || {};
      const row = { ...raw, ...edit };
      row.season = row.season || raw.season;
      row.competition = row.competition || raw.competition;
      row.team_name = row.team_name || raw.team_name;
      row.team_matches = row.team_matches !== undefined ? row.team_matches : raw.team_matches;

      const errors = validateTeamMatchesRow(row);
      const { team, method } = matchTeam(row);

      // Deteccion de duplicados dentro del lote
      const dupKey = `${normalizeName(row.team_name || row.fotmob_team_id)}|${normalizeSeason(row.season)}|${normalizeName(row.competition)}`;
      const dupCount = (seen.get(dupKey) || 0) + 1;
      seen.set(dupKey, dupCount);

      let existingRec = null;
      let status = "error";
      if (team) {
        existingRec =
          existingByKey.get(`${team.team_id}|${row.season}|${row.competition}`) || null;
        if (errors.length > 0) status = "error";
        else if (dupCount > 1) status = "duplicate";
        else if (existingRec && existingRec.team_matches === row.team_matches) status = "same";
        else if (existingRec) status = "update";
        else status = "new";
      } else if (errors.length === 0) {
        status = "unmatched";
      }

      return {
        ...row,
        team,
        teamMethod: method,
        errors,
        status,
        existing: existingRec,
      };
    });
  }, [parsedRows, edits, teamLookup, existingByKey]);

  const summary = useMemo(() => {
    const counts = { new: 0, same: 0, update: 0, unmatched: 0, duplicate: 0, error: 0, excluded: 0 };
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
      const built = buildTeamMatchesRows(parsed);
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
      (r) =>
        !excluded.has(r.rowIndex) &&
        r.errors.length === 0 &&
        r.team &&
        r.status !== "same"
    );
    if (!toSave.length || busy) return;

    const confirmed = window.confirm(
      `Se guardaran ${toSave.length} registro(s) de PJ Equipo. ` +
        `Los datos se almacenan a nivel de club y se reutilizan para todos los jugadores del equipo. ¿Continuar?`
    );
    if (!confirmed) return;

    setBusy(true);
    setReport(null);
    setProgress({ done: 0, total: toSave.length, created: 0, updated: 0, errors: [] });

    const result = { created: 0, updated: 0, failed: 0, details: [] };

    for (let i = 0; i < toSave.length; i++) {
      const row = toSave[i];
      setProgress((p) => ({
        ...p,
        done: i,
        label: `Guardando ${i + 1}/${toSave.length}: ${row.team.team_name} ${row.season} ${row.competition}`,
      }));

      const payload = {
        team_id: row.team.team_id || "",
        fotmob_team_id: row.team.fotmob_team_id || row.fotmob_team_id || "",
        team_name: row.team.team_name || row.team_name || "",
        season: row.season,
        competition: row.competition,
        fotmob_tournament_id: row.fotmob_tournament_id || "",
        team_matches: row.team_matches,
        source: row.source || "ChatGPT",
        verification_status: "pending",
      };

      try {
        if (row.existing?.id) {
          await base44.entities.TeamSeasonMatches.update(row.existing.id, {
            team_matches: row.team_matches,
            fotmob_tournament_id: payload.fotmob_tournament_id || undefined,
            source: payload.source,
          });
          result.updated += 1;
        } else {
          await base44.entities.TeamSeasonMatches.create(payload);
          result.created += 1;
        }
      } catch (e) {
        result.failed += 1;
        result.details.push(
          `${row.team.team_name || row.team_name} ${row.season} ${row.competition}: ${e?.message || "error"}`
        );
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

    // Recargar existentes
    if (result.created || result.updated) {
      try {
        const ids = [...new Set((stats || []).map((r) => String(r.team_id || "")).filter(Boolean))];
        const all = [];
        for (let i = 0; i < ids.length; i += 100) {
          const chunk = ids.slice(i, i + 100);
          const r = await base44.entities.TeamSeasonMatches.filter(
            { team_id: { $in: chunk } },
            { limit: 500 }
          );
          all.push(...unpack(r));
        }
        setExisting(all);
      } catch {
        /* ignore */
      }
      onSaved?.();
    }
  };

  return (
    <div>
      {/* A. Pegar datos */}
      <section className="mb-5">
        <h3 className="mb-2 text-xs font-black uppercase tracking-widest text-[#003399]">
          A. Pegar datos PJ Equipo
        </h3>
        <p className="mb-2 text-xs text-slate-500">
          Pega la tabla de ChatGPT con los partidos disputados por el equipo en cada competicion y temporada.
          Se admiten CSV, TSV y Markdown. Columnas opcionales: fotmob_team_id, fotmob_tournament_id, source.
        </p>
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder={EXAMPLE}
          disabled={busy}
          className="h-36 w-full rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-800 outline-none focus:border-[#003399] disabled:opacity-50"
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
          <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-7">
            {[
              ["Nuevos", summary.new],
              ["Actualizar", summary.update],
              ["Sin cambios", summary.same],
              ["Sin vincular", summary.unmatched],
              ["Duplicados", summary.duplicate],
              ["Errores", summary.error],
              ["Excluidos", summary.excluded],
            ].map(([label, val]) => (
              <div key={label} className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-center">
                <p className="text-[10px] font-bold uppercase text-slate-400">{label}</p>
                <p className="text-lg font-black text-slate-800">{val}</p>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[860px] text-left text-xs">
              <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="w-8 px-2 py-2"></th>
                  <th className="px-2 py-2">Temporada</th>
                  <th className="px-2 py-2">Competicion</th>
                  <th className="px-2 py-2">Equipo</th>
                  <th className="px-2 py-2">PJ Equipo</th>
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
                            : r.status === "unmatched"
                              ? "bg-amber-50/30"
                              : r.status === "update"
                                ? "bg-blue-50/30"
                                : ""
                      }
                    >
                      <td className="px-2 py-2">
                        <input
                          type="checkbox"
                          checked={!isExcluded}
                          disabled={r.errors.length > 0 || !r.team}
                          onChange={() => toggleExclude(r.rowIndex)}
                          className="h-4 w-4 rounded border-slate-300 text-[#003399]"
                          aria-label="Incluir fila"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          value={r.season}
                          onChange={(e) => updateEdit(r.rowIndex, "season", e.target.value)}
                          disabled={busy}
                          className="w-24 rounded border border-slate-200 px-2 py-1 text-xs disabled:bg-slate-50"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          value={r.competition}
                          onChange={(e) => updateEdit(r.rowIndex, "competition", e.target.value)}
                          disabled={busy}
                          className="w-40 rounded border border-slate-200 px-2 py-1 text-xs disabled:bg-slate-50"
                        />
                      </td>
                      <td className="px-2 py-2">
                        {r.team ? (
                          <div>
                            <span className="font-bold text-slate-800">{r.team.team_name}</span>
                            <span className="block text-[9px] text-slate-400">
                              {r.teamMethod === "fotmob_id" ? "FotMob ID" : "Por nombre"}
                              {r.existing ? " · existe" : ""}
                            </span>
                          </div>
                        ) : (
                          <span className="text-amber-700">{r.team_name || "Sin equipo"}</span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min="1"
                          max="200"
                          value={r.team_matches ?? ""}
                          onChange={(e) => updateEdit(r.rowIndex, "team_matches", e.target.value)}
                          disabled={busy}
                          className="w-16 rounded border border-slate-200 px-2 py-1 text-xs disabled:bg-slate-50"
                        />
                        {r.existing && (
                          <span className="block text-[9px] text-slate-400">
                            Existe: {r.existing.team_matches}
                          </span>
                        )}
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
          <p className="text-xs text-slate-600">
            Los PJ Equipo se guardan a nivel de club y se reutilizan automaticamente para todos los jugadores
            del mismo equipo. No se sobrescriben las estadisticas individuales del jugador ni los registros de FotMob.
          </p>
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
                  Guardado completado: {report.created} creados · {report.updated} actualizados ·{" "}
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
              onClick={handleSave}
              disabled={busy || summary.new + summary.update === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-[#003399] px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
              Guardar PJ Equipo
            </button>
          </div>
        </section>
      )}
    </div>
  );
}