// MF LEGACY — Shared constants and helpers for the Teams module.

export const CAREER_STATUS_LOGOS = {
  free_agent: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#243F71"/><stop offset="1" stop-color="#07182F"/></linearGradient></defs><path d="M48 5 85 20v30c0 19-15 32-37 41C26 82 11 69 11 50V20z" fill="url(#g)" stroke="#9EB7E4" stroke-width="3"/><rect x="27" y="36" width="42" height="32" rx="5" fill="none" stroke="#D9E9FF" stroke-width="5"/><path d="M39 36v-7c0-5 4-8 9-8s9 3 9 8v7M27 48h42M44 46v6h8v-6" fill="none" stroke="#D9E9FF" stroke-width="5" stroke-linecap="round"/></svg>`)}`,
  retired: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#725A29"/><stop offset="1" stop-color="#251A0B"/></linearGradient></defs><path d="M48 5 85 20v30c0 19-15 32-37 41C26 82 11 69 11 50V20z" fill="url(#g)" stroke="#E9C77B" stroke-width="3"/><path d="M32 28h32v13c0 12-6 20-16 20S32 53 32 41V28zm0 6H23v5c0 9 6 13 14 13m27-18h9v5c0 9-6 13-14 13M48 61v9m-12 5h24" fill="none" stroke="#FFE3A5" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`)}`,
};
export const careerStatusLogo = (status) => CAREER_STATUS_LOGOS[status] || "";

export const competitionDetails = {};

export const emptyTeamForm = {
  name: "",
  shortName: "",
  country: "",
  countryId: "",
  countryCode: "",
  countryMapUrl: "",
  countryTeamMapUrl: "",
  locationMapUrl: "",
  leagueId: "",
  newLeagueName: "",
  continent: "Europe",
  city: "",
  logo: "",
  primaryColor: "",
  secondaryColor: "",
  foundedYear: "",
  stadium: "",
  stadiumId: "",
  stadiumCapacity: "",
  stadiumBuiltYear: "",
  stadiumRenovation: "",
  pitchDimensions: "",
  stadiumInteriorUrl: "",
  stadiumExteriorUrl: "",
  reputation: "0",
  market: "0",
  history: "",
  coachName: "",
  coachPhotoUrl: "",
  captainName: "",
  captainPhotoUrl: "",
  secondCaptainName: "",
  secondCaptainPhotoUrl: "",
  keyPlayerName: "",
  keyPlayerPhotoUrl: "",
  kit1PhotoUrl: "",
  kit1ShopUrl: "",
  kit1BadgeBg: "",
  kit1BadgeText: "",
  kit2PhotoUrl: "",
  kit2ShopUrl: "",
  kit2BadgeBg: "",
  kit2BadgeText: "",
  kit3PhotoUrl: "",
  kit3ShopUrl: "",
  kit3BadgeBg: "",
  kit3BadgeText: "",
  kitsOverviewUrl: "",
  dataSource: "Manual",
  isActive: true,
};

export const inputClassName =
  "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#003399] focus:ring-2 focus:ring-[#003399]/10";

export const textareaClassName =
  "min-h-[104px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#003399] focus:ring-2 focus:ring-[#003399]/10";

export const normalizeImageUrl = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";

  let url = trimmed;

  if (url.startsWith("//")) {
    url = `https:${url}`;
  } else if (!/^(https?:|data:|blob:)/i.test(url)) {
    url = `https://${url}`;
  }

  const githubBlobMatch = url.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/i
  );

  if (githubBlobMatch) {
    const [, owner, repo, branch, filePath] = githubBlobMatch;
    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
  }

  return url;
};

export const rgbToHex = (r, g, b) =>
  `#${[r, g, b].map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0")).join("").toUpperCase()}`;

