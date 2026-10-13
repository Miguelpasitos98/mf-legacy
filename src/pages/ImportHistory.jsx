import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Loader2,
  Upload,
  X,
  ShieldCheck,
  History,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { usePlayersQuery, useTeamsQuery } from "@/hooks/useSharedData";
import {
  parseCareerFile,
  resolvePlayer,
  suggestTeam,
} from "@/utils/careerImport";
import ImportDropzone from "@/components/career/ImportDropzone";
import CareerPreviewTable from "@/components/career/CareerPreviewTable";

const downloadReport = (report) => {
  const blob = new Blob([JSON.stringify(report, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `historiales_informe_${new Date()
    .toISOString()
    .slice(0, 19)
    .replace(/[:T]/g, "-")}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export default function ImportHistory() {
  const playersQuery = usePlayersQuery();
  const teamsQuery = useTeamsQuery();

  const players = useMemo(
    () =>
      (playersQuery.data || [])
        .map((p) => ({
          ...p,
          id: p?.id || p?._id || "",
          name: p?.name || "",
          fm26_uid: p?.fm26_uid || "",
          logo: p?.logo || "",
        }))
        .filter((p) => p.id && p.name),
    [playersQuery.data]
  );

  const teams = useMemo(
    () =>
      (teamsQuery.data || [])
        .map((t) => ({
          ...t,
          id: t?.id || t?._id || "",
          name: t?.name || "",
          short_name: t?.short_name || t?.shortName || "",
          logo: t?.logo || "",
        }))
        .filter((t) => t.id && t.name),
    [teamsQuery.data]
  );

  const [isAdmin, setIsAdmin] = useState(null); // null = checking
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState("");
  const [parsed, setParsed] = useState(null); // { format, entries }
  const [clubLinks, setClubLinks] = useState({}); // club_qid -> team_id
  const [existingIds, setExistingIds] = useState(new Set());
  const [playerOverrides, setPlayerOverrides] = useState({}); // stageId -> playerId
  const [teamOverrides, setTeamOverrides] = useState({}); // stageId -> teamId
  const [selected, setSelected] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, label: "" });
  const [report, setReport] = useState(null);

  // Verificar rol de administrador.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const user = await base44.auth.me();
        if (!active) return;
        setIsAdmin(user?.role === "admin");
      } catch {
        if (!active) return;
        setIsAdmin(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Cargar asociaciones ClubLink existentes (club_qid -> team_id).
  const loadClubLinks = useCallback(async () => {
    try {
      const result = await base44.entities.ClubLink.list({ limit: 500 });
      const list = Array.isArray(result)
        ? result
        : result?.items || result?.data || [];
      const map = {};
      for (const link of list) {
        if (link.club_qid && link.team_id) map[link.club_qid] = link.team_id;
      }
      setClubLinks(map);
    } catch (error) {
      console.warn("No se pudieron cargar las asociaciones de clubes:", error);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) loadClubLinks();
  }, [isAdmin, loadClubLinks]);

  // Filtrar etapas existentes por external_stage_id al cargar un lote.
  useEffect(() => {
    if (!parsed?.entries?.length) {
      setExistingIds(new Set());
      return;
    }
    let active = true;
    (async () => {
      const ids = parsed.entries
        .map((e) => e.record.external_stage_id)
        .filter(Boolean);
      if (!ids.length) {
        if (active) setExistingIds(new Set());
        return;
      }
      try {
        const result = await base44.entities.PlayerCareer.filter(
          { external_stage_id: { $in: ids } },
          { limit: 1000, fields: ["external_stage_id"] }
        );
        const items = Array.isArray(result)
          ? result
          : result?.items || result?.data || [];
        if (active)
          setExistingIds(
            new Set(items.map((i) => String(i.external_stage_id)))
          );
      } catch (error) {
        console.warn("No se pudieron comprobar etapas existentes:", error);
      }
    })();
    return () => {
      active = false;
    };
  }, [parsed]);

  // Construir filas de previsualización.
  const rows = useMemo(() => {
    if (!parsed?.entries) return [];
    return parsed.entries.map((entry) => {
      const record = entry.record;
      const stageId = record.external_stage_id;

      // Resolver jugador.
      let player = null;
      let playerMethod = null;
      const overridePid = playerOverrides[stageId];
      if (overridePid) {
        player = players.find((p) => String(p.id) === String(overridePid)) || null;
        playerMethod = player ? "manual" : null;
      } else {
        const resolved = resolvePlayer(entry, players);
        player = resolved.player;
        playerMethod = resolved.method;
      }

      // Resolver equipo.
      let team = null;
      const overrideTid = teamOverrides[stageId];
      if (overrideTid) {
        team = teams.find((t) => String(t.id) === String(overrideTid)) || null;
      }
      let suggestion = null;
      if (!team) {
        const linkedTeamId = record.club_qid ? clubLinks[record.club_qid] : null;
        if (linkedTeamId) {
          team = teams.find((t) => String(t.id) === String(linkedTeamId)) || null;
        }
      }
      if (!team && record.team_id) {
        team = teams.find((t) => String(t.id) === String(record.team_id)) || null;
      }
      if (!team) {
        suggestion = suggestTeam(record.club_name, teams);
        if (suggestion.team && !suggestion.ambiguous) {
          // Auto-sugerencia fiable (no se aplica sin confirmación del admin).
        }
      }

      const reviewStatus = record.review_status || "pending";
      const provisionalIdentity = Boolean(record.provisional_identity);
      const reviewOnly = Boolean(record.review_only);
      const errors = [...(entry.errors || [])];
      if (reviewOnly)
        errors.push("Sugerencia de revisión: no se importa automáticamente.");
      if (!player && !overridePid) errors.push("Jugador no vinculado.");

      // Selección por defecto: solo aprobadas, no provisionales, no de solo revisión.
      const defaultSelected =
        reviewStatus === "approved" &&
        !provisionalIdentity &&
        !reviewOnly &&
        errors.filter((e) => e !== "Jugador no vinculado.").length === 0;

      return {
        record,
        player,
        playerMethod,
        playerOverride: overridePid || "",
        team,
        teamOverride: overrideTid || "",
        suggestion,
        exists: existingIds.has(String(stageId)),
        provisionalIdentity,
        reviewStatus,
        reviewOnly,
        errors,
        selected: selected.has(stageId)
          ? true
          : defaultSelected && !selected.has(`__off__${stageId}`)
            ? true
            : false,
      };
    });
  }, [parsed, players, teams, clubLinks, existingIds, playerOverrides, teamOverrides, selected]);

  // Estadísticas.
  const stats = useMemo(() => {
    const detectedPlayers = new Set(
      rows
        .filter((r) => r.player)
        .map((r) => String(r.player.id))
    ).size;
    const newStages = rows.filter((r) => !r.exists && !r.errors.length).length;
    const existingStages = rows.filter((r) => r.exists).length;
    const pending = rows.filter(
      (r) => r.reviewStatus === "pending" || r.provisionalIdentity
    ).length;
    const conflicts = rows.filter((r) => r.errors.length).length;
    return { detectedPlayers, newStages, existingStages, pending, conflicts };
  }, [rows]);

  const handleFile = useCallback(async (file, error) => {
    setReport(null);
    if (error) {
      setParseError(error);
      setParsed(null);
      setFileName("");
      return;
    }
    if (!file) return;
    setParseError("");
    setFileName(file.name);
    setPlayerOverrides({});
    setTeamOverrides({});
    setSelected(new Set());
    try {
      const text = await file.text();
      const result = parseCareerFile(text);
      if (result.errors.length) {
        setParseError(result.errors.join(" "));
        setParsed(null);
        return;
      }
      if (!result.entries.length) {
        setParseError("El archivo no contiene etapas.");
        setParsed(null);
        return;
      }
      setParsed({ format: result.format, entries: result.entries });
    } catch (error) {
      setParseError(`No se ha podido leer el archivo: ${error.message}`);
      setParsed(null);
    }
  }, []);

  const toggleRow = useCallback((stageId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(stageId)) {
        next.delete(stageId);
        next.add(`__off__${stageId}`);
      } else {
        next.delete(`__off__${stageId}`);
        next.add(stageId);
      }
      return next;
    });
  }, []);

  const setPlayerOverride = useCallback((stageId, playerId) => {
    setPlayerOverrides((prev) => ({ ...prev, [stageId]: playerId }));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(`__off__${stageId}`);
      return next;
    });
  }, []);

  const setTeamOverride = useCallback((stageId, teamId) => {
    setTeamOverrides((prev) => ({ ...prev, [stageId]: teamId }));
  }, []);

  const selectedRows = useMemo(
    () => rows.filter((r) => r.selected && r.player && !r.errors.length),
    [rows]
  );

  const handleImport = async () => {
    if (!selectedRows.length || busy) return;
    setBusy(true);
    setReport(null);
    setProgress({ current: 0, total: selectedRows.length, label: "Iniciando..." });

    const result = {
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      clubLinksSaved: 0,
      details: [],
    };
    const newClubLinks = [];

    for (let i = 0; i < selectedRows.length; i++) {
      const row = selectedRows[i];
      setProgress({
        current: i,
        total: selectedRows.length,
        label: `Importando ${i + 1}/${selectedRows.length}: ${row.player.name} · ${
          row.team?.name || row.record.club_name
        }`,
      });

      const payload = {
        player_id: row.player.id,
        fm26_uid: row.record.fm26_uid || row.player.fm26_uid || "",
        team_id: row.team?.id || "",
        club_name: row.record.club_name,
        club_qid: row.record.club_qid || "",
        external_stage_id: row.record.external_stage_id,
        start_date: row.record.start_date || "",
        end_date: row.record.end_date || "",
        start_year: row.record.start_year ?? null,
        end_year: row.record.end_year ?? null,
        start_precision: row.record.start_precision || "",
        end_precision: row.record.end_precision || "",
        movement_type: row.record.movement_type || "desconocido",
        is_reserve: Boolean(row.record.is_reserve),
        source: row.record.source || "",
        source_url: row.record.source_url || "",
        source_license: row.record.source_license || "",
        review_flags: row.record.review_flags || [],
        review_status: row.record.review_status || "pending",
        provisional_identity: Boolean(row.record.provisional_identity),
        manually_verified: Boolean(row.record.manually_verified),
      };

      try {
        if (row.exists) {
          // Actualizar solo etapas existentes seleccionadas explícitamente.
          await base44.entities.PlayerCareer.update(
            row.record.external_stage_id,
            payload
          );
          result.updated += 1;
        } else {
          await base44.entities.PlayerCareer.create(payload);
          result.created += 1;
        }

        // Guardar asociación club_qid ↔ team_id confirmada.
        if (row.record.club_qid && row.team?.id) {
          newClubLinks.push({
            club_qid: row.record.club_qid,
            team_id: row.team.id,
            club_name: row.record.club_name,
          });
        }
      } catch (error) {
        result.failed += 1;
        result.details.push(
          `${row.player.name} · ${row.record.club_name}: ${
            error?.message || "error"
          }`
        );
      }
    }

    // Persistir ClubLinks nuevos/actualizados.
    for (const link of newClubLinks) {
      try {
        const existing = await base44.entities.ClubLink.filter(
          { club_qid: link.club_qid },
          { limit: 1, fields: ["id"] }
        );
        const items = Array.isArray(existing)
          ? existing
          : existing?.items || existing?.data || [];
        if (items.length) {
          await base44.entities.ClubLink.update(items[0].id, {
            team_id: link.team_id,
            club_name: link.club_name,
            confirmed: true,
          });
        } else {
          await base44.entities.ClubLink.create({ ...link, confirmed: true });
        }
        result.clubLinksSaved += 1;
      } catch (error) {
        // No bloquea la importación; la asociación se reintentará la próxima vez.
        console.warn("No se pudo guardar ClubLink:", link, error);
      }
    }

    await loadClubLinks();

    setProgress({
      current: selectedRows.length,
      total: selectedRows.length,
      label: `Importación completada · ${result.created} creados · ${result.updated} actualizados · ${result.failed} errores`,
    });
    setReport(result);
    setBusy(false);
  };

  const handleReset = () => {
    setParsed(null);
    setFileName("");
    setParseError("");
    setPlayerOverrides({});
    setTeamOverrides({});
    setSelected(new Set());
    setReport(null);
    setProgress({ current: 0, total: 0, label: "" });
  };

  if (isAdmin === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 size={24} className="animate-spin text-slate-400" />
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
          <ShieldCheck size={28} className="mx-auto mb-3 text-amber-600" />
          <h2 className="text-lg font-extrabold text-slate-900">
            Acceso restringido
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Solo los administradores pueden importar y gestionar historiales de
            clubes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-[#E8E9EC] px-6 py-8 md:px-10">
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              Administración · MF LEGACY
            </p>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
              <History size={22} /> Importar historiales
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Sube lotes de Career Studio, revisa la previsualización y confirma
              la importación. No se modifican datos de Player ni Team.
            </p>
          </div>
          {parsed && (
            <button
              type="button"
              onClick={handleReset}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <X size={14} /> Cerrar lote
            </button>
          )}
        </div>

        {!parsed && (
          <div className="mx-auto max-w-2xl">
            <ImportDropzone onFile={handleFile} fileName={fileName} disabled={busy} />
            {parseError && (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertCircle size={17} className="mt-0.5 shrink-0" />
                <div>{parseError}</div>
              </div>
            )}
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500">
              <p className="font-bold text-slate-700">Formatos admitidos</p>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                <li>
                  <strong>LOTE_BASE44_PREVISUALIZACION.json</strong>: jugadores con
                  etapas y estado de aprobación.
                </li>
                <li>
                  <strong>LOTE_BASE44_APROBADOS.json</strong>: etapas aprobadas
                  listas para importar.
                </li>
              </ul>
              <p className="mt-2">
                Las sugerencias marcadas como revisión no se importan
                automáticamente. La identidad provisional exige confirmación.
              </p>
            </div>
          </div>
        )}

        {parsed && (
          <>
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {[
                ["Jugadores", stats.detectedPlayers],
                ["Etapas nuevas", stats.newStages],
                ["Existentes", stats.existingStages],
                ["Pendientes", stats.pending],
                ["Conflictos", stats.conflicts],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl border border-slate-200 bg-white p-3"
                >
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    {label}
                  </p>
                  <p className="mt-1 text-2xl font-extrabold text-slate-900">
                    {value}
                  </p>
                </div>
              ))}
            </div>

            {parseError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {parseError}
              </div>
            )}

            <CareerPreviewTable
              rows={rows}
              onToggleRow={toggleRow}
              onPlayerOverride={setPlayerOverride}
              onTeamOverride={setTeamOverride}
              players={players}
              teams={teams}
              disabled={busy}
            />

            {(progress.total > 0 || busy) && (
              <div className="sticky bottom-0 z-10 mt-4 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-[0_-10px_28px_rgba(15,23,42,0.08)] backdrop-blur">
                <div className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold text-slate-700">
                  <span>
                    {progress.label ||
                      (busy ? "Importando..." : "Importación finalizada")}
                  </span>
                  <span>
                    {Math.min(progress.current, progress.total)}/
                    {progress.total || 0}
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#003399] to-[#60a5fa] transition-all duration-300"
                    style={{
                      width: `${
                        progress.total
                          ? (Math.min(progress.current, progress.total) /
                              progress.total) *
                            100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            )}

            {report && (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-extrabold text-emerald-900">
                      Importación completada
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                      <div>
                        <p className="uppercase text-emerald-700/70">Creadas</p>
                        <p className="text-lg font-extrabold text-emerald-900">
                          {report.created}
                        </p>
                      </div>
                      <div>
                        <p className="uppercase text-emerald-700/70">Actualizadas</p>
                        <p className="text-lg font-extrabold text-emerald-900">
                          {report.updated}
                        </p>
                      </div>
                      <div>
                        <p className="uppercase text-emerald-700/70">Fallidas</p>
                        <p className="text-lg font-extrabold text-emerald-900">
                          {report.failed}
                        </p>
                      </div>
                      <div>
                        <p className="uppercase text-emerald-700/70">Clubes vinculados</p>
                        <p className="text-lg font-extrabold text-emerald-900">
                          {report.clubLinksSaved}
                        </p>
                      </div>
                    </div>
                    {report.details.length > 0 && (
                      <div className="mt-3 rounded-lg border border-red-200 bg-white/70 p-3">
                        <p className="text-xs font-bold text-red-700">Incidencias</p>
                        <ul className="mt-1 space-y-1">
                          {report.details.slice(0, 10).map((d, i) => (
                            <li key={i} className="text-[11px] text-red-600">
                              {d}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => downloadReport(report)}
                    className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
                  >
                    <Download size={14} /> Descargar informe
                  </button>
                </div>
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                {selectedRows.length} etapa(s) seleccionada(s) para importar.
                Revisa los clubes y jugadores antes de confirmar.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={busy}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={busy || !selectedRows.length}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#003399] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#002477] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Upload size={16} />
                  )}
                  {busy ? "Importando..." : "Confirmar importación"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}