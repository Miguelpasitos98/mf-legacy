import React, { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, ClipboardPaste, Loader2, ShieldCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { formatEur } from "@/utils/historicalValuation";
import { canonicalHistoricalCompetition, prepareHistoricalJson, rowChanges } from "@/utils/historicalJson";
import { planHistoricalActions } from "@/utils/historicalBatch";

const unpack = (v) => Array.isArray(v) ? v : v?.items || v?.data || [];
const text = (v) => String(v ?? "").trim();
const sameKey = (r, p) => r.season === p.season &&
  canonicalHistoricalCompetition(r.competition) === canonicalHistoricalCompetition(p.competition) &&
  ((r.team_id && p.team_id && text(r.team_id) === text(p.team_id)) ||
   (r.fotmob_team_id && p.fotmob_team_id && text(r.fotmob_team_id) === text(p.fotmob_team_id)));
const uniqueRecords = (records) => [...new Map(records.filter(Boolean).map(r => [r.id, r])).values()];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isRateLimited = (error) => error?.status === 429 || error?.response?.status === 429 || error?.originalError?.response?.status === 429 || /rate limit|too many requests|429/i.test(String(error?.message || error));
const retryRead = async (read, progress = () => {}) => {
  for (let attempt = 0; attempt < 4; attempt++) {
    try { return await read(); }
    catch (error) {
      if (!isRateLimited(error) || attempt === 3) throw error;
      const delay = [4000, 8000, 16000][attempt];
      progress(`Base44 está limitando solicitudes. Reintentando consulta en ${delay / 1000} s…`);
      await sleep(delay);
    }
  }
};
// Consultar una vez por entidad/club, no una vez por competición.
const fetchSnapshot = async (items, playerId, progress = () => {}) => {
  const valuations = [];
  if (items.some(item => item.type === "valuation")) {
    const result = await retryRead(() => base44.entities.PlayerHistoricalValuation.filter(
      { player_id: playerId }, { limit: 500 }
    ), progress);
    valuations.push(...unpack(result));
  }
  const teams = items.filter(item => item.type === "team");
  const teamIds = [...new Set(teams.map(item => text(item.payload?.team_id)).filter(Boolean))];
  const fotmobIds = [...new Set(teams.map(item => text(item.payload?.fotmob_team_id)).filter(Boolean))];
  const records = [];
  for (let i = 0; i < teamIds.length; i += 60) {
    const chunk = teamIds.slice(i, i + 60);
    const data = await retryRead(() => base44.entities.TeamSeasonMatches.filter(
      { team_id: { $in: chunk } }, { limit: 500 }
    ), progress);
    records.push(...unpack(data));
  }
  for (let i = 0; i < fotmobIds.length; i += 60) {
    const chunk = fotmobIds.slice(i, i + 60);
    const data = await retryRead(() => base44.entities.TeamSeasonMatches.filter(
      { fotmob_team_id: { $in: chunk } }, { limit: 500 }
    ), progress);
    records.push(...unpack(data));
  }
  return { valuations, teamRecords: uniqueRecords(records) };
};
const decorateRows = (parsed, snapshot) => parsed.map((r) => {
  const matches = r.type === "valuation"
    ? snapshot.valuations.filter(v => v.season === r.season)
    : snapshot.teamRecords.filter(v => sameKey(v, r.payload));
  const errors = [...r.errors];
  if (matches.length > 1) errors.push("Hay registros duplicados en Base44. Revísalos antes de importar.");
  const previous = matches[0] || null;
  const comparison = rowChanges(r.payload, previous, r.type);
  return {
    ...r, existing: previous, changes: comparison.changes, errors,
    status: errors.length ? "error" : comparison.status,
  };
});
const formatChange = (field, value) => {
  if (value === null || value === undefined || value === "") return "—";
  if (field === "transfermarkt_value_eur") return formatEur(value);
  if (field === "team_matches") return value + " PJ";
  if (field === "fifa_fc_overall") return "OVR " + value;
  if (field === "fifa_fc_position") return "Posición " + value;
  return String(value);
};

export default function HistoricalJsonImporter({ player, fotmobPlayerId, stats = [], teams = [], onSaved, onBusyChange }) {
  const [raw, setRaw] = useState("");
  const [rows, setRows] = useState([]);
  const [skippedMissingMatches, setSkippedMissingMatches] = useState(0);
  const [included, setIncluded] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [progress, setProgress] = useState("");
  const playerId = text(player?.id || stats.find((r) => r?.player_id)?.player_id);
  const fotmobId = text(fotmobPlayerId || stats[0]?.fotmob_player_id);
  const sample = JSON.stringify({
    schema: "mf_legacy_historical_import_v1",
    player: { fotmob_id: fotmobId || "737066", name: player?.name || "Erling Haaland" },
    valuations: [{ season: "2022/2023", fifa_fc_overall: 88, fifa_fc_position: "CAM", transfermarkt_value_eur: 180000000 }],
    team_matches: [{ season: "2022/2023", competition: "Premier League", team_name: "Manchester City", team_matches: 38 }],
  }, null, 2);

  const counts = useMemo(() => ({
    valuations: rows.filter((r) => r.type === "valuation").length,
    teams: rows.filter((r) => r.type === "team").length,
    new: rows.filter((r) => r.status === "new").length,
    updates: rows.filter((r) => r.status === "update").length,
    same: rows.filter((r) => r.status === "same").length,
    errors: rows.filter((r) => r.status === "error").length,
    selected: rows.filter((r) => included.has(r.id) && ["new", "update"].includes(r.status)).length,
  }), [rows, included]);

  const analyze = async (source = raw, resetMessages = true) => {
    setBusy(true);
    if (resetMessages) { setError(""); setNotice(""); }
    setRows([]);
    setSkippedMissingMatches(0);
    setIncluded(new Set());
    try {
      const parsed = prepareHistoricalJson(source, { playerId, fotmobPlayerId: fotmobId, stats, teams });
      setSkippedMissingMatches(parsed.skippedMissingTeamMatches || 0);
      const snapshot = await fetchSnapshot(parsed, playerId, setProgress);
      const decorated = decorateRows(parsed, snapshot);
      setProgress("");
      setRows(decorated);
      setIncluded(new Set(decorated.filter((r) => r.status === "new").map((r) => r.id)));
      if (resetMessages) setNotice(
        "Datos analizados. Los nuevos están seleccionados y las actualizaciones requieren autorización individual." +
        (parsed.skippedMissingTeamMatches ? " Se han omitido " + parsed.skippedMissingTeamMatches +
          " PJ Equipo sin dato (null): no se guardan como cero ni se consideran errores." : "") +
        (decorated.every(r => r.status === "same") ? " Los demás registros ya existen sin cambios." : "")
      );
    } catch (err) {
      setError(err?.message || "No se pudo analizar el JSON.");
    } finally { setBusy(false); setProgress(""); }
  };

  const toggle = (id) => {
    setIncluded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = async () => {
    const selected = rows.filter((r) => included.has(r.id) && ["new", "update"].includes(r.status));
    if (!selected.length || busy || saving) return;
    setSaving(true);
    onBusyChange?.(true);
    setError(""); setNotice("");
    let created = 0; let updated = 0; let unchanged = 0;
    const failures = [];
    let haltMessage = "";
    try {
      setProgress("Comprobando qué registros ya existen…");
      const freshSnapshot = await fetchSnapshot(selected, playerId, setProgress);
      const liveRows = decorateRows(selected, freshSnapshot);
      const queue = [];
      for (let i = 0; i < selected.length; i++) {
        const old = selected[i];
        const live = liveRows[i];
        if (live.errors.length) {
          failures.push(old.label + ": " + live.errors.join(" "));
          continue;
        }
        if (old.existing) {
          if (old.existing.id !== live.existing?.id) {
            failures.push(old.label + ": el registro original ya no coincide. Vuelve a analizar.");
            continue;
          }
          if (Object.keys(old.payload).some(field => text(old.existing[field]) !== text(live.existing[field]))
              && live.status !== "same") {
            failures.push(old.label + ": modificado desde la vista previa. Vuelve a analizar.");
            continue;
          }
        } else if (live.existing && live.status !== "same") {
          failures.push(old.label + ": apareció otro valor. Vuelve a analizar.");
          continue;
        }
        if (live.status === "same") { unchanged++; continue; }
        queue.push({ ...live, status: old.existing ? "update" : "new" });
      }

      const actions = planHistoricalActions(queue, 10);

      for (let i = 0; i < actions.length; i++) {
        const task = actions[i];
        const entity = base44.entities[task.type === "valuation"
          ? "PlayerHistoricalValuation" : "TeamSeasonMatches"];
        setProgress("Guardando grupo " + (i + 1) + "/" + actions.length +
          " · " + (created + updated + unchanged) + "/" + selected.length + " registros.");
        try {
          if (task.action === "create") {
            const payload = task.items.map(item => item.type === "valuation"
              ? { player_id: playerId, fotmob_player_id: fotmobId,
                  season: item.season, ...item.payload, verification_status: "pending" }
              : { ...item.payload, verification_status: "pending" });
            // API nativa de Base44: una petición por 10 registros.
            const result = await entity.bulkCreate(payload);
            if (!Array.isArray(result) || result.length !== payload.length)
              throw Error("El servidor no confirmó todos los registros del grupo.");
            created += payload.length;
          } else {
            const item = task.items[0];
            const patch = task.type === "valuation"
              ? { ...item.payload, verification_status: "pending" }
              : { team_matches: item.payload.team_matches,
                  source: item.payload.source, verification_status: "pending" };
            await entity.update(item.existing.id, patch);
            updated++;
          }
        } catch (err) {
          haltMessage = isRateLimited(err)
            ? "Base44 ha impuesto un límite temporal. El guardado se ha detenido para no duplicar datos. Espera un minuto y pulsa Analizar JSON para reanudar solo lo pendiente."
            : "No se pudo confirmar un grupo. Pulsa Analizar JSON para comprobar lo guardado antes de reintentar.";
          failures.push("Grupo " + (i + 1) + ": " + (err?.message || "Error de conexión"));
          break;
        }
        if (i < actions.length - 1) await sleep(1600);
      }
    } catch (err) {
      haltMessage = isRateLimited(err)
        ? "Base44 está limitando las consultas. Espera un minuto y vuelve a analizar el mismo JSON."
        : "No se ha podido verificar el estado actual de los registros; no se han iniciado nuevas escrituras.";
      failures.push(err?.message || "Error de conexión");
    }
    setProgress(""); setSaving(false); onBusyChange?.(false);
    if (created + updated > 0) onSaved?.();
    setNotice("Resultado confirmado: " + created + " nuevos · " + updated + " actualizados · " + unchanged + " sin cambios." + (haltMessage ? " Importación detenida con seguridad." : ""));
    if (failures.length) setError((haltMessage ? haltMessage + " " : "") + failures.slice(0, 4).join(" | ") + (failures.length > 4 ? " · Más incidencias pendientes." : ""));
    // For a successful/partial operation, force a fresh preview before any further writes.
    setRows([]); setIncluded(new Set());
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-900">
        <ShieldCheck size={16} className="mr-1 inline"/>
        Un solo JSON por jugador: todas las temporadas, valores FIFA/FC, Transfermarkt y PJ Equipo. Se guardan en sus entidades originales independientes, sin tocar estadísticas FotMob o CraftedFC.
      </div>
      <label className="block text-xs font-bold text-slate-700">
        Pega aquí el JSON completo que te entregue ChatGPT
        <textarea value={raw} onChange={(event) => {
          setRaw(event.target.value); setRows([]); setSkippedMissingMatches(0); setIncluded(new Set()); setError(""); setNotice("");
        }} placeholder={sample} disabled={busy || saving}
          spellCheck={false}
          className="mt-2 h-56 w-full resize-y rounded-xl border border-slate-300 bg-slate-50 p-3 font-mono text-xs text-slate-800 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"/>
      </label>
      <p className="text-[11px] text-slate-500">Formato: schema mf_legacy_historical_import_v1, player.fotmob_id, listas valuations y team_matches. Cada valoración admite <strong>fifa_fc_position</strong> (posición de la carta, opcional y puede ser null). Los PJ Equipo con null se omiten sin error y no se convierten en cero; pueden completarse después.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => analyze()} disabled={busy || saving || !raw.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-[#003399] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40">
          {busy ? <Loader2 size={15} className="animate-spin"/> : <ClipboardPaste size={15}/>}
          {busy ? "Analizando…" : "Analizar JSON"}
        </button>
        <button type="button" onClick={() => { setRaw(""); setRows([]); setSkippedMissingMatches(0); setIncluded(new Set()); setNotice(""); setError(""); }}
          disabled={busy || saving} className="rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700">Limpiar</button>
      </div>
      {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">{notice}</p>}
      {error && <p role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"><AlertCircle className="shrink-0" size={15}/>{error}</p>}
      {busy && progress && <p role="status" className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-900">{progress}</p>}
      {rows.length > 0 && <>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {[
            ["Valoraciones", counts.valuations], ["PJ Equipo", counts.teams],
            ["Nuevos", counts.new], ["Actualizar", counts.updates],
            ["Sin cambios", counts.same], ["Errores", counts.errors],
          ].map(([label, n]) => <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-center">
            <p className="text-[10px] font-bold text-slate-500">{label}</p><p className="text-lg font-black text-[#0e2844]">{n}</p>
          </div>)}
        </div>
        {skippedMissingMatches > 0 && <p role="status" className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800"><strong>{skippedMissingMatches} PJ Equipo desconocidos omitidos.</strong> Los registros válidos siguen disponibles para importar. Puedes volver a pegar el mismo JSON cuando conozcas esos partidos, sin sobrescribir los existentes.</p>}
        <p className="text-xs text-slate-600"><strong>Vista previa:</strong> marca los registros que quieras guardar. Los nuevos vienen seleccionados; ningún valor existente se sobrescribe sin que lo marques.</p>
        <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200">
          {rows.map((r) => <label key={r.id} className={"flex cursor-pointer items-start gap-3 border-b border-slate-100 p-3 last:border-0 " + (r.status === "error" ? "bg-rose-50" : "hover:bg-slate-50")}>
            <input type="checkbox" checked={included.has(r.id)} onChange={() => toggle(r.id)}
              disabled={!["new", "update"].includes(r.status) || saving || busy}
              className="mt-1 h-4 w-4 shrink-0 accent-blue-800"/>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold text-slate-800">{r.type === "valuation" ? "FIFA/FC + Transfermarkt · " + r.season : "PJ Equipo · " + r.label}</p>
                <span className={"rounded-full px-2 py-0.5 text-[10px] font-bold " + (
                  r.status === "new" ? "bg-emerald-100 text-emerald-800" :
                  r.status === "update" ? "bg-amber-100 text-amber-900" :
                  r.status === "same" ? "bg-slate-100 text-slate-600" : "bg-rose-100 text-rose-800")}>
                  {r.status === "new" ? "Nuevo" : r.status === "update" ? "Actualizar (confirmar)" : r.status === "same" ? "Sin cambios" : "Error"}
                </span>
              </div>
              {r.changes?.length > 0 && <p className="break-words text-[11px] text-slate-600">{r.changes.map((c) =>
                c.field === "fifa_fc_overall" || c.field === "fifa_fc_position" || c.field === "transfermarkt_value_eur" || c.field === "team_matches"
                  ? c.field + ": " + formatChange(c.field, c.from) + " → " + formatChange(c.field, c.to)
                  : "").filter(Boolean).join(" · ") || (r.status === "new" ? "Registro nuevo" : "Cambios de metadatos")}
              </p>}
              {r.errors?.map((issue, i) => <p key={i} className="text-[11px] font-semibold text-red-700">{issue}</p>)}
            </div>
          </label>)}
        </div>
        {progress && <p role="status" className="text-xs font-bold text-blue-700"><Loader2 size={14} className="mr-1 inline animate-spin"/>{progress}</p>}
        <div className="flex justify-end">
          <button type="button" onClick={save} disabled={saving || busy || counts.selected === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-[#003399] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#002777] disabled:opacity-40">
            {saving ? <Loader2 size={16} className="animate-spin"/> : <CheckCircle2 size={16}/>}
            {saving ? "Guardando…" : "Guardar " + counts.selected + " registro(s)"}
          </button>
        </div>
      </>}
    </div>
  );
}