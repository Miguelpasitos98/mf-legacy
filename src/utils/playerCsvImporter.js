/**
 * MF LEGACY
 * Football Manager CSV -> Player mapper
 *
 * Este módulo NO crea ni actualiza entidades en Base44.
 * Su única función es:
 * 1. Leer el CSV de Football Manager.
 * 2. Convertir cada fila en el formato de Player.
 * 3. Dejar preparados los datos de Country y Team para resolver sus IDs después.
 */

const POSITION_MAP = {
  GK: "GK",
  PO: "GK",
  POR: "GK",

  DFC: "DFC",
  DF: "DFC",
  "DF(C)": "DFC",
  "DFC (C)": "DFC",

  DFD: "LD",
  "DF(D)": "LD",
  LD: "LD",

  DFI: "LI",
  "DF(I)": "LI",
  LI: "LI",

  CDM: "CDM",

  MC: "CM",
  MEC: "CM",
  "ME(C)": "CM",

  CAM: "CAM",

  EI: "EI",
  MI: "EI",
  "MP(I)": "EI",

  ED: "ED",
  MD: "ED",
  "MP(D)": "ED",

  DC: "DC",
  DLC: "DC",
  "DLC (C)": "DC",

  "MP(C)": "CAM",
};

const MENTAL_FIELDS = {
  Agresividad: "agresividad",
  Anticipación: "anticipacion",
  Valentía: "valentia",
  Serenidad: "serenidad",
  Concentración: "concentracion",
  Consistencia: "consistencia",
  Decisiones: "decisiones",
  Determinación: "determinacion",
  "Juego sucio": "juego_sucio",
  Talento: "talento",
  "Partidos importantes": "partidos_importantes",
  Liderazgo: "liderazgo",
  Desmarques: "movimiento",
  Colocación: "colocacion",
  "Trabajo de equipo": "trabajo_de_equipo",
  Visión: "vision",
  Sacrificio: "sacrificio",
};

const PHYSICAL_FIELDS = {
  Aceleración: "aceleracion",
  Agilidad: "agilidad",
  Equilibrio: "balance",
  "Tendencia a lesionarse": "tendencia_a_lesionarse",
  "Alcance de salto": "alcance_de_salto",
  "Recuperación física": "recuperacion_fisica",
  Velocidad: "velocidad",
  Resistencia: "resistencia",
  Fuerza: "fuerza",
};

const TECHNICAL_FIELDS = {
  "Saques de esquina": "saques_de_esquina",
  Centros: "centros",
  Regate: "regate",
  Remate: "remate",
  Control: "control",
  "Tiros libres": "tiros_libres",
  Cabeceo: "cabeceo",
  "Tiros lejanos": "tiros_lejanos",
  "Saques largos": "saques_largos",
  Marcaje: "marcaje",
  Pases: "pases",
  Penaltis: "penaltis",
  Entradas: "entradas",
  Técnica: "tecnica",
  Polivalencia: "polivalencia",
};

const GOALKEEPING_FIELDS = {
  "Alcance aéreo": "balones_aereos",
  "Mando en el área": "mando_en_el_area",
  Comunicación: "comunicacion",
  Excentricidad: "excentricidad",
  Blocaje: "blocaje",
  "Saques de puerta": "saques_de_puerta",
  "Uno contra uno": "uno_contra_uno",
  Puños: "salida_de_puños",
  Reflejos: "reflejos",
  "Salidas (tendencia)": "salidas_tendencia",
  "Saque con la mano": "saque_con_la_mano",
};

const HEADER_ALIASES = {
  team: [
    "Equipo",
    "Club",
    "Team",
    "Club actual",
    "Current team",
  ],

  country: [
    "País",
    "Pais",
    "Country",
  ],

  name: [
    "Jugador",
    "Player",
    "Name",
  ],

  birthDate: [
    "Nacim.",
    "Nacim",
    "Fecha de nacimiento",
    "Date of birth",
  ],

  primaryPosition: [
    "Posición",
    "Posicion",
    "Position",
  ],

  secondaryPosition: [
    "Posición alternativa",
    "Posicion alternativa",
    "Secondary position",
    "Posición secundaria",
  ],

  style: [
    "Estilo",
    "Style",
  ],

  ca: [
    "CA",
    "Current Ability",
  ],

  cp: [
    "CP",
    "Potential Ability",
  ],

  height: [
    "Altura",
    "Height",
  ],

  rightFoot: [
    "Pierna derecha",
    "Right foot",
  ],

  leftFoot: [
    "Pierna izquierda",
    "Left foot",
  ],

  salary: [
    "Sueldo",
    "Salario",
    "Salary",
    "Wage",
  ],

  shirtNumber: [
    "Nº",
    "No",
    "N°",
    "Numero",
    "Número",
    "Shirt number",
  ],
};

