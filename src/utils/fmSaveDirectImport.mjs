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
