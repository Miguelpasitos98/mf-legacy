import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, ClipboardEdit, Loader2, ShieldAlert, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import HistoricalJsonImporter from "./HistoricalJsonImporter";
import {
  fifaEditionForSeason,
  formatEur,
  normalizeSeason,
  parseMarketValue,
  validateMarketValueDate,
} from "@/utils/historicalValuation";

const unpack = (v) => Array.isArray(v) ? v : v?.items || v?.data || [];
const text = (v) => String(v ?? "").trim();
const validSeason = (value) => {
  const s = normalizeSeason(value);
  if (/^\d{4}$/.test(s)) return true;
  const m = s.match(/^(\d{4})\/(\d{4})$/);
  return Boolean(m && Number(m[2]) === Number(m[1]) + 1);
};
const inputStyle = "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100";
const labelStyle = "block text-xs font-bold text-slate-700";
const cleanUrl = (value) => {
  const s = text(value);
  if (!s) return "";
  try {
    const u = new URL(s);
    if (!["https:", "http:"].includes(u.protocol)) return null;
    return u.href;
  } catch { return null; }
};

export default function HistoricalSingleEntryImporter({
  open, onClose, player, fotmobPlayerId, fm26Uid, onSaved,
  stats = [], teams = [], initialSeason = "",
}) {
  const playerId = text(player?.id || stats.find((r) => r?.player_id)?.player_id);
  const playerName = player?.name || stats.find((r) => r?.player_name)?.player_name || "Jugador";
  const seasons = useMemo(() =>
    [...new Set(stats.map((r) => text(r.season)).filter(Boolean))].sort().reverse(),
    [stats]
  );
  const [entryMode, setEntryMode] = useState("json");
  const [jsonSaving, setJsonSaving] = useState(false);
  const [mode, setMode] = useState("fifa");
  const [season, setSeason] = useState("");
  const [existing, setExisting] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [overall, setOverall] = useState("");
  const [edition, setEdition] = useState("");
  const [fifaUrl, setFifaUrl] = useState("");
  const [market, setMarket] = useState("");
  const [marketDate, setMarketDate] = useState("");
  const [marketStatus, setMarketStatus] = useState("");
  const [marketUrl, setMarketUrl] = useState("");
  const [selectedTeamKey, setSelectedTeamKey] = useState("");
  const [teamCurrent, setTeamCurrent] = useState(null);
  const [matches, setMatches] = useState("");
  const [teamSource, setTeamSource] = useState("");
  const [teamLoading, setTeamLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const preferred = initialSeason !== "Todas" && initialSeason !== "auto" && validSeason(initialSeason)
      ? normalizeSeason(initialSeason) : "";
    setSeason(preferred || seasons[0] || "");
    setEntryMode("json");
    setMode("fifa");
    setError(""); setNotice("");
  }, [open, initialSeason, seasons]);

  const loadExisting = useCallback(async () => {
    if (!playerId) { setExisting([]); return; }
    setLoading(true);
    try {
      const result = await base44.entities.PlayerHistoricalValuation.filter(
        { player_id: playerId }, { limit: 250 }
      );
      setExisting(unpack(result));
    } catch (err) {
      setError("No se pudieron cargar las valoraciones: " + (err?.message || "error"));
    } finally { setLoading(false); }
  }, [playerId]);

  useEffect(() => { if (open) loadExisting(); }, [open, loadExisting]);

  const normalizedSeason = normalizeSeason(season);
  const valuation = existing.find((r) => text(r.season) === normalizedSeason) || null;
  useEffect(() => {
    setOverall(valuation?.fifa_fc_overall == null ? "" : String(valuation.fifa_fc_overall));
    setEdition(valuation?.fifa_edition || fifaEditionForSeason(normalizedSeason));
    setFifaUrl(valuation?.fifa_source_url || "");
    setMarket(valuation?.transfermarkt_value_eur == null ? "" : String(valuation.transfermarkt_value_eur));
    setMarketDate(valuation?.market_value_as_of || "");
    setMarketStatus(valuation?.market_value_status || "");
    setMarketUrl(valuation?.transfermarkt_source_url || "");
  }, [normalizedSeason, valuation?.id, valuation?.updated_date, valuation?.fifa_fc_overall, valuation?.transfermarkt_value_eur]);

  const teamRows = useMemo(() => {
    const teamById = new Map(teams.map((t) => [text(t.id), t]));
    const map = new Map();
    for (const r of stats) {
      if (!r?.season || !r?.competition) continue;
      const t = teamById.get(text(r.team_id));
      const teamId = text(r.team_id || t?.id);
      const fotmobId = text(r.fotmob_team_id || t?.fotmob_id);
      const key = [text(r.season), text(r.competition), teamId, fotmobId, text(r.team_name)].join("|");
      if (!map.has(key)) {
        map.set(key, {
          key, season: text(r.season), competition: text(r.competition),
          team_id: teamId, fotmob_team_id: fotmobId,
          team_name: t?.name || r.team_name || "Club pendiente de vincular",
          fotmob_tournament_id: text(r.fotmob_tournament_id),
        });
      }
    }
    return [...map.values()].sort((a, b) =>
      b.season.localeCompare(a.season) ||
      a.team_name.localeCompare(b.team_name) ||
      a.competition.localeCompare(b.competition)
    );
  }, [stats, teams]);

  const teamsInSeason = useMemo(() => teamRows.filter((r) => r.season === normalizedSeason), [teamRows, normalizedSeason]);
  const selectedTeam = teamsInSeason.find((r) => r.key === selectedTeamKey) || teamsInSeason[0] || null;
  useEffect(() => { setSelectedTeamKey(""); }, [normalizedSeason]);

  useEffect(() => {
    if (!open || mode !== "team" || !selectedTeam?.key) return;
    let cancelled = false;
    setTeamLoading(true);
    setTeamCurrent(null); setMatches(""); setTeamSource("");
    (async () => {
      try {
        const filter = selectedTeam.team_id
          ? { team_id: selectedTeam.team_id, season: selectedTeam.season, competition: selectedTeam.competition }
          : { fotmob_team_id: selectedTeam.fotmob_team_id, season: selectedTeam.season, competition: selectedTeam.competition };
        if (!selectedTeam.team_id && !selectedTeam.fotmob_team_id) return;
        const rows = unpack(await base44.entities.TeamSeasonMatches.filter(filter, { limit: 5 }));
        if (cancelled) return;
        if (rows.length > 1) { setError("Hay registros duplicados de PJ Equipo para este club y competición. Revísalos antes de editar."); return; }
        const found = rows[0] || null;
        setTeamCurrent(found);
        setMatches(found?.team_matches == null ? "" : String(found.team_matches));
        setTeamSource(found?.source || "");
      } catch (err) {
        if (!cancelled) setError("No se pudieron consultar los PJ del club: " + (err?.message || "error"));
      } finally { if (!cancelled) setTeamLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [open, mode, selectedTeam?.key]);

  useEffect(() => { setError(""); setNotice(""); }, [mode, normalizedSeason, selectedTeam?.key]);

  const save = async (event) => {
    event.preventDefault();
    if (saving) return;
    setError(""); setNotice("");
    if (!validSeason(season)) { setError("Introduce una temporada válida: 2018 o 2022/2023."); return; }

    let payload;
    let key;
    if (mode === "team") {
      if (!selectedTeam || (!selectedTeam.team_id && !selectedTeam.fotmob_team_id)) {
        setError("Asigna primero un club a esta competición en la ficha estadística."); return;
      }
      const n = Number(text(matches));
      if (!text(matches) || !Number.isInteger(n) || n < 1 || n > 200) {
        setError("PJ Equipo debe ser un número entero entre 1 y 200."); return;
      }
      payload = {
        team_id: selectedTeam.team_id,
        fotmob_team_id: selectedTeam.fotmob_team_id,
        team_name: selectedTeam.team_name,
        season: selectedTeam.season,
        competition: selectedTeam.competition,
        fotmob_tournament_id: selectedTeam.fotmob_tournament_id,
        team_matches: n,
        source: text(teamSource) || "Introducción manual",
        verification_status: "pending",
      };
      key = "PJ Equipo";
    } else {
      if (!playerId) { setError("El jugador no tiene ID de Base44. Vincúlalo primero para evitar atribuciones incorrectas."); return; }
      if (mode === "fifa") {
        if (!/^\d{1,2}$/.test(text(overall)) || +overall < 1 || +overall > 99) {
          setError("Introduce un Overall entero entre 1 y 99."); return;
        }
        const sourceUrl = cleanUrl(fifaUrl);
        if (sourceUrl === null) { setError("La URL de FIFA/FC no es válida."); return; }
        payload = { fifa_fc_overall: +overall, fifa_edition: text(edition) || fifaEditionForSeason(normalizedSeason) };
        if (sourceUrl) payload.fifa_source_url = sourceUrl;
        key = "Overall FIFA/FC";
      } else {
        const amount = parseMarketValue(market);
        if (amount === null || amount === "invalid" || !Number.isSafeInteger(amount)) {
          setError("Introduce un valor válido en euros (por ejemplo, 180000000 o 180 M€)."); return;
        }
        const invalidDate = validateMarketValueDate(marketDate, normalizedSeason);
        if (invalidDate) { setError(invalidDate); return; }
        const sourceUrl = cleanUrl(marketUrl);
        if (sourceUrl === null) { setError("La URL de Transfermarkt no es válida."); return; }
        payload = { transfermarkt_value_eur: amount };
        if (marketDate) payload.market_value_as_of = marketDate;
        if (marketStatus) payload.market_value_status = marketStatus;
        if (sourceUrl) payload.transfermarkt_source_url = sourceUrl;
        key = "Valor Transfermarkt";
      }
    }

    setSaving(true);
    try {
      if (mode === "team") {
        const filter = selectedTeam.team_id
          ? { team_id: selectedTeam.team_id, season: selectedTeam.season, competition: selectedTeam.competition }
          : { fotmob_team_id: selectedTeam.fotmob_team_id, season: selectedTeam.season, competition: selectedTeam.competition };
        const records = unpack(await base44.entities.TeamSeasonMatches.filter(filter, { limit: 5 }));
        if (records.length > 1) throw Error("Hay registros duplicados. No se ha cambiado ninguno.");
        const previous = records[0];
        if (previous && Number(previous.team_matches) === payload.team_matches &&
            text(previous.source) === payload.source) {
          setNotice("Este dato ya estaba guardado; no se ha creado ningún duplicado.");
        } else if (previous) {
          await base44.entities.TeamSeasonMatches.update(previous.id, {
            team_matches: payload.team_matches, source: payload.source,
            verification_status: "pending",
          });
          setNotice("PJ Equipo actualizado correctamente para todo el club.");
        } else {
          await base44.entities.TeamSeasonMatches.create(payload);
          setNotice("PJ Equipo guardado para el club, temporada y competición.");
        }
        setTeamCurrent({ ...previous, ...payload });
      } else {
        const records = unpack(await base44.entities.PlayerHistoricalValuation.filter(
          { player_id: playerId, season: normalizedSeason }, { limit: 5 }
        ));
        if (records.length > 1) throw Error("Existen valoraciones duplicadas de esta temporada. Corrige el conflicto antes de guardar.");
        const previous = records[0];
        const changed = !previous || Object.entries(payload).some(([k, v]) => text(previous[k]) !== text(v));
        if (!changed) {
          setNotice(key + " ya estaba guardado; no se ha creado ningún duplicado.");
        } else if (previous) {
          await base44.entities.PlayerHistoricalValuation.update(previous.id, { ...payload, verification_status: "pending" });
          setNotice(key + " actualizado para " + normalizedSeason + ".");
        } else {
          await base44.entities.PlayerHistoricalValuation.create({
            player_id: playerId, fotmob_player_id: text(fotmobPlayerId),
            fm26_uid: text(fm26Uid), season: normalizedSeason,
            ...payload, verification_status: "pending",
          });
          setNotice(key + " guardado para " + normalizedSeason + ".");
        }
        await loadExisting();
      }
      onSaved?.();
    } catch (err) {
      setError("No se ha podido guardar: " + (err?.message || "error de permisos o conexión"));
    } finally { setSaving(false); }
  };

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-slate-950/75 p-3 backdrop-blur-sm"
      role="dialog" aria-modal="true" aria-label="Introducir datos históricos"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !saving && !jsonSaving) onClose(); }}>
      <div className={"flex max-h-[94vh] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl " + (entryMode === "json" ? "max-w-3xl" : "max-w-xl")}>
        <header className="flex shrink-0 items-start justify-between gap-3 bg-[#0e2844] px-5 py-4 text-white">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-200">MF LEGACY · Importación histórica</p>
            <h2 className="mt-1 text-lg font-black">Introducir datos históricos</h2>
            <p className="mt-1 text-xs text-blue-200">{playerName}{fotmobPlayerId ? " · FotMob " + fotmobPlayerId : ""}</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving || jsonSaving} aria-label="Cerrar" className="rounded-lg p-2 hover:bg-white/10"><X size={19}/></button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
            <button type="button" disabled={jsonSaving} onClick={() => setEntryMode("json")} className={"rounded-lg px-3 py-2.5 text-xs font-bold " + (entryMode === "json" ? "bg-[#003399] text-white" : "text-slate-700 hover:bg-white")}>Pegar JSON completo</button>
            <button type="button" disabled={jsonSaving} onClick={() => setEntryMode("manual")} className={"rounded-lg px-3 py-2.5 text-xs font-bold " + (entryMode === "manual" ? "bg-[#003399] text-white" : "text-slate-700 hover:bg-white")}>Introducir uno a uno</button>
          </div>
          {entryMode === "json" ? <HistoricalJsonImporter player={player} fotmobPlayerId={fotmobPlayerId} stats={stats} teams={teams} onSaved={onSaved} onBusyChange={setJsonSaving}/> : <>
          <p className="mb-4 text-sm text-slate-600">Selecciona qué dato quieres añadir o corregir. Cada guardado afecta a <strong>un único dato</strong>, nunca a un lote.</p>
          <div className="mb-4 grid grid-cols-3 gap-2" role="tablist" aria-label="Tipo de dato">
            {[
              ["fifa", "FIFA / FC"],
              ["market", "Transfermarkt"],
              ["team", "PJ Equipo"],
            ].map(([id, name]) =>
              <button key={id} type="button" role="tab" aria-selected={mode === id} onClick={() => setMode(id)}
                className={"rounded-lg border px-2 py-3 text-xs font-bold transition-colors " +
                  (mode === id ? "border-[#003399] bg-[#003399] text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-blue-50")}>{name}</button>
            )}
          </div>
          <form onSubmit={save} className="space-y-4">
            <label className={labelStyle}>Temporada
              <input list="mf-historical-seasons" value={season} onChange={(e) => setSeason(e.target.value)}
                placeholder="2022/2023 o 2018" className={inputStyle} required disabled={saving}/>
              <datalist id="mf-historical-seasons">{seasons.map((s) => <option key={s} value={s}/>)}</datalist>
              <span className="mt-1 block text-[11px] font-normal text-slate-500">Puedes elegir una temporada existente o escribirla. No se mezclan años naturales y campañas partidas.</span>
            </label>

            {mode === "fifa" && <>
              <label className={labelStyle}>Overall de lanzamiento (1–99)
                <input type="number" min="1" max="99" step="1" value={overall} onChange={(e) => setOverall(e.target.value)}
                  className={inputStyle} placeholder="Por ejemplo, 88" disabled={saving} required/>
              </label>
              <label className={labelStyle}>Edición del videojuego
                <input value={edition} onChange={(e) => setEdition(e.target.value)} className={inputStyle}
                  placeholder="FIFA 23 o FC 26" disabled={saving}/>
                <span className="mt-1 block text-[11px] font-normal text-slate-500">Para años naturales, comprueba manualmente la edición.</span>
              </label>
              <label className={labelStyle}>Enlace de fuente (opcional)
                <input type="url" value={fifaUrl} onChange={(e) => setFifaUrl(e.target.value)} className={inputStyle} placeholder="https://sofifa.com/..." disabled={saving}/>
              </label>
            </>}
            {mode === "market" && <>
              <label className={labelStyle}>Valor de mercado (€)
                <input value={market} onChange={(e) => setMarket(e.target.value)} className={inputStyle}
                  placeholder="180000000 o 180 M€" disabled={saving} required/>
                {parseMarketValue(market) !== null && parseMarketValue(market) !== "invalid" &&
                  <span className="mt-1 block text-xs font-semibold text-[#003399]">{formatEur(parseMarketValue(market))}</span>}
              </label>
              <label className={labelStyle}>Fecha del valor (opcional)
                <input type="date" value={marketDate} onChange={(e) => setMarketDate(e.target.value)} className={inputStyle} disabled={saving}/>
              </label>
              <label className={labelStyle}>Estado de temporada
                <select value={marketStatus} onChange={(e) => setMarketStatus(e.target.value)} className={inputStyle} disabled={saving}>
                  <option value="">Sin especificar</option>
                  <option value="definitivo">Cierre definitivo</option>
                  <option value="provisional">Provisional (temporada en curso)</option>
                </select>
              </label>
              <label className={labelStyle}>Enlace de Transfermarkt (opcional)
                <input type="url" value={marketUrl} onChange={(e) => setMarketUrl(e.target.value)} className={inputStyle} placeholder="https://www.transfermarkt..." disabled={saving}/>
              </label>
            </>}
            {mode === "team" && <>
              {teamsInSeason.length ? <>
                <label className={labelStyle}>Club y competición
                  <select value={selectedTeam?.key || ""} onChange={(e) => setSelectedTeamKey(e.target.value)} className={inputStyle} disabled={saving}>
                    {teamsInSeason.map((r) =>
                      <option key={r.key} value={r.key}>{r.team_name + " · " + r.competition}</option>)}
                  </select>
                  <span className="mt-1 block text-[11px] font-normal text-slate-500">Vinculado a la competición real del jugador, reutilizable para el resto del equipo.</span>
                </label>
                {!selectedTeam?.team_id && !selectedTeam?.fotmob_team_id &&
                  <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                    <ShieldAlert size={15} className="mr-1 inline"/> Esta competición no tiene club identificado. Vincula el club en la ficha antes de guardar.
                  </p>}
                <label className={labelStyle}>Partidos disputados por el equipo
                  <input type="number" min="1" max="200" step="1" value={matches} onChange={(e) => setMatches(e.target.value)}
                    placeholder="Ejemplo: 38" required className={inputStyle} disabled={saving || teamLoading}/>
                </label>
                <label className={labelStyle}>Fuente (opcional)
                  <input value={teamSource} onChange={(e) => setTeamSource(e.target.value)} className={inputStyle}
                    placeholder="Investigación histórica" disabled={saving || teamLoading}/>
                </label>
                <p className="rounded-lg bg-blue-50 p-3 text-xs text-blue-900">PJ Equipo es el total real de partidos del <strong>club</strong> en esta competición, no los partidos del jugador.</p>
              </> : <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">No hay competiciones de este jugador en la temporada elegida. Selecciona otra temporada o importa primero sus estadísticas.</p>}
            </>}

            {mode !== "team" && valuation &&
              <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                Ya guardado en {normalizedSeason}: FIFA/FC <strong>{valuation.fifa_fc_overall ?? "—"}</strong>
                {" · "}Transfermarkt <strong>{formatEur(valuation.transfermarkt_value_eur)}</strong>.
                Guardar aquí no modificará el otro indicador.
              </p>}
            {mode === "team" && teamCurrent &&
              <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-700">Dato del club ya guardado: <strong>{teamCurrent.team_matches} partidos</strong>.</p>}
            {loading || teamLoading ? <p role="status" className="text-xs text-slate-500"><Loader2 size={14} className="mr-1 inline animate-spin"/> Consultando datos existentes…</p> : null}
            {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800">{error}</p>}
            {notice && <p role="status" className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800"><CheckCircle2 size={16} className="shrink-0"/>{notice}</p>}
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4">
              <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700">Cerrar</button>
              <button type="submit" disabled={saving || loading || (mode === "team" && (teamLoading || !selectedTeam || (!selectedTeam.team_id && !selectedTeam.fotmob_team_id)))}
                className="inline-flex items-center gap-2 rounded-lg bg-[#003399] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#002777] disabled:cursor-not-allowed disabled:opacity-40">
                {saving ? <Loader2 size={16} className="animate-spin"/> : <ClipboardEdit size={16}/>}
                {saving ? "Guardando…" : mode === "fifa" ? "Guardar Overall" : mode === "market" ? "Guardar valor" : "Guardar PJ Equipo"}
              </button>
            </div>
          </form>
          </>}
        </div>
      </div>
    </div>,
    document.body
  );
}
