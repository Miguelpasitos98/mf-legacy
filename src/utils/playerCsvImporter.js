/**
 * MF LEGACY
 * Football Manager CSV -> Player importer utilities
 *
 * Responsibility of this module:
 * - Parse the CSV exported by Football Manager/Moneyball.
 * - Normalize and convert one CSV row into the MF LEGACY Player shape.
 * - Preserve original position strings for traceability.
 * - Return source metadata needed later to resolve Country/Team IDs.
 *
 * This module does NOT create Base44 entities.
 * Players.jsx (or a future service layer) will handle Country/Team/Player persistence.
 */

const DELIMITER = ";";

const POSITION_CODES = new Set([
  "GK",
  "DFC",
  "LD",
  "LI",
  "CRD",
  "CRI",
  "CDM",
  "CM",
  "CAM",
  "EI",
  "ED",
  "DC",
]);

const PLAYER_CSV_COLUMNS = Object.freeze({
  name: "Jugador",
  position: "Posición",
  secondaryPosition: "Posición alternativa",
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
});

const OPTIONAL_TEAM_HEADERS = [
  "Equipo",
  "Club",
  "Team",
  "Club actual",
  "Equipo actual",
  "Team name",
  "Club name",
];

const normalizeHeader = (value) =>
  String(value ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLocaleLowerCase("es-ES")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const HEADER_ALIASES = (() => {
  const aliases = {};

  Object.entries(PLAYER_CSV_COLUMNS).forEach(([key, header]) => {
    aliases[normalizeHeader(header)] = key;
  });

  OPTIONAL_TEAM_HEADERS.forEach((header) => {
    aliases[normalizeHeader(header)] = "team";
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

  const rangeMatch = cleaned.match(
    /^(-?\d+(?:[.,]\d+)?)[\-–—](-?\d+(?:[.,]\d+)?)$/
  );

  if (rangeMatch) {
    const first = Number(
      rangeMatch[1].replace(",", ".")
    );
    const second = Number(
      rangeMatch[2].replace(",", ".")
    );

    if (
      Number.isFinite(first) &&
      Number.isFinite(second)
    ) {
      return (first + second) / 2;
    }
  }

  const match = cleaned.match(/-?\d+(?:[.,]\d+)?/);
  if (!match) return fallback;

  const numeric = Number(
    match[0].replace(",", ".")
  );

  return Number.isFinite(numeric)
    ? numeric
    : fallback;
};

const parseInteger = (value, fallback = 0) => {
  const numeric = parseNumeric(
    value,
    Number.NaN
  );

  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.round(numeric);
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
    .replace(/€/g, "")
    .replace(/p\/a/gi, "")
    .trim()
    .replace(/\s+/g, "");

  const rangeMatch = normalized.match(
    /(-?\d+(?:[.,]\d+)?)[\-–—](-?\d+(?:[.,]\d+)?)([KMB])?/i
  );

  const multiplierFor = (suffix) => {
    const normalizedSuffix = String(
      suffix || ""
    ).toUpperCase();

    if (normalizedSuffix === "K") return 1_000;
    if (normalizedSuffix === "M") return 1_000_000;
    if (normalizedSuffix === "B") return 1_000_000_000;

    return 1;
  };

  if (rangeMatch) {
    const first = Number(
      rangeMatch[1].replace(",", ".")
    );
    const second = Number(
      rangeMatch[2].replace(",", ".")
    );

    if (
      !Number.isFinite(first) ||
      !Number.isFinite(second)
    ) {
      return 0;
    }

    const multiplier =
      multiplierFor(rangeMatch[3]);

    return Math.round(
      ((first + second) / 2) *
        multiplier
    );
  }

  const match = normalized.match(
    /(-?\d+(?:[.,]\d+)?)([KMB])?/i
  );

  if (!match) return 0;

  let number = Number(
    match[1].replace(",", ".")
  );

  if (!Number.isFinite(number)) {
    return 0;
  }

  number *= multiplierFor(
    match[2]
  );

  return Math.round(number);
};

const normalizePositionAtom = (value) => {
  const raw = normalizeHeader(value).replace(/[()]/g, "");

  if (!raw) return "";

  if (["por", "p", "gk", "goalkeeper", "portero"].includes(raw)) return "GK";

  if ([
    "dfc",
    "dfc c",
    "df c",
    "df c c",
    "defensa central",
    "central",
    "libero",
  ].includes(raw)) {
    return "DFC";
  }

  if (["dfd", "df d", "ld", "ltd", "lateral derecho"].includes(raw)) {
    return "LD";
  }

  if (["dfi", "df i", "li", "lti", "lateral izquierdo"].includes(raw)) {
    return "LI";
  }

  if (["crd", "cr d", "carrilero derecho"].includes(raw)) return "CRD";
  if (["cri", "cr i", "carrilero izquierdo"].includes(raw)) return "CRI";

  if (["mcd", "mdc", "mc d", "pivote", "mediocentro defensivo", "dm", "cdm"].includes(raw)) {
    return "CDM";
  }

  if (["mc", "m c", "mec", "mediocentro", "cm"].includes(raw)) {
    return "CM";
  }

  if (["mp c", "mpc", "mp centro", "mediapunta centro", "cam"].includes(raw)) {
    return "CAM";
  }

  if (["mp d", "mp derecho", "ed", "extremo derecho"].includes(raw)) return "ED";
  if (["mp i", "mp izquierdo", "ei", "extremo izquierdo"].includes(raw)) return "EI";

  if (["dc", "dl c", "dlc", "delantero centro", "st", "striker"].includes(raw)) return "DC";

  // Generic side-specific / multi-position FM forms.
  if (raw.startsWith("mp ")) {
    const side = raw.replace(/^mp\s+/, "");
    if (side.includes("d") && !side.includes("i") && !side.includes("c")) return "ED";
    if (side.includes("i") && !side.includes("d") && !side.includes("c")) return "EI";
    if (side.includes("c")) return "CAM";
  }

  if (raw.startsWith("dl ") || raw.startsWith("dl")) {
    if (raw.includes("c")) return "DC";
    if (raw.includes("d")) return "DC";
    if (raw.includes("i")) return "DC";
  }

  // Generic defensive forms.
  if (raw.startsWith("df ")) {
    if (raw.includes("c")) return "DFC";
    if (raw.includes("d")) return "LD";
    if (raw.includes("i")) return "LI";
  }

  // Generic central midfield forms.
  if (raw.startsWith("m ") || raw === "m") {
    if (raw.includes("d")) return "CDM";
    if (raw.includes("c")) return "CM";
    if (raw.includes("i")) return "CM";
  }

  return POSITION_CODES.has(raw.toUpperCase()) ? raw.toUpperCase() : "";
};

const normalizePosition = (value) => {
  const original = normalizeText(value);
  if (!original) return "";

  const normalized = normalizeHeader(
    original
  );

  /*
   * Football Manager can export several positions
   * in one cell, e.g.:
   *   MC, ME/MP (C)
   *   MC, ME (DC), MP (C)
   *
   * We take the first position we can map.
   */
  const parts = normalized
    .split(/[,/;]+/)
    .map((part) =>
      part
        .replace(/[()]/g, "")
        .trim()
    )
    .filter(Boolean);

  for (const part of parts) {
    const mapped =
      normalizePositionAtom(
        part
      );

    if (mapped) {
      return mapped;
    }
  }

  const direct =
    normalizePositionAtom(
      normalized
    );

  if (direct) {
    return direct;
  }

  if (normalized.startsWith("mp")) {
    const inside =
      normalized
        .replace(/^mp\s*/, "");

    if (
      inside.includes("c")
    ) {
      return "CAM";
    }

    if (
      inside.includes("d") &&
      !inside.includes("i")
    ) {
      return "ED";
    }

    if (
      inside.includes("i") &&
      !inside.includes("d")
    ) {
      return "EI";
    }

    return "CAM";
  }

  if (
    normalized.startsWith("dl")
  ) {
    return "DC";
  }

  if (
    normalized.startsWith("df")
  ) {
    if (
      normalized.includes("c")
    ) {
      return "DFC";
    }

    if (
      normalized.includes("d")
    ) {
      return "LD";
    }

    if (
      normalized.includes("i")
    ) {
      return "LI";
    }

    return "DFC";
  }

  return "";
};

const invertInjuryProneness = (value) => {
  const fmValue = parseInteger(value, 0);
  if (!fmValue) return 0;
  return Math.max(0, Math.min(20, 20 - fmValue));
};

/**
 * Parse a semicolon-delimited CSV, including quoted values containing
 * delimiters/newlines. Returns an array of row arrays.
 */
export function parseCsvText(csvText, delimiter = DELIMITER) {
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

      if (row.some((value) => String(value).trim() !== "")) {
        rows.push(row);
      }

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

const createEmptyPositionRatings = () => ({
  GK: 0,
  DFC: 0,
  LD: 0,
  LI: 0,
  CRD: 0,
  CRI: 0,
  CDM: 0,
  CM: 0,
  CAM: 0,
  EI: 0,
  ED: 0,
  DC: 0,
});

export function convertFootballManagerRow(row) {
  const get = (key) => normalizeText(row?.[key]);

  const positionRaw = get("position");
  const secondaryPositionRaw = get("secondaryPosition");

  const teamName = get("team");
  const countryName = get("country");

  const player = {
    name: get("name"),
    date_of_birth: parseDateOfBirth(get("dateOfBirth")),

    // Resolved later by Players.jsx/import service.
    team_id: "",
    country_id: "",

    position_raw: positionRaw,
    position: normalizePosition(positionRaw),
    secondary_position_raw: secondaryPositionRaw,
    secondary_position: normalizePosition(secondaryPositionRaw),

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

    position_ratings: createEmptyPositionRatings(),

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
        salidas_tendencia: parseInteger(get("rushingOut")),
        salida_de_puños: parseInteger(get("punching")),
        reflejos: parseInteger(get("reflexes")),
        saque_con_la_mano: parseInteger(get("throwing")),
      },
    },

    description: "",
  };

  const warnings = [];

  if (!player.name) warnings.push("Missing player name");
  if (!countryName) warnings.push("Missing country");
  if (!teamName) warnings.push("Missing team/club column or value");
  if (!player.position) warnings.push(`Unknown primary position: ${positionRaw || "(empty)"}`);
  if (secondaryPositionRaw && !player.secondary_position) {
    warnings.push(`Unknown secondary position: ${secondaryPositionRaw}`);
  }

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
  return parseCsvText(text, DELIMITER);
}

export function parseFootballManagerCsv(csvText) {
  const rows = parseCsvText(csvText, DELIMITER);
  const { headers, rows: objectRows } = rowsToObjects(rows);

  return {
    headers,
    rows: objectRows,
    players: objectRows.map(convertFootballManagerRow),
  };
}
