import { fmNameKey } from "./fmSaveDirectImport.mjs";

// Club suffixes are formatting conventions, not part of the underlying identity.
// Never use substring/fuzzy matching for automatic associations.
const clubKey = name => fmNameKey(String(name || "")
  .replace(/\b(?:football club|futbol club|fútbol club)\b/gi, " ")
  .replace(/\b(?:fc|cf)\b/gi, " ")
  .replace(/[.,()\-]/g, " ")
  .replace(/\s+/g, " "));

export const matchingFmTeams = (clubName, teams = []) => {
  const key = clubKey(clubName);
  return key ? teams.filter(team => clubKey(team.name) === key) : [];
};
export const matchingFmCountries = (nationId, countries = []) => {
  const key = String(nationId ?? "").trim();
  return key ? countries.filter(country => String(country.fm_nation_id ?? "").trim() === key) : [];
};
export function automaticFmDestination(record, teams = [], countries = []) {
  const matchedTeams = matchingFmTeams(record?.club_name, teams);
  const matchedCountries = matchingFmCountries(record?.nation_id, countries);
  return {
    teamId: matchedTeams.length === 1 ? String(matchedTeams[0].id) : "",
    countryId: matchedCountries.length === 1 ? String(matchedCountries[0].id) : "",
    teamMatches: matchedTeams.length,
    countryMatches: matchedCountries.length,
  };
}
