import {
  normalizeSeason,
  fifaEditionForSeason,
  parseMarketValue,
  validateMarketValueDate,
} from "./historicalValuation.js";

const text = (v) => String(v ?? "").trim();
const keyText = (v) => text(v).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[._-]/g, " ").replace(/\s+/g, " ").trim();

// Safe normalization across sources: never strip City, United, SC, II, etc.
const CLUB_ALIASES = {
  "rb salzburg": "salzburg", "red bull salzburg": "salzburg",
  "fc red bull salzburg": "salzburg", "fc salzburg": "salzburg",
  "bryne fk": "bryne", "molde fk": "molde",
  "bayer 04 leverkusen": "bayer leverkusen",
  "inter": "internazionale milan",
  "inter milan": "internazionale milan",
  "internazionale": "internazionale milan",
  "fc internazionale milano": "internazionale milan",
  "fc internazionale milan": "internazionale milan",
  "psg": "paris saint germain", "paris sg": "paris saint germain",
  "paris saint germain": "paris saint germain",
  "atletico de madrid": "atletico madrid",
  "club atletico de madrid": "atletico madrid",
  "rb leipzig": "rb leipzig",
  "rasenballsport leipzig": "rb leipzig",
  "tottenham": "tottenham hotspur",
};
// Strip ONLY genuine club designators. Barcelona SC remains different from
// Barcelona, as do Manchester City/United and every B team.
export function canonicalHistoricalClub(value) {
  let key=keyText(value).replace(/[^a-z0-9]+/g," ").trim();
  key=key.replace(/\b(?:muenchen|munchen)\b/g,"munich")
    .replace(/\bmilano\b/g,"milan");
  if(CLUB_ALIASES[key])return CLUB_ALIASES[key];
  key=key.replace(/^(?:fc|cf|fk)\s+/,"").replace(/\s+(?:fc|cf|fk)$/,"").trim();
  return CLUB_ALIASES[key]||key;
}

// These aliases are naming differences, not additional fixtures.
const COMPETITION_ALIASES = {
  "fa community shield": "community shield",
  "dfl supercup": "super cup",
  "dfb pokal": "dfb pokal",
  "norwegian first division": "1 division",
  "1 divisjon": "1 division",
  "norwegian cup": "cup",
  "austrian bundesliga": "bundesliga",
};
export const canonicalHistoricalCompetition = (value) => COMPETITION_ALIASES[keyText(value)] || keyText(value);
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

// Team (Base44) and PlayerSeasonStats (FotMob) can describe the SAME club
// with different ID fields. Reconcile by verified FotMob ID and by a unique
// normalized club name, without hiding genuinely contradictory IDs.
export const historicalTeamCatalog = (stats = [], teams = []) => {
  const groups = new Map();
  const add = (name, internalId, fotmobId, fromTeam) => {
    const canonicalName = canonicalHistoricalClub(name);
    if (!canonicalName) return;
    const group = groups.get(canonicalName) || {
      names: new Set(), databaseIds: new Set(), statIds: new Set(), fotmobIds: new Set(),
      canonicalName, teamName: "",
    };
    if (name) group.names.add(text(name));
    if (fromTeam && internalId) { group.databaseIds.add(text(internalId)); group.teamName = text(name); }
    if (!fromTeam && internalId) group.statIds.add(text(internalId));
    if (fotmobId) group.fotmobIds.add(text(fotmobId));
    groups.set(canonicalName, group);
  };
  for (const t of teams) add(t.name, t.id, t.fotmob_id, true);
  for (const r of stats) add(r.team_name, r.team_id, r.fotmob_team_id, false);
  return [...groups.values()].map(g => ({
    ...g,
    team_id: [...g.databaseIds][0] || [...g.statIds][0] || "",
    fotmob_team_id: [...g.fotmobIds][0] || "",
    team_name: g.teamName || [...g.names][0] || "",
    ambiguous: g.databaseIds.size > 1 || g.fotmobIds.size > 1 ||
      (g.statIds.size > 1 && ![...g.statIds].every(id => g.databaseIds.has(id))),
  }));
};
export function resolveHistoricalTeam(item, stats=[], teams=[], catalog=null) {
  const candidates = catalog || historicalTeamCatalog(stats, teams);
  const id = text(item.team_id);
  const fotmob = text(item.fotmob_team_id);
  const name = canonicalHistoricalClub(item.team_name);
  let matches = id
    ? candidates.filter(c => c.databaseIds.has(id) || c.statIds.has(id))
    : fotmob
      ? candidates.filter(c => c.fotmobIds.has(fotmob))
      : candidates.filter(c => name && c.canonicalName === name);
  if (id && fotmob) matches = matches.filter(c => c.fotmobIds.size === 0 || c.fotmobIds.has(fotmob));
  if (name && matches.length && !matches.every(c => c.canonicalName === name))
    return { team: null, error: "El nombre del club no coincide con el ID indicado. Comprueba la identidad." };
  if (matches.length !== 1 || matches[0].ambiguous) return {
    team: null,
    error: matches.length > 1 || matches[0]?.ambiguous
      ? "Se han detectado IDs incompatibles para este club. Revisa la vinculación del equipo."
      : "Club no reconocido en los equipos ni en las estadísticas históricas del jugador.",
  };
  const m = matches[0];
  return { team: {
    team_id: m.team_id, fotmob_team_id: m.fotmob_team_id,
    team_name: m.team_name,
  }, error: "" };
}

