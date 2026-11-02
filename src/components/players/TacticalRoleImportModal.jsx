import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, FileJson, Loader2, Upload, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { RECORD_KEYS } from "@/api/recordQueries";
import { fetchTacticalRolePlayers } from "@/utils/fetchTacticalRolePlayers.mjs";
import { PLAYER_DESCRIPTIONS } from "@/components/players/playerFormShared";
import { buildTacticalRoleImportPlan, canAutoCloseTacticalRoleImport, parseTacticalRoleImport, tacticalRolePatch } from "@/utils/tacticalRoleImport.mjs";

const allowedRoles = PLAYER_DESCRIPTIONS.flatMap(group => group.options);
const labelByStatus = {
  ready: "Listo para importar", unchanged: "Sin cambios", protected: "Ya tiene roles",
  unmatched: "Sin vincular", ambiguous: "ID duplicado en Base44", invalid: "Revisar JSON",
};
const badgeByStatus = {
  ready: "bg-emerald-100 text-emerald-800", unchanged: "bg-slate-100 text-slate-600",
  protected: "bg-amber-100 text-amber-800", unmatched: "bg-amber-100 text-amber-800",
  ambiguous: "bg-rose-100 text-rose-800", invalid: "bg-rose-100 text-rose-800",
};
const sourceUid = item => String(item.id || "");
const snapshotSignature = rows => JSON.stringify(rows.map(item => [
  item.index, item.status, item.player?.id || item.player?._id || "",
  item.player?.description || "", item.player?.tactical_roles || [], item.roles,
]));
const problem = error => error?.response?.data?.message || error?.message || "Error desconocido";
const count = (rows, status) => rows.filter(row => row.status === status).length;

