// MF LEGACY — posición histórica por jugador y temporada.
// La posición efectiva decide el arquetipo del Composite. Nunca se usa la
// posición actual del jugador salvo como respaldo explícitamente provisional.
// Este módulo no importa otros módulos de la app para evitar ciclos.

// Catálogo MF LEGACY (el mismo que normaliza Player.position).
export const MF_LEGACY_POSITIONS = ["GK","DFC","LD","LI","CRD","CRI","CDM","CM","CAM","EI","ED","DC"];
// Equivalencias habituales de las cartas FIFA/EA SPORTS FC.
export const FIFA_EQUIVALENT_POSITIONS = ["ST","CF","RW","LW","RM","LM","AM","DM","RB","LB","CB","WB","RWB","LWB","W"];
export const POSITION_OPTIONS = [...MF_LEGACY_POSITIONS, ...FIFA_EQUIVALENT_POSITIONS];

export const POSITION_SOURCES = {
  competition: { short: "Competición", label: "Corrección manual por competición" },
  season: { short: "Manual", label: "Corrección manual de la temporada" },
  fifa: { short: "FIFA", label: "Posición de la carta FIFA/EA SPORTS FC" },
  fallback: { short: "Provisional", label: "Respaldo provisional: posición actual del jugador" },
  none: { short: "Sin posición", label: "Sin posición histórica ni respaldo" },
};

export const normalizeHistoricalPosition = (value) =>
  String(value ?? "").trim().toUpperCase().replace(/[^A-Z]/g, "");

const keyText = (value) =>
  String(value ?? "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]/g, "");

export const competitionPositions = (valuation) =>
  Array.isArray(valuation?.competition_positions) ? valuation.competition_positions : [];

export const competitionPosition = (valuation, competition) => {
  const wanted = keyText(competition);
  if (!wanted) return "";
  const found = competitionPositions(valuation).find((item) => keyText(item?.competition) === wanted);
  return normalizeHistoricalPosition(found?.position);
};

// Añade, actualiza o elimina la corrección de UNA competición sin tocar las demás.
export const withCompetitionPosition = (valuation, competition, position) => {
  const name = String(competition ?? "").trim();
  const wanted = keyText(name);
  const rest = competitionPositions(valuation).filter((item) => keyText(item?.competition) !== wanted);
  const clean = normalizeHistoricalPosition(position);
  if (!clean || !name) return rest;
  return [...rest, { competition: name, position: clean }];
};

// Prioridad: competición manual > temporada manual > FIFA > respaldo provisional.
export function resolveHistoricalPosition({ valuation, competition, fallback } = {}) {
  const manual = competitionPosition(valuation, competition);
  if (manual) return { position: manual, source: "competition" };
  const season = normalizeHistoricalPosition(valuation?.historical_position_override);
  if (season) return { position: season, source: "season" };
  const fifa = normalizeHistoricalPosition(valuation?.fifa_fc_position);
  if (fifa) return { position: fifa, source: "fifa" };
  const backup = normalizeHistoricalPosition(fallback);
  return { position: backup, source: backup ? "fallback" : "none" };
}

// Posición de referencia de una temporada completa. Si las competiciones con
// corrección manual coinciden, esa posición manda. Si discrepan, la temporada no
// tiene un arquetipo único y se usa la cadena de temporada, FIFA o respaldo.
export function seasonReferencePosition({ valuation, competitions = [], fallback } = {}) {
  const overrides = [...new Set(competitions.map((c) => competitionPosition(valuation, c)).filter(Boolean))];
  if (overrides.length === 1) return { position: overrides[0], source: "competition", mixed: false };
  const chain = resolveHistoricalPosition({ valuation, fallback });
  return { ...chain, mixed: overrides.length > 1 };
}

// --- Presentación (no interviene en ningún cálculo) ---

// Grupo de juego de cada código, para colorear la interfaz.
const GROUP_BY_POSITION = {
  GK: "gk",
  DFC: "def", LD: "def", LI: "def", CRD: "def", CRI: "def",
  CB: "def", RB: "def", LB: "def", WB: "def", RWB: "def", LWB: "def",
  CDM: "mid", CM: "mid", DM: "mid", RM: "mid", LM: "mid",
  CAM: "att", ED: "att", EI: "att", DC: "att",
  AM: "att", RW: "att", LW: "att", CF: "att", ST: "att", W: "att",
};

export const POSITION_GROUP_LABELS = {
  gk: "Portería",
  def: "Defensa",
  mid: "Medio campo",
  att: "Ataque",
  none: "Sin posición",
};

export const positionGroup = (value) => GROUP_BY_POSITION[normalizeHistoricalPosition(value)] || "none";

const TONE_BY_GROUP = {
  gk: "bg-amber-100 text-amber-900 ring-amber-200",
  def: "bg-sky-100 text-sky-900 ring-sky-200",
  mid: "bg-emerald-100 text-emerald-900 ring-emerald-200",
  att: "bg-rose-100 text-rose-900 ring-rose-200",
  none: "bg-slate-100 text-slate-400 ring-slate-200",
};

export const positionTone = (value) => TONE_BY_GROUP[positionGroup(value)];