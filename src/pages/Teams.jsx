import React, { useEffect, useMemo, useRef, useState } from "react";
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
} from "lucide-react";

import { base44 } from "@/api/base44Client";

const navigationFilters = [
  { id: "countries", label: "Countries", icon: Globe },
  { id: "continents", label: "Continents", icon: Map },
  { id: "reputation", label: "Reputation", icon: Star },
  { id: "market", label: "Market", icon: TrendingUp },
  { id: "incomplete", label: "Incomplete", icon: CircleAlert },
];

const competitionDetails = {};

const emptyTeamForm = {
  name: "",
  shortName: "",
  country: "",
  countryId: "",
  leagueName: "",
  leagueId: "",
  leagueSeason: "2026-2027",
  leagueCountry: "",
  leagueLevel: "1",
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
  reputation: "",
  market: "",
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
  dataSource: "Manual",
  isActive: true,
};

const inputClassName =
  "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#003399] focus:ring-2 focus:ring-[#003399]/10";

const textareaClassName =
  "min-h-[104px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#003399] focus:ring-2 focus:ring-[#003399]/10";

function FormField({ label, children, hint }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}

function SectionHeader({ icon: Icon, title, description }) {
  return (
    <div className="mb-4 flex items-start gap-3 border-b border-slate-100 pb-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
        <Icon size={16} />
      </div>
      <div>
        <h3 className="text-sm font-extrabold text-slate-900">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      </div>
    </div>
  );
}

function TeamLogo({ team }) {
  if (team.logo) {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white">
        <img src={team.logo} alt={`${team.name} logo`} className="h-full w-full object-contain" />
      </div>
    );
  }

  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white">
      <span className="text-[10px] font-extrabold tracking-tight text-slate-800">{team.shortName || "FC"}</span>
    </div>
  );
}


function normalizeHex(value, fallback = "#ffffff") {
  const normalized = String(value || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized : fallback;
}

function normalizeLogoUrl(value) {
  let normalized = String(value || "").trim();
  if (!normalized) return "";

  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }

  // FotMob logo paths are normally served from images.fotmob.com.
  normalized = normalized.replace(
    /^https?:\/\/(?:www\.)?fotmob\.com\//i,
    "https://images.fotmob.com/"
  );

  return normalized;
}

