import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Plus,
  X,
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Users,
  CalendarDays,
  Building2,
  Globe2,
  ChevronDown,
} from "lucide-react";
import PlayersDetail from "@/pages/PlayerDetail";
import { useLocation, useSearchParams } from "react-router-dom";
import { parseFootballManagerCsv } from "@/utils/playerCsvImporter";

import { base44 } from "@/api/base44Client";



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

const getPrimaryPosition = (player) => {
  const ratings = player?.positionRatings || player?.position_ratings || {};
  return Object.entries(ratings)
    .map(([code, value]) => ({ code, rating: Number(value) }))
    .filter(({ rating }) => Number.isFinite(rating) && rating > 0)
    .sort((a, b) => b.rating - a.rating || a.code.localeCompare(b.code))[0]?.code || "";
};

const computePlayerDescription = (player) => player?.description || "";

const SPECIAL_LEGACY_TITLES = {
  "Kylian Mbappé": "🐢 La Tortuga",
  "Neymar Jr": "🪄 O Magico",
  "Cristiano Ronaldo": "🐞 El Bicho",
  "Erling Haaland": "🤖 The Cyborg",
  "Luis Suárez": "🔫 El Pistolero",
  "Pedri": "🪄 El Mago",
  "Antoine Griezman": "👑 El Principito",
  "Lionel Messi": "🛐 D10S",
  "Thibaut Courtois": "🧱 The Belgian Wall",
  "Frenkie de Jong": "🎩 El Filósofo",
  "Paulo Dybala": "💎 La Joya",
  "José Morales": "🪖 Comandante Morales",
  "Ferran Torres": "🦈 El Tiburón",
  "Franco Vázquez": "😶 Mudo Vázquez",
  "Julián Álvarez": "🕷️ La Araña",
  "Cole Palmer": "🧊 Cold Palmer",
  "Claude Beacons": "🔥 Torch",
  "Jordan Greenway": "🟩 Janus",
  "Ousmane Dembélé": "🦟 Mosquito",
};

function computeLegacyTitle(player) {
  const name = String(player?.name || "").trim();
  if (SPECIAL_LEGACY_TITLES[name]) return SPECIAL_LEGACY_TITLES[name];

  const ca = Number(player?.ca);
  const cp = Number(player?.cp);
  const age = Number(player?.age);
  if (!Number.isFinite(ca) || !Number.isFinite(cp) || !Number.isFinite(age)) {
    return "⚠️ Perfil indefinido";
  }

  if (cp >= 195) {
    if (age <= 21) return "🪄 Heredero al trono";
    if (cp >= 192) {
      if (ca <= 191) return "🔱 Trono Dorado";
      if (ca > 191) return "👑 Rey absoluto";
    }
  }

  if (cp > 180) {
    if (age <= 21) {
      if (ca >= 160) return "🌠 Talento Generacional";
      if (ca < 160) return "⭐ Future Star";
    }
    if (age <= 25) {
      if (ca >= 175) return "🛰️ Élite Consolidada";
      if (ca < 180) return "🧬 Generación Alfa";
    }
    if (age < 30) {
      if (ca > 188) return "👑 Referente Mundial Absoluto";
      if (ca >= 185) return "📅 Marcador de Época";
      if (ca > 180) return "⚔️ Aspirante al Trono";
      if (ca <= 175) return "🕯️ Vestigio de grandeza";
      if (ca < 185) return "🏛️ Herencia de una generación";
      if (ca <= 188) return "🥋 Fenómeno Generacional";
    }
    if (age >= 30) return "🧠 Leyenda en Activo";
    return "❌ Sin margen competitivo";
  }

  if (cp > 170) {
    if (age <= 21) {
      if (ca >= 150) return "💫 Promesa Élite";
      if (ca < 150) return "🔮 Potencial Especial";
    }
    if (age <= 25) {
      if (ca >= 165) return "💥 Prodigio Generacional";
      if (ca < 170) return "🪙 Generación Beta";
    }
    if (age < 30) {
      if (ca >= 180) return "🎯 Titular de Élite";
      if (ca > 175) return "🗿 Estatura de élite";
      if (ca >= 170) return "🧿 Alta cuna futbolística";
      if (ca < 170) return "🦉 Maestro del Juego";
      if (ca < 175) return "⚙️ Pilar de Élite";
      if (ca <= 180) return "🧩 Elemento Crucial";
    }
    if (age >= 30) return "🧓 Estrella Veterana";
    return "❌ Sin margen competitivo";
  }

  if (cp >= 165) {
    if (age <= 21) {
      if (ca >= 140) return "🌟 Promesa Diferencial";
      if (ca < 140) return "⚡ Proyección de Estrella";
    }
    if (age <= 25) {
      if (ca >= 160) return "🦅 Referencia Generacional";
      if (ca < 160) return "🔥 Forjador del futuro";
    }
    if (age < 30) {
      if (ca >= 160) return "📏 Estándar de Élite";
      if (ca < 160) return "🥷 Élite Silenciosa";
    }
    if (age >= 30) return "🦅 Último emperador";
    return "❌ Sin margen competitivo";
  }

  if (cp < 165) {
    if (age <= 21) {
      if (ca >= 130) return "🌱 Promesa Proyectable";
      if (ca < 130) return "🎯 Jugador a Observar";
    }
    if (age <= 25) {
      if (ca >= 150) return "🧃 Talento a Seguir";
      if (ca < 150) return "🔬 Potencial Real";
    }
    if (age < 30) {
      if (ca >= 150) return "🧱 Perfil Competitivo";
      if (ca < 150) return "🧩 Jugador de Buen Nivel";
    }
    if (age >= 30) return "🧓 Veterano Competitivo";
    return "❌ Sin margen competitivo";
  }
  return "⚠️ Perfil indefinido";
}