export const extractImagePalette = (image) => {
  try {
    const canvas = document.createElement("canvas");
    const size = 80;
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return [];

    context.drawImage(image, 0, 0, size, size);
    const pixels = context.getImageData(0, 0, size, size).data;
    const buckets = new Map();

    for (let index = 0; index < pixels.length; index += 16) {
      const alpha = pixels[index + 3];
      if (alpha < 160) continue;

      const r = pixels[index];
      const g = pixels[index + 1];
      const b = pixels[index + 2];
      const brightness = (r + g + b) / 3;
      if (brightness > 248 || brightness < 8) continue;

      const key = [Math.round(r / 24), Math.round(g / 24), Math.round(b / 24)].join(",");
      const previous = buckets.get(key) || { count: 0, r: 0, g: 0, b: 0 };
      previous.count += 1;
      previous.r += r;
      previous.g += g;
      previous.b += b;
      buckets.set(key, previous);
    }

    return Array.from(buckets.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 12)
      .map((bucket) => rgbToHex(bucket.r / bucket.count, bucket.g / bucket.count, bucket.b / bucket.count));
  } catch (error) {
    console.warn("Could not extract logo colors. The image server may not allow canvas access.", error);
    return [];
  }
};

export function getCountryFlagUrl(country) {
  const directFlag = normalizeImageUrl(
    country?.flag || country?.flag_url || country?.flagUrl
  );

  if (directFlag) return directFlag;

  const code = String(country?.code || "").trim().toUpperCase();

  const alpha3ToAlpha2 = {
    DEU: "de", SAU: "sa", ARG: "ar", BEL: "be", BRA: "br",
    ESP: "es", FRA: "fr", ENG: "gb", GBR: "gb", ITA: "it",
    NOR: "no", POL: "pl", POR: "pt",
  };

  const alpha2 = alpha3ToAlpha2[code] || (code.length === 2 ? code.toLowerCase() : "");

  return alpha2 ? `https://flagcdn.com/${alpha2}.svg` : "";
}

export function cleanJsonInput(value) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return fenced ? fenced[1].trim() : trimmed;
}

export function importedValue(value) {
  return value === null || value === undefined ? "" : String(value);
}

export function numericValue(value, fallback = "0") {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  const normalized = String(value).trim().toLowerCase();
  const categoryMap = { elite: "9500", high: "8000", medium: "6000", low: "3500", unclassified: "0" };
  if (categoryMap[normalized]) return categoryMap[normalized];
  const digits = normalized.replace(/[^0-9.-]/g, "");
  return digits && Number.isFinite(Number(digits)) ? digits : fallback;
}

