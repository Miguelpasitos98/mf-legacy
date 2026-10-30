import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import { usePlayersQuery } from "@/hooks/useSharedData";
import { parseCareerFile, resolvePlayer } from "@/utils/careerImport";
import {
  detectClubs,
  resolveClubGroup,
  clubKeyFor,
} from "@/utils/clubResolution";
import ImportDropzone from "@/components/career/ImportDropzone";
import CareerPreviewTable from "@/components/career/CareerPreviewTable";
import ClubResolutionPanel from "@/components/career/ClubResolutionPanel";

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

// Persiste (crea o actualiza) una asociación ClubLink confirmada.
const persistClubLink = async (club_qid, team_id, club_name) => {
  if (!club_qid || !team_id) return false;
  try {
    const existing = await base44.entities.ClubLink.filter(
      { club_qid },
      { limit: 1, fields: ["id"] }
    );
    const items = Array.isArray(existing)
      ? existing
      : existing?.items || existing?.data || [];
    if (items.length) {
      await base44.entities.ClubLink.update(items[0].id, {
        team_id,
        club_name,
        confirmed: true,
      });
    } else {
      await base44.entities.ClubLink.create({
        club_qid,
        team_id,
        club_name,
        confirmed: true,
      });
    }
    return true;
  } catch (error) {
    console.warn("No se pudo guardar ClubLink:", club_qid, error);
    return false;
  }
};

