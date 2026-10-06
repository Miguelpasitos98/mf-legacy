/**
 * MF LEGACY
 * Football Manager Editor POSITIONS CSV -> existing Player updater
 *
 * This module is intentionally separate from playerCsvImporter.js.
 *
 * Responsibility:
 * - Read the position-only CSV generated from Football Manager Editor screenshots.
 * - Preserve FM position text exactly as supplied.
 * - Read all 14 position ratings exactly as supplied.
 * - Prepare only the fields that belong to the POSITIONS screen.
 * - Never create Players.
 * - Never change CA, CP, salary, attributes, photos, dates, country, etc.
 */

const DEFAULT_DELIMITER = ",";

const POSITION_FIELDS = Object.freeze([
  "portero",
  "defensa_izquierdo",
  "defensa_central",
  "defensa_derecho",
  "mediocentro",
  "carrilero_izquierdo",
  "carrilero_derecho",
  "centrocampista_izquierdo",
  "centrocampista",
  "centrocampista_derecho",
  "mediapunta_por_la_izquierda",
  "mediapunta_central",
  "mediapunta_por_la_derecha",
  "delantero",
]);

const REQUIRED_HEADERS = Object.freeze([
  "name",
  "team",
  "position",
  "best_positions",
  "role_used_to_fill_empty_attributes",
  "position_central_preferida",
  ...POSITION_FIELDS,
]);

const HEADER_ALIASES = Object.freeze({
  name: "name",
  jugador: "name",
  player: "name",
  team: "team",
  equipo: "team",
  club: "team",
  position: "position",
  posicion: "position",
  "mejores puestos": "best_positions",
  best_positions: "best_positions",
  bestpositions: "best_positions",
  "rol utilizado para rellenar atributos vacios": "role_used_to_fill_empty_attributes",
  role_used_to_fill_empty_attributes: "role_used_to_fill_empty_attributes",
  roleusedtofilrememberptyattributes: "role_used_to_fill_empty_attributes",
  "posicion central preferida": "position_central_preferida",
  position_central_preferida: "position_central_preferida",
  preferred_central_position: "position_central_preferida",
  "posicion central preferred": "position_central_preferida",
  ...Object.fromEntries(POSITION_FIELDS.map((field) => [field, field])),
  portero: "portero",
  "defensa izquierdo": "defensa_izquierdo",
  defensa_izquierdo: "defensa_izquierdo",
  "defensa central": "defensa_central",
  defensa_central: "defensa_central",
  "defensa derecho": "defensa_derecho",
  defensa_derecho: "defensa_derecho",
  mediocentro: "mediocentro",
  "carrilero izquierdo": "carrilero_izquierdo",
  carrilero_izquierdo: "carrilero_izquierdo",
  "carrilero derecho": "carrilero_derecho",
  carrilero_derecho: "carrilero_derecho",
  "centrocampista izquierdo": "centrocampista_izquierdo",
  centrocampista_izquierdo: "centrocampista_izquierdo",
  centrocampista: "centrocampista",
  "centrocampista derecho": "centrocampista_derecho",
  centrocampista_derecho: "centrocampista_derecho",
  "mediapunta por la izquierda": "mediapunta_por_la_izquierda",
  mediapunta_por_la_izquierda: "mediapunta_por_la_izquierda",
  "mediapunta central": "mediapunta_central",
  mediapunta_central: "mediapunta_central",
  "mediapunta por la derecha": "mediapunta_por_la_derecha",
  mediapunta_por_la_derecha: "mediapunta_por_la_derecha",
  delantero: "delantero",
});

const normalizeHeader = (value) =>
  String(value ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLocaleLowerCase("es-ES")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const normalizeName = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeTeamName = (value) => {
  const normalized = normalizeName(value)
    .replace(/\bfootball club\b/g, " ")
    .replace(/\bfootballclub\b/g, " ")
    .replace(/\bfc\b/g, " ")
    .replace(/\bf c\b/g, " ")
    .replace(/\bcf\b/g, " ")
    .replace(/\bc f\b/g, " ")
    .replace(/\bclub\b/g, " ");

  return normalized
    .split(" ")
    .filter(Boolean)
    .join(" ")
    .trim();
};

const parseInteger20 = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return 0;

  const match = raw.match(/-?\d+/);
  if (!match) return 0;

  const number = Number(match[0]);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(20, Math.trunc(number)));
};