// Explicit user choice for unknown aliases. Apply to all identical names in
// the pasted JSON, without touching any row with a pre-existing trusted ID.
// The user still reviews the preview before anything is persisted.
export function withHistoricalTeamChoice(jsonText,originalName,team){
  if(!team?.id||!team?.name)throw Error("Selecciona un equipo existente con identificador.");
  const json=JSON.parse(jsonText);
  const wanted=canonicalHistoricalClub(originalName);
  if(!wanted||!Array.isArray(json.team_matches))throw Error("No se encontró el nombre de origen.");
  let changed=0;
  json.team_matches=json.team_matches.map(row=>{
    if(!row || canonicalHistoricalClub(row.team_name)!==wanted ||
       text(row.team_id)||text(row.fotmob_team_id))return row;
    changed++;
    return {...row,team_name:text(team.name),team_id:text(team.id)};
  });
  if(!changed)throw Error("No hay filas sin identificar para vincular con ese club.");
  return {source:JSON.stringify(json,null,2),count:changed};
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
  let skippedMissingTeamMatches = 0;
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
    // Posición opcional de la carta FIFA/FC. Vacío o null se OMITE: nunca
    // sobrescribe una corrección manual ni un dato ya guardado.
    const fifaPosition = text(r.fifa_fc_position).toUpperCase().replace(/[^A-Z]/g, "");
    if (fifaPosition) {
      if (fifaPosition.length > 6) errors.push("Posición FIFA/FC no válida.");
      else payload.fifa_fc_position = fifaPosition;
    }
    if (payload.fifa_fc_overall === undefined && payload.transfermarkt_value_eur === undefined)
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
    // An unknown team match count is NOT zero and is NOT a bad record.
    // Do not resolve/link/write anything for it; keep any existing value intact.
    if (r.team_matches === null || r.team_matches === undefined || text(r.team_matches) === "") {
      skippedMissingTeamMatches++;
      continue;
    }
    const season = normalizeSeason(r.season);
    const competition = text(r.competition);
    if (!validSeason(season)) errors.push("Temporada inválida.");
    if (!competition) errors.push("Falta la competición.");
    const n = Number(r.team_matches);
    if (!Number.isInteger(n) || n < 1 || n > 200)
      errors.push("PJ Equipo debe ser entero entre 1 y 200.");
    const resolved = resolveHistoricalTeam(r, stats, teams);
    if (resolved.error) errors.push(resolved.error);
    const team = resolved.team;
    const dupKey = "t:" + (team?.team_id || team?.fotmob_team_id || keyText(r.team_name)) + "|" + season + "|" + canonicalHistoricalCompetition(competition);
    if (seen.has(dupKey)) { errors.push("Competición del club duplicada en el JSON."); duplicateKeys.add(dupKey); }
    seen.add(dupKey);
    // Prefer FotMob's competition label already present in this player's data.
    // A competition in which he never played retains its original JSON label;
    // the lookup compares safely-normalized aliases in either case.
    const observedCompetition = team
      ? stats.find(s => text(s.season) === season &&
          canonicalHistoricalCompetition(s.competition) === canonicalHistoricalCompetition(competition) &&
          (team.fotmob_team_id
            ? text(s.fotmob_team_id) === team.fotmob_team_id
            : text(s.team_id) === team.team_id))
      : null;
    const storedCompetition = observedCompetition ? text(observedCompetition.competition) : competition;
    const payload = team ? {
      team_id: team.team_id,
      fotmob_team_id: team.fotmob_team_id,
      team_name: team.team_name || text(r.team_name),
      season, competition: storedCompetition,
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
  result.skippedMissingTeamMatches = skippedMissingTeamMatches;
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