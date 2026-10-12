/**
 * FM26 Nation Equivalence Logic
 *
 * Centralised reference tables, auto-matching, and status computation
 * for FM26 nation IDs ↔ MF LEGACY Country records.
 *
 * Exported:
 *  - FM26_NATION_ISO3, fm26CountryKey, fm26CountryAutoMatch: legacy helpers
 *  - computeNationStatus: resolves the display status of one FM ID
 *  - buildFm26Nations: groups JSON rows by nation ID and computes status
 *  - fm26PlayerName: extracts a player display name from an FM26 row
 */

const FM26_NATION_ISO3 = Object.freeze({
  "11":"EGY", "33":"NGA", "61":"JPN", "107":"HND", "120":"USA",
  "139":"ENG", "143":"FRA", "144":"GEO", "145":"GER", "147":"HUN",
  "150":"ITA", "158":"NED", "159":"NIR", "167":"SCO", "170":"ESP",
  "171":"SWE", "175":"WAL", "187":"ARG", "189":"BRA"
});

const FM26_COUNTRY_CODE_EQUIVALENTS = Object.freeze({
  ENG:["ENG"], NIR:["NIR","NIE"], SCO:["SCO"], WAL:["WAL"],
  GER:["GER","DEU"], NED:["NED","NLD"], HND:["HON","HND"],
  EGY:["EGY"], JPN:["JPN"], FRA:["FRA"], GEO:["GEO"],
  HUN:["HUN"], ITA:["ITA"], SWE:["SWE"], ARG:["ARG"], BRA:["BRA"],
  USA:["USA","US"], ESP:["ESP","ES"], NGA:["NGA","NG"]
});

const FM26_COUNTRY_NAMES = Object.freeze({
  EGY:["egypt","egipto"], JPN:["japan","japon"], HND:["honduras"],
  ENG:["england","inglaterra"], FRA:["france","francia"],
  GEO:["georgia"], GER:["germany","alemania","deutschland"],
  HUN:["hungary","hungria"], ITA:["italy","italia"],
  NED:["netherlands","paises bajos","holland","holanda"],
  NIR:["northern ireland","irlanda del norte"], SCO:["scotland","escocia"],
  SWE:["sweden","suecia"], WAL:["wales","gales"],
  ARG:["argentina"], BRA:["brazil","brasil"],
  USA:["united states","estados unidos","usa"],
  ESP:["spain","espana"], NGA:["nigeria"]
});

export const fm26CountryKey = (value) =>
  String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

export const fm26PlayerName = (row) =>
  String(row.common_name || row.name || row.full_name || "").trim();

export const fm26CountryAutoMatch = (fmId, countries) => {
  const id = String(fmId ?? "");
  if (!id || id === "undefined" || id === "null") return { country: null, reason: "missing" };
  const explicit = countries.filter(c => String(c.fm_nation_id ?? "") === id);
  if (explicit.length === 1) return { country: explicit[0], reason: "saved" };
  if (explicit.length > 1) return { country: null, reason: "ambiguous" };
  const iso3 = FM26_NATION_ISO3[id];
  if (!iso3) return { country: null, reason: "unknown" };
  const codes = FM26_COUNTRY_CODE_EQUIVALENTS[iso3] || [iso3];
  let matches = countries.filter(c => codes.includes(String(c.code || "").toUpperCase().trim()));
  if (matches.length === 1) return matches[0].fm_nation_id && String(matches[0].fm_nation_id) !== id ? { country: null, reason: "conflict" } : { country: matches[0], reason: "code" };
  if (matches.length > 1) return { country: null, reason: "ambiguous" };
  const names = (FM26_COUNTRY_NAMES[iso3] || []).map(fm26CountryKey);
  matches = countries.filter(c => names.includes(fm26CountryKey(c.name)));
  return matches.length === 1
    ? (matches[0].fm_nation_id && String(matches[0].fm_nation_id) !== id ? { country: null, reason: "conflict" } : { country: matches[0], reason: "name" })
    : { country: null, reason: matches.length > 1 ? "ambiguous" : "missing_country" };
};

