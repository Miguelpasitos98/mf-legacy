import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  useRef,
} from "react";
import { createPortal } from "react-dom";

import { useOutletContext } from "react-router-dom";

import {
  Search,
  Globe,
  Star,
  TrendingUp,
  Map,
  CircleAlert,
  Plus,
  X,
  Shield,
  Building2,
  Users,
  Shirt,
  Palette,
  Database,
  FileJson,
  ClipboardPaste,
  ChevronDown,
  Pipette,
  Save,
  Trash2,
} from "lucide-react";

import { base44 } from "@/api/base44Client";

// MF LEGACY: logos de estado integrados, sin dependencias externas.
const CAREER_STATUS_LOGOS = {
  free_agent: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#243F71"/><stop offset="1" stop-color="#07182F"/></linearGradient></defs><path d="M48 5 85 20v30c0 19-15 32-37 41C26 82 11 69 11 50V20z" fill="url(#g)" stroke="#9EB7E4" stroke-width="3"/><rect x="27" y="36" width="42" height="32" rx="5" fill="none" stroke="#D9E9FF" stroke-width="5"/><path d="M39 36v-7c0-5 4-8 9-8s9 3 9 8v7M27 48h42M44 46v6h8v-6" fill="none" stroke="#D9E9FF" stroke-width="5" stroke-linecap="round"/></svg>`)}`,
  retired: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#725A29"/><stop offset="1" stop-color="#251A0B"/></linearGradient></defs><path d="M48 5 85 20v30c0 19-15 32-37 41C26 82 11 69 11 50V20z" fill="url(#g)" stroke="#E9C77B" stroke-width="3"/><path d="M32 28h32v13c0 12-6 20-16 20S32 53 32 41V28zm0 6H23v5c0 9 6 13 14 13m27-18h9v5c0 9-6 13-14 13M48 61v9m-12 5h24" fill="none" stroke="#FFE3A5" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`)}`,
};
const careerStatusLogo = (status) => CAREER_STATUS_LOGOS[status] || "";


const navigationFilters = [
  { id: "countries", label: "Countries", icon: Globe },
  { id: "continents", label: "Continents", icon: Map },
  { id: "reputation", label: "Reputation", icon: Star },
  { id: "market", label: "Market", icon: TrendingUp },
  { id: "incomplete", label: "Incomplete", icon: CircleAlert },
  { id: "unattached", label: "Sin equipo", icon: Users },
];

const competitionDetails = {};

const emptyTeamForm = {
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

const inputClassName =
  "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#003399] focus:ring-2 focus:ring-[#003399]/10";

const textareaClassName =
  "min-h-[104px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#003399] focus:ring-2 focus:ring-[#003399]/10";

const normalizeImageUrl = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";

  let url = trimmed;

  if (url.startsWith("//")) {
    url = `https:${url}`;
  } else if (!/^(https?:|data:|blob:)/i.test(url)) {
    url = `https://${url}`;
  }

  // GitHub "blob" URLs are HTML pages rather than image resources.
  // Convert them to raw.githubusercontent.com so <img> can render them.
  const githubBlobMatch = url.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/i
  );

  if (githubBlobMatch) {
    const [, owner, repo, branch, filePath] =
      githubBlobMatch;

    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
  }

  return url;
};

const rgbToHex = (r, g, b) =>
  `#${[r, g, b].map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0")).join("").toUpperCase()}`;

const extractImagePalette = (image) => {
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

function FormField({ label, children, hint }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  description,
  open,
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
        <Icon size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-extrabold text-slate-900">
          {title}
        </h3>
        {description && (
          <p className="mt-0.5 text-xs text-slate-500">
            {description}
          </p>
        )}
      </div>
      <ChevronDown
        size={17}
        className={`shrink-0 text-slate-400 transition-transform ${
          open ? "rotate-180" : ""
        }`}
      />
    </div>
  );
}

function CollapsibleSection({
  icon,
  title,
  description,
  defaultOpen = false,
  children,
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-slate-50 md:px-5"
        aria-expanded={open}
      >
        <SectionHeader
          icon={icon}
          title={title}
          description={description}
          open={open}
        />
      </button>

      {open && (
        <div className="border-t border-slate-100 px-4 pb-5 pt-5 md:px-5">
          {children}
        </div>
      )}
    </section>
  );
}

function getCountryFlagUrl(country) {
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
    (code.length === 2
      ? code.toLowerCase()
      : "");

  return alpha2
    ? `https://flagcdn.com/${alpha2}.svg`
    : "";
}

function SearchableTeamSelect({
  value,
  onChange,
  options,
  kind,
  placeholder,
  searchPlaceholder,
  emptyOption,
  specialOption,
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

    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
    };
  }, [open]);

  const getLabel = (item) =>
    item?.name || "Unnamed";

  const getMeta = (item) =>
    kind === "country"
      ? item?.code || ""
      : item?.shortName ||
        item?.short_name ||
        "";

  const getImage = (item) => {
    if (kind === "country") {
      return getCountryFlagUrl(item);
    }

    return normalizeImageUrl(
      item?.logo ||
        item?.logo_url ||
        item?.logoUrl
    );
  };

  const filteredOptions = options
    .filter(
      (item) =>
        item?.id &&
        item?.name
    )
    .filter((item) => {
      const searchText = [
        item?.name,
        item?.shortName,
        item?.short_name,
        item?.code,
        item?.countryName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchText.includes(
        query.trim().toLowerCase()
      );
    })
    .sort((a, b) =>
      String(a?.name || "").localeCompare(
        String(b?.name || ""),
        "es",
        { sensitivity: "base" }
      )
    );

  const selected =
    options.find(
      (item) =>
        String(item?.id) === String(value)
    ) || null;

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
              event.currentTarget.style.display =
                "none";
            }}
          />
        ) : (
          <span className="text-[10px] font-bold text-slate-300">
            {kind === "country"
              ? "•"
              : "FC"}
          </span>
        )}
      </span>
    );
  };

  return (
    <div
      ref={wrapperRef}
      className="relative"
    >
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
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-[10px] font-bold text-slate-300">
            {kind === "country"
              ? "•"
              : "FC"}
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
              : String(value) ===
                String(
                  emptyOption?.value
                )
                ? emptyOption.label
                : String(value) ===
                    String(
                      specialOption?.value
                    )
                  ? specialOption.label
                  : placeholder}
          </span>
        </span>

        {selected &&
        getMeta(selected) ? (
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
                  setQuery(
                    event.target.value
                  )
                }
                placeholder={
                  searchPlaceholder
                }
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
                  selectValue(
                    emptyOption.value
                  )
                }
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
                  String(value) ===
                  String(emptyOption.value)
                    ? "bg-[#003399]/[0.06] text-[#003399]"
                    : "hover:bg-slate-50"
                }`}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-50 text-[10px] font-bold text-slate-300">
                  {kind === "country"
                    ? "•"
                    : "FC"}
                </span>
                <span className="font-medium">
                  {emptyOption.label}
                </span>
              </button>
            )}

            {filteredOptions.map(
              (item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    selectValue(item.id)
                  }
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition ${
                    String(item.id) ===
                    String(value)
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
              )
            )}

            {filteredOptions.length ===
              0 && (
              <div className="px-3 py-6 text-center text-xs text-slate-400">
                No results found.
              </div>
            )}

            {specialOption && (
              <button
                type="button"
                onClick={() =>
                  selectValue(
                    specialOption.value
                  )
                }
                className={`mt-1 flex w-full items-center gap-3 rounded-lg border-t border-slate-100 px-3 py-2.5 text-left text-sm font-semibold text-[#003399] transition hover:bg-[#003399]/[0.04] ${
                  String(value) ===
                  String(
                    specialOption.value
                  )
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

function KitColorPicker({
  kitNumber,
  photoUrl,
  badgeBg,
  badgeText,
  onChangeColor,
}) {
  const [palette, setPalette] = useState([]);
  const [imageError, setImageError] = useState(false);
  const [target, setTarget] = useState("badgeBg");

  const normalizedPhotoUrl =
    normalizeImageUrl(photoUrl);

  useEffect(() => {
    setPalette([]);
    setImageError(false);

    if (!normalizedPhotoUrl) return;

    const paletteImage =
      new Image();

    paletteImage.crossOrigin =
      "anonymous";

    paletteImage.onload = () => {
      setPalette(
        extractImagePalette(
          paletteImage
        )
      );
    };

    paletteImage.onerror = () => {
      setPalette([]);
      setImageError(true);
    };

    paletteImage.src =
      normalizedPhotoUrl;
  }, [normalizedPhotoUrl]);

  const pickScreenColor = async () => {
    if (
      typeof window ===
        "undefined" ||
      !window.EyeDropper
    ) {
      return;
    }

    try {
      const eyeDropper =
        new window.EyeDropper();

      const result =
        await eyeDropper.open();

      if (result?.sRGBHex) {
        onChangeColor(
          target,
          result.sRGBHex.toUpperCase()
        );
      }
    } catch {
      // User cancelled the native picker.
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-700">
            Kit colors
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            Selecciona el color del fondo o del texto de la insignia.
          </p>
        </div>

        <button
          type="button"
          onClick={pickScreenColor}
          disabled={
            typeof window ===
              "undefined" ||
            !window.EyeDropper
          }
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          title="Usar cuentagotas del navegador"
        >
          <Pipette size={14} />
          Cuentagotas
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() =>
            setTarget("badgeBg")
          }
          className={`rounded-lg px-3 py-2 text-[11px] font-semibold transition ${
            target === "badgeBg"
              ? "bg-[#003399] text-white"
              : "border border-slate-200 bg-white text-slate-700"
          }`}
        >
          Badge background
        </button>

        <button
          type="button"
          onClick={() =>
            setTarget("badgeText")
          }
          className={`rounded-lg px-3 py-2 text-[11px] font-semibold transition ${
            target === "badgeText"
              ? "bg-[#003399] text-white"
              : "border border-slate-200 bg-white text-slate-700"
          }`}
        >
          Badge text
        </button>

        <input
          type="color"
          value={
            /^#[0-9A-Fa-f]{6}$/.test(
              target === "badgeBg"
                ? badgeBg
                : badgeText
            )
              ? (
                  target ===
                  "badgeBg"
                    ? badgeBg
                    : badgeText
                )
              : "#FFFFFF"
          }
          onChange={(event) =>
            onChangeColor(
              target,
              event.target.value.toUpperCase()
            )
          }
          className="h-9 w-12 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
          title="Seleccionar color"
        />
      </div>

      {normalizedPhotoUrl ? (
        <div className="mt-3 grid gap-3 md:grid-cols-[180px_1fr]">
          <div className="flex min-h-[170px] items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-3">
            <img
              src={normalizedPhotoUrl}
              alt={`Kit ${kitNumber} preview`}
              className="max-h-[180px] w-full object-contain"
              onLoad={() =>
                setImageError(false)
              }
              onError={() =>
                setImageError(true)
              }
            />
          </div>

          <div>
            {imageError ? (
              <p className="text-xs text-red-600">
                No se pudo cargar la camiseta o el servidor no permite analizar sus colores.
              </p>
            ) : palette.length > 0 ? (
              <>
                <p className="text-[11px] font-semibold text-slate-600">
                  Colores detectados
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {palette.map(
                    (color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() =>
                          onChangeColor(
                            target,
                            color
                          )
                        }
                        title={`Asignar ${color} a ${
                          target ===
                          "badgeBg"
                            ? "Badge background"
                            : "Badge text"
                        }`}
                        className="group flex w-14 flex-col items-center gap-1 rounded-lg border border-slate-200 bg-white p-1.5 transition hover:border-[#003399]"
                      >
                        <span
                          className="h-8 w-8 rounded-md border border-slate-200"
                          style={{
                            backgroundColor:
                              color,
                          }}
                        />
                        <span className="text-[9px] font-semibold text-slate-500">
                          {color}
                        </span>
                      </button>
                    )
                  )}
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-400">
                Introduce la URL de la camiseta para detectar una paleta de colores.
              </p>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-400">
          Introduce primero la foto de la camiseta.
        </p>
      )}
    </div>
  );
}

function TeamLogo({ team }) {
  const logoUrl = normalizeImageUrl(
    team.logo ||
      team.logo_url ||
      team.logoUrl
  );

  const [imageError, setImageError] =
    useState(false);

  useEffect(() => {
    setImageError(false);
  }, [logoUrl]);

  if (logoUrl && !imageError) {
    return (
      <div className="flex h-16 w-16 shrink-0 items-center justify-center bg-transparent">
        <img
          src={logoUrl}
          alt={`${team.name} logo`}
          className="h-full w-full object-contain"
          loading="lazy"
          onError={() =>
            setImageError(true)
          }
        />
      </div>
    );
  }

  return (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
      <span className="max-w-[90%] px-1 text-center text-[10px] font-extrabold leading-tight tracking-tight text-slate-800">
        {team.shortName ||
          team.short_name ||
          "FC"}
      </span>
    </div>
  );
}

function CompetitionHeader({ competitionName, teams }) {
  const competition = competitionDetails[competitionName] || {
  level: "Competition",
  logo: "",
};

const competitionLogo =
  teams.find((team) => team.competitionLogo)?.competitionLogo ||
  competition.logo ||
  "";

  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-50 p-1">
  {competitionLogo ? (
    <img
      src={competitionLogo}
      alt={`${competitionName} logo`}
      className="h-full w-full object-contain"
    />
  ) : (
    <span className="text-[8px] font-black text-slate-700">
      FC
    </span>
  )}
</div>
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-sm font-bold text-slate-900">{competitionName || "Without competition"}</h3>
          <span className="text-xs text-slate-400">{competition.level}</span>
        </div>
      </div>
      <span className="shrink-0 text-xs font-medium text-slate-400">
        {teams.length} {teams.length === 1 ? "team" : "teams"}
      </span>
    </div>
  );
}