export function formatMarketValue(value, fallback = "") {
  if (value === null || value === undefined || value === "") return fallback;
  const normalized = String(value).trim();
  if (!normalized) return fallback;
  const digits = normalized.replace(/\D/g, "");
  if (!digits) return fallback;
  const numeric = digits.replace(/^0+(?=\d)/, "");
  const grouped = numeric.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${grouped} (€)`;
}

export function cleanMarketInput(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  const numeric = digits.replace(/^0+(?=\d)/, "");
  return numeric.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function mapImportedTeamToForm(data) {
  const stadium = data.stadium || {};
  const classification = data.classification || {};
  const staff = data.staff || {};
  const kits = data.kits || {};

  return {
    ...emptyTeamForm,
    name: importedValue(data.name),
    shortName: importedValue(data.short_name),
    country: importedValue(data.country),
    countryId: importedValue(data.country_id),
    countryCode: importedValue(data.country_code),
    newLeagueName: importedValue(data.competitions?.[0]?.name || data.league_name),
    continent: importedValue(data.continent) || "Europe",
    city: importedValue(data.city),
    logo: importedValue(data.logo || data.badge_url),
    primaryColor: importedValue(data.primary_color),
    secondaryColor: importedValue(data.secondary_color),
    foundedYear: importedValue(data.founded_year),
    stadium: importedValue(stadium.name || data.stadium),
    stadiumId: importedValue(data.stadium_id),
    stadiumCapacity: importedValue(stadium.capacity || data.stadium_capacity),
    stadiumBuiltYear: importedValue(stadium.built_year || data.stadium_built_year),
    stadiumRenovation: importedValue(stadium.renovation_year || data.stadium_renovation),
    pitchDimensions: importedValue(stadium.pitch_dimensions || data.pitch_dimensions),
    stadiumInteriorUrl: importedValue(stadium.interior_url || data.stadium_interior_url),
    stadiumExteriorUrl: importedValue(stadium.exterior_url || data.stadium_exterior_url),
    reputation: numericValue(classification.reputation ?? data.reputation, "0"),
    market: formatMarketValue(data.market_value ?? data.market, ""),
    history: importedValue(data.history),
    coachName: importedValue(staff.coach_name || data.coach_name),
    coachPhotoUrl: importedValue(staff.coach_photo_url || data.coach_photo_url),
    captainName: importedValue(staff.captain_name || data.captain_name),
    captainPhotoUrl: importedValue(staff.captain_photo_url || data.captain_photo_url),
    secondCaptainName: importedValue(staff.second_captain_name || data.second_captain_name),
    secondCaptainPhotoUrl: importedValue(staff.second_captain_photo_url || data.second_captain_photo_url),
    keyPlayerName: importedValue(staff.key_player_name || data.key_player_name),
    keyPlayerPhotoUrl: importedValue(staff.key_player_photo_url || data.key_player_photo_url),
    kit1PhotoUrl: importedValue(kits.kit1?.photo_url || data.kit1_photo_url),
    kit1ShopUrl: importedValue(kits.kit1?.shop_url || data.kit1_shop_url),
    kit1BadgeBg: importedValue(kits.kit1?.badge_bg || data.kit1_badge_bg),
    kit1BadgeText: importedValue(kits.kit1?.badge_text || data.kit1_badge_text),
    kit2PhotoUrl: importedValue(kits.kit2?.photo_url || data.kit2_photo_url),
    kit2ShopUrl: importedValue(kits.kit2?.shop_url || data.kit2_shop_url),
    kit2BadgeBg: importedValue(kits.kit2?.badge_bg || data.kit2_badge_bg),
    kit2BadgeText: importedValue(kits.kit2?.badge_text || data.kit2_badge_text),
    kit3PhotoUrl: importedValue(kits.kit3?.photo_url || data.kit3_photo_url),
    kit3ShopUrl: importedValue(kits.kit3?.shop_url || data.kit3_shop_url),
    kit3BadgeBg: importedValue(kits.kit3?.badge_bg || data.kit3_badge_bg),
    kit3BadgeText: importedValue(kits.kit3?.badge_text || data.kit3_badge_text),
    kitsOverviewUrl: importedValue(data.kits_overview_url || data.kitsOverviewUrl),
    dataSource: "Manual",
    isActive: true,
  };
}

export function mapTeamToForm(team) {
  return {
    ...emptyTeamForm,
    name: team.name || "",
    shortName: team.short_name || team.shortName || "",
    country: team.country || "",
    countryId: team.country_id || team.countryId || "",
    countryCode: team.country_code || team.countryCode || "",
    countryMapUrl: team.country_map_url || team.countryMapUrl || "",
    countryTeamMapUrl: team.country_team_map_url || team.countryTeamMapUrl || "",
    locationMapUrl: team.location_map_url || team.locationMapUrl || "",
    leagueId: team.league_id || team.leagueId || "",
    newLeagueName: "",
    continent: team.continent || "Europe",
    city: team.city || "",
    logo: team.logo || "",
    primaryColor: team.primary_color || team.primaryColor || "",
    secondaryColor: team.secondary_color || team.secondaryColor || "",
    foundedYear: team.founded_year || team.foundedYear || "",
    stadium: team.stadium || "",
    stadiumId: team.stadium_id || team.stadiumId || "",
    stadiumCapacity: team.stadium_capacity || team.stadiumCapacity || "",
    stadiumBuiltYear: team.stadium_built_year || team.stadiumBuiltYear || "",
    stadiumRenovation: team.stadium_renovation || team.stadiumRenovation || "",
    pitchDimensions: team.pitch_dimensions || team.pitchDimensions || "",
    stadiumInteriorUrl: team.stadium_interior_url || team.stadiumInteriorUrl || "",
    stadiumExteriorUrl: team.stadium_exterior_url || team.stadiumExteriorUrl || "",
    reputation: team.reputation || "",
    market: formatMarketValue(team.market, ""),
    history: team.history || "",
    coachName: team.coach_name || team.coachName || "",
    coachPhotoUrl: team.coach_photo_url || team.coachPhotoUrl || "",
    captainName: team.captain_name || team.captainName || "",
    captainPhotoUrl: team.captain_photo_url || team.captainPhotoUrl || "",
    secondCaptainName: team.second_captain_name || team.secondCaptainName || "",
    secondCaptainPhotoUrl: team.second_captain_photo_url || team.secondCaptainPhotoUrl || "",
    keyPlayerName: team.key_player_name || team.keyPlayerName || "",
    keyPlayerPhotoUrl: team.key_player_photo_url || team.keyPlayerPhotoUrl || "",
    kit1PhotoUrl: team.kit1_photo_url || team.kit1PhotoUrl || "",
    kit1ShopUrl: team.kit1_shop_url || team.kit1ShopUrl || "",
    kit1BadgeBg: team.kit1_badge_bg || team.kit1BadgeBg || "",
    kit1BadgeText: team.kit1_badge_text || team.kit1BadgeText || "",
    kit2PhotoUrl: team.kit2_photo_url || team.kit2PhotoUrl || "",
    kit2ShopUrl: team.kit2_shop_url || team.kit2ShopUrl || "",
    kit2BadgeBg: team.kit2_badge_bg || team.kit2BadgeBg || "",
    kit2BadgeText: team.kit2_badge_text || team.kit2BadgeText || "",
    kit3PhotoUrl: team.kit3_photo_url || team.kit3PhotoUrl || "",
    kit3ShopUrl: team.kit3_shop_url || team.kit3ShopUrl || "",
    kit3BadgeBg: team.kit3_badge_bg || team.kit3BadgeBg || "",
    kit3BadgeText: team.kit3_badge_text || team.kit3BadgeText || "",
    kitsOverviewUrl: team.kits_overview_url || team.kitsOverviewUrl || "",
    dataSource: team.data_source || team.dataSource || "Manual",
    isActive: team.is_active ?? team.isActive ?? true,
  };
}

export function extractJsonFromText(value) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) return fenced[1].trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1).trim();
  }
  return "";
}

export function parseLabeledTeamText(text) {
  const result = {};
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  const aliases = {
    "nombre": "name", "nombre oficial": "name", "team name": "name", "club": "name",
    "nombre corto": "short_name", "short name": "short_name", "abreviatura": "short_name",
    "país": "country", "pais": "country", "country": "country",
    "código": "country_code", "codigo": "country_code", "country code": "country_code",
    "continente": "continent", "continent": "continent",
    "ciudad": "city", "city": "city",
    "escudo": "logo", "logo": "logo", "logo url": "logo",
    "año de fundación": "founded_year", "ano de fundacion": "founded_year", "founded year": "founded_year",
    "estadio": "stadium", "stadium": "stadium",
    "capacidad": "stadium_capacity", "stadium capacity": "stadium_capacity",
    "entrenador": "coach_name", "coach": "coach_name",
    "capitán": "captain_name", "capitan": "captain_name", "captain": "captain_name",
    "historia": "history", "history": "history",
    "reputación": "reputation", "reputacion": "reputation", "reputation": "reputation",
    "mercado": "market", "market": "market",
  };

  lines.forEach((line) => {
    const match = line.match(/^[-*•]?\s*([^:：-]+?)\s*[:：-]\s*(.+)$/);
    if (!match) return;
    const label = match[1].trim().toLowerCase();
    const value = match[2].trim();
    const field = aliases[label];
    if (field && value) result[field] = value;
  });

  return result;
}

export function normalizeImportedTeamText(value) {
  const jsonCandidate = extractJsonFromText(value);
  if (jsonCandidate) {
    try {
      const parsed = JSON.parse(jsonCandidate);
      if (parsed && !Array.isArray(parsed) && typeof parsed === "object") return parsed;
    } catch {
      // fall through to labelled-text parser
    }
  }
  return parseLabeledTeamText(value);
}

/**
 * Normaliza un nombre de entidad: elimina acentos, mayúsculas y espacios
 * extra para poder comparar nombres de país/liga de forma tolerante.
 */
export const normalizeEntityName = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[’'`´]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Alias de países: nombre común o traducción → nombre canónico.
// Clave y valor están normalizados con normalizeEntityName.
export const COUNTRY_ALIASES = {
  inglaterra: "england",
  espana: "spain",
  "estados unidos": "united states",
  estadosunidos: "united states",
  holanda: "netherlands",
  "paises bajos": "netherlands",
  alemania: "germany",
  italia: "italy",
  francia: "france",
  portugal: "portugal",
  brasil: "brazil",
  argentina: "argentina",
  escocia: "scotland",
  gales: "wales",
  irlanda: "ireland",
  belgica: "belgium",
  suecia: "sweden",
  noruega: "norway",
  dinamarca: "denmark",
  finlandia: "finland",
  suiza: "switzerland",
  austria: "austria",
  grecia: "greece",
  turquia: "turkey",
  rusia: "russia",
  ucrania: "ukraine",
  polonia: "poland",
  "republica checa": "czech republic",
  hungria: "hungary",
  rumania: "romania",
  servia: "serbia",
  croacia: "croatia",
  japon: "japan",
  "corea del sur": "south korea",
  "arabia saudi": "saudi arabia",
  egipto: "egypt",
  marruecos: "morocco",
  nigeria: "nigeria",
  ghana: "ghana",
  senegal: "senegal",
  camerun: "cameroon",
  "costa de marfil": "ivory coast",
  mexico: "mexico",
  canada: "canada",
  australia: "australia",
};

