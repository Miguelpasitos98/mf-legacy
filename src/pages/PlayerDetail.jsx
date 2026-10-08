import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  CalendarDays,
  Building2,
  UserRound,
  X,
  Save,
  Pencil,
  Search,
  ChevronDown,
  Globe2,
  Plus,
} from "lucide-react";
import { base44 } from "@/api/base44Client";

const POSITION_RATING_FIELDS = [
  ["portero", "Portero"],
  ["defensa_izquierdo", "Defensa izquierdo"],
  ["defensa_central", "Defensa central"],
  ["defensa_derecho", "Defensa derecho"],
  ["mediocentro", "Mediocentro"],
  ["carrilero_izquierdo", "Carrilero izquierdo"],
  ["carrilero_derecho", "Carrilero derecho"],
  ["centrocampista_izquierdo", "Centrocampista izquierdo"],
  ["centrocampista", "Centrocampista"],
  ["centrocampista_derecho", "Centrocampista derecho"],
  ["mediapunta_por_la_izquierda", "Mediapunta por la izquierda"],
  ["mediapunta_central", "Mediapunta central"],
  ["mediapunta_por_la_derecha", "Mediapunta por la derecha"],
  ["delantero", "Delantero"],
];

const DESCRIPTION_OPTIONS = [
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

const STAT_GROUPS = {
  mental: [
    ["agresividad", "Agresividad"],
    ["anticipacion", "Anticipación"],
    ["valentia", "Valentía"],
    ["serenidad", "Serenidad"],
    ["concentracion", "Concentración"],
    ["consistencia", "Consistencia"],
    ["decisiones", "Decisiones"],
    ["determinacion", "Determinación"],
    ["juego_sucio", "Juego sucio"],
    ["talento", "Talento"],
    ["partidos_importantes", "Partidos importantes"],
    ["liderazgo", "Liderazgo"],
    ["movimiento", "Movimiento / Desmarques"],
    ["colocacion", "Colocación"],
    ["trabajo_de_equipo", "Trabajo de equipo"],
    ["vision", "Visión"],
    ["sacrificio", "Sacrificio"],
  ],
  physical: [
    ["aceleracion", "Aceleración"],
    ["agilidad", "Agilidad"],
    ["balance", "Equilibrio"],
    ["tendencia_a_lesionarse", "Resistencia a lesiones"],
    ["alcance_de_salto", "Alcance de salto"],
    ["alcance_de_salto_recomendado_altura", "Salto ajustado por altura"],
    ["recuperacion_fisica", "Recuperación física"],
    ["velocidad", "Velocidad"],
    ["resistencia", "Resistencia"],
    ["fuerza", "Fuerza"],
  ],
  technical: [
    ["saques_de_esquina", "Saques de esquina"],
    ["centros", "Centros"],
    ["regate", "Regate"],
    ["remate", "Remate"],
    ["control", "Control / Primer toque"],
    ["tiros_libres", "Tiros libres"],
    ["cabeceo", "Cabeceo"],
    ["tiros_lejanos", "Tiros lejanos"],
    ["saques_largos", "Saques largos"],
    ["marcaje", "Marcaje"],
    ["pases", "Pases"],
    ["penaltis", "Penaltis"],
    ["entradas", "Entradas"],
    ["tecnica", "Técnica"],
    ["polivalencia", "Polivalencia"],
  ],
  goalkeeping: [
    ["balones_aereos", "Alcance aéreo"],
    ["balones_aereos_recomendado_altura", "Alcance aéreo ajustado por altura"],
    ["mando_en_el_area", "Mando en el área"],
    ["comunicacion", "Comunicación"],
    ["excentricidad", "Excentricidad"],
    ["blocaje", "Blocaje"],
    ["saques_de_puerta", "Saques de puerta"],
    ["uno_contra_uno", "Uno contra uno"],
    ["reflejos", "Reflejos"],
    ["salidas_tendencia", "Salidas (tendencia)"],
    ["salida_de_puños", "Puños"],
    ["saque_con_la_mano", "Saque con la mano"],
  ],
};

const EMPTY_STATS = {
  mental: Object.fromEntries(STAT_GROUPS.mental.map(([key]) => [key, 0])),
  physical: Object.fromEntries(STAT_GROUPS.physical.map(([key]) => [key, 0])),
  technical: Object.fromEntries(STAT_GROUPS.technical.map(([key]) => [key, 0])),
  goalkeeping: Object.fromEntries(STAT_GROUPS.goalkeeping.map(([key]) => [key, 0])),
};

const getPlayerStats = (player) => {
  const source = player?.stats || {};
  return {
    mental: {
      ...EMPTY_STATS.mental,
      ...(source.mental || {}),
    },
    physical: {
      ...EMPTY_STATS.physical,
      ...(source.physical || {}),
    },
    technical: {
      ...EMPTY_STATS.technical,
      ...(source.technical || {}),
    },
    goalkeeping: {
      ...EMPTY_STATS.goalkeeping,
      ...(source.goalkeeping || {}),
    },
  };
};


const INPUT_CLASS =
  "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-[#003399] focus:ring-2 focus:ring-[#003399]/10";

const getCountryFlagUrl = (country) => {
  const directFlag = normalizeImageUrl(
    country?.flag || country?.flag_url || country?.flagUrl
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
      document.removeEventListener("mousedown", handleOutsideClick);
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

    return searchText.includes(query.trim().toLowerCase());
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
          <Globe2 size={15} className="text-slate-300" />
        ) : (
          <Building2 size={15} className="text-slate-300" />
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
        className={`${INPUT_CLASS} flex items-center gap-3 text-left`}
        aria-expanded={open}
      >
        {selected ? renderVisual(selected) : (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-50">
            {kind === "country" ? (
              <Globe2 size={15} className="text-slate-300" />
            ) : (
              <Building2 size={15} className="text-slate-300" />
            )}
          </span>
        )}

        <span className="min-w-0 flex-1 truncate">
          <span className={selected ? "block text-slate-800" : "block text-slate-400"}>
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
              <Search size={15} className="shrink-0 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
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
                onClick={() => selectValue(emptyOption.value)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
                  value === emptyOption.value
                    ? "bg-[#003399]/[0.06] text-[#003399]"
                    : "hover:bg-slate-50"
                }`}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-50">
                  {kind === "country" ? (
                    <Globe2 size={15} className="text-slate-300" />
                  ) : (
                    <Building2 size={15} className="text-slate-300" />
                  )}
                </span>
                <span className="font-medium">{emptyOption.label}</span>
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
                onClick={() => selectValue(specialOption.value)}
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

function normalizeImageUrl(value) {
  if (!value) return "";
  const url = String(value).trim();
  if (!url) return "";
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  if (url.startsWith("//")) return `https:${url}`;
  return `https://${url}`;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function calculateAge(value) {
  if (!value) return null;
  const birth = new Date(value);
  if (Number.isNaN(birth.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const month = today.getMonth() - birth.getMonth();

  if (month < 0 || (month === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

function formatFm26Money(value) {
  if (value == null || value === "") return "—";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  return `${numeric.toLocaleString("es-ES")} (moneda de partida)`;
}

function formatFm26Label(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getValueBarWidth(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, (numeric / 20) * 100));
}

function getFm26MetricTone(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "bg-slate-200";
  if (numeric >= 16) return "bg-emerald-500";
  if (numeric >= 13) return "bg-blue-500";
  if (numeric >= 10) return "bg-amber-500";
  return "bg-rose-500";
}


const normalizeHexColor = (value, fallback) => {
  const normalized = String(value || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(normalized)) return normalized.toUpperCase();
  return fallback;
};

const hexToRgb = (hex) => {
  const normalized = normalizeHexColor(hex, "#003399").slice(1);
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
};

const rgbToHex = (r, g, b) =>
  `#${[r, g, b]
    .map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase();

const mixHexColors = (first, second, firstWeight = 0.5) => {
  const a = hexToRgb(first);
  const b = hexToRgb(second);
  const weight = Math.max(0, Math.min(1, firstWeight));

  return rgbToHex(
    a.r * weight + b.r * (1 - weight),
    a.g * weight + b.g * (1 - weight),
    a.b * weight + b.b * (1 - weight)
  );
};

const darkenHex = (hex, amount = 0.25) => {
  const rgb = hexToRgb(hex);
  const factor = Math.max(0, Math.min(1, 1 - amount));
  return rgbToHex(rgb.r * factor, rgb.g * factor, rgb.b * factor);
};

const getContrastTextColor = (hex) => {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? "#0C1321" : "#FFFFFF";
};

const getBestPosition = (ratings) => {
  if (!ratings || typeof ratings !== "object") return "—";

  const valid = POSITION_RATING_FIELDS
    .map(([key, label], index) => ({
      key,
      label,
      value: Number(ratings[key]),
      index,
    }))
    .filter((item) => Number.isFinite(item.value))
    .sort((a, b) => {
      if (b.value !== a.value) return b.value - a.value;
      return a.index - b.index;
    });

  if (!valid.length || valid[0].value <= 0) return "—";
  return `${valid[0].label} · ${valid[0].value}/20`;
};

const PlayerStatCard = ({ background, grow = 1 }) => {
  return (
    <div
      aria-hidden="true"
      className="flex h-[190px] min-w-0 flex-1 rounded-[16px] border border-black/10 px-6 py-5 shadow-[0_24px_52px_rgba(15,23,42,0.22)]"
      style={{ backgroundColor: background, flex: grow }}
    />
  );
};

export default function PlayerDetail({ player, team, country, teams = [], countries = [], onBack, onPlayerUpdated }) {
  const initialPositionRatings = useMemo(
    () => ({
      ...Object.fromEntries(POSITION_RATING_FIELDS.map(([key]) => [key, 0])),
      ...(player?.position_ratings || player?.positionRatings || {}),
    }),
    [player]
  );

  const initialForm = useMemo(
    () => ({
      name: player?.name || "",
      dateOfBirth: player?.dateOfBirth || player?.date_of_birth || "",
      photoUrl: player?.photoUrl || player?.photo_url || "",
      cardPhotoUrl: player?.cardPhotoUrl || player?.card_photo_url || "",
      nationalCardPhotoUrl:
        player?.nationalCardPhotoUrl ||
        player?.national_card_photo_url ||
        "",
      teamId: player?.teamId || player?.team_id || "",
      careerStatus: player?.career_status || (player?.team_id || player?.teamId ? "active" : "free_agent"),
      lastTeamId: player?.last_team_id || "",
      retirementYear: player?.retirement_year ?? "",
      countryId: player?.countryId || player?.country_id || "",
      secondaryCountryId: player?.secondaryCountryId || player?.secondary_country_id || player?.fm26_second_country_ids?.[0] || "",
      fmPosition: player?.fm_position || "",
      bestPositions: player?.best_positions || "",
      roleUsedToFillEmptyAttributes:
        player?.role_used_to_fill_empty_attributes ||
        "",
      preferredCentralPosition:
        player?.preferred_central_position ||
        "",
      style: player?.style || "",
      height: player?.height ?? "",
      rightFoot:
        player?.right_foot ||
        player?.rightFoot ||
        "",
      leftFoot:
        player?.left_foot ||
        player?.leftFoot ||
        "",
      shirtNumber:
        player?.shirt_number ??
        player?.shirtNumber ??
        "",
      salary: player?.salary ?? "",
      ca: player?.ca ?? "",
      cp: player?.cp ?? "",
      description: player?.description || "",
      positionRatings: initialPositionRatings,
      stats: getPlayerStats(player),
    }),
    [player, initialPositionRatings]
  );

  const [editOpen, setEditOpen] = useState(false);
  const [editTab, setEditTab] = useState("general");
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [editablePlayer, setEditablePlayer] = useState(player);
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    setEditablePlayer(player);
    setForm(initialForm);
  }, [player, initialForm]);

  const playerName = editablePlayer?.name || "Unnamed player";
  const photoUrl = normalizeImageUrl(
    editablePlayer?.photoUrl || editablePlayer?.photo_url
  );
  const teamLogo = normalizeImageUrl(team?.logo || team?.logo_url);
  const teamName = team?.name || "No club associated";
  const dateOfBirth =
    editablePlayer?.dateOfBirth ||
    editablePlayer?.date_of_birth ||
    "";
  const age = calculateAge(dateOfBirth);
  const selectedCountry = countries.find((item) => item?.id === form.countryId) || null;
  const selectedTeam = teams.find((item) => item?.id === form.teamId) || null;

  const [firstName, ...rest] = playerName.split(" ");
  const lastName = rest.join(" ");

  const openEditor = () => {
    setForm(initialForm);
    setEditError("");
    setEditTab("general");
    setEditOpen(true);
  };

  const closeEditor = () => {
    if (isSaving) return;
    setForm(initialForm);
    setEditError("");
    setEditOpen(false);
  };

  const handleSave = async (event) => {
    event.preventDefault();

    if (!editablePlayer?.id) {
      setEditError("No se ha encontrado el ID del jugador.");
      return;
    }

    if (!form.name.trim()) {
      setEditError("El nombre del jugador es obligatorio.");
      return;
    }

    const numericCA = Number(form.ca);
    const numericCP = Number(form.cp);

    if (
      form.ca === "" ||
      !Number.isFinite(numericCA) ||
      numericCA < 0 ||
      numericCA > 200
    ) {
      setEditError("El CA debe estar entre 0 y 200.");
      return;
    }

    if (
      form.cp === "" ||
      !Number.isFinite(numericCP) ||
      numericCP < 0 ||
      numericCP > 200
    ) {
      setEditError("El CP debe estar entre 0 y 200.");
      return;
    }

    const positionRatings = POSITION_RATING_FIELDS.reduce((result, [key]) => {
      const value = Number(form.positionRatings?.[key] ?? 0);
      result[key] = Number.isFinite(value)
        ? Math.min(20, Math.max(0, value))
        : 0;
      return result;
    }, {});

    const normalizedStats = {
      mental: {},
      physical: {},
      technical: {},
      goalkeeping: {},
    };

    Object.entries(STAT_GROUPS).forEach(([group, fields]) => {
      fields.forEach(([key]) => {
        const value = Number(
          form.stats?.[group]?.[key] ?? 0
        );

        normalizedStats[group][key] =
          Number.isFinite(value)
            ? Math.min(20, Math.max(0, value))
            : 0;
      });
    });

    const numericHeight = Number(form.height);
    const numericShirtNumber = Number(form.shirtNumber);
    const numericSalary = Number(form.salary);

    setIsSaving(true);
    setEditError("");

    try {
      await base44.entities.Player.update(editablePlayer.id, {
        name: form.name.trim(),
        date_of_birth: form.dateOfBirth.trim(),
        team_id: form.careerStatus === "active" ? (form.teamId || "") : "",
        career_status: form.careerStatus,
        last_team_id: form.careerStatus === "active" ? (form.lastTeamId || "") : (form.lastTeamId || form.teamId || ""),
        retirement_year: form.careerStatus === "retired" && form.retirementYear !== "" ? Number(form.retirementYear) : null,
        country_id: form.countryId || "",
        secondary_country_id: form.secondaryCountryId || "",
        fm26_second_country_ids: form.secondaryCountryId ? [form.secondaryCountryId, ...(editablePlayer.fm26_second_country_ids || []).slice(1)].filter((id, index, values) => id && values.indexOf(id) === index) : (editablePlayer.fm26_second_country_ids || []).slice(1),
        fm_position: form.fmPosition || "",
        best_positions: form.bestPositions || "",
        role_used_to_fill_empty_attributes:
          form.roleUsedToFillEmptyAttributes || "",
        preferred_central_position:
          form.preferredCentralPosition || "",
        style: form.style || "",
        height: Number.isFinite(numericHeight) ? numericHeight : 0,
        right_foot: form.rightFoot || "",
        left_foot: form.leftFoot || "",
        shirt_number:
          Number.isFinite(numericShirtNumber)
            ? numericShirtNumber
            : 0,
        salary:
          Number.isFinite(numericSalary)
            ? numericSalary
            : 0,
        photo_url: normalizeImageUrl(form.photoUrl),
        card_photo_url: normalizeImageUrl(form.cardPhotoUrl),
        national_card_photo_url:
          normalizeImageUrl(form.nationalCardPhotoUrl),
        ca: numericCA,
        cp: numericCP,
        position_ratings: positionRatings,
        stats: normalizedStats,
        description: form.description || "",
      });

      const updatedPlayer = {
        ...editablePlayer,
        name: form.name.trim(),
        dateOfBirth: form.dateOfBirth.trim(),
        date_of_birth: form.dateOfBirth.trim(),
        teamId: form.careerStatus === "active" ? (form.teamId || "") : "",
        team_id: form.careerStatus === "active" ? (form.teamId || "") : "",
        career_status: form.careerStatus,
        last_team_id: form.careerStatus === "active" ? (form.lastTeamId || "") : (form.lastTeamId || form.teamId || ""),
        retirement_year: form.careerStatus === "retired" && form.retirementYear !== "" ? Number(form.retirementYear) : null,
        countryId: form.countryId || "",
        country_id: form.countryId || "",
        secondaryCountryId: form.secondaryCountryId || "",
        secondary_country_id: form.secondaryCountryId || "",
        fm26_second_country_ids: form.secondaryCountryId ? [form.secondaryCountryId, ...(editablePlayer.fm26_second_country_ids || []).slice(1)].filter((id, index, values) => id && values.indexOf(id) === index) : (editablePlayer.fm26_second_country_ids || []).slice(1),
        fm_position: form.fmPosition || "",
        best_positions: form.bestPositions || "",
        role_used_to_fill_empty_attributes:
          form.roleUsedToFillEmptyAttributes || "",
        preferred_central_position:
          form.preferredCentralPosition || "",
        style: form.style || "",
        height: Number.isFinite(numericHeight) ? numericHeight : 0,
        right_foot: form.rightFoot || "",
        left_foot: form.leftFoot || "",
        shirt_number:
          Number.isFinite(numericShirtNumber)
            ? numericShirtNumber
            : 0,
        salary:
          Number.isFinite(numericSalary)
            ? numericSalary
            : 0,
        photoUrl: form.photoUrl.trim(),
        photo_url: form.photoUrl.trim(),
        cardPhotoUrl: form.cardPhotoUrl.trim(),
        card_photo_url: form.cardPhotoUrl.trim(),
        nationalCardPhotoUrl: form.nationalCardPhotoUrl.trim(),
        national_card_photo_url:
          form.nationalCardPhotoUrl.trim(),
        ca: numericCA,
        cp: numericCP,
        positionRatings,
        position_ratings: positionRatings,
        stats: normalizedStats,
        description: form.description || "",
      };

      setEditablePlayer(updatedPlayer);
      setForm((current) => ({
        ...current,
        positionRatings,
      }));
      setEditOpen(false);

      if (onPlayerUpdated) {
        onPlayerUpdated(updatedPlayer);
      }
    } catch (error) {
      console.error("Error updating player:", error);
      setEditError(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          error?.message ||
          "No se ha podido actualizar el jugador."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="relative h-full min-h-0 overflow-visible bg-[#e2e6eb] text-slate-900">
      <div className="absolute inset-0 bg-[#e2e6eb]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_64%_42%,rgba(255,255,255,0.95),transparent_34%)]" />

      <div
        className="pointer-events-none fixed inset-x-0 top-[23%] z-[50] flex justify-center select-none text-center uppercase whitespace-nowrap text-[clamp(6rem,18vw,15rem)] font-bold leading-none tracking-[-0.065em] text-white"
        style={{
          fontFamily: '"Teko", sans-serif',
          fontWeight: 400,
          transform: "scaleX(0.72)",
          transformOrigin: "center center",
          textShadow: "0 0 16px rgba(255,255,255,0.18), 0 0 32px rgba(255,255,255,0.10)",
          WebkitMaskImage: "linear-gradient(to bottom, #000 0%, #000 24%, rgba(0,0,0,0.92) 38%, rgba(0,0,0,0.45) 62%, transparent 88%, transparent 100%)",
          maskImage: "linear-gradient(to bottom, #000 0%, #000 24%, rgba(0,0,0,0.92) 38%, rgba(0,0,0,0.45) 62%, transparent 88%, transparent 100%)",
        }}
      >
        {teamName.toUpperCase()}
      </div>

      <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-6 py-5 md:px-10 lg:px-14">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-600 transition hover:text-[#003399]"
        >
          <ArrowLeft size={16} />
          Back to players
        </button>

        <button
          type="button"
          onClick={openEditor}
          className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500 transition hover:text-[#003399]"
          aria-label="Edit player"
        >
          EDIT <Pencil size={15} />
        </button>
      </header>

      <section className="relative z-10 grid h-full min-h-0 grid-cols-1 items-center gap-4 overflow-visible px-6 pb-2 pt-20 md:px-10 lg:grid-cols-[0.85fr_1.35fr_0.7fr] lg:px-14 xl:px-20">
        <div className="pointer-events-none absolute bottom-[2%] left-[3%] select-none whitespace-nowrap text-[clamp(5rem,14vw,15rem)] font-black uppercase leading-[0.72] tracking-[-0.09em] text-slate-900/[0.055]">
          {playerName}
        </div>

        <div className="relative z-20 flex min-h-0 flex-col justify-center py-8 lg:h-full lg:min-h-0 lg:-translate-y-[184px]">
          <h1 className="max-w-lg text-5xl font-bold leading-[0.9] tracking-[-0.045em] text-slate-950 md:text-6xl xl:text-7xl">
            {playerName.split(/\s+/).filter(Boolean).map((word, index) => (
              <span key={`${word}-${index}`} className="block">
                {word}
              </span>
            ))}
          </h1>

          <div className="mt-6 space-y-4 text-sm">
            <div className="flex items-center gap-3 text-slate-600">
              {teamLogo ? (
                <img src={teamLogo} alt="" className="h-6 w-6 object-contain" />
              ) : (
                <Building2 size={17} />
              )}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  Club
                </p>
                <p className="font-bold text-slate-900">{teamName}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-slate-600">
              <CalendarDays size={18} />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  Date of birth
                </p>
                <p className="font-bold text-slate-900">
                  {formatDate(dateOfBirth)}
                  {age !== null ? ` · ${age} years` : ""}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-slate-600">
              <UserRound size={18} />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  Player ID
                </p>
                <p className="max-w-[220px] truncate font-mono text-xs font-semibold text-slate-700">
                  {player?.id || "—"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-20 flex h-full min-h-0 items-end justify-center overflow-visible">
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none text-[clamp(12rem,25vw,24rem)] font-black leading-none tracking-[-0.1em] text-[#003399]/[0.06]">
            {age ?? ""}
          </div>

          {photoUrl ? (
            typeof document !== "undefined"
              ? createPortal(
                  <img
                    src={photoUrl}
                    alt={playerName}
                    className="
                      fixed
                      bottom-0
                      left-1/2
                      z-[60]
                      pointer-events-none
                      w-auto
                      max-w-none
                      -translate-x-1/2
                      object-contain
                      object-bottom
                      drop-shadow-[0_30px_28px_rgba(15,23,42,0.22)]

                      h-[72vh]

                      sm:h-[76vh]

                      md:h-[80vh]

                      lg:h-[88vh]
                    "
                  />,
                  document.body
                )
              : null
          ) : (
            <div className="relative z-10 flex h-[420px] w-[320px] items-center justify-center rounded-[2rem] border border-slate-300 bg-white/60 text-slate-300">
              <UsersPlaceholder />
            </div>
          )}
        </div>

        <aside className="relative z-20 flex min-h-0 flex-col justify-center py-8 lg:h-full lg:min-h-0">
          <div className="rounded-2xl border border-white/70 bg-white/70 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.07)] backdrop-blur-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
              Current club
            </p>

            <div className="mt-5 flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-slate-50">
                {teamLogo ? (
                  <img src={teamLogo} alt="" className="h-12 w-12 object-contain" />
                ) : (
                  <Building2 size={25} className="text-slate-300" />
                )}
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-black uppercase tracking-tight text-slate-900">
                  {teamName}
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400">
                  Official club
                </p>
              </div>
            </div>
          </div>
        </aside>
      </section>

      {(() => {
        const primaryColor = normalizeHexColor(
          team?.primary_color || team?.primaryColor,
          "#003399"
        );
        const middleColor = darkenHex(primaryColor, 0.48);

        if (typeof document === "undefined") return null;

        return createPortal(
          <div className="pointer-events-none fixed bottom-20 left-1/2 z-[80] flex w-[min(1100px,calc(100vw-28px))] -translate-x-1/2 gap-4 sm:bottom-20 sm:gap-5">
            <PlayerStatCard background={primaryColor} grow={1} />
            <PlayerStatCard background={middleColor} grow={1.65} />
            <PlayerStatCard background={primaryColor} grow={1} />
          </div>,
          document.body
        );
      })()}

      {editOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeEditor();
            }
          }}
        >
          <div className="max-h-[calc(100vh_-_32px)] w-full max-w-[1080px] overflow-y-auto rounded-[28px] border border-slate-200 bg-white shadow-2xl">
            <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-100 bg-white/95 px-6 py-4 backdrop-blur">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  Edit player
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  Update the player's information.
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditor}
                disabled={isSaving}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
                aria-label="Close editor"
              >
                <X size={17} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-5 bg-slate-50/50 p-6">
              <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-1">
                {[
                  ["general", "General"],
                  ...(editablePlayer?.fm26_uid ? [["fm26", "FM26"]] : []),
                  ["positions", "Positions"],
                  ["mental", "Mental"],
                  ["physical", "Physical"],
                  ["technical", "Technical"],
                  ["goalkeeping", "Goalkeeping"],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setEditTab(id)}
                    className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold transition ${
                      editTab === id
                        ? "bg-white text-[#003399] shadow-sm"
                        : "text-slate-500 hover:bg-white/70 hover:text-slate-800"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {editTab === "general" && (
                <div className="space-y-5">
                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Ficha general</p>
                        <h3 className="mt-1 text-2xl font-black text-slate-900">{form.name || "Unnamed player"}</h3>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{selectedTeam?.name || "Sin club asociado"}</span>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{selectedCountry?.name || "Sin país"}</span>
                          {age ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{age} años</span> : null}
                          {form.style ? <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{form.style}</span> : null}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {[
                          ["CA", form.ca || "—"],
                          ["CP", form.cp || "—"],
                          ["Altura", form.height ? `${form.height} cm` : "—"],
                          ["Dorsal", form.shirtNumber || "—"],
                        ].map(([label, value]) => (
                          <div key={label} className="min-w-[92px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center">
                            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</p>
                            <p className="mt-1 text-sm font-extrabold text-slate-900">{value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>

                  <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
                    <div className="space-y-5">
                      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="mb-4">
                          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Identidad</p>
                          <h4 className="mt-1 text-sm font-extrabold text-slate-900">Datos básicos del jugador</h4>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold text-slate-700">Player name</label>
                            <input type="text" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className={INPUT_CLASS} required />
                          </div>

                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                              <label className="mb-1.5 block text-xs font-semibold text-slate-700">Date of birth</label>
                              <input type="text" value={form.dateOfBirth} onChange={(event) => setForm((current) => ({ ...current, dateOfBirth: event.target.value }))} placeholder="DD/MM/YYYY" className={INPUT_CLASS} />
                            </div>
                            <div>
                              <label className="mb-1.5 block text-xs font-semibold text-slate-700">Style</label>
                              <input type="text" value={form.style} onChange={(event) => setForm((current) => ({ ...current, style: event.target.value }))} placeholder="Ej. Creativo" className={INPUT_CLASS} />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                              <label className="mb-1.5 block text-xs font-semibold text-slate-700">Country</label>
                              <SearchableEntitySelect
                                value={form.countryId}
                                onChange={(value) => setForm((current) => ({ ...current, countryId: value, secondaryCountryId: String(current.secondaryCountryId) === String(value) ? "" : current.secondaryCountryId }))}
                                options={countries}
                                kind="country"
                                placeholder="Select country"
                                searchPlaceholder="Search country..."
                                emptyOption={{ value: "", label: "Select country" }}
                              />
                            </div>
                            <div>
                              <label className="mb-1.5 block text-xs font-semibold text-slate-700">Associated club</label>
                              <SearchableEntitySelect
                                value={form.careerStatus === "retired" ? "__retired__" : form.careerStatus === "free_agent" ? "__free_agent__" : form.teamId}
                                onChange={(value) => setForm((current) => ({ ...current, careerStatus: value === "__retired__" ? "retired" : value === "__free_agent__" ? "free_agent" : "active", teamId: value.startsWith("__") ? current.teamId : value, lastTeamId: value.startsWith("__") ? (current.teamId || current.lastTeamId) : current.lastTeamId }))}
                                options={[{id:"__free_agent__",name:"Agente libre"},{id:"__retired__",name:"Retirado"},...teams]}
                                kind="team"
                                placeholder="Selecciona equipo o situación"
                                searchPlaceholder="Buscar club o estado..."
                                emptyOption={{ value: "", label: "Agente libre" }}
                              />
                              {form.careerStatus !== "active" && <div className="mt-2 space-y-2 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600"><label className="block font-semibold">Último club (opcional)<select value={form.lastTeamId || form.teamId || ""} onChange={e=>setForm(f=>({...f,lastTeamId:e.target.value,teamId:""}))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-normal"><option value="">Sin último club registrado</option>{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>{form.careerStatus === "retired" && <label className="flex items-center gap-2">Año de retirada <input type="number" min="1900" max="2100" placeholder="2024" className="w-24 rounded-lg border border-slate-200 px-2 py-1" value={form.retirementYear} onChange={e=>setForm(f=>({...f,retirementYear:e.target.value}))}/></label>}</div>}
                            </div>
                          </div>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                              <label className="mb-1.5 block text-xs font-semibold text-slate-700">Secondary country</label>
                              <SearchableEntitySelect
                                value={form.secondaryCountryId}
                                onChange={(value) => setForm((current) => ({ ...current, secondaryCountryId: value }))}
                                options={countries.filter((item) => String(item.id) !== String(form.countryId))}
                                kind="country"
                                placeholder="Select secondary country"
                                searchPlaceholder="Search country..."
                                emptyOption={{ value: "", label: "No secondary country" }}
                              />
                            </div>
                            <div className="flex items-center text-xs text-slate-400">Segunda nacionalidad opcional. No puede coincidir con la principal.</div>
                          </div>
                        </div>
                      </section>

                      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="mb-4">
                          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Perfil</p>
                          <h4 className="mt-1 text-sm font-extrabold text-slate-900">Scouting y valoración</h4>
                        </div>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold text-slate-700">Height (cm)</label>
                            <input type="number" min={0} max={250} value={form.height} onChange={(event) => setForm((current) => ({ ...current, height: event.target.value }))} className={INPUT_CLASS} />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold text-slate-700">Shirt number</label>
                            <input type="number" min={0} max={99} value={form.shirtNumber} onChange={(event) => setForm((current) => ({ ...current, shirtNumber: event.target.value }))} className={INPUT_CLASS} />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold text-slate-700">Right foot</label>
                            <input type="number" min={0} max={20} value={form.rightFoot} onChange={(event) => setForm((current) => ({ ...current, rightFoot: event.target.value }))} className={INPUT_CLASS} />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold text-slate-700">Left foot</label>
                            <input type="number" min={0} max={20} value={form.leftFoot} onChange={(event) => setForm((current) => ({ ...current, leftFoot: event.target.value }))} className={INPUT_CLASS} />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="mb-1.5 block text-xs font-semibold text-slate-700">CA</label>
                            <input type="number" min={0} max={200} value={form.ca} onChange={(event) => setForm((current) => ({ ...current, ca: event.target.value }))} className={INPUT_CLASS} />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="mb-1.5 block text-xs font-semibold text-slate-700">CP</label>
                            <input type="number" min={0} max={200} value={form.cp} onChange={(event) => setForm((current) => ({ ...current, cp: event.target.value }))} className={INPUT_CLASS} />
                          </div>
                        </div>
                      </section>
                    </div>

                    <div className="space-y-5">
                      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="mb-4">
                          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Rol</p>
                          <h4 className="mt-1 text-sm font-extrabold text-slate-900">Encaje táctico y descripción</h4>
                        </div>
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                              <label className="mb-1.5 block text-xs font-semibold text-slate-700">Posición</label>
                              <input type="text" value={form.fmPosition || ""} onChange={(event) => setForm((current) => ({ ...current, fmPosition: event.target.value }))} className={INPUT_CLASS} />
                            </div>
                            <div>
                              <label className="mb-1.5 block text-xs font-semibold text-slate-700">Mejores puestos</label>
                              <input type="text" value={form.bestPositions || ""} onChange={(event) => setForm((current) => ({ ...current, bestPositions: event.target.value }))} className={INPUT_CLASS} />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                              <label className="mb-1.5 block text-xs font-semibold text-slate-700">Rol utilizado para rellenar atributos vacíos</label>
                              <input type="text" value={form.roleUsedToFillEmptyAttributes || ""} onChange={(event) => setForm((current) => ({ ...current, roleUsedToFillEmptyAttributes: event.target.value }))} className={INPUT_CLASS} />
                            </div>
                            <div>
                              <label className="mb-1.5 block text-xs font-semibold text-slate-700">Posición central preferida</label>
                              <input type="text" value={form.preferredCentralPosition || ""} onChange={(event) => setForm((current) => ({ ...current, preferredCentralPosition: event.target.value }))} className={INPUT_CLASS} />
                            </div>
                          </div>

                          <div>
                            <label className="mb-1.5 block text-xs font-semibold text-slate-700">Description</label>
                            <select value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className={INPUT_CLASS}>
                              <option value="">Sin descripción</option>
                              {DESCRIPTION_OPTIONS.map((group) => (
                                <optgroup key={group.group} label={group.group}>
                                  {group.options.map((option) => (
                                    <option key={option} value={option}>{option}</option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="mb-1.5 block text-xs font-semibold text-slate-700">Salary</label>
                            <input type="number" min={0} step={1} value={form.salary} onChange={(event) => setForm((current) => ({ ...current, salary: event.target.value }))} className={INPUT_CLASS} />
                          </div>
                        </div>
                      </section>

                      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="mb-4">
                          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Media</p>
                          <h4 className="mt-1 text-sm font-extrabold text-slate-900">Enlaces visuales</h4>
                        </div>
                        <div className="space-y-3">
                          {[
                            ["photoUrl", "Profile photo URL"],
                            ["cardPhotoUrl", "Card photo URL"],
                            ["nationalCardPhotoUrl", "National team card photo URL"],
                          ].map(([key, label]) => (
                            <div key={key}>
                              <label className="mb-1.5 block text-xs font-semibold text-slate-700">{label}</label>
                              <input type="url" value={form[key] || ""} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} placeholder="https://..." className={INPUT_CLASS} />
                            </div>
                          ))}
                        </div>
                      </section>
                    </div>
                  </div>
                </div>
              )}

              {editTab === "fm26" && editablePlayer?.fm26_uid && (
                <div className="space-y-5">
                  <div className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-indigo-50 p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-sky-700">Datos importados de FM26</p>
                        <h3 className="mt-1 text-lg font-extrabold text-slate-900">{editablePlayer.name}</h3>
                        <p className="text-xs text-slate-500">{editablePlayer.fm26_save_club_name || "Sin club de origen"} · UID FM {editablePlayer.fm26_uid}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-slate-700 shadow-sm ring-1 ring-slate-200">CA {editablePlayer.ca ?? "—"}</span>
                        <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-slate-700 shadow-sm ring-1 ring-slate-200">CP {editablePlayer.cp ?? "—"}</span>
                        <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-slate-700 shadow-sm ring-1 ring-slate-200">Reputación {editablePlayer.fm26_reputation?.world ?? "—"}</span>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-3">
                      {[
                        ["Valor de traspaso", formatFm26Money(editablePlayer.fm26_transfer_value)],
                        ["Sueldo semanal", formatFm26Money(editablePlayer.fm26_weekly_wage)],
                        ["Fin de contrato", editablePlayer.fm26_contract?.end || "—"],
                        ["Nacionalidad FM", editablePlayer.fm26_nation_id ? `ID ${editablePlayer.fm26_nation_id}` : "—"],
                        ["Cesión", editablePlayer.fm26_loan_details?.on_loan ? "Sí" : "No"],
                        ["Club de origen", editablePlayer.fm26_save_club_name || "—"],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-xl border border-slate-200 bg-white/90 p-3 shadow-sm">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
                          <p className="mt-1 text-sm font-extrabold text-slate-900">{value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 grid gap-3 xl:grid-cols-[1.25fr_1fr]">
                      <section className="rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm">
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <h4 className="text-xs font-black uppercase tracking-[0.18em] text-sky-700">Personalidad FM26</h4>
                          <span className="text-[11px] text-slate-400">Escala 1–20</span>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {Object.entries(editablePlayer.fm26_personality || {}).map(([key, value]) => (
                            <div key={key} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                              <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                                <span className="font-semibold text-slate-600">{formatFm26Label(key)}</span>
                                <strong className="text-slate-900">{value ?? "—"}</strong>
                              </div>
                              <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                                <div className={`${getFm26MetricTone(value)} h-full rounded-full`} style={{ width: `${getValueBarWidth(value)}%` }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>

                      <section className="space-y-3">
                        <div className="rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm">
                          <h4 className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-sky-700">Posiciones FM26</h4>
                          <div className="space-y-3 text-xs">
                            <div>
                              <p className="mb-1 font-semibold text-slate-600">Naturales</p>
                              <div className="flex flex-wrap gap-1.5">
                                {(editablePlayer.fm26_natural_positions || []).length ? (editablePlayer.fm26_natural_positions || []).map((item) => (
                                  <span key={item} className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700 ring-1 ring-emerald-200">{item}</span>
                                )) : <span className="text-slate-400">—</span>}
                              </div>
                            </div>
                            <div>
                              <p className="mb-1 font-semibold text-slate-600">Competentes</p>
                              <div className="flex flex-wrap gap-1.5">
                                {(editablePlayer.fm26_accomplished_positions || []).length ? (editablePlayer.fm26_accomplished_positions || []).map((item) => (
                                  <span key={item} className="rounded-full bg-blue-50 px-2.5 py-1 font-semibold text-blue-700 ring-1 ring-blue-200">{item}</span>
                                )) : <span className="text-slate-400">—</span>}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm">
                          <h4 className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-sky-700">Contrato y economía</h4>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="rounded-lg bg-slate-50 p-2"><span className="block text-[11px] font-semibold text-slate-500">Inicio</span><strong>{editablePlayer.fm26_contract?.start || "—"}</strong></div>
                            <div className="rounded-lg bg-slate-50 p-2"><span className="block text-[11px] font-semibold text-slate-500">Fin</span><strong>{editablePlayer.fm26_contract?.end || "—"}</strong></div>
                            <div className="rounded-lg bg-slate-50 p-2"><span className="block text-[11px] font-semibold text-slate-500">Estatus</span><strong>{formatFm26Label(editablePlayer.fm26_contract?.squad_status || "—")}</strong></div>
                            <div className="rounded-lg bg-slate-50 p-2"><span className="block text-[11px] font-semibold text-slate-500">Cláusulas</span><strong>{editablePlayer.fm26_contract?.clauses?.length || 0}</strong></div>
                          </div>
                        </div>
                      </section>
                    </div>

                    <section className="mt-4 rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <h4 className="text-xs font-black uppercase tracking-[0.18em] text-sky-700">Rasgos de jugador</h4>
                        <span className="text-[11px] text-slate-400">FM26 traits</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(editablePlayer.fm26_traits || []).filter((item) => item !== "unknown").length ? (editablePlayer.fm26_traits || []).filter((item) => item !== "unknown").map((item) => (
                          <span key={item} className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700 ring-1 ring-violet-200">{formatFm26Label(item)}</span>
                        )) : <span className="text-xs text-slate-500">Sin rasgos identificados</span>}
                      </div>
                    </section>

                    <details className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white/90">
                      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-bold text-sky-800">Ver registro original completo de FM26</summary>
                      <pre className="max-h-64 overflow-auto border-t bg-slate-950 p-4 text-[11px] text-slate-100">{JSON.stringify(editablePlayer.fm26_source_record || {},null,2)}</pre>
                    </details>
                  </div>
                </div>
              )}

              
{editTab === "positions" && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-slate-700">
                        Position ratings
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        Introduce cada valor directamente sobre un campo de juego.
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                      0-20
                    </span>
                  </div>

                  <div className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-[#d9efdf] px-3 py-4 sm:px-5 sm:py-5">
                    <div className="pointer-events-none absolute inset-0">
                      <div className="absolute inset-3 rounded-xl border border-white/80" />
                      <div className="absolute left-1/2 top-3 bottom-3 w-px -translate-x-1/2 bg-white/80" />
                      <div className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/80" />
                      <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
                      <div className="absolute left-1/2 top-3 h-10 w-32 -translate-x-1/2 rounded-b-xl border-x border-b border-white/80" />
                      <div className="absolute left-1/2 bottom-3 h-10 w-32 -translate-x-1/2 rounded-t-xl border-x border-t border-white/80" />
                    </div>

                    {[
                      ["delantero", "DL (C)", "Delantero", "left-1/2 top-[4%] -translate-x-1/2"],
                      ["mediapunta_por_la_izquierda", "EI", "Mediapunta por la izquierda", "left-[8%] top-[13%] -translate-y-1/2"],
                      ["mediapunta_central", "MP (C)", "Mediapunta central", "left-1/2 top-[13%] -translate-x-1/2 -translate-y-1/2"],
                      ["mediapunta_por_la_derecha", "ED", "Mediapunta por la derecha", "right-[8%] top-[13%] -translate-y-1/2"],
                      ["centrocampista_izquierdo", "MC (I)", "Centrocampista izquierdo", "left-[19%] top-[31%] -translate-y-1/2"],
                      ["centrocampista", "MC", "Centrocampista", "left-1/2 top-[29%] -translate-x-1/2 -translate-y-1/2"],
                      ["centrocampista_derecho", "MC (D)", "Centrocampista derecho", "right-[19%] top-[31%] -translate-y-1/2"],
                      ["carrilero_izquierdo", "CR (I)", "Carrilero izquierdo", "left-[5%] top-[48%] -translate-y-1/2"],
                      ["mediocentro", "MCD", "Mediocentro", "left-1/2 top-[48%] -translate-x-1/2 -translate-y-1/2"],
                      ["carrilero_derecho", "CR (D)", "Carrilero derecho", "right-[5%] top-[48%] -translate-y-1/2"],
                      ["defensa_izquierdo", "DF (I)", "Defensa izquierdo", "left-[20%] top-[68%] -translate-y-1/2"],
                      ["defensa_central", "DF (C)", "Defensa central", "left-1/2 top-[68%] -translate-x-1/2 -translate-y-1/2"],
                      ["defensa_derecho", "DF (D)", "Defensa derecho", "right-[20%] top-[68%] -translate-y-1/2"],
                      ["portero", "POR", "Portero", "left-1/2 bottom-[3%] -translate-x-1/2"],
                    ].map(([key, shortLabel, fullLabel, positionClass]) => (
                      <div key={key} className={`absolute z-10 w-[88px] sm:w-[104px] ${positionClass}`} title={fullLabel}>
                        <div className="rounded-xl border border-white/90 bg-white/95 p-1.5 shadow-sm backdrop-blur-sm">
                          <div className="mb-1 truncate px-1 text-center text-[9px] font-extrabold uppercase tracking-tight text-slate-700 sm:text-[10px]">
                            {shortLabel}
                          </div>
                          <input
                            aria-label={fullLabel}
                            type="number"
                            min={0}
                            max={20}
                            step={1}
                            value={form.positionRatings?.[key] ?? 0}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                positionRatings: {
                                  ...current.positionRatings,
                                  [key]: event.target.value,
                                },
                              }))
                            }
                            className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-center text-sm font-extrabold text-slate-800 outline-none transition focus:border-[#003399] focus:ring-2 focus:ring-[#003399]/10"
                          />
                        </div>
                      </div>
                    ))}

                    <div className="relative z-10 mt-[350px] grid grid-cols-2 gap-2 border-t border-white/60 pt-3 sm:mt-[385px] sm:grid-cols-4">
                      <div className="rounded-lg bg-white/70 px-2 py-1.5 text-[9px] text-slate-500"><strong className="text-slate-700">EI / ED</strong> · bandas</div>
                      <div className="rounded-lg bg-white/70 px-2 py-1.5 text-[9px] text-slate-500"><strong className="text-slate-700">MC</strong> · medio</div>
                      <div className="rounded-lg bg-white/70 px-2 py-1.5 text-[9px] text-slate-500"><strong className="text-slate-700">MCD</strong> · pivote</div>
                      <div className="rounded-lg bg-white/70 px-2 py-1.5 text-[9px] text-slate-500"><strong className="text-slate-700">DF / CR</strong> · defensa</div>
                    </div>
                  </div>
                </div>
              )}

              {["mental", "physical", "technical", "goalkeeping"].includes(editTab) && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-slate-700">
                        {editTab === "mental"
                          ? "Mental"
                          : editTab === "physical"
                            ? "Physical"
                            : editTab === "technical"
                              ? "Technical"
                              : "Goalkeeping"}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        Todos los atributos utilizan una escala de 0 a 20.
                      </p>
                    </div>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                      0-20
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {STAT_GROUPS[editTab].map(([key, label]) => {
                      const value = form.stats?.[editTab]?.[key] ?? 0;
                      return (
                        <div key={key} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-colors focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <label htmlFor={`edit-stat-${editTab}-${key}`} className="min-w-0 text-xs font-semibold text-slate-700">{label}</label>
                            <input
                              id={`edit-stat-${editTab}-${key}`}
                              aria-label={`${label} (0–20)`}
                              type="number"
                              min={0}
                              max={20}
                              step={1}
                              value={value}
                              onChange={(event) => setForm((current) => ({
                                ...current,
                                stats: { ...current.stats, [editTab]: { ...(current.stats?.[editTab] || {}), [key]: event.target.value } },
                              }))}
                              className="h-9 w-14 rounded-lg border border-slate-200 bg-slate-50 px-1 text-center text-sm font-extrabold text-slate-900 outline-none focus:border-blue-400"
                            />
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={20} aria-valuenow={Math.max(0, Math.min(20, Number(value) || 0))}>
                            <div className={`${getFm26MetricTone(value)} h-full rounded-full transition-all duration-300`} style={{ width: `${getValueBarWidth(value)}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="sticky bottom-0 z-20 flex justify-end gap-2 border-t border-slate-200 bg-white/95 px-1 pb-1 pt-4 backdrop-blur">
                <button
                  type="button"
                  onClick={closeEditor}
                  disabled={isSaving}
                  className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#003399] px-4 text-sm font-semibold text-white transition hover:bg-[#002477] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Save size={16} />
                  {isSaving ? "Saving..." : "Save changes"}
                </button>
              </div>

            </form>
          </div>
            </div>,
            document.body
          )
        : null}
    </main>
  );
}

function UsersPlaceholder() {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <UserRound size={52} strokeWidth={1.2} />
      <span className="text-[10px] font-bold uppercase tracking-[0.18em]">
        Add player photo
      </span>
    </div>
  );
}
