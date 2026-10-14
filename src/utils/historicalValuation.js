// Utilidades para importar y validar valoraciones historicas de FIFA/FC y Transfermarkt.
// Entidad: PlayerHistoricalValuation (player_id + season = clave unica).
// No toca PlayerSeasonStats, CraftedFC ni FM26.

export const normalize = (v) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

// --- Temporadas ---

// Normaliza separadores de temporadas partidas (2022-2023 -> 2022/2023).
// NO convierte un ano natural (2019) en temporada partida.
export const normalizeSeason = (raw) => {
  const t = String(raw ?? "").trim();
  if (!t) return "";
  const m = t.match(/^(\d{4})[/\-](\d{2}|\d{4})$/);
  if (m) {
    const start = m[1];
    const end = m[2].length === 2 ? start.slice(0, 2) + m[2] : m[2];
    return `${start}/${end}`;
  }
  return t;
};

export const isSplitSeason = (season) =>
  /^\d{4}\/\d{4}$/.test(String(season || ""));

// Deduce la edicion de FIFA/FC para una temporada partida.
// 2022/2023 -> FIFA 23; 2023/2024 -> FC 24; etc.
// Para anos naturales NO deduce edicion (devuelve "").
export const fifaEditionForSeason = (season) => {
  const m = String(season || "").match(/^(\d{4})\/\d{4}$/);
  if (!m) return "";
  const start = Number(m[1]);
  const editionNumber = 23 + (start - 2022);
  if (editionNumber >= 24) return `FC ${editionNumber}`;
  return `FIFA ${editionNumber}`;
};

// --- Parsing de valores ---

// Parsea un overall de FIFA/FC. Entero 1-99. Vacio = null.
export const parseOverall = (raw) => {
  if (raw === null || raw === undefined) return null;
  const t = String(raw).trim();
  if (!t || t === "—" || t === "-") return null;
  const n = Number(t.replace(/[^\d]/g, ""));
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  if (!Number.isInteger(rounded) || rounded < 1 || rounded > 99) return "invalid";
  return rounded;
};

// Parsea un valor de mercado de Transfermarkt en euros.
// Admite: 180000000, 180.000.000, 180,000,000, 180 M€, 180M, 1.8M, etc.
// Vacio = null (NO cero). Negativos = "invalid".
export const parseMarketValue = (raw) => {
  if (raw === null || raw === undefined) return null;
  let t = String(raw).trim().replace(/[€$]/g, "").replace(/\s/g, "");
  if (!t || t === "—" || t === "-") return null;

  // Sufijo de millones (M) o miles (K)
  const suffix = t.match(/^([\d.,]+)([mMkK])$/);
  if (suffix) {
    const n = stripSeparators(suffix[1]);
    if (n === null) return "invalid";
    const mult = /[mM]/.test(suffix[2]) ? 1e6 : 1e3;
    const result = n * mult;
    return result < 0 ? "invalid" : Math.round(result);
  }

  const n = stripSeparators(t);
  if (n === null) return "invalid";
  if (n < 0) return "invalid";
  return Math.round(n);
};

// Elimina separadores de miles y normaliza el separador decimal.
const stripSeparators = (s) => {
  let c = String(s).trim();
  if (!c) return null;
  const hasDot = c.includes(".");
  const hasComma = c.includes(",");

  if (hasDot && hasComma) {
    if (c.lastIndexOf(".") > c.lastIndexOf(",")) {
      c = c.replace(/,/g, "");
    } else {
      c = c.replace(/\./g, "").replace(",", ".");
    }
  } else if (hasComma) {
    c = c.replace(/,(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  } else if (hasDot) {
    const dotCount = (c.match(/\./g) || []).length;
    if (dotCount > 1) {
      c = c.replace(/\./g, "");
    } else {
      const parts = c.split(".");
      if (parts[1] && parts[1].length === 3 && Number(parts[0]) >= 1) {
        c = parts[0] + parts[1];
      }
    }
  }
  const n = Number(c);
  return Number.isFinite(n) ? n : null;
};

// --- Validacion de fecha de valoracion ---

// Valida que la fecha no sea posterior al cierre de la temporada:
// 30 de junio para temporadas europeas partidas, 31 de diciembre para anos naturales.
export const validateMarketValueDate = (dateStr, season) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "Fecha no valida";
  const m = String(season || "").match(/^(\d{4})(?:\/(\d{4}))?$/);
  if (!m) return null;
  if (m[2]) {
    const deadline = new Date(Number(m[2]), 5, 30, 23, 59, 59);
    if (d > deadline)
      return `La fecha supera el cierre de la temporada (30/06/${m[2]})`;
  } else {
    const deadline = new Date(Number(m[1]), 11, 31, 23, 59, 59);
    if (d > deadline)
      return `La fecha supera el cierre del ano natural (31/12/${m[1]})`;
  }
  return null;
};

// --- Parser de texto pegado (CSV, TSV, Markdown) ---

const parseCsvLine = (line, delimiter) => {
  const result = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (!inQuotes && c === delimiter) {
      result.push(cell);
      cell = "";
    } else {
      cell += c;
    }
  }
  result.push(cell);
  return result.map((c) => c.trim());
};

