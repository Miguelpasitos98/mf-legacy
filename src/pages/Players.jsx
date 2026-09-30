import React, { useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  X,
  Users,
  CalendarDays,
  Building2,
  Globe2,
} from "lucide-react";
import PlayersDetail from "@/pages/PlayerDetail";
import { useLocation, useSearchParams } from "react-router-dom";

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
  ca: "",
  cp: "",
  positionRatings: { ...POSITION_RATING_DEFAULTS },
  description: "",
  newTeamName: "",
  newCountryName: "",
  newCountryContinent: "Europe",
};

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

function PlayerCard({
  player,
  team,
  country,
  onClick,
}) {
  const photoUrl = normalizeImageUrl(
    player.cardPhotoUrl || player.photoUrl
  );
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
      className="group w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-[0_2px_8px_rgba(15,23,42,0.02)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_12px_30px_rgba(15,23,42,0.07)]"
    >
      {/* PHOTO */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-50">
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
      <div className="border-t border-slate-100 px-4 pb-4 pt-3">
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

          <h3 className="player-display-title min-w-0 truncate text-base">
            {player.name || "Unnamed player"}
          </h3>
        </div>

        {/* LEGACY TITLE + CA/CP */}
        <div className="mt-2 flex min-w-0 items-center gap-1.5 text-xs">
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
        <div className="mt-2 flex min-w-0 items-center gap-1.5 text-xs">
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
        <div className="mt-3 flex min-w-0 items-center gap-2 text-xs text-slate-400">
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

export default function Players() {
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [countries, setCountries] = useState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");

  const [addModalOpen, setAddModalOpen] = useState(false);

  const [form, setForm] = useState({
    ...emptyPlayerForm,
  });

  const [isSaving, setIsSaving] = useState(false);

  const [selectedPlayer, setSelectedPlayer] = useState(null);

  const location = useLocation();
  const [searchParams] = useSearchParams();

  const rawViewMode = searchParams.get("view");
  const viewMode =
    rawViewMode === "teams" || rawViewMode === "countries"
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
      .sort((a, b) =>
        (a.name || "").localeCompare(
          b.name || "",
          "es",
          {
            sensitivity: "base",
          }
        )
      );
  }, [
    players,
    search,
    teamById,
    countryById,
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

    return Object.values(groups).sort((a, b) => {
      const nameA = a.team?.name || "No club";
      const nameB = b.team?.name || "No club";

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

  const handleOpenAddPlayer = () => {
    setForm({
      ...emptyPlayerForm,
    });

    setAddModalOpen(true);
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
        onBack={() => {
          setSelectedPlayer(null);
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
              <div className="space-y-8">
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

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
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
              <div className="space-y-8">
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

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
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
        {addModalOpen && (
          <div
            className="fixed inset-x-0 bottom-0 top-[56px] z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px]"
            onMouseDown={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                handleCloseAddPlayer();
              }
            }}
          >
            <div className="max-h-[calc(100vh-72px)] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">

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

                  <select
                    value={
                      form.countryId
                    }
                    onChange={(event) =>
                      setForm(
                        (current) => ({
                          ...current,
                          countryId:
                            event.target
                              .value,
                          newCountryName:
                            "",
                        })
                      )
                    }
                    className={
                      inputClassName
                    }
                  >
                    <option value="">
                      Select country
                    </option>

                    {countries.map(
                      (country) => (
                        <option
                          key={
                            country.id
                          }
                          value={
                            country.id
                          }
                        >
                          {country.name}
                          {country.code
                            ? ` (${country.code})`
                            : ""}
                        </option>
                      )
                    )}

                    <option
                      value={
                        NEW_COUNTRY_VALUE
                      }
                    >
                      New
                    </option>
                  </select>

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

                  <select
                    value={
                      form.teamId
                    }
                    onChange={(event) =>
                      setForm(
                        (current) => ({
                          ...current,
                          teamId:
                            event.target
                              .value,
                          newTeamName:
                            "",
                        })
                      )
                    }
                    className={
                      inputClassName
                    }
                  >
                    <option value="">
                      No club
                    </option>

                    {teams.map(
                      (team) => (
                        <option
                          key={team.id}
                          value={team.id}
                        >
                          {team.name}
                        </option>
                      )
                    )}

                    <option
                      value={
                        NEW_TEAM_VALUE
                      }
                    >
                      + Create new club
                    </option>
                  </select>
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
