/**
 * MF LEGACY
 * Football Manager Editor/CSV -> Player importer utilities
 *
 * Responsibility of this module:
 * - Parse CSV generated from Football Manager Editor screenshots or exports.
 * - Preserve the Football Manager position text exactly as source data.
 * - Import the complete position-rating screen without interpreting positions.
 * - Convert one CSV row into the MF LEGACY Player shape.
 * - Return source metadata needed later to resolve Country/Team IDs.
 *
 * This module does NOT create Base44 entities.
 * Players.jsx (or a future service layer) handles Country/Team/Player persistence.
 */

const DEFAULT_DELIMITER = ";";

const POSITION_RATING_FIELDS = Object.freeze([
  { key: "portero", header: "Portero", english: "portero" },
  { key: "defensa_izquierdo", header: "Defensa izquierdo", english: "defensa_izquierdo" },
  { key: "defensa_central", header: "Defensa central", english: "defensa_central" },
  { key: "defensa_derecho", header: "Defensa derecho", english: "defensa_derecho" },
  { key: "mediocentro", header: "Mediocentro", english: "mediocentro" },
  { key: "carrilero_izquierdo", header: "Carrilero izquierdo", english: "carrilero_izquierdo" },
  { key: "carrilero_derecho", header: "Carrilero derecho", english: "carrilero_derecho" },
  { key: "centrocampista_izquierdo", header: "Centrocampista izquierdo", english: "centrocampista_izquierdo" },
  { key: "centrocampista", header: "Centrocampista", english: "centrocampista" },
  { key: "centrocampista_derecho", header: "Centrocampista derecho", english: "centrocampista_derecho" },
  { key: "mediapunta_por_la_izquierda", header: "Mediapunta por la izquierda", english: "mediapunta_por_la_izquierda" },
  { key: "mediapunta_central", header: "Mediapunta central", english: "mediapunta_central" },
  { key: "mediapunta_por_la_derecha", header: "Mediapunta por la derecha", english: "mediapunta_por_la_derecha" },
  { key: "delantero", header: "Delantero", english: "delantero" },
]);

const PLAYER_CSV_COLUMNS = Object.freeze({
  name: "Jugador",
  team: "Equipo",
  fmPosition: "Posición",
  bestPositions: "Mejores puestos",
  roleUsedToFillEmptyAttributes: "Rol utilizado para rellenar atributos vacíos",
  preferredCentralPosition: "Posición central preferida",
  style: "Estilo",
  dateOfBirth: "Nacim.",
  country: "País",
  ca: "CA",
  cp: "CP",
  height: "Altura",
  rightFoot: "Pierna derecha",
  leftFoot: "Pierna izquierda",
  aggression: "Agresividad",
  anticipation: "Anticipación",
  bravery: "Valentía",
  composure: "Serenidad",
  concentration: "Concentración",
  decisions: "Decisiones",
  determination: "Determinación",
  flair: "Talento",
  leadership: "Liderazgo",
  offTheBall: "Desmarques",
  positioning: "Colocación",
  teamwork: "Trabajo de equipo",
  vision: "Visión",
  sacrifice: "Sacrificio",
  acceleration: "Aceleración",
  agility: "Agilidad",
  balance: "Equilibrio",
  jumpingReach: "Alcance de salto",
  naturalFitness: "Recuperación física",
  pace: "Velocidad",
  stamina: "Resistencia",
  strength: "Fuerza",
  corners: "Saques de esquina",
  crossing: "Centros",
  dribbling: "Regate",
  finishing: "Remate",
  firstTouch: "Control",
  freeKickTaking: "Tiros libres",
  heading: "Cabeceo",
  longShots: "Tiros lejanos",
  longThrows: "Saques largos",
  marking: "Marcaje",
  passing: "Pases",
  penaltyTaking: "Penaltis",
  tackling: "Entradas",
  technique: "Técnica",
  aerialReach: "Alcance aéreo",
  commandOfArea: "Mando en el área",
  communication: "Comunicación",
  eccentricity: "Excentricidad",
  handling: "Blocaje",
  goalKicks: "Saques de puerta",
  oneOnOnes: "Uno contra uno",
  punching: "Puños",
  reflexes: "Reflejos",
  rushingOut: "Salidas (tendencia)",
  throwing: "Saque con la mano",
  salary: "Sueldo",
  shirtNumber: "Nº",
  importantMatches: "Partidos importantes",
  injuryProneness: "Tendencia a lesionarse",
  consistency: "Consistencia",
  dirtiness: "Juego sucio",
  versatility: "Polivalencia",
  ...Object.fromEntries(
    POSITION_RATING_FIELDS.map((field) => [`positionRating_${field.key}`, field.header])
  ),
});