function TeamCard({ team, onOpen, showReputation = false, selectionMode = false, isSelected = false, disabled = false }) {
  const reputationValue = Number(team?.reputation);
  const normalizedReputation = Number.isFinite(reputationValue)
    ? reputationValue
    : 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={disabled}
      aria-pressed={selectionMode ? isSelected : undefined}
      aria-label={selectionMode ? `${isSelected ? "Deseleccionar" : "Seleccionar"} ${team.name}` : undefined}
      className={`group relative flex min-h-[100px] w-full flex-col items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2.5 text-center transition hover:-translate-y-0.5 hover:shadow-sm disabled:cursor-wait disabled:opacity-60 ${selectionMode && isSelected ? "border-blue-500 bg-blue-50 ring-2 ring-blue-300" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"}`}
    >
      {selectionMode && (
        <span className={`absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-md border text-[11px] font-black ${isSelected ? "border-[#003399] bg-[#003399] text-white" : "border-slate-300 bg-white text-transparent"}`} aria-hidden="true">✓</span>
      )}
      <TeamLogo team={team} />
      <span className="w-full truncate text-[11px] font-bold text-slate-800 transition group-hover:text-[#003399]">
        {team.name}
      </span>
      {showReputation && (
        <span className="text-[10px] font-semibold text-slate-400">
          Reputation: {normalizedReputation}
        </span>
      )}
    </button>
  );
}

