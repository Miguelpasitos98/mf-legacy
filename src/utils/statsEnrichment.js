// FotMob historical enhancement: append verified missing metrics only.
// Never overwrite match totals, football manager attributes, custom values,
// or an existing metric that differs from another data source.
const text = v => String(v ?? "").trim();
export const metricKey = v => text(v).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const numeric = v => (v == null || v === "" ? null : (Number.isFinite(Number(v)) ? Number(v) : null));
const eq = (a,b) => text(a) === text(b);
const same = (a,b) => numeric(a) === numeric(b);

export function assessHistoricalEnrichment(existing, incoming, confirmedPlayerId) {
  const errors = [];
  if (!existing || !incoming) errors.push("Falta el historial original o el detalle.");
  if (existing && incoming) {
    if (!eq(existing.player_id, confirmedPlayerId) || !eq(existing.fotmob_player_id, incoming.player_fotmob_id)) {
      errors.push("El ID del jugador no corresponde a una vinculación confirmada.");
    }
    if (!eq(existing.season,incoming.season) || metricKey(existing.competition)!==metricKey(incoming.competition)) {
      errors.push("Temporada o competición no coinciden.");
    }
    const a = text(existing.fotmob_team_id), b = text(incoming.fotmob_team_id);
    if (a && b && a!==b) errors.push("El ID del equipo difiere.");
    for (const field of ["appearances","minutes"]) {
      const base = numeric(existing[field]), supplied = numeric(incoming[field]);
      if (base !== null && supplied !== null && Math.abs(base-supplied)>0.01)
        errors.push("Diferencia en "+field+"; no se mezclan coberturas distintas.");
    }
  }
  const old = Array.isArray(existing?.metrics) ? existing.metrics : [];
  const next = [...old], known = new Map();
  for (const item of old) {
    const key = metricKey(item?.name);
    if (key && !known.has(key)) known.set(key,item);
  }
  const conflicts=[];
  let added=0;
  for (const item of Array.isArray(incoming?.metrics)? incoming.metrics : []) {
    if (!item || !text(item.name) || numeric(item.value) === null) continue;
    const key = metricKey(item.name), prior=known.get(key);
    if (prior) {
      if (numeric(prior.value)!==numeric(item.value)) conflicts.push(item.name);
      continue;
    }
    const cleaned = {
      name:text(item.name),value:numeric(item.value),
      per90:numeric(item.per90),percentile:numeric(item.percentile)
    };
    next.push(cleaned);known.set(key,cleaned);added++;
  }
  return {ok:errors.length===0, errors, conflicts,added,metrics:next};
}