const detectDelimiter = (csvText) => {
  const sample = String(csvText ?? "").slice(0, 10000);
  const candidates = [",", ";", "\t"];

  const counts = candidates.map((delimiter) => {
    let count = 0;
    let inQuotes = false;

    for (let index = 0; index < sample.length; index += 1) {
      const char = sample[index];
      const next = sample[index + 1];

      if (char === '"') {
        if (inQuotes && next === '"') {
          index += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (!inQuotes && char === delimiter) count += 1;
    }

    return { delimiter, count };
  });

  counts.sort((a, b) => b.count - a.count);
  return counts[0]?.count > 0
    ? counts[0].delimiter
    : DEFAULT_DELIMITER;
};

export function parsePositionCsvText(csvText, delimiter = DEFAULT_DELIMITER) {
  const text = String(csvText ?? "").replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      row.push(field);
      field = "";
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") index += 1;
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
  if (row.some((value) => String(value).trim() !== "")) {
    rows.push(row);
  }

  return rows;
}

const rowsToObjects = (rows) => {
  if (!rows.length) return { headers: [], rows: [] };

  const originalHeaders = rows[0].map((header) => String(header ?? "").trim());
  const headers = originalHeaders.map(
    (header) => HEADER_ALIASES[normalizeHeader(header)] || normalizeHeader(header)
  );

  const objects = rows.slice(1).map((values) => {
    const object = {};
    headers.forEach((header, index) => {
      object[header] = String(values[index] ?? "").trim();
    });
    return object;
  });

  return { headers: originalHeaders, rows: objects };
};

const getPositionRatings = (row) =>
  POSITION_FIELDS.reduce((result, field) => {
    result[field] = parseInteger20(row?.[field]);
    return result;
  }, {});

export function convertPositionCsvRow(row, rowNumber = 0) {
  const name = String(row?.name ?? "").trim();
  const teamName = String(row?.team ?? "").trim();

  return {
    rowNumber,
    name,
    teamName,
    fm_position: String(row?.position ?? "").trim(),
    best_positions: String(row?.best_positions ?? "").trim(),
    role_used_to_fill_empty_attributes: String(
      row?.role_used_to_fill_empty_attributes ?? ""
    ).trim(),
    preferred_central_position: String(
      row?.position_central_preferida ?? ""
    ).trim(),
    position_ratings: getPositionRatings(row),
    warnings: [
      ...(name ? [] : ["Falta el nombre del jugador."]),
      ...(!teamName
        ? [
            "El CSV no contiene equipo; se intentará localizar al jugador solo por nombre.",
          ]
        : []),
    ],
    raw: row,
  };
}

export function parsePositionCsv(csvText) {
  const delimiter = detectDelimiter(csvText);
  const rows = parsePositionCsvText(csvText, delimiter);
  const { headers, rows: objectRows } = rowsToObjects(rows);
  const normalizedHeaderSet = new Set(
    headers.map((header) => HEADER_ALIASES[normalizeHeader(header)] || normalizeHeader(header))
  );

  const missingRequiredHeaders = REQUIRED_HEADERS.filter(
    (header) => !normalizedHeaderSet.has(header)
  );

  const players = objectRows.map((row, index) =>
    convertPositionCsvRow(row, index + 2)
  );

  return {
    delimiter,
    headers,
    rows: objectRows,
    players,
    total_rows: players.length,
    missingRequiredHeaders,
  };
}

const isNameCompatible = (sourceName, candidateName) => {
  if (!sourceName || !candidateName) return false;
  if (sourceName === candidateName) return true;

  return (
    candidateName.startsWith(`${sourceName} `) ||
    sourceName.startsWith(`${candidateName} `)
  );
};

export function findPlayerForPositionRow(positionRow, players, teams) {
  const sourceName = normalizeName(positionRow?.name);
  const sourceTeam = normalizeTeamName(positionRow?.teamName);

  if (!sourceName) {
    return {
      status: "invalid",
      player: null,
      message: "Falta el nombre del jugador.",
    };
  }

  const teamById = new Map(
    (teams || []).map((team) => [String(team?.id || ""), team])
  );

  const nameCandidates = (players || []).filter((player) =>
    isNameCompatible(sourceName, normalizeName(player?.name))
  );

  if (!sourceTeam) {
    if (nameCandidates.length === 1) {
      return {
        status: "matched",
        player: nameCandidates[0],
        message: "Jugador localizado por nombre.",
      };
    }

    if (nameCandidates.length > 1) {
      return {
        status: "ambiguous",
        player: null,
        candidates: nameCandidates,
        message: `Se encontraron ${nameCandidates.length} jugadores que coinciden por nombre.`,
      };
    }

    return {
      status: "not_found",
      player: null,
      message: `No se encontró "${positionRow.name}".`,
    };
  }

  const teamCandidates = nameCandidates.filter((player) => {
    const playerTeam = teamById.get(String(player?.teamId || ""));
    const normalizedPlayerTeam = normalizeTeamName(playerTeam?.name);
    const normalizedPlayerShortName = normalizeName(playerTeam?.shortName || playerTeam?.short_name);

    return (
      normalizedPlayerTeam === sourceTeam ||
      normalizedPlayerShortName === sourceTeam ||
      normalizedPlayerTeam.startsWith(`${sourceTeam} `) ||
      sourceTeam.startsWith(`${normalizedPlayerTeam} `)
    );
  });

  if (teamCandidates.length === 1) {
    return {
      status: "matched",
      player: teamCandidates[0],
      message: "Jugador localizado por nombre y equipo.",
    };
  }

  if (teamCandidates.length > 1) {
    return {
      status: "ambiguous",
      player: null,
      candidates: teamCandidates,
      message: `Se encontraron ${teamCandidates.length} jugadores que coinciden en el equipo.`,
    };
  }

  // Fallback seguro: if the name identifies exactly one existing player,
  // allow the update even when the CSV team uses a different naming convention
  // such as "PSG" vs "Paris Saint-Germain".
  if (nameCandidates.length === 1) {
    return {
      status: "matched",
      player: nameCandidates[0],
      message: "Jugador localizado por nombre; el nombre del equipo no coincide exactamente.",
    };
  }

  if (nameCandidates.length > 1) {
    return {
      status: "ambiguous",
      player: null,
      candidates: nameCandidates,
      message: `Se encontraron ${nameCandidates.length} jugadores con ese nombre; no se pudo resolver el equipo.`,
    };
  }

  return {
    status: "not_found",
    player: null,
    message: `No se encontró "${positionRow.name}" en "${positionRow.teamName}".`,
  };
}

export const POSITION_CSV_FIELDS = POSITION_FIELDS;