const inputClassName =
  "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#003399] focus:ring-2 focus:ring-[#003399]/10";

const POSITION_RATING_GROUPS = [
  {
    title: "Delantero",
    positions: [
      ["DC", "DC"],
    ],
  },
  {
    title: "Extremo",
    positions: [
      ["EI", "EI"],
      ["ED", "ED"],
    ],
  },
  {
    title: "Centrocampista",
    positions: [
      ["CAM", "CAM"],
      ["CM", "CM"],
      ["CDM", "CDM"],
    ],
  },
  {
    title: "Central",
    positions: [
      ["DFC", "DFC"],
    ],
  },
  {
    title: "Lateral",
    positions: [
      ["LD", "LD"],
      ["LI", "LI"],
      ["CRD", "CRD"],
      ["CRI", "CRI"],
    ],
  },
  {
    title: "Portero",
    positions: [
      ["GK", "GK"],
    ],
  },
];

const POSITION_RATING_DEFAULTS = {
  GK: "0",
  DFC: "0",
  LD: "0",
  LI: "0",
  CRD: "0",
  CRI: "0",
  CDM: "0",
  CM: "0",
  CAM: "0",
  EI: "0",
  ED: "0",
  DC: "0",
};

const emptyPlayerForm = {
  name: "",
  dateOfBirth: "",
  teamId: "",
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

function SearchableEntitySelect({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  kind,
  emptyOption = null,
  specialOption = null,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    const handleOutsideClick = (event) => {
      if (!wrapperRef.current?.contains(event.target)) {
        setOpen(false);
        setQuery("");
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
    };
  }, [open]);

  const getLabel = (item) => item?.name || "Unnamed";

  const getMeta = (item) =>
    kind === "country"
      ? item?.code || ""
      : item?.short_name || "";

  const getImage = (item) =>
    kind === "country"
      ? getCountryFlagUrl(item)
      : normalizeImageUrl(item?.logo);

  const filteredOptions = options.filter((item) => {
    const searchText = [
      item?.name,
      item?.short_name,
      item?.code,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchText.includes(
      query.trim().toLowerCase()
    );
  });

  const selected =
    options.find((item) => item?.id === value) || null;

  const isEmptySelected =
    emptyOption && value === emptyOption.value;

  const isSpecialSelected =
    specialOption && value === specialOption.value;

  const selectValue = (nextValue) => {
    onChange(nextValue);
    setOpen(false);
    setQuery("");
  };

  const renderVisual = (item) => {
    if (!item) return null;

    const image = getImage(item);

    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-50">
        {image ? (
          <img
            src={image}
            alt=""
            className={
              kind === "country"
                ? "h-5 w-7 rounded-[2px] object-cover"
                : "h-6 w-6 object-contain"
            }
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        ) : kind === "country" ? (
          <Globe2
            size={15}
            className="text-slate-300"
          />
        ) : (
          <Building2
            size={15}
            className="text-slate-300"
          />
        )}
      </span>
    );
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((current) => !current);
          setQuery("");
        }}
        className={`${inputClassName} flex items-center gap-3 text-left`}
        aria-expanded={open}
      >
        {selected ? (
          renderVisual(selected)
        ) : (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-50">
            {kind === "country" ? (
              <Globe2
                size={15}
                className="text-slate-300"
              />
            ) : (
              <Building2
                size={15}
                className="text-slate-300"
              />
            )}
          </span>
        )}

        <span className="min-w-0 flex-1 truncate">
          <span
            className={
              selected
                ? "block text-slate-800"
                : "block text-slate-400"
            }
          >
            {selected
              ? getLabel(selected)
              : isEmptySelected
                ? emptyOption.label
                : isSpecialSelected
                  ? specialOption.label
                  : placeholder}
          </span>
        </span>

        {selected && getMeta(selected) ? (
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            {getMeta(selected)}
          </span>
        ) : null}

        <ChevronDown
          size={16}
          className={`shrink-0 text-slate-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-[80] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.14)]">
          <div className="border-b border-slate-100 p-2">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3">
              <Search
                size={15}
                className="shrink-0 text-slate-400"
              />
              <input
                type="text"
                value={query}
                onChange={(event) =>
                  setQuery(event.target.value)
                }
                placeholder={searchPlaceholder}
                autoFocus
                className="h-9 min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto p-1.5">
            {emptyOption && (
              <button
                type="button"
                onClick={() =>
                  selectValue(emptyOption.value)
                }
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
                  value === emptyOption.value
                    ? "bg-[#003399]/[0.06] text-[#003399]"
                    : "hover:bg-slate-50"
                }`}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-50">
                  {kind === "country" ? (
                    <Globe2
                      size={15}
                      className="text-slate-300"
                    />
                  ) : (
                    <Building2
                      size={15}
                      className="text-slate-300"
                    />
                  )}
                </span>
                <span className="font-medium">
                  {emptyOption.label}
                </span>
              </button>
            )}

            {filteredOptions.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => selectValue(item.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition ${
                  item.id === value
                    ? "bg-[#003399]/[0.06]"
                    : "hover:bg-slate-50"
                }`}
              >
                {renderVisual(item)}

                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                  {getLabel(item)}
                </span>

                {getMeta(item) ? (
                  <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                    {getMeta(item)}
                  </span>
                ) : null}
              </button>
            ))}

            {filteredOptions.length === 0 && (
              <div className="px-3 py-6 text-center text-xs text-slate-400">
                No results found.
              </div>
            )}

            {specialOption && (
              <button
                type="button"
                onClick={() =>
                  selectValue(specialOption.value)
                }
                className={`mt-1 flex w-full items-center gap-3 rounded-lg border-t border-slate-100 px-3 py-2.5 text-left text-sm font-semibold text-[#003399] transition hover:bg-[#003399]/[0.04] ${
                  value === specialOption.value
                    ? "bg-[#003399]/[0.06]"
                    : ""
                }`}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#003399]/[0.08]">
                  <Plus size={15} />
                </span>
                {specialOption.label}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

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

  logo:
    team?.logo ||
    team?.logo_url ||
    team?.logoUrl ||
    "",

  countryId:
    team?.country_id ||
    team?.countryId ||
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

function ageCircleColor(age) {
  if (age == null) return "bg-slate-300";
  if (age <= 18) return "bg-purple-500";
  if (age <= 21) return "bg-blue-500";
  if (age <= 25) return "bg-green-500";
  if (age <= 29) return "bg-yellow-500";
  if (age <= 33) return "bg-orange-500";
  return "bg-red-500";
}

const POSITION_LABELS = {
  GK: "GK",
  DFC: "DFC",
  LD: "LD",
  LI: "LI",
  CRD: "CRD",
  CRI: "CRI",
  CDM: "CDM",
  CM: "CM",
  CAM: "CAM",
  EI: "EI",
  ED: "ED",
  DC: "DC",
};

const POSITION_GROUPS = [
  { id: "GK", name: "Portero" },
  { id: "DFC", name: "Defensa central" },
  { id: "LD", name: "Lateral derecho" },
  { id: "LI", name: "Lateral izquierdo" },
  { id: "CRD", name: "Carrilero derecho" },
  { id: "CRI", name: "Carrilero izquierdo" },
  { id: "CDM", name: "Mediocentro defensivo" },
  { id: "CM", name: "Mediocentro" },
  { id: "CAM", name: "Mediapunta" },
  { id: "EI", name: "Extremo izquierdo" },
  { id: "ED", name: "Extremo derecho" },
  { id: "DC", name: "Delantero centro" },
];

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

function PlayerCard({
  player,
  team,
  country,
  onClick,
  compact = false,
  hideTeam = false,
  useNationalCardPhoto = false,
}) {
  const preferredCardPhoto = useNationalCardPhoto
    ? player.nationalCardPhotoUrl ||
      player.cardPhotoUrl ||
      player.photoUrl
    : player.cardPhotoUrl ||
      player.photoUrl;

  const photoUrl = normalizeImageUrl(preferredCardPhoto);
  const teamLogo = normalizeImageUrl(team?.logo);

  const age = calculateAge(player.dateOfBirth);
  const legacyTitle = computeLegacyTitle({
    ...player,
    age: age ?? undefined,
  });
  const primaryPosition = getPrimaryPosition(player);
  const description = computePlayerDescription(player);

  const countryFlagUrl = normalizeImageUrl(country?.flag);
  const countryCode = String(country?.code || "").trim().toLowerCase();

  const fallbackFlagUrl =
    !countryFlagUrl && countryCode.length === 2
      ? `https://flagcdn.com/${countryCode}.svg`
      : "";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-[0_2px_8px_rgba(15,23,42,0.02)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_12px_30px_rgba(15,23,42,0.07)] ${
        compact ? "max-w-[230px]" : ""
      }`}
    >
      {/* PHOTO */}
      <div
        className={`relative w-full overflow-hidden bg-slate-50 ${
          compact ? "aspect-[5/4]" : "aspect-[4/3]"
        }`}
      >
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={player.name || "Player"}
            className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.025]"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Users
              size={56}
              strokeWidth={1.25}
              className="text-slate-200"
            />
          </div>
        )}
      </div>

      {/* INFO */}
      <div
        className={`border-t border-slate-100 ${
          compact ? "px-3 pb-3 pt-2.5" : "px-4 pb-4 pt-3"
        }`}
      >
        {/* NAME + FLAG */}
        <div className="flex min-w-0 items-center gap-2">
          {countryFlagUrl || fallbackFlagUrl ? (
            <img
              src={countryFlagUrl || fallbackFlagUrl}
              alt={country?.name || ""}
              className="h-4 w-6 shrink-0 rounded-[2px] object-cover"
              loading="lazy"
            />
          ) : null}

          <h3
            className={`player-display-title min-w-0 truncate ${
              compact ? "text-sm" : "text-base"
            }`}
          >
            {player.name || "Unnamed player"}
          </h3>
        </div>

        {/* LEGACY TITLE + CA/CP */}
        <div className={`${compact ? "mt-1.5" : "mt-2"} flex min-w-0 items-center gap-1.5 text-xs`}>
          <span className="shrink-0 font-semibold text-slate-900">
            {legacyTitle}
          </span>

          <span className="shrink-0 text-slate-300">|</span>

          <span className="shrink-0 font-semibold text-slate-500">
            {player.ca !== "" && player.ca != null
              ? player.ca
              : "—"}{" "}
            /{" "}
            {player.cp !== "" && player.cp != null
              ? player.cp
              : "—"}
          </span>
        </div>

        {/* AGE + POSITION + DESCRIPTION */}
        <div className={`${compact ? "mt-1.5" : "mt-2"} flex min-w-0 items-center gap-1.5 text-xs`}>
          <span
            className={`h-2.5 w-2.5 shrink-0 rounded-full ${ageCircleColor(
              age
            )}`}
          />

          <span className="shrink-0 font-semibold text-slate-700">
            {age ?? "—"}
          </span>

          <span className="shrink-0 text-slate-300">|</span>

          <span className="shrink-0 font-semibold text-slate-700">
            {POSITION_LABELS[primaryPosition] || "—"}
          </span>

          {description && (
            <>
              <span className="shrink-0 text-slate-300">|</span>

              <span className="min-w-0 truncate font-medium text-slate-500">
                {description}
              </span>
            </>
          )}
        </div>

        {/* CLUB */}
        {!hideTeam && (
          <div className={`${compact ? "mt-2" : "mt-3"} flex min-w-0 items-center gap-2 text-xs text-slate-400`}>
            {teamLogo ? (
              <img
                src={teamLogo}
                alt=""
                className="h-4 w-4 shrink-0 object-contain"
                loading="lazy"
              />
            ) : (
              <Building2
                size={14}
                strokeWidth={1.7}
                className="shrink-0"
              />
            )}

            <span className="truncate">
              {team?.name || "No club associated"}
            </span>
          </div>
        )}
      </div>
    </button>
  );
}

function GroupHeader({
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
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [countries, setCountries] = useState([]);
  const [leagues, setLeagues] = useState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");

  const [sortBy, setSortBy] = useState("");

  const [addModalOpen, setAddModalOpen] = useState(false);

  const [form, setForm] = useState({
    ...emptyPlayerForm,
  });

  const [isSaving, setIsSaving] = useState(false);

  const [selectedPlayer, setSelectedPlayer] = useState(null);

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

  const location = useLocation();
  const [searchParams] = useSearchParams();

  const rawViewMode = searchParams.get("view");
  const viewMode = PLAYER_VIEW_MODES.includes(rawViewMode)
    ? rawViewMode
    : "all";

  const loadData = async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const [
        playersResult,
        teamsResult,
        countriesResult,
      ] = await Promise.all([
        base44.entities.Player.list(),
        base44.entities.Team.list(),
        base44.entities.Country.list(),
      ]);

      const loadedPlayers = getList(playersResult)
        .map(normalizePlayer)
        .filter((player) => player.id || player.name);

      const loadedTeams = getList(teamsResult)
        .map(normalizeTeam)
        .filter((team) => team.id && team.name)
        .sort((a, b) =>
          a.name.localeCompare(b.name, "es", {
            sensitivity: "base",
          })
        );

      const loadedCountries = getList(countriesResult)
        .map(normalizeCountry)
        .filter((country) => country.id && country.name)
        .sort((a, b) =>
          a.name.localeCompare(b.name, "es", {
            sensitivity: "base",
          })
        );

      setPlayers(loadedPlayers);
      setTeams(loadedTeams);
      setCountries(loadedCountries);
    } catch (error) {
      console.error("Error loading players:", error);

      setErrorMessage(
        "No se han podido cargar los jugadores, equipos o países. Comprueba que las entidades Player, Team y Country existen en Base44."
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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

    return players
      .filter((player) => {
        if (!query) {
          return true;
        }

        const team = teamById[player.teamId];
        const country = countryById[player.countryId];

        return (
          (player.name || "")
            .toLowerCase()
            .includes(query) ||
          (team?.name || "")
            .toLowerCase()
            .includes(query) ||
          (country?.name || "")
            .toLowerCase()
            .includes(query)
        );
      })
      .sort((a, b) => {
        if (sortBy === "ca") {
          return (
            Number(b.ca || 0) -
            Number(a.ca || 0)
          );
        }

        if (sortBy === "cp") {
          return (
            Number(b.cp || 0) -
            Number(a.cp || 0)
          );
        }

        return (a.name || "").localeCompare(
          b.name || "",
          "es",
          {
            sensitivity: "base",
          }
        );
      });
  }, [
    players,
    search,
    teamById,
    countryById,
    sortBy,
  ]);



  const groupedByTeam = useMemo(() => {
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
  }, [filteredPlayers, teamById]);

  const groupedByCountry = useMemo(() => {
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
  }, [filteredPlayers, countryById]);

  const groupedByPosition = useMemo(() => {
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
  }, [filteredPlayers]);

  const groupedByAge = useMemo(() => {
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
  }, [filteredPlayers]);

  const groupedByDescriptionCategories = useMemo(() => {
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
  }, [filteredPlayers]);

  const handleOpenAddPlayer = () => {
    setForm({
      ...emptyPlayerForm,
    });

    setAddModalOpen(true);
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

    const existingTeamNames = new Set(
      teams.map((team) => normalizeEntityName(team.name))
    );

    const uniqueCountries = new Set();
    const uniqueTeams = new Set();
    let missingNames = 0;
    let missingCountries = 0;
    let missingTeams = 0;

    importAnalysis.players.forEach(({ player, source }) => {
      const countryKey = normalizeEntityName(source?.countryName || "");
      const teamKey = normalizeEntityName(source?.teamName || "");

      if (!player?.name?.trim()) missingNames += 1;
      if (!countryKey) missingCountries += 1;
      else uniqueCountries.add(countryKey);
      if (!teamKey) missingTeams += 1;
      else uniqueTeams.add(teamKey);
    });

    const existingCountries = Array.from(uniqueCountries).filter((key) => countryMap.has(key)).length;
    const existingTeams = Array.from(uniqueTeams).filter((key) => existingTeamNames.has(key)).length;

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
  }, [importAnalysis, countries, teams]);

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
      const countryCache = new Map(countries.map((country) => [normalizeEntityName(country.name), country]));
      const teamCache = new Map(teams.map((team) => [normalizeEntityName(team.name), team]));
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
        if (!teamCache.has(teamKey)) {
          const sourceRow = importAnalysis.players.find(({ source }) => normalizeEntityName(source?.teamName || "") === teamKey);
          const teamName = sourceRow?.source?.teamName?.trim();
          if (teamName) {
            if (!selectedLeagueId) {
              result.errors.push(`Falta seleccionar una liga para el nuevo equipo "${teamName}".`);
            } else {
              const created = await base44.entities.Team.create({
                name: teamName,
                short_name: generateImportedTeamShortName(teamName),
                code: generateImportedTeamShortName(teamName),
                continent: "Europe",
                country_id: selectedLeagueCountryId,
                league_id: selectedLeagueId,
                city: "",
                logo: "",
                is_active: true,
              });
              const teamData = created?.data || created;
              const teamId = teamData?.id || teamData?._id || created?.id || created?._id || "";
              if (!teamId) throw new Error(`El equipo "${teamName}" se creó pero no devolvió ID.`);
              teamCache.set(teamKey, { ...teamData, id: teamId, name: teamData?.name || teamName });
              result.teamsCreated += 1;
            }
          }
        }
        setImportProgress({ current: index + 1, total: uniqueTeamKeys.length, phase: "Resolving teams..." });
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
        const team = teamCache.get(normalizeEntityName(teamName));
        const finalPlayer = { ...player, team_id: team?.id || "", country_id: country?.id || "" };

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
          await base44.entities.Player.create(finalPlayer);
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

        team_id: teamId,

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
      <PlayersDetail
        player={selectedPlayer}
        team={teamById[selectedPlayer.teamId]}
        country={countryById[selectedPlayer.countryId]}
        teams={teams}
        countries={countries}
        onBack={() => {
          setSelectedPlayer(null);
        }}
        onPlayerUpdated={(updatedPlayer) => {
          setSelectedPlayer(updatedPlayer);

          setPlayers((currentPlayers) =>
            currentPlayers.map((currentPlayer) =>
              currentPlayer.id === updatedPlayer.id
                ? normalizePlayer(updatedPlayer)
                : currentPlayer
            )
          );
        }}
      />
    );
  }

  return (
    <div className="relative h-full min-h-0 overflow-y-auto scroll-smooth bg-[#f5f7fa] p-3 sm:p-4 md:p-6">
      <div className="mx-auto max-w-[1800px]">

        {/* HEADER */}
        <div className="mb-4 flex items-center justify-end">
          <div className="flex items-center gap-2">

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

            {/* TOP CA */}
            <button
              type="button"
              onClick={() =>
                setSortBy((current) =>
                  current === "ca" ? "" : "ca"
                )
              }
              className={`flex h-10 items-center justify-center rounded-xl border px-3 text-xs font-extrabold transition ${
                sortBy === "ca"
                  ? "border-[#003399] bg-[#003399] text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              }`}
              aria-label="Order by CA"
              title="Order by CA"
            >
              Top CA
            </button>

            {/* TOP CP */}
            <button
              type="button"
              onClick={() =>
                setSortBy((current) =>
                  current === "cp" ? "" : "cp"
                )
              }
              className={`flex h-10 items-center justify-center rounded-xl border px-3 text-xs font-extrabold transition ${
                sortBy === "cp"
                  ? "border-[#003399] bg-[#003399] text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              }`}
              aria-label="Order by CP"
              title="Order by CP"
            >
              Top CP
            </button>

            {/* IMPORT CSV */}
            <button
              type="button"
              onClick={handleOpenImport}
              className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-extrabold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
              aria-label="Import players from CSV"
              title="Import players from CSV"
            >
              <Upload size={16} />
              <span className="hidden sm:inline">
                Import CSV
              </span>
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

        {/* ERROR */}
        {errorMessage && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
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
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
                {filteredPlayers.map(
                  (player) => (
                    <PlayerCard
                      key={
                        player.id ||
                        `${player.name}-${player.dateOfBirth}`
                      }
                      player={player}
                      team={
                        teamById[player.teamId]
                      }
                      country={
                        countryById[
                          player.countryId
                        ]
                      }
                      onClick={() => {
                        console.log(
                          "PLAYER CLICKED:",
                          player
                        );

                        setSelectedPlayer(player);
                      }}
                    />
                  )
                )}
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
                              onClick={() => {
                                console.log(
                                  "PLAYER CLICKED:",
                                  player
                                );

                                setSelectedPlayer(player);
                              }}
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
                              onClick={() => {
                                console.log(
                                  "PLAYER CLICKED:",
                                  player
                                );

                                setSelectedPlayer(player);
                              }}
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
                          key={
                            player.id ||
                            `${player.name}-${player.dateOfBirth}`
                          }
                          player={player}
                          team={teamById[player.teamId]}
                          country={countryById[player.countryId]}
                          compact
                          onClick={() => setSelectedPlayer(player)}
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
                          key={
                            player.id ||
                            `${player.name}-${player.dateOfBirth}`
                          }
                          player={player}
                          team={teamById[player.teamId]}
                          country={countryById[player.countryId]}
                          compact
                          onClick={() => setSelectedPlayer(player)}
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
                                              onClick={() =>
                                                setSelectedPlayer(player)
                                              }
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

        {/* ADD PLAYER MODAL */}
        {importModalOpen && (
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
          <div
            className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px]"
            onMouseDown={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                handleCloseAddPlayer();
              }
            }}
          >
            <div className="max-h-[calc(100%_-_32px)] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">

              {/* MODAL HEADER */}
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    Add player
                  </h2>

                  <p className="mt-0.5 text-xs text-slate-400">
                    Create a new player in the database.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    handleCloseAddPlayer
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50"
                  aria-label="Close"
                >
                  <X size={17} />
                </button>
              </div>

              <form
                onSubmit={
                  handleSavePlayer
                }
                className="space-y-5 p-5"
              >

                {/* PLAYER NAME */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Player name
                  </label>

                  <input
                    type="text"
                    value={form.name}
                    onChange={(event) =>
                      setForm(
                        (current) => ({
                          ...current,
                          name:
                            event.target
                              .value,
                        })
                      )
                    }
                    placeholder="e.g. Neymar Jr"
                    className={
                      inputClassName
                    }
                    required
                  />
                </div>

                {/* DATE OF BIRTH */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Date of birth
                  </label>

                  <input
                    type="text"
                    value={
                      form.dateOfBirth
                    }
                    onChange={(event) =>
                      setForm(
                        (current) => ({
                          ...current,
                          dateOfBirth:
                            event.target
                              .value,
                        })
                      )
                    }
                    placeholder="5/2/1999 o 05/02/1999"
                    inputMode="numeric"
                    maxLength={10}
                    className={
                      inputClassName
                    }
                  />

                  <p className="mt-1.5 text-[11px] text-slate-400">
                    Format: DD/MM/YYYY
                  </p>
                </div>

                {/* COUNTRY */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Country
                  </label>

                  <SearchableEntitySelect
                    value={form.countryId}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        countryId: value,
                        newCountryName: "",
                      }))
                    }
                    options={countries}
                    kind="country"
                    placeholder="Select country"
                    searchPlaceholder="Search country..."
                    emptyOption={{
                      value: "",
                      label: "Select country",
                    }}
                    specialOption={{
                      value: NEW_COUNTRY_VALUE,
                      label: "New country",
                    }}
                  />

                  {form.countryId ===
                    NEW_COUNTRY_VALUE && (
                    <div className="mt-3 rounded-xl border border-[#003399]/15 bg-[#003399]/[0.035] p-4">

                      <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                        New country
                      </label>

                      <input
                        type="text"
                        value={
                          form.newCountryName
                        }
                        onChange={(event) =>
                          setForm(
                            (current) => ({
                              ...current,
                              newCountryName:
                                event.target.value,
                            })
                          )
                        }
                        placeholder="e.g. Argentina"
                        className={
                          inputClassName
                        }
                        autoFocus
                      />

                      <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                        The country will be created
                        automatically when you save
                        the player. Its 3-letter code
                        will be generated automatically.
                      </p>
                    </div>
                  )}

                  {countries.length ===
                    0 && (
                    <p className="mt-1.5 text-[11px] text-slate-400">
                      No countries have
                      been created yet.
                    </p>
                  )}
                </div>

                {/* CLUB */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Associated club
                  </label>

                  <SearchableEntitySelect
                    value={form.teamId}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        teamId: value,
                        newTeamName: "",
                      }))
                    }
                    options={teams}
                    kind="team"
                    placeholder="No club"
                    searchPlaceholder="Search club..."
                    emptyOption={{
                      value: "",
                      label: "No club",
                    }}
                    specialOption={{
                      value: NEW_TEAM_VALUE,
                      label: "+ Create new club",
                    }}
                  />
                </div>

                {/* NEW CLUB */}
                {form.teamId ===
                  NEW_TEAM_VALUE && (
                  <div className="rounded-xl border border-[#003399]/15 bg-[#003399]/[0.035] p-4">

                    <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                      New club
                    </label>

                    <input
                      type="text"
                      value={
                        form.newTeamName
                      }
                      onChange={(event) =>
                        setForm(
                          (current) => ({
                            ...current,
                            newTeamName:
                              event.target.value,
                          })
                        )
                      }
                      placeholder="e.g. Santos FC"
                      className={
                        inputClassName
                      }
                      autoFocus
                    />

                    <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                      The club will be
                      created automatically
                      when you save the player.
                      The selected country will be
                      assigned to the new club.
                    </p>

                  </div>
                )}

                {/* CA / CP */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700">
                      Ratings
                    </label>
                    <span className="text-[11px] text-slate-400">
                      CA / CP: 0-200
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                        CA
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={200}
                        step={1}
                        value={form.ca}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            ca: event.target.value,
                          }))
                        }
                        placeholder="e.g. 185"
                        className={inputClassName}
                        required
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                        CP
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={200}
                        step={1}
                        value={form.cp}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            cp: event.target.value,
                          }))
                        }
                        placeholder="e.g. 195"
                        className={inputClassName}
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* POSITION RATINGS */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Position ratings
                      </label>
                      <p className="mt-1 text-[11px] text-slate-400">
                        Valora cada posición de 0 a 20. Un jugador puede tener distintas valoraciones.
                      </p>
                    </div>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                      0-20
                    </span>
                  </div>

                  <div className="space-y-4">
                    {POSITION_RATING_GROUPS.map((group) => (
                      <div key={group.title}>
                        <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                          {group.title}
                        </div>

                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                          {group.positions.map(([code, label]) => (
                            <div key={code}>
                              <label className="mb-1 block text-[11px] font-semibold text-slate-600">
                                {label}
                              </label>
                              <input
                                type="number"
                                min={0}
                                max={20}
                                step={1}
                                value={
                                  form.positionRatings?.[code] ??
                                  "0"
                                }
                                onChange={(event) =>
                                  setForm((current) => ({
                                    ...current,
                                    positionRatings: {
                                      ...current.positionRatings,
                                      [code]: event.target.value,
                                    },
                                  }))
                                }
                                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-[#003399] focus:ring-2 focus:ring-[#003399]/10"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* DESCRIPTION */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700">
                      Description
                    </label>
                    <span className="text-[11px] text-slate-400">
                      Selecciona el perfil del jugador
                    </span>
                  </div>

                  <select
                    value={form.description || ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    className={inputClassName}
                  >
                    <option value="">Sin descripción</option>

                    {PLAYER_DESCRIPTIONS.map((group) => (
                      <optgroup
                        key={group.group}
                        label={group.group}
                      >
                        {group.options.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>

                  <p className="mt-1.5 text-[11px] text-slate-400">
                    La descripción podrá utilizarse después como perfil
                    automático basado en edad, CA, CP y posiciones.
                  </p>
                </div>

                {/* PLAYER PHOTO */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Player photo URL
                  </label>

                  <input
                    type="url"
                    value={
                      form.photoUrl
                    }
                    onChange={(event) =>
                      setForm(
                        (current) => ({
                          ...current,
                          photoUrl:
                            event.target
                              .value,
                        })
                      )
                    }
                    placeholder="https://..."
                    className={
                      inputClassName
                    }
                  />
                </div>

                {/* PLAYER CARD PHOTO */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Player card photo URL
                  </label>

                  <input
                    type="url"
                    value={form.cardPhotoUrl}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        cardPhotoUrl: event.target.value,
                      }))
                    }
                    placeholder="https://..."
                    className={inputClassName}
                  />

                  <p className="mt-1.5 text-[11px] text-slate-400">
                    Imagen utilizada exclusivamente en las tarjetas del listado de jugadores.
                  </p>
                </div>

                {/* NATIONAL TEAM CARD PHOTO */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    National team card photo URL
                  </label>

                  <input
                    type="url"
                    value={form.nationalCardPhotoUrl}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        nationalCardPhotoUrl: event.target.value,
                      }))
                    }
                    placeholder="https://..."
                    className={inputClassName}
                  />

                  <p className="mt-1.5 text-[11px] text-slate-400">
                    Imagen utilizada en la agrupación por países, idealmente con la camiseta de la selección.
                  </p>
                </div>

                {/* PHOTO PREVIEW */}
                {form.photoUrl && (
                  <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">

                    <img
                      src={normalizeImageUrl(
                        form.photoUrl
                      )}
                      alt=""
                      className="h-16 w-16 rounded-lg object-cover object-top"
                      onError={(event) => {
                        event.currentTarget.style.display =
                          "none";
                      }}
                    />

                    <div className="text-xs text-slate-500">
                      Preview of the player photo.
                    </div>

                  </div>
                )}

                {/* CARD PHOTO PREVIEW */}
                {form.cardPhotoUrl && (
                  <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <img
                      src={normalizeImageUrl(form.cardPhotoUrl)}
                      alt=""
                      className="h-16 w-16 rounded-lg object-cover object-top"
                      onError={(event) => {
                        event.currentTarget.style.display = "none";
                      }}
                    />

                    <div className="text-xs text-slate-500">
                      Preview of the player card photo.
                    </div>
                  </div>
                )}

                {/* ACTIONS */}
                <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">

                  <button
                    type="button"
                    onClick={
                      handleCloseAddPlayer
                    }
                    disabled={isSaving}
                    className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={
                      isSaving ||
                      !form.name.trim() ||
                      form.ca === "" ||
                      form.cp === "" ||
                      ((form.teamId ===
                        NEW_TEAM_VALUE &&
                        !form.newTeamName.trim()) ||
                      (form.countryId ===
                        NEW_COUNTRY_VALUE &&
                        !form.newCountryName.trim()))
                    }
                    className="h-10 rounded-xl bg-[#003399] px-4 text-sm font-semibold text-white transition hover:bg-[#002477] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSaving
                      ? "Saving..."
                      : "Create player"}
                  </button>

                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