const OPTIONAL_TEAM_HEADERS = [
  "Equipo",
  "Club",
  "Team",
  "Club actual",
  "Equipo actual",
  "Team name",
  "Club name",
  "team",
];

const HEADER_ENGLISH_ALIASES = Object.freeze({
  name: "name",
  jugador: "name",
  team: "team",
  club: "team",
  position: "fmPosition",
  fm_position: "fmPosition",
  best_positions: "bestPositions",
  best_positions_: "bestPositions",
  mejores_puestos: "bestPositions",
  role_used_to_fill_empty_attributes: "roleUsedToFillEmptyAttributes",
  rol_used_to_fill_empty_attributes: "roleUsedToFillEmptyAttributes",
  rol_utilizado_para_rellenar_atributos_vacios: "roleUsedToFillEmptyAttributes",
  preferred_central_position: "preferredCentralPosition",
  posicion_central_preferida: "preferredCentralPosition",
  position_central_preferida: "preferredCentralPosition",
});

const normalizeHeader = (value) =>
  String(value ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLocaleLowerCase("es-ES")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");

const HEADER_ALIASES = (() => {
  const aliases = {};

  Object.entries(PLAYER_CSV_COLUMNS).forEach(([key, header]) => {
    aliases[normalizeHeader(header)] = key;
  });

  OPTIONAL_TEAM_HEADERS.forEach((header) => {
    aliases[normalizeHeader(header)] = "team";
  });

  POSITION_RATING_FIELDS.forEach((field) => {
    aliases[field.english] = `positionRating_${field.key}`;
    aliases[normalizeHeader(field.header)] = `positionRating_${field.key}`;
  });

  Object.entries(HEADER_ENGLISH_ALIASES).forEach(([header, key]) => {
    aliases[normalizeHeader(header)] = key;
  });

  // Full set of existing source/stat keys in snake_case English.
  const snakeAliases = {
    style: "style",
    date_of_birth: "dateOfBirth",
    country: "country",
    ca: "ca",
    cp: "cp",
    height: "height",
    right_foot: "rightFoot",
    left_foot: "leftFoot",
    shirt_number: "shirtNumber",
    salary: "salary",
    aggression: "aggression",
    anticipation: "anticipation",
    bravery: "bravery",
    composure: "composure",
    concentration: "concentration",
    decisions: "decisions",
    determination: "determination",
    flair: "flair",
    leadership: "leadership",
    off_the_ball: "offTheBall",
    positioning: "positioning",
    teamwork: "teamwork",
    vision: "vision",
    sacrifice: "sacrifice",
    acceleration: "acceleration",
    agility: "agility",
    balance: "balance",
    jumping_reach: "jumpingReach",
    natural_fitness: "naturalFitness",
    pace: "pace",
    stamina: "stamina",
    strength: "strength",
    corners: "corners",
    crossing: "crossing",
    dribbling: "dribbling",
    finishing: "finishing",
    first_touch: "firstTouch",
    free_kick_taking: "freeKickTaking",
    heading: "heading",
    long_shots: "longShots",
    long_throws: "longThrows",
    marking: "marking",
    passing: "passing",
    penalty_taking: "penaltyTaking",
    tackling: "tackling",
    technique: "technique",
    aerial_reach: "aerialReach",
    command_of_area: "commandOfArea",
    communication: "communication",
    eccentricity: "eccentricity",
    handling: "handling",
    goal_kicks: "goalKicks",
    one_on_ones: "oneOnOnes",
    punching: "punching",
    reflexes: "reflexes",
    rushing_out: "rushingOut",
    throwing: "throwing",
    important_matches: "importantMatches",
    injury_proneness: "injuryProneness",
    consistency: "consistency",
    dirtiness: "dirtiness",
    versatility: "versatility",
  };

  Object.entries(snakeAliases).forEach(([header, key]) => {
    aliases[header] = key;
  });

  return aliases;
})();

const normalizeText = (value) => String(value ?? "").trim();

const parseNumeric = (value, fallback = 0) => {
  const raw = normalizeText(value);
  if (!raw) return fallback;

  const cleaned = raw
    .replace(/\s+/g, "")
    .replace(/[€$£¥]/g, "")
    .replace(/p\/a/gi, "");

  const match = cleaned.match(/-?\d+(?:[.,]\d+)?/);
  if (!match) return fallback;

  const numeric = Number(match[0].replace(",", "."));
  return Number.isFinite(numeric) ? numeric : fallback;
};

const parseInteger = (value, fallback = 0) => {
  const numeric = parseNumeric(value, Number.NaN);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.trunc(numeric);
};

const parseDateOfBirth = (value) => {
  const raw = normalizeText(value);
  if (!raw) return "";

  const match = raw.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
  if (!match) return raw;

  const [, day, month, year] = match;
  return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
};

const parseHeight = (value) => {
  const raw = normalizeText(value);
  if (!raw) return 0;

  const match = raw.match(/\d+(?:[.,]\d+)?/);
  if (!match) return 0;

  const height = Number(match[0].replace(",", "."));
  return Number.isFinite(height) ? Math.round(height) : 0;
};

const parseSalary = (value) => {
  const raw = normalizeText(value);
  if (!raw) return 0;

  const normalized = raw
    .replace(/\u00A0/g, " ")
    .replace(/[€$£¥]/g, "")
    .replace(/p\/a/gi, "")
    .trim()
    .replace(/\s+/g, "");

  const match = normalized.match(/(-?[\d.,]+)([KMB])?/i);
  if (!match) return 0;

  const rawNumber = match[1];
  const suffix = String(match[2] || "").toUpperCase();
  let number;

  if (suffix) {
    // With K/M/B, a comma or dot is treated as a decimal separator.
    number = Number(rawNumber.replace(/,/g, "."));
  } else if (/^-?\d{1,3}(?:,\d{3})+$/.test(rawNumber)) {
    // 10,530,000 -> 10530000
    number = Number(rawNumber.replace(/,/g, ""));
  } else if (/^-?\d{1,3}(?:\.\d{3})+$/.test(rawNumber)) {
    // 10.530.000 -> 10530000
    number = Number(rawNumber.replace(/\./g, ""));
  } else if (/^-?\d+,\d+$/.test(rawNumber)) {
    // Decimal comma, e.g. 10,53
    number = Number(rawNumber.replace(",", "."));
  } else {
    number = Number(rawNumber);
  }

  if (!Number.isFinite(number)) return 0;

  if (suffix === "K") number *= 1_000;
  if (suffix === "M") number *= 1_000_000;
  if (suffix === "B") number *= 1_000_000_000;

  return Math.round(number);
};

const invertInjuryProneness = (value) => {
  const fmValue = parseInteger(value, 0);
  if (!fmValue) return 0;
  return Math.max(0, Math.min(20, 20 - fmValue));
};

const detectDelimiter = (csvText) => {
  const sample = String(csvText ?? "").slice(0, 8000);
  const candidates = [",", ";", "\t"];

  const counts = candidates.map((delimiter) => {
    let count = 0;
    let inQuotes = false;

    for (let index = 0; index < sample.length; index += 1) {
      const char = sample[index];
      const nextChar = sample[index + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          index += 1;
          continue;
        }
        inQuotes = !inQuotes;
        continue;
      }

      if (!inQuotes && char === delimiter) count += 1;
    }

    return { delimiter, count };
  });

  counts.sort((a, b) => b.count - a.count);
  return counts[0]?.count > 0 ? counts[0].delimiter : DEFAULT_DELIMITER;
};