export default function TacticalRoleImportModal({ open, onClose, onCompleted }) {
  const cache = useQueryClient();
  const activeRef = useRef(false);
  const readSequence = useRef(0);
  const [parsed, setParsed] = useState(null);
  const [filename, setFilename] = useState("");
  const [allPlayers, setAllPlayers] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [overwrite, setOverwrite] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [result, setResult] = useState(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    if (!open) return undefined;
    let valid = true;
    activeRef.current = true;
    setFilename(""); setParsed(null); setError(""); setNotice("");
    setResult(null); setProgress({ current: 0, total: 0 }); setOverwrite(false);
    setAllPlayers(null); setLoading(false);
    // Solo consultamos los FM26 UID incluidos cuando el usuario carga un JSON.
    // Descargar todos los jugadores al abrir el modal puede agotar la API.
    ++readSequence.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      valid = false;
      ++readSequence.current;
      activeRef.current = false;
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const rows = useMemo(() => parsed && allPlayers
    ? buildTacticalRoleImportPlan(parsed.entries, allPlayers, { overwrite })
    : [], [parsed, allPlayers, overwrite]);
  const actionable = useMemo(() => rows.filter(x => x.status === "ready"), [rows]);

  const lookup = async entries => {
    const sequence = ++readSequence.current;
    setAllPlayers(null); setLoading(true);
    try {
      const matched = await fetchTacticalRolePlayers(base44.entities.Player, entries);
      if (activeRef.current && sequence === readSequence.current) setAllPlayers(matched);
    } catch (err) {
      if (activeRef.current && sequence === readSequence.current) setError("Error al vincular los IDs FM26: " + problem(err));
    } finally {
      if (activeRef.current && sequence === readSequence.current) setLoading(false);
    }
  };

  const load = async event => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    ++readSequence.current;
    setFilename(file.name); setParsed(null); setAllPlayers(null);
    setError(""); setNotice(""); setResult(null);
    try {
      if (file.size > 8 * 1024 * 1024) throw Error("El archivo supera el límite de 8 MB.");
      const text = (await file.text()).replace(/^\uFEFF/, "").trim();
      const imported = parseTacticalRoleImport(JSON.parse(text), allowedRoles);
      setParsed(imported);
      await lookup(imported.entries);
    } catch (err) {
      setError("No se pudo validar el JSON: " + problem(err));
    }
  };

  const run = async () => {
    if (saving || loading || !parsed || !allPlayers || !actionable.length) return;
    setSaving(true); setError(""); setNotice(""); setResult(null);
    let done = 0; const failures = [];
    try {
      // La base puede cambiar entre la previsualización y el clic. Revalidar.
      const latest = await fetchTacticalRolePlayers(base44.entities.Player, parsed.entries);
      const freshPlan = buildTacticalRoleImportPlan(parsed.entries, latest, { overwrite });
      setAllPlayers(latest);
      if (snapshotSignature(freshPlan) !== snapshotSignature(rows)) {
        throw Error("La base de jugadores cambió desde la previsualización. Se ha actualizado la tabla; revísala y vuelve a pulsar Importar.");
      }
      const pending = freshPlan.filter(item => item.status === "ready");
      setProgress({ current: 0, total: pending.length });
      for (const item of pending) {
        try {
          await base44.entities.Player.update(item.player.id || item.player._id, tacticalRolePatch(item));
          done++;
        } catch (err) {
          failures.push(item.name + " (FM " + sourceUid(item) + "): " + problem(err));
        }
        if (activeRef.current) setProgress({ current: done + failures.length, total: pending.length });
      }
      setResult({ done, failed: failures.length, failures });
      let verifiedRows = null;
      if (done) {
        // Refresh both the catalogue and an independent server read before
        // claiming completion. A partial or unverified import remains open.
        await cache.invalidateQueries({ queryKey: RECORD_KEYS.Player, exact: true });
        const latestAfter = await fetchTacticalRolePlayers(base44.entities.Player, parsed.entries);
        verifiedRows = buildTacticalRoleImportPlan(parsed.entries, latestAfter, { overwrite });
        if (activeRef.current) setAllPlayers(latestAfter);
      }
      if (activeRef.current && canAutoCloseTacticalRoleImport({
        done,failed:failures.length,pending:pending.length,verifiedRows
      })) {
        onCompleted?.(done);
        onClose();
      } else if (activeRef.current) {
        setNotice(done
          ? "Se guardaron " + done + " jugadores. El resto de campos se ha conservado."
          : "No se aplicaron cambios.");
        if (done>0 && failures.length===0 && verifiedRows?.some(row=>row.status==="ready")) {
          setError("Se han escrito los roles, pero la verificación aún muestra cambios pendientes. Revisa los resultados antes de cerrar.");
        }
      }
    } catch (err) {
      if (activeRef.current) setError(problem(err));
    } finally {
      if (activeRef.current) setSaving(false);
    }
  };

  if (!open) return null;
  return createPortal(
    <div className="mf-modal-overlay fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/55 p-2 backdrop-blur-[2px] sm:p-5"
      onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="tactical-json-import-title"
        className="mf-modal-panel flex h-[calc(100dvh-1rem)] max-h-[870px] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:h-[calc(100dvh-2.5rem)]">
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-6">
          <div>
            <h2 id="tactical-json-import-title" className="text-base font-extrabold text-slate-900 sm:text-lg">Importar roles tácticos · JSON</h2>
            <p className="mt-1 text-xs text-slate-500">Vinculación exacta FM26 UID → Player de MF LEGACY. No crea jugadores ni modifica estadísticas.</p>
          </div>
          <button type="button" aria-label="Cerrar importador de roles" disabled={saving} onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-40"><X size={20} /></button>
        </header>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 sm:p-6">
          <label className="flex cursor-pointer flex-wrap items-center gap-3 rounded-xl border border-dashed border-blue-300 bg-blue-50/40 px-4 py-4 text-sm text-slate-700">
            <Upload size={19} className="text-[#003399]" />
            <span className="font-bold">Seleccionar archivo JSON de roles</span>
            <span className="text-xs text-slate-500">{filename || "mf_legacy_tactical_roles_review_v1"}</span>
            <input type="file" accept=".json,application/json" onChange={load} disabled={saving}
              className="min-w-0 w-full text-xs sm:w-auto" />
          </label>
          {loading && <p role="status" className="flex items-center gap-2 text-sm text-slate-600"><Loader2 size={16} className="animate-spin" />Buscando solo los jugadores incluidos en este JSON…</p>}
          {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><span>{error}</span>{parsed && !loading && !allPlayers && <button type="button" className="rounded-lg border border-rose-300 px-3 py-1.5 font-bold hover:bg-rose-100" onClick={() => { setError(""); lookup(parsed.entries); }}>Reintentar vinculación</button>}</div>}
          {notice && <p role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 size={16} />{notice}</p>}
          {result && <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
            <strong>Resultado: {result.done} guardados · {result.failed} errores.</strong>
            {result.failures.length > 0 && <div className="mt-2 max-h-28 space-y-1 overflow-y-auto text-xs text-rose-700">{result.failures.map((text,i)=><p key={i}>{text}</p>)}</div>}
          </div>}
          {parsed && <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-900">{parsed.filenameTeam || "Plantilla sin nombre"} · {parsed.entries.length} futbolistas</p>
                <p className="mt-1 text-xs text-slate-500">Solo se leen los dos roles y sus textos. Los nombres sirven para revisar; la vinculación se hace exclusivamente por FM26 UID.</p>
                {parsed.warnings.map(x=><p key={x} className="text-xs text-amber-700">{x}</p>)}
              </div>
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
                <input type="checkbox" checked={overwrite} onChange={e=>{setOverwrite(e.target.checked);setResult(null);}} disabled={saving} />
                Sobrescribir roles ya existentes
              </label>
            </div>
            {allPlayers && <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {[
                  ["Listos",count(rows,"ready")],
                  ["Sin cambios",count(rows,"unchanged")],
                  ["Protegidos",count(rows,"protected")],
                  ["Sin vínculo",count(rows,"unmatched")],
                  ["A revisar",count(rows,"invalid")+count(rows,"ambiguous")],
                ].map(([name,number])=><div key={name} className="rounded-xl border border-slate-200 p-3 text-center"><div className="text-xl font-extrabold text-slate-900">{number}</div><div className="text-xs text-slate-500">{name}</div></div>)}
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-[700px] w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600"><tr>
                    <th className="px-3 py-3">Jugador / UID FM26</th>
                    <th className="px-3 py-3">Rol 1 · principal</th>
                    <th className="px-3 py-3">Rol 2 · secundario</th>
                    <th className="px-3 py-3">Estado</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100">{rows.map(row=><tr key={row.index} className="align-top">
                    <td className="px-3 py-3"><strong className="text-slate-900">{row.name}</strong>
                      <div className="mt-1 text-[11px] text-slate-500">FM {row.id || "—"}{row.player?.name && row.player.name !== row.name ? " · En Base44: " + row.player.name : ""}</div>
                    </td>
                    {[0,1].map(i=><td key={i} className="max-w-[235px] px-3 py-3">
                      <strong className="font-semibold text-slate-800">{row.roles[i]?.name || "—"}</strong>
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{row.roles[i]?.description || "—"}</p>
                    </td>)}
                    <td className="px-3 py-3"><span className={"inline-flex rounded-full px-2 py-1 font-semibold " + (badgeByStatus[row.status] || "")}>{labelByStatus[row.status]}</span>
                      {!!row.reason && <p className="mt-1 max-w-[210px] text-[11px] text-slate-500">{row.reason}</p>}
                    </td>
                  </tr>)}</tbody>
                </table>
              </div>
              {!!count(rows,"unmatched") && <p className="flex items-start gap-2 text-xs text-amber-800"><AlertTriangle size={15} className="shrink-0" />Los IDs sin vínculo no se crean ni se asignan por nombre. Impórtalos primero con el importador FM26 habitual.</p>}
            </>}
          </>}
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-white px-4 py-4 sm:px-6">
          <p className="flex items-center gap-2 text-xs text-slate-500"><FileJson size={16} />{saving ? progress.current + " / " + progress.total + " guardados o revisados" : "Se preservan clubes, fotos, CA/CP y todas las estadísticas."}</p>
          <div className="flex items-center gap-2">
            <button type="button" disabled={saving} onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700">Cerrar</button>
            <button type="button" onClick={run} disabled={saving || loading || !allPlayers || !actionable.length}
              className="inline-flex items-center gap-2 rounded-xl bg-[#003399] px-4 py-2 text-xs font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-40">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              {saving ? "Guardando…" : "Importar " + actionable.length + " jugadores"}
            </button>
          </div>
        </footer>
      </section>
    </div>, document.body
  );
}