export default function ImportHistory() {
  const queryClient = useQueryClient();
  const playersQuery = usePlayersQuery();
  const [allTeams, setAllTeams] = useState([]);

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
      (allTeams || [])
        .map((t) => ({
          ...t,
          id: t?.id || t?._id || "",
          name: t?.name || "",
          short_name: t?.short_name || t?.shortName || "",
          logo: t?.logo || "",
        }))
        .filter((t) => t.id && t.name),
    [allTeams]
  );

  const [isAdmin, setIsAdmin] = useState(null);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState("");
  const [parsed, setParsed] = useState(null);
  const [clubLinks, setClubLinks] = useState({});
  const [existingStages, setExistingStages] = useState(new Map());
  const [importedThisSession, setImportedThisSession] = useState(new Set());
  const [playerOverrides, setPlayerOverrides] = useState({});
  const [teamOverrides, setTeamOverrides] = useState({});
  const [clubResolutions, setClubResolutions] = useState({}); // clubKey -> teamId
  const [selected, setSelected] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, label: "" });
  const [report, setReport] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);

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

  // Carga completa (con paginación) de asociaciones ClubLink -> mapa qid:teamId.
  const fetchClubLinksMap = useCallback(async () => {
    const map = {};
    let cursor;
    do {
      const page = await base44.entities.ClubLink.list({ limit: 500, cursor });
      const items = Array.isArray(page) ? page : page?.items || page?.data || [];
      for (const link of items) {
        if (link.club_qid && link.team_id) map[link.club_qid] = link.team_id;
      }
      cursor = Array.isArray(page) ? undefined : page?.next_cursor;
    } while (cursor);
    return map;
  }, []);

  const loadClubLinks = useCallback(async () => {
    try {
      setClubLinks(await fetchClubLinksMap());
    } catch (error) {
      console.warn("No se pudieron cargar las asociaciones de clubes:", error);
    }
  }, [fetchClubLinksMap]);

  // Carga completa (con paginación) de todos los equipos para resolución.
  const fetchAllTeams = useCallback(async () => {
    const all = [];
    let cursor;
    do {
      const page = await base44.entities.Team.list({ limit: 500, cursor });
      const items = Array.isArray(page) ? page : page?.items || page?.data || [];
      all.push(...items);
      cursor = Array.isArray(page) ? undefined : page?.next_cursor;
    } while (cursor);
    return all;
  }, []);

  const loadAllTeams = useCallback(async () => {
    try {
      setAllTeams(await fetchAllTeams());
    } catch (error) {
      console.warn("No se pudieron cargar todos los equipos:", error);
    }
  }, [fetchAllTeams]);

  useEffect(() => {
    if (isAdmin) {
      loadAllTeams();
      loadClubLinks();
    }
  }, [isAdmin, loadAllTeams, loadClubLinks]);

  // Consulta PlayerCareer por external_stage_id para detectar etapas ya
  // guardadas (evita duplicados al recargar o re-subir el mismo JSON).
  const refreshExistingStages = useCallback(async () => {
    if (!parsed?.entries?.length) {
      setExistingStages(new Map());
      return;
    }
    const ids = parsed.entries
      .map((e) => e.record.external_stage_id)
      .filter(Boolean);
    if (!ids.length) {
      setExistingStages(new Map());
      return;
    }
    try {
      const result = await base44.entities.PlayerCareer.filter(
        { external_stage_id: { $in: ids } },
        { limit: 1000 }
      );
      const items = Array.isArray(result)
        ? result
        : result?.items || result?.data || [];
      const map = new Map();
      for (const it of items) {
        if (it.external_stage_id)
          map.set(String(it.external_stage_id), it.id);
      }
      setExistingStages(map);
    } catch (error) {
      console.warn("No se pudieron comprobar etapas existentes:", error);
    }
  }, [parsed]);

  useEffect(() => {
    refreshExistingStages();
  }, [refreshExistingStages]);

  // Detección de clubes únicos (agrupados por club_qid o nombre normalizado).
  const clubGroups = useMemo(
    () => (parsed?.entries ? detectClubs(parsed.entries) : []),
    [parsed]
  );

  // Resolución por club: estado + equipo + candidatos.
  const resolvedTeamByKey = useMemo(() => {
    const map = {};
    for (const g of clubGroups) {
      const res = resolveClubGroup(g, { clubLinks, teams });
      const override = clubResolutions[g.key];
      if (override) {
        const t =
          teams.find((t) => String(t.id) === String(override)) || null;
        map[g.key] = {
          team: t,
          status: t ? "resolved" : res.status,
          candidates: res.candidates,
        };
      } else {
        map[g.key] = res;
      }
    }
    return map;
  }, [clubGroups, clubLinks, teams, clubResolutions]);

  const clubStats = useMemo(() => {
    const counts = {
      linked: 0,
      matched: 0,
      creatable: 0,
      ambiguous: 0,
      unidentified: 0,
      resolved: 0,
    };
    for (const g of clubGroups) {
      const r = resolvedTeamByKey[g.key];
      if (r && counts[r.status] !== undefined) counts[r.status] += 1;
    }
    return counts;
  }, [clubGroups, resolvedTeamByKey]);

  // Construir filas de previsualización.
  const rows = useMemo(() => {
    if (!parsed?.entries) return [];
    return parsed.entries.map((entry) => {
      const record = entry.record;
      const stageId = record.external_stage_id;

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

      // Resolver equipo a nivel de club (no por etapa).
      const clubKey = clubKeyFor(record);
      const resolvedClub = resolvedTeamByKey[clubKey] || {};
      let team = resolvedClub.team || null;
      const overrideTid = teamOverrides[stageId];
      if (overrideTid) {
        team = teams.find((t) => String(t.id) === String(overrideTid)) || null;
      }
      const suggestion =
        !team && resolvedClub.candidates?.length
          ? {
              team: resolvedClub.candidates[0].team,
              ambiguous: true,
              confidence: resolvedClub.candidates[0].score || 0.82,
              candidates: resolvedClub.candidates,
            }
          : null;

      const reviewStatus = record.review_status || "pending";
      const provisionalIdentity = Boolean(record.provisional_identity);
      const reviewOnly = Boolean(record.review_only);
      const errors = [...(entry.errors || [])];
      if (reviewOnly)
        errors.push("Sugerencia de revisión: no se importa automáticamente.");
      if (!player && !overridePid) errors.push("Jugador no vinculado.");

      const exists = existingStages.has(String(stageId));
      const imported = importedThisSession.has(stageId);
      const defaultSelected =
        reviewStatus === "approved" &&
        !provisionalIdentity &&
        !reviewOnly &&
        !exists &&
        !imported &&
        errors.filter((e) => e !== "Jugador no vinculado.").length === 0;

      return {
        record,
        player,
        playerMethod,
        playerOverride: overridePid || "",
        team,
        teamOverride: overrideTid || "",
        suggestion,
        exists,
        imported,
        existingId: existingStages.get(String(stageId)) || null,
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
  }, [parsed, players, teams, resolvedTeamByKey, existingStages, importedThisSession, playerOverrides, teamOverrides, selected]);

  const stats = useMemo(() => {
    const detectedPlayers = new Set(
      rows.filter((r) => r.player).map((r) => String(r.player.id))
    ).size;
    const newStages = rows.filter((r) => !r.exists && !r.errors.length).length;
    const existingStages = rows.filter((r) => r.exists).length;
    const pending = rows.filter(
      (r) => r.reviewStatus === "pending" || r.provisionalIdentity
    ).length;
    const conflicts = rows.filter((r) => r.errors.length).length;
    return { detectedPlayers, newStages, existingStages, pending, conflicts };
  }, [rows]);

  const validRows = useMemo(
    () => rows.filter((r) => r.player && !r.errors.length && !r.exists),
    [rows]
  );

  const selectedRows = useMemo(
    () => rows.filter((r) => r.selected && r.player && !r.errors.length),
    [rows]
  );

  const handleFile = useCallback(async (file, error) => {
    setReport(null);
    setPendingAction(null);
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
    setClubResolutions({});
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
    } catch (err) {
      setParseError(`No se ha podido leer el archivo: ${err.message}`);
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

  // --- Acciones masivas ---

  const handleAutoLinkSafe = () => {
    const matched = clubGroups.filter(
      (g) => resolvedTeamByKey[g.key]?.status === "matched"
    );
    if (!matched.length) return;
    setPendingAction({
      type: "auto-link",
      groups: matched,
      summary: `Se vincularán ${matched.length} clubes por coincidencia exacta y se guardarán sus asociaciones en ClubLink para reutilizar en futuros lotes.`,
    });
  };

  const executeAutoLink = async () => {
    const groups = pendingAction.groups;
    setBusy(true);
    setProgress({ current: 0, total: groups.length, label: "Vinculando..." });
    const newResolutions = {};
    let saved = 0;
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      const res = resolvedTeamByKey[g.key];
      const team = res?.team;
      setProgress({
        current: i,
        total: groups.length,
        label: `Vinculando ${i + 1}/${groups.length}: ${g.club_name}`,
      });
      if (team) {
        newResolutions[g.key] = team.id;
        if (await persistClubLink(g.club_qid, team.id, g.club_name)) saved += 1;
      }
    }
    setClubResolutions((prev) => ({ ...prev, ...newResolutions }));
    await loadClubLinks();
    setProgress({
      current: groups.length,
      total: groups.length,
      label: `Vinculación completada · ${saved} asociaciones guardadas`,
    });
    setPendingAction(null);
    setBusy(false);
  };

  const handleCreateMissing = () => {
    const creatable = clubGroups.filter(
      (g) => resolvedTeamByKey[g.key]?.status === "creatable"
    );
    if (!creatable.length) return;
    setPendingAction({
      type: "create-clubs",
      groups: creatable,
      summary: `Se crearán ${creatable.length} clubes nuevos (incompletos, data_source "Other", is_complete false) y se guardarán sus asociaciones ClubLink. No se modifican clubes existentes.`,
    });
  };

  const executeCreateClubs = async () => {
    const groups = pendingAction.groups;
    setBusy(true);
    setProgress({ current: 0, total: groups.length, label: "Comprobando duplicados..." });
    // Segunda búsqueda completa contra Team y ClubLink para evitar duplicados
    // de clubes que ya existan pero no estuvieran en caché.
    const freshTeams = await fetchAllTeams();
    const freshLinks = await fetchClubLinksMap();
    const newResolutions = {};
    let created = 0;
    let linked = 0;
    let skipped = 0;
    const details = [];
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      setProgress({
        current: i,
        total: groups.length,
        label: `Procesando ${i + 1}/${groups.length}: ${g.club_name}`,
      });
      // Re-resolver contra la lista fresca antes de crear.
      const res = resolveClubGroup(g, { clubLinks: freshLinks, teams: freshTeams });
      if (res.team) {
        // Ya existe un equipo coincidente: no crear, vincular la asociación.
        newResolutions[g.key] = res.team.id;
        skipped += 1;
        if (g.club_qid) {
          await persistClubLink(g.club_qid, res.team.id, g.club_name);
        }
        continue;
      }
      if (res.status === "ambiguous") {
        // Ambiguo tras la segunda búsqueda: no crear para no duplicar.
        skipped += 1;
        continue;
      }
      try {
        const team = await base44.entities.Team.create({
          name: g.club_name,
          short_name: "",
          country_id: "",
          league_id: "",
          data_source: "Other",
          is_complete: false,
          is_active: true,
        });
        newResolutions[g.key] = team.id;
        created += 1;
        if (g.club_qid) {
          await base44.entities.ClubLink.create({
            club_qid: g.club_qid,
            team_id: team.id,
            club_name: g.club_name,
            confirmed: true,
          });
          linked += 1;
        }
      } catch (error) {
        details.push(`${g.club_name}: ${error?.message || "error"}`);
      }
    }
    setClubResolutions((prev) => ({ ...prev, ...newResolutions }));
    await queryClient.invalidateQueries({ queryKey: ["mf-legacy", "teams"] });
    setAllTeams(await fetchAllTeams());
    await loadClubLinks();
    setProgress({
      current: groups.length,
      total: groups.length,
      label: `Creación completada · ${created} creados · ${skipped} ya existían · ${linked} asociaciones`,
    });
    setPendingAction(null);
    setBusy(false);
    if (details.length)
      console.warn("Incidencias al crear clubes:", details);
  };

  const handleReanalyze = async () => {
    setBusy(true);
    setPendingAction(null);
    setProgress({ current: 0, total: 1, label: "Reanalizando clubes..." });
    await loadAllTeams();
    await loadClubLinks();
    setProgress({ current: 1, total: 1, label: "Reanálisis completado" });
    setBusy(false);
  };

  const handleSelectAllValid = () => {
    const next = new Set();
    for (const r of validRows) next.add(r.record.external_stage_id);
    setSelected(next);
  };

  const handleImportAllValid = () => {
    setPendingAction({
      type: "import-all",
      groups: [],
      summary: `Se importarán ${validRows.length} etapas válidas. Las etapas sin club asignado conservarán su nombre original sin team_id.`,
    });
  };

  const handleConfirmAction = async () => {
    if (!pendingAction) return;
    if (pendingAction.type === "auto-link") {
      await executeAutoLink();
    } else if (pendingAction.type === "create-clubs") {
      await executeCreateClubs();
    } else if (pendingAction.type === "import-all") {
      handleSelectAllValid();
      setPendingAction(null);
      // Importa en el siguiente tick, cuando `selected` ya tenga las válidas.
      setTimeout(() => runImport(validRows), 0);
    }
  };

  const runImport = async (rowsToImport) => {
    const source = rowsToImport || selectedRows;
    const target = source.filter(
      (r) => r.player && !r.errors.length && !r.exists
    );
    const skippedExisting = source.filter((r) => r.exists).length;
    if (!target.length || busy) return;
    setBusy(true);
    setReport(null);
    setProgress({ current: 0, total: target.length, label: "Iniciando..." });

    const result = {
      created: 0,
      updated: 0,
      skipped: skippedExisting,
      failed: 0,
      clubLinksSaved: 0,
      details: [],
    };
    const newClubLinks = [];
    const importedIds = [];

    for (let i = 0; i < target.length; i++) {
      const row = target[i];
      setProgress({
        current: i,
        total: target.length,
        label: `Importando ${i + 1}/${target.length}: ${row.player.name} · ${
          row.team?.name || row.record.club_name
        }`,
      });

      // Las etapas existentes se omiten (no se duplican ni se modifican).
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
        review_status: "approved",
        provisional_identity: Boolean(row.record.provisional_identity),
        manually_verified: true,
      };

      try {
        await base44.entities.PlayerCareer.create(payload);
        result.created += 1;
        importedIds.push(row.record.external_stage_id);

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
        console.warn("No se pudo guardar ClubLink:", link, error);
      }
    }

    await loadClubLinks();

    // Desmarcar las etapas importadas correctamente y marcarlas como
    // importadas para que no se vuelvan a seleccionar automáticamente.
    if (importedIds.length) {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const id of importedIds) {
          next.delete(id);
          next.delete(`__off__${id}`);
        }
        return next;
      });
      setImportedThisSession((prev) => {
        const next = new Set(prev);
        for (const id of importedIds) next.add(id);
        return next;
      });
    }

    // Refrescar etapas existentes para mostrarlas como Importada/Existente.
    await refreshExistingStages();

    setProgress({
      current: target.length,
      total: target.length,
      label: `Importación completada · ${result.created} creadas · ${result.skipped} omitidas · ${result.failed} errores`,
    });
    setReport(result);
    setBusy(false);
  };

  const handleImport = () => runImport(selectedRows);

  const handleReset = () => {
    setParsed(null);
    setFileName("");
    setParseError("");
    setPlayerOverrides({});
    setTeamOverrides({});
    setClubResolutions({});
    setSelected(new Set());
    setExistingStages(new Map());
    setImportedThisSession(new Set());
    setReport(null);
    setPendingAction(null);
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
    <div className="mf-page-scroll bg-[#E8E9EC] px-4 py-6 sm:px-6 sm:py-8 md:px-10">
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              Administración · MF LEGACY
            </p>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
              <History size={22} /> Importar historiales
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Sube lotes de Career Studio, resuelve clubes masivamente y confirma
              la importación. No se modifican datos de Player ni de clubes existentes.
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
                Los clubes se agrupan por <strong>club_qid</strong> de Wikidata y se
                resuelven masivamente. Las asociaciones confirmadas se guardan en
                ClubLink para reutilizarlas en futuros lotes.
              </p>
            </div>
          </div>
        )}

        {parsed && (
          <>
            <ClubResolutionPanel
              clubStats={clubStats}
              clubGroups={clubGroups}
              resolvedTeamByKey={resolvedTeamByKey}
              pendingAction={pendingAction}
              busy={busy}
              onAutoLinkSafe={handleAutoLinkSafe}
              onCreateMissing={handleCreateMissing}
              onSelectAllValid={handleSelectAllValid}
              onImportAllValid={handleImportAllValid}
              onReanalyze={handleReanalyze}
              onConfirmAction={handleConfirmAction}
              onCancelAction={() => setPendingAction(null)}
              validStageCount={validRows.length}
            />

            <div className="my-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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
                      (busy ? "Procesando..." : "Operación finalizada")}
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
                        <p className="uppercase text-emerald-700/70">Omitidas</p>
                        <p className="text-lg font-extrabold text-emerald-900">
                          {report.skipped || 0}
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
                Las etapas ya guardadas se omiten sin duplicarse.
              </p>
              <div className="flex flex-wrap gap-2">
                {report ? (
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                  >
                    <CheckCircle2 size={16} /> Finalizar y cerrar lote
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={busy}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                )}
                {report && selectedRows.length === 0 ? (
                  <button
                    type="button"
                    disabled
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-100 px-4 py-2.5 text-sm font-bold text-emerald-700"
                  >
                    <CheckCircle2 size={16} /> Importación finalizada
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleImport}
                    disabled={busy || selectedRows.length === 0}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#003399] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#002477] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Upload size={16} />
                    )}
                    {busy ? "Importando..." : "Confirmar importación"}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}