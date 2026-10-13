// Utilidades de importación de historiales para MF LEGACY Career Studio.
// Formato version: mf_legacy_career_import_v1
// Dos variantes:
//   - LOTE_BASE44_PREVISUALIZACION.json  → { schema_version, players: [{ fm_uid, name, player_base44_id, approval_status, provisional_identity, records: [...] }] }
//   - LOTE_BASE44_APROBADOS.json         → { schema_version, records: [...] }
// Las sugerencias marcadas wikipedia_suggestions_review_only son solo de revisión.

export const CAREER_IMPORT_SCHEMA = "mf_legacy_career_import_v1";

export const MOVEMENT_LABELS = {
  cesion: "Cesión",
  traspaso: "Traspaso",
  libre: "Libre",
  desconocido: "Desconocido",
  ascenso_filial: "Ascenso filial",
  formacion: "Formación",
};

export const REVIEW_STATUS_LABELS = {
  pending: "Pendiente",
  approved: "Aprobado",
  rejected: "Rechazado",
};

const pick = (obj, keys) => {
  if (!obj || typeof obj !== "object") return undefined;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  }
  return undefined;
};

const asString = (value) => {
  if (value === undefined || value === null) return "";
  return String(value);
};

const asInt = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
};

const asBool = (value) => {
  if (value === true || value === "true" || value === 1) return true;
  if (value === false || value === "false" || value === 0) return false;
  return undefined;
};

const asArray = (value) => {
  if (Array.isArray(value)) return value.map((v) => String(v));
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
};

