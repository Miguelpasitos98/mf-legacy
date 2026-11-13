// One-way, reviewed import from a local fmsave selection into existing MF LEGACY players.
// Source ids are scoped to the FM edition. Never match FM27 ids against FM26 ids.
export const fmNameKey = value => String(value ?? "").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").replace(/\s+/g, " ").trim();

const empty = value => value === null || value === undefined || value === "";
const uidKey = game => game === "FM26" ? "fm26_uid" : game === "FM27" ? "fm27_uid" : null;
const sourceUid = player => String(player?.uid ?? "").trim();
const isoDate = value => {
  const date = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) return `${date.slice(6)}-${date.slice(3, 5)}-${date.slice(0, 2)}`;
  return "";
};

export function compatibleFmTarget(source, target, game) {
  const key = uidKey(game);
  if (!key || !source?.name || !sourceUid(source) || !target?.id) return false;
  if (!empty(target[key]) && String(target[key]) !== sourceUid(source)) return false;
  if (fmNameKey(source.name) !== fmNameKey(target.name)) return false;
  const birthSource = isoDate(source.birth_date);
  const birthTarget = isoDate(target.date_of_birth);
  return !birthSource || !birthTarget || birthSource === birthTarget;
}

export function suggestFmTarget(source, players, game) {
  const key = uidKey(game);
  if (!key) return { status: "unsupported", match: null };
  const linked = players.filter(p => !empty(p[key]) && String(p[key]) === sourceUid(source));
  if (linked.length > 1) return { status: "conflict", match: null };
  if (linked.length === 1) return compatibleFmTarget(source, linked[0], game)
    ? { status: "linked", match: linked[0] }
    : { status: "conflict", match: null };
  const exact = players.filter(p => compatibleFmTarget(source, p, game));
  return exact.length === 1
    ? { status: "suggested", match: exact[0] }
    : { status: exact.length ? "ambiguous" : "unmatched", match: null };
}

export function buildSafeFmPatch({ source, record, target, now = new Date() }) {
  const game = source?.game;
  if (!compatibleFmTarget(record, target, game)) throw Error("La ficha no coincide con el nombre, nacimiento o ID de esta edición de FM.");
  const prefix = game.toLowerCase();
  const uid = sourceUid(record);
  const metaKey = `${prefix}_import_meta`;
  const recordKey = `${prefix}_source_record`;
  const patch = {};
  if (empty(target[`${prefix}_uid`])) patch[`${prefix}_uid`] = uid;
  // Never overwrite an earlier FM source snapshot or edit from the catalogue.
  if (empty(target[recordKey])) patch[recordKey] = record;
  if (empty(target[metaKey])) patch[metaKey] = {
    game, build: source.game_build || null, game_date: source.game_date || null,
    reader: source.reader || "fmsave", reader_version: source.reader_version || null,
    imported_at: now.toISOString()
  };
  if (game === "FM26") {
    if (empty(target.fm26_source)) patch.fm26_source = "fmsave FM26";
    if (empty(target.ca) && Number.isFinite(record.ability?.current)) patch.ca = record.ability.current;
    if (empty(target.cp) && Number.isFinite(record.ability?.potential)) patch.cp = record.ability.potential;
  } else if (game === "FM27") {
    if (empty(target.fm27_ca) && Number.isFinite(record.ability?.current)) patch.fm27_ca = record.ability.current;
    if (empty(target.fm27_cp) && Number.isFinite(record.ability?.potential)) patch.fm27_cp = record.ability.potential;
    // fm27_reviewed, review notes, FM26 CA/CP and all custom stats remain untouched.
  } else throw Error("Únicamente se admiten partidas FM26 y FM27.");
  return patch;
}


const POSITION_RATING_COLUMNS = {
  portero: "gk", defensa_izquierdo: "dl", defensa_central: "dc",
  defensa_derecho: "dr", mediocentro: "dm", carrilero_izquierdo: "wbl",
  carrilero_derecho: "wbr", centrocampista_izquierdo: "ml",
  centrocampista: "mc", centrocampista_derecho: "mr",
  mediapunta_por_la_izquierda: "aml", mediapunta_central: "amc",
  mediapunta_por_la_derecha: "amr", delantero: "stc"
};
const FM26_ATTRIBUTE_COLUMNS = {
  mental: {
    agresividad: "aggression", anticipacion: "anticipation", valentia: "bravery",
    serenidad: "composure", concentracion: "concentration", consistencia: "consistency",
    decisiones: "decisions", determinacion: "determination", juego_sucio: "dirtiness",
    talento: "flair", partidos_importantes: "important_matches", liderazgo: "leadership",
    movimiento: "off_the_ball", colocacion: "positioning", trabajo_de_equipo: "teamwork",
    vision: "vision", sacrificio: "work_rate"
  },
  physical: {
    aceleracion: "acceleration", agilidad: "agility", balance: "balance",
    alcance_de_salto: "jumping_reach", recuperacion_fisica: "natural_fitness",
    velocidad: "pace", resistencia: "stamina", fuerza: "strength"
  },
  technical: {
    saques_de_esquina: "corners", centros: "crossing", regate: "dribbling",
    remate: "finishing", control: "first_touch", tiros_libres: "free_kick_taking",
    cabeceo: "heading", tiros_lejanos: "long_shots", saques_largos: "long_throws",
    marcaje: "marking", pases: "passing", penaltis: "penalty_taking",
    entradas: "tackling", tecnica: "technique", polivalencia: "versatility"
  },
  goalkeeping: {
    balones_aereos: "aerial_reach", mando_en_el_area: "command_of_area",
    comunicacion: "communication", excentricidad: "eccentricity", blocaje: "handling",
    saques_de_puerta: "kicking", uno_contra_uno: "one_on_ones", reflejos: "reflexes",
    salidas_tendencia: "rushing_out", salida_de_puños: "punching",
    saque_con_la_mano: "throwing"
  }
};
export function fm26VisibleAttributes(record) {
  const result = {};
  for (const [group, fields] of Object.entries(FM26_ATTRIBUTE_COLUMNS)) {
    const values = Object.fromEntries(Object.entries(fields)
      .filter(([, source]) => Number.isFinite(record.attributes?.[source]))
      .map(([field, source]) => [field, record.attributes[source]]));
    result[group] = values;
  }
  if (Number.isFinite(record.attributes?.injury_proneness)) {
    result.physical.tendencia_a_lesionarse = 21 - record.attributes.injury_proneness;
  }
  return result;
}

