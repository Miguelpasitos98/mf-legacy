/**
 * The squad builder is exclusively for user-managed custom clubs.
 * Manual import or other provenance alone never authorizes a team.
 */
export const isCustomSquadTeam = team =>
  team?.is_custom_club === true || team?.isCustomClub === true;

export const filterCustomTeamRecords = (records, customTeamIds) =>
  records.filter(record => customTeamIds.has(String(record.team_id)));