function normalizeKey(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function clamp20(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(20, Math.round(number))
  );
}

function parseNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  const text = String(value)
    .trim()
    .replace(/\s/g, "")
    .replace(/"/g, "");

  if (!text) {
    return 0;
  }

  const normalized = text
    .replace(/\./g, "")
    .replace(",", ".");

  const number = Number(normalized);

  return Number.isFinite(number)
    ? number
    : 0;
}

function parseInteger(value) {
  const number = parseNumber(value);

  return Number.isFinite(number)
    ? Math.round(number)
    : 0;
}

function parseHeight(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return 0;
  }

  const match = String(value).match(
    /[\d]+(?:[.,]\d+)?/
  );

  if (!match) {
    return 0;
  }

  return Math.round(
    Number(
      match[0].replace(",", ".")
    )
  );
}

function parseSalary(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  const text = String(value)
    .trim()
    .replace(/\s/g, "")
    .replace(/€/g, "")
    .replace("/a", "")
    .replace("/pa", "");

  if (!text) {
    return 0;
  }

  const match = text.match(
    /([\d.,]+)([KkMmBb])?/
  );

  if (!match) {
    return 0;
  }

  const base = Number(
    match[1]
      .replace(/\./g, "")
      .replace(",", ".")
  );

  if (!Number.isFinite(base)) {
    return 0;
  }

  const suffix = String(
    match[2] || ""
  ).toUpperCase();

  if (suffix === "K") {
    return Math.round(
      base * 1000
    );
  }

  if (suffix === "M") {
    return Math.round(
      base * 1000000
    );
  }

  if (suffix === "B") {
    return Math.round(
      base * 1000000000
    );
  }

  return Math.round(base);
}

function normalizeDate(value) {
  const text = String(value ?? "").trim();

  if (!text) {
    return "";
  }

  let match = text.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
  );

  if (match) {
    const [
      ,
      day,
      month,
      year,
    ] = match;

    return `${day.padStart(
      2,
      "0"
    )}/${month.padStart(
      2,
      "0"
    )}/${year}`;
  }

  match = text.match(
    /^(\d{1,2})[-.](\d{1,2})[-.](\d{4})$/
  );

  if (match) {
    const [
      ,
      day,
      month,
      year,
    ] = match;

    return `${day.padStart(
      2,
      "0"
    )}/${month.padStart(
      2,
      "0"
    )}/${year}`;
  }

  return text;
}

function cleanCsvCell(value) {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .trim();
}

function findColumn(headers, aliases) {
  const normalizedHeaders =
    new Map(
      headers.map((header) => [
        normalizeKey(header),
        header,
      ])
    );

  for (const alias of aliases) {
    const realHeader =
      normalizedHeaders.get(
        normalizeKey(alias)
      );

    if (
      realHeader !== undefined
    ) {
      return realHeader;
    }
  }

  return "";
}

function getField(
  row,
  headers,
  aliases
) {
  const header = findColumn(
    headers,
    aliases
  );

  return header
    ? cleanCsvCell(row[header])
    : "";
}