const PRIMARY_POSITION = {
  GK: "GK", DC: "DFC", DL: "LI", DR: "LD", WBL: "CRI", WBR: "CRD",
  DM: "CDM", MC: "CM", AMC: "CAM", AML: "EI", AMR: "ED",
  STC: "DC", ML: "MI", MR: "MD"
};

/** Never create a new Player when either the edition's UID or the identity already exists. */
export function canCreateFmPlayer({ source, record, players = [] }) {
  const edition = source?.game;
  const key = uidKey(edition);
  const identity = fmNameKey(record?.name);
  const originalId = sourceUid(record);
  if (!key || !identity || !/^\d{1,20}$/.test(originalId) ||
      (typeof record?.uid === "number" && !Number.isSafeInteger(record.uid))) {
    return { allowed: false, reason: "Registro sin edición, nombre o UID válido." };
  }
  const idCollision = players.some(item => !empty(item[key]) && String(item[key]) === originalId);
  if (idCollision) return { allowed: false, reason: "Ese ID ya pertenece a una ficha de esta edición. Vincúlala en lugar de crear otra." };
  if (players.some(item => fmNameKey(item.name) === identity)) {
    return { allowed: false, reason: "Ya existe un jugador con el mismo nombre. Revisa la identidad y vincula su ficha antes de crear." };
  }
  return { allowed: true, reason: "" };
}

/** New records have only edition-scoped FM data plus unambiguous basic identity fields. */
export function buildNewFmPlayer({ source, record, teamId = "", countryId = "", now = new Date() }) {
  const allowed = canCreateFmPlayer({ source, record });
  if (!allowed.allowed) throw Error(allowed.reason);
  const result = {
    name: record.name.trim(),
    ...buildSafeFmPatch({ source, record, target: { id: "__new__", name: record.name }, now }),
  };
  const birth = isoDate(record.birth_date);
  if (birth) result.date_of_birth = `${birth.slice(8, 10)}/${birth.slice(5, 7)}/${birth.slice(0, 4)}`;
  if (Number.isFinite(record.height_cm)) result.height = record.height_cm;
  if (Number.isFinite(record.left_foot)) result.left_foot = String(record.left_foot);
  if (Number.isFinite(record.right_foot)) result.right_foot = String(record.right_foot);
  const natural = Array.isArray(record.natural_positions) ? record.natural_positions : [];
  const accomplished = Array.isArray(record.accomplished_positions) ? record.accomplished_positions : [];
  const primary = [...natural, ...accomplished].find(item => PRIMARY_POSITION[item]);
  if (primary) {
    result.position = PRIMARY_POSITION[primary];
    result.position_raw = primary;
  }
  if (source.game === "FM26") {
    result.fm26_club_uid = String(record.club_uid ?? "");
    result.fm26_nation_id = String(record.nation_id ?? "");
    result.fm26_save_club_name = String(record.club_name || "");
    if (Number.isFinite(record.team_slot)) result.fm26_team_slot = record.team_slot;
    result.fm26_natural_positions = natural;
    result.fm26_accomplished_positions = accomplished;
    result.fm26_raw_positions = record.positions || {};
    result.fm26_raw_attributes = record.raw_attributes || {};
    result.fm26_personality = record.personality || {};
    result.fm26_traits = Array.isArray(record.traits) ? record.traits : [];
    result.fm26_reputation = record.reputation || {};
    result.fm_position = [...natural, ...accomplished].join(", ");
    result.best_positions = natural.join(", ");
    result.position_ratings = Object.fromEntries(Object.entries(POSITION_RATING_COLUMNS)
      .filter(([, key]) => Number.isFinite(record.positions?.[key]))
      .map(([field, key]) => [field, record.positions[key]]));
    result.stats = fm26VisibleAttributes(record);
  }
  if (teamId) result.team_id = String(teamId);
  if (countryId) result.country_id = String(countryId);
  return result;
}