// Parsea texto pegado en { header, rows, errors }.
export const parsePastedData = (text) => {
  const raw = String(text || "").replace(/^\uFEFF/, "");
  const errors = [];
  if (!raw.trim()) return { header: [], rows: [], errors: ["Datos vacios."] };

  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return { header: [], rows: [], errors: ["Datos vacios."] };

  const firstLine = lines[0];
  const hasPipe = firstLine.includes("|");
  const hasTab = firstLine.includes("\t");

  let header = [];
  let dataRows = [];

  if (hasPipe && lines[0].split("|").filter((c) => c.trim()).length >= 2) {
    // Markdown table
    const tableLines = lines.filter(
      (l, i) => !(i === 1 && l.replace(/[\s|]/g, "").match(/^-+$/))
    );
    const parsed = tableLines.map((l) =>
      l
        .replace(/^\s*\|/, "")
        .replace(/\|\s*$/, "")
        .split("|")
        .map((c) => c.trim())
    );
    header = parsed.shift() || [];
    dataRows = parsed;
  } else if (hasTab) {
    const parsed = lines.map((l) => l.split("\t").map((c) => c.trim()));
    header = parsed.shift() || [];
    dataRows = parsed;
  } else {
    const semis = (firstLine.match(/;/g) || []).length;
    const commas = (firstLine.match(/,/g) || []).length;
    const delimiter = semis >= commas ? ";" : ",";
    const parsed = lines.map((l) => parseCsvLine(l, delimiter));
    header = parsed.shift() || [];
    dataRows = parsed;
  }

  if (!header.length || !dataRows.length) {
    errors.push("No se detectaron filas con datos.");
  }
  return { header, rows: dataRows, errors };
};

// --- Mapeo de cabeceras ---

const HEADER_ALIASES = {
  season: ["season", "temporada", "ano", "year"],
  fifa_fc_overall: [
    "fifa_fc_overall",
    "fifa/fc overall",
    "fifa fc overall",
    "overall",
    "fifa overall",
    "fc overall",
    "ovr",
  ],
  transfermarkt_value_eur: [
    "transfermarkt_value_eur",
    "transfermarkt (eur)",
    "transfermarkt",
    "valor",
    "valor de mercado",
    "market_value_eur",
    "market value",
    "valor mercado",
  ],
  fifa_edition: [
    "fifa_edition",
    "edicion",
    "fifa/fc",
    "fifa fc",
    "edition",
    "fifa_fc_edition",
  ],
  fifa_source_url: ["fifa_source_url", "fuente fifa", "fifa source"],
  transfermarkt_source_url: [
    "transfermarkt_source_url",
    "fuente transfermarkt",
    "transfermarkt source",
  ],
  market_value_as_of: [
    "market_value_as_of",
    "fecha",
    "fecha valor",
    "market value date",
    "date",
    "market_value_date",
  ],
  market_value_status: ["market_value_status", "estado valor", "valor status"],
  notes: ["notes", "notas", "observaciones"],
};

const findField = (row, header, names) => {
  for (let i = 0; i < header.length; i++) {
    if (names.includes(normalize(header[i]))) return String(row[i] ?? "").trim();
  }
  return "";
};

// Convierte filas parseadas en objetos normalizados.
export const buildRowsFromParsed = ({ header, rows }) => {
  const result = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const season = normalizeSeason(
      findField(row, header, HEADER_ALIASES.season)
    );
    const overallRaw = findField(row, header, HEADER_ALIASES.fifa_fc_overall);
    const valueRaw = findField(
      row,
      header,
      HEADER_ALIASES.transfermarkt_value_eur
    );
    const edition = findField(row, header, HEADER_ALIASES.fifa_edition);
    const dateStr = findField(row, header, HEADER_ALIASES.market_value_as_of);
    const fifaSource = findField(
      row,
      header,
      HEADER_ALIASES.fifa_source_url
    );
    const tmSource = findField(
      row,
      header,
      HEADER_ALIASES.transfermarkt_source_url
    );
    const status = findField(row, header, HEADER_ALIASES.market_value_status);
    const notes = findField(row, header, HEADER_ALIASES.notes);

    const overall = parseOverall(overallRaw);
    const value = parseMarketValue(valueRaw);

    result.push({
      rowIndex: i,
      season,
      fifa_edition: edition || (season ? fifaEditionForSeason(season) : ""),
      fifa_fc_overall: overall === "invalid" ? null : overall,
      fifa_fc_overall_raw: overallRaw,
      fifa_fc_overall_invalid: overall === "invalid",
      transfermarkt_value_eur: value === "invalid" ? null : value,
      transfermarkt_value_eur_raw: valueRaw,
      transfermarkt_value_eur_invalid: value === "invalid",
      market_value_as_of: dateStr,
      fifa_source_url: fifaSource,
      transfermarkt_source_url: tmSource,
      market_value_status: status,
      notes,
    });
  }
  return result;
};

