// The browser-side index contains no save-file bytes: only fmsave's decoded player columns.
export const foldFmName = (value) => String(value ?? "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().trim();

const numericColumn = (buffer, count, wide = false) => {
  if (ArrayBuffer.isView(buffer)) return buffer;
  if (!(buffer instanceof ArrayBuffer)) return new Float64Array(count).fill(NaN);
  return wide ? new Float64Array(buffer) : new Float32Array(buffer);
};

export function buildFmSaveIndex({ count, numbers, text }) {
  if (!Number.isInteger(count) || count < 0 || !Array.isArray(text?.name) || text.name.length !== count) {
    throw new Error("El listado de jugadores de Football Manager está incompleto.");
  }
  const uid = numericColumn(numbers?.uid, count, true);
  const clubUid = numericColumn(numbers?.club_uid, count, true);
  const teamSlot = numericColumn(numbers?.team_slot, count);
  const ca = numericColumn(numbers?.ability_current, count);
  const pa = numericColumn(numbers?.ability_potential, count);
  const age = numericColumn(numbers?.age, count);
  const names = text.name;
  const clubNames = text.club_name || [];
  const positions = text.natural_positions || [];
  const foldedNames = names.map(foldFmName);
  const clubMap = new Map();
  for (let i = 0; i < count; i++) {
    const id = clubUid[i];
    if (!Number.isFinite(id) || !clubNames[i]) continue;
    let club = clubMap.get(id);
    if (!club) {
      club = { uid: id, name: clubNames[i], folded: foldFmName(clubNames[i]), members: [] };
      clubMap.set(id, club);
    }
    club.members.push(i);
  }
  const clubs = [...clubMap.values()].sort((a, b) => b.members.length - a.members.length || a.name.localeCompare(b.name));
  return { count, uid, clubUid, teamSlot, ca, pa, age, names, clubNames, positions, foldedNames, clubs };
}

export function findFmPlayers(index, query, limit = 80) {
  const q = foldFmName(query);
  if (!index || q.length < 2) return [];
  const results = [];
  for (let i = 0; i < index.count; i++) {
    if (index.foldedNames[i]?.includes(q) && Number.isFinite(index.uid[i])) results.push(i);
    if (results.length >= limit) break;
  }
  return results.sort((a, b) => (index.ca[b] || 0) - (index.ca[a] || 0));
}

export function findFmClubs(index, query, limit = 80) {
  if (!index) return [];
  const q = foldFmName(query);
  return index.clubs.filter(club => !q || club.folded.includes(q)).slice(0, limit);
}

export function filterFmTeamDetails(details, firstTeamOnly = true) {
  return details.filter(detail => detail?.player && (!firstTeamOnly || Number(detail.player.team_slot) === 0));
}

// El lector entrega los enteros de Python como BigInt, que JSON y las
// entidades de Base44 no pueden serializar. Se convierten una sola vez al
// salir del lector; los enteros fuera del rango seguro se conservan como texto.
export function fmJsonSafe(value) {
  if (typeof value === "bigint") {
    const numeric = Number(value);
    return Number.isSafeInteger(numeric) ? numeric : value.toString();
  }
  if (Array.isArray(value)) return value.map(fmJsonSafe);
  if (value && typeof value === "object") {
    const copy = {};
    for (const [key, item] of Object.entries(value)) copy[key] = fmJsonSafe(item);
    return copy;
  }
  return value;
}

export function buildFmExport({ meta, selection, details }) {
  return {
    format: "mf_legacy_fmsave_selection_v1",
    source: {
      reader: "fmsave", reader_version: meta?.fmsave || null,
      game: meta?.game || null, game_build: meta?.build || null,
      game_date: meta?.date || null, save_name: meta?.save || null,
      verification_note: meta?.coverage_note || null,
    },
    selection,
    // Import compatibility: existing MF Legacy's JSON loader accepts a `players` array.
    players: details.map(detail => fmJsonSafe(detail.player)),
    // Kept separate so no fmsave Player model field is silently overwritten.
    player_season_stats: fmJsonSafe(details.flatMap(detail => detail.stats || [])),
  };
}