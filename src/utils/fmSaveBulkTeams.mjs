import { fmNameKey } from "./fmSaveDirectImport.mjs";

// Match clubs by their exact normalized FM26 identity, never by similar names
// or FM player UIDs. Ambiguous source club names are excluded.
export function fm26KnownClubSelection(index, players) {
  if (!index?.clubs || !Array.isArray(players)) return { clubs: [], indexes: [], skipped: [] };
  const known = new Map();
  for (const player of players) {
    if (!player?.fm26_uid || !player?.fm26_save_club_name) continue;
    const key = fmNameKey(player.fm26_save_club_name);
    if (!key) continue;
    if (!known.has(key)) known.set(key, new Set());
    known.get(key).add(String(player.fm26_club_uid || ""));
  }
  const byName = new Map();
  for (const club of index.clubs) {
    const key = fmNameKey(club.name);
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(club);
  }
  const clubs = [];
  const skipped = [];
  const indexes = [];
  for (const [key, uids] of known) {
    const matches = byName.get(key) || [];
    if (matches.length !== 1 || uids.size !== 1) {
      if (matches.length) skipped.push({ name: matches[0].name, reason: "Coincidencia de club ambigua" });
      continue;
    }
    const club = matches[0];
    const members = club.members.filter(i => Number(index.teamSlot[i]) === 0 && Number.isFinite(index.uid[i]));
    if (!members.length) continue;
    clubs.push({ uid: club.uid, name: club.name, players: members.length });
    indexes.push(...members);
  }
  return { clubs: clubs.sort((a,b)=>a.name.localeCompare(b.name)), indexes, skipped };
}