// --- Validacion ---

export const validateRow = (row) => {
  const errors = [];
  if (!row.season) errors.push("Falta temporada.");
  if (row.fifa_fc_overall_invalid)
    errors.push("Overall fuera de rango (1-99).");
  if (row.transfermarkt_value_eur_invalid)
    errors.push("Valor de mercado no valido o negativo.");
  if (
    row.fifa_fc_overall === null &&
    row.transfermarkt_value_eur === null &&
    !errors.length
  )
    errors.push("Sin Overall ni valor de mercado.");
  const dateError = validateMarketValueDate(
    row.market_value_as_of,
    row.season
  );
  if (dateError) errors.push(dateError);
  return errors;
};

// Compara una fila importada con un registro existente.
export const compareWithExisting = (row, existing) => {
  if (!existing)
    return { status: "new", reason: "Nuevo registro" };
  const hasOverall = row.fifa_fc_overall !== null;
  const hasValue = row.transfermarkt_value_eur !== null;
  const overallDiff =
    hasOverall &&
    existing.fifa_fc_overall != null &&
    Number(existing.fifa_fc_overall) !== row.fifa_fc_overall;
  const valueDiff =
    hasValue &&
    existing.transfermarkt_value_eur != null &&
    Number(existing.transfermarkt_value_eur) !== row.transfermarkt_value_eur;
  if (overallDiff || valueDiff)
    return {
      status: "update",
      reason: "Actualizara valores existentes",
      existing,
    };
  return { status: "same", reason: "Ya existe sin cambios", existing };
};

// Formatea un valor de mercado para mostrar en euros.
export const formatEur = (value) => {
  if (value === null || value === undefined) return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  if (n >= 1e6) return `${(n / 1e6).toLocaleString("es-ES", { maximumFractionDigits: 1 })} M€`;
  return `${n.toLocaleString("es-ES")} €`;
};

// --- PJ Equipo (TeamSeasonMatches) ---

const TEAM_MATCHES_ALIASES = {
  season: ["season", "temporada", "ano", "year"],
  competition: ["competition", "competicion", "tournament", "torneo", "league", "liga"],
  team_name: ["team_name", "team", "equipo", "club", "club_name", "equipo_nombre"],
  team_matches: ["team_matches", "pj equipo", "partidos equipo", "team matches", "pj_team", "matches", "partidos", "pj"],
  fotmob_team_id: ["fotmob_team_id", "fotmob team id", "team_id", "fotmob_teamid"],
  fotmob_tournament_id: ["fotmob_tournament_id", "fotmob tournament id", "tournament_id"],
  source: ["source", "fuente"],
};

// Convierte filas parseadas en objetos normalizados para PJ Equipo.
export const buildTeamMatchesRows = ({ header, rows }) => {
  const result = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const season = normalizeSeason(findField(row, header, TEAM_MATCHES_ALIASES.season));
    const competition = findField(row, header, TEAM_MATCHES_ALIASES.competition);
    const team_name = findField(row, header, TEAM_MATCHES_ALIASES.team_name);
    const matchesRaw = findField(row, header, TEAM_MATCHES_ALIASES.team_matches);
    const fotmob_team_id = findField(row, header, TEAM_MATCHES_ALIASES.fotmob_team_id);
    const fotmob_tournament_id = findField(row, header, TEAM_MATCHES_ALIASES.fotmob_tournament_id);
    const source = findField(row, header, TEAM_MATCHES_ALIASES.source);

    let team_matches = null;
    let team_matches_invalid = false;
    if (matchesRaw.trim()) {
      const n = parseInt(matchesRaw.replace(/[^\d]/g, ""), 10);
      if (Number.isFinite(n) && n >= 1 && n <= 200) team_matches = n;
      else team_matches_invalid = true;
    }

    result.push({
      rowIndex: i,
      season,
      competition,
      team_name,
      team_matches,
      team_matches_invalid,
      fotmob_team_id,
      fotmob_tournament_id,
      source,
    });
  }
  return result;
};

export const validateTeamMatchesRow = (row) => {
  const errors = [];
  if (!row.season) errors.push("Falta temporada.");
  if (!row.competition) errors.push("Falta competicion.");
  if (row.team_matches_invalid) errors.push("PJ equipo fuera de rango (1-200).");
  if (row.team_matches === null && !row.team_matches_invalid) errors.push("Falta PJ equipo.");
  if (!row.team_name && !row.fotmob_team_id) errors.push("Falta identificador de equipo.");
  return errors;
};