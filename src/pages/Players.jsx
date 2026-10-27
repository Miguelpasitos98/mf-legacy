import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search, Plus, X, Upload, FileText, CheckCircle2, AlertCircle,
  Loader2, Users, Building2, Globe2, ChevronDown,
  ArrowDownAZ, ArrowUpAZ, Cake, Goal,
} from "lucide-react";
import PlayersDetail from "@/pages/PlayerDetail";
import {updatePlayerCacheRows} from "@/utils/playerEditPatch";
import { useLocation, useSearchParams, useNavigate } from "react-router-dom";

import { parseFootballManagerCsv } from "@/utils/playerCsvImporter";
import { parsePositionCsv, findPlayerForPositionRow } from "@/utils/positionCsvImporter";
import { base44 } from "@/api/base44Client";import { useQueryClient } from "@tanstack/react-query";import { useCountriesQuery,useTeamsQuery,usePlayersQuery } from "@/hooks/useSharedData";

import PlayerFormModal from "@/components/players/PlayerFormModal";
import Fm26ImportModal from "@/components/players/Fm26ImportModal";


// A runtime error inside PlayerDetail must not reset the entire Players page.
class PlayerDetailErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("MF LEGACY PlayerDetail rendering error:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-slate-50 p-6">
          <div className="mx-auto max-w-xl rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-extrabold text-slate-900">No se ha podido abrir la ficha</h2>
            <p className="mt-2 text-sm text-slate-600">La lista de jugadores sigue intacta. Copia el siguiente error para poder localizar qué dato impide mostrar la ficha.</p>
            <pre className="my-4 overflow-auto whitespace-pre-wrap rounded-lg bg-rose-50 p-3 text-xs text-rose-800">{String(this.state.error?.message || "Error desconocido")}</pre>
            <button type="button" onClick={this.props.onBack} className="rounded-xl bg-[#003399] px-4 py-2 text-sm font-bold text-white">Volver a jugadores</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const FM26_POSITION_MAP = {
  "portero": "gk",
  "defensa_izquierdo": "dl",
  "defensa_central": "dc",
  "defensa_derecho": "dr",
  "mediocentro": "dm",
  "carrilero_izquierdo": "wbl",
  "carrilero_derecho": "wbr",
  "centrocampista_izquierdo": "ml",
  "centrocampista": "mc",
  "centrocampista_derecho": "mr",
  "mediapunta_por_la_izquierda": "aml",
  "mediapunta_central": "amc",
  "mediapunta_por_la_derecha": "amr",
  "delantero": "stc"
};
const FM26_ATTRIBUTE_MAP = {
  "mental": {
    "agresividad": "aggression",
    "anticipacion": "anticipation",
    "valentia": "bravery",
    "serenidad": "composure",
    "concentracion": "concentration",
    "consistencia": "consistency",
    "decisiones": "decisions",
    "determinacion": "determination",
    "juego_sucio": "dirtiness",
    "talento": "flair",
    "partidos_importantes": "important_matches",
    "liderazgo": "leadership",
    "movimiento": "off_the_ball",
    "colocacion": "positioning",
    "trabajo_de_equipo": "teamwork",
    "vision": "vision",
    "sacrificio": "work_rate"
  },
  "physical": {
    "aceleracion": "acceleration",
    "agilidad": "agility",
    "balance": "balance",
    "alcance_de_salto": "jumping_reach",
    "recuperacion_fisica": "natural_fitness",
    "velocidad": "pace",
    "resistencia": "stamina",
    "fuerza": "strength"
  },
  "technical": {
    "saques_de_esquina": "corners",
    "centros": "crossing",
    "regate": "dribbling",
    "remate": "finishing",
    "control": "first_touch",
    "tiros_libres": "free_kick_taking",
    "cabeceo": "heading",
    "tiros_lejanos": "long_shots",
    "saques_largos": "long_throws",
    "marcaje": "marking",
    "pases": "passing",
    "penaltis": "penalty_taking",
    "entradas": "tackling",
    "tecnica": "technique",
    "polivalencia": "versatility"
  },
  "goalkeeping": {
    "balones_aereos": "aerial_reach",
    "mando_en_el_area": "command_of_area",
    "comunicacion": "communication",
    "excentricidad": "eccentricity",
    "blocaje": "handling",
    "saques_de_puerta": "kicking",
    "uno_contra_uno": "one_on_ones",
    "reflejos": "reflexes",
    "salidas_tendencia": "rushing_out",
    "salida_de_puños": "punching",
    "saque_con_la_mano": "throwing"
  }
};

// Club suggestions are advisory: only an explicit user choice is imported.
const fm26ClubKey = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\b(football club|futbol club|f\.?c\.?)\b/g, " ").replace(/[^a-z0-9]/g, "");
const fm26ClubToken = row => `${String(row.club_uid ?? "unknown")}|${String(row.club_name || row.club_short_name || "Sin club")}`;
const fm26Similarity = (a,b) => {
  const x=fm26ClubKey(a), y=fm26ClubKey(b);
  if (!x || !y) return 0;
  if(x===y) return 100;
  if(x.includes(y) || y.includes(x)) return 78;
  const distance = Array.from({length:y.length+1},(_,j)=>j);
  for(let i=1;i<=x.length;i++) {let diagonal=distance[0]; distance[0]=i;
    for(let j=1;j<=y.length;j++){const previous=distance[j];distance[j]=Math.min(distance[j]+1,distance[j-1]+1,diagonal+(x[i-1]===y[j-1]?0:1));diagonal=previous;}}
  return Math.round(100*(1-distance[y.length]/Math.max(x.length,y.length)));
};
const fm26Normalize = (name) => String(name || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
// FM26 save nation_id is NOT a flag image filename. This verified sample catalogue
// maps FM26 nation IDs to ISO-3 codes for safe Base44 Country lookup.
// Unknown IDs must be reviewed, not guessed.
import { FM26_NATION_ISO3, fm26CountryKey, resolveSafeNation, buildFm26Nations, fm26PlayerName } from "@/utils/fm26NationLogic";

const fm26Date = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? `${value.slice(8,10)}/${value.slice(5,7)}/${value.slice(0,4)}` : "";
const fm26Number = (value) => typeof value === "number" && Number.isFinite(value) ? value : null;
const fm26PositionString = (row) => [...(row.natural_positions || []), ...(row.accomplished_positions || [])].filter(Boolean).join(", ");
const FM26_PRIMARY_CODES = { GK: "GK", DC: "DFC", DL: "LI", DR: "LD", WBL: "CRI", WBR: "CRD", DM: "CDM", MC: "CM", AMC: "CAM", AML: "EI", AMR: "ED", STC: "DC", ML: "MI", MR: "MD" };
const fm26PositionRatings = (row) => Object.fromEntries(Object.entries(FM26_POSITION_MAP).filter(([,key]) => fm26Number(row.positions?.[key]) !== null).map(([target, key]) => [target, row.positions[key]]));
const fm26Stats = (row, existing = {}) => {
  const stats = Object.fromEntries(["mental", "physical", "technical", "goalkeeping"].map(group => [group, { ...(existing[group] || {}) }]));
  for (const [group, fields] of Object.entries(FM26_ATTRIBUTE_MAP)) {
    for (const [target, source] of Object.entries(fields)) {
      if (fm26Number(row.attributes?.[source]) !== null) stats[group][target] = row.attributes[source];
    }
  }
  // The existing MF LEGACY field means resistance; FM measures susceptibility.
  if (fm26Number(row.attributes?.injury_proneness) !== null) stats.physical.tendencia_a_lesionarse = 21 - row.attributes.injury_proneness;
  return stats;
};
const fm26Payload = (row, existing = {}) => {
  const update = {
    fm26_uid: String(row.uid), fm26_unique_id: String(row.unique_id ?? ""),
    fm26_club_uid: String(row.club_uid ?? ""), fm26_nation_id: String(row.nation_id ?? ""),
    fm26_second_nation_ids: (row.second_nation_ids || []).map(String),
    fm26_natural_positions: row.natural_positions || [],
    fm26_accomplished_positions: row.accomplished_positions || [],
    fm26_raw_positions: row.positions || {},
    fm26_raw_attributes: row.raw_attributes || {},
    fm26_personality: row.personality || {},
    fm26_traits: row.traits || [], fm26_trait_codes: row.traits_code || [],
    fm26_reputation: row.reputation || {},
    fm26_contract: row.contract || {}, fm26_transfer_value: row.transfer_value ?? null,
    fm26_weekly_wage: row.contract?.wage ?? null,
    fm26_save_club_name: row.club_name || "", fm26_team_slot: row.team_slot ?? null,
    fm26_loan_details: { on_loan: Boolean(row.on_loan), parent_club_uid: row.loan_parent_club_uid ?? null, parent_club_name: row.loan_parent_club_name || "", start: row.loan_start || "", end: row.loan_end || "" },
    fm26_condition: row.raw_condition ?? null,
    fm26_match_sharpness: row.raw_match_sharpness ?? null,
    fm26_source: "fmsave FM26",
    fm26_source_record: row,
    position_ratings: { ...(existing.position_ratings || existing.positionRatings || {}), ...fm26PositionRatings(row) },
    stats: fm26Stats(row, existing.stats || {}),
  };
  const name = fm26PlayerName(row);
  if (name) update.name = name;
  const date = fm26Date(row.birth_date);
  if (date) update.date_of_birth = date;
  if (fm26Number(row.height_cm) !== null) update.height = row.height_cm;
  if (fm26Number(row.left_foot) !== null) update.left_foot = String(row.left_foot);
  if (fm26Number(row.right_foot) !== null) update.right_foot = String(row.right_foot);
  if (fm26Number(row.ability?.current) !== null) update.ca = row.ability.current;
  if (fm26Number(row.ability?.potential) !== null) update.cp = row.ability.potential;
  const positions = fm26PositionString(row);
  if (positions) {
    update.fm_position = positions;
    update.best_positions = (row.natural_positions || []).join(", ");
    const natural = row.natural_positions || [];
    const accomplished = row.accomplished_positions || [];
    const primary = natural[0] || accomplished[0];
    if (primary && FM26_PRIMARY_CODES[primary]) {
      update.position = FM26_PRIMARY_CODES[primary];
      update.position_raw = primary;
    }
    const secondary = [...natural.slice(1), ...accomplished].find(code => FM26_PRIMARY_CODES[code]);
    if (secondary) { update.secondary_position = FM26_PRIMARY_CODES[secondary]; update.secondary_position_raw = secondary; }
  }
  for (const [key, value] of Object.entries(update)) { if (value === null || value === undefined) delete update[key]; }
  return update;
};




const PLAYER_DESCRIPTIONS = [
  {
    group: "Goalkeepers",
    options: [
      "🧤 Traditional Goalkeeper",
      "🕹️ Modern Goalkeeper",
      "🧱 Positional Goalkeeper",
      "🚀 Sweeper Distributor",
      "🪟 Sweeper Keeper",
      "🪞 Penalty Specialist",
      "🔁 Reliable Backup Keeper",
    ],
  },
  {
    group: "Centre-Backs",
    options: [
      "🧱 The Sweeper",
      "🧠 Ball-Playing Defender",
      "🦍 Physical Dominator",
      "🛡️ Aggressive Front-Foot Defender",
      "🧲 Libero Defender",
      "📐 Tactical Defender",
      "👑 Defensive Leader",
      "🧬 Hybrid Defender",
    ],
  },
  {
    group: "Full-Backs / Wing-Backs",
    options: [
      "🚪 Defensive Full-Back",
      "🛞 Overlapping Wing-Back",
      "🌀 Complete Full-Back",
      "🧩 Versatile Full-Back",
      "🪫 Defensive Wing-Back",
      "⚡ Explosive Full-Back",
      "🪙 Technical Full-Back",
      "🏗️ Inverted Full-Back",
    ],
  },
  {
    group: "Central Midfielders",
    options: [
      "⚓ The Anchorman",
      "💥 The Destroyer",
      "🧭 Regista",
      "🔄 Box-to-Box Controller",
      "🧠 Advanced Playmaker",
      "📡 Deep-Lying Playmaker",
      "🧯 Firefighter Midfielder",
      "🧮 Methodical Midfielder",
      "🛠️ Workhorse Midfielder",
    ],
  },
  {
    group: "Attacking Midfielders",
    options: [
      "🎨 The Architect",
      "🎩 Space Creator",
      "🧃 The Classic 10",
      "🔁 The Connector",
      "🧱 Physical Playmaker",
      "🪛 Pressing Midfielder",
      "🎬 Late Runner",
      "🧲 Gravitational Playmaker",
      "🛠️ Physical Creator",
    ],
  },
  {
    group: "Wingers",
    options: [
      "⚡ Line Breaker",
      "🔁 Wide Connector",
      "🧨 Inside Finisher",
      "🛼 Wide Ball Carrier",
      "🪄 Creative Winger",
      "🌪️ Chaotic Winger",
      "🧤 Defensive Winger",
      "📦 Functional Winger",
      "🎯 Wide Forward",
    ],
  },
  {
    group: "Strikers",
    options: [
      "🎯 Clinical Finisher",
      "🐍 Dynamic Threat",
      "🦍 Target Man",
      "🔁 Second Striker",
      "🌀 Space Creator",
      "🧃 Space Attacker",
      "🔫 Goal Hunter",
      "🧠 Intelligent Forward",
      "🚀 Breakaway Forward",
      "🧊 Ice-Cold Finisher",
    ],
  },
  {
    group: "Special Roles",
    options: [
      "🧩 Utility Player",
      "👑 Tactical Leader",
      "🔋 Super Sub",
      "🎮 Free Spirit",
      "🧠 Hidden Genius",
      "🎭 Classic Enganche",
      "🎢 Inconsistent Talent",
      "🪶 Elegant Technician",
      "🪨 Rock-Solid Player",
      "🧪 Tactical Experiment",
      "🧳 Journeyman",
      "🫥 The Invisible One",
    ],
  },
];

const _primaryPositionCache = new WeakMap();
const getPrimaryPosition = (player) => { if (!player) return ""; const c = _primaryPositionCache.get(player); if (c !== undefined) return c;
  const ratings = player?.positionRatings || player?.position_ratings || {};
  const r = Object.entries(ratings).map(([k, v]) => ({ key: k, rating: Number(v) })).filter(({ rating }) => Number.isFinite(rating) && rating > 0).sort((a, b) => b.rating - a.rating || a.key.localeCompare(b.key))[0]?.key || "";
  _primaryPositionCache.set(player, r); return r;
};

const inputClassName =
  "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#003399] focus:ring-2 focus:ring-[#003399]/10";

const POSITION_RATING_GROUPS = [
  {
    title: "Portero / Defensa",
    positions: [
      ["portero", "Portero"],
      ["defensa_izquierdo", "Defensa izquierdo"],
      ["defensa_central", "Defensa central"],
      ["defensa_derecho", "Defensa derecho"],
      ["carrilero_izquierdo", "Carrilero izquierdo"],
      ["carrilero_derecho", "Carrilero derecho"],
    ],
  },
  {
    title: "Centrocampista",
    positions: [
      ["mediocentro", "Mediocentro"],
      ["centrocampista_izquierdo", "Centrocampista izquierdo"],
      ["centrocampista", "Centrocampista"],
      ["centrocampista_derecho", "Centrocampista derecho"],
    ],
  },
  {
    title: "Mediapunta / Delantero",
    positions: [
      ["mediapunta_por_la_izquierda", "Mediapunta por la izquierda"],
      ["mediapunta_central", "Mediapunta central"],
      ["mediapunta_por_la_derecha", "Mediapunta por la derecha"],
      ["delantero", "Delantero"],
    ],
  },
];

const POSITION_RATING_DEFAULTS = {
  portero: "0",
  defensa_izquierdo: "0",
  defensa_central: "0",
  defensa_derecho: "0",
  mediocentro: "0",
  carrilero_izquierdo: "0",
  carrilero_derecho: "0",
  centrocampista_izquierdo: "0",
  centrocampista: "0",
  centrocampista_derecho: "0",
  mediapunta_por_la_izquierda: "0",
  mediapunta_central: "0",
  mediapunta_por_la_derecha: "0",
  delantero: "0",
};

const emptyPlayerForm = {
  name: "",
  dateOfBirth: "",
  teamId: "",
  careerStatus: "active",
  retirementYear: "",
  lastTeamId: "",
  countryId: "",
  photoUrl: "",
  cardPhotoUrl: "",
  nationalCardPhotoUrl: "",
  ca: "",
  cp: "",
  positionRatings: { ...POSITION_RATING_DEFAULTS },
  description: "",
  newTeamName: "",
  newCountryName: "",
  newCountryContinent: "Europe",
};

const getCountryFlagUrl = (country) => {
  const directFlag = normalizeImageUrl(
    country?.flag ||
      country?.flag_url ||
      country?.flagUrl
  );

  if (directFlag) return directFlag;

  const code = String(country?.code || "")
    .trim()
    .toUpperCase();

  const alpha3ToAlpha2 = {
    DEU: "de",
    SAU: "sa",
    ARG: "ar",
    BEL: "be",
    BRA: "br",
    ESP: "es",
    FRA: "fr",
    ENG: "gb",
    GBR: "gb",
    ITA: "it",
    NOR: "no",
    POL: "pl",
    POR: "pt",
  };

  const alpha2 =
    alpha3ToAlpha2[code] ||
    (code.length === 2 ? code.toLowerCase() : "");

  return alpha2
    ? `https://flagcdn.com/${alpha2}.svg`
    : "";
};

import { SearchableEntitySelect } from "@/components/players/playerFormShared";

const NEW_TEAM_VALUE = "__new_team__";
const NEW_COUNTRY_VALUE = "__new_country__";

const getList = (result) => {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  if (Array.isArray(result?.items)) return result.items;
  if (Array.isArray(result?.results)) return result.results;
  return [];
};

const normalizeImageUrl = (value) => {
  const trimmed = String(value || "").trim();

  if (!trimmed) return "";

  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }

  if (/^(https?:|data:|blob:)/i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
};

const normalizePlayer = (player) => ({
  ...player,

  id:
    player?.id ||
    player?._id ||
    player?.data?.id ||
    "",

  name:
    player?.name ||
    player?.full_name ||
    player?.fullName ||
    "",

  dateOfBirth:
    player?.date_of_birth ||
    player?.dateOfBirth ||
    player?.birth_date ||
    player?.birthDate ||
    "",

  careerStatus: player?.career_status || (player?.team_id ? "active" : "free_agent"),
  lastTeamId: player?.last_team_id || "",
  retirementYear: player?.retirement_year ?? "",
  teamId:
    player?.team_id ||
    player?.teamId ||
    player?.club_id ||
    player?.clubId ||
    "",

  countryId:
    player?.country_id ||
    player?.countryId ||
    "",

  photoUrl:
    player?.photo_url ||
    player?.photoUrl ||
    player?.image_url ||
    player?.imageUrl ||
    "",

  cardPhotoUrl:
    player?.card_photo_url ||
    player?.cardPhotoUrl ||
    "",

  nationalCardPhotoUrl:
    player?.national_card_photo_url ||
    player?.nationalCardPhotoUrl ||
    "",

  ca: player?.ca ?? "",

  cp: player?.cp ?? "",

  positionRatings: {
    ...POSITION_RATING_DEFAULTS,
    ...(player?.position_ratings || {}),
  },

  description: player?.description || "",
});

const normalizeTeam = (team) => ({
  ...team,

  id:
    team?.id ||
    team?._id ||
    team?.data?.id ||
    "",

  name:
    team?.name ||
    "",

  shortName:
    team?.short_name ||
    team?.shortName ||
    "",

  logo:
    team?.logo ||
    team?.logo_url ||
    team?.logoUrl ||
    "",

  countryId:
    team?.country_id ||
    team?.countryId ||
    "",

  leagueId:
    team?.league_id ||
    team?.leagueId ||
    "",

  reputation: Number.isFinite(
    Number(
      team?.reputation ??
      team?.data?.reputation ??
      team?.data?.team?.reputation
    )
  )
    ? Number(
        team?.reputation ??
        team?.data?.reputation ??
        team?.data?.team?.reputation
      )
    : 0,
});

const normalizeCountry = (country) => ({
  ...country,

  id:
    country?.id ||
    country?._id ||
    country?.data?.id ||
    "",

  name:
    country?.name ||
    "",

  code:
    country?.code ||
    country?.country_code ||
    "",

  flag:
    country?.flag ||
    country?.flag_url ||
    country?.flagUrl ||
    "",
});

const normalizeDateOfBirth = (value) => {
  const trimmed = String(value || "").trim();

  if (!trimmed) {
    return "";
  }

  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (!match) {
    return trimmed;
  }

  const [, dayValue, monthValue, yearValue] = match;

  const day = Number(dayValue);
  const month = Number(monthValue);
  const year = Number(yearValue);

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return trimmed;
  }

  return [
    String(day).padStart(2, "0"),
    String(month).padStart(2, "0"),
    String(year),
  ].join("/");
};

