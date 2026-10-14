import {
  normalizeSeason,
  fifaEditionForSeason,
  parseMarketValue,
  validateMarketValueDate,
} from "./historicalValuation.js";

const text = (v) => String(v ?? "").trim();
const keyText = (v) => text(v).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ");
const validSeason = (v) => {
  const season = normalizeSeason(v);
  if (/^\d{4}$/.test(season)) return true;
  const s = season.match(/^(\d{4})\/(\d{4})$/);
  return Boolean(s && Number(s[2]) === Number(s[1]) + 1);
};
const urlField = (value) => {
  if (value === undefined || value === null || text(value) === "") return "";
  try {
    const u = new URL(String(value));
    return ["http:", "https:"].includes(u.protocol) ? u.href : null;
  } catch { return null; }
};

const teamCatalog = (stats = [], teams = []) => {
  const catalog = new Map();
  for (const t of teams) {
    const id = text(t.id);
    if (id) catalog.set("id:" + id, {
      team_id: id, fotmob_team_id: text(t.fotmob_id),
      team_name: text(t.name),
    });
  }
  for (const r of stats) {
    const id = text(r.team_id);
    const fotmob = text(r.fotmob_team_id);
    if (!id && !fotmob) continue;
    const mapKey = id ? "id:" + id : "fotmob:" + fotmob;
    const previous = catalog.get(mapKey);
    if (!previous) {
      catalog.set(mapKey, {
        team_id: id, fotmob_team_id: fotmob,
        team_name: text(r.team_name),
      });
    } else if (!previous.fotmob_team_id && fotmob) {
      previous.fotmob_team_id = fotmob;
    }
  }
  return [...catalog.values()];
};
export function resolveHistoricalTeam(item, stats, teams) {
  const candidates = teamCatalog(stats, teams);
  const id = text(item.team_id);
  const fotmob = text(item.fotmob_team_id);
  const name = keyText(item.team_name);
  let matches = id
    ? candidates.filter((c) => c.team_id === id)
    : fotmob
      ? candidates.filter((c) => c.fotmob_team_id === fotmob)
      : candidates.filter((c) => name && keyText(c.team_name) === name);
  // Never silently associate a supplied ID with a different club.
  if (id && fotmob) matches = matches.filter((c) => !c.fotmob_team_id || c.fotmob_team_id === fotmob);
  if (matches.length !== 1) return {
    team: null,
    error: matches.length > 1
      ? "Hay varios clubes con esta identificación. Indica team_id o fotmob_team_id."
      : "Club no identificado. Usa el nombre exacto del club o su ID de FotMob/Base44.",
  };
  if (name && keyText(matches[0].team_name) !== name && !id && !fotmob)
    return { team: null, error: "El nombre no coincide con el club identificado." };
  return { team: matches[0], error: "" };
}