// Normaliza un nombre de club para generar candidatos de coincidencia.
// Elimina acentos, unifica puntuación (f.c. -> fc) y quita términos genéricos
// como palabras completas. La eliminación de genéricos SOLO sirve para generar
// candidatos; la vinculación automática exige coincidencia inequívoca.
export const normalizeClubName = (name) => {
  let s = String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  // Unificar puntuación y separadores a espacios: "f.c." -> "f c".
  s = s.replace(/[.\-_/\\'`´·,;:&()]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  // Eliminar términos genéricos como palabras completas.
  s = s.replace(
    /\b(fc|cf|fbc|afc|sc|ac|bk|nk|sk|ss|cd|sd|fk|kk|rc|ca|cg|vc|sv|ig|vfl|vfb|tsv|psv|rsc|football|club|futbol|association|calcio|balompie|polideportivo|deportivo|deportiva)\b/g,
    " "
  );
  s = s.replace(/\s+/g, " ").trim();
  return s.replace(/[^a-z0-9]/g, "");
};

// Convierte un registro crudo del JSON en un objeto plano de PlayerCareer.
export const normalizeRecord = (raw) => {
  if (!raw || typeof raw !== "object") return null;

  const record = {
    external_stage_id: asString(
      pick(raw, ["external_stage_id", "externalStageId", "stage_id", "id"])
    ),
    fm26_uid: asString(pick(raw, ["fm26_uid", "fm_uid", "player_fm_uid", "uid"])),
    player_base44_id: asString(
      pick(raw, ["player_base44_id", "playerBase44Id", "base44_id", "player_id"])
    ),
    player_name: asString(pick(raw, ["player_name", "name", "playerName"])),
    club_name: asString(pick(raw, ["club_name", "clubName", "team_name", "teamName"])),
    club_qid: asString(
      pick(raw, ["club_qid", "clubQid", "wikidata_id", "qid", "wikidata_qid"])
    ),
    team_id: asString(pick(raw, ["team_id", "teamId", "base44_team_id"])),
    start_date: asString(pick(raw, ["start_date", "startDate", "from"])),
    end_date: asString(pick(raw, ["end_date", "endDate", "to"])),
    start_year: asInt(pick(raw, ["start_year", "startYear"])),
    end_year: asInt(pick(raw, ["end_year", "endYear"])),
    start_precision: asString(pick(raw, ["start_precision", "startPrecision"])),
    end_precision: asString(pick(raw, ["end_precision", "endPrecision"])),
    movement_type: asString(
      pick(raw, ["movement_type", "movementType", "type", "transfer_type"])
    ),
    is_reserve: asBool(pick(raw, ["is_reserve", "isReserve", "reserve"])),
    source: asString(pick(raw, ["source", "data_source"])),
    source_url: asString(pick(raw, ["source_url", "sourceUrl", "url"])),
    source_license: asString(
      pick(raw, ["source_license", "sourceLicense", "license"])
    ),
    review_flags: asArray(pick(raw, ["review_flags", "reviewFlags", "flags"])),
    review_status: asString(
      pick(raw, ["review_status", "reviewStatus", "approval_status", "approvalStatus"])
    ),
    provisional_identity: asBool(
      pick(raw, ["provisional_identity", "provisionalIdentity"])
    ),
    manually_verified: asBool(
      pick(raw, ["manually_verified", "manuallyVerified", "verified"])
    ),
    loan: asBool(pick(raw, ["loan", "is_loan", "on_loan"])),
    review_only: asBool(
      pick(raw, ["wikipedia_suggestions_review_only", "review_only", "reviewOnly"])
    ),
  };

  return record;
};

const validMovementTypes = new Set([
  "cesion",
  "traspaso",
  "libre",
  "desconocido",
  "ascenso_filial",
  "formacion",
]);

const validPrecisions = new Set(["anio", "mes", "dia", ""]);

// Valida un registro normalizado; devuelve lista de errores.
export const validateRecord = (record) => {
  const errors = [];
  if (!record) {
    errors.push("Registro vacío.");
    return errors;
  }
  if (!record.external_stage_id) errors.push("Falta external_stage_id.");
  if (!record.club_name) errors.push("Falta club_name.");
  if (record.movement_type && !validMovementTypes.has(record.movement_type))
    errors.push(`movement_type inválido: ${record.movement_type}`);
  if (record.start_precision && !validPrecisions.has(record.start_precision))
    errors.push(`start_precision inválido: ${record.start_precision}`);
  if (record.end_precision && !validPrecisions.has(record.end_precision))
    errors.push(`end_precision inválido: ${record.end_precision}`);
  return errors;
};

// Analiza el texto del archivo JSON y devuelve { format, entries, errors }.
// entries: array de { record (normalizado), playerInfo, errors[] }
export const parseCareerFile = (text) => {
  const result = { format: null, schemaVersion: null, entries: [], errors: [] };

  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    result.errors.push(`JSON no válido: ${error.message}`);
    return result;
  }

  if (!data || typeof data !== "object") {
    result.errors.push("El archivo no es un objeto JSON.");
    return result;
  }

  const schemaVersion = asString(
    pick(data, ["schema_version", "schemaVersion", "version"])
  );
  result.schemaVersion = schemaVersion;

  if (schemaVersion && schemaVersion !== CAREER_IMPORT_SCHEMA) {
    result.errors.push(
      `Esquema no soportado: "${schemaVersion}". Se esperaba "${CAREER_IMPORT_SCHEMA}".`
    );
    return result;
  }

  const players = Array.isArray(data.players) ? data.players : null;
  const records = Array.isArray(data.records) ? data.records : null;

  if (players) {
    result.format = "preview";
    players.forEach((player, index) => {
      const playerInfo = {
        fm_uid: asString(pick(player, ["fm_uid", "fm26_uid", "uid"])),
        name: asString(pick(player, ["name", "player_name"])),
        player_base44_id: asString(
          pick(player, ["player_base44_id", "playerBase44Id", "base44_id"])
        ),
        approval_status: asString(
          pick(player, ["approval_status", "approvalStatus", "review_status"])
        ),
        provisional_identity: asBool(
          pick(player, ["provisional_identity", "provisionalIdentity"])
        ),
      };
      const playerRecords = Array.isArray(player.records) ? player.records : [];
      playerRecords.forEach((rawRecord) => {
        const record = normalizeRecord(rawRecord);
        if (!record) return;
        // Hereda info del jugador si el registro no la trae.
        if (!record.fm26_uid && playerInfo.fm_uid)
          record.fm26_uid = playerInfo.fm_uid;
        if (!record.player_base44_id && playerInfo.player_base44_id)
          record.player_base44_id = playerInfo.player_base44_id;
        if (!record.player_name && playerInfo.name)
          record.player_name = playerInfo.name;
        if (!record.review_status && playerInfo.approval_status)
          record.review_status = playerInfo.approval_status;
        if (record.provisional_identity === undefined)
          record.provisional_identity = playerInfo.provisional_identity;
        const errors = validateRecord(record);
        result.entries.push({ record, playerInfo, errors });
      });
    });
  } else if (records) {
    result.format = "approved";
    records.forEach((rawRecord) => {
      const record = normalizeRecord(rawRecord);
      if (!record) return;
      const errors = validateRecord(record);
      const playerInfo = {
        fm_uid: record.fm26_uid,
        name: record.player_name,
        player_base44_id: record.player_base44_id,
        approval_status: record.review_status,
        provisional_identity: record.provisional_identity,
      };
      result.entries.push({ record, playerInfo, errors });
    });
  } else {
    result.errors.push(
      'No se encontró "players" ni "records". Revisa que el archivo sea un lote de Career Studio v1.'
    );
  }

  return result;
};

// Sugiere un equipo de Team a partir del nombre del club.
// Devuelve { team, ambiguous, confidence, candidates }.
export const suggestTeam = (clubName, teams) => {
  const key = normalizeClubName(clubName);
  if (!key) return { team: null, ambiguous: false, confidence: 0, candidates: [] };

  const scored = teams
    .map((team) => {
      const n = normalizeClubName(team.name);
      const s = normalizeClubName(team.short_name || team.shortName || "");
      let score = 0;
      if (n && n === key) score = 1;
      else if (s && s === key) score = 0.98;
      else if (n && (n.includes(key) || key.includes(n)) && key.length >= 4)
        score = 0.82;
      else if (s && (s.includes(key) || key.includes(s)) && key.length >= 4)
        score = 0.78;
      return { team, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) return { team: null, ambiguous: false, confidence: 0, candidates: [] };

  const top = scored[0];
  const second = scored[1];
  const ambiguous =
    top.score < 1 || (second && top.score - second.score < 0.1);

  return {
    team: top.score >= 0.82 ? top.team : null,
    ambiguous,
    confidence: top.score,
    candidates: scored.slice(0, 5),
  };
};

// Resuelve el jugador: primero player_base44_id valido, luego fm26_uid exacto.
// Nunca vincula por nombre.
export const resolvePlayer = (entry, players) => {
  const base44Id = asString(entry.record.player_base44_id);
  if (base44Id) {
    const direct = players.find((p) => String(p.id) === base44Id);
    if (direct) return { player: direct, method: "base44_id" };
  }
  const fmUid = asString(entry.record.fm26_uid || entry.playerInfo.fm_uid);
  if (fmUid) {
    const byUid = players.find(
      (p) => String(p.fm26_uid || "") === fmUid
    );
    if (byUid) return { player: byUid, method: "fm26_uid" };
  }
  return { player: null, method: null };
};