function normalizePosition(value) {
  const raw = cleanCsvCell(value);

  if (!raw) {
    return "";
  }

  const key = normalizeKey(raw)
    .replace(/\s+/g, "")
    .toUpperCase();

  if (POSITION_MAP[key]) {
    return POSITION_MAP[key];
  }

  const parts = raw
    .split(/[\/,;]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  for (const part of parts) {
    const mapped =
      POSITION_MAP[
        normalizeKey(part)
          .replace(/\s+/g, "")
          .toUpperCase()
      ];

    if (mapped) {
      return mapped;
    }
  }

  if (/\bDIC\b/i.test(raw)) {
    return "DC";
  }

  if (/\bDC\b/i.test(raw)) {
    return "DC";
  }

  if (
    /\bD\b/i.test(raw) &&
    !/\bI\b/i.test(raw)
  ) {
    return "ED";
  }

  if (
    /\bI\b/i.test(raw) &&
    !/\bD\b/i.test(raw)
  ) {
    return "EI";
  }

  if (/\bC\b/i.test(raw)) {
    return "CAM";
  }

  return raw;
}

function mapStats(row, headers) {
  const mental = {
    agresividad: 0,
    anticipacion: 0,
    valentia: 0,
    serenidad: 0,
    concentracion: 0,
    consistencia: 0,
    decisiones: 0,
    determinacion: 0,
    juego_sucio: 0,
    talento: 0,
    partidos_importantes: 0,
    liderazgo: 0,
    movimiento: 0,
    colocacion: 0,
    trabajo_de_equipo: 0,
    vision: 0,
    sacrificio: 0,
  };

  const physical = {
    aceleracion: 0,
    agilidad: 0,
    balance: 0,
    tendencia_a_lesionarse: 0,
    alcance_de_salto: 0,
    alcance_de_salto_recomendado_altura: 0,
    recuperacion_fisica: 0,
    velocidad: 0,
    resistencia: 0,
    fuerza: 0,
  };

  const technical = {
    saques_de_esquina: 0,
    centros: 0,
    regate: 0,
    remate: 0,
    control: 0,
    tiros_libres: 0,
    cabeceo: 0,
    tiros_lejanos: 0,
    saques_largos: 0,
    marcaje: 0,
    pases: 0,
    penaltis: 0,
    entradas: 0,
    tecnica: 0,
    polivalencia: 0,
  };

  const goalkeeping = {
    balones_aereos: 0,
    balones_aereos_recomendado_altura: 0,
    mando_en_el_area: 0,
    comunicacion: 0,
    excentricidad: 0,
    blocaje: 0,
    saques_de_puerta: 0,
    uno_contra_uno: 0,
    reflejos: 0,
    salidas_tendencia: 0,
    salida_de_puños: 0,
    saque_con_la_mano: 0,
  };

  for (
    const [
      csvName,
      playerKey,
    ] of Object.entries(
      MENTAL_FIELDS
    )
  ) {
    const value = getField(
      row,
      headers,
      [csvName]
    );

    mental[playerKey] =
      clamp20(value);
  }

  for (
    const [
      csvName,
      playerKey,
    ] of Object.entries(
      PHYSICAL_FIELDS
    )
  ) {
    const value = getField(
      row,
      headers,
      [csvName]
    );

    /*
     * En MF LEGACY hemos decidido que:
     *
     * 20 = mejor resistencia a lesiones
     * 0  = mayor propensión a lesionarse
     *
     * Por eso invertimos el atributo
     * de Football Manager.
     */
    if (
      playerKey ===
      "tendencia_a_lesionarse"
    ) {
      const fmValue =
        clamp20(value);

      physical[playerKey] =
        20 - fmValue;
    } else {
      physical[playerKey] =
        clamp20(value);
    }
  }

  for (
    const [
      csvName,
      playerKey,
    ] of Object.entries(
      TECHNICAL_FIELDS
    )
  ) {
    technical[playerKey] =
      clamp20(
        getField(
          row,
          headers,
          [csvName]
        )
      );
  }

  for (
    const [
      csvName,
      playerKey,
    ] of Object.entries(
      GOALKEEPING_FIELDS
    )
  ) {
    goalkeeping[playerKey] =
      clamp20(
        getField(
          row,
          headers,
          [csvName]
        )
      );
  }

  return {
    mental,
    physical,
    technical,
    goalkeeping,
  };
}

/**
 * Analiza un CSV separado por ;
 *
 * Devuelve:
 * {
 *   headers: [],
 *   rows: []
 * }
 */
export function parseSemicolonCsv(
  text
) {
  const source = String(
    text ?? ""
  ).replace(/^\uFEFF/, "");

  const rows = [];

  let row = [];
  let cell = "";
  let inQuotes = false;

  for (
    let i = 0;
    i < source.length;
    i += 1
  ) {
    const char = source[i];
    const next =
      source[i + 1];

    if (char === '"') {
      if (
        inQuotes &&
        next === '"'
      ) {
        cell += '"';
        i += 1;
      } else {
        inQuotes =
          !inQuotes;
      }

      continue;
    }

    if (
      char === ";" &&
      !inQuotes
    ) {
      row.push(cell);
      cell = "";
      continue;
    }

    if (
      (char === "\n" ||
        char === "\r") &&
      !inQuotes
    ) {
      if (
        char === "\r" &&
        next === "\n"
      ) {
        i += 1;
      }

      row.push(cell);
      cell = "";

      if (
        row.some(
          (value) =>
            String(
              value
            ).trim() !== ""
        )
      ) {
        rows.push(row);
      }

      row = [];

      continue;
    }

    cell += char;
  }

  row.push(cell);

  if (
    row.some(
      (value) =>
        String(value).trim() !== ""
    )
  ) {
    rows.push(row);
  }

  if (rows.length === 0) {
    return {
      headers: [],
      rows: [],
    };
  }

  const headers =
    rows[0].map(
      cleanCsvCell
    );

  const dataRows =
    rows
      .slice(1)
      .map((values) => {
        const object = {};

        headers.forEach(
          (
            header,
            index
          ) => {
            object[header] =
              cleanCsvCell(
                values[index] ??
                  ""
              );
          }
        );

        return object;
      });

  return {
    headers,
    rows: dataRows,
  };
}

export function mapPlayerRow(
  row,
  headers = Object.keys(row)
) {
  const teamName =
    getField(
      row,
      headers,
      HEADER_ALIASES.team
    );

  const countryName =
    getField(
      row,
      headers,
      HEADER_ALIASES.country
    );

  const primaryRaw =
    getField(
      row,
      headers,
      HEADER_ALIASES.primaryPosition
    );

  const secondaryRaw =
    getField(
      row,
      headers,
      HEADER_ALIASES.secondaryPosition
    );

  return {
    name: getField(
      row,
      headers,
      HEADER_ALIASES.name
    ),

    date_of_birth:
      normalizeDate(
        getField(
          row,
          headers,
          HEADER_ALIASES.birthDate
        )
      ),

    /*
     * Los IDs se resolverán después
     * contra las entidades Country y Team.
     */
    team_id: "",
    country_id: "",

    position:
      normalizePosition(
        primaryRaw
      ),

    secondary_position:
      normalizePosition(
        secondaryRaw
      ),

    /*
     * Conservamos también
     * los valores originales de FM.
     */
    position_raw:
      primaryRaw,

    secondary_position_raw:
      secondaryRaw,

    style: getField(
      row,
      headers,
      HEADER_ALIASES.style
    ),

    height:
      parseHeight(
        getField(
          row,
          headers,
          HEADER_ALIASES.height
        )
      ),

    right_foot:
      getField(
        row,
        headers,
        HEADER_ALIASES.rightFoot
      ),

    left_foot:
      getField(
        row,
        headers,
        HEADER_ALIASES.leftFoot
      ),

    shirt_number:
      parseInteger(
        getField(
          row,
          headers,
          HEADER_ALIASES.shirtNumber
        )
      ),

    salary:
      parseSalary(
        getField(
          row,
          headers,
          HEADER_ALIASES.salary
        )
      ),

    ca:
      parseInteger(
        getField(
          row,
          headers,
          HEADER_ALIASES.ca
        )
      ),

    cp:
      parseInteger(
        getField(
          row,
          headers,
          HEADER_ALIASES.cp
        )
      ),

    position_ratings: {
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
    },

    stats: mapStats(
      row,
      headers
    ),

    photo_url: "",
    card_photo_url: "",
    national_card_photo_url: "",
    description: "",

    /*
     * Datos originales necesarios
     * para resolver Country y Team.
     * Posteriormente podremos eliminarlos
     * del objeto final antes de guardar.
     */
    _source: {
      team_name: teamName,
      country_name:
        countryName,
    },
  };
}

export function convertCsvToPlayers(
  csvText
) {
  const {
    headers,
    rows,
  } = parseSemicolonCsv(
    csvText
  );

  const players = rows.map(
    (row, index) => {
      const player =
        mapPlayerRow(
          row,
          headers
        );

      const warnings = [];

      if (!player.name) {
        warnings.push(
          "Missing player name."
        );
      }

      if (
        !player._source
          .country_name
      ) {
        warnings.push(
          "Missing country."
        );
      }

      if (
        !player._source
          .team_name
      ) {
        warnings.push(
          "Missing team/club column or team value."
        );
      }

      return {
        row_number:
          index + 2,

        player,

        warnings,
      };
    }
  );

  return {
    delimiter: ";",
    headers,
    total_rows:
      rows.length,
    players,
  };
}

/**
 * Devuelve un análisis del CSV con la forma que espera Players.jsx:
 *
 * {
 *   delimiter,
 *   headers,
 *   total_rows,
 *   players: [{ row_number, player, source: { teamName, countryName }, warnings }]
 * }
 *
 * Es un adaptador sobre `convertCsvToPlayers` que expone los datos
 * originales del club/país bajo `source` con nombres en camelCase.
 */
export function parseFootballManagerCsv(
  csvText
) {
  const result = convertCsvToPlayers(
    csvText
  );

  const players = result.players.map(
    (entry) => {
      const source = {
        teamName:
          entry?.player?._source
            ?.team_name || "",
        countryName:
          entry?.player?._source
            ?.country_name || "",
      };

      const player = {
        ...entry.player,
      };

      /*
       * Eliminamos `_source` del jugador final
       * para no enviarlo a Base44 al crear el Player.
       */
      delete player._source;

      return {
        row_number: entry.row_number,
        player,
        source,
        warnings: entry.warnings || [],
      };
    }
  );

  return {
    delimiter: result.delimiter,
    headers: result.headers,
    total_rows: result.total_rows,
    players,
  };
}

export default {
  parseSemicolonCsv,
  mapPlayerRow,
  convertCsvToPlayers,
  parseFootballManagerCsv,
};