/**
 * Parse a delimited CSV, including quoted values containing delimiters/newlines.
 */
export function parseCsvText(csvText, delimiter = DEFAULT_DELIMITER) {
  const text = String(csvText ?? "").replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        field += '"';
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && char === delimiter) {
      row.push(field);
      field = "";
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && nextChar === "\n") index += 1;

      row.push(field);
      field = "";

      if (row.some((value) => String(value).trim() !== "")) rows.push(row);
      row = [];
      continue;
    }

    field += char;
  }

  row.push(field);
  if (row.some((value) => String(value).trim() !== "")) rows.push(row);

  return rows;
}

const rowsToObjects = (rows) => {
  if (!rows.length) return { headers: [], rows: [] };

  const rawHeaders = rows[0].map((header) => normalizeText(header));
  const headers = rawHeaders.map((header) => HEADER_ALIASES[normalizeHeader(header)] || header);

  const objects = rows.slice(1).map((values) => {
    const object = {};
    headers.forEach((header, index) => {
      object[header] = normalizeText(values[index] ?? "");
    });
    return object;
  });

  return {
    headers: rawHeaders,
    rows: objects,
  };
};

const createEmptyPositionRatings = () =>
  POSITION_RATING_FIELDS.reduce((result, field) => {
    result[field.key] = 0;
    return result;
  }, {});

