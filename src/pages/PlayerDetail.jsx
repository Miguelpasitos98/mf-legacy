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

const POSITION_CODES = [
  "GK",
  "DFC",
  "LD",
  "LI",
  "CRD",
  "CRI",
  "CDM",
  "CM",
  "CAM",
  "EI",
  "ED",
  "DC",
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

const createEmptyStats = () => ({
  mental: Object.fromEntries(STAT_GROUPS.mental.map(([key]) => [key, 0])),
  physical: Object.fromEntries(STAT_GROUPS.physical.map(([key]) => [key, 0])),
  technical: Object.fromEntries(STAT_GROUPS.technical.map(([key]) => [key, 0])),
  goalkeeping: Object.fromEntries(STAT_GROUPS.goalkeeping.map(([key]) => [key, 0])),
});

const normalizeStats = (player) => {
  const source = player?.stats || {};
  const empty = createEmptyStats();

  return {
    mental: { ...empty.mental, ...(source.mental || {}) },
    physical: { ...empty.physical, ...(source.physical || {}) },
    technical: { ...empty.technical, ...(source.technical || {}) },
    goalkeeping: { ...empty.goalkeeping, ...(source.goalkeeping || {}) },
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

  const valid = POSITION_CODES
    .map((code) => ({ code, value: Number(ratings[code]) }))
    .filter((item) => Number.isFinite(item.value))
    .sort((a, b) => {
      if (b.value !== a.value) return b.value - a.value;
      return POSITION_CODES.indexOf(a.code) - POSITION_CODES.indexOf(b.code);
    });

  if (!valid.length || valid[0].value <= 0) return "—";
  return `${valid[0].code} · ${valid[0].value}/20`;
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
      GK: 0,
      DFC: 0,
      LD: 0,
      LI: 0,
      CRD: 0,
      CRI: 0,
      CDM: 0,
      CM: 0,
      CAM: 0,
      EI: 0,
      ED: 0,
      DC: 0,
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
      countryId: player?.countryId || player?.country_id || "",
      position: player?.position || player?.position_raw || "",
      secondaryPosition:
        player?.secondary_position ||
        player?.secondary_position_raw ||
        "",
      style: player?.style || "",
      height: player?.height ?? "",
      rightFoot: player?.right_foot || player?.rightFoot || "",
      leftFoot: player?.left_foot || player?.leftFoot || "",
      shirtNumber:
        player?.shirt_number ??
        player?.shirtNumber ??
        "",
      salary: player?.salary ?? "",
      ca: player?.ca ?? "",
      cp: player?.cp ?? "",
      description: player?.description || "",
      positionRatings: initialPositionRatings,
      stats: normalizeStats(player),
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

    const positionRatings = POSITION_CODES.reduce((result, code) => {
      const value = Number(form.positionRatings?.[code] ?? 0);
      result[code] = Number.isFinite(value)
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
        const value = Number(form.stats?.[group]?.[key] ?? 0);
        normalizedStats[group][key] = Number.isFinite(value)
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
        team_id: form.teamId || "",
        country_id: form.countryId || "",
        position: form.position || "",
        secondary_position: form.secondaryPosition || "",
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
        teamId: form.teamId || "",
        team_id: form.teamId || "",
        countryId: form.countryId || "",
        country_id: form.countryId || "",
        position: form.position || "",
        secondary_position: form.secondaryPosition || "",
        secondaryPosition: form.secondaryPosition || "",
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
        national_card_photo_url: form.nationalCardPhotoUrl.trim(),
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
          <div className="max-h-[calc(100vh_-_32px)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
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

            <form onSubmit={handleSave} className="space-y-5 p-5">
              {editError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {editError}
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Player name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  className={INPUT_CLASS}
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Date of birth
                </label>
                <input
                  type="text"
                  value={form.dateOfBirth}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      dateOfBirth: event.target.value,
                    }))
                  }
                  placeholder="DD/MM/YYYY"
                  className={INPUT_CLASS}
                />
              </div>

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
                />
              </div>

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
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
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
                    className={INPUT_CLASS}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
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
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Description
                </label>

                <select
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  className={INPUT_CLASS}
                >
                  <option value="">Sin descripción</option>

                  {DESCRIPTION_OPTIONS.map((group) => (
                    <optgroup key={group.group} label={group.group}>
                      {group.options.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Profile photo URL
                </label>
                <input
                  type="url"
                  value={form.photoUrl}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      photoUrl: event.target.value,
                    }))
                  }
                  placeholder="https://..."
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Card photo URL
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
                  className={INPUT_CLASS}
                />
              </div>

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
                  className={INPUT_CLASS}
                />
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Position ratings
                    </label>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Valora cada posición de 0 a 20.
                    </p>
                  </div>

                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                    0-20
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {POSITION_CODES.map((code) => (
                    <div key={code}>
                      <label className="mb-1 block text-[11px] font-semibold text-slate-600">
                        {code}
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={20}
                        step={1}
                        value={form.positionRatings?.[code] ?? 0}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            positionRatings: {
                              ...current.positionRatings,
                              [code]: event.target.value,
                            },
                          }))
                        }
                        className={INPUT_CLASS}
                      />
                    </div>
                  ))}
                </div>
              </div>


              {editError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {editError}
                </div>
              )}

              <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-1">
                {[
                  ["general", "General"],
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
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                      Player name
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      className={INPUT_CLASS}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                        Date of birth
                      </label>
                      <input
                        type="text"
                        value={form.dateOfBirth}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            dateOfBirth: event.target.value,
                          }))
                        }
                        placeholder="DD/MM/YYYY"
                        className={INPUT_CLASS}
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                        Style
                      </label>
                      <input
                        type="text"
                        value={form.style}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            style: event.target.value,
                          }))
                        }
                        placeholder="Ej. Creativo"
                        className={INPUT_CLASS}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                      />
                    </div>

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
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                        Height (cm)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={250}
                        value={form.height}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            height: event.target.value,
                          }))
                        }
                        className={INPUT_CLASS}
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                        Shirt number
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={99}
                        value={form.shirtNumber}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            shirtNumber: event.target.value,
                          }))
                        }
                        className={INPUT_CLASS}
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                        Right foot
                      </label>
                      <input
                        type="text"
                        value={form.rightFoot}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            rightFoot: event.target.value,
                          }))
                        }
                        className={INPUT_CLASS}
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                        Left foot
                      </label>
                      <input
                        type="text"
                        value={form.leftFoot}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            leftFoot: event.target.value,
                          }))
                        }
                        className={INPUT_CLASS}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                        Position
                      </label>
                      <select
                        value={form.position}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            position: event.target.value,
                          }))
                        }
                        className={INPUT_CLASS}
                      >
                        <option value="">No position</option>
                        {POSITION_CODES.map((code) => (
                          <option key={code} value={code}>
                            {code}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                        Secondary position
                      </label>
                      <select
                        value={form.secondaryPosition}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            secondaryPosition: event.target.value,
                          }))
                        }
                        className={INPUT_CLASS}
                      >
                        <option value="">No secondary position</option>
                        {POSITION_CODES.map((code) => (
                          <option key={code} value={code}>
                            {code}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-700">
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
                        className={INPUT_CLASS}
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-700">
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
                        className={INPUT_CLASS}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                      Salary
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={form.salary}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          salary: event.target.value,
                        }))
                      }
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                      Description
                    </label>
                    <select
                      value={form.description}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      className={INPUT_CLASS}
                    >
                      <option value="">Sin descripción</option>
                      {DESCRIPTION_OPTIONS.map((group) => (
                        <optgroup key={group.group} label={group.group}>
                          {group.options.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                        Profile photo URL
                      </label>
                      <input
                        type="url"
                        value={form.photoUrl}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            photoUrl: event.target.value,
                          }))
                        }
                        placeholder="https://..."
                        className={INPUT_CLASS}
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                        Card photo URL
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
                        className={INPUT_CLASS}
                      />
                    </div>

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
                        className={INPUT_CLASS}
                      />
                    </div>
                  </div>
                </div>
              )}

              {editTab === "positions" && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Position ratings
                      </label>
                      <p className="mt-1 text-[11px] text-slate-400">
                        Valora cada posición de 0 a 20.
                      </p>
                    </div>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                      0-20
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {POSITION_CODES.map((code) => (
                      <div key={code}>
                        <label className="mb-1 block text-[11px] font-semibold text-slate-600">
                          {code}
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={20}
                          step={1}
                          value={form.positionRatings?.[code] ?? 0}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              positionRatings: {
                                ...current.positionRatings,
                                [code]: event.target.value,
                              },
                            }))
                          }
                          className={INPUT_CLASS}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {STAT_GROUPS[editTab] && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        {editTab === "mental"
                          ? "Mental"
                          : editTab === "physical"
                            ? "Physical"
                            : editTab === "technical"
                              ? "Technical"
                              : "Goalkeeping"}
                      </label>
                      <p className="mt-1 text-[11px] text-slate-400">
                        Todos los atributos utilizan una escala de 0 a 20.
                      </p>
                    </div>

                    <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                      0-20
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {STAT_GROUPS[editTab].map(([key, label]) => (
                      <div key={key}>
                        <label className="mb-1.5 block text-[11px] font-semibold text-slate-600">
                          {label}
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={20}
                          step={1}
                          value={form.stats?.[editTab]?.[key] ?? 0}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              stats: {
                                ...current.stats,
                                [editTab]: {
                                  ...(current.stats?.[editTab] || {}),
                                  [key]: event.target.value,
                                },
                              },
                            }))
                          }
                          className={INPUT_CLASS}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
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
