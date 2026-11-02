// Cobertura de plantillas en Teams/Countries: solo relaciones actuales por ID.
// No se infieren clubes a partir de nombres o historiales y no se modifica ningún dato.
export const TEAM_COVERAGE_THRESHOLD = 5;

export function countCurrentPlayersByTeam(players) {
  const counts = new Map();
  const seenPlayerIds = new Set();
  for (const player of Array.isArray(players) ? players : []) {
    const status = String(player?.career_status || player?.careerStatus || "").trim().toLowerCase();
    if (status === "retired" || status === "free_agent") continue;
    const teamId = String(player?.team_id || player?.teamId || player?.club_id || player?.clubId || "").trim();
    if (!teamId || teamId === "__free_agent__" || teamId === "__retired__") continue;
    const playerId = String(player?.id || player?._id || player?.data?.id || "").trim();
    if (playerId) {
      if (seenPlayerIds.has(playerId)) continue;
      seenPlayerIds.add(playerId);
    }
    counts.set(teamId, (counts.get(teamId) || 0) + 1);
  }
  return counts;
}

export function coveredTeamsCount(teams, counts, threshold = TEAM_COVERAGE_THRESHOLD) {
  return (teams || []).filter((team) => (counts.get(String(team?.id || "")) || 0) >= threshold).length;
}