function AddTeamModal({
  form,
  setForm,
  countries,
  leagues,
  onClose,
  onSubmit,
  isEditing = false,
}) {
  const [logoImageError, setLogoImageError] = useState(false);
  const [logoPalette, setLogoPalette] = useState([]);
  const [colorTarget, setColorTarget] =
    useState("primary");
  const [isLogoZoomOpen, setIsLogoZoomOpen] =
    useState(false);
  const [isCreatingNewCountry, setIsCreatingNewCountry] =
    useState(!form.countryId);
  const [isCreatingNewLeague, setIsCreatingNewLeague] =
    useState(Boolean(form.newLeagueName?.trim()));

  const logoPreviewUrl =
    normalizeImageUrl(form.logo);

  const updateField = (field, value) => {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  };

  const textField = (
    field,
    label,
    placeholder,
    options = {}
  ) => (
    <FormField
      label={label}
      hint={options.hint}
    >
      <input
        type={
          options.type || "text"
        }
        value={form[field]}
        onChange={(event) =>
          updateField(
            field,
            event.target.value
          )
        }
        placeholder={placeholder}
        className={inputClassName}
        min={options.min}
        max={options.max}
        step={options.step}
        inputMode={
          options.inputMode
        }
        required={
          Boolean(
            options.required
          )
        }
      />
    </FormField>
  );

  const selectField = (
    field,
    label,
    values
  ) => (
    <FormField
      label={label}
    >
      <select
        value={form[field]}
        onChange={(event) =>
          updateField(
            field,
            event.target.value
          )
        }
        className={
          inputClassName
        }
      >
        {values.map(
          (value) => (
            <option
              key={value}
              value={value}
            >
              {value}
            </option>
          )
        )}
      </select>
    </FormField>
  );

  const handleCountryChange =
    (selectedId) => {
      if (
        selectedId === "__new__"
      ) {
        setIsCreatingNewCountry(
          true
        );
        updateField(
          "countryId",
          ""
        );
        updateField(
          "country",
          ""
        );
        updateField(
          "countryCode",
          ""
        );
        return;
      }

      const selectedCountry =
        countries.find(
          (country) =>
            String(country.id) ===
            String(selectedId)
        );

      setIsCreatingNewCountry(
        false
      );
      updateField(
        "countryId",
        selectedId
      );
      updateField(
        "country",
        selectedCountry?.name ||
          ""
      );
      updateField(
        "countryCode",
        selectedCountry?.code ||
          ""
      );

      if (
        selectedCountry?.continent
      ) {
        updateField(
          "continent",
          selectedCountry.continent
        );
      }
    };

  const handleLeagueChange =
    (selectedId) => {
      if (
        selectedId === "__new__"
      ) {
        setIsCreatingNewLeague(
          true
        );
        updateField(
          "leagueId",
          ""
        );
        return;
      }

      setIsCreatingNewLeague(
        false
      );
      updateField(
        "leagueId",
        selectedId
      );
      updateField(
        "newLeagueName",
        ""
      );
    };

  const handleKitColorChange =
    (kitNumber, field, color) => {
      updateField(
        `kit${kitNumber}${field === "badgeBg" ? "BadgeBg" : "BadgeText"}`,
        color
      );
    };

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-team-title"
    >
      <div className="relative z-10 max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="max-h-[92vh] overflow-y-auto p-5 md:p-6">
          <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h2
              id="add-team-title"
              className="text-lg font-extrabold text-slate-900"
            >
              {isEditing ? "Edit team" : "Add team"}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {isEditing
                ? "Update the team's information."
                : "Create a complete club profile manually."}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4"
        >
          {/* 1 — IDENTITY */}
          <CollapsibleSection
            icon={Shield}
            title="Identity"
            description="The essential information that defines the club."
            defaultOpen
          >
            <div className="grid gap-4 md:grid-cols-2">
              {textField(
                "name",
                "Team name *",
                "e.g. Real Madrid",
                { required: true }
              )}

              {textField(
                "shortName",
                "Short name *",
                "e.g. RMA",
                { required: true }
              )}

              <FormField
                label="Country *"
                hint="Busca un país por nombre o código."
              >
                <SearchableTeamSelect
                  value={
                    form.countryId ||
                    "__new__"
                  }
                  onChange={
                    handleCountryChange
                  }
                  options={countries}
                  kind="country"
                  placeholder="Select country"
                  searchPlaceholder="Search country..."
                  specialOption={{
                    value: "__new__",
                    label:
                      "+ Create or enter a new country",
                  }}
                />
              </FormField>

              <div className="md:col-span-1">
                {isCreatingNewCountry && (
                  <div className="grid gap-4">
                    {textField(
                      "country",
                      "New country name *",
                      "e.g. Spain",
                      {
                        required: true,
                      }
                    )}

                    {textField(
                      "countryCode",
                      "Country code *",
                      "e.g. ESP",
                      {
                        required: true,
                        hint: "Código de 2 o 3 letras. Se utiliza al crear el país.",
                      }
                    )}
                  </div>
                )}
              </div>

              {textField(
                "city",
                "City",
                "e.g. Madrid"
              )}

              {textField(
                "foundedYear",
                "Founded year",
                "1902",
                {
                  type: "number",
                  min: 1800,
                  max: 2100,
                }
              )}

              <FormField
                label="Logo *"
                hint="El logo se usa como identidad principal del club."
              >
                <input
                  type="text"
                  value={form.logo}
                  onChange={(event) => {
                    updateField(
                      "logo",
                      event.target.value
                    );
                    setLogoImageError(false);
                    setLogoPalette([]);
                  }}
                  placeholder="https://..."
                  className={
                    inputClassName
                  }
                  required
                />
              </FormField>

              <div className="md:col-span-1">
                {logoPreviewUrl && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-4 md:flex-row">
                      <div className="relative flex min-h-[180px] w-full items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white md:w-56">
                        <img
                          src={
                            logoPreviewUrl
                          }
                          alt="Logo preview"
                          className="max-h-44 max-w-[90%] object-contain"
                          onLoad={() => {
                            setLogoImageError(
                              false
                            );

                            const paletteImage =
                              new Image();

                            paletteImage.crossOrigin =
                              "anonymous";

                            paletteImage.onload =
                              () =>
                                setLogoPalette(
                                  extractImagePalette(
                                    paletteImage
                                  )
                                );

                            paletteImage.onerror =
                              () =>
                                setLogoPalette(
                                  []
                                );

                            paletteImage.src =
                              logoPreviewUrl;
                          }}
                          onError={() => {
                            setLogoImageError(
                              true
                            );
                            setLogoPalette(
                              []
                            );
                          }}
                        />

                        <button
                          type="button"
                          onClick={() =>
                            setIsLogoZoomOpen(
                              true
                            )
                          }
                          className="absolute bottom-2 right-2 rounded-lg bg-slate-900/80 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-900"
                        >
                          Ampliar imagen
                        </button>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div>
                            <h4 className="text-xs font-extrabold uppercase tracking-wide text-slate-800">
                              Logo palette
                            </h4>
                            <p className="mt-1 text-[11px] text-slate-500">
                              Pulsa un color para asignarlo al campo seleccionado.
                            </p>
                          </div>

                          <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-slate-500">
                            {colorTarget ===
                            "primary"
                              ? "Primary"
                              : "Secondary"}
                          </span>
                        </div>

                        <div className="mb-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setColorTarget(
                                "primary"
                              )
                            }
                            className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                              colorTarget ===
                              "primary"
                                ? "bg-[#003399] text-white"
                                : "border border-slate-200 bg-white text-slate-700"
                            }`}
                          >
                            Seleccionar primario
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setColorTarget(
                                "secondary"
                              )
                            }
                            className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                              colorTarget ===
                              "secondary"
                                ? "bg-[#003399] text-white"
                                : "border border-slate-200 bg-white text-slate-700"
                            }`}
                          >
                            Seleccionar secundario
                          </button>
                        </div>

                        {logoImageError ? (
                          <p className="text-xs text-red-600">
                            No se pudo cargar la imagen. Comprueba que la URL sea pública y completa.
                          </p>
                        ) : logoPalette.length >
                          0 ? (
                          <div className="flex flex-wrap gap-2">
                            {logoPalette.map(
                              (color) => (
                                <button
                                  key={color}
                                  type="button"
                                  title={`Asignar ${color} a ${colorTarget}`}
                                  onClick={() =>
                                    updateField(
                                      colorTarget ===
                                        "primary"
                                        ? "primaryColor"
                                        : "secondaryColor",
                                      color
                                    )
                                  }
                                  className="group flex w-14 flex-col items-center gap-1 rounded-lg border border-slate-200 bg-white p-1.5 hover:border-[#003399]"
                                >
                                  <span
                                    className="h-8 w-8 rounded-md border border-slate-200"
                                    style={{
                                      backgroundColor:
                                        color,
                                    }}
                                  />
                                  <span className="text-[9px] font-semibold text-slate-500">
                                    {color}
                                  </span>
                                </button>
                              )
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400">
                            Introduce una imagen compatible para detectar colores.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="md:col-span-2">
                <p className="text-[11px] text-slate-400">
                  El continente se completa automáticamente al seleccionar un país.
                </p>
              </div>
            </div>
          </CollapsibleSection>

          {/* 2 — COMPETITION */}
          <CollapsibleSection
            icon={Globe}
            title="Competition"
            description="League and current competition."
            defaultOpen
          >
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                label="League"
                hint="Busca una liga por nombre o abreviatura."
              >
                <SearchableTeamSelect
                  value={
                    isCreatingNewLeague
                      ? "__new__"
                      : form.leagueId
                  }
                  onChange={
                    handleLeagueChange
                  }
                  options={leagues}
                  kind="league"
                  placeholder="Without league"
                  searchPlaceholder="Search league..."
                  emptyOption={{
                    value: "",
                    label: "Without league",
                  }}
                  specialOption={{
                    value: "__new__",
                    label:
                      "+ Create new league",
                  }}
                />
              </FormField>

              {isCreatingNewLeague && (
                <FormField
                  label="New league name *"
                  hint="Se intentará crearla si no existe."
                >
                  <input
                    type="text"
                    value={
                      form.newLeagueName
                    }
                    onChange={(event) =>
                      updateField(
                        "newLeagueName",
                        event.target.value
                      )
                    }
                    placeholder="e.g. LaLiga EA Sports"
                    className={
                      inputClassName
                    }
                    required
                  />
                </FormField>
              )}
            </div>
          </CollapsibleSection>

          {/* 3 — CLASSIFICATION */}
          <CollapsibleSection
            icon={TrendingUp}
            title="Classification"
            description="Club colors, reputation and market."
            defaultOpen
          >
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                label="Primary color"
                hint="HEX seleccionado desde la paleta o introducido manualmente."
              >
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={
                      /^#[0-9A-Fa-f]{6}$/.test(
                        form.primaryColor
                      )
                        ? form.primaryColor
                        : "#FFFFFF"
                    }
                    onChange={(event) =>
                      updateField(
                        "primaryColor",
                        event.target.value.toUpperCase()
                      )
                    }
                    className="h-10 w-12 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
                  />

                  <input
                    type="text"
                    value={form.primaryColor}
                    onChange={(event) =>
                      updateField(
                        "primaryColor",
                        event.target.value.toUpperCase()
                      )
                    }
                    placeholder="#FFFFFF"
                    className={
                      inputClassName
                    }
                  />
                </div>
              </FormField>

              <FormField
                label="Secondary color"
                hint="HEX seleccionado desde la paleta o introducido manualmente."
              >
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={
                      /^#[0-9A-Fa-f]{6}$/.test(
                        form.secondaryColor
                      )
                        ? form.secondaryColor
                        : "#000000"
                    }
                    onChange={(event) =>
                      updateField(
                        "secondaryColor",
                        event.target.value.toUpperCase()
                      )
                    }
                    className="h-10 w-12 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
                  />

                  <input
                    type="text"
                    value={
                      form.secondaryColor
                    }
                    onChange={(event) =>
                      updateField(
                        "secondaryColor",
                        event.target.value.toUpperCase()
                      )
                    }
                    placeholder="#000000"
                    className={
                      inputClassName
                    }
                  />
                </div>
              </FormField>

              {textField(
                "reputation",
                "Reputation (0-10000)",
                "9500",
                {
                  type: "number",
                  min: 0,
                  max: 10000,
                  step: 1,
                }
              )}

              <FormField
                label="Market value (€)"
                hint="Introduce el valor en euros. Se guardará y mostrará como 230,975,207 (€)."
              >
                <input
                  type="text"
                  value={form.market}
                  onChange={(event) =>
                    updateField(
                      "market",
                      cleanMarketInput(event.target.value)
                    )
                  }
                  onBlur={() =>
                    updateField(
                      "market",
                      formatMarketValue(form.market, "")
                    )
                  }
                  placeholder="230,975,207 (€)"
                  className={inputClassName}
                  inputMode="numeric"
                />
              </FormField>
            </div>
          </CollapsibleSection>

          {/* 4 — STADIUM */}
          <CollapsibleSection
            icon={Building2}
            title="Stadium"
            description="Stadium information and images."
          >
            <div className="grid gap-4 md:grid-cols-2">
              {textField(
                "stadium",
                "Stadium name",
                "e.g. Santiago Bernabéu"
              )}

              {textField(
                "stadiumId",
                "Stadium ID",
                "Internal Stadium record ID"
              )}

              {textField(
                "stadiumCapacity",
                "Capacity",
                "81000",
                {
                  type: "number",
                  min: 0,
                }
              )}

              {textField(
                "stadiumBuiltYear",
                "Built year",
                "1947",
                {
                  type: "number",
                  min: 1800,
                  max: 2100,
                }
              )}

              {textField(
                "stadiumRenovation",
                "Last renovation year",
                "2024",
                {
                  type: "number",
                  min: 1800,
                  max: 2100,
                }
              )}

              {textField(
                "pitchDimensions",
                "Pitch dimensions",
                "105 x 68 m"
              )}

              {textField(
                "stadiumInteriorUrl",
                "Interior image URL",
                "https://..."
              )}

              {textField(
                "stadiumExteriorUrl",
                "Exterior image URL",
                "https://..."
              )}
            </div>
          </CollapsibleSection>

          {/* 5 — STAFF */}
          <CollapsibleSection
            icon={Users}
            title="Staff & key players"
            description="Current personnel. Leave fields blank when unknown."
          >
            <div className="grid gap-4 md:grid-cols-2">
              {textField(
                "coachName",
                "Coach name",
                "e.g. Coach name"
              )}

              {textField(
                "coachPhotoUrl",
                "Coach photo URL",
                "https://..."
              )}

              {textField(
                "captainName",
                "Captain name",
                "e.g. Captain name"
              )}

              {textField(
                "captainPhotoUrl",
                "Captain photo URL",
                "https://..."
              )}

              {textField(
                "secondCaptainName",
                "Second captain",
                "e.g. Second captain"
              )}

              {textField(
                "secondCaptainPhotoUrl",
                "Second captain photo URL",
                "https://..."
              )}

              {textField(
                "keyPlayerName",
                "Key player",
                "e.g. Player name"
              )}

              {textField(
                "keyPlayerPhotoUrl",
                "Key player photo URL",
                "https://..."
              )}
            </div>
          </CollapsibleSection>

          {/* 6 — KITS */}
          <CollapsibleSection
            icon={Shirt}
            title="Kits"
            description="Home, away and third kit information."
          >
            <div className="space-y-5">
              {[1, 2, 3].map(
                (kitNumber) => (
                  <div
                    key={kitNumber}
                    className="rounded-xl border border-slate-200 bg-slate-50/60 p-4"
                  >
                    <div className="mb-3">
                      <h4 className="text-xs font-extrabold uppercase tracking-wide text-slate-700">
                        {kitNumber === 1
                          ? "First kit"
                          : kitNumber === 2
                            ? "Second kit"
                            : "Third kit"}
                      </h4>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      {textField(
                        `kit${kitNumber}PhotoUrl`,
                        "Photo URL",
                        "https://..."
                      )}

                      {textField(
                        `kit${kitNumber}ShopUrl`,
                        "Shop URL",
                        "https://..."
                      )}
                    </div>

                    <KitColorPicker
                      kitNumber={
                        kitNumber
                      }
                      photoUrl={
                        form[
                          `kit${kitNumber}PhotoUrl`
                        ]
                      }
                      badgeBg={
                        form[
                          `kit${kitNumber}BadgeBg`
                        ]
                      }
                      badgeText={
                        form[
                          `kit${kitNumber}BadgeText`
                        ]
                      }
                      onChangeColor={(
                        field,
                        color
                      ) =>
                        handleKitColorChange(
                          kitNumber,
                          field,
                          color
                        )
                      }
                    />
                  </div>
                )
              )}

              <FormField
                label="Kits overview image"
                hint="Imagen general opcional de las equipaciones."
              >
                <input
                  type="text"
                  value={
                    form.kitsOverviewUrl
                  }
                  onChange={(event) =>
                    updateField(
                      "kitsOverviewUrl",
                      event.target.value
                    )
                  }
                  placeholder="https://..."
                  className={
                    inputClassName
                  }
                />
              </FormField>
            </div>
          </CollapsibleSection>

          {/* 7 — LEGACY / STATUS */}
          <CollapsibleSection
            icon={Database}
            title="Legacy & status"
            description="History, metadata and completion state."
          >
            <div className="space-y-4">
              <FormField label="Club history">
                <textarea
                  value={form.history}
                  onChange={(event) =>
                    updateField(
                      "history",
                      event.target.value
                    )
                  }
                  placeholder="Write the club history here..."
                  className={
                    textareaClassName
                  }
                />
              </FormField>

              <div className="grid gap-4 md:grid-cols-2">
                {selectField(
                  "dataSource",
                  "Data source",
                  ["Manual", "Other"]
                )}

                <FormField label="Active club">
                  <label className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={
                        form.isActive
                      }
                      onChange={(event) =>
                        updateField(
                          "isActive",
                          event.target.checked
                        )
                      }
                    />
                    Team is active
                  </label>
                </FormField>
              </div>
            </div>
          </CollapsibleSection>

          {isLogoZoomOpen &&
            logoPreviewUrl && (
              <div
                className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 p-5"
                role="dialog"
                aria-modal="true"
                aria-label="Expanded logo preview"
              >
                <button
                  type="button"
                  onClick={() =>
                    setIsLogoZoomOpen(
                      false
                    )
                  }
                  className="absolute right-5 top-5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-800"
                >
                  Cerrar
                </button>

                <img
                  src={logoPreviewUrl}
                  alt="Expanded logo preview"
                  className="max-h-[85vh] max-w-[90vw] object-contain"
                />
              </div>
            )}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-5">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="flex h-10 items-center gap-2 rounded-xl bg-[#003399] px-4 text-xs font-semibold text-white transition hover:bg-[#002477]"
            >
              {isEditing ? (
                <Save size={15} />
              ) : (
                <Plus size={15} />
              )}
              {isEditing ? "Save changes" : "Add team"}
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(
        modalContent,
        document.body
      )
    : null;
}


function cleanJsonInput(value) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function importedValue(value) {
  return value === null || value === undefined ? "" : String(value);
}

function numericValue(value, fallback = "0") {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  const normalized = String(value).trim().toLowerCase();
  const categoryMap = { elite: "9500", high: "8000", medium: "6000", low: "3500", unclassified: "0" };
  if (categoryMap[normalized]) return categoryMap[normalized];
  const digits = normalized.replace(/[^0-9.-]/g, "");
  return digits && Number.isFinite(Number(digits)) ? digits : fallback;
}

function formatMarketValue(value, fallback = "") {
  if (value === null || value === undefined || value === "") return fallback;

  const normalized = String(value).trim();
  if (!normalized) return fallback;

  const digits = normalized.replace(/\D/g, "");
  if (!digits) return fallback;

  const numeric = digits.replace(/^0+(?=\d)/, "");
  const grouped = numeric.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return `${grouped} (€)`;
}

function cleanMarketInput(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";

  const numeric = digits.replace(/^0+(?=\d)/, "");
  return numeric.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function mapImportedTeamToForm(data) {
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

function mapTeamToForm(team) {
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

    secondCaptainName:
      team.second_captain_name || team.secondCaptainName || "",
    secondCaptainPhotoUrl:
      team.second_captain_photo_url || team.secondCaptainPhotoUrl || "",

    keyPlayerName: team.key_player_name || team.keyPlayerName || "",
    keyPlayerPhotoUrl:
      team.key_player_photo_url || team.keyPlayerPhotoUrl || "",

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

function extractJsonFromText(value) {
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

function parseLabeledTeamText(text) {
  const result = {};
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  const aliases = {
    "nombre": "name",
    "nombre oficial": "name",
    "team name": "name",
    "club": "name",
    "nombre corto": "short_name",
    "short name": "short_name",
    "abreviatura": "short_name",
    "país": "country",
    "pais": "country",
    "country": "country",
    "código": "country_code",
    "codigo": "country_code",
    "country code": "country_code",
    "continente": "continent",
    "continent": "continent",
    "ciudad": "city",
    "city": "city",
    "escudo": "logo",
    "logo": "logo",
    "logo url": "logo",
    "año de fundación": "founded_year",
    "ano de fundacion": "founded_year",
    "founded year": "founded_year",
    "estadio": "stadium",
    "stadium": "stadium",
    "capacidad": "stadium_capacity",
    "stadium capacity": "stadium_capacity",
    "entrenador": "coach_name",
    "coach": "coach_name",
    "capitán": "captain_name",
    "capitan": "captain_name",
    "captain": "captain_name",
    "historia": "history",
    "history": "history",
    "reputación": "reputation",
    "reputacion": "reputation",
    "reputation": "reputation",
    "mercado": "market",
    "market": "market"
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

function normalizeImportedTeamText(value) {
  const jsonCandidate = extractJsonFromText(value);

  if (jsonCandidate) {
    try {
      const parsed = JSON.parse(jsonCandidate);
      if (parsed && !Array.isArray(parsed) && typeof parsed === "object") return parsed;
    } catch {
      // If the content is not valid JSON, try the simple labelled-text parser below.
    }
  }

  return parseLabeledTeamText(value);
}

function ImportTeamJsonModal({ onClose, onImport }) {
  const [mode, setMode] = useState("text");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");

  const handleImport = (event) => {
    event.preventDefault();
    setError("");

    const parsed = normalizeImportedTeamText(content);

    if (!parsed || (!parsed.name && !parsed.short_name)) {
      setError(
        mode === "text"
          ? "No se han identificado datos suficientes. Pega el JSON completo generado por el prompt o utiliza líneas con formato Campo: valor."
          : "El contenido debe ser un objeto JSON válido con al menos name o short_name."
      );
      return;
    }

    onImport(mapImportedTeamToForm(parsed));
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="import-team-json-title">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl md:p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id="import-team-json-title" className="text-lg font-extrabold text-slate-900">Añadir equipo mediante información</h2>
            <p className="mt-1 text-xs text-slate-500">Pega el resultado completo del prompt y carga los datos en el editor.</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800" aria-label="Close import dialog">
            <X size={18} />
          </button>
        </div>

        <div className="mb-4 flex gap-2">
          <button type="button" onClick={() => { setMode("text"); setError(""); }} className={`rounded-lg border px-4 py-2 text-xs font-semibold transition ${mode === "text" ? "border-[#073B35] bg-[#003399] text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
            Pegar texto
          </button>
          <button type="button" onClick={() => { setMode("json"); setError(""); }} className={`rounded-lg border px-4 py-2 text-xs font-semibold transition ${mode === "json" ? "border-[#073B35] bg-[#003399] text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
            JSON
          </button>
        </div>

        <form onSubmit={handleImport} className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            {mode === "text"
              ? "Pega aquí toda la información del club. Se aceptan el JSON del prompt, bloques JSON con formato Markdown o líneas como Nombre: Real Madrid."
              : "Pega el objeto JSON completo generado por el prompt. También se aceptan bloques con formato ```json ... ```."}
          </div>
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder={mode === "text" ? "Pega aquí toda la información del equipo..." : '{\n  "name": "Real Madrid",\n  "short_name": "RMA",\n  "country": "Spain"\n}'}
            className={`${textareaClassName} min-h-[320px] font-mono text-xs`}
            autoFocus
            required
          />
          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" onClick={onClose} className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">Cancelar</button>
            <button type="submit" className="flex h-10 items-center gap-2 rounded-xl bg-[#003399] px-4 text-xs font-semibold text-white transition hover:bg-[#002477]">
              <ClipboardPaste size={15} />
              Detectar información
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}



function TeamDetail({
  team,
  onClose,
  onEdit,
  form,
  setForm,
  countries,
  leagues,
  onCloseEdit,
  onSubmit,
}) {
  const [editPanelOpen, setEditPanelOpen] = useState(false);
  const [isPageTransitioning, setIsPageTransitioning] = useState(false);
  const detailScrollRef = useRef(null);
  const transitionTimeoutRef = useRef(null);

  useLayoutEffect(() => {
    const container =
      detailScrollRef.current;

    if (!container) return;

    const resetScroll = () => {
      container.scrollTop = 0;
      container.scrollLeft = 0;

      let parent = container.parentElement;

      while (parent) {
        parent.scrollTop = 0;
        parent.scrollLeft = 0;
        parent = parent.parentElement;
      }

      window.scrollTo({
        top: 0,
        left: 0,
        behavior: "auto",
      });
    };

    resetScroll();

    const frame = window.requestAnimationFrame(
      resetScroll
    );

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [team?.id]);

  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current) {
        window.clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, []);

  const goToSection = (sectionIndex) => {
    const container = detailScrollRef.current;
    if (!container || isPageTransitioning) return;

    const sections = Array.from(
      container.querySelectorAll("[data-scroll-section]")
    );
    const targetSection = sections[sectionIndex];

    if (!targetSection) return;

    setIsPageTransitioning(true);

    const containerRect = container.getBoundingClientRect();
    const targetRect = targetSection.getBoundingClientRect();
    const targetTop =
      container.scrollTop + (targetRect.top - containerRect.top);

    container.scrollTo({
      top: targetTop,
      behavior: "smooth",
    });

    transitionTimeoutRef.current = window.setTimeout(() => {
      setIsPageTransitioning(false);
    }, 900);
  };

  const primaryColor =
    team.primaryColor ||
    team.primary_color ||
    "#063B78";

  const secondaryColor =
    team.secondaryColor ||
    team.secondary_color ||
    "#941638";

  const foundedYear =
    team.foundedYear ||
    team.founded_year ||
    team.yearFounded ||
    "";

  const city = team.city || "";
  const country = team.country || "";
  const marketDisplay = formatMarketValue(team.market, "");
  const teamName = team.name || "Equipo";
  const shortName = team.shortName || team.short_name || "";

  // Información adicional del equipo
  const stadium =
    team.stadium ||
    team.stadium_name ||
    team.stadiumName ||
    "";

  const stadiumCapacity =
    team.stadiumCapacity ||
    team.stadium_capacity ||
    team.capacity ||
    "";

  const ranking =
    team.ranking ||
    team.worldRanking ||
    team.world_ranking ||
    "";

// Imagen de la camiseta
const kitHomeUrl = normalizeImageUrl(
  team.kit1_photo_url ||
    team.kit1PhotoUrl ||
    team.kit_home_url ||
    team.kitHomeUrl ||
    team.home_kit_url ||
    team.homeKitUrl ||
    team.kit_url ||
    team.kits?.kit1?.photo_url ||
    ""
);

const kitsOverviewUrl = normalizeImageUrl(
  team.kits_overview_url ||
    team.kitsOverviewUrl ||
    team.kits_image_url ||
    team.kitsImageUrl ||
    ""
);

  // Gráficos geográficos superpuestos: mapa del país + mapa con el escudo
  const countryMapUrl = normalizeImageUrl(
    team.country_map_url ||
      team.countryMapUrl ||
      ""
  );

  const countryTeamMapUrl =
    normalizeImageUrl(
      team.country_team_map_url ||
        team.countryTeamMapUrl ||
        ""
    );

  const displayName = teamName.toUpperCase();

  return (
    <div
      ref={detailScrollRef}
      className="relative h-[calc(100vh-4rem)] overflow-y-auto overscroll-none p-3 sm:p-4 md:p-6 [&::-webkit-scrollbar]:hidden"
      style={{
        backgroundColor: primaryColor,
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      }}
    >
      {/* FONDO SECUNDARIO DIAGONAL */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundColor: secondaryColor,
          clipPath:
            "polygon(60% 0, 100% 0, 100% 100%, 42% 100%)",
        }}
      />

      {/* DEGRADADO DE PROFUNDIDAD */}
      <div
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{
          background: `linear-gradient(135deg, ${primaryColor} 0%, transparent 45%, ${secondaryColor} 100%)`,
        }}
      />

      {/* CONTENEDOR PRINCIPAL */}
      <div className="relative z-10">
        <div
          data-scroll-section
          className="relative min-h-full overflow-hidden rounded-2xl border border-white/20 bg-black/10 shadow-2xl"
        >
          {/* GRÁFICO GEOGRÁFICO: MISMA POSICIÓN, TAMAÑO Y PROPORCIÓN */}
          {countryMapUrl && (
            <img
              src={countryMapUrl}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute bottom-[150px] right-4 z-0 h-[70%] w-auto max-w-[55%] object-contain opacity-35 grayscale"
            />
          )}
          {countryTeamMapUrl && (
            <img
              src={countryTeamMapUrl}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute bottom-[150px] right-4 z-0 h-[70%] w-auto max-w-[55%] object-contain"
            />
          )}

          {/* CABECERA INTEGRADA */}
          <div className="relative z-30 flex items-center justify-between gap-4 px-5 pt-5 md:px-8 md:pt-7">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/40 bg-black/10 px-4 py-2 text-[11px] font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
            >
              ← Volver a equipos
            </button>

            <button
  type="button"
  onClick={() => {
  setEditPanelOpen(true);
  onEdit(team);
}}
  className="cursor-pointer rounded-sm text-[10px] font-bold uppercase tracking-[0.3em] text-white/75 transition hover:text-white focus:outline-none focus:ring-1 focus:ring-white/60"
>
  Team profile
</button>
          </div>

          {/* COMPOSICIÓN PRINCIPAL */}
<div className="relative z-10 grid min-h-[720px] grid-cols-1 md:grid-cols-[55%_45%]">
            {/* LADO IZQUIERDO */}
            <div className="relative flex flex-col justify-between p-6 pt-14 sm:p-8 sm:pt-16 md:p-12 md:pt-20">
              {/* LEMA */}
              <div>
                <div className="mb-8 flex items-center gap-3">
                  <div className="flex gap-2">
                    <span
                      className="h-1 w-9"
                      style={{
                        backgroundColor: primaryColor,
                      }}
                    />

                    <span
                      className="h-1 w-9"
                      style={{
                        backgroundColor: secondaryColor,
                      }}
                    />
                  </div>

                  <span className="team-section-label text-[10px] text-white/80 sm:text-xs">
                    Más que un club
                  </span>
                </div>

                {/* CIUDAD / IDENTIFICADOR */}
                <p className="team-section-label mb-4 text-xs text-white/65">
                  {city || shortName || "Football Club"}
                </p>

                {/* NOMBRE PRINCIPAL */}
<h1 className="team-display-title max-w-none text-5xl text-white sm:text-7xl md:text-[8rem]">
  {displayName.split(" ").map((word, index) => (
    <span key={index} className="block">
      {word}
    </span>
  ))}
</h1>

                <p className="team-section-label mt-7 text-[9px] text-white/65 sm:text-xs">
                  MF LEGACY · TEAM PROFILE
                </p>
              </div>

              {/* DATOS BÁSICOS */}
              <div className="relative z-20 mt-14 md:mt-8">
                <div className="grid grid-cols-2 gap-x-5 gap-y-7 md:grid-cols-3">
                  <div>
                    <p className="team-section-label text-[9px] text-white/55">
                      Año de fundación
                    </p>

                    <p className="team-data-value mt-2 text-xl text-white">
                      {foundedYear || "—"}
                    </p>
                  </div>

                  <div>
                    <p className="team-section-label text-[9px] text-white/55">
                      País
                    </p>

                    <p className="team-data-value mt-2 text-xl text-white">
                      {country || "—"}
                    </p>
                  </div>

                  <div>
                    <p className="team-section-label text-[9px] text-white/55">
                      Market value
                    </p>

                    <p className="team-data-value mt-2 text-xl text-white">
                      {marketDisplay || "—"}
                    </p>
                  </div>

                  <div>
                    <p className="team-section-label text-[9px] text-white/55">
                      Ciudad
                    </p>

                    <p className="team-data-value mt-2 text-xl text-white">
                      {city || "—"}
                    </p>
                  </div>
                </div>

                {/* INFORMACIÓN DEPORTIVA */}
                {(stadium || stadiumCapacity || ranking) && (
                  <div className="mt-8 grid grid-cols-2 gap-5 border-t border-white/20 pt-5">
                    {(ranking || ranking === 0) && (
                      <div>
                        <p className="team-section-label text-[9px] text-white/55">
                          Ranking
                        </p>

                        <p className="team-data-value mt-2 text-lg text-white">
                          {ranking}
                        </p>
                      </div>
                    )}

                    {stadium && (
                      <div>
                        <p className="team-section-label text-[9px] text-white/55">
                          Estadio
                        </p>

                        <p className="team-data-value mt-2 text-sm text-white">
                          {stadium}
                        </p>

                        {stadiumCapacity && (
                          <p className="mt-1 text-xs text-white/60">
                            Capacidad {stadiumCapacity}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* AÑO DE FUNDACIÓN DECORATIVO */}
              <div className="pointer-events-none absolute bottom-[-10px] left-5 select-none overflow-hidden md:left-10">
                <span className="text-[110px] font-black leading-none text-white/[0.07] sm:text-[150px] md:text-[190px]">
                  {foundedYear || "FC"}
                </span>
              </div>
            </div>

            {/* LADO DERECHO */}
<div className="relative flex min-h-[450px] flex-col items-center justify-center p-6 pt-20 sm:p-10 md:absolute md:inset-0 md:z-20 md:min-h-0 md:p-0">
              {/* ETIQUETA DE IDENTIDAD */}
              <div className="absolute right-6 top-12 text-right sm:right-10 md:right-12">
                <p className="team-section-label text-[10px] text-white/80 sm:text-xs">
                  Identity
                </p>

                <div className="ml-auto mt-3 flex gap-2">
                  <span
                    className="h-1 w-7"
                    style={{
                      backgroundColor: primaryColor,
                    }}
                  />

                  <span
                    className="h-1 w-7"
                    style={{
                      backgroundColor: secondaryColor,
                    }}
                  />
                </div>
              </div>

              {/* CAMISETA PRINCIPAL */}
              {kitHomeUrl && (
                <div className="relative z-10 flex w-full items-center justify-center px-4 py-6 md:absolute md:left-1/2 md:top-1/2 md:w-[68%] md:-translate-x-1/2 md:-translate-y-1/2 md:px-0">
                  <img
  src={kitHomeUrl}
  alt={`${teamName} primera equipación`}
  className="max-h-[520px] w-full max-w-[520px] object-contain drop-shadow-[0_25px_35px_rgba(0,0,0,0.45)] transition-transform duration-500 hover:scale-105 sm:max-h-[560px] sm:max-w-[560px] md:max-h-[650px] md:max-w-[620px]"
/>
                </div>
              )}

              {/* NAVEGACIÓN A LA SIGUIENTE PÁGINA */}
              <button
                type="button"
                onClick={() => goToSection(1)}
                disabled={isPageTransitioning}
                aria-label="Ir a History"
                className={`group absolute bottom-8 right-6 flex items-center gap-3 text-right transition-all duration-500 sm:right-10 md:right-12 ${
                  isPageTransitioning
                    ? "translate-x-2 opacity-50"
                    : "hover:-translate-x-1"
                }`}
              >
                <span className="flex flex-col">
                  <span className="team-section-label text-[9px] text-white/70 transition-colors duration-300 group-hover:text-white">
                    Tradition
                  </span>

                  <span className="team-section-label text-[9px] text-white/70 transition-colors duration-300 group-hover:text-white">
                    Identity
                  </span>

                  <span className="team-section-label text-[9px] text-white/70 transition-colors duration-300 group-hover:text-white">
                    Legacy
                  </span>

                  <span className="mt-2 text-[8px] uppercase tracking-[0.25em] text-white/45 transition-colors duration-300 group-hover:text-white/80">
                    Enter history →
                  </span>
                </span>

                <span className="flex h-16 w-1 flex-col">
                  <div
                    className="h-1/2"
                    style={{
                      backgroundColor: primaryColor,
                    }}
                  />

                  <div
                    className="h-1/2"
                    style={{
                      backgroundColor: secondaryColor,
                    }}
                  />
                </span>
              </button>
            </div>
          </div>

          {/* LÍNEA INFERIOR DE COLOR */}
          <div className="absolute bottom-0 left-0 right-0 z-30 flex h-1">
            <div
              className="w-1/2"
              style={{
                backgroundColor: primaryColor,
              }}
            />

            <div
              className="w-1/2"
              style={{
                backgroundColor: secondaryColor,
              }}
            />
                    </div>

          {editPanelOpen && (
            <AddTeamModal
              form={form}
              setForm={setForm}
              countries={countries}
              leagues={leagues}
              isEditing
              onClose={() => {
                setEditPanelOpen(false);
                onCloseEdit();
              }}
              onSubmit={async (event) => {
                const saved = await onSubmit(event);
                if (saved) {
                  setEditPanelOpen(false);
                }
              }}
            />
          )}
        </div>

        {/* SECCIÓN 2: HISTORIA DEL CLUB */}
        <section
          data-scroll-section
          className="relative mt-6 min-h-[100vh] rounded-2xl border border-white/20 bg-black/10 p-6 shadow-2xl md:p-12"
        >
          <div className="mx-auto grid min-h-[80vh] max-w-6xl items-center gap-10 md:grid-cols-[1fr_1fr]">
            <div>
              <p className="team-section-label text-xs uppercase tracking-[0.3em] text-white/70">MF LEGACY · CLUB HISTORY</p>
              <h2 className="mt-4 text-5xl font-black uppercase text-white md:text-8xl">History</h2>
              <div className="mt-10 max-w-3xl border-l-2 border-white/30 pl-5">
                <p className="text-sm leading-7 text-white/80 md:text-base">
                  {team.history || "Añade la historia del club desde Team profile para mostrarla aquí."}
                </p>
              </div>
            </div>
            <div className="relative flex min-h-[360px] items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/10 p-5 md:min-h-[520px]">
              {kitsOverviewUrl || kitHomeUrl ? (
                <>
                  <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10 blur-3xl md:h-[420px] md:w-[420px]" />
                  <img
                    src={kitsOverviewUrl || kitHomeUrl}
                    alt={kitsOverviewUrl ? `${teamName} tres equipaciones` : `${teamName} camiseta local`}
                    className="relative z-10 mx-auto h-auto max-h-[460px] w-full object-contain drop-shadow-[0_25px_30px_rgba(0,0,0,0.45)] transition-transform duration-500 hover:scale-[1.04]"
                  />
                </>
              ) : (
                <p className="text-center text-xs uppercase tracking-[0.3em] text-white/60">
                  Añade la imagen de las tres equipaciones
                </p>
              )}
            </div>
          </div>

          {/* NAVEGACIÓN A LA PÁGINA PRINCIPAL */}
          <button
            type="button"
            onClick={() => goToSection(0)}
            disabled={isPageTransitioning}
            aria-label="Volver a la página principal"
            className={`group absolute bottom-8 right-6 flex items-center gap-3 text-right transition-all duration-500 sm:right-10 md:right-12 ${
              isPageTransitioning
                ? "translate-x-2 opacity-50"
                : "hover:-translate-x-1"
            }`}
          >
            <span className="flex flex-col">
              <span className="team-section-label text-[9px] text-white/70 transition-colors duration-300 group-hover:text-white">
                Tradition
              </span>

              <span className="team-section-label text-[9px] text-white/70 transition-colors duration-300 group-hover:text-white">
                Identity
              </span>

              <span className="team-section-label text-[9px] text-white/70 transition-colors duration-300 group-hover:text-white">
                Legacy
              </span>

              <span className="mt-2 text-[8px] uppercase tracking-[0.25em] text-white/45 transition-colors duration-300 group-hover:text-white/80">
                Back to identity ←
              </span>
            </span>

            <span className="flex h-16 w-1 flex-col">
              <div
                className="h-1/2"
                style={{
                  backgroundColor: primaryColor,
                }}
              />

              <div
                className="h-1/2"
                style={{
                  backgroundColor: secondaryColor,
                }}
              />
            </span>
          </button>
        </section>

        {/* SECCIÓN 3: ESTADIO Y PERSONAL */}
        <section
          data-scroll-section
          className="mt-6 min-h-[100vh] rounded-2xl border border-white/20 bg-black/10 p-6 shadow-2xl md:p-12"
        >
          <div className="mx-auto grid min-h-[80vh] max-w-6xl items-center gap-10 md:grid-cols-2">
            <div>
              <p className="team-section-label text-xs uppercase tracking-[0.3em] text-white/70">MF LEGACY · CLUB DATA</p>
              <h2 className="mt-4 text-5xl font-black uppercase text-white md:text-7xl">Stadium</h2>
              <p className="mt-6 text-sm leading-7 text-white/80 md:text-base">
                {stadium || "Estadio no disponible"}
              </p>
              {stadiumCapacity && (
                <p className="mt-2 text-sm text-white/60">Capacidad: {stadiumCapacity}</p>
              )}
            </div>
            <div className="overflow-hidden rounded-2xl border border-white/20 bg-black/20">
              {team.stadium_exterior_url || team.stadiumExteriorUrl ? (
                <img
                  src={team.stadium_exterior_url || team.stadiumExteriorUrl}
                  alt={`${teamName} estadio`}
                  className="h-full max-h-[520px] w-full object-cover"
                />
              ) : (
                <div className="flex min-h-[300px] items-center justify-center p-6 text-center text-xs uppercase tracking-[0.25em] text-white/50">
                  Añade una imagen exterior del estadio
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
export default function Teams() {

  const [teams, setTeams] = useState([]);
  const [unattachedPlayers, setUnattachedPlayers] = useState([]);
  const [unattachedError, setUnattachedError] = useState("");
  const [unattachedTab, setUnattachedTab] = useState("free_agent");
  const [isLoading, setIsLoading] = useState(true);
  const [countries, setCountries] = useState([]);
  const [leagues, setLeagues] = useState([]);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("countries");
  const [searchOpen, setSearchOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [importJsonModalOpen, setImportJsonModalOpen] = useState(false);
  const [form, setForm] = useState(emptyTeamForm);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [editingTeam, setEditingTeam] = useState(null);
  const [bulkTeamsMode, setBulkTeamsMode] = useState(false);
  const [bulkTeamIds, setBulkTeamIds] = useState([]);
  const [bulkTeamsConfirmOpen, setBulkTeamsConfirmOpen] = useState(false);
  const [bulkTeamsBusy, setBulkTeamsBusy] = useState(false);
  const [bulkTeamsMessage, setBulkTeamsMessage] = useState("");

  useEffect(() => {
    if (activeFilter !== "unattached") return;
    let cancelled = false;
    base44.entities.Player.list().then(result => {
      if (cancelled) return;
      const rows = Array.isArray(result) ? result : (result?.data || result?.items || []);
      setUnattachedPlayers(rows.filter(p => ["free_agent", "retired"].includes(p.career_status) || (!p.team_id && !p.teamId)));
      setUnattachedError("");
    }).catch(err => { if (!cancelled) setUnattachedError(err?.message || "No se pudieron cargar los jugadores"); });
    return () => { cancelled = true; };
  }, [activeFilter]);

  const handleOpenAddTeam = () => {
    setEditingTeam(null);
    setForm({ ...emptyTeamForm });
    setAddModalOpen(true);
  };

  useEffect(() => {
  if (editingTeam) {
    setForm(mapTeamToForm(editingTeam));
  }
}, [editingTeam]);

  const {
    setTeamTheme,
    setSidebarVisible,
  } = useOutletContext() || {};

  useEffect(() => {
    if (!setTeamTheme) return;

    if (!selectedTeam) {
      setTeamTheme({
        primaryColor: "#003399",
        secondaryColor: "#FFFFFF",
      });

      if (setSidebarVisible) {
        setSidebarVisible(true);
      }

      return;
    }

  const primaryColor =
    selectedTeam.primaryColor ||
    selectedTeam.primary_color ||
    "#063B78";

  const secondaryColor =
    selectedTeam.secondaryColor ||
    selectedTeam.secondary_color ||
    "#941638";

  setTeamTheme({
    primaryColor,
    secondaryColor,
  });
}, [selectedTeam, setTeamTheme]);

  useEffect(() => {
    let cancelled = false;

    const getList = (result) => {
      if (Array.isArray(result)) return result;
      if (Array.isArray(result?.data)) return result.data;
      if (Array.isArray(result?.items)) return result.items;
      if (Array.isArray(result?.results)) return result.results;
      return [];
    };

    const normalizeCountry = (country) => ({
      ...country,
      id: country?.id || country?._id || country?.data?.id || "",
      name: country?.name || "",
      code: country?.code || country?.country_code || "",
      continent: country?.continent || "",
    });

    const normalizeLeague = (league) => ({
      ...league,
      id: league?.id || league?._id || league?.data?.id || "",
      name: league?.name || "",
      shortName: league?.short_name || league?.shortName || "",
      countryId: league?.country_id || league?.countryId || "",
      level: league?.level ?? league?.league_level ?? "",
      reputation: league?.reputation ?? league?.league_reputation ?? 0,
      logo: league?.logo || league?.logo_url || "",
      isActive: league?.is_active ?? league?.isActive ?? true,
    });

    const loadCountries = async () => {
      try {
        const result = await base44.entities.Country.list();
        const loadedCountries = getList(result).map(normalizeCountry);
        if (!cancelled) setCountries(loadedCountries);
        return loadedCountries;
      } catch (error) {
        console.error("Error loading countries:", error);
        return [];
      }
    };

    const loadLeagues = async () => {
      try {
        const result = await base44.entities.League.list();
        const loadedLeagues = getList(result).map(normalizeLeague).filter((league) => league.id && league.name && league.isActive !== false);
        if (!cancelled) setLeagues(loadedLeagues);
        return loadedLeagues;
      } catch (error) {
        console.error("Error loading leagues:", error);
        return [];
      }
    };

    const loadTeams = async (
  loadedCountries = [],
  loadedLeagues = []
) => {
  setIsLoading(true);

  try {
    const result = await base44.entities.Team.list();
    const loadedTeams = getList(result);
    console.log("EQUIPOS CARGADOS DESDE BASE44:", loadedTeams);

        const normalizedTeams = loadedTeams.map((team) => {
          const teamId = team.id || team._id || "";
          const teamCountryId = team.country_id || team.countryId || "";
          const country = loadedCountries.find((item) => String(item.id || "") === String(teamCountryId));
          const leagueId = team.league_id || team.leagueId || "";
          const league = loadedLeagues.find((item) => String(item.id || "") === String(leagueId));
          return {
            ...team,
            id: teamId,
            name: team.name || "",
            shortName: team.short_name || team.shortName || "",
            countryId: teamCountryId,
            country: team.country || team.country_name || team.countryName || country?.name || "Unknown country",
            countryCode: team.country_code || team.countryCode || country?.code || "",
            continent: team.continent || country?.continent || "Unknown continent",
            city: team.city || "",
            logo: team.logo || team.logo_url || "",
            primaryColor: team.primary_color || team.primaryColor || "",
            secondaryColor: team.secondary_color || team.secondaryColor || "",
            foundedYear: team.founded_year || team.foundedYear || null,
            stadium: team.stadium || "",
            stadiumId: team.stadium_id || team.stadiumId || "",
            stadiumCapacity: team.stadium_capacity || team.stadiumCapacity || null,
            stadiumBuiltYear: team.stadium_built_year || team.stadiumBuiltYear || null,
            stadiumRenovation: team.stadium_renovation || team.stadiumRenovation || null,
            pitchDimensions: team.pitch_dimensions || team.pitchDimensions || "",
            stadiumInteriorUrl: team.stadium_interior_url || team.stadiumInteriorUrl || "",
            stadiumExteriorUrl: team.stadium_exterior_url || team.stadiumExteriorUrl || "",
            reputation: numericValue(team.reputation, "0"),
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
            dataSource: team.data_source || team.dataSource || "Manual",
            isActive: team.is_active ?? team.isActive ?? true,
            leagueId,
            competition: league?.name || "Without competition",
            competitionLogo: league?.logo || "",
            competitionLevel:
            league?.level !== undefined &&
            league?.level !== null &&
            league?.level !== ""
    ? Number(league.level)
    : 999,
incomplete: !team.name || !team.short_name || !teamCountryId || !team.logo,
          };
        });
        if (!cancelled) setTeams(normalizedTeams);
      } catch (error) {
        console.error("Error loading teams:", error);
      }
    };

    const loadData = async () => {
      const [loadedCountries, loadedLeagues] = await Promise.all([
        loadCountries(),
        loadLeagues(),
      ]);
      await loadTeams(loadedCountries, loadedLeagues);
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredTeams = useMemo(() => {
    const normalizedSearch = search.toLowerCase().trim();

    const getReputation = (team) => {
      const rawValue = team?.reputation;
      if (rawValue === null || rawValue === undefined || String(rawValue).trim() === "") {
        return null;
      }

      const value = Number(rawValue);
      return Number.isFinite(value) ? value : null;
    };

    return teams
      .filter((team) => {
        if (!normalizedSearch) return true;

        return [team.name, team.country, team.competition, team.city]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch));
      })
      .sort((a, b) => {
        const reputationA = getReputation(a);
        const reputationB = getReputation(b);

        // Teams with a known reputation come first, from highest to lowest.
        if (reputationA === null && reputationB !== null) return 1;
        if (reputationA !== null && reputationB === null) return -1;
        if (reputationA !== null && reputationB !== null && reputationA !== reputationB) {
          return reputationB - reputationA;
        }

        // Stable, predictable ordering for equal or missing reputation values.
        return String(a?.name || "").localeCompare(String(b?.name || ""), "es", {
          sensitivity: "base",
        });
      });
  }, [teams, search]);

  const groupedTeams = useMemo(() => {
    const normalizeComparable = (value) =>
      String(value || "")
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();

    const getCountryKeys = (country) =>
      [
        country?.id,
        country?.name,
        country?.code,
        country?.country_code,
      ]
        .filter(Boolean)
        .map(normalizeComparable);

    const getLeagueCountryKeys = (league) =>
      [
        league?.countryId,
        league?.country_id,
      ]
        .filter(Boolean)
        .map(normalizeComparable);

    const getCountryReputation = (countryId, countryName, countryCode) => {
      const country =
        countries.find(
          (item) => String(item?.id || "") === String(countryId || "")
        ) ||
        countries.find(
          (item) =>
            normalizeComparable(item?.name) ===
            normalizeComparable(countryName)
        ) ||
        countries.find(
          (item) =>
            normalizeComparable(item?.code) ===
            normalizeComparable(countryCode)
        );

      const countryKeys = new Set(
        [
          countryId,
          countryName,
          countryCode,
          country?.id,
          country?.name,
          country?.code,
          country?.country_code,
        ]
          .filter(Boolean)
          .map(normalizeComparable)
      );

      const levelOneLeagues = leagues.filter((league) => {
        if (Number(league?.level) !== 1) return false;

        const leagueCountryKeys = getLeagueCountryKeys(league);
        return leagueCountryKeys.some((key) => countryKeys.has(key));
      });

      if (levelOneLeagues.length === 0) return 0;

      return Math.max(
        ...levelOneLeagues.map((league) => {
          const reputation = Number(league?.reputation);
          return Number.isFinite(reputation) ? reputation : 0;
        })
      );
    };

    if (activeFilter === "reputation") {
      const reputationRanges = [
        { key: "Elite", min: 9000, max: 9500 },
        { key: "World Class", min: 8750, max: 8999 },
        { key: "Top", min: 8500, max: 8749 },
        { key: "Very Strong", min: 8250, max: 8499 },
        { key: "Strong", min: 8000, max: 8249 },
        { key: "High", min: 7500, max: 7999 },
        { key: "Competitive", min: 7000, max: 7499 },
        { key: "Solid", min: 6000, max: 6999 },
        { key: "Mid", min: 5000, max: 5999 },
        { key: "Low", min: 4000, max: 4999 },
        { key: "Very Low", min: 3000, max: 3999 },
        { key: "Minor", min: 0, max: 2999 },
      ];

      const getReputationGroup = (value) => {
        if (value === null || value === undefined || String(value).trim() === "") {
          return "Unclassified";
        }

        const reputation = Number(value);

        if (!Number.isFinite(reputation)) {
          return "Unclassified";
        }

        return (
          reputationRanges.find(
            (range) =>
              reputation >= range.min &&
              reputation <= range.max
          )?.key || "Unclassified"
        );
      };

      const groupedReputationTeams = reputationRanges.reduce(
        (result, range) => {
          result[range.key] = [];
          return result;
        },
        {}
      );

      filteredTeams.forEach((team) => {
        const groupName = getReputationGroup(team?.reputation);
        groupedReputationTeams[groupName].push(team);
      });

      Object.keys(groupedReputationTeams).forEach((groupName) => {
        groupedReputationTeams[groupName].sort((a, b) => {
          const reputationA = Number(a?.reputation);
          const reputationB = Number(b?.reputation);

          const normalizedReputationA = Number.isFinite(reputationA)
            ? reputationA
            : 0;
          const normalizedReputationB = Number.isFinite(reputationB)
            ? reputationB
            : 0;

          if (normalizedReputationA !== normalizedReputationB) {
            return normalizedReputationB - normalizedReputationA;
          }

          return (a?.name || "").localeCompare(b?.name || "", "es", {
            sensitivity: "base",
          });
        });
      });

      return Object.fromEntries(
        Object.entries(groupedReputationTeams).filter(
          ([, groupTeams]) => groupTeams.length > 0
        )
      );
    }

    const groups = {};

    filteredTeams.forEach((team) => {
      let groupName;

      if (activeFilter === "countries") {
        groupName = team.country || "Unknown country";
      } else if (activeFilter === "continents") {
        groupName = team.continent || "Unknown continent";
      } else if (activeFilter === "market") {
        groupName = team.market || "Unclassified";
      } else if (activeFilter === "incomplete") {
        if (!team.incomplete) return;
        groupName = "Incomplete information";
      }

      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(team);
    });

    const entries = Object.entries(groups);

    if (activeFilter !== "countries") {
      return Object.fromEntries(entries);
    }

    entries.sort(([countryA, teamsA], [countryB, teamsB]) => {
      const teamA = teamsA?.[0] || {};
      const teamB = teamsB?.[0] || {};

      const reputationA = getCountryReputation(
        teamA.countryId,
        teamA.country,
        teamA.countryCode
      );
      const reputationB = getCountryReputation(
        teamB.countryId,
        teamB.country,
        teamB.countryCode
      );

      if (reputationA !== reputationB) {
        return reputationB - reputationA;
      }

      return String(countryA || "").localeCompare(
        String(countryB || ""),
        "es",
        { sensitivity: "base" }
      );
    });

    return Object.fromEntries(entries);
  }, [filteredTeams, activeFilter, leagues, countries]);

  const handleAddTeam = async (event) => {
    event.preventDefault();

    const wasEditing = Boolean(editingTeam);

    const newTeam = {
      id: `manual-${Date.now()}`,
      name: form.name.trim(),
      shortName: form.shortName.trim().toUpperCase(),
      country: form.country.trim(),
      countryId: form.countryId.trim(),
      countryCode: form.countryCode.trim().toUpperCase(),
      countryMapUrl: form.countryMapUrl.trim(),
      countryTeamMapUrl: form.countryTeamMapUrl.trim(),
      locationMapUrl: form.locationMapUrl.trim(),
      leagueId: form.leagueId.trim(),
      newLeagueName: form.newLeagueName.trim(),
      continent: form.continent,
      city: form.city.trim(),
      logo: form.logo.trim(),
      primaryColor: form.primaryColor.trim(),
      secondaryColor: form.secondaryColor.trim(),
      foundedYear: form.foundedYear ? Number(form.foundedYear) : null,
      stadium: form.stadium.trim(),
      stadiumId: form.stadiumId.trim(),
      stadiumCapacity: form.stadiumCapacity ? Number(form.stadiumCapacity) : null,
      stadiumBuiltYear: form.stadiumBuiltYear ? Number(form.stadiumBuiltYear) : null,
      stadiumRenovation: form.stadiumRenovation ? Number(form.stadiumRenovation) : null,
      pitchDimensions: form.pitchDimensions.trim(),
      stadiumInteriorUrl: form.stadiumInteriorUrl.trim(),
      stadiumExteriorUrl: form.stadiumExteriorUrl.trim(),
      reputation: Number(form.reputation || 0),
      market: formatMarketValue(form.market, ""),
      history: form.history.trim(),
      coachName: form.coachName.trim(),
      coachPhotoUrl: form.coachPhotoUrl.trim(),
      captainName: form.captainName.trim(),
      captainPhotoUrl: form.captainPhotoUrl.trim(),
      secondCaptainName: form.secondCaptainName.trim(),
      secondCaptainPhotoUrl: form.secondCaptainPhotoUrl.trim(),
      keyPlayerName: form.keyPlayerName.trim(),
      keyPlayerPhotoUrl: form.keyPlayerPhotoUrl.trim(),
      kit1PhotoUrl: form.kit1PhotoUrl.trim(),
      kit1ShopUrl: form.kit1ShopUrl.trim(),
      kit1BadgeBg: form.kit1BadgeBg.trim(),
      kit1BadgeText: form.kit1BadgeText.trim(),
      kit2PhotoUrl: form.kit2PhotoUrl.trim(),
      kit2ShopUrl: form.kit2ShopUrl.trim(),
      kit2BadgeBg: form.kit2BadgeBg.trim(),
      kit2BadgeText: form.kit2BadgeText.trim(),
      kit3PhotoUrl: form.kit3PhotoUrl.trim(),
      kit3ShopUrl: form.kit3ShopUrl.trim(),
      kit3BadgeBg: form.kit3BadgeBg.trim(),
      kit3BadgeText: form.kit3BadgeText.trim(),
      kitsOverviewUrl: form.kitsOverviewUrl.trim(),
      dataSource: form.dataSource,
      isActive: form.isActive,
      incomplete: !form.name.trim() || !form.shortName.trim() || !form.country.trim() || !form.logo.trim(),
      competition: "Without competition",
    };

    try {
      if (!form.name.trim() || !form.shortName.trim() || !form.country.trim()) {
        alert("Name, short name and country are required.");
        return;
      }

      let countryId = form.countryId.trim();
      const normalizedCountryName = form.country.trim().toLowerCase();

      const existingCountry = countries.find(
        (country) => country.name?.trim().toLowerCase() === normalizedCountryName
      );

      if (!countryId && existingCountry?.id) {
        countryId = existingCountry.id;
      }

      if (!countryId) {
        if (!form.countryCode.trim()) {
          alert("Introduce the country code to create the country automatically.");
          return;
        }

        const createdCountry = await base44.entities.Country.create({
          name: form.country.trim(),
          code: form.countryCode.trim().toUpperCase(),
          continent: form.continent || "Europe",
          is_active: true,
        });

        const countryData = createdCountry?.data || createdCountry;

countryId =
  countryData?.id ||
  countryData?._id ||
  createdCountry?.id ||
  createdCountry?._id ||
  "";

if (!countryId) {
  alert(
    "The country was created, but Base44 did not return its ID. Check the Country entity response."
  );
  return;
}

const normalizedCreatedCountry = {
  ...countryData,
  id: countryId,
  name: countryData?.name || form.country.trim(),
  code: countryData?.code || form.countryCode.trim().toUpperCase(),
  continent: countryData?.continent || form.continent || "Europe",
};

setCountries((currentCountries) => {
  const alreadyExists = currentCountries.some(
    (country) => String(country.id) === String(countryId)
  );

  return alreadyExists
    ? currentCountries
    : [...currentCountries, normalizedCreatedCountry];
});
      }

      newTeam.countryId = countryId;

      let leagueId = newTeam.leagueId;
      let selectedLeague = leagues.find((league) => String(league.id) === String(leagueId));

      if (!leagueId && newTeam.newLeagueName) {
        const existingLeague = leagues.find((league) => league.name?.trim().toLowerCase() === newTeam.newLeagueName.toLowerCase());
        if (existingLeague?.id) {
          leagueId = existingLeague.id;
          selectedLeague = existingLeague;
        } else {
          const createdLeague = await base44.entities.League.create({
            name: newTeam.newLeagueName,
            league_level: 1,
            level: 1,
            reputation: 0,
            country_id: countryId,
            is_active: true,
            status: "Incompleto",
          });
          leagueId = createdLeague?.id || createdLeague?.data?.id || createdLeague?._id || "";
          if (!leagueId) {
            alert("The league was created, but Base44 did not return its ID.");
            return;
          }
          selectedLeague = { ...createdLeague, id: leagueId, name: newTeam.newLeagueName };
          setLeagues((currentLeagues) => [...currentLeagues, selectedLeague]);
        }
      }

      if (!leagueId) {
        alert("Select or create a league before saving the team.");
        return false;
      }

      const generatedCode = newTeam.shortName
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 12) || `TEAM${Date.now()}`;

      const savedTeam = editingTeam
  ? await base44.entities.Team.update(editingTeam.id, {
    name: newTeam.name,
    short_name: newTeam.shortName,
    code: generatedCode,
    continent: newTeam.continent || "Europe",
    country_id: countryId,
    league_id: leagueId,
    city: newTeam.city,
    logo: newTeam.logo,
country_map_url: newTeam.countryMapUrl,
country_team_map_url: newTeam.countryTeamMapUrl,
location_map_url: newTeam.locationMapUrl,
primary_color: newTeam.primaryColor,
secondary_color: newTeam.secondaryColor,
kit1_photo_url: newTeam.kit1PhotoUrl,
kit2_photo_url: newTeam.kit2PhotoUrl,
kit3_photo_url: newTeam.kit3PhotoUrl,
    founded_year: newTeam.foundedYear,
    stadium_id: newTeam.stadiumId,
    stadium: newTeam.stadium,
    stadium_capacity: newTeam.stadiumCapacity,
    stadium_built_year: newTeam.stadiumBuiltYear,
    stadium_renovation: newTeam.stadiumRenovation,
    pitch_dimensions: newTeam.pitchDimensions,
    stadium_interior_url: newTeam.stadiumInteriorUrl,
    stadium_exterior_url: newTeam.stadiumExteriorUrl,
    reputation: String(newTeam.reputation ?? ""),
    market: String(newTeam.market ?? ""),
    history: newTeam.history,
    coach_name: newTeam.coachName,
    coach_photo_url: newTeam.coachPhotoUrl,
    captain_name: newTeam.captainName,
    captain_photo_url: newTeam.captainPhotoUrl,
    second_captain_name: newTeam.secondCaptainName,
    second_captain_photo_url: newTeam.secondCaptainPhotoUrl,
    key_player_name: newTeam.keyPlayerName,
    key_player_photo_url: newTeam.keyPlayerPhotoUrl,
    data_source: newTeam.dataSource,
        is_active: newTeam.isActive,
  })
  : await base44.entities.Team.create({
      name: newTeam.name,
      short_name: newTeam.shortName,
      code: generatedCode,
      continent: newTeam.continent || "Europe",
      country_id: countryId,
      league_id: leagueId,
      city: newTeam.city,
      logo: newTeam.logo,
      country_map_url: newTeam.countryMapUrl,
      country_team_map_url: newTeam.countryTeamMapUrl,
      location_map_url: newTeam.locationMapUrl,
      primary_color: newTeam.primaryColor,
      secondary_color: newTeam.secondaryColor,
      kit1_photo_url: newTeam.kit1PhotoUrl,
      kit2_photo_url: newTeam.kit2PhotoUrl,
      kit3_photo_url: newTeam.kit3PhotoUrl,
      founded_year: newTeam.foundedYear,
      stadium_id: newTeam.stadiumId,
      stadium: newTeam.stadium,
      stadium_capacity: newTeam.stadiumCapacity,
      stadium_built_year: newTeam.stadiumBuiltYear,
      stadium_renovation: newTeam.stadiumRenovation,
      pitch_dimensions: newTeam.pitchDimensions,
      stadium_interior_url: newTeam.stadiumInteriorUrl,
      stadium_exterior_url: newTeam.stadiumExteriorUrl,
      reputation: String(newTeam.reputation ?? ""),
      market: String(newTeam.market ?? ""),
      history: newTeam.history,
      coach_name: newTeam.coachName,
      coach_photo_url: newTeam.coachPhotoUrl,
      captain_name: newTeam.captainName,
      captain_photo_url: newTeam.captainPhotoUrl,
      second_captain_name: newTeam.secondCaptainName,
      second_captain_photo_url: newTeam.secondCaptainPhotoUrl,
      key_player_name: newTeam.keyPlayerName,
      key_player_photo_url: newTeam.keyPlayerPhotoUrl,
      data_source: newTeam.dataSource,
      is_active: newTeam.isActive,
    });

  const updatedTeam = {
    ...newTeam,
    id: savedTeam.id,
    competition:
      selectedLeague?.name ||
      "Without competition",
    leagueId,
  };

  setTeams((currentTeams) => {
    if (wasEditing) {
      return currentTeams.map((team) =>
        team.id === editingTeam.id ? updatedTeam : team
      );
    }

    return [...currentTeams, updatedTeam];
  });

  if (wasEditing) {
    setSelectedTeam(updatedTeam);
  }

  setForm(emptyTeamForm);
  setEditingTeam(null);
  setAddModalOpen(false);
  setActiveFilter("countries");
  return true;
} catch (error) {
  console.error("Error saving team:", error);
  const errorMessage =
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    (typeof error === "string" ? error : JSON.stringify(error));
  alert(`Error real de Base44:\n\n${errorMessage}`);
  return false;
}
  };

  const handleImportJson = (importedForm) => {
    setForm(importedForm);
    setImportJsonModalOpen(false);
    setAddModalOpen(true);
  };

  const selectedBulkTeams = teams.filter((team) => bulkTeamIds.includes(String(team.id)));
  const visibleBulkTeamIds = filteredTeams.map((team) => String(team.id)).filter(Boolean);

  const toggleBulkTeam = (id) => {
    if (bulkTeamsBusy) return;
    const value = String(id);
    setBulkTeamIds((previous) => previous.includes(value) ? previous.filter((item) => item !== value) : [...previous, value]);
    setBulkTeamsMessage("");
  };

  const toggleVisibleTeams = () => {
    if (bulkTeamsBusy) return;
    const allVisibleSelected = visibleBulkTeamIds.every((id) => bulkTeamIds.includes(id));
    setBulkTeamIds((previous) => allVisibleSelected ? previous.filter((id) => !visibleBulkTeamIds.includes(id)) : [...new Set([...previous, ...visibleBulkTeamIds])]);
  };

  const deleteSelectedTeams = async () => {
    if (bulkTeamsBusy || !bulkTeamsConfirmOpen || !selectedBulkTeams.length) return;
    const targets = [...selectedBulkTeams];
    setBulkTeamsBusy(true);
    const deletedIds = [];
    const errors = [];
    try {
      for (const team of targets) {
        try {
          await base44.entities.Team.delete(team.id);
          deletedIds.push(String(team.id));
        } catch (error) {
          errors.push(`${team.name}: ${error?.message || "Error desconocido"}`);
        }
      }
      if (deletedIds.length) {
        setTeams((previous) => previous.filter((team) => !deletedIds.includes(String(team.id))));
        setBulkTeamIds((previous) => previous.filter((id) => !deletedIds.includes(id)));
      }
      setBulkTeamsMessage(`${deletedIds.length} de ${targets.length} equipos eliminados.${errors.length ? ` No se pudieron eliminar ${errors.length}: ${errors.slice(0, 3).join(" · ")}` : ""}`);
    } finally {
      setBulkTeamsBusy(false);
      setBulkTeamsConfirmOpen(false);
    }
  };

  const handleCloseSearch = () => {
    setSearch("");
    setSearchOpen(false);
  };

    if (selectedTeam) {
  return (
    <TeamDetail
  team={selectedTeam}
  onClose={() => setSelectedTeam(null)}
  onEdit={(team) => {
    setEditingTeam(team);
  }}
  form={form}
  setForm={setForm}
  countries={countries}
  leagues={leagues}
  onCloseEdit={() => setEditingTeam(null)}
  onSubmit={handleAddTeam}
/>
  );
}

  return (
    <div className="min-h-full bg-[#F6F7F9] p-6 md:p-8">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {navigationFilters.map((filter) => {
            const Icon = filter.icon;
            const isActive = activeFilter === filter.id;

            return (
              <button key={filter.id} type="button" onClick={() => setActiveFilter(filter.id)} className={`flex h-10 items-center gap-2 rounded-xl border px-4 text-xs font-semibold transition ${isActive ? "border-[#073B35] bg-[#003399] text-white shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"}`}>
                <Icon size={14} strokeWidth={1.8} />
                {filter.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {searchOpen && (
            <div className="relative w-[220px]">
              <Search size={16} strokeWidth={2} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Search teams..." value={search} onChange={(event) => setSearch(event.target.value)} autoFocus className={`${inputClassName} pl-9 pr-9 text-xs`} />
              <button type="button" onClick={handleCloseSearch} className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Close search">
                <X size={14} />
              </button>
            </div>
          )}

          <button type="button" onClick={() => setSearchOpen((open) => !open)} className={`flex h-10 w-10 items-center justify-center rounded-xl border transition ${searchOpen ? "border-[#073B35] bg-[#003399] text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"}`} aria-label="Search teams" title="Search teams">
            {searchOpen ? <X size={17} strokeWidth={2} /> : <Search size={17} strokeWidth={2} />}
          </button>

          <button
            type="button"
            disabled={bulkTeamsBusy}
            onClick={() => {
              setBulkTeamsMode((previous) => !previous);
              setBulkTeamIds([]);
              setBulkTeamsMessage("");
              setBulkTeamsConfirmOpen(false);
            }}
            className={`h-10 whitespace-nowrap rounded-xl border px-3 text-xs font-bold transition ${bulkTeamsMode ? "border-[#003399] bg-blue-50 text-[#003399]" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
          >
            {bulkTeamsMode ? "Terminar selección" : "Selección múltiple"}
          </button>

          <button type="button" onClick={() => setImportJsonModalOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50" aria-label="Import team from text or JSON" title="Import team from text or JSON">
            <FileJson size={17} strokeWidth={2} />
          </button>

          <button type="button" onClick={handleOpenAddTeam} className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#003399] text-white transition hover:bg-[#002477]" aria-label="Add team" title="Add team">
            <Plus size={18} strokeWidth={2} />
          </button>
        </div>
      </div>

      {bulkTeamsMode && (
        <div className="mb-5 rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <strong className="text-sm text-[#003399]">{selectedBulkTeams.length} equipos seleccionados</strong>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={bulkTeamsBusy || !visibleBulkTeamIds.length} onClick={toggleVisibleTeams} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50">
                {visibleBulkTeamIds.length && visibleBulkTeamIds.every((id) => bulkTeamIds.includes(id)) ? "Deseleccionar visibles" : `Seleccionar visibles (${visibleBulkTeamIds.length})`}
              </button>
              <button type="button" disabled={bulkTeamsBusy || !bulkTeamIds.length} onClick={() => setBulkTeamIds([])} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50">Deseleccionar todos</button>
            </div>
          </div>
          <div className="mt-3 border-t border-blue-200 pt-3">
            <button type="button" disabled={bulkTeamsBusy || !selectedBulkTeams.length} onClick={() => setBulkTeamsConfirmOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40">
              <Trash2 size={15} /> Eliminar seleccionados ({selectedBulkTeams.length})
            </button>
            <p className="mt-2 text-xs text-slate-500">Se solicitará una segunda confirmación antes de borrar ningún equipo.</p>
          </div>
        </div>
      )}
      {bulkTeamsMessage && <div role="status" className="mb-5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-700">{bulkTeamsMessage}</div>}

      {activeFilter === "unattached" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-black text-slate-900">Jugadores sin equipo</h2><p className="text-xs text-slate-500">Agentes libres y retirados: no se crean equipos ficticios.</p></div><div className="flex gap-2">{[{id:"free_agent",title:"Agentes libres"},{id:"retired",title:"Retirados"}].map(tab=><button type="button" key={tab.id} onClick={()=>setUnattachedTab(tab.id)} className={`rounded-xl px-4 py-2 text-xs font-bold ${unattachedTab===tab.id ? "bg-[#003399] text-white" : "border border-slate-200 bg-slate-50 text-slate-700"}`}><img src={careerStatusLogo(tab.id)} alt="" className="mr-1.5 inline-block h-5 w-5 align-middle" />{tab.title} ({unattachedPlayers.filter(p=>(p.career_status || (!p.team_id && !p.teamId ? "free_agent" : "active"))===tab.id).length})</button>)}</div></div>
          {unattachedError && <p className="mb-3 text-sm text-red-600">{unattachedError}</p>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{unattachedPlayers.filter(p=>(p.career_status || (!p.team_id && !p.teamId ? "free_agent" : "active"))===unattachedTab).filter(p=>!search || String(p.name||"").toLowerCase().includes(search.toLowerCase())).map(p=><div key={p.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3"><div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-slate-100"><img src={normalizeImageUrl(p.photo_url || p.photoUrl) || careerStatusLogo(unattachedTab)} alt="" className="h-full w-full object-contain" /></div><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900">{p.name}</p><p className="flex items-center gap-1 text-[11px] font-semibold text-slate-500"><img src={careerStatusLogo(unattachedTab)} alt="" className="h-4 w-4" />{unattachedTab === "retired" ? "Retirado" : "Agente libre"}</p><p className="text-xs text-slate-500">Último club: {teams.find(team=>String(team.id)===String(p.last_team_id))?.name || "No registrado"}</p>{unattachedTab==="retired" && p.retirement_year && <p className="text-xs text-slate-400">Retirado en {p.retirement_year}</p>}</div></div>)}</div>
          {unattachedPlayers.filter(p=>(p.career_status || (!p.team_id && !p.teamId ? "free_agent" : "active"))===unattachedTab).filter(p=>!search || String(p.name||"").toLowerCase().includes(search.toLowerCase())).length === 0 && <p className="mt-4 rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">No se encontraron jugadores en esta categoría.</p>}
        </section>
      ) : Object.keys(groupedTeams).length > 0 ? (
        <div className="space-y-5">
          {Object.entries(groupedTeams).map(([groupName, groupTeams]) => {
            if (activeFilter === "reputation") {
              return (
                <section
                  key={groupName}
                  className="rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_2px_8px_rgba(15,23,42,0.02)] md:p-4"
                >
                  <div className="mb-5 flex items-center justify-between gap-4">
                    <h2 className="text-base font-extrabold text-slate-900">
                      {groupName}
                    </h2>
                    <span className="text-xs font-medium text-slate-400">
                      {groupTeams.length} {groupTeams.length === 1 ? "team" : "teams"}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-6 2xl:grid-cols-6">
                    {groupTeams.map((team) => (
                      <TeamCard
                        key={team.id}
                        team={team}
                        showReputation
                        selectionMode={bulkTeamsMode}
                        isSelected={bulkTeamIds.includes(String(team.id))}
                        disabled={bulkTeamsBusy}
                        onOpen={() => bulkTeamsMode ? toggleBulkTeam(team.id) : setSelectedTeam(team)}
                      />
                    ))}
                  </div>
                </section>
              );
            }

            const competitions = groupTeams.reduce((groups, team) => {
              const competition = team.competition || "Without competition";
              if (!groups[competition]) groups[competition] = [];
              groups[competition].push(team);
              return groups;
            }, {});

            return (
              <section key={groupName} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_2px_8px_rgba(15,23,42,0.02)] md:p-4">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <h2 className="text-base font-extrabold text-slate-900">{groupName}</h2>
                  <span className="text-xs font-medium text-slate-400">{groupTeams.length} {groupTeams.length === 1 ? "team" : "teams"}</span>
                </div>
                <div className="space-y-4">
                  {Object.entries(competitions)
  .sort(([competitionNameA, teamsA], [competitionNameB, teamsB]) => {
    const teamA = teamsA?.[0] || {};
    const teamB = teamsB?.[0] || {};

    const leagueA = leagues.find(
      (league) => String(league?.id || "") === String(teamA?.leagueId || "")
    );
    const leagueB = leagues.find(
      (league) => String(league?.id || "") === String(teamB?.leagueId || "")
    );

    const levelA = Number(
      leagueA?.level ?? teamA?.competitionLevel ?? 999
    );
    const levelB = Number(
      leagueB?.level ?? teamB?.competitionLevel ?? 999
    );

    const normalizedLevelA = Number.isFinite(levelA) ? levelA : 999;
    const normalizedLevelB = Number.isFinite(levelB) ? levelB : 999;

    if (normalizedLevelA !== normalizedLevelB) {
      return normalizedLevelA - normalizedLevelB;
    }

    return String(competitionNameA || "").localeCompare(
      String(competitionNameB || ""),
      "es",
      { sensitivity: "base" }
    );
  })
  .map(([competitionName, competitionTeams]) => {
    const sortedTeams = [...(competitionTeams || [])].sort((a, b) => {
      const reputationA = Number(a?.reputation);
      const reputationB = Number(b?.reputation);

      const normalizedReputationA = Number.isFinite(reputationA) ? reputationA : 0;
      const normalizedReputationB = Number.isFinite(reputationB) ? reputationB : 0;

      if (normalizedReputationA !== normalizedReputationB) {
        return normalizedReputationB - normalizedReputationA;
      }

      return (a.name || "").localeCompare(b.name || "", "es", {
        sensitivity: "base",
      });
    });

    return (
      <div key={competitionName}>
        <CompetitionHeader
          competitionName={competitionName}
          teams={sortedTeams}
        />

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-6 2xl:grid-cols-6">
          {sortedTeams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              selectionMode={bulkTeamsMode}
              isSelected={bulkTeamIds.includes(String(team.id))}
              disabled={bulkTeamsBusy}
              onOpen={() => bulkTeamsMode ? toggleBulkTeam(team.id) : setSelectedTeam(team)}
            />
          ))}
        </div>
      </div>
    );
  })}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-50"><CircleAlert size={22} className="text-slate-400" /></div>
          <h2 className="mt-4 text-base font-bold text-slate-800">No teams found</h2>
          <p className="mt-2 text-sm text-slate-500">Add your first team using the plus button.</p>
          <button type="button" onClick={handleOpenAddTeam} className="mt-5 rounded-xl bg-[#003399] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#002477]">Add first team</button>
        </div>
      )}

      {(addModalOpen || editingTeam) && (
  <AddTeamModal
    form={form}
    setForm={setForm}
    countries={countries}
    leagues={leagues}
    isEditing={Boolean(editingTeam)}
    onClose={() => {
      setAddModalOpen(false);
      setEditingTeam(null);
    }}
    onSubmit={handleAddTeam}
  />
)}
      {bulkTeamsConfirmOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" role="presentation">
          <div role="alertdialog" aria-modal="true" aria-labelledby="bulk-delete-team-title" aria-describedby="bulk-delete-team-description" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600"><Trash2 size={21} /></div>
              <h2 id="bulk-delete-team-title" className="text-lg font-black text-slate-900">¿Eliminar {selectedBulkTeams.length} {selectedBulkTeams.length === 1 ? "equipo" : "equipos"}?</h2>
            </div>
            <p id="bulk-delete-team-description" className="text-sm leading-6 text-slate-600">Esta acción es permanente. Se eliminarán los equipos seleccionados de Base44. Los jugadores o relaciones que apunten a estos clubes pueden quedar sin una asociación válida.</p>
            <div className="mt-4 max-h-32 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              {selectedBulkTeams.slice(0, 15).map((team) => <div key={team.id} className="py-0.5">• {team.name}</div>)}
              {selectedBulkTeams.length > 15 && <div className="mt-1 font-semibold">Y {selectedBulkTeams.length - 15} equipos más…</div>}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" disabled={bulkTeamsBusy} onClick={() => setBulkTeamsConfirmOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-40">Cancelar</button>
              <button type="button" disabled={bulkTeamsBusy || !selectedBulkTeams.length} onClick={deleteSelectedTeams} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-40">{bulkTeamsBusy ? "Eliminando..." : `Sí, eliminar ${selectedBulkTeams.length}`}</button>
            </div>
          </div>
        </div>
      )}

      {importJsonModalOpen && <ImportTeamJsonModal onClose={() => setImportJsonModalOpen(false)} onImport={handleImportJson} />}
    </div>
  );
}