const resolveAliasKey = (name) => {
  const key = normalizeEntityName(name);
  return COUNTRY_ALIASES[key] ? normalizeEntityName(COUNTRY_ALIASES[key]) : key;
};

/**
 * Busca un país existente en la entidad Country por nombre (con alias),
 * código ISO o ID. Aplica normalización de acentos, mayúsculas y espacios.
 *
 * Devuelve { country, ambiguous, candidates }:
 *  - country: el país si hay una única coincidencia inequívoca.
 *  - ambiguous: true si varias coincidencias requieren selección manual.
 *  - candidates: lista de coincidencias para depuración/UI.
 *
 * No crea países: solo vincula el country_id existente para evitar duplicados.
 */
export const resolveCountry = (countries, { name, code, id } = {}) => {
  if (!Array.isArray(countries)) return { country: null, ambiguous: false, candidates: [] };

  if (id) {
    const byId = countries.find((c) => String(c.id) === String(id));
    if (byId) return { country: byId, ambiguous: false, candidates: [] };
  }

  const codeKey = String(code || "").trim().toUpperCase();
  const nameAlias = resolveAliasKey(name);

  const candidates = countries.filter((c) => {
    const cAlias = resolveAliasKey(c.name);
    if (nameAlias && cAlias && cAlias === nameAlias) return true;
    if (codeKey && String(c.code || "").trim().toUpperCase() === codeKey) return true;
    return false;
  });

  if (candidates.length === 1) return { country: candidates[0], ambiguous: false, candidates };
  if (candidates.length > 1) return { country: null, ambiguous: true, candidates };
  return { country: null, ambiguous: false, candidates: [] };
};

/**
 * Busca una liga existente por nombre o abreviatura (short_name).
 * Reutiliza siempre el league_id existente; no crea duplicados.
 */
export const resolveLeague = (leagues, { name, shortName, id } = {}) => {
  if (!Array.isArray(leagues)) return { league: null, ambiguous: false, candidates: [] };

  if (id) {
    const byId = leagues.find((l) => String(l.id) === String(id));
    if (byId) return { league: byId, ambiguous: false, candidates: [] };
  }

  const nameKey = normalizeEntityName(name);
  const shortKey = normalizeEntityName(shortName);

  const candidates = leagues.filter((l) => {
    const lName = normalizeEntityName(l.name);
    const lShort = normalizeEntityName(l.shortName || l.short_name || "");
    if (nameKey && lName && lName === nameKey) return true;
    if (shortKey && lShort && lShort === shortKey) return true;
    return false;
  });

  if (candidates.length === 1) return { league: candidates[0], ambiguous: false, candidates };
  if (candidates.length > 1) return { league: null, ambiguous: true, candidates };
  return { league: null, ambiguous: false, candidates: [] };
};