function LogoAndColorPicker({ logoUrl, primaryColor, secondaryColor, onChange }) {
  const canvasRef = useRef(null);
  const zoomCanvasRef = useRef(null);
  const zoomDrawInfoRef = useRef(null);
  const imageRef = useRef(null);
  const [palette, setPalette] = useState([]);
  const [activeTarget, setActiveTarget] = useState("primaryColor");
  const [imageError, setImageError] = useState("");
  const [paletteError, setPaletteError] = useState("");
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const resolvedLogoUrl = useMemo(() => normalizeLogoUrl(logoUrl), [logoUrl]);

  const drawContainedImage = (canvas, image, size) => {
    const context = canvas.getContext("2d", { willReadFrequently: true });
    canvas.width = size;
    canvas.height = size;
    context.clearRect(0, 0, size, size);

    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    if (!sourceWidth || !sourceHeight) return null;

    const scale = Math.min(size / sourceWidth, size / sourceHeight);
    const drawWidth = sourceWidth * scale;
    const drawHeight = sourceHeight * scale;
    const offsetX = (size - drawWidth) / 2;
    const offsetY = (size - drawHeight) / 2;

    context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
    return { offsetX, offsetY, drawWidth, drawHeight, sourceWidth, sourceHeight, size };
  };

  const drawAndExtractPalette = (image) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    drawContainedImage(canvas, image, 160);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const pixels = context.getImageData(0, 0, 160, 160).data;
    const colorCounts = new Map();

    for (let index = 0; index < pixels.length; index += 16) {
      const alpha = pixels[index + 3];
      if (alpha < 180) continue;

      const red = Math.round(pixels[index] / 32) * 32;
      const green = Math.round(pixels[index + 1] / 32) * 32;
      const blue = Math.round(pixels[index + 2] / 32) * 32;
      const key = `${red},${green},${blue}`;
      colorCounts.set(key, (colorCounts.get(key) || 0) + 1);
    }

    const extracted = [...colorCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([key]) => {
        const [red, green, blue] = key.split(",").map(Number);
        return `#${[red, green, blue].map((channel) => Math.min(255, channel).toString(16).padStart(2, "0")).join("")}`;
      })
      .filter((color, index, colors) => colors.indexOf(color) === index)
      .filter((color) => !["#ffffff", "#000000", "#202020"].includes(color.toLowerCase()))
      .slice(0, 8);

    setPalette(extracted);
  };

  const drawZoomCanvas = () => {
    const image = imageRef.current;
    const canvas = zoomCanvasRef.current;
    if (!image || !canvas || !imageLoaded) return;

    zoomDrawInfoRef.current = drawContainedImage(canvas, image, 640);
  };

  const handleImageLoad = (event) => {
    setImageError("");
    setImageLoaded(true);
    setPaletteError("");
    try {
      drawAndExtractPalette(event.currentTarget);
      if (isZoomOpen) drawZoomCanvas();
    } catch (error) {
      console.warn("Could not extract colors from logo. The image may block canvas access.", error);
      setPalette([]);
      setPaletteError(
        "La imagen se ha cargado, pero su servidor no permite leer los píxeles para detectar colores automáticamente. Puedes usar el selector manual."
      );
    }
  };

  const handleZoomCanvasClick = (event) => {
    const canvas = zoomCanvasRef.current;
    const drawInfo = zoomDrawInfoRef.current;
    if (!canvas || !drawInfo) return;

    try {
      const bounds = canvas.getBoundingClientRect();
      const canvasX = ((event.clientX - bounds.left) / bounds.width) * canvas.width;
      const canvasY = ((event.clientY - bounds.top) / bounds.height) * canvas.height;

      if (
        canvasX < drawInfo.offsetX ||
        canvasX > drawInfo.offsetX + drawInfo.drawWidth ||
        canvasY < drawInfo.offsetY ||
        canvasY > drawInfo.offsetY + drawInfo.drawHeight
      ) {
        return;
      }

      const sampleX = Math.max(0, Math.min(canvas.width - 1, Math.floor(canvasX)));
      const sampleY = Math.max(0, Math.min(canvas.height - 1, Math.floor(canvasY)));
      const pixel = canvas.getContext("2d", { willReadFrequently: true }).getImageData(sampleX, sampleY, 1, 1).data;
      const selectedColor = `#${[pixel[0], pixel[1], pixel[2]].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;

      onChange(activeTarget, selectedColor.toUpperCase());
      setPaletteError("");
    } catch (error) {
      console.warn("Could not sample a color from this logo.", error);
      setPaletteError(
        "No se puede leer el color directamente de esta imagen porque el servidor bloquea el acceso desde el navegador. Usa el selector manual."
      );
    }
  };

  useEffect(() => {
    setPalette([]);
    setImageError("");
    setPaletteError("");
    setImageLoaded(false);
    setIsZoomOpen(false);
  }, [resolvedLogoUrl]);

  useEffect(() => {
    if (!isZoomOpen) return;
    const frame = requestAnimationFrame(drawZoomCanvas);
    return () => cancelAnimationFrame(frame);
  }, [isZoomOpen, imageLoaded, resolvedLogoUrl]);

  return (
    <>
      <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          <div className="flex w-full flex-col items-center gap-2 md:w-44 md:shrink-0">
            {resolvedLogoUrl ? (
              <button
                type="button"
                onClick={() => setIsZoomOpen(true)}
                className="group relative flex h-36 w-36 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
                title="Abrir imagen ampliada para seleccionar un color"
              >
                <img
                  ref={imageRef}
                  src={resolvedLogoUrl}
                  crossOrigin="anonymous"
                  alt="Logo preview"
                  onLoad={handleImageLoad}
                  onError={() => {
                    setImageLoaded(false);
                    setImageError("El navegador no pudo cargar esta URL. Comprueba que sea una imagen directa y accesible públicamente.");
                  }}
                  className="h-full w-full object-contain"
                />
                <span className="pointer-events-none absolute inset-x-1 bottom-1 rounded-lg bg-slate-900/75 px-1 py-1 text-center text-[10px] font-semibold text-white opacity-0 transition group-hover:opacity-100">
                  Abrir y ampliar
                </span>
              </button>
            ) : (
              <div className="flex h-36 w-36 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-center text-xs text-slate-400">
                Introduce una URL de logo
              </div>
            )}
            {imageError && <p className="max-w-40 text-center text-[11px] text-red-500">{imageError}</p>}
            {!imageError && resolvedLogoUrl && <p className="text-[11px] text-slate-400">Haz clic para ampliar</p>}
          </div>

          <div className="min-w-0 flex-1 space-y-4">
            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-wide text-slate-700">Logo palette</h4>
              <p className="mt-1 text-xs text-slate-500">Selecciona el color primario o secundario y después elige un color de la paleta.</p>
            </div>

            {paletteError && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">{paletteError}</p>}

            <div className="flex flex-wrap gap-2">
              {palette.length > 0 ? palette.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => onChange(activeTarget, color)}
                  className="group flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-400"
                  title={`Usar ${color} como ${activeTarget === "primaryColor" ? "color primario" : "color secundario"}`}
                >
                  <span className="h-6 w-6 rounded-lg border border-black/10" style={{ backgroundColor: color }} />
                  {color.toUpperCase()}
                </button>
              )) : (
                <span className="text-xs text-slate-400">Introduce una imagen compatible para detectar colores.</span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setActiveTarget("primaryColor")} className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${activeTarget === "primaryColor" ? "border-[#003399] bg-[#003399] text-white" : "border-slate-200 bg-white text-slate-600"}`}>
                Seleccionar primario
              </button>
              <button type="button" onClick={() => setActiveTarget("secondaryColor")} className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${activeTarget === "secondaryColor" ? "border-[#003399] bg-[#003399] text-white" : "border-slate-200 bg-white text-slate-600"}`}>
                Seleccionar secundario
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[{ field: "primaryColor", label: "Primary color", value: primaryColor }, { field: "secondaryColor", label: "Secondary color", value: secondaryColor }].map((colorField) => (
                <FormField key={colorField.field} label={colorField.label}>
                  <div className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-2">
                    <input
                      type="color"
                      value={normalizeHex(colorField.value)}
                      onChange={(event) => onChange(colorField.field, event.target.value.toUpperCase())}
                      className="h-7 w-9 cursor-pointer rounded border-0 bg-transparent p-0"
                      aria-label={colorField.label}
                    />
                    <span className="text-xs font-semibold text-slate-600">{normalizeHex(colorField.value).toUpperCase()}</span>
                  </div>
                </FormField>
              ))}
            </div>
          </div>
        </div>
        <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
      </div>

      {isZoomOpen && resolvedLogoUrl && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Seleccionar color del logo">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-4 shadow-2xl md:p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Seleccionar color del logo</h3>
                <p className="mt-1 text-xs text-slate-500">Haz clic sobre cualquier zona de la imagen ampliada para asignar el color {activeTarget === "primaryColor" ? "primario" : "secundario"}.</p>
              </div>
              <button type="button" onClick={() => setIsZoomOpen(false)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100" aria-label="Cerrar imagen ampliada">
                <X size={18} />
              </button>
            </div>

            <div className="flex justify-center overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-2">
              <canvas
                ref={zoomCanvasRef}
                width={640}
                height={640}
                onClick={handleZoomCanvasClick}
                className="h-auto max-h-[65vh] w-full max-w-[640px] cursor-crosshair touch-manipulation rounded-xl bg-white object-contain"
                aria-label="Imagen ampliada. Haz clic para seleccionar un color."
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-semibold text-slate-500">Objetivo: {activeTarget === "primaryColor" ? "Primary color" : "Secondary color"}</span>
              <button type="button" onClick={() => setIsZoomOpen(false)} className="h-10 rounded-xl bg-[#003399] px-4 text-xs font-semibold text-white hover:bg-[#002477]">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function CompetitionHeader({ competitionName, teams }) {
  const competition = competitionDetails[competitionName] || { level: "Competition", logo: "FC" };

  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-[8px] font-black text-slate-700">
          {competition.logo}
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

function TeamCard({ team }) {
  return (
    <button
      type="button"
      className="group flex h-[64px] items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm"
    >
      <TeamLogo team={team} />
      <span className="min-w-0 truncate text-xs font-bold text-slate-800 transition group-hover:text-[#003399]">{team.name}</span>
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
}) {
  const updateField = (field, value) => {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
  };

  const textField = (field, label, placeholder, options = {}) => (
    <FormField label={label} hint={options.hint}>
      <input
        type={options.type || "text"}
        value={form[field]}
        onChange={(event) => updateField(field, event.target.value)}
        placeholder={placeholder}
        className={inputClassName}
        min={options.min}
        max={options.max}
      />
    </FormField>
  );

  const selectField = (field, label, values) => (
    <FormField label={label}>
      <select value={form[field]} onChange={(event) => updateField(field, event.target.value)} className={inputClassName}>
        {values.map((value) => <option key={value} value={value}>{value}</option>)}
      </select>
    </FormField>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="add-team-title">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl md:p-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h2 id="add-team-title" className="text-lg font-extrabold text-slate-900">Add team</h2>
            <p className="mt-1 text-xs text-slate-500">Create a complete club profile manually.</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800" aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-7">
          <section>
            <SectionHeader icon={Shield} title="Basic information" description="Official identity and location of the club." />
            <div className="grid gap-4 md:grid-cols-2">
              {textField("name", "Team name *", "e.g. Real Madrid")}
              {textField("shortName", "Short name *", "e.g. RMA")}
              <FormField label="Country *" hint="Selecciona un país existente o escribe uno nuevo. Si no existe, se creará automáticamente.">
                <input
                  type="text"
                  list="team-country-options"
                  value={form.country}
                  onChange={(event) => {
                    const countryName = event.target.value;
                    const matched = countries.find((country) => normalizeComparable(recordName(country)) === normalizeComparable(countryName));
                    updateField("country", countryName);
                    updateField("countryId", matched ? recordId(matched) : "");
                  }}
                  placeholder="Search or create country..."
                  className={inputClassName}
                />
                <datalist id="team-country-options">
                  {countries.map((country) => (
                    <option key={recordId(country) || recordName(country)} value={recordName(country)} />
                  ))}
                </datalist>
              </FormField>
              <FormField label="League" hint="Selecciona una liga existente o escribe una nueva. Se creará y asociará al equipo automáticamente.">
                <input
                  type="text"
                  list="team-league-options"
                  value={form.leagueName}
                  onChange={(event) => {
                    const leagueName = event.target.value;
                    const matched = leagues.find((league) => normalizeComparable(recordName(league)) === normalizeComparable(leagueName));
                    updateField("leagueName", leagueName);
                    updateField("leagueId", matched ? recordId(matched) : "");
                    if (matched) {
                      updateField("leagueCountry", importedValue(matched.country));
                      updateField("leagueLevel", importedValue(matched.league_level || matched.level || 1));
                    }
                  }}
                  placeholder="Search or create league..."
                  className={inputClassName}
                />
                <datalist id="team-league-options">
                  {leagues.map((league) => (
                    <option key={recordId(league) || recordName(league)} value={recordName(league)} />
                  ))}
                </datalist>
              </FormField>
              {textField("leagueSeason", "League season", "2026-2027")}
              {textField("leagueLevel", "League level", "1", { type: "number", min: 1, max: 20 })}
              {selectField("continent", "Continent", ["Europe", "South America", "North America", "Asia", "Africa", "Oceania"])}
              {textField("city", "City", "e.g. Madrid")}
              {textField("foundedYear", "Founded year", "1902", { type: "number", min: 1800, max: 2100 })}
              <FormField
                label="Logo URL"
                hint="Puedes pegar una URL con o sin https://. Las rutas de FotMob se normalizan automáticamente."
              >
                <input
                  type="text"
                  value={form.logo}
                  onChange={(event) => updateField("logo", event.target.value)}
                  onBlur={() => updateField("logo", normalizeLogoUrl(form.logo))}
                  placeholder="https://images.fotmob.com/..."
                  className={inputClassName}
                />
              </FormField>
              <LogoAndColorPicker
                logoUrl={form.logo}
                primaryColor={form.primaryColor}
                secondaryColor={form.secondaryColor}
                onChange={updateField}
              />
            </div>
          </section>

          <section>
            <SectionHeader icon={Palette} title="Identity & classification" description="Colors and internal club categories." />
            <div className="grid gap-4 md:grid-cols-2">
              {textField("reputation", "Reputation (0-10000)", "e.g. 9500", { type: "number", min: 0, max: 10000, step: 1, hint: "Numeric score from 0 to 10000." })}
              {textField("market", "Market value (€)", "e.g. 458223670", { type: "number", min: 0, step: 1000000, hint: "Valor de mercado o valor comercial estimado en euros. Ejemplo: 458223670." })}
            </div>
          </section>

          <section>
            <SectionHeader icon={Building2} title="Stadium" description="Main stadium information and images." />
            <div className="grid gap-4 md:grid-cols-2">
              {textField("stadium", "Stadium name", "e.g. Santiago Bernabéu")}
              {textField("stadiumId", "Stadium ID", "Internal Stadium record ID")}
              {textField("stadiumCapacity", "Capacity", "81000", { type: "number", min: 0 })}
              {textField("stadiumBuiltYear", "Built year", "1947", { type: "number", min: 1800, max: 2100 })}
              {textField("stadiumRenovation", "Last renovation year", "2024", { type: "number", min: 1800, max: 2100 })}
              {textField("pitchDimensions", "Pitch dimensions", "105 x 68 m")}
              {textField("stadiumInteriorUrl", "Interior image URL", "https://...")}
              {textField("stadiumExteriorUrl", "Exterior image URL", "https://...")}
            </div>
          </section>

          <section>
            <SectionHeader icon={Users} title="Staff & key players" description="Current personnel. Leave fields blank when unknown." />
            <div className="grid gap-4 md:grid-cols-2">
              {textField("coachName", "Coach name", "e.g. Coach name")}
              {textField("coachPhotoUrl", "Coach photo URL", "https://...")}
              {textField("captainName", "Captain name", "e.g. Captain name")}
              {textField("captainPhotoUrl", "Captain photo URL", "https://...")}
              {textField("secondCaptainName", "Second captain", "e.g. Second captain")}
              {textField("secondCaptainPhotoUrl", "Second captain photo URL", "https://...")}
              {textField("keyPlayerName", "Key player", "e.g. Player name")}
              {textField("keyPlayerPhotoUrl", "Key player photo URL", "https://...")}
            </div>
          </section>

          <section>
            <SectionHeader icon={Shirt} title="Kits" description="Home, away and third kit information." />
            <div className="space-y-5">
              {[1, 2, 3].map((kitNumber) => (
                <div key={kitNumber} className="rounded-xl border border-slate-200 p-4">
                  <h4 className="mb-3 text-xs font-extrabold uppercase tracking-wide text-slate-700">{kitNumber === 1 ? "First kit" : kitNumber === 2 ? "Second kit" : "Third kit"}</h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    {textField(`kit${kitNumber}PhotoUrl`, "Photo URL", "https://...")}
                    {textField(`kit${kitNumber}ShopUrl`, "Shop URL", "https://...")}
                    {textField(`kit${kitNumber}BadgeBg`, "Badge background", "#FFFFFF")}
                    {textField(`kit${kitNumber}BadgeText`, "Badge text color", "#000000")}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <SectionHeader icon={Database} title="History & status" description="Additional information and completion state." />
            <div className="space-y-4">
              <FormField label="Club history">
                <textarea value={form.history} onChange={(event) => updateField("history", event.target.value)} placeholder="Write the club history here..." className={textareaClassName} />
              </FormField>
              <div className="grid gap-4 md:grid-cols-2">
                {selectField("dataSource", "Data source", ["Manual", "Other"])}
                <FormField label="Active club">
                  <label className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm text-slate-700">
                    <input type="checkbox" checked={form.isActive} onChange={(event) => updateField("isActive", event.target.checked)} />
                    Team is active
                  </label>
                </FormField>
              </div>
            </div>
          </section>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-5">
            <button type="button" onClick={onClose} className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">Cancel</button>
            <button type="submit" className="flex h-10 items-center gap-2 rounded-xl bg-[#003399] px-4 text-xs font-semibold text-white transition hover:bg-[#002477]">
              <Plus size={15} />
              Add team
            </button>
          </div>
        </form>
      </div>
    </div>
  );
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

function recordId(record) {
  return record?.id || record?._id || record?.uuid || record?.record_id || "";
}

function recordName(record) {
  return record?.name || record?.short_name || record?.shortName || record?.title || "";
}

function normalizeSeason(value) {
  const season = importedValue(value).trim();
  const match = season.match(/^(\d{4})[\/-](\d{2,4})$/);
  if (!match) return season;
  const end = match[2].length === 2 ? `${match[1].slice(0, 2)}${match[2]}` : match[2];
  return `${match[1]}-${end}`;
}

function normalizeComparable(value) {
  return importedValue(value).trim().toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeReputation(value) {
  if (value === null || value === undefined || value === "") return "";

  const numeric = Number(String(value).replace(/[^0-9.-]/g, ""));
  if (Number.isFinite(numeric)) {
    return String(Math.max(0, Math.min(10000, Math.round(numeric))));
  }

  const normalized = normalizeComparable(value);
  const reputationMap = {
    elite: 9500,
    high: 8000,
    medium: 6000,
    low: 3500,
    unclassified: "",
  };

  return Object.prototype.hasOwnProperty.call(reputationMap, normalized)
    ? String(reputationMap[normalized])
    : "";
}

function normalizeMarketValue(value) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "number" && Number.isFinite(value)) return String(Math.max(0, Math.round(value)));

  const raw = String(value).trim();
  const normalized = normalizeComparable(raw);

  // Los valores cualitativos antiguos no contienen una cifra fiable.
  // No inventamos una valoración económica a partir de High/Medium/Low.
  if (["high", "medium", "low", "unclassified", "elite"].includes(normalized)) return "";

  // Admite formatos como 458,223,670 €, 458.223.670 € o 458223670.
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return "";
  const numeric = Number(digits);
  return Number.isFinite(numeric) ? String(Math.max(0, Math.round(numeric))) : "";
}

function mapImportedTeamToForm(data) {
  const stadium = data.stadium || {};
  const classification = data.classification || {};
  const staff = data.staff || {};
  const kits = data.kits || {};
  const competitions = Array.isArray(data.competitions) ? data.competitions : [];
  const currentCompetition = competitions.find((competition) => String(competition.status || "").toLowerCase() === "current") || competitions[0] || {};

  return {
    ...emptyTeamForm,
    name: importedValue(data.name),
    shortName: importedValue(data.short_name),
    country: importedValue(data.country),
    countryId: importedValue(data.country_id),
    leagueName: importedValue(currentCompetition.name),
    leagueId: "",
    leagueSeason: normalizeSeason(currentCompetition.season),
    leagueCountry: importedValue(currentCompetition.country || data.country),
    leagueLevel: importedValue(currentCompetition.level || 1),
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
    reputation: normalizeReputation(classification.reputation ?? data.reputation),
    market: normalizeMarketValue(classification.market_value ?? classification.marketValue ?? data.market_value ?? data.market),
    history: importedValue(typeof data.history === "string" ? data.history : [data.history?.foundation, data.history?.origin].filter(Boolean).join("\n\n")),
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
    dataSource: "Manual",
    isActive: true,
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

export default function Teams() {
  const [teams, setTeams] = useState([]);
  const [countries, setCountries] = useState([]);
  const [leagues, setLeagues] = useState([]);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("countries");
  const [searchOpen, setSearchOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [importJsonModalOpen, setImportJsonModalOpen] = useState(false);
  const [form, setForm] = useState(emptyTeamForm);

  useEffect(() => {
    let cancelled = false;

    const loadReferenceData = async () => {
      try {
        const [teamRecords, countryRecords, leagueRecords] = await Promise.all([
          base44.entities.Team.list(),
          base44.entities.Country.list(),
          base44.entities.League.list(),
        ]);

        if (cancelled) return;

        const countryMap = new Map((countryRecords || []).map((country) => [recordId(country), recordName(country)]));
        setCountries(Array.isArray(countryRecords) ? countryRecords : []);
        setLeagues(Array.isArray(leagueRecords) ? leagueRecords : []);
        setTeams((teamRecords || []).map((team) => ({
          id: recordId(team),
          name: team.name || "Unnamed team",
          shortName: team.short_name || team.shortName || "",
          country: countryMap.get(team.country_id) || team.country || team.country_id || "Unknown country",
          countryId: team.country_id || "",
          continent: team.continent || "Unknown continent",
          city: team.city || "",
          logo: team.logo || "",
          reputation: team.reputation ?? "",
          market: team.market ?? "",
          competition: team.competition || "Without competition",
          incomplete: !team.name || !team.short_name || !team.country_id || !team.logo,
        })));
      } catch (error) {
        console.error("Error loading teams, countries and leagues:", error);
      }
    };

    loadReferenceData();
    return () => { cancelled = true; };
  }, []);

  const filteredTeams = useMemo(() => {
    const normalizedSearch = search.toLowerCase().trim();

    return teams.filter((team) => {
      if (!normalizedSearch) return true;

      return [team.name, team.country, team.competition, team.city]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedSearch));
    });
  }, [teams, search]);

  const groupedTeams = useMemo(() => {
    const groups = {};

    filteredTeams.forEach((team) => {
      let groupName;

      if (activeFilter === "countries") groupName = team.country || "Unknown country";
      else if (activeFilter === "continents") groupName = team.continent || "Unknown continent";
      else if (activeFilter === "reputation") groupName = team.reputation ?? "Unclassified";
      else if (activeFilter === "market") groupName = team.market ?? "Unclassified";
      else if (activeFilter === "incomplete") {
        if (!team.incomplete) return;
        groupName = "Incomplete information";
      }

      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(team);
    });

    return groups;
  }, [filteredTeams, activeFilter]);

  const handleAddTeam = async (event) => {
    event.preventDefault();

    if (!form.name.trim() || !form.shortName.trim() || !form.country.trim()) {
      alert("Name, short name and country are required.");
      return;
    }

    try {
      let countryId = form.countryId.trim();
      const existingCountry = countries.find((country) => normalizeComparable(recordName(country)) === normalizeComparable(form.country));

      if (existingCountry) {
        countryId = recordId(existingCountry);
      } else {
        const createdCountry = await base44.entities.Country.create({ name: form.country.trim() });
        countryId = recordId(createdCountry);
        setCountries((current) => [...current, createdCountry]);
      }

      if (!countryId) throw new Error("No se pudo obtener el identificador del país.");

      let leagueId = form.leagueId.trim();
      if (form.leagueName.trim()) {
        const existingLeague = leagues.find((league) => normalizeComparable(recordName(league)) === normalizeComparable(form.leagueName));
        if (existingLeague) {
          leagueId = recordId(existingLeague);
        } else {
          const createdLeague = await base44.entities.League.create({
            name: form.leagueName.trim(),
            country: form.leagueCountry.trim() || form.country.trim(),
            continent: form.continent,
            league_level: form.leagueLevel ? Number(form.leagueLevel) : 1,
            status: "Incompleto",
          });
          leagueId = recordId(createdLeague);
          setLeagues((current) => [...current, createdLeague]);
        }
      }

      const newTeam = {
      id: `manual-${Date.now()}`,
      name: form.name.trim(),
      shortName: form.shortName.trim().toUpperCase(),
      country: form.country.trim(),
      countryId,
      leagueName: form.leagueName.trim(),
      leagueId,
      leagueSeason: form.leagueSeason.trim(),
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
      reputation: form.reputation === "" ? null : Number(form.reputation),
      market: form.market === "" ? null : Number(form.market),
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
      dataSource: form.dataSource,
      isActive: form.isActive,
      incomplete: !form.name.trim() || !form.shortName.trim() || !form.countryId.trim() || !form.logo.trim(),
      competition: "Without competition",
    };

      const savedTeam = await base44.entities.Team.create({
    name: newTeam.name,
    short_name: newTeam.shortName,
    country_id: newTeam.countryId,
    city: newTeam.city,
    logo: newTeam.logo,
    primary_color: newTeam.primaryColor,
    secondary_color: newTeam.secondaryColor,
    founded_year: newTeam.foundedYear,
    stadium_id: newTeam.stadiumId,
    stadium: newTeam.stadium,
    stadium_capacity: newTeam.stadiumCapacity,
    stadium_built_year: newTeam.stadiumBuiltYear,
    stadium_renovation: newTeam.stadiumRenovation,
    pitch_dimensions: newTeam.pitchDimensions,
    stadium_interior_url: newTeam.stadiumInteriorUrl,
    stadium_exterior_url: newTeam.stadiumExteriorUrl,
    reputation: newTeam.reputation,
    market: newTeam.market,
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

      if (leagueId && newTeam.leagueSeason) {
        await base44.entities.TeamLeague.create({
          team_id: savedTeam.id,
          league_id: leagueId,
          season: newTeam.leagueSeason,
          is_current: true,
        });
      }

  setTeams((currentTeams) => [
    ...currentTeams,
    {
      ...newTeam,
      id: savedTeam.id,
    },
  ]);

  setForm(emptyTeamForm);
  setAddModalOpen(false);
  setActiveFilter("countries");
} catch (error) {
  console.error("Error saving team:", error);
  alert("Could not save the team to Base44.");
}
  };

  const handleImportJson = (importedForm) => {
    setForm(importedForm);
    setImportJsonModalOpen(false);
    setAddModalOpen(true);
  };

  const handleCloseSearch = () => {
    setSearch("");
    setSearchOpen(false);
  };

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

          <button type="button" onClick={() => setImportJsonModalOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50" aria-label="Import team from text or JSON" title="Import team from text or JSON">
            <FileJson size={17} strokeWidth={2} />
          </button>

          <button type="button" onClick={() => setAddModalOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#003399] text-white transition hover:bg-[#002477]" aria-label="Add team" title="Add team">
            <Plus size={18} strokeWidth={2} />
          </button>
        </div>
      </div>

      {Object.keys(groupedTeams).length > 0 ? (
        <div className="space-y-5">
          {Object.entries(groupedTeams).map(([groupName, groupTeams]) => {
            const competitions = groupTeams.reduce((groups, team) => {
              const competition = team.competition || "Without competition";
              if (!groups[competition]) groups[competition] = [];
              groups[competition].push(team);
              return groups;
            }, {});

            return (
              <section key={groupName} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.02)] md:p-5">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <h2 className="text-base font-extrabold text-slate-900">{groupName}</h2>
                  <span className="text-xs font-medium text-slate-400">{groupTeams.length} {groupTeams.length === 1 ? "team" : "teams"}</span>
                </div>
                <div className="space-y-6">
                  {Object.entries(competitions).map(([competitionName, competitionTeams]) => (
                    <div key={competitionName}>
                      <CompetitionHeader competitionName={competitionName} teams={competitionTeams} />
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                        {competitionTeams.map((team) => <TeamCard key={team.id} team={team} />)}
                      </div>
                    </div>
                  ))}
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
          <button type="button" onClick={() => setAddModalOpen(true)} className="mt-5 rounded-xl bg-[#003399] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#002477]">Add first team</button>
        </div>
      )}

      {addModalOpen && (
  <AddTeamModal
    form={form}
    setForm={setForm}
    countries={countries}
    leagues={leagues}
    onClose={() => setAddModalOpen(false)}
    onSubmit={handleAddTeam}
  />
)}
      {importJsonModalOpen && <ImportTeamJsonModal onClose={() => setImportJsonModalOpen(false)} onImport={handleImportJson} />}
    </div>
  );
}