const formatDate = (value) => {
  if (!value) return "—";

  const stringValue = String(value).trim();

  const normalizedDate = normalizeDateOfBirth(stringValue);

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(normalizedDate)) {
    return normalizedDate;
  }

  const date = new Date(stringValue);

  if (Number.isNaN(date.getTime())) {
    return stringValue;
  }

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

const isValidDateOfBirth = (value) => {
  const trimmed = String(value || "").trim();

  if (!trimmed) {
    return true;
  }

  const normalizedDate = normalizeDateOfBirth(trimmed);

  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(normalizedDate)) {
    return false;
  }

  return true;
};

function calculateAge(value) {
  const trimmed = String(value || "").trim();

  if (!trimmed) {
    return null;
  }

  let birthDate = null;

  const ddmmyyyy = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    birthDate = new Date(
      Number(year),
      Number(month) - 1,
      Number(day)
    );
  } else {
    const parsedDate = new Date(trimmed);

    if (!Number.isNaN(parsedDate.getTime())) {
      birthDate = parsedDate;
    }
  }

  if (!birthDate || Number.isNaN(birthDate.getTime())) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();

  const hasHadBirthday =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() &&
      today.getDate() >= birthDate.getDate());

  if (!hasHadBirthday) {
    age -= 1;
  }

  return age >= 0 && age < 120 ? age : null;
}



const POSITION_GROUPS = POSITION_RATING_GROUPS.flatMap((group) =>
  group.positions.map(([id, name]) => ({ id, name }))
);

const AGE_GROUPS = [
  { id: "age_0_18", name: "18 años o menos", test: (age) => age != null && age <= 18 },
  { id: "age_19_21", name: "19–21 años", test: (age) => age != null && age >= 19 && age <= 21 },
  { id: "age_22_25", name: "22–25 años", test: (age) => age != null && age >= 22 && age <= 25 },
  { id: "age_26_29", name: "26–29 años", test: (age) => age != null && age >= 26 && age <= 29 },
  { id: "age_30_33", name: "30–33 años", test: (age) => age != null && age >= 30 && age <= 33 },
  { id: "age_34_plus", name: "34 años o más", test: (age) => age != null && age >= 34 },
];

const DESCRIPTION_GROUPS = PLAYER_DESCRIPTIONS.flatMap((group, groupIndex) =>
  group.options.map((description, optionIndex) => ({
    id: `description_${groupIndex}_${optionIndex}`,
    name: description,
    category: group.group,
    description,
  }))
);

const PLAYER_VIEW_MODES = [
  "all",
  "teams",
  "countries",
  "positions",
  "age",
  "description",
];

import PlayerCard from "@/components/players/PlayerCard"; function GroupHeader({
  type,
  name,
  logo,
  code,
  count,
}) {
  const normalizedLogo = normalizeImageUrl(logo);

  return (
    <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white">
          {normalizedLogo ? (
            <img
              src={normalizedLogo}
              alt=""
              className="h-7 w-7 object-contain"
            />
          ) : type === "team" ? (
            <Building2 size={18} className="text-slate-400" />
          ) : (
            <Globe2 size={18} className="text-slate-400" />
          )}
        </div>

        <div className="min-w-0">
          <h2 className="truncate text-base font-extrabold tracking-tight text-slate-900">
            {name}
          </h2>
          {code && (
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
              {code}
            </p>
          )}
        </div>
      </div>

      <div className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        {count} {count === 1 ? "player" : "players"}
      </div>
    </div>
  );
}


const normalizeEntityName = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ");


const TEAM_NAME_NOISE_WORDS = new Set([
  "fc",
  "f.c",
  "cf",
  "c.f",
  "afc",
  "a.f.c",
  "sc",
  "s.c",
  "ac",
  "a.c",
  "bc",
  "b.c",
  "fk",
  "f.k",
  "sk",
  "s.k",
  "nk",
  "dk",
  "club",
  "football",
  "futbol",
  "futbol",
  "club",
  "footballclub",
  "futbolclub",
  "de",
  "del",
  "da",
  "do",
  "dos",
  "das",
]);

const normalizeTeamName = (value) => {
  const normalized = normalizeEntityName(value)
    .replace(/\bf c\b/g, " ")
    .replace(/\bc f\b/g, " ")
    .replace(/\ba f c\b/g, " ")
    .replace(/\ba c\b/g, " ")
    .replace(/\bs c\b/g, " ")
    .replace(/\bb c\b/g, " ")
    .replace(/\bf k\b/g, " ")
    .replace(/\bs k\b/g, " ")
    .replace(/\bn k\b/g, " ")
    .replace(/\bfootball club\b/g, " ")
    .replace(/\bfootballclub\b/g, " ")
    .replace(/\bfutbol club\b/g, " ")
    .replace(/\bfutbolclub\b/g, " ")
    .replace(/\bclub de futbol\b/g, " ")
    .replace(/\bclub football\b/g, " ")
    .replace(/\bclub\b/g, " ");

  return normalized
    .split(" ")
    .filter(Boolean)
    .filter((token) => !TEAM_NAME_NOISE_WORDS.has(token))
    .join(" ")
    .trim();
};

const compactTeamName = (value) =>
  normalizeTeamName(value).replace(/\s+/g, "");

const teamTokens = (value) =>
  normalizeTeamName(value)
    .split(" ")
    .filter(Boolean);

const tokenOverlapScore = (a, b) => {
  const aTokens = new Set(teamTokens(a));
  const bTokens = new Set(teamTokens(b));

  if (!aTokens.size || !bTokens.size) return 0;

  let common = 0;
  aTokens.forEach((token) => {
    if (bTokens.has(token)) common += 1;
  });

  const union = new Set([
    ...aTokens,
    ...bTokens,
  ]).size;

  return union > 0 ? common / union : 0;
};

const levenshteinDistance = (a, b) => {
  const left = String(a || "");
  const right = String(b || "");

  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  const previous = Array.from(
    { length: right.length + 1 },
    (_, index) => index
  );

  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];

    for (let j = 1; j <= right.length; j += 1) {
      const insertCost = current[j - 1] + 1;
      const deleteCost = previous[j] + 1;
      const substituteCost =
        previous[j - 1] +
        (left[i - 1] === right[j - 1] ? 0 : 1);

      current[j] = Math.min(
        insertCost,
        deleteCost,
        substituteCost
      );
    }

    for (let j = 0; j < current.length; j += 1) {
      previous[j] = current[j];
    }
  }

  return previous[right.length];
};

const teamStringSimilarity = (a, b) => {
  const normalizedA = normalizeTeamName(a);
  const normalizedB = normalizeTeamName(b);

  if (!normalizedA || !normalizedB) return 0;
  if (normalizedA === normalizedB) return 1;
  if (
    compactTeamName(a) ===
    compactTeamName(b)
  ) {
    return 0.99;
  }

  const overlap = tokenOverlapScore(
    normalizedA,
    normalizedB
  );

  const compactA = compactTeamName(a);
  const compactB = compactTeamName(b);

  const maxLength = Math.max(
    compactA.length,
    compactB.length
  );

  const editSimilarity =
    maxLength > 0
      ? 1 -
        levenshteinDistance(
          compactA,
          compactB
        ) /
          maxLength
      : 0;

  const containment =
    compactA.includes(compactB) ||
    compactB.includes(compactA)
      ? Math.min(
          compactA.length,
          compactB.length
        ) /
        Math.max(
          compactA.length,
          compactB.length
        )
      : 0;

  return Math.max(
    overlap,
    editSimilarity,
    containment
  );
};

/**
 * Finds an existing Team even when the CSV name is a shortened
 * or expanded form, e.g.:
 *
 * Arsenal -> Arsenal FC
 * FC Barcelona -> Barcelona
 * Manchester United FC -> Manchester United
 *
 * The existing short_name is also considered.
 */
