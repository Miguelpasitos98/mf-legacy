import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { usePlayersQuery, useTeamsQuery, useCountriesQuery } from "@/hooks/useSharedData";
import { buildSafeFmPatch, buildNewFmPlayer, canCreateFmPlayer, compatibleFmTarget, fmNameKey, suggestFmTarget } from "@/utils/fmSaveDirectImport.mjs";

const responseRows = result => Array.isArray(result) ? result : result?.items || result?.data || result?.results || null;

export default function FmSaveDirectImportPanel({ payload, onClose }) {
  const source = payload?.source || {};
  const rows = payload?.players || [];
  const { data: players = [], isLoading, error: readError } = usePlayersQuery();
  const { data: teams = [], isLoading: teamsLoading, error: teamsError } = useTeamsQuery();
  const { data: countries = [], isLoading: countriesLoading, error: countriesError } = useCountriesQuery();
  const queryClient = useQueryClient();
  const [links, setLinks] = useState({});
  const [createSelections, setCreateSelections] = useState({});
  const [teamChoices, setTeamChoices] = useState({});
  const [countryChoices, setCountryChoices] = useState({});
  const [searchTerms, setSearchTerms] = useState({});
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [feedback, setFeedback] = useState("");
  const [failures, setFailures] = useState([]);

  const suggestions = useMemo(() => rows.map(row => suggestFmTarget(row, players, source.game)), [rows, players, source.game]);
  useEffect(() => {
    if (isLoading || readError) return;
    const preselected = {};
    suggestions.forEach((candidate, index) => {
      if (candidate.match) preselected[index] = String(candidate.match.id);
    });
    setLinks(preselected);
    setCreateSelections({});
    setConfirmed(false);
  }, [suggestions, isLoading, readError]);

  const byId = useMemo(() => new Map(players.map(player => [String(player.id), player])), [players]);
  const mapped = rows.map((record, index) => ({ record, index, target: byId.get(String(links[index] || "")) }))
    .filter(({ record, target }) => target && compatibleFmTarget(record, target, source.game));
  const targetIds = mapped.map(({ target }) => String(target.id));
  const duplicateTarget = new Set(targetIds).size !== targetIds.length;
  const newRows = rows.map((record, index) => ({ record, index }))
    .filter(({ record, index }) => createSelections[index] && !links[index] && canCreateFmPlayer({ source, record, players }).allowed);
  const creationNames = newRows.map(({ record }) => fmNameKey(record.name));
  const creationIds = newRows.map(({ record }) => String(record.uid));
  const duplicateCreation = new Set(creationNames).size !== creationNames.length || new Set(creationIds).size !== creationIds.length;
  const selectedTotal = mapped.length + newRows.length;
  const reviewing = isLoading || teamsLoading || countriesLoading;
  const approved = selectedTotal > 0 && !duplicateTarget && !duplicateCreation && confirmed && !busy &&
    !readError && !teamsError && !countriesError && !reviewing;

  const handleImport = async () => {
    if (!approved) return;
    setBusy(true);
    setFailures([]);
    setFeedback("");
    setProgress({ done: 0, total: selectedTotal });
    let saved = 0, unchanged = 0, created = 0;
    const failed = [];
    try {
      for (let index = 0; index < mapped.length; index++) {
        const { record, target } = mapped[index];
        try {
          // Fresh read prevents a stale review from replacing values edited in another tab.
          const fresh = await base44.entities.Player.get(String(target.id));
          const patch = buildSafeFmPatch({ source, record, target: fresh });
          if (Object.keys(patch).length) {
            await base44.entities.Player.update(String(fresh.id), patch);
            saved++;
          } else unchanged++;
        } catch (err) {
          failed.push(`${record.name}: ${err.message || "Error al guardar"}`);
        }
        setProgress({ done: index + 1, total: selectedTotal });
      }
      for (let index = 0; index < newRows.length; index++) {
        const { record, index: rowIndex } = newRows[index];
        try {
          const safe = canCreateFmPlayer({ source, record, players });
          if (!safe.allowed) throw Error(safe.reason);
          // Recheck server state immediately before each create. Fail closed on incomplete results.
          const editionField = source.game === "FM27" ? "fm27_uid" : "fm26_uid";
          const results = await Promise.all([
            base44.entities.Player.filter({ [editionField]: String(record.uid) }, undefined, 10),
            base44.entities.Player.filter({ name: record.name }, undefined, 10),
          ]);
          const remote = results.map(responseRows);
          if (remote.some(result => !Array.isArray(result))) throw Error("No se pudo verificar el catálogo de duplicados.");
          if (remote.some(result => result.length)) throw Error("La ficha ya existe o se creó en otra sesión. Revisa antes de importar.");
          const teamId = teamChoices[rowIndex] || "";
          const countryId = countryChoices[rowIndex] || "";
          if (teamId && !teams.some(item => String(item.id) === String(teamId))) throw Error("Equipo de destino no válido.");
          if (countryId && !countries.some(item => String(item.id) === String(countryId))) throw Error("País de destino no válido.");
          const data = buildNewFmPlayer({ source, record, teamId, countryId });
          await base44.entities.Player.create(data);
          created++;
        } catch (err) {
          failed.push(`${record.name}: ${err.message || "Error al crear"}`);
        }
        setProgress({ done: mapped.length + index + 1, total: selectedTotal });
      }
      await queryClient.invalidateQueries({ queryKey: ["mf-legacy", "players"] });
      setFeedback(`Resultado: ${created} fichas nuevas; ${saved} existentes actualizadas; ${unchanged} sin cambios; ${rows.length - selectedTotal} pendientes; ${failed.length} errores.`);
      setFailures(failed.slice(0, 8));
      setConfirmed(false);
    } catch (err) {
      setFailures([err.message || "No se pudo completar la importación."]);
    } finally {
      setBusy(false);
    }
  };

  return <section id="fm-direct-import-review" className="mt-5 rounded-2xl border-2 border-[#003399] bg-white p-4 shadow-sm md:p-5">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-xs font-black uppercase tracking-wider text-[#003399]">Importación directa · Revisión obligatoria</p>
        <h3 className="mt-1 text-lg font-black text-slate-900">Incorporar {source.game || "FM"} a MF LEGACY</h3>
        <p className="text-sm text-slate-600">{rows.length} jugador(es) seleccionados · Build {source.game_build || "sin confirmar"} · No necesitas descargar ningún JSON.</p>
      </div>
      <button type="button" disabled={busy} onClick={onClose} aria-label="Cerrar revisión" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={19}/></button>
    </div>
    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
      Puedes actualizar fichas existentes o crear jugadores nuevos después de confirmarlo. Los registros se guardan bajo <b>{source.game}</b>.
      No se sustituyen CA/PA, atributos, roles, equipos, fotografías ni estadísticas de fichas existentes.
      Los ID de FM26 y FM27 son independientes. Los jugadores nuevos pueden quedar sin equipo o país vinculados cuando no exista una equivalencia segura.
    </div>
    {reviewing && <p className="mt-4 flex items-center gap-2 text-sm text-slate-600"><Loader2 size={16} className="animate-spin" /> Leyendo jugadores, equipos y países de MF LEGACY...</p>}
    {(readError || teamsError || countriesError) && <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">No se pudo consultar el catálogo: {(readError || teamsError || countriesError).message}</p>}
    {!reviewing && !readError && !teamsError && !countriesError && <>
      <div className="mt-4 flex flex-wrap gap-3 text-xs font-bold text-slate-600">
        <span className="rounded-full bg-green-50 px-3 py-1.5 text-green-800">{mapped.length} vinculados para actualizar</span>
        <span className="rounded-full bg-blue-50 px-3 py-1.5 text-[#003399]">{newRows.length} nuevas fichas preparadas</span>
        <span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-800">{rows.length - selectedTotal} pendientes</span>
        <span className="rounded-full bg-slate-100 px-3 py-1.5">{players.length} fichas existentes</span>
      </div>
      <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
        {rows.map((record, index) => {
          const selected = byId.get(String(links[index] || ""));
          const linked = selected && compatibleFmTarget(record, selected, source.game);
          const search = searchTerms[index] === undefined ? record.name : searchTerms[index];
          const options = search?.trim().length >= 2
            ? players.filter(p => fmNameKey(p.name).includes(fmNameKey(search)) && compatibleFmTarget(record, p, source.game)).slice(0, 8)
            : [];
          return <div key={`${record.uid}-${index}`} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0"><b className="text-sm text-slate-900">{record.name}</b><span className="ml-2 text-[11px] text-slate-500">UID {String(record.uid || "—")}</span>
                <p className="text-xs text-slate-500">{record.club_name || "Sin club"} · CA {record.ability?.current ?? "—"} · PA {record.ability?.potential ?? "—"}</p>
              </div>
              {linked ? <span className="text-xs font-bold text-emerald-700">✓ {selected.name}</span>
                : <span className="text-xs font-bold text-amber-700">{suggestions[index]?.status === "conflict" ? "Conflicto de identidad" : "Sin vincular"}</span>}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input type="search" disabled={busy} value={search || ""} placeholder="Buscar ficha de destino..."
                onChange={event => setSearchTerms(old => ({ ...old, [index]: event.target.value }))}
                className="min-w-[190px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#003399]" />
              {linked && <button type="button" disabled={busy} onClick={() => { setLinks(old => ({ ...old, [index]: "" })); setConfirmed(false); }}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Desvincular</button>}
            </div>
            {(!linked || searchTerms[index] !== undefined) && options.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">
              {options.map(option => <button key={option.id} type="button" disabled={busy}
                onClick={() => { setLinks(old => ({ ...old, [index]: String(option.id) })); setCreateSelections(old => ({ ...old, [index]: false })); setSearchTerms(old => { const next = { ...old }; delete next[index]; return next; }); setConfirmed(false); }}
                className="rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-[#003399] hover:bg-blue-100">
                {option.name}{option.date_of_birth ? ` · ${option.date_of_birth}` : ""}
              </button>)}
            </div>}
            {!linked && (() => {
              const allowed = canCreateFmPlayer({ source, record, players });
              if (!allowed.allowed) return <p className="mt-2 text-xs text-amber-800">{allowed.reason}</p>;
              const selectedForCreation = Boolean(createSelections[index]);
              const teamMatches = teams.filter(team => fmNameKey(team.name) === fmNameKey(record.club_name));
              const countryMatches = source.game === "FM26"
                ? countries.filter(country => String(country.fm_nation_id ?? "") !== "" && String(country.fm_nation_id) === String(record.nation_id ?? ""))
                : [];
              return <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50/40 p-3">
                <label className="flex items-center gap-2 text-xs font-bold text-[#003399]">
                  <input type="checkbox" checked={selectedForCreation} disabled={busy} onChange={event => {
                    setCreateSelections(old => ({ ...old, [index]: event.target.checked }));
                    setConfirmed(false);
                  }} />
                  Crear nueva ficha de {record.name} desde {source.game}
                </label>
                {selectedForCreation && <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Equipo de destino (opcional)</label>
                    <select disabled={busy} value={teamChoices[index] || ""} onChange={event => { setTeamChoices(old => ({ ...old, [index]: event.target.value })); setConfirmed(false); }}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs">
                      <option value="">Dejar equipo pendiente</option>
                      {teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
                    </select>
                    {teamMatches.length === 1 && !teamChoices[index] && <button type="button" disabled={busy}
                      onClick={() => { setTeamChoices(old => ({ ...old, [index]: String(teamMatches[0].id) })); setConfirmed(false); }}
                      className="mt-1 text-left text-[11px] font-semibold text-[#003399] underline">Vincular equipo con «{teamMatches[0].name}»</button>}
                    <p className="mt-1 text-[11px] text-slate-500">En la partida: {record.club_name || "Sin club"}.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">País de destino (opcional)</label>
                    <select disabled={busy} value={countryChoices[index] || ""} onChange={event => { setCountryChoices(old => ({ ...old, [index]: event.target.value })); setConfirmed(false); }}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs">
                      <option value="">Dejar país pendiente</option>
                      {countries.map(country => <option key={country.id} value={country.id}>{country.name}</option>)}
                    </select>
                    {countryMatches.length === 1 && !countryChoices[index] && <button type="button" disabled={busy}
                      onClick={() => { setCountryChoices(old => ({ ...old, [index]: String(countryMatches[0].id) })); setConfirmed(false); }}
                      className="mt-1 text-left text-[11px] font-semibold text-[#003399] underline">Vincular país con «{countryMatches[0].name}»</button>}
                    <p className="mt-1 text-[11px] text-slate-500">ID de país original: {String(record.nation_id ?? "No disponible")}. No se adivina la nacionalidad de FM27.</p>
                  </div>
                  <p className="sm:col-span-2 text-[11px] text-slate-600">Se conservarán nombre, datos básicos, CA/PA de su edición y registro fmsave completo. Los vínculos que dejes vacíos podrán completarse después.</p>
                </div>}
              </div>;
            })()}
          </div>;
        })}
      </div>
      {duplicateTarget && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">Hay dos jugadores vinculados a la misma ficha. Corrige la selección antes de importar.</p>}
      {duplicateCreation && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">Dos nuevos jugadores de la selección comparten nombre o UID. Resuelve el conflicto antes de crear fichas.</p>}
      <label className="mt-4 flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm font-semibold text-[#0d315b]">
        <input type="checkbox" className="mt-1" checked={confirmed} disabled={busy || !selectedTotal || duplicateTarget || duplicateCreation}
          onChange={event => setConfirmed(event.target.checked)} />
        He revisado los destinos y confirmo actualizar {mapped.length} ficha(s) y crear {newRows.length} jugador(es) nuevos. Los demás quedarán pendientes.
      </label>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" disabled={!approved} onClick={handleImport}
          className="inline-flex items-center gap-2 rounded-xl bg-[#003399] px-5 py-3 text-sm font-bold text-white hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
          {busy ? `Guardando ${progress.done}/${progress.total}...` : `Confirmar ${mapped.length} actualización(es) y ${newRows.length} creación(es)`}
        </button>
        <span className="inline-flex items-center gap-1 text-xs text-slate-500"><ShieldCheck size={15}/> Sin duplicados ni sobrescrituras de fichas existentes</span>
      </div>
    </>}
    {feedback && <p role="status" className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{feedback}</p>}
    {!!failures.length && <div role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-xs text-rose-800">{failures.map((item, index) => <p key={index}>{item}</p>)}</div>}
  </section>;
}
