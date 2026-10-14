// MF Legacy — adapter for independently sourced, season-aware external batches.
// Does not modify FM26 fields or infer player identity from matching names.
export const UNIFIED_BATCH_SCHEMA = "mf_legacy_external_batch_v1";
export const idText = value => value == null ? "" : String(value).trim();
export const numeric = value => value === "" || value == null ? null : (Number.isFinite(Number(value)) ? Number(value) : null);
export const rowsFromResponse = result =>
  Array.isArray(result) ? result :
  Array.isArray(result?.items) ? result.items :
  Array.isArray(result?.data) ? result.data :
  Array.isArray(result?.entities) ? result.entities : [];

const slug = value => idText(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function normalizeUnifiedItem(item) {
  if (!item || typeof item !== "object") throw new Error("Fila incorrecta.");
  const kind = item.kind;
  const d = item.data || item;
  if (kind === "player") {
    const raw = d.craftedfc_snapshot || d.snapshot || d;
    const pid = idText(item.fotmob_id || d.ids?.fotmob_player_id || raw.player_id || d.fotmob_player_id);
    if (!pid || !raw || typeof raw !== "object") throw new Error("Jugador sin ID FotMob o sin snapshot.");
    return {
      kind, fotmob_id: pid, name: idText(d.identity?.name || raw.player_name || d.name),
      external_key: "CraftedFC:player:" + pid, source: "CraftedFC",
      snapshot_date: idText(item.snapshot_date || "2026-10-14"),
      rating: numeric(raw.rating), rank: numeric(raw.rank), raw_score: numeric(raw.score),
      archetype: idText(raw.primary_archetype || d.identity?.archetype),
      team_strength: numeric(raw.stats?.team_strength || raw.team_strength),
      league_strength: numeric(raw.stats?.league_strength || raw.league_strength),
      payload: raw
    };
  }
  if (kind === "team") {
    const raw = d.craftedfc_snapshot || d.snapshot || d;
    const tid = idText(item.fotmob_id || d.fotmob_team_id || raw.team_id);
    if (!tid || tid === "0") throw new Error("Club sin ID válido; el ID 0 no identifica un club único.");
    return {
      kind, source: "CraftedFC", external_key: "CraftedFC:team:" + tid,
      fotmob_id: tid, name: idText(d.name || raw.team_name || raw.name),
      snapshot_date: idText(item.snapshot_date || "2026-10-14"),
      rating: numeric(raw.strength || raw.rating), rank: numeric(raw.rank),
      team_strength: numeric(raw.strength), league_strength: numeric(raw.league_strength),
      payload: raw
    };
  }
  if (kind === "league") {
    const raw = d.snapshot || d;
    const code = idText(raw.comp_code || raw.code);
    if (!code) throw new Error("Liga sin comp_code.");
    return {
      kind, source: "CraftedFC", external_key: "CraftedFC:league:" + code,
      fotmob_id: "", name: idText(raw.name), snapshot_date: idText(item.snapshot_date || "2026-10-14"),
      rating: numeric(raw.strength), rank: numeric(raw.rank),
      league_strength: numeric(raw.strength), payload: raw
    };
  }
  if (kind === "season") {
    const r = d.record || d;
    const pid = idText(item.fotmob_id || item.fotmob_player_id || r.fotmob_player_id);
    if (!pid || !idText(r.season) || !idText(r.competition)) throw new Error("Historial sin ID, temporada o competición.");
    const rawTeam = idText(r.fotmob_team_id || r.team_id);
    const rawExternal = idText(r.external_record_id);
    return {
      kind, player_fotmob_id: pid,
      external_record_id: "fotmob:" + pid + ":" + (rawTeam && rawTeam !== "0" ? rawTeam : slug(r.team_name) || "team-unknown") + ":" + slug(r.season) + ":" + slug(r.competition),
      original_external_record_id: rawExternal,
      player_name: idText(item.player_name || r.player_name_at_snapshot || r.player_name),
      team_name: idText(r.team_name), fotmob_team_id: rawTeam && rawTeam !== "0" ? rawTeam : "",
      season: idText(r.season), competition: idText(r.competition),
      appearances: numeric(r.matches ?? r.appearances), minutes: numeric(r.minutes),
      rating: numeric(r.fotmob_match_rating ?? r.rating), market_value: numeric(r.market_value_eur ?? r.market_value),
      market_date: idText(r.market_value_as_of || r.market_date),
      team_matches: numeric(r.team_matches), metrics: Array.isArray(r.metrics) ? r.metrics : [],
      source: "FotMob · caché histórica", verification_status: idText(r.verification_status || "historical_cache_not_independently_verified")
    };
  }
  throw new Error("Tipo de registro desconocido: " + kind);
}

export function parseUnifiedBatch(source) {
  if (!source || source.schema !== UNIFIED_BATCH_SCHEMA || !Array.isArray(source.records)) {
    throw new Error("Archivo no compatible. Usa los lotes MF Legacy Base44, no el JSON de 86 MB directamente.");
  }
  if (!source.records.length || source.records.length > 200) {
    throw new Error("Cada lote debe contener entre 1 y 200 registros.");
  }
  const errors = [], dedupe = new Map();
  for (const [index, row] of source.records.entries()) {
    try {
      const parsed = normalizeUnifiedItem({...row, snapshot_date: row.snapshot_date || source.snapshot_date || ""});
      const key = parsed.kind === "season" ? parsed.external_record_id : parsed.external_key;
      if (dedupe.has(key)) throw new Error("Identificador repetido dentro del lote.");
      dedupe.set(key, parsed);
    } catch (error) {
      errors.push("Fila " + (index + 1) + ": " + error.message);
    }
  }
  return {records: [...dedupe.values()], errors, snapshot_date: source.snapshot_date || null, batch: source.batch || ""};
}