const findBestExistingTeam = (
  csvTeamName,
  teams,
  preferredLeagueId = ""
) => {
  const sourceName = String(
    csvTeamName || ""
  ).trim();

  if (!sourceName) {
    return {
      team: null,
      confidence: 0,
      ambiguous: false,
      candidates: [],
    };
  }

  const sourceNormalized =
    normalizeTeamName(sourceName);

  const sourceCompact =
    compactTeamName(sourceName);

  const scored = teams
    .filter((team) => team?.id && team?.name)
    .map((team) => {
      const nameNormalized =
        normalizeTeamName(
          team.name
        );

      const shortNormalized =
        normalizeTeamName(
          team.shortName ||
            team.short_name ||
            ""
        );

      let score = 0;
      let method = "fuzzy";

      if (
        sourceNormalized &&
        sourceNormalized ===
          nameNormalized
      ) {
        score = 1;
        method =
          "normalized-name";
      } else if (
        sourceCompact &&
        sourceCompact ===
          compactTeamName(
            team.name
          )
      ) {
        score = 0.99;
        method =
          "compact-name";
      } else if (
        shortNormalized &&
        (
          sourceNormalized ===
            shortNormalized ||
          sourceCompact ===
            compactTeamName(
              team.shortName ||
                team.short_name
            )
        )
      ) {
        score = 0.985;
        method =
          "short-name";
      } else {
        const nameScore =
          teamStringSimilarity(
            sourceName,
            team.name
          );

        const shortScore =
          shortNormalized
            ? teamStringSimilarity(
                sourceName,
                team.shortName ||
                  team.short_name
              )
            : 0;

        score = Math.max(
          nameScore,
          shortScore
        );
      }

      if (
        preferredLeagueId &&
        String(
          team.leagueId ||
            team.league_id ||
            ""
        ) ===
          String(
            preferredLeagueId
          )
      ) {
        score +=
          score >= 0.82
            ? 0.015
            : 0;
      }

      return {
        team,
        score,
        method,
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score
    );

  const top =
    scored[0] || null;

  if (!top) {
    return {
      team: null,
      confidence: 0,
      ambiguous: false,
      candidates: [],
    };
  }

  const second =
    scored[1] || null;

  // Auto-match only high-confidence candidates.
  // This avoids dangerous guesses such as two different clubs
  // with nearly identical names.
  const strongEnough =
    top.score >= 0.92 ||
    (
      top.score >= 0.84 &&
      (
        !second ||
        top.score -
          second.score >=
          0.08
      )
    );

  const ambiguous =
    !strongEnough ||
    (
      second &&
      top.score >= 0.84 &&
      top.score -
        second.score <
        0.08
    );

  return {
    team: strongEnough
      ? top.team
      : null,
    confidence: top.score,
    ambiguous,
    candidates: scored
      .slice(0, 3)
      .map((candidate) => ({
        team:
          candidate.team,
        score:
          candidate.score,
        method:
          candidate.method,
      })),
  };
};

const getEntityId = (result) => {
  const data = result?.data || result;

  return (
    data?.id ||
    data?._id ||
    result?.id ||
    result?._id ||
    ""
  );
};

const generateImportedCountryCode = (name) => {
  const normalized = String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");

  return normalized.slice(0, 3).padEnd(3, "X");
};

const generateImportedTeamShortName = (name) => {
  const normalized = String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  return normalized.slice(0, 12) || `TEAM${Date.now()}`;
};

const COUNTRY_CONTINENT_MAP = {
  espana: "Europe",
  england: "Europe",
  inglaterra: "Europe",
  escocia: "Europe",
  scotland: "Europe",
  gales: "Europe",
  wales: "Europe",
  "irlanda del norte": "Europe",
  "northern ireland": "Europe",
  irlanda: "Europe",
  ireland: "Europe",
  francia: "Europe",
  france: "Europe",
  alemania: "Europe",
  germany: "Europe",
  italia: "Europe",
  italy: "Europe",
  portugal: "Europe",
  holanda: "Europe",
  netherlands: "Europe",
  belgica: "Europe",
  belgium: "Europe",
  brasil: "South America",
  brazil: "South America",
  argentina: "South America",
  uruguay: "South America",
  colombia: "South America",
  chile: "South America",
  peru: "South America",
  ecuador: "South America",
  bolivia: "South America",
  paraguay: "South America",
  venezuela: "South America",
  mexico: "North America",
  "estados unidos": "North America",
  "united states": "North America",
  canada: "North America",
  "costa rica": "North America",
  japon: "Asia",
  japan: "Asia",
  "corea del sur": "Asia",
  "south korea": "Asia",
  china: "Asia",
  australia: "Oceania",
  marruecos: "Africa",
  morocco: "Africa",
  argelia: "Africa",
  algeria: "Africa",
  tunez: "Africa",
  tunisia: "Africa",
  egipto: "Africa",
  egypt: "Africa",
  nigeria: "Africa",
  ghana: "Africa",
  senegal: "Africa",
};

const inferImportedCountryContinent = (countryName) =>
  COUNTRY_CONTINENT_MAP[
    normalizeEntityName(countryName)
  ] || "Europe";

export default function Players() {
  const [leagues, setLeagues] = useState([]);

  const queryClient = useQueryClient();const countriesQuery = useCountriesQuery();const teamsQuery = useTeamsQuery();const playersQuery = usePlayersQuery();const isLoading = countriesQuery.isLoading||teamsQuery.isLoading||playersQuery.isLoading;

  // Derived directly from the React Query cache so cached data renders on the
  // very first paint (no empty-state flash when navigating back from Teams).
  // Mutations invalidate the query keys, triggering a background refetch that
  // recomputes these memos automatically.
  const players = useMemo(() => (playersQuery.data || []).map(normalizePlayer).filter(p => p.id || p.name), [playersQuery.data]);
  const teams = useMemo(() => (teamsQuery.data || []).map(normalizeTeam).filter(t => t.id && t.name).sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" })), [teamsQuery.data]);
  const countries = useMemo(() => (countriesQuery.data || []).map(normalizeCountry).filter(c => c.id && c.name).sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" })), [countriesQuery.data]);
  const [errorMessage, setErrorMessage] = useState("");

  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");

  const [sortBy, setSortBy] = useState("");

  // Persistent player filters. They remain active when opening/closing a player.
  const [teamFilterId, setTeamFilterId] = useState("");
  const [positionFilter, setPositionFilter] = useState("");

  const [addModalOpen, setAddModalOpen] = useState(false);

  const [form, setForm] = useState({
    ...emptyPlayerForm,
  });

  const [isSaving, setIsSaving] = useState(false);

  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [fm26Import, setFm26Import] = useState(null);
  const [fm26FileName, setFm26FileName] = useState("");
  const [fm26Busy, setFm26Busy] = useState(false);
  const [fm26Message, setFm26Message] = useState("");
  const [fm26Error, setFm26Error] = useState("");
  const [fm26CreateMissing, setFm26CreateMissing] = useState(true);
  const [fm26ImportOpen, setFm26ImportOpen] = useState(false);
  const [fm26NationMapping, setFm26NationMapping] = useState({});
  const [fm26NationSearch, setFm26NationSearch] = useState({});
  const [fm26CreatingNation, setFm26CreatingNation] = useState("");
  const [fm26NewNation, setFm26NewNation] = useState({ name:"", code:"", continent:"", flag:"" });
  const [fm26CreateNationBusy, setFm26CreateNationBusy] = useState(false);
  const [fm26NationSaveBusy, setFm26NationSaveBusy] = useState(false);
  const [fm26NationSaveMessage, setFm26NationSaveMessage] = useState("");
  const [fm26NationOnlyPending, setFm26NationOnlyPending] = useState(true); const [fm26NationJustSaved, setFm26NationJustSaved] = useState(() => new Set());
  const [fm26ClubChoices, setFm26ClubChoices] = useState({});
  const [fm26ClubSearch, setFm26ClubSearch] = useState({});
  const [fm26CreatingClub, setFm26CreatingClub] = useState("");
  const [fm26NewClubName, setFm26NewClubName] = useState("");
  const [fm26NewClubCountry, setFm26NewClubCountry] = useState("");
  const [fm26NewClubLeague, setFm26NewClubLeague] = useState("");
  const [fm26Leagues, setFm26Leagues] = useState([]);
  const [fm26ProgressCurrent, setFm26ProgressCurrent] = useState(0);
  const [fm26ProgressTotal, setFm26ProgressTotal] = useState(0);
  const [fm26ProgressLabel, setFm26ProgressLabel] = useState("");
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkIds, setBulkIds] = useState([]);
  const [bulkAction, setBulkAction] = useState("team_id");
  const [bulkValue, setBulkValue] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkFeedback, setBulkFeedback] = useState("");
  const [bulkDeleteIds, setBulkDeleteIds] = useState([]);


  const [importModalOpen, setImportModalOpen] =
    useState(false);
  const [importFileName, setImportFileName] =
    useState("");
  const [importAnalysis, setImportAnalysis] =
    useState(null);
  const [isImporting, setIsImporting] =
    useState(false);
  const [importProgress, setImportProgress] =
    useState({
      current: 0,
      total: 0,
      phase: "",
    });
  const [importResult, setImportResult] =
    useState(null);
  const [importError, setImportError] =
    useState("");
  const [importFileKey, setImportFileKey] =
    useState(0);
  const [defaultImportLeagueId, setDefaultImportLeagueId] = useState("");

  // POSITIONS CSV import (updates existing players only)
  const [positionImportModalOpen, setPositionImportModalOpen] = useState(false);
  const [positionImportFileName, setPositionImportFileName] = useState("");
  const [positionImportAnalysis, setPositionImportAnalysis] = useState(null);
  const [positionImportResult, setPositionImportResult] = useState(null);
  const [positionImportError, setPositionImportError] = useState("");
  const [positionImporting, setPositionImporting] = useState(false);
  const [positionImportFileKey, setPositionImportFileKey] = useState(0);
  const [positionImportProgress, setPositionImportProgress] = useState({
    current: 0,
    total: 0,
    phase: "",
  });

  const location = useLocation();
  const [searchParams] = useSearchParams();
  const navigateFromStats = useNavigate();
  const statsPlayerId = searchParams.get("stats_player");
  useEffect(() => {
    if (!statsPlayerId) return;
    const found = players.find((p) => String(p.id) === String(statsPlayerId));
    if (found) setSelectedPlayer(found);
  }, [statsPlayerId, players]);

  const rawViewMode = searchParams.get("view");
  const viewMode = PLAYER_VIEW_MODES.includes(rawViewMode)
    ? rawViewMode
    : "all";

  const fm26Clubs = useMemo(() => {
    const groups = new Map(); const norm = n => String(n||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
    for (const row of fm26Import || []) {
      const key=fm26ClubToken(row);
      if(!groups.has(key)) groups.set(key,{key,uid:row.club_uid,name:String(row.club_name || row.club_short_name || "Sin club"),count:0,players:[]});
      const g=groups.get(key); g.count++; g.players.push({name:fm26PlayerName(row),uid:row.uid,club_uid:row.club_uid,club_name:String(row.club_name||row.club_short_name||""),team_slot:row.team_slot??null,on_loan:Boolean(row.on_loan),loan_parent_club_uid:row.loan_parent_club_uid??null,loan_parent_club_name:row.loan_parent_club_name||""});
    }
    const all=[...groups.values()];
    return all.map(group=>{const nn=norm(group.name);const variants=all.filter(g=>norm(g.name)===nn).map(g=>({uid:g.uid,count:g.count,key:g.key})).sort((a,b)=>b.count-a.count);return { ...group,players:[...group.players].sort((a,b)=>String(a.name).localeCompare(String(b.name))),nameVariants:variants,suggestions:[...teams].map(t=>({...t,score:Math.max(fm26Similarity(group.name,t.name),fm26Similarity(group.name,t.shortName))})).filter(t=>t.score>=40).sort((a,b)=>b.score-a.score).slice(0,3)};});
  }, [fm26Import,teams]);

  const fm26Nations = useMemo(() => buildFm26Nations(fm26Import, countries, fm26NationMapping), [fm26Import, countries, fm26NationMapping]);
  const fm26CountryForId = id => resolveSafeNation(id, fm26NationMapping, countries);

  // Persistent nation equivalences. One FM ID per country, one country per FM ID.
  // Explicitly selected countries override suggestions only after conflict checks.
  const saveFm26NationEquivalences = async () => {
    if (fm26NationSaveBusy || fm26CreateNationBusy || fm26Busy || !fm26Import) return;
    setFm26NationSaveBusy(true); setFm26NationSaveMessage(""); setFm26Error("");
    // Solo selecciones manuales válidas. Las sugerencias requieren confirmación explícita.
    // Los conflictos (ya detectados por computeNationStatus) se aíslan y no bloquean al resto.
    const candidates = fm26Nations.filter(item => item.status === "manual").map(item => ({ id: item.id, country: item.country }));
    const conflicts = fm26Nations.filter(item => item.status === "conflict" && fm26NationMapping[item.id]).map(item => `FM ID ${item.id}: ${item.conflictDetail}`);
    if (!candidates.length) { if (conflicts.length) setFm26Error(`Conflicto: ${conflicts.join(" · ")}. No se guardó nada.`); else setFm26NationSaveMessage("No hay selecciones manuales pendientes. Confirma una sugerencia o selecciona un país antes de guardar."); setFm26NationSaveBusy(false); return; }
    const pairs=[]; const errors=[];
    try {
      for (const item of candidates) {
        try { await base44.entities.Country.update(item.country.id, { fm_nation_id: item.id }); pairs.push({cid:String(item.country.id),fmId:String(item.id),name:item.country.name}); }
        catch (error) { errors.push(`${item.country.name}: ${error?.message || "error"}`); }
      }
      let verified=0; const failedCids=new Set(); let verifyFailed=false;
      if (pairs.length) { try {
        const resp=await base44.entities.Country.filter({id:{$in:pairs.map(p=>p.cid)}},{limit:500,fields:["id","fm_nation_id"]});
        const sm=new Map((resp?.items||resp||[]).map(c=>[String(c.id),String(c.fm_nation_id||"")]));
        pairs.forEach(p=>sm.get(p.cid)===p.fmId?verified++:(errors.push(`${p.name}: no verificado en servidor`),failedCids.add(p.cid)));
        queryClient.setQueryData(["mf-legacy","countries"],(o)=>(Array.isArray(o)?o:[]).map(c=>{const p=pairs.find(x=>x.cid===String(c.id));return p&&!failedCids.has(p.cid)?{...c,fm_nation_id:p.fmId}:c;}));
      } catch(verifyError) { verifyFailed=true; pairs.forEach(p=>failedCids.add(p.cid)); } }
      queryClient.invalidateQueries({queryKey:["mf-legacy","countries"]}); const vIds=new Set(pairs.filter(p=>!failedCids.has(p.cid)).map(p=>p.fmId));
      if(vIds.size){setFm26NationMapping(old=>{const n={...old};vIds.forEach(id=>delete n[id]);return n;});setFm26NationJustSaved(prev=>new Set([...prev,...vIds]));}
      if(conflicts.length) errors.push(...conflicts.map(c=>`Conflicto (no guardado) ${c}`));
      if(verifyFailed){setFm26Error("La escritura pudo completarse, pero no se ha podido verificar en el servidor.");setFm26NationSaveMessage(`Se guardaron ${pairs.length} escrituras; verificación no disponible. Reintenta.`);}else if(errors.length){setFm26Error(`Pendientes: ${errors.slice(0,6).join(" | ")}`);setFm26NationSaveMessage(`Verificadas en servidor: ${verified}. Fallidas: ${errors.length}.`);}else{setFm26NationSaveMessage(`Equivalencias guardadas y verificadas en servidor: ${verified}. Se reutilizarán en futuras importaciones.`);}
    } finally { setFm26NationSaveBusy(false); }
  };

  const handleCreateFm26Nation = async (fmId) => {
    if (fm26CreateNationBusy || fm26NationSaveBusy || fm26Busy || !fm26Import) return;
    const name=fm26NewNation.name.trim();
    const code=fm26NewNation.code.trim().toUpperCase();
    const continent=fm26NewNation.continent;
    const flag=fm26NewNation.flag.trim();
    if (!name || !/^[A-Z]{3}$/.test(code) || !continent) {
      setFm26Error("Para crear un país indica nombre, código de tres letras y continente.");
      return;
    }
    if (flag && !/^https?:\/\//i.test(flag)) {
      setFm26Error("La bandera debe ser una URL http(s) o dejarse vacía. No se genera la URL a partir de IDs.");
      return;
    }
    const countryChosenByOtherId=Object.entries(fm26NationMapping).find(([key,countryId])=>String(key)!==String(fmId) && countries.some(c=>String(c.id)===String(countryId) && (fm26CountryKey(c.name)===fm26CountryKey(name) || String(c.code||"").toUpperCase()===code)));
    if(countryChosenByOtherId){setFm26Error(`Este país ya está seleccionado para FM ID ${countryChosenByOtherId[0]}. Revisa la asociación.`);return;}
    const existing=countries.find(c=>fm26CountryKey(c.name)===fm26CountryKey(name) || String(c.code||"").toUpperCase()===code);
    if (existing) {
      setFm26Error(`Ya existe ${existing.name} (${existing.code}). Selecciónalo en el buscador en lugar de crear un duplicado.`);
      return;
    }
    const assigned=countries.find(c=>String(c.fm_nation_id||"")===String(fmId));
    if (assigned) {
      setFm26Error(`El FM ID ${fmId} ya está vinculado con ${assigned.name}. No se creará otro país.`);
      return;
    }
    setFm26CreateNationBusy(true);
    setFm26Error("");
    setFm26NationSaveMessage("");
    try {
      const payload={name,code,continent,is_active:true,fm_nation_id:String(fmId)};
      if(flag) payload.flag=flag;
      const response=await base44.entities.Country.create(payload);
      const created=response?.data || response;
      const id=created?.id || created?._id;
      if(!id) throw new Error("Base44 no devolvió el ID del país creado. Comprueba Countries antes de intentarlo de nuevo.");
      queryClient.setQueryData(["mf-legacy","countries"],(d)=>{const l=Array.isArray(d)?d:[];return l.some(c=>String(c.id)===String(id))?l:[...l,normalizeCountry({...created,id,fm_nation_id:String(fmId),name,code,continent})]});
      queryClient.invalidateQueries({ queryKey: ["mf-legacy", "countries"] });
      setFm26NationMapping(old=>({...old,[String(fmId)]:String(id)}));
      setFm26NationSearch(old=>({...old,[String(fmId)]:""}));
      setFm26CreatingNation("");
      setFm26NewNation({name:"",code:"",continent:"",flag:""});
      setFm26NationSaveMessage(`${name} (${code}) creado y vinculado con FM ID ${fmId}. La equivalencia ya está guardada.`);
    } catch(error) {
      setFm26Error(`No se ha podido crear el país: ${error?.message || "error"}`);
    } finally {setFm26CreateNationBusy(false);}
  };

  const fm26Preview = useMemo(() => {
    if (!fm26Import) return null;
    const byUid = new Map(players.filter(p => p.fm26_uid).map(p => [String(p.fm26_uid), p]));
    const byName = new Map();
    for(const p of players){const key=`${p.teamId}|${fm26Normalize(p.name)}`;byName.set(key,[...(byName.get(key)||[]),p]);}
    const seen=new Set();
    const rows=fm26Import.map(row=>{
      const uid=String(row.uid??"");
      const chosenId=fm26ClubChoices[fm26ClubToken(row)];
      const club=teams.find(t=>String(t.id)===String(chosenId)) || null;
      const sameUid=byUid.get(uid);
      const possible=club?(byName.get(`${club.id}|${fm26Normalize(fm26PlayerName(row))}`)||[]):[];
      const match=sameUid||(possible.length===1?possible[0]:null);
      const invalid=!uid||!fm26PlayerName(row)||!row.positions||!row.attributes||seen.has(uid);
      seen.add(uid);
      const status=invalid?"invalid":!club?"club_missing":(!sameUid&&possible.length>1)?"ambiguous":match?"update":"create";
      return {row,club,match,status};
    });
    return {rows,update:rows.filter(r=>r.status==="update").length,create:rows.filter(r=>r.status==="create").length,skipped:rows.filter(r=>!["update","create"].includes(r.status)).length,unmapped:rows.filter(r=>r.status==="club_missing").length};
  },[fm26Import,players,teams,fm26ClubChoices]);

  const handleCreateFm26Club = async (group) => {
    if(fm26Busy) return;
    const name=fm26NewClubName.trim();
    if(!name || !fm26NewClubCountry || !fm26NewClubLeague){setFm26Error("Para crear un club introduce nombre, país y liga.");return;}
    if(teams.some(t=>fm26ClubKey(t.name)===fm26ClubKey(name))){setFm26Error("Ya existe un club con nombre equivalente. Selecciónalo en el buscador.");return;}
    setFm26Busy(true);setFm26Error("");
    try{
      const country=countries.find(c=>String(c.id)===String(fm26NewClubCountry));
      const league=fm26Leagues.find(l=>String(l.id||l._id)===String(fm26NewClubLeague));
      const created=await base44.entities.Team.create({name,short_name:generateImportedTeamShortName(name),code:generateImportedTeamShortName(name),country_id:country.id,league_id:fm26NewClubLeague,continent:country.continent||league?.continent||"Europe",city:"",logo:"",is_active:true});
      const data=created?.data||created;
      const id=data?.id||data?._id;
      if(!id) throw new Error("Base44 no devolvió el ID del nuevo equipo.");
      queryClient.invalidateQueries({ queryKey: ["mf-legacy", "teams"] });
      setFm26ClubChoices(old=>({...old,[group.key]:String(id)}));
      setFm26CreatingClub("");setFm26Message(`Club ${name} creado y vinculado a ${group.count} jugadores.`);
    }catch(error){setFm26Error(`No se pudo crear el equipo: ${error?.message||"error"}`);}
    finally{setFm26Busy(false);}
  };

  const handleFm26File = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setFm26Error(""); setFm26Message(""); setFm26Import(null); setFm26NationJustSaved(new Set());
    setFm26FileName(file.name);
    setFm26NationMapping({});
    setFm26NationSearch({});
    setFm26CreatingNation("");
    setFm26NewNation({name:"",code:"",continent:"",flag:""});
    setFm26NationSaveMessage("");
    setFm26ClubChoices({});
    setFm26ClubSearch({});
    setFm26CreatingClub("");
    setFm26ProgressCurrent(0);
    setFm26ProgressTotal(0);
    setFm26ProgressLabel("");
    setFm26Leagues([]);
    try {
      const content = (await file.text()).replace(/^\uFEFF/, "").trim();
      if (!content) throw new Error("El archivo está completamente vacío. Exporta primero los jugadores desde fmsave FM26.");
      const document = JSON.parse(content);
      // Admitir tanto el array directo de fmsave como archivos con contenedor players.
      const payload = Array.isArray(document) ? document
        : Array.isArray(document?.players) ? document.players
        : Array.isArray(document?.data?.players) ? document.data.players
        : null;
      if (!payload) throw new Error("Formato JSON no reconocido. Se necesita una lista de jugadores de fmsave FM26 o un objeto con la propiedad players.");
      if (payload.length === 0) throw new Error(`El archivo «${file.name}» contiene 0 jugadores (JSON: []). No se ha importado nada. Comprueba que la exportación desde fmsave FM26 incluya jugadores.`);
      if (payload.length > 150000) throw new Error("El archivo supera 150.000 jugadores. Divide la exportación por clubes o ligas.");
      if (!payload.some(p => p && p.positions && p.attributes && p.uid != null)) throw new Error("El JSON contiene registros, pero ninguno incluye los campos uid, positions y attributes necesarios para importar jugadores desde fmsave FM26.");
      setFm26Import(payload);
      try {const result=await base44.entities.League.list();setFm26Leagues(Array.isArray(result)?result:(result?.data||[]));} catch(error) {console.warn("No se pudieron cargar las ligas disponibles",error);}
    } catch (err) { setFm26Error(err.message || "No se ha podido abrir el JSON"); }
  };

  const handleFm26Import = async () => {
    if (!fm26Preview || fm26Busy) return;
    if (fm26Preview.unmapped) {
      setFm26Error(`Quedan ${fm26Preview.unmapped} jugadores sin club asignado. Vincula todos los grupos antes de importar.`);
      return;
    }
    const actionableRows = fm26Preview.rows.filter(({ status }) => status === "update" || (status === "create" && fm26CreateMissing));
    if (!actionableRows.length) {
      setFm26Error("No hay jugadores listos para importar con la configuración actual.");
      return;
    }
    setFm26Busy(true);
    setFm26Error("");
    setFm26ProgressCurrent(0);
    setFm26ProgressTotal(actionableRows.length);
    setFm26ProgressLabel("Preparando importación...");
    let updated=0, created=0, failed=0; const failures=[];
    try {
      for (let processed = 0; processed < actionableRows.length; processed++) {
        const {row, club, match} = actionableRows[processed];
        const playerName = fm26PlayerName(row);
        setFm26ProgressCurrent(processed);
        setFm26ProgressLabel(`Importando ${processed + 1}/${actionableRows.length}: ${playerName}`);
        try {
          const data = fm26Payload(row, match || {});
          const mappedCountry = fm26CountryForId(row.nation_id);
          if (mappedCountry?.id) data.country_id = mappedCountry.id;
          const secondIds=[...new Set((row.second_nation_ids||[]).map(String))];
          if(secondIds.length) {
            const secondCountries=secondIds.map(id=>fm26CountryForId(id)?.id).filter(Boolean);
            if(secondCountries.length===secondIds.length) {
              data.fm26_second_country_ids=[...new Set(secondCountries.map(String))];
              data.secondary_country_id=data.fm26_second_country_ids[0];
            }
          }
          data.team_id = club.id;
          if (match) { await base44.entities.Player.update(match.id, data); updated++; }
          else { await base44.entities.Player.create(data); created++; }
        } catch (error) {
          failed++;
          if (failures.length < 8) failures.push(`${playerName}: ${error?.message || "error"}`);
        }
        setFm26ProgressCurrent(processed + 1);
        if ((processed + 1) % 3 === 0 || processed + 1 === actionableRows.length) {
          setFm26Message(`Importando ${processed + 1}/${actionableRows.length}...`);
        }
      }
      // Country mappings are saved explicitly with "Guardar equivalencias".
      // No silent Country mutations occur during a player import.
      setFm26Import(null);
      setFm26ProgressLabel(`Importación completada · ${updated} actualizados · ${created} creados · ${failed} errores`);
      setFm26Message(`Completado: ${updated} actualizados, ${created} creados, ${failed} errores, ${fm26Preview.skipped} omitidos por ambigüedad o datos incompletos.${failures.length ? " Ejemplos de errores: " + failures.join(" | ") : ""}`);
      await loadData();
      // Only dismiss a clean import; otherwise show failures/skipped rows for review.
      if (failed === 0 && fm26Preview.skipped === 0) {
        setFm26ImportOpen(false);
      }
    } catch(error) { setFm26Error(error?.message || "Error inesperado"); }
    finally { setFm26Busy(false); }
  };

  const toggleBulkPlayer = useCallback((id) => {
    const key = String(id);
    setBulkIds(old => old.includes(key) ? old.filter(x => x !== key) : [...old, key]);
  }, []); const handleSelectPlayer = useCallback((player) => setSelectedPlayer(player), []);
  const applyBulkAction = async (deleting = false) => {
    const selected = players.filter(p => bulkIds.includes(String(p.id)));
    if (!selected.length || bulkBusy) return;
    if (deleting && (!bulkDeleteIds.length || selected.length !== bulkDeleteIds.length || selected.some(p => !bulkDeleteIds.includes(String(p.id))))) { setBulkFeedback("La selección ha cambiado. Vuelve a confirmar la eliminación."); setBulkDeleteIds([]); return; }
    if (!deleting && (!bulkValue || (bulkAction !== "team_id" && (!Number.isFinite(Number(bulkValue)) || Number(bulkValue) < (bulkAction.startsWith("stat:") || bulkAction.startsWith("position:") ? 1 : 0) || Number(bulkValue) > (bulkAction.startsWith("stat:") || bulkAction.startsWith("position:") ? 20 : 200))))) { setBulkFeedback("Introduce un equipo o un valor numérico válido."); return; }
    setBulkBusy(true); setBulkFeedback("");
    let succeeded = 0; const errors = [];
    for (const player of selected) {
      try {
        if (deleting) await base44.entities.Player.delete(player.id);
        else {
          let payload;
          if (bulkAction === "team_id") payload = ["__free_agent__","__retired__"].includes(bulkValue) ? { team_id: "", career_status: bulkValue === "__retired__" ? "retired" : "free_agent", last_team_id: player.teamId || player.last_team_id || "" } : { team_id: bulkValue, career_status: "active", last_team_id: player.teamId || player.last_team_id || "" };
          else if (bulkAction.startsWith("stat:")) {
            const [,group,field] = bulkAction.split(":");
            payload = { stats: { ...(player.stats || {}), [group]: { ...(player.stats?.[group] || {}), [field]: Number(bulkValue) } } };
          } else if (bulkAction.startsWith("position:")) {
            const field = bulkAction.slice("position:".length);
            payload = { position_ratings: { ...(player.position_ratings || {}), [field]: Number(bulkValue) } };
          } else payload = { [bulkAction]: Number(bulkValue) };
          await base44.entities.Player.update(player.id, payload);
        }
        succeeded++;
      } catch(err) { errors.push(`${player.name}: ${err.message || "Error"}`); }
    }
    setBulkFeedback(`${succeeded}/${selected.length} ${deleting ? "eliminados" : "actualizados"}.${errors.length ? " Errores: " + errors.slice(0,3).join(" · ") : ""}`);
    setBulkIds(errors.length ? selected.filter(p => errors.some(x => x.startsWith(p.name+":"))).map(p => String(p.id)) : []);
    setBulkDeleteIds([]); setBulkBusy(false);
    await loadData();
  };

  const loadData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["mf-legacy", "players"] }),
      queryClient.invalidateQueries({ queryKey: ["mf-legacy", "teams"] }),
      queryClient.invalidateQueries({ queryKey: ["mf-legacy", "countries"] }),
    ]);
  };

  useEffect(() => {
    if (countriesQuery.error || teamsQuery.error || playersQuery.error) { setErrorMessage("No se han podido cargar los datos."); return; }
    if (!isLoading) setErrorMessage("");
  }, [isLoading, countriesQuery.error, teamsQuery.error, playersQuery.error]);

  useEffect(() => {
    if (location.state?.mfPlayerViewChange) {
      setSelectedPlayer(null);
    }
  }, [location.key, location.state]);

  useEffect(() => {
    setSelectedPlayer(null);
  }, [viewMode]);

  const teamById = useMemo(() => {
    return teams.reduce((map, team) => {
      map[team.id] = team;
      return map;
    }, {});
  }, [teams]);

  const countryById = useMemo(() => {
    return countries.reduce((map, country) => {
      map[country.id] = country;
      return map;
    }, {});
  }, [countries]);

  const filteredPlayers = useMemo(() => {
    const query = search.trim().toLowerCase();
    const POSITION_SORT_ORDER = { portero: 0, defensa_izquierdo: 1, defensa_derecho: 1, defensa_central: 1, carrilero_izquierdo: 1, carrilero_derecho: 1, mediocentro: 2, centrocampista: 3, centrocampista_izquierdo: 3, centrocampista_derecho: 3, mediapunta_central: 4, mediapunta_por_la_izquierda: 5, mediapunta_por_la_derecha: 5, delantero: 6 };
    const posOrder = (p) => POSITION_SORT_ORDER[getPrimaryPosition(p)] ?? 7;
    const posRating = (p) => {
      const ratings = p?.positionRatings || p?.position_ratings || {};
      const r = Number(ratings[getPrimaryPosition(p)]);
      return Number.isFinite(r) ? r : 0;
    };
    const cmp = (a, b) => (a.name || "").localeCompare(b.name || "", "es", { sensitivity: "base" });

    return players
      .filter((player) => {
        const team = teamById[player.teamId];
        const country = countryById[player.countryId];

        if (teamFilterId && String(player.teamId || "") !== String(teamFilterId)) {
          return false;
        }

        if (positionFilter && getPrimaryPosition(player) !== positionFilter) {
          return false;
        }

        if (!query) {
          return true;
        }

        return (
          (player.name || "").toLowerCase().includes(query) ||
          (team?.name || "").toLowerCase().includes(query) ||
          (country?.name || "").toLowerCase().includes(query)
        );
      })
      .sort((a, b) => {
        if (sortBy === "ca") return Number(b.ca || 0) - Number(a.ca || 0);
        if (sortBy === "cp") return Number(b.cp || 0) - Number(a.cp || 0);
        if (sortBy === "position") {
          const oa = posOrder(a), ob = posOrder(b);
          if (oa !== ob) return oa - ob;
          const ra = posRating(a), rb = posRating(b);
          return ra !== rb ? rb - ra : cmp(a, b);
        }
        if (sortBy === "name_asc") return cmp(a, b);
        if (sortBy === "name_desc") return cmp(b, a);
        if (sortBy === "age_youngest" || sortBy === "age_oldest") {
          const aa = calculateAge(a.dateOfBirth), ab = calculateAge(b.dateOfBirth);
          if (aa == null && ab == null) return cmp(a, b);
          if (aa == null) return 1;
          if (ab == null) return -1;
          return sortBy === "age_youngest" ? aa - ab : ab - aa;
        }
        return cmp(a, b);
      });
  }, [players, search, teamById, countryById, sortBy, teamFilterId, positionFilter]);



  const groupedByTeam = useMemo(() => { if (viewMode !== "teams") return [];
    const groups = {};

    filteredPlayers.forEach((player) => {
      const key = player.teamId || "__no_team__";

      if (!groups[key]) {
        groups[key] = {
          id: key,
          team: teamById[player.teamId] || null,
          players: [],
        };
      }

      groups[key].players.push(player);
    });

    const getTeamReputation = (team) => {
      const rawValue =
        team?.reputation ??
        team?.data?.reputation ??
        team?.data?.team?.reputation ??
        0;

      const normalizedValue = String(rawValue)
        .replace(/,/g, "")
        .replace(/\s+/g, "")
        .trim();

      const numericValue = Number(normalizedValue);

      return Number.isFinite(numericValue) ? numericValue : 0;
    };

    // Orden de posiciones dentro de cada equipo:
    // portero → defensas → mediocentro → centrocampistas →
    // mediapuntas/extremos → delanteros → sin posición.
    const getTeamPositionOrder = (player) => {
      const primaryPosition = getPrimaryPosition(player);

      const positionOrder = {
        portero: 0,

        defensa_izquierdo: 1,
        defensa_central: 1,
        defensa_derecho: 1,
        carrilero_izquierdo: 1,
        carrilero_derecho: 1,

        mediocentro: 2,

        centrocampista_izquierdo: 3,
        centrocampista: 3,
        centrocampista_derecho: 3,

        mediapunta_por_la_izquierda: 4,
        mediapunta_central: 4,
        mediapunta_por_la_derecha: 4,

        delantero: 5,
      };

      return positionOrder[primaryPosition] ?? 6;
    };

    const getPrimaryPositionRating = (player) => {
      const primaryPosition = getPrimaryPosition(player);
      const ratings =
        player?.positionRatings ||
        player?.position_ratings ||
        {};

      const rating = Number(ratings?.[primaryPosition]);
      return Number.isFinite(rating) ? rating : 0;
    };

    Object.values(groups).forEach((group) => {
      group.players.sort((a, b) => {
        const positionOrderA = getTeamPositionOrder(a);
        const positionOrderB = getTeamPositionOrder(b);

        // 1. Posición en el orden táctico.
        if (positionOrderA !== positionOrderB) {
          return positionOrderA - positionOrderB;
        }

        // 2. Dentro de la misma posición, mayor valoración primero.
        const ratingA = getPrimaryPositionRating(a);
        const ratingB = getPrimaryPositionRating(b);

        if (ratingA !== ratingB) {
          return ratingB - ratingA;
        }

        // 3. En empate, nombre alfabético.
        return (a.name || "").localeCompare(
          b.name || "",
          "es",
          { sensitivity: "base" }
        );
      });
    });

    return Object.values(groups).sort((a, b) => {
      const reputationA = getTeamReputation(a.team);
      const reputationB = getTeamReputation(b.team);

      // 1. Mayor reputación primero.
      if (reputationA !== reputationB) {
        return reputationB - reputationA;
      }

      // 2. En caso de empate, orden alfabético por equipo.
      const nameA = a.team?.name || a.team?.data?.name || "No club";
      const nameB = b.team?.name || b.team?.data?.name || "No club";

      return nameA.localeCompare(nameB, "es", {
        sensitivity: "base",
      });
    });
  }, [filteredPlayers, teamById, viewMode]);

  const groupedByCountry = useMemo(() => { if (viewMode !== "countries") return [];
    const groups = {};

    filteredPlayers.forEach((player) => {
      const key = player.countryId || "__no_country__";

      if (!groups[key]) {
        groups[key] = {
          id: key,
          country: countryById[player.countryId] || null,
          players: [],
        };
      }

      groups[key].players.push(player);
    });

    return Object.values(groups).sort((a, b) => {
      const nameA = a.country?.name || "No country";
      const nameB = b.country?.name || "No country";

      return nameA.localeCompare(nameB, "es", {
        sensitivity: "base",
      });
    });
  }, [filteredPlayers, countryById, viewMode]);

  const groupedByPosition = useMemo(() => { if (viewMode !== "positions") return [];
    const groups = POSITION_GROUPS.map((group) => ({
      ...group,
      players: [],
    }));

    const groupById = groups.reduce((map, group) => {
      map[group.id] = group;
      return map;
    }, {});

    const withoutPosition = {
      id: "__no_position__",
      name: "Sin posición",
      players: [],
    };

    filteredPlayers.forEach((player) => {
      const position = getPrimaryPosition(player);
      const target = groupById[position] || withoutPosition;
      target.players.push(player);
    });

    if (withoutPosition.players.length > 0) {
      groups.push(withoutPosition);
    }

    return groups;
  }, [filteredPlayers, viewMode]);

  const groupedByAge = useMemo(() => { if (viewMode !== "age") return [];
    const groups = AGE_GROUPS.map((group) => ({
      id: group.id,
      name: group.name,
      players: [],
    }));

    const groupById = groups.reduce((map, group) => {
      map[group.id] = group;
      return map;
    }, {});

    const noAgeGroup = {
      id: "age_unknown",
      name: "Edad no disponible",
      players: [],
    };

    filteredPlayers.forEach((player) => {
      const age = calculateAge(player.dateOfBirth);
      const ageGroup = AGE_GROUPS.find((group) => group.test(age));

      if (ageGroup) {
        groupById[ageGroup.id].players.push(player);
      } else {
        noAgeGroup.players.push(player);
      }
    });

    if (noAgeGroup.players.length > 0) {
      groups.push(noAgeGroup);
    }

    return groups;
  }, [filteredPlayers, viewMode]);

  const groupedByDescriptionCategories = useMemo(() => { if (viewMode !== "description") return [];
    const playerGroups = new Map();

    PLAYER_DESCRIPTIONS.forEach((category) => {
      category.options.forEach((description) => {
        playerGroups.set(description, []);
      });
    });

    const noDescriptionPlayers = [];

    filteredPlayers.forEach((player) => {
      const description = String(player?.description || "").trim();

      if (!description || !playerGroups.has(description)) {
        noDescriptionPlayers.push(player);
        return;
      }

      playerGroups.get(description).push(player);
    });

    const categories = PLAYER_DESCRIPTIONS.map((category, categoryIndex) => ({
      id: `description_category_${categoryIndex}`,
      name: category.group,
      subgroups: category.options.map((description, optionIndex) => ({
        id: `description_${categoryIndex}_${optionIndex}`,
        name: description,
        players: playerGroups.get(description) || [],
      })),
    }));

    if (noDescriptionPlayers.length > 0) {
      categories.push({
        id: "description_category_unknown",
        name: "Sin descripción",
        subgroups: [
          {
            id: "description_unknown",
            name: "Jugadores sin descripción",
            players: noDescriptionPlayers,
          },
        ],
      });
    }

    return categories;
  }, [filteredPlayers, viewMode]);

  const handleOpenAddPlayer = () => {
    setForm({
      ...emptyPlayerForm,
    });

    setAddModalOpen(true);
  };

  const handleOpenPositionImport = () => {
    setPositionImportModalOpen(true);
    setPositionImportFileName("");
    setPositionImportAnalysis(null);
    setPositionImportResult(null);
    setPositionImportError("");
    setPositionImportProgress({
      current: 0,
      total: 0,
      phase: "",
    });
    setPositionImportFileKey((current) => current + 1);
  };

  const handleClosePositionImport = () => {
    if (positionImporting) return;

    setPositionImportModalOpen(false);
    setPositionImportFileName("");
    setPositionImportAnalysis(null);
    setPositionImportResult(null);
    setPositionImportError("");
    setPositionImportProgress({
      current: 0,
      total: 0,
      phase: "",
    });
    setPositionImportFileKey((current) => current + 1);
  };

  const handlePositionImportFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setPositionImportError("");
    setPositionImportResult(null);
    setPositionImportAnalysis(null);
    setPositionImportFileName(file.name);

    try {
      const csvText = await file.text();
      if (!csvText.trim()) {
        throw new Error("El archivo CSV de posiciones está vacío.");
      }

      const analysis = parsePositionCsv(csvText);

      if (analysis.missingRequiredHeaders?.length) {
        throw new Error(
          `Faltan columnas obligatorias: ${analysis.missingRequiredHeaders.join(", ")}`
        );
      }

      if (!analysis.players?.length) {
        throw new Error("No se encontraron filas de jugadores en el CSV de posiciones.");
      }

      const rows = analysis.players.map((row) => {
        const match = findPlayerForPositionRow(row, players, teams);
        return { ...row, match };
      });

      setPositionImportAnalysis({
        ...analysis,
        rows,
        matched: rows.filter((row) => row.match?.status === "matched").length,
        ambiguous: rows.filter((row) => row.match?.status === "ambiguous").length,
        notFound: rows.filter((row) => row.match?.status === "not_found").length,
        invalid: rows.filter((row) => row.match?.status === "invalid").length,
      });
    } catch (error) {
      console.error("Error leyendo CSV de posiciones:", error);
      setPositionImportError(
        error?.message || "No se ha podido leer el CSV de posiciones."
      );
    } finally {
      event.target.value = "";
    }
  };

  const handleStartPositionImport = async () => {
    const rows = positionImportAnalysis?.rows || [];
    if (!rows.length || positionImporting) return;

    const matchedRows = rows.filter((row) => row.match?.status === "matched");
    if (!matchedRows.length) {
      setPositionImportError("No hay ningún jugador válido para actualizar.");
      return;
    }

    setPositionImporting(true);
    setPositionImportError("");
    setPositionImportResult(null);

    const result = {
      total: rows.length,
      updated: 0,
      notFound: 0,
      ambiguous: 0,
      invalid: 0,
      errors: [],
    };

    try {
      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        setPositionImportProgress({
          current: index + 1,
          total: rows.length,
          phase: "Actualizando posiciones...",
        });

        if (row.match?.status === "not_found") {
          result.notFound += 1;
          continue;
        }
        if (row.match?.status === "ambiguous") {
          result.ambiguous += 1;
          continue;
        }
        if (row.match?.status === "invalid") {
          result.invalid += 1;
          continue;
        }

        const player = row.match?.player;
        if (!player?.id) {
          result.invalid += 1;
          continue;
        }

        const positionRatings = {
          ...(player.position_ratings || player.positionRatings || {}),
          ...row.position_ratings,
        };

        try {
          const positionUpdate = {
            position_ratings: positionRatings,
          };

          // A position CSV must never erase an existing text field just
          // because that field is empty in a later import.
          if (String(row.fm_position || "").trim()) {
            positionUpdate.fm_position = row.fm_position.trim();
          }

          if (String(row.best_positions || "").trim()) {
            positionUpdate.best_positions = row.best_positions.trim();
          }

          if (String(row.role_used_to_fill_empty_attributes || "").trim()) {
            positionUpdate.role_used_to_fill_empty_attributes =
              row.role_used_to_fill_empty_attributes.trim();
          }

          if (String(row.preferred_central_position || "").trim()) {
            positionUpdate.preferred_central_position =
              row.preferred_central_position.trim();
          }

          await base44.entities.Player.update(player.id, positionUpdate);
          result.updated += 1;
        } catch (error) {
          result.errors.push(
            `${row.name}: ${
              error?.response?.data?.message ||
              error?.response?.data?.error ||
              error?.message ||
              "Error desconocido."
            }`
          );
        }
      }

      await loadData();
      setPositionImportResult(result);
    } catch (error) {
      console.error("Error actualizando posiciones:", error);
      setPositionImportError(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          error?.message ||
          "No se ha podido completar la actualización de posiciones."
      );
      setPositionImportResult(result);
    } finally {
      setPositionImporting(false);
    }
  };

  const handleOpenImport = async () => {
    setImportModalOpen(true);
    setDefaultImportLeagueId("");
    setImportFileName("");
    setImportAnalysis(null);
    setImportResult(null);
    setImportError("");
    setImportProgress({
      current: 0,
      total: 0,
      phase: "",
    });
    setImportFileKey((current) => current + 1);
    await loadImportLeagues();
  };

  const handleCloseImport = () => {
    if (isImporting) return;

    setImportModalOpen(false);
    setDefaultImportLeagueId("");
    setImportFileName("");
    setImportAnalysis(null);
    setImportResult(null);
    setImportError("");
    setImportProgress({
      current: 0,
      total: 0,
      phase: "",
    });
    setImportFileKey((current) => current + 1);
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setImportError("");
    setImportResult(null);
    setImportAnalysis(null);
    setImportFileName(file.name);

    try {
      const csvText = await file.text();

      if (!csvText.trim()) {
        throw new Error(
          "El archivo CSV está vacío."
        );
      }

      const rawAnalysis =
        parseFootballManagerCsv(csvText);

      const analysis = {
        ...rawAnalysis,
        total_rows:
          rawAnalysis?.total_rows ??
          rawAnalysis?.players?.length ??
          rawAnalysis?.rows?.length ??
          0,
      };

      if (!analysis.total_rows) {
        throw new Error(
          "No se encontraron jugadores en el CSV."
        );
      }

      setImportAnalysis(analysis);
    } catch (error) {
      console.error(
        "Error reading CSV:",
        error
      );

      setImportError(
        error?.message ||
          "No se ha podido leer el archivo CSV."
      );
    } finally {
      event.target.value = "";
    }
  };

  const importPreview = useMemo(() => {
    if (!importAnalysis) return null;

    const countryMap = new Map(
      countries.map((country) => [
        normalizeEntityName(country.name),
        country,
      ])
    );

    const uniqueCountries = new Set();
    const uniqueTeams = new Set();
    let missingNames = 0;
    let missingCountries = 0;
    let missingTeams = 0;

    importAnalysis.players.forEach(({ player, source }) => {
      const countryKey = normalizeEntityName(source?.countryName || "");
      const teamKey = normalizeTeamName(source?.teamName || "");

      if (!player?.name?.trim()) missingNames += 1;
      if (!countryKey) missingCountries += 1;
      else uniqueCountries.add(countryKey);
      if (!teamKey) missingTeams += 1;
      else uniqueTeams.add(teamKey);
    });

    const existingCountries = Array.from(uniqueCountries).filter((key) => countryMap.has(key)).length;

    const existingTeams = Array.from(uniqueTeams).filter((teamKey) =>
      Boolean(
        findBestExistingTeam(
          teamKey,
          teams,
          defaultImportLeagueId
        ).team
      )
    ).length;

    return {
      total: importAnalysis.total_rows ?? importAnalysis.players.length,
      uniqueCountries: uniqueCountries.size,
      existingCountries,
      newCountries: uniqueCountries.size - existingCountries,
      uniqueTeams: uniqueTeams.size,
      existingTeams,
      newTeams: uniqueTeams.size - existingTeams,
      missingNames,
      missingCountries,
      missingTeams,
      warningRows: importAnalysis.players.filter(({ warnings = [] }) => warnings.length > 0).length,
    };
  }, [
    importAnalysis,
    countries,
    teams,
    defaultImportLeagueId,
  ]);

  const loadImportLeagues = async () => {
    try {
      const result = await base44.entities.League.list();
      const list = getList(result)
        .filter((league) => (league?.id || league?._id) && league?.name)
        .sort((a, b) => String(a.name).localeCompare(String(b.name), "es", { sensitivity: "base" }));
      setLeagues(list);
      return list;
    } catch (error) {
      console.error("Error loading leagues for CSV import:", error);
      setLeagues([]);
      setImportError("No se han podido cargar las ligas. Comprueba que la entidad League existe.");
      return [];
    }
  };

  const handleStartImport = async () => {
    if (!importAnalysis?.players?.length || isImporting) return;

    const newTeamCount = Number(importPreview?.newTeams || 0);
    if (newTeamCount > 0 && !defaultImportLeagueId) {
      setImportError("Hay equipos nuevos. Selecciona una liga antes de importar.");
      return;
    }

    setIsImporting(true);
    setImportError("");
    setImportResult(null);

    const result = {
      total: importAnalysis.players.length,
      imported: 0,
      skippedDuplicates: 0,
      skippedInvalid: 0,
      countriesCreated: 0,
      teamsCreated: 0,
      errors: [],
    };

    try {
      const countryCache = new Map(
        countries.map((country) => [
          normalizeEntityName(
            country.name
          ),
          country,
        ])
      );

      const teamCache = new Map();

      teams.forEach((team) => {
        const normalizedName =
          normalizeTeamName(
            team.name
          );

        if (normalizedName) {
          teamCache.set(
            normalizedName,
            team
          );
        }

        const normalizedShortName =
          normalizeTeamName(
            team.shortName ||
              team.short_name ||
              ""
          );

        if (
          normalizedShortName &&
          !teamCache.has(
            normalizedShortName
          )
        ) {
          teamCache.set(
            normalizedShortName,
            team
          );
        }
      });

      const selectedLeague = leagues.find((league) => String(league?.id || league?._id) === String(defaultImportLeagueId));
      const selectedLeagueId = selectedLeague?.id || selectedLeague?._id || selectedLeague?.data?.id || "";
      const selectedLeagueCountryId = selectedLeague?.country_id || selectedLeague?.countryId || "";

      // Countries
      const uniqueCountryKeys = Array.from(new Set(importAnalysis.players.map(({ source }) => normalizeEntityName(source?.countryName || "")).filter(Boolean)));
      setImportProgress({ current: 0, total: uniqueCountryKeys.length, phase: "Resolving countries..." });

      for (let index = 0; index < uniqueCountryKeys.length; index += 1) {
        const countryKey = uniqueCountryKeys[index];
        if (!countryCache.has(countryKey)) {
          const sourceRow = importAnalysis.players.find(({ source }) => normalizeEntityName(source?.countryName || "") === countryKey);
          const countryName = sourceRow?.source?.countryName?.trim();
          if (countryName) {
            const created = await base44.entities.Country.create({
              name: countryName,
              code: generateImportedCountryCode(countryName),
              continent: inferImportedCountryContinent(countryName),
              flag: "",
              is_active: true,
            });
            const countryData = created?.data || created;
            const countryId = countryData?.id || countryData?._id || created?.id || created?._id || "";
            if (!countryId) throw new Error(`El país "${countryName}" se creó pero no devolvió ID.`);
            countryCache.set(countryKey, { ...countryData, id: countryId, name: countryData?.name || countryName });
            result.countriesCreated += 1;
          }
        }
        setImportProgress({ current: index + 1, total: uniqueCountryKeys.length, phase: "Resolving countries..." });
      }

      // Teams: match by team name. A club is independent of the player's nationality.
      const uniqueTeamKeys = Array.from(new Set(importAnalysis.players.map(({ source }) => normalizeEntityName(source?.teamName || "")).filter(Boolean)));
      setImportProgress({ current: 0, total: uniqueTeamKeys.length, phase: "Resolving teams..." });

      for (let index = 0; index < uniqueTeamKeys.length; index += 1) {
        const teamKey = uniqueTeamKeys[index];

        const sourceRow =
          importAnalysis.players.find(
            ({ source }) =>
              normalizeTeamName(
                source?.teamName || ""
              ) === teamKey
          );

        const teamName =
          sourceRow?.source?.teamName?.trim();

        const existingMatch =
          findBestExistingTeam(
            teamName,
            teams,
            selectedLeagueId
          );

        if (
          existingMatch.team?.id
        ) {
          const matchedTeam =
            existingMatch.team;

          teamCache.set(
            teamKey,
            matchedTeam
          );

          setImportProgress({
            current: index + 1,
            total:
              uniqueTeamKeys.length,
            phase:
              `Resolving teams... ${teamName} → ${matchedTeam.name}`,
          });

          continue;
        }

        if (teamName) {
          if (!selectedLeagueId) {
            result.errors.push(
              `Falta seleccionar una liga para el nuevo equipo "${teamName}".`
            );
          } else {
            const created =
              await base44.entities.Team.create({
                name: teamName,
                short_name:
                  generateImportedTeamShortName(
                    teamName
                  ),
                code:
                  generateImportedTeamShortName(
                    teamName
                  ),
                continent:
                  "Europe",
                country_id:
                  selectedLeagueCountryId,
                league_id:
                  selectedLeagueId,
                city: "",
                logo: "",
                is_active: true,
              });

            const teamData =
              created?.data ||
              created;

            const teamId =
              teamData?.id ||
              teamData?._id ||
              created?.id ||
              created?._id ||
              "";

            if (!teamId) {
              throw new Error(
                `El equipo "${teamName}" se creó pero no devolvió ID.`
              );
            }

            const normalizedCreatedTeam = {
              ...teamData,
              id: teamId,
              name:
                teamData?.name ||
                teamName,
              shortName:
                teamData?.short_name ||
                generateImportedTeamShortName(
                  teamName
                ),
              leagueId:
                teamData?.league_id ||
                selectedLeagueId,
            };

            teamCache.set(
              teamKey,
              normalizedCreatedTeam
            );

            result.teamsCreated +=
              1;
          }
        }

        setImportProgress({
          current: index + 1,
          total:
            uniqueTeamKeys.length,
          phase:
            "Resolving teams...",
        });
      }

      // Players / duplicates
      const existingPlayerKeys = new Set();
      players.forEach((existingPlayer) => {
        existingPlayerKeys.add([
          normalizeEntityName(existingPlayer.name),
          String(existingPlayer.dateOfBirth || "").trim(),
          String(existingPlayer.teamId || ""),
        ].join("::"));
      });
      const seenImportKeys = new Set();

      setImportProgress({ current: 0, total: importAnalysis.players.length, phase: "Importing players..." });

      for (let index = 0; index < importAnalysis.players.length; index += 1) {
        const { player, source } = importAnalysis.players[index];
        const playerName = String(player?.name || "").trim();
        if (!playerName) {
          result.skippedInvalid += 1;
          result.errors.push(`Fila ${index + 2}: jugador sin nombre.`);
          setImportProgress({ current: index + 1, total: importAnalysis.players.length, phase: "Importing players..." });
          continue;
        }

        const country = countryCache.get(normalizeEntityName(source?.countryName || ""));
        const teamName = source?.teamName || "";
        const team = teamCache.get(normalizeTeamName(teamName));
        const finalPlayer = {
          ...player,
          team_id:
            team?.id || "",
          country_id:
            country?.id || "",
        };

        /*
         * Persistimos TODO el contenido que devuelve el CSV importer.
         * Antes solo se guardaban los campos básicos y por eso
         * altura, piernas, dorsal, salario, posiciones y stats se
         * perdían antes de llegar a Base44.
         */
        const playerToCreate = {
          ...finalPlayer,

          name:
            finalPlayer.name?.trim() || "",

          date_of_birth:
            finalPlayer.date_of_birth || "",

          fm_position:
            finalPlayer.fm_position || "",

          best_positions:
            finalPlayer.best_positions || "",

          role_used_to_fill_empty_attributes:
            finalPlayer.role_used_to_fill_empty_attributes || "",

          preferred_central_position:
            finalPlayer.preferred_central_position || "",

          style:
            finalPlayer.style || "",

          height:
            Number.isFinite(
              Number(finalPlayer.height)
            )
              ? Number(finalPlayer.height)
              : 0,

          right_foot:
            finalPlayer.right_foot || "",

          left_foot:
            finalPlayer.left_foot || "",

          shirt_number:
            Number.isFinite(
              Number(
                finalPlayer.shirt_number
              )
            )
              ? Number(
                  finalPlayer.shirt_number
                )
              : 0,

          salary:
            Number.isFinite(
              Number(
                finalPlayer.salary
              )
            )
              ? Number(
                  finalPlayer.salary
                )
              : 0,

          photo_url:
            finalPlayer.photo_url || "",

          card_photo_url:
            finalPlayer.card_photo_url || "",

          national_card_photo_url:
            finalPlayer.national_card_photo_url ||
            "",

          ca:
            Number.isFinite(
              Number(finalPlayer.ca)
            )
              ? Number(finalPlayer.ca)
              : 0,

          cp:
            Number.isFinite(
              Number(finalPlayer.cp)
            )
              ? Number(finalPlayer.cp)
              : 0,

          position_ratings:
            finalPlayer.position_ratings || {},

          stats:
            finalPlayer.stats || {
              mental: {},
              physical: {},
              technical: {},
              goalkeeping: {},
            },

          description:
            finalPlayer.description || "",
        };

        if (teamName.trim() && !team?.id) {
          result.skippedInvalid += 1;
          result.errors.push(`${playerName}: no se pudo resolver el club "${teamName}".`);
          setImportProgress({ current: index + 1, total: importAnalysis.players.length, phase: "Importing players..." });
          continue;
        }

        const duplicateKey = [normalizeEntityName(finalPlayer.name), String(finalPlayer.date_of_birth || "").trim(), String(finalPlayer.team_id || "")].join("::");
        if (existingPlayerKeys.has(duplicateKey) || seenImportKeys.has(duplicateKey)) {
          result.skippedDuplicates += 1;
          seenImportKeys.add(duplicateKey);
          setImportProgress({ current: index + 1, total: importAnalysis.players.length, phase: "Importing players..." });
          continue;
        }

        try {
          await base44.entities.Player.create(
            playerToCreate
          );
          result.imported += 1;
          existingPlayerKeys.add(duplicateKey);
          seenImportKeys.add(duplicateKey);
        } catch (error) {
          result.errors.push(`${playerName}: ${error?.response?.data?.message || error?.response?.data?.error || error?.message || "Error desconocido."}`);
        }

        setImportProgress({ current: index + 1, total: importAnalysis.players.length, phase: "Importing players..." });
      }

      await loadData();
      setImportResult(result);
    } catch (error) {
      console.error("CSV import failed:", error);
      setImportError(error?.response?.data?.message || error?.response?.data?.error || error?.message || "No se ha podido completar la importación.");
      setImportResult(result);
    } finally {
      setIsImporting(false);
    }
  };

  const handleCloseAddPlayer = () => {
    if (isSaving) {
      return;
    }

    setAddModalOpen(false);

    setForm({
      ...emptyPlayerForm,
    });
  };

  const handleSavePlayer = async (event) => {
    event.preventDefault();

    if (!form.name.trim()) {
      return;
    }

    if (!isValidDateOfBirth(form.dateOfBirth)) {
      setErrorMessage(
        "La fecha de nacimiento debe tener el formato DD/MM/YYYY. Ejemplo: 28/09/1998."
      );
      return;
    }

    if (
      form.teamId === NEW_TEAM_VALUE &&
      !form.newTeamName.trim()
    ) {
      setErrorMessage(
        "Introduce el nombre del nuevo club."
      );
      return;
    }

    if (
      form.countryId === NEW_COUNTRY_VALUE &&
      !form.newCountryName.trim()
    ) {
      setErrorMessage(
        "Introduce el nombre del nuevo país."
      );
      return;
    }

    if (form.ca === "" || form.ca == null || Number(form.ca) < 0 || Number(form.ca) > 200) {
      setErrorMessage(
        "El CA debe estar entre 0 y 200."
      );
      return;
    }

    if (form.cp === "" || form.cp == null || Number(form.cp) < 0 || Number(form.cp) > 200) {
      setErrorMessage(
        "El CP debe estar entre 0 y 200."
      );
      return;
    }

    const positionRatings = Object.entries(form.positionRatings).reduce(
      (result, [code, value]) => {
        const numericValue = Number(value);
        result[code] = Number.isFinite(numericValue)
          ? numericValue
          : 0;
        return result;
      },
      {}
    );

    const invalidPositionRating = Object.values(positionRatings).some(
      (value) => value < 0 || value > 20
    );

    if (invalidPositionRating) {
      setErrorMessage(
        "Las valoraciones de posición deben estar entre 0 y 20."
      );
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    try {
      let teamId = form.teamId || "";
      let countryId = form.countryId || "";

      /* CREATE NEW TEAM */
      if (teamId === NEW_TEAM_VALUE) {
        const newTeamName = form.newTeamName.trim();

        const normalizedNewTeamName =
          newTeamName.toLowerCase();

        const existingTeam = teams.find(
          (team) =>
            String(team.name || "")
              .trim()
              .toLowerCase() ===
            normalizedNewTeamName
        );

        if (existingTeam?.id) {
          teamId = existingTeam.id;
        } else {
          const generatedShortName =
            newTeamName
              .toUpperCase()
              .replace(/[^A-Z0-9À-ÿ]/g, "")
              .slice(0, 12) ||
            `TEAM${Date.now()}`;

          const createdTeam =
            await base44.entities.Team.create({
              name: newTeamName,
              short_name: generatedShortName,
              country_id:
                form.countryId || "",
              continent: "Europe",
              is_active: true,
            });

          const createdTeamData =
            createdTeam?.data ||
            createdTeam;

          teamId =
            createdTeamData?.id ||
            createdTeamData?._id ||
            createdTeam?.id ||
            createdTeam?._id ||
            "";

          if (!teamId) {
            throw new Error(
              "El club se creó pero Base44 no devolvió su ID."
            );
          }
        }
      }

      /* CREATE NEW COUNTRY */
      if (countryId === NEW_COUNTRY_VALUE) {
        const newCountryName =
          form.newCountryName.trim();

        const normalizedNewCountryName =
          newCountryName.toLowerCase();

        const existingCountry = countries.find(
          (country) =>
            String(country.name || "")
              .trim()
              .toLowerCase() ===
            normalizedNewCountryName
        );

        if (existingCountry?.id) {
          countryId = existingCountry.id;
        } else {
          const generatedCountryCode =
            newCountryName
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .toUpperCase()
              .replace(/[^A-Z]/g, "")
              .slice(0, 3)
              .padEnd(3, "X");

          const createdCountry =
            await base44.entities.Country.create({
              name: newCountryName,
              code: generatedCountryCode,
              continent: form.newCountryContinent,
              flag: "",
              is_active: true,
            });

          const createdCountryData =
            createdCountry?.data ||
            createdCountry;

          countryId =
            createdCountryData?.id ||
            createdCountryData?._id ||
            createdCountry?.id ||
            createdCountry?._id ||
            "";

          if (!countryId) {
            throw new Error(
              "El país se creó pero Base44 no devolvió su ID."
            );
          }
        }
      }

      /* CREATE PLAYER */
      await base44.entities.Player.create({
        name: form.name.trim(),

        date_of_birth:
          normalizeDateOfBirth(
            form.dateOfBirth
          ),

        team_id: ["__free_agent__","__retired__"].includes(teamId) ? "" : teamId,
        career_status: teamId === "__retired__" ? "retired" : teamId === "__free_agent__" || !teamId ? "free_agent" : "active",
        last_team_id: form.lastTeamId || "",
        retirement_year: teamId === "__retired__" && form.retirementYear !== "" ? Number(form.retirementYear) : null,

        country_id:
          countryId || "",

        photo_url:
          normalizeImageUrl(form.photoUrl),

        card_photo_url:
          normalizeImageUrl(form.cardPhotoUrl),

        national_card_photo_url:
          normalizeImageUrl(form.nationalCardPhotoUrl),

        ca: Number(form.ca),

        cp: Number(form.cp),

        position_ratings: positionRatings,

        description:
          form.description || "",
      });

      setAddModalOpen(false);

      setForm({
        ...emptyPlayerForm,
      });

      await loadData();
    } catch (error) {
      console.error(
        "Error creating player:",
        error
      );

      const errorMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "No se ha podido crear el jugador.";

      setErrorMessage(
        `Error al crear el jugador: ${errorMessage}`
      );
    } finally {
      setIsSaving(false);
    }
  };

  /*
   * =========================================================
   * PLAYER DETAIL
   * =========================================================
   *
   * Cuando selectedPlayer tiene valor, dejamos la lista
   * y mostramos directamente PlayerDetail.
   *
   * =========================================================
   */

  if (selectedPlayer) {
    return (
      <PlayerDetailErrorBoundary key={String(selectedPlayer.id || selectedPlayer.fm26_uid || selectedPlayer.name)} onBack={() => setSelectedPlayer(null)}>
      <PlayersDetail
        player={selectedPlayer}
        team={teamById[selectedPlayer.teamId]}
        country={countryById[selectedPlayer.countryId]}
        teams={teams}
        countries={countries}
        onBack={() => {
          setSelectedPlayer(null);
          if (statsPlayerId) navigateFromStats("/players", { replace: true });
        }}
        onPlayerUpdated={(updatedPlayer, patch) => {
          setSelectedPlayer(updatedPlayer);
          // The update is already confirmed. Patch shared player cache in-place
          // rather than refetching every player just for a new photo URL.
          queryClient.setQueryData(["mf-legacy","players"],rows=>
            updatePlayerCacheRows(rows,updatedPlayer.id,patch||updatedPlayer));
        }}
      />
      </PlayerDetailErrorBoundary>
    );
  }

  return (
    <div data-mf-players-scroll className="relative h-full min-h-0 overflow-y-auto scroll-smooth bg-[#f5f7fa] p-3 sm:p-4 md:p-6">
      <div className="w-full">

        {/* HEADER */}
        <div className="mb-4 flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
          {/* PERSISTENT FILTERS — LEFT */}
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <div className="w-[220px] sm:w-[250px]">
              <SearchableEntitySelect
                value={teamFilterId}
                onChange={setTeamFilterId}
                options={teams}
                placeholder="Todos los equipos"
                searchPlaceholder="Buscar equipo..."
                kind="team"
              />
            </div>

            <div className="w-[190px] sm:w-[210px]">
              <select
                value={positionFilter}
                onChange={(event) => setPositionFilter(event.target.value)}
                className={`${inputClassName} cursor-pointer`}
                aria-label="Filtrar por posición"
              >
                <option value="">Todas las posiciones</option>
                {POSITION_GROUPS.map((position) => (
                  <option key={position.id} value={position.id}>
                    {position.name}
                  </option>
                ))}
              </select>
            </div>

            {(teamFilterId || positionFilter) && (
              <button
                type="button"
                onClick={() => {
                  setTeamFilterId("");
                  setPositionFilter("");
                }}
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-extrabold text-slate-500 transition hover:border-slate-300 hover:bg-slate-50"
                title="Limpiar filtros"
              >
                <X size={14} />
                Limpiar
              </button>
            )}
          </div>

          {/* ACTIONS */}
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">

            {/* SEARCH */}
            {searchOpen && (
              <div className="w-[220px] sm:w-[280px]">
                <input
                  type="text"
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search players..."
                  autoFocus
                  className={inputClassName}
                />
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setSearchOpen(
                  (open) => !open
                );

                if (searchOpen) {
                  setSearch("");
                }
              }}
              className={`flex h-10 w-10 items-center justify-center rounded-xl border transition ${
                searchOpen
                  ? "border-[#003399] bg-[#003399] text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              }`}
              aria-label="Search players"
              title="Search players"
            >
              {searchOpen ? (
                <X size={17} />
              ) : (
                <Search size={17} />
              )}
            </button>

            <button type="button" onClick={() => setSortBy(c => c === "ca" ? "" : "ca")} className={`flex h-10 items-center justify-center rounded-xl border px-3 text-xs font-extrabold transition ${sortBy === "ca" ? "border-[#003399] bg-[#003399] text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"}`} aria-label="Order by CA" title="Order by CA">Top CA</button>

            <button type="button" onClick={() => setSortBy(c => c === "cp" ? "" : "cp")} className={`flex h-10 items-center justify-center rounded-xl border px-3 text-xs font-extrabold transition ${sortBy === "cp" ? "border-[#003399] bg-[#003399] text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"}`} aria-label="Order by CP" title="Order by CP">Top CP</button>

            <button type="button" onClick={() => setSortBy(c => c === "position" ? "" : "position")} className={`flex h-10 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-extrabold transition ${sortBy === "position" ? "border-[#003399] bg-[#003399] text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"}`} aria-label="Order by position" title="Order by position"><Goal size={14} /> Position</button>

            <button type="button" onClick={() => setSortBy(c => c === "name_asc" ? "name_desc" : "name_asc")} className={`flex h-10 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-extrabold transition ${sortBy === "name_asc" || sortBy === "name_desc" ? "border-[#003399] bg-[#003399] text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"}`} aria-label="Order by name" title="Order by name">{sortBy === "name_desc" ? <ArrowUpAZ size={14} /> : <ArrowDownAZ size={14} />} {sortBy === "name_desc" ? "Name Z–A" : "Name A–Z"}</button>

            <button type="button" onClick={() => setSortBy(c => c === "age_youngest" ? "age_oldest" : "age_youngest")} className={`flex h-10 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-extrabold transition ${sortBy === "age_youngest" || sortBy === "age_oldest" ? "border-[#003399] bg-[#003399] text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"}`} aria-label="Order by age" title="Order by age"><Cake size={14} /> {sortBy === "age_oldest" ? "Oldest" : "Youngest"}</button>

            <button type="button" onClick={() => { setBulkMode(v => !v); setBulkIds([]); setBulkFeedback(""); setBulkDeleteIds([]); }} className={`flex h-10 items-center rounded-xl border px-3 text-xs font-extrabold ${bulkMode ? "border-blue-600 bg-blue-50 text-blue-800" : "border-slate-200 bg-white text-slate-600"}`}>{bulkMode ? "Terminar selección" : "Selección múltiple"}</button>
            <button type="button" onClick={() => { setFm26ImportOpen(true); setFm26Import(null); setFm26FileName(""); setFm26Message(""); setFm26Error(""); setFm26ProgressCurrent(0); setFm26ProgressTotal(0); setFm26ProgressLabel(""); setFm26NationJustSaved(new Set()); }} className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-extrabold text-slate-600 hover:bg-slate-50" title="Importar jugadores desde fmsave FM26 JSON">
              <Upload size={16} /><span>Import FM26 JSON</span>
            </button>

            {/* ADD PLAYER */}
            <button
              type="button"
              onClick={handleOpenAddPlayer}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#003399] text-white transition hover:bg-[#002477]"
              aria-label="Add player"
              title="Add player"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>

        {!fm26ImportOpen && fm26Message?.startsWith("Completado:") && (
          <div role="status" className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <span>{fm26Message}</span>
            <button type="button" className="shrink-0 rounded-md p-1 hover:bg-emerald-100" aria-label="Ocultar resultado de importación" onClick={() => setFm26Message("")}><X size={15}/></button>
          </div>
        )}
        {/* ERROR */}
        {errorMessage && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {bulkMode && <div className="mb-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm text-blue-900">{bulkIds.length} jugadores seleccionados</strong><div className="flex gap-2"><button type="button" className="rounded-lg border bg-white px-3 py-1.5 text-xs" onClick={() => setBulkIds(old => [...new Set([...old,...filteredPlayers.map(p => String(p.id)).filter(Boolean)])])}>Seleccionar visibles ({filteredPlayers.length})</button><button type="button" className="rounded-lg border bg-white px-3 py-1.5 text-xs" onClick={() => setBulkIds([])}>Deseleccionar</button></div></div>
          <div className="flex flex-wrap items-center gap-2"><select className="rounded-lg border p-2 text-sm" value={bulkAction} onChange={e=>{setBulkAction(e.target.value);setBulkValue("");}}><option value="team_id">Cambiar club</option><option value="ca">Cambiar CA</option><option value="cp">Cambiar PA / CP</option><option value="height">Cambiar altura (cm)</option><optgroup label="Atributos 1–20">{Object.entries(FM26_ATTRIBUTE_MAP).flatMap(([group, fields]) => Object.keys(fields).map(field => <option key={group+field} value={`stat:${group}:${field}`}>{group} · {field.replaceAll("_", " ")}</option>))}</optgroup><optgroup label="Posiciones 1–20">{Object.keys(FM26_POSITION_MAP).map(field => <option key={field} value={`position:${field}`}>{field.replaceAll("_", " ")}</option>)}</optgroup></select>
          {bulkAction === "team_id" ? <select value={bulkValue} onChange={e=>setBulkValue(e.target.value)} className="min-w-[190px] rounded-lg border p-2 text-sm"><option value="">Selecciona club destino</option><option value="__free_agent__">Agente libre</option><option value="__retired__">Retirado</option>{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select> : <input className="w-32 rounded-lg border p-2 text-sm" type="number" min={bulkAction.startsWith("stat:") || bulkAction.startsWith("position:") ? "1" : "0"} max={bulkAction.startsWith("stat:") || bulkAction.startsWith("position:") ? "20" : "200"} value={bulkValue} onChange={e=>setBulkValue(e.target.value)} placeholder="Nuevo valor" />}
          <button type="button" disabled={bulkBusy || !bulkIds.length} onClick={()=>applyBulkAction(false)} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Aplicar a seleccionados</button></div>
          <div className="flex justify-end border-t border-blue-200 pt-3">
            <button type="button" disabled={bulkBusy || !bulkIds.length} onClick={() => setBulkDeleteIds([...bulkIds])} className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-xs font-bold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40">Eliminar seleccionados ({bulkIds.length})</button>
          </div>
          {bulkFeedback && <p className="text-sm text-blue-950" role="status">{bulkFeedback}</p>}
        </div>}

        {/* CONFIRMACIÓN DE ELIMINACIÓN MASIVA */}
        {bulkDeleteIds.length > 0 && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget && !bulkBusy) setBulkDeleteIds([]); }}>
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl" role="alertdialog" aria-modal="true" aria-labelledby="bulk-delete-title" aria-describedby="bulk-delete-description">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-700"><AlertCircle size={24} /></div>
              <h3 id="bulk-delete-title" className="text-lg font-extrabold text-slate-900">¿Eliminar {bulkDeleteIds.length} {bulkDeleteIds.length === 1 ? "jugador" : "jugadores"}?</h3>
              <p id="bulk-delete-description" className="mt-2 text-sm leading-relaxed text-slate-600">Esta acción eliminará definitivamente los jugadores seleccionados de MF LEGACY. No se puede deshacer.</p>
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <button type="button" disabled={bulkBusy} onClick={() => setBulkDeleteIds([])} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancelar</button>
                <button type="button" disabled={bulkBusy} onClick={() => applyBulkAction(true)} className="rounded-xl bg-red-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-800 disabled:opacity-50">{bulkBusy ? "Eliminando..." : `Sí, eliminar ${bulkDeleteIds.length}`}</button>
              </div>
            </div>
          </div>
        )}

        {/* COUNTER */}
        <div className="mb-4 flex items-center justify-between">
          <div className="text-xs font-medium text-slate-400">
            {isLoading
              ? "Loading players..."
              : `${filteredPlayers.length} ${
                  filteredPlayers.length === 1
                    ? "player"
                    : "players"
                }`}
          </div>
        </div>

        {/* LOADING */}
        {isLoading ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-x-4 gap-y-4">
            {Array.from({ length: 8 }).map(
              (_, index) => (
                <div
                  key={index}
                  className="h-[106px] animate-pulse rounded-2xl border border-slate-200 bg-white"
                />
              )
            )}
          </div>
        ) : filteredPlayers.length > 0 ? (

          /* PLAYERS */
          <div className="space-y-8">

            {/* ALL PLAYERS */}
            {viewMode === "all" && (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-x-4 gap-y-4">
                {filteredPlayers.map((player, index) => (
                    <PlayerCard
                      selectionMode={bulkMode}
                      selected={bulkIds.includes(String(player.id))}
                      onToggleSelection={toggleBulkPlayer}
                      key={player.id || `${player.name}-${player.dateOfBirth}`}
                      player={player}
                      priority={index < 6}
                      team={teamById[player.teamId]}
                      country={countryById[player.countryId]}
                      onSelect={handleSelectPlayer}
                    />
                ))}
              </div>
            )}

            {/* BY TEAMS */}
            {viewMode === "teams" && (
              <div className="space-y-6">
                {groupedByTeam.map(
                  (group) => (
                    <section key={group.id}>
                      <GroupHeader
                        type="team"
                        name={
                          group.team?.name ||
                          "No club"
                        }
                        logo={group.team?.logo}
                        count={group.players.length}
                      />

                      <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-x-4 gap-y-4">
                        {group.players.map(
                          (player) => (
                            <PlayerCard
                          selectionMode={bulkMode}
                          selected={bulkIds.includes(String(player.id))}
                          onToggleSelection={toggleBulkPlayer}
                              key={
                                player.id ||
                                `${player.name}-${player.dateOfBirth}`
                              }
                              player={player}
                              team={
                                teamById[player.teamId]
                              }
                              country={
                                countryById[player.countryId]
                              }
                              compact
                              hideTeam
                              onSelect={handleSelectPlayer}
                            />
                          )
                        )}
                      </div>
                    </section>
                  )
                )}
              </div>
            )}

            {/* BY COUNTRIES */}
            {viewMode === "countries" && (
              <div className="space-y-6">
                {groupedByCountry.map(
                  (group) => (
                    <section key={group.id}>
                      <GroupHeader
                        type="country"
                        name={
                          group.country?.name ||
                          "No country"
                        }
                        code={
                          group.country?.code
                        }
                        count={group.players.length}
                      />

                      <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-x-4 gap-y-4">
                        {group.players.map(
                          (player) => (
                            <PlayerCard
                          selectionMode={bulkMode}
                          selected={bulkIds.includes(String(player.id))}
                          onToggleSelection={toggleBulkPlayer}
                              key={
                                player.id ||
                                `${player.name}-${player.dateOfBirth}`
                              }
                              player={player}
                              team={
                                teamById[player.teamId]
                              }
                              country={
                                countryById[player.countryId]
                              }
                              compact
                              useNationalCardPhoto
                              onSelect={handleSelectPlayer}
                            />
                          )
                        )}
                      </div>
                    </section>
                  )
                )}
              </div>
            )}


            {/* BY POSITION */}
            {viewMode === "positions" && (
              <div className="space-y-6">
                {groupedByPosition.map((group) => (
                  <section key={group.id}>
                    <GroupHeader
                      type="position"
                      name={group.name}
                      count={group.players.length}
                    />

                    <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-x-4 gap-y-4">
                      {group.players.map((player) => (
                        <PlayerCard
                          selectionMode={bulkMode}
                          selected={bulkIds.includes(String(player.id))}
                          onToggleSelection={toggleBulkPlayer}
                          key={
                            player.id ||
                            `${player.name}-${player.dateOfBirth}`
                          }
                          player={player}
                          team={teamById[player.teamId]}
                          country={countryById[player.countryId]}
                          compact
                          onSelect={handleSelectPlayer}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}

            {/* BY AGE */}
            {viewMode === "age" && (
              <div className="space-y-6">
                {groupedByAge.map((group) => (
                  <section key={group.id}>
                    <GroupHeader
                      type="age"
                      name={group.name}
                      count={group.players.length}
                    />

                    <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-x-4 gap-y-4">
                      {group.players.map((player) => (
                        <PlayerCard
                          selectionMode={bulkMode}
                          selected={bulkIds.includes(String(player.id))}
                          onToggleSelection={toggleBulkPlayer}
                          key={
                            player.id ||
                            `${player.name}-${player.dateOfBirth}`
                          }
                          player={player}
                          team={teamById[player.teamId]}
                          country={countryById[player.countryId]}
                          compact
                          onSelect={handleSelectPlayer}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}

            {/* BY DESCRIPTION */}
            {viewMode === "description" && (
              <div className="space-y-4">
                {groupedByDescriptionCategories.map((category) => {
                  const categoryCount = category.subgroups.reduce(
                    (total, subgroup) => total + subgroup.players.length,
                    0
                  );
                  return (
                    <section
                      key={category.id}
                      className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
                    >
                      <div className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left">
                        <div className="min-w-0">
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
                              <ChevronDown size={17} className="text-slate-500" />
                            </span>

                            <div className="min-w-0">
                              <h2 className="truncate text-base font-extrabold tracking-tight text-slate-900">
                                {category.name}
                              </h2>
                              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
                                {category.subgroups.length} subgroups
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                          {categoryCount} {
                            categoryCount === 1 ? "player" : "players"
                          }
                        </div>
                      </div>

                      <div className="border-t border-slate-100 bg-slate-50/40 p-3">
                          <div className="space-y-2">
                            {category.subgroups.map((subgroup) => {
                              return (
                                <div
                                  key={subgroup.id}
                                  className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                                >
                                  <div className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left">
                                    <div className="flex min-w-0 items-center gap-3">
                                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50">
                                        <ChevronDown
                                          size={15}
                                          className="text-slate-400"
                                        />
                                      </span>

                                      <span className="min-w-0 truncate text-sm font-semibold text-slate-800">
                                        {subgroup.name}
                                      </span>
                                    </div>

                                    <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                                      {subgroup.players.length} {
                                        subgroup.players.length === 1
                                          ? "player"
                                          : "players"
                                      }
                                    </span>
                                  </div>

                                  <div className="border-t border-slate-100 bg-slate-50/30 p-3">
                                      {subgroup.players.length > 0 ? (
                                        <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-x-4 gap-y-4">
                                          {subgroup.players.map((player) => (
                                            <PlayerCard
                          selectionMode={bulkMode}
                          selected={bulkIds.includes(String(player.id))}
                          onToggleSelection={toggleBulkPlayer}
                                              key={
                                                player.id ||
                                                `${player.name}-${player.dateOfBirth}`
                                              }
                                              player={player}
                                              team={teamById[player.teamId]}
                                              country={
                                                countryById[player.countryId]
                                              }
                                              compact
                                              onSelect={handleSelectPlayer}
                                            />
                                          ))}
                                        </div>
                                      ) : (
                                        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-xs font-medium text-slate-400">
                                          No players in this subgroup.
                                        </div>
                                      )}
                                    </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                    </section>
                  );
                })}
              </div>
            )}
          </div>

        ) : (

          /* EMPTY STATE */
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">

            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-300">
              <Users size={24} />
            </div>

            <h2 className="mt-4 text-sm font-extrabold text-slate-900">
              {search
                ? "No players found"
                : "No players created yet"}
            </h2>

            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
              {search
                ? "Try another player, club or country name."
                : "Create your first player using the + button."}
            </p>

            {!search && (
              <button
                type="button"
                onClick={
                  handleOpenAddPlayer
                }
                className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-[#003399] px-4 text-sm font-semibold text-white transition hover:bg-[#002477]"
              >
                <Plus size={16} />
                Add player
              </button>
            )}

          </div>
        )}

        {/* FM26 IMPORT MODAL */}
        <Fm26ImportModal
          fm26ImportOpen={fm26ImportOpen}
          setFm26ImportOpen={setFm26ImportOpen}
          fm26Busy={fm26Busy}
          fm26FileName={fm26FileName}
          fm26Message={fm26Message}
          fm26Error={fm26Error}
          setFm26Error={setFm26Error}
          fm26Import={fm26Import}
          fm26Clubs={fm26Clubs}
          fm26ClubChoices={fm26ClubChoices}
          setFm26ClubChoices={setFm26ClubChoices}
          fm26ClubSearch={fm26ClubSearch}
          setFm26ClubSearch={setFm26ClubSearch}
          fm26CreatingClub={fm26CreatingClub}
          setFm26CreatingClub={setFm26CreatingClub}
          fm26NewClubName={fm26NewClubName}
          setFm26NewClubName={setFm26NewClubName}
          fm26NewClubCountry={fm26NewClubCountry}
          setFm26NewClubCountry={setFm26NewClubCountry}
          fm26NewClubLeague={fm26NewClubLeague}
          setFm26NewClubLeague={setFm26NewClubLeague}
          fm26Leagues={fm26Leagues}
          handleCreateFm26Club={handleCreateFm26Club}
          fm26Nations={fm26Nations}
          fm26NationMapping={fm26NationMapping}
          setFm26NationMapping={setFm26NationMapping}
          fm26NationSearch={fm26NationSearch}
          setFm26NationSearch={setFm26NationSearch}
          fm26CreatingNation={fm26CreatingNation}
          setFm26CreatingNation={setFm26CreatingNation}
          fm26NewNation={fm26NewNation}
          setFm26NewNation={setFm26NewNation}
          fm26CreateNationBusy={fm26CreateNationBusy}
          fm26NationSaveBusy={fm26NationSaveBusy}
          fm26NationSaveMessage={fm26NationSaveMessage}
          setFm26NationSaveMessage={setFm26NationSaveMessage}
          fm26NationOnlyPending={fm26NationOnlyPending} fm26NationJustSaved={fm26NationJustSaved}
          setFm26NationOnlyPending={setFm26NationOnlyPending}
          saveFm26NationEquivalences={saveFm26NationEquivalences}
          handleCreateFm26Nation={handleCreateFm26Nation}
          fm26Preview={fm26Preview}
          fm26CreateMissing={fm26CreateMissing}
          setFm26CreateMissing={setFm26CreateMissing}
          handleFm26File={handleFm26File}
          handleFm26Import={handleFm26Import}
          fm26ProgressCurrent={fm26ProgressCurrent}
          fm26ProgressTotal={fm26ProgressTotal}
          fm26ProgressLabel={fm26ProgressLabel}
          teams={teams}
          countries={countries}
          fm26ClubKey={fm26ClubKey}
          fm26CountryKey={fm26CountryKey}
          FM26_NATION_ISO3={FM26_NATION_ISO3}
        />

        {/* ADD PLAYER MODAL */}
        {false && importModalOpen && (
          <div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
            onMouseDown={(event) => {
              if (
                event.target === event.currentTarget &&
                !isImporting
              ) {
                handleCloseImport();
              }
            }}
          >
            <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#003399]/[0.08] text-[#003399]">
                    <Upload size={18} />
                  </div>

                  <div className="min-w-0">
                    <h2 className="text-base font-extrabold text-slate-900">
                      Import players from CSV
                    </h2>

                    <p className="mt-0.5 text-xs text-slate-400">
                      Importación masiva desde el export de Football Manager.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCloseImport}
                  disabled={isImporting}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:opacity-40"
                  aria-label="Close"
                >
                  <X size={17} />
                </button>
              </div>

              <div className="max-h-[calc(92vh-72px)] overflow-y-auto p-5">
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-6">
                  <div className="flex flex-col items-center justify-center text-center">
                    <FileText
                      size={30}
                      strokeWidth={1.6}
                      className="text-slate-300"
                    />

                    <p className="mt-3 text-sm font-extrabold text-slate-800">
                      {importFileName ||
                        "Selecciona el CSV de Football Manager"}
                    </p>

                    <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-400">
                      Primero analizamos el archivo. Después se resuelven
                      automáticamente Countries y Teams y se crean los Players.
                    </p>

                    <label className="mt-4 inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-[#003399] px-4 text-sm font-semibold text-white transition hover:bg-[#002477]">
                      <Upload size={16} />
                      {importFileName
                        ? "Seleccionar otro CSV"
                        : "Seleccionar CSV"}

                      <input
                        key={importFileKey}
                        type="file"
                        accept=".csv,text/csv"
                        className="hidden"
                        onChange={
                          handleImportFile
                        }
                        disabled={isImporting}
                      />
                    </label>
                  </div>
                </div>

                {importError && (
                  <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <AlertCircle
                      size={17}
                      className="mt-0.5 shrink-0"
                    />

                    <div className="min-w-0">
                      {importError}
                    </div>
                  </div>
                )}

                {importAnalysis && importPreview && (
                  <>
                    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                          Players
                        </p>

                        <p className="mt-1 text-2xl font-extrabold text-slate-900">
                          {importPreview.total}
                        </p>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                          Countries
                        </p>

                        <p className="mt-1 text-2xl font-extrabold text-slate-900">
                          {importPreview.uniqueCountries}
                        </p>

                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {importPreview.newCountries} nuevos
                        </p>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                          Teams
                        </p>

                        <p className="mt-1 text-2xl font-extrabold text-slate-900">
                          {importPreview.uniqueTeams}
                        </p>

                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {importPreview.newTeams} nuevos
                        </p>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                          Warnings
                        </p>

                        <p className="mt-1 text-2xl font-extrabold text-slate-900">
                          {importPreview.warningRows}
                        </p>

                        <p className="mt-0.5 text-[11px] text-slate-400">
                          filas con avisos
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-extrabold text-slate-800">
                            Columnas detectadas
                          </p>

                          <p className="mt-1 text-[11px] text-slate-400">
                            {importAnalysis.headers.length} columnas encontradas.
                          </p>
                        </div>

                        <span className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                          Delimitador ;
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {importAnalysis.headers.map(
                          (header) => (
                            <span
                              key={header}
                              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-500"
                            >
                              {header}
                            </span>
                          )
                        )}
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                      <p className="text-xs font-extrabold text-slate-700">
                        Team matching
                      </p>
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                        Antes de crear un club, el importador compara también nombres abreviados, sufijos como FC/CF/AFC y el short name del Team existente. Solo crea un equipo cuando no encuentra una coincidencia suficientemente segura.
                      </p>
                    </div>

                    {importPreview.newTeams > 0 && (
                      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <p className="text-xs font-extrabold text-amber-900">Liga para los equipos nuevos</p>
                        <p className="mt-1 text-[11px] leading-relaxed text-amber-800/80">El CSV trae el club, pero no la liga. Los equipos que ya existen se reutilizan. Selecciona la liga que corresponde a los equipos nuevos.</p>
                        <select
                          value={defaultImportLeagueId}
                          onChange={(event) => setDefaultImportLeagueId(event.target.value)}
                          disabled={isImporting}
                          className={`${inputClassName} mt-3`}
                        >
                          <option value="">Selecciona una liga...</option>
                          {leagues.map((league) => (
                            <option key={league.id || league._id} value={league.id || league._id}>
                              {league.name}
                            </option>
                          ))}
                        </select>
                        {leagues.length === 0 && (
                          <p className="mt-2 text-[11px] font-semibold text-red-700">No se han podido cargar ligas.</p>
                        )}
                      </div>
                    )}

                    {(importPreview.missingNames > 0 ||
                      importPreview.missingCountries > 0 ||
                      importPreview.missingTeams > 0) && (
                      <div className="mt-4 grid gap-2 sm:grid-cols-3">
                        {importPreview.missingNames > 0 && (
                          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-800">
                            {importPreview.missingNames} jugador(es) sin nombre.
                          </div>
                        )}

                        {importPreview.missingCountries > 0 && (
                          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-800">
                            {importPreview.missingCountries} jugador(es) sin país.
                          </div>
                        )}

                        {importPreview.missingTeams > 0 && (
                          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-800">
                            {importPreview.missingTeams} jugador(es) sin equipo.
                          </div>
                        )}
                      </div>
                    )}

                    <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
                      <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
                        <p className="text-xs font-extrabold text-slate-800">
                          Preview
                        </p>
                      </div>

                      <div className="divide-y divide-slate-100">
                        {importAnalysis.players
                          .slice(0, 8)
                          .map(
                            ({
                              row_number,
                              player,
                              source,
                              warnings,
                            }) => (
                              <div
                                key={`${row_number}-${player.name}`}
                                className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                              >
                                <div className="min-w-0">
                                  <div className="flex min-w-0 items-center gap-2">
                                    {warnings.length === 0 ? (
                                      <CheckCircle2
                                        size={15}
                                        className="shrink-0 text-emerald-500"
                                      />
                                    ) : (
                                      <AlertCircle
                                        size={15}
                                        className="shrink-0 text-amber-500"
                                      />
                                    )}

                                    <span className="truncate text-sm font-bold text-slate-800">
                                      {player.name ||
                                        `Row ${row_number}`}
                                    </span>
                                  </div>

                                  <div className="mt-1 text-[11px] text-slate-400">
                                    {source?.countryName ||
                                      "Sin país"}
                                    {" · "}
                                    {source?.teamName ||
                                      "Sin equipo"}
                                    {" · CA "}
                                    {player.ca || 0}
                                    {" / CP "}
                                    {player.cp || 0}
                                  </div>
                                </div>

                                <div className="shrink-0 text-right text-[10px] text-slate-400">
                                  {warnings.length > 0
                                    ? warnings.join(" ")
                                    : `Fila ${row_number}`}
                                </div>
                              </div>
                            )
                          )}
                      </div>

                      {importAnalysis.players.length > 8 && (
                        <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-center text-[11px] text-slate-400">
                          Mostrando 8 de{" "}
                          {importAnalysis.players.length} jugadores.
                        </div>
                      )}
                    </div>
                  </>
                )}

                {isImporting && (
                  <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <Loader2
                          size={16}
                          className="shrink-0 animate-spin text-[#003399]"
                        />

                        <span className="truncate text-xs font-bold text-slate-700">
                          {importProgress.phase ||
                            "Importando..."}
                        </span>
                      </div>

                      <span className="shrink-0 text-xs font-semibold text-slate-400">
                        {importProgress.current} /{" "}
                        {importProgress.total}
                      </span>
                    </div>

                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-[#003399] transition-all duration-300"
                        style={{
                          width:
                            importProgress.total > 0
                              ? `${Math.min(
                                  100,
                                  (importProgress.current /
                                    importProgress.total) *
                                    100
                                )}%`
                              : "0%",
                        }}
                      />
                    </div>
                  </div>
                )}

                {importResult && !isImporting && (
                  <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2
                        size={18}
                        className="mt-0.5 shrink-0 text-emerald-600"
                      />

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-extrabold text-emerald-900">
                          Import finished
                        </p>

                        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.08em] text-emerald-700/70">
                              Imported
                            </p>
                            <p className="text-lg font-extrabold text-emerald-900">
                              {importResult.imported}
                            </p>
                          </div>

                          <div>
                            <p className="text-[10px] uppercase tracking-[0.08em] text-emerald-700/70">
                              Duplicates
                            </p>
                            <p className="text-lg font-extrabold text-emerald-900">
                              {importResult.skippedDuplicates}
                            </p>
                          </div>

                          <div>
                            <p className="text-[10px] uppercase tracking-[0.08em] text-emerald-700/70">
                              Countries
                            </p>
                            <p className="text-lg font-extrabold text-emerald-900">
                              +{importResult.countriesCreated}
                            </p>
                          </div>

                          <div>
                            <p className="text-[10px] uppercase tracking-[0.08em] text-emerald-700/70">
                              Teams
                            </p>
                            <p className="text-lg font-extrabold text-emerald-900">
                              +{importResult.teamsCreated}
                            </p>
                          </div>

                          <div>
                            <p className="text-[10px] uppercase tracking-[0.08em] text-emerald-700/70">
                              Errors
                            </p>
                            <p className="text-lg font-extrabold text-emerald-900">
                              {importResult.errors.length +
                                importResult.skippedInvalid}
                            </p>
                          </div>
                        </div>

                        {importResult.errors.length > 0 && (
                          <div className="mt-4 rounded-lg border border-red-200 bg-white/70 p-3">
                            <p className="text-xs font-extrabold text-red-700">
                              Incidencias
                            </p>

                            <div className="mt-2 space-y-1">
                              {importResult.errors
                                .slice(0, 12)
                                .map(
                                  (error, index) => (
                                    <p
                                      key={`${index}-${error}`}
                                      className="text-[11px] leading-relaxed text-red-600"
                                    >
                                      {error}
                                    </p>
                                  )
                                )}

                              {importResult.errors.length > 12 && (
                                <p className="pt-1 text-[11px] font-semibold text-red-500">
                                  +{" "}
                                  {importResult.errors.length - 12}{" "}
                                  incidencias más.
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-5 flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={handleCloseImport}
                    disabled={isImporting}
                    className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    {importResult
                      ? "Close"
                      : "Cancel"}
                  </button>

                  {!importResult && (
                    <button
                      type="button"
                      onClick={
                        handleStartImport
                      }
                      disabled={
                        isImporting ||
                        !importAnalysis ||
                        !importAnalysis.players.length ||
                        (Number(importPreview?.newTeams || 0) > 0 && !defaultImportLeagueId)
                      }
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#003399] px-4 text-sm font-semibold text-white transition hover:bg-[#002477] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isImporting ? (
                        <>
                          <Loader2
                            size={16}
                            className="animate-spin"
                          />
                          Importing...
                        </>
                      ) : (
                        <>
                          <Upload size={16} />
                          Import{" "}
                          {importAnalysis?.total_rows || 0}{" "}
                          players
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {addModalOpen && (
          <PlayerFormModal
            form={form}
            setForm={setForm}
            isSaving={isSaving}
            onClose={handleCloseAddPlayer}
            onSubmit={handleSavePlayer}
            countries={countries}
            teams={teams}
          />
        )}
      </div>
    </div>
  );
}