export function convertFootballManagerRow(row) {
  const get = (key) => normalizeText(row?.[key]);

  const teamName = get("team");
  const countryName = get("country");

  const positionRatings = createEmptyPositionRatings();
  POSITION_RATING_FIELDS.forEach((field) => {
    positionRatings[field.key] = parseInteger(
      get(`positionRating_${field.key}`),
      0
    );
  });

  const player = {
    name: get("name"),
    date_of_birth: parseDateOfBirth(get("dateOfBirth")),

    // Resolved later by Players.jsx/import service.
    team_id: "",
    country_id: "",

    fm_position: get("fmPosition"),
    best_positions: get("bestPositions"),
    role_used_to_fill_empty_attributes: get("roleUsedToFillEmptyAttributes"),
    preferred_central_position: get("preferredCentralPosition"),

    style: get("style"),
    height: parseHeight(get("height")),
    right_foot: get("rightFoot"),
    left_foot: get("leftFoot"),
    shirt_number: parseInteger(get("shirtNumber"), 0),
    salary: parseSalary(get("salary")),

    photo_url: "",
    card_photo_url: "",
    national_card_photo_url: "",

    ca: parseInteger(get("ca"), 0),
    cp: parseInteger(get("cp"), 0),

    position_ratings: positionRatings,

    stats: {
      mental: {
        agresividad: parseInteger(get("aggression")),
        anticipacion: parseInteger(get("anticipation")),
        valentia: parseInteger(get("bravery")),
        serenidad: parseInteger(get("composure")),
        concentracion: parseInteger(get("concentration")),
        consistencia: parseInteger(get("consistency")),
        decisiones: parseInteger(get("decisions")),
        determinacion: parseInteger(get("determination")),
        juego_sucio: parseInteger(get("dirtiness")),
        talento: parseInteger(get("flair")),
        partidos_importantes: parseInteger(get("importantMatches")),
        liderazgo: parseInteger(get("leadership")),
        movimiento: parseInteger(get("offTheBall")),
        colocacion: parseInteger(get("positioning")),
        trabajo_de_equipo: parseInteger(get("teamwork")),
        vision: parseInteger(get("vision")),
        sacrificio: parseInteger(get("sacrifice")),
      },

      physical: {
        aceleracion: parseInteger(get("acceleration")),
        agilidad: parseInteger(get("agility")),
        balance: parseInteger(get("balance")),
        tendencia_a_lesionarse: invertInjuryProneness(get("injuryProneness")),
        alcance_de_salto: parseInteger(get("jumpingReach")),
        alcance_de_salto_recomendado_altura: 0,
        recuperacion_fisica: parseInteger(get("naturalFitness")),
        velocidad: parseInteger(get("pace")),
        resistencia: parseInteger(get("stamina")),
        fuerza: parseInteger(get("strength")),
      },

      technical: {
        saques_de_esquina: parseInteger(get("corners")),
        centros: parseInteger(get("crossing")),
        regate: parseInteger(get("dribbling")),
        remate: parseInteger(get("finishing")),
        control: parseInteger(get("firstTouch")),
        tiros_libres: parseInteger(get("freeKickTaking")),
        cabeceo: parseInteger(get("heading")),
        tiros_lejanos: parseInteger(get("longShots")),
        saques_largos: parseInteger(get("longThrows")),
        marcaje: parseInteger(get("marking")),
        pases: parseInteger(get("passing")),
        penaltis: parseInteger(get("penaltyTaking")),
        entradas: parseInteger(get("tackling")),
        tecnica: parseInteger(get("technique")),
        polivalencia: parseInteger(get("versatility")),
      },

      goalkeeping: {
        balones_aereos: parseInteger(get("aerialReach")),
        balones_aereos_recomendado_altura: 0,
        mando_en_el_area: parseInteger(get("commandOfArea")),
        comunicacion: parseInteger(get("communication")),
        excentricidad: parseInteger(get("eccentricity")),
        blocaje: parseInteger(get("handling")),
        saques_de_puerta: parseInteger(get("goalKicks")),
        uno_contra_uno: parseInteger(get("oneOnOnes")),
        salida_de_puños: parseInteger(get("punching")),
        reflejos: parseInteger(get("reflexes")),
        salidas_tendencia: parseInteger(get("rushingOut")),
        saque_con_la_mano: parseInteger(get("throwing")),
      },
    },

    description: "",
  };

  const warnings = [];

  if (!player.name) warnings.push("Missing player name");
  if (!countryName) warnings.push("Missing country");
  if (!teamName) warnings.push("Missing team/club column or value");

  return {
    player,
    source: {
      countryName,
      teamName,
    },
    warnings,
    raw: row,
  };
}

export async function readCsvFile(file) {
  if (!(file instanceof File)) {
    throw new TypeError("readCsvFile expects a File object.");
  }

  const text = await file.text();
  return parseCsvText(text, detectDelimiter(text));
}

export function parseFootballManagerCsv(csvText) {
  const delimiter = detectDelimiter(csvText);
  const rows = parseCsvText(csvText, delimiter);
  const { headers, rows: objectRows } = rowsToObjects(rows);
  const players = objectRows.map(convertFootballManagerRow);

  return {
    headers,
    delimiter,
    rows: objectRows,
    players,
    total_rows: players.length,
  };
}

export { POSITION_RATING_FIELDS };
