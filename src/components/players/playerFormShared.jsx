import React, { useEffect, useRef, useState } from "react";
import {
  Building2,
  Globe2,
  ChevronDown,
  Search,
  Plus,
} from "lucide-react";
import TeamLogo from "@/components/teams/TeamLogo";

/**
 * MF LEGACY — Shared constants and helpers for the player form.
 *
 * Extracted from Players.jsx so both Players.jsx and PlayerFormModal.jsx
 * import the same definitions without duplication.
 */

// MF LEGACY: logos de estado integrados, sin dependencias externas.
export const CAREER_STATUS_LOGOS = {
  free_agent: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#243F71"/><stop offset="1" stop-color="#07182F"/></linearGradient></defs><path d="M48 5 85 20v30c0 19-15 32-37 41C26 82 11 69 11 50V20z" fill="url(#g)" stroke="#9EB7E4" stroke-width="3"/><rect x="27" y="36" width="42" height="32" rx="5" fill="none" stroke="#D9E9FF" stroke-width="5"/><path d="M39 36v-7c0-5 4-8 9-8s9 3 9 8v7M27 48h42M44 46v6h8v-6" fill="none" stroke="#D9E9FF" stroke-width="5" stroke-linecap="round"/></svg>`)}`,
  retired: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#725A29"/><stop offset="1" stop-color="#251A0B"/></linearGradient></defs><path d="M48 5 85 20v30c0 19-15 32-37 41C26 82 11 69 11 50V20z" fill="url(#g)" stroke="#E9C77B" stroke-width="3"/><path d="M32 28h32v13c0 12-6 20-16 20S32 53 32 41V28zm0 6H23v5c0 9 6 13 14 13m27-18h9v5c0 9-6 13-14 13M48 61v9m-12 5h24" fill="none" stroke="#FFE3A5" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`)}`,
};
export const careerStatusLogo = (status) => CAREER_STATUS_LOGOS[status] || "";

export const PLAYER_DESCRIPTIONS = [
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

export const inputClassName =
  "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#003399] focus:ring-2 focus:ring-[#003399]/10";

export const POSITION_RATING_GROUPS = [
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

export const POSITION_RATING_DEFAULTS = {
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

export const emptyPlayerForm = {
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

export const NEW_TEAM_VALUE = "__new_team__";
export const NEW_COUNTRY_VALUE = "__new_country__";

export const normalizeImageUrl = (value) => {
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

export const getCountryFlagUrl = (country) => {
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

export function SearchableEntitySelect({
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

    if (kind === "country") {
      const image = getCountryFlagUrl(item);
      return (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-50">
          {image ? (
            <img
              src={image}
              alt=""
              className="h-5 w-7 rounded-[2px] object-cover"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <Globe2
              size={15}
              className="text-slate-300"
            />
          )}
        </span>
      );
    }

    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-50">
        <TeamLogo src={item?.logo || item?.logo_url || item?.logoUrl} imgClassName="h-6 w-6 object-contain" iconSize={15} iconClassName="text-slate-300" />
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