export function prepareHistoricalJson(rawText, { playerId, fotmobPlayerId, stats = [], teams = [] }) {
  if (!rawText.trim()) throw Error("Pega primero el JSON que te devuelva ChatGPT.");
  if (rawText.length > 300000) throw Error("El JSON es demasiado grande. Divídelo por jugador.");
  let data;
  try { data = JSON.parse(rawText); }
  catch (err) { throw Error("JSON no válido: " + (err?.message || "comprueba las comas y las comillas")); }
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw Error("El contenido debe ser un objeto JSON con valuations y/o team_matches.");
  if (data.schema !== "mf_legacy_historical_import_v1")
    throw Error("schema debe ser mf_legacy_historical_import_v1.");
  if (!data.player || typeof data.player !== "object")
    throw Error("Falta player con la identificación del futbolista.");
  const suppliedId = text(data.player.player_id);
  const suppliedFotmob = text(data.player.fotmob_id ?? data.player.fotmob_player_id);
  if (suppliedId && suppliedId !== text(playerId))
    throw Error("El JSON corresponde a otro jugador (player_id diferente).");
  if (suppliedFotmob && text(fotmobPlayerId) && suppliedFotmob !== text(fotmobPlayerId))
    throw Error("El FotMob ID del JSON no coincide con el de la ficha abierta.");
  if (!suppliedId && !suppliedFotmob)
    throw Error("Incluye player.fotmob_id (o player.player_id) para evitar importar al futbolista equivocado.");
  const valuations = data.valuations ?? [];
  const teamMatches = data.team_matches ?? [];
  if (!Array.isArray(valuations) || !Array.isArray(teamMatches))
    throw Error("valuations y team_matches deben ser listas JSON.");
  if (!valuations.length && !teamMatches.length)
    throw Error("El JSON no contiene valoraciones ni PJ Equipo.");
  if (valuations.length + teamMatches.length > 250)
    throw Error("Máximo 250 registros por jugador. Divide el JSON.");
  if (valuations.length && !playerId) throw Error("La ficha del jugador no tiene player_id para guardar valoraciones.");

  const result = [];
  const duplicateKeys = new Set();
  const seen = new Set();

  for (let i = 0; i < valuations.length; i++) {
    const r = valuations[i];
    const errors = [];
    if (!r || typeof r !== "object" || Array.isArray(r)) {
      result.push({ id: "v" + i, type: "valuation", season: "", errors: ["Registro no válido."], payload: {} });
      continue;
    }
    const season = normalizeSeason(r.season);
    if (!validSeason(season)) errors.push("Temporada inválida. Usa 2018 o 2022/2023.");
    const dupKey = "v:" + season;
    if (seen.has(dupKey)) { errors.push("Temporada duplicada en el JSON."); duplicateKeys.add(dupKey); }
    seen.add(dupKey);
    const payload = {};
    if (r.fifa_fc_overall !== null && r.fifa_fc_overall !== undefined && text(r.fifa_fc_overall)) {
      const overall = Number(r.fifa_fc_overall);
      if (!Number.isInteger(overall) || overall < 1 || overall > 99)
        errors.push("Overall debe ser entero entre 1 y 99.");
      else {
        payload.fifa_fc_overall = overall;
        const edition = text(r.fifa_edition || fifaEditionForSeason(season));
        if (edition) payload.fifa_edition = edition;
      }
    }
    if (r.transfermarkt_value_eur !== null && r.transfermarkt_value_eur !== undefined && text(r.transfermarkt_value_eur)) {
      const market = parseMarketValue(r.transfermarkt_value_eur);
      if (market === "invalid" || market === null || !Number.isSafeInteger(market) || market < 0)
        errors.push("Valor Transfermarkt no válido.");
      else payload.transfermarkt_value_eur = market;
    }
    if (Object.keys(payload).length === 0)
      errors.push("No hay Overall ni valor de mercado en esta temporada; omite la fila.");
    if (payload.fifa_fc_overall !== undefined) {
      const url = urlField(r.fifa_source_url);
      if (url === null) errors.push("URL de FIFA/FC inválida.");
      else if (url) payload.fifa_source_url = url;
    }
    if (payload.transfermarkt_value_eur !== undefined) {
      const url = urlField(r.transfermarkt_source_url);
      if (url === null) errors.push("URL de Transfermarkt inválida.");
      else if (url) payload.transfermarkt_source_url = url;
      if (r.market_value_as_of) {
        const date = text(r.market_value_as_of);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || validateMarketValueDate(date, season))
          errors.push("Fecha del valor no válida o posterior al cierre de temporada.");
        else payload.market_value_as_of = date;
      }
      if (r.market_value_status) {
        const status = text(r.market_value_status);
        if (!["provisional", "definitivo"].includes(status))
          errors.push("market_value_status debe ser provisional o definitivo.");
        else payload.market_value_status = status;
      }
    }
    result.push({
      id: "v" + i, type: "valuation", season, label: season,
      errors, payload, dbKey: dupKey,
    });
  }
  for (let i = 0; i < teamMatches.length; i++) {
    const r = teamMatches[i];
    const errors = [];
    if (!r || typeof r !== "object" || Array.isArray(r)) {
      result.push({ id: "t" + i, type: "team", season: "", errors: ["Registro no válido."], payload: {} });
      continue;
    }
    const season = normalizeSeason(r.season);
    const competition = text(r.competition);
    if (!validSeason(season)) errors.push("Temporada inválida.");
    if (!competition) errors.push("Falta la competición.");
    const n = Number(r.team_matches);
    if (r.team_matches === null || r.team_matches === undefined ||
      text(r.team_matches) === "" || !Number.isInteger(n) || n < 1 || n > 200)
      errors.push("PJ Equipo debe ser entero entre 1 y 200.");
    const resolved = resolveHistoricalTeam(r, stats, teams);
    if (resolved.error) errors.push(resolved.error);
    const team = resolved.team;
    const dupKey = "t:" + (team?.team_id || team?.fotmob_team_id || keyText(r.team_name)) + "|" + season + "|" + keyText(competition);
    if (seen.has(dupKey)) { errors.push("Competición del club duplicada en el JSON."); duplicateKeys.add(dupKey); }
    seen.add(dupKey);
    const payload = team ? {
      team_id: team.team_id,
      fotmob_team_id: team.fotmob_team_id,
      team_name: team.team_name || text(r.team_name),
      season, competition,
      team_matches: n,
      fotmob_tournament_id: text(r.fotmob_tournament_id),
      source: text(r.source) || "Investigación histórica",
    } : {};
    result.push({
      id: "t" + i, type: "team", season,
      label: (team?.team_name || text(r.team_name) || "Equipo") + " · " + season + " · " + competition,
      errors, payload, dbKey: dupKey,
    });
  }
  // Block ALL rows involved in a duplicate, not only the second row.
  for (const row of result) if (duplicateKeys.has(row.dbKey) && !row.errors.some(e => e.includes("duplicad")))
    row.errors.push("Hay otro registro con esta misma clave en el JSON.");
  return result;
}

export function rowChanges(payload, existing, type) {
  if (!existing) return { status: "new", changes: Object.entries(payload).map(([field, to]) => ({ field, from: null, to })) };
  const data = type === "team"
    ? { team_matches: payload.team_matches }
    : Object.fromEntries(Object.entries(payload).filter(([key]) => !["verification_status"].includes(key)));
  const changes = Object.entries(data).filter(([field, to]) => text(existing[field]) !== text(to)).map(([field, to]) => ({
    field, from: existing[field] ?? null, to,
  }));
  return { status: changes.length ? "update" : "same", changes };
}