/**
 * Resolves the display status of an FM nation ID, considering both
 * the auto-match result AND the user's manual selection.
 *
 * Returns { country, status, detail } where:
 *  - status: "saved" | "suggested" | "manual" | "unlinked" | "conflict"
 *  - country: the resolved Country (manual selection overrides auto-match)
 *  - detail: human-readable conflict description when status is "conflict"
 */
export const computeNationStatus = (item, fm26NationMapping, countries) => {
  const id = String(item.id);
  const manualId = fm26NationMapping?.[id] || "";

  if (manualId) {
    const manualCountry = countries.find(c => String(c.id) === String(manualId));
    if (manualCountry) {
      if (String(manualCountry.fm_nation_id ?? "") === id)
        return { country: manualCountry, status: "saved", detail: "" };
      const existingId = String(manualCountry.fm_nation_id ?? "");
      if (existingId && existingId !== id)
        return { country: manualCountry, status: "conflict", detail: `${manualCountry.name} tiene guardado FM ID ${existingId}` };
      const otherWithId = countries.find(c => String(c.id) !== String(manualId) && String(c.fm_nation_id ?? "") === id);
      if (otherWithId)
        return { country: manualCountry, status: "conflict", detail: `FM ID ${id} ya pertenece a ${otherWithId.name}` };
      return { country: manualCountry, status: "manual", detail: "" };
    }
  }

  if (!item.country) {
    if (item.reason === "conflict" || item.reason === "ambiguous")
      return { country: null, status: "conflict", detail: item.reason === "ambiguous" ? "Múltiples países coinciden" : "Conflicto de asociación" };
    return { country: null, status: "unlinked", detail: "" };
  }

  if (item.reason === "saved") return { country: item.country, status: "saved", detail: "" };
  return { country: item.country, status: "suggested", detail: "" };
};

/**
 * Groups FM26 JSON rows by nation ID and computes the display status
 * for each group, considering saved equivalences, code/name suggestions,
 * and the user's manual selections.
 */
export const buildFm26Nations = (fm26Import, countries, fm26NationMapping) => {
  const groups = new Map();
  const add = (id, row, kind, secondaryIndex = null) => {
    if (id == null || String(id) === "") return;
    const key = String(id);
    if (!groups.has(key)) groups.set(key, { id: key, main: 0, secondary: 0, examples: [] });
    const group = groups.get(key);
    if (kind === "main") group.main++; else group.secondary++;
    const playerName = fm26PlayerName(row);
    if (playerName && !group.examples.some(ex => ex.name === playerName) && group.examples.length < 6)
      group.examples.push({ name: playerName, kind, secondaryIndex, club: row.club_name || "" });
  };
  for (const row of fm26Import || []) {
    add(row.nation_id, row, "main");
    for (const [index, id] of [...new Set(row.second_nation_ids || [])].entries())
      add(id, row, "secondary", index);
  }
  return [...groups.values()].sort((a, b) => Number(a.id) - Number(b.id)).map(group => {
    const auto = fm26CountryAutoMatch(group.id, countries);
    const item = { ...group, ...auto };
    const statusInfo = computeNationStatus(item, fm26NationMapping, countries);
    return { ...item, status: statusInfo.status, country: statusInfo.country, conflictDetail: statusInfo.detail || "" };
  });
};

/**
 * Resolves a nation ID to a Country that is SAFE to assign during import.
 * Returns the Country only when status is "saved" (persisted in fm_nation_id)
 * or "manual" (user-selected, no conflict). Returns null for "suggested",
 * "conflict", and "unlinked" — unconfirmed matches never reach a player.
 */
export const resolveSafeNation = (fmId, fm26NationMapping, countries) => {
  const auto = fm26CountryAutoMatch(fmId, countries);
  const item = { id: String(fmId ?? ""), country: auto.country, reason: auto.reason };
  const statusInfo = computeNationStatus(item, fm26NationMapping, countries);
  if (statusInfo.status === "saved" || statusInfo.status === "manual") return statusInfo.country;
  return null;
};

export { FM26_NATION_ISO3 };