import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { usePlayersQuery } from "@/hooks/useSharedData";
import { buildSafeFmPatch, compatibleFmTarget, fmNameKey, suggestFmTarget } from "@/utils/fmSaveDirectImport.mjs";

export default function FmSaveDirectImportPanel({ payload, onClose }) {
  const source = payload?.source || {};
  const rows = payload?.players || [];
  const { data: players = [], isLoading, error: readError } = usePlayersQuery();
  const queryClient = useQueryClient();
  const [links, setLinks] = useState({});
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
    setConfirmed(false);
  }, [suggestions, isLoading, readError]);

  const byId = useMemo(() => new Map(players.map(player => [String(player.id), player])), [players]);
  const mapped = rows.map((record, index) => ({ record, index, target: byId.get(String(links[index] || "")) }))
    .filter(({ record, target }) => target && compatibleFmTarget(record, target, source.game));
  const targetIds = mapped.map(({ target }) => String(target.id));
  const duplicateTarget = new Set(targetIds).size !== targetIds.length;
  const approved = mapped.length > 0 && !duplicateTarget && confirmed && !busy && !readError && !isLoading;

  const handleImport = async () => {
    if (!approved) return;
    setBusy(true);
    setFailures([]);
    setFeedback("");
    setProgress({ done: 0, total: mapped.length });
    let saved = 0, unchanged = 0;
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
        setProgress({ done: index + 1, total: mapped.length });
      }
      await queryClient.invalidateQueries({ queryKey: ["mf-legacy", "players"] });
      setFeedback(`Resultado: ${saved} ficha(s) incorporadas; ${unchanged} ya tenían los datos; ${rows.length - mapped.length} pendientes sin vincular; ${failed.length} errores.`);
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
      Se guardará el registro original bajo <b>{source.game}</b> y se rellenarán CA/PA solo si están vacíos en esa versión.
      No se reemplazan CA/PA existentes, atributos, equipos, nombres, fotografías, estadísticas reales, roles ni revisiones manuales.
      Los ID de FM26 y FM27 son independientes. Solo se actualizan fichas ya existentes y vinculadas aquí.
    </div>
    {isLoading && <p className="mt-4 flex items-center gap-2 text-sm text-slate-600"><Loader2 size={16} className="animate-spin" /> Leyendo las fichas existentes de MF LEGACY...</p>}
    {readError && <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">No se pudo consultar el catálogo: {readError.message}</p>}
    {!isLoading && !readError && <>
      <div className="mt-4 flex flex-wrap gap-3 text-xs font-bold text-slate-600">
        <span className="rounded-full bg-green-50 px-3 py-1.5 text-green-800">{mapped.length} vinculados para revisar</span>
        <span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-800">{rows.length - mapped.length} pendientes</span>
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
                onClick={() => { setLinks(old => ({ ...old, [index]: String(option.id) })); setSearchTerms(old => { const next = { ...old }; delete next[index]; return next; }); setConfirmed(false); }}
                className="rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-[#003399] hover:bg-blue-100">
                {option.name}{option.date_of_birth ? ` · ${option.date_of_birth}` : ""}
              </button>)}
            </div>}
          </div>;
        })}
      </div>
      {duplicateTarget && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">Hay dos jugadores vinculados a la misma ficha. Corrige la selección antes de importar.</p>}
      <label className="mt-4 flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm font-semibold text-[#0d315b]">
        <input type="checkbox" className="mt-1" checked={confirmed} disabled={busy || !mapped.length || duplicateTarget}
          onChange={event => setConfirmed(event.target.checked)} />
        He revisado las coincidencias y confirmo incorporar únicamente los {mapped.length} jugadores vinculados. Los demás quedarán pendientes.
      </label>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" disabled={!approved} onClick={handleImport}
          className="inline-flex items-center gap-2 rounded-xl bg-[#003399] px-5 py-3 text-sm font-bold text-white hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
          {busy ? `Guardando ${progress.done}/${progress.total}...` : `Confirmar incorporación de ${mapped.length} jugador(es)`}
        </button>
        <span className="inline-flex items-center gap-1 text-xs text-slate-500"><ShieldCheck size={15}/> Sin crear jugadores nuevos ni sobrescribir datos editados</span>
      </div>
    </>}
    {feedback && <p role="status" className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{feedback}</p>}
    {!!failures.length && <div role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-xs text-rose-800">{failures.map((item, index) => <p key={index}>{item}</p>)}</div>}
  </section>;
}
