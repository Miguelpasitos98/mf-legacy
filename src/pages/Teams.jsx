import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useOutletContext } from "react-router-dom";
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
  countryCode: "",
  leagueId: "",
  newLeagueName: "",
  season: "2026-2027",
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
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (/^(https?:|data:|blob:)/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
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
      <div className="flex h-20 w-20 shrink-0 items-center justify-center bg-transparent">
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

function TeamCard({ team, onOpen }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex min-h-[112px] w-full flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-center transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm"
    >
      <TeamLogo team={team} />
      <span className="w-full truncate text-xs font-bold text-slate-800 transition group-hover:text-[#003399]">
        {team.name}
      </span>
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
  const [logoImageError, setLogoImageError] = useState(false);
  const [logoPalette, setLogoPalette] = useState([]);
  const [colorTarget, setColorTarget] = useState("primary");
  const [isLogoZoomOpen, setIsLogoZoomOpen] = useState(false);

  const logoPreviewUrl = normalizeImageUrl(form.logo);

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
              <FormField label="Country *" hint="Selecciona un país existente o elige crear uno nuevo.">
                <select
                  value={form.countryId || "__new__"}
                  onChange={(event) => {
                    const selectedId = event.target.value;
                    if (selectedId === "__new__") {
                      updateField("countryId", "");
                      updateField("country", "");
                      updateField("countryCode", "");
                      return;
                    }

                    const selectedCountry = countries.find((country) => String(country.id) === String(selectedId));
                    updateField("countryId", selectedId);
                    updateField("country", selectedCountry?.name || "");
                    updateField("countryCode", selectedCountry?.code || "");
                    if (selectedCountry?.continent) updateField("continent", selectedCountry.continent);
                  }}
                  className={inputClassName}
                >
                  <option value="__new__">+ Create or enter a new country</option>
                  {countries
                    .filter((country) => country.id && country.name)
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((country) => (
                      <option key={country.id} value={country.id}>
                        {country.name}{country.code ? ` (${country.code})` : ""}
                      </option>
                    ))}
                </select>
                {countries.length === 0 && (
                  <p className="mt-1 text-[11px] text-amber-600">No se han cargado países existentes. Puedes crear uno abajo.</p>
                )}
              </FormField>

              {!form.countryId && (
                <>
                  {textField("country", "New country name *", "e.g. Spain")}
                  {textField("countryCode", "Country code *", "e.g. ESP", { hint: "Código de 2 o 3 letras. Se utiliza al crear el país." })}
                </>
              )}

              <FormField label="League" hint="Selecciona una liga existente o crea una nueva.">
                <select
                  value={form.leagueId}
                  onChange={(event) => {
                    const selectedId = event.target.value;
                    updateField("leagueId", selectedId);
                    updateField("newLeagueName", "");
                  }}
                  className={inputClassName}
                >
                  <option value="">Without league</option>
                  {leagues
                    .filter((league) => league.id && league.name)
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((league) => (
                      <option key={league.id} value={league.id}>
                        {league.name}{league.shortName ? ` (${league.shortName})` : ""}
                      </option>
                    ))}
                </select>
              </FormField>

              <FormField label="New league name (optional)" hint="Si introduces un nombre que no existe, se intentará crear automáticamente. Déjalo vacío si no quieres asociar una liga.">
                  <input
                    type="text"
                    value={form.newLeagueName}
                    onChange={(event) => updateField("newLeagueName", event.target.value)}
                    placeholder="e.g. LaLiga EA Sports"
                    className={inputClassName}
                  />
                </FormField>

              {form.leagueId && (
                <FormField label="Season *" hint="Ejemplo: 2026-2027">
                  <input type="text" value={form.season} onChange={(event) => updateField("season", event.target.value)} placeholder="2026-2027" className={inputClassName} required />
                </FormField>
              )}
              {selectField("continent", "Continent", ["Europe", "South America", "North America", "Asia", "Africa", "Oceania"])}
              {textField("city", "City", "e.g. Madrid")}
              {textField("foundedYear", "Founded year", "1902", { type: "number", min: 1800, max: 2100 })}
              <div className="md:col-span-2">
                <FormField label="Logo URL" hint="Puedes pegar una URL completa o una dirección como fotmob.com/image_resources/logo/teamlogo/8633_large.png">
                  <input
                    type="text"
                    value={form.logo}
                    onChange={(event) => {
                      updateField("logo", event.target.value);
                      setLogoImageError(false);
                      setLogoPalette([]);
                    }}
                    placeholder="https://..."
                    className={inputClassName}
                  />
                </FormField>

                {logoPreviewUrl && (
                  <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-4 md:flex-row">
                      <div className="relative flex min-h-[180px] w-full items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white md:w-56">
                        <img
                          src={logoPreviewUrl}
                          alt="Logo preview"
                          className="max-h-44 max-w-[90%] object-contain"
                          onLoad={() => {
                            setLogoImageError(false);
                            const paletteImage = new Image();
                            paletteImage.crossOrigin = "anonymous";
                            paletteImage.onload = () => setLogoPalette(extractImagePalette(paletteImage));
                            paletteImage.onerror = () => setLogoPalette([]);
                            paletteImage.src = logoPreviewUrl;
                          }}
                          onError={() => {
                            setLogoImageError(true);
                            setLogoPalette([]);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setIsLogoZoomOpen(true)}
                          className="absolute bottom-2 right-2 rounded-lg bg-slate-900/80 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-900"
                        >
                          Ampliar imagen
                        </button>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div>
                            <h4 className="text-xs font-extrabold uppercase tracking-wide text-slate-800">Logo palette</h4>
                            <p className="mt-1 text-[11px] text-slate-500">Pulsa un color para asignarlo al campo seleccionado.</p>
                          </div>
                          <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-slate-500">
                            {colorTarget === "primary" ? "Primary" : "Secondary"}
                          </span>
                        </div>

                        <div className="mb-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setColorTarget("primary")}
                            className={`rounded-lg px-3 py-2 text-xs font-semibold ${colorTarget === "primary" ? "bg-[#003399] text-white" : "border border-slate-200 bg-white text-slate-700"}`}
                          >
                            Seleccionar primario
                          </button>
                          <button
                            type="button"
                            onClick={() => setColorTarget("secondary")}
                            className={`rounded-lg px-3 py-2 text-xs font-semibold ${colorTarget === "secondary" ? "bg-[#003399] text-white" : "border border-slate-200 bg-white text-slate-700"}`}
                          >
                            Seleccionar secundario
                          </button>
                        </div>

                        {logoImageError ? (
                          <p className="text-xs text-red-600">No se pudo cargar la imagen. Comprueba que la URL sea pública y completa.</p>
                        ) : logoPalette.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {logoPalette.map((color) => (
                              <button
                                key={color}
                                type="button"
                                title={`Asignar ${color} a ${colorTarget}`}
                                onClick={() => updateField(colorTarget === "primary" ? "primaryColor" : "secondaryColor", color)}
                                className="group flex w-14 flex-col items-center gap-1 rounded-lg border border-slate-200 bg-white p-1.5 hover:border-[#003399]"
                              >
                                <span className="h-8 w-8 rounded-md border border-slate-200" style={{ backgroundColor: color }} />
                                <span className="text-[9px] font-semibold text-slate-500">{color}</span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400">Introduce una imagen compatible para detectar colores. Si el servidor bloquea el análisis, puedes introducir el HEX manualmente.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section>
            <SectionHeader icon={Palette} title="Identity & classification" description="Colors and internal club categories." />
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Primary color" hint="HEX seleccionado desde la paleta o introducido manualmente.">
                <div className="flex gap-2">
                  <input type="color" value={/^#[0-9A-Fa-f]{6}$/.test(form.primaryColor) ? form.primaryColor : "#FFFFFF"} onChange={(event) => updateField("primaryColor", event.target.value.toUpperCase())} className="h-10 w-12 cursor-pointer rounded-lg border border-slate-200 bg-white p-1" />
                  <input type="text" value={form.primaryColor} onChange={(event) => updateField("primaryColor", event.target.value.toUpperCase())} placeholder="#FFFFFF" className={inputClassName} />
                </div>
              </FormField>
              <FormField label="Secondary color" hint="HEX seleccionado desde la paleta o introducido manualmente.">
                <div className="flex gap-2">
                  <input type="color" value={/^#[0-9A-Fa-f]{6}$/.test(form.secondaryColor) ? form.secondaryColor : "#000000"} onChange={(event) => updateField("secondaryColor", event.target.value.toUpperCase())} className="h-10 w-12 cursor-pointer rounded-lg border border-slate-200 bg-white p-1" />
                  <input type="text" value={form.secondaryColor} onChange={(event) => updateField("secondaryColor", event.target.value.toUpperCase())} placeholder="#000000" className={inputClassName} />
                </div>
              </FormField>
              {textField("reputation", "Reputation (0-10000)", "9500", { type: "number", min: 0, max: 10000, step: 1 })}
              {textField("market", "Market value (€)", "25.000.001", {
  type: "text",
  inputMode: "numeric",
  hint: "Introduce el valor total en euros. Ejemplo: 25.000.001"
})}
            </div>
          </section>

          {isLogoZoomOpen && logoPreviewUrl && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 p-5" role="dialog" aria-modal="true" aria-label="Expanded logo preview">
              <button type="button" onClick={() => setIsLogoZoomOpen(false)} className="absolute right-5 top-5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-800">Cerrar</button>
              <img src={logoPreviewUrl} alt="Expanded logo preview" className="max-h-[85vh] max-w-[90vw] object-contain" />
            </div>
          )}

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

function numericValue(value, fallback = "0") {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  const normalized = String(value).trim().toLowerCase();
  const categoryMap = { elite: "9500", high: "8000", medium: "6000", low: "3500", unclassified: "0" };
  if (categoryMap[normalized]) return categoryMap[normalized];
  const digits = normalized.replace(/[^0-9.-]/g, "");
  return digits && Number.isFinite(Number(digits)) ? digits : fallback;
}

function marketValue(value, fallback = "0") {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  const normalized = String(value).trim();
  if (!normalized || /^(high|medium|low|elite|unclassified)$/i.test(normalized)) return fallback;
  const digits = normalized.replace(/[^0-9.-]/g, "");
  return digits && Number.isFinite(Number(digits)) ? digits : fallback;
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
    market: marketValue(data.market_value ?? data.market, "0"),
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


function TeamDetail({ team, onClose }) {
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
  const teamName = team.name || "Equipo";
  const shortName = team.shortName || team.short_name || "";

  return (
    <div
      className="relative min-h-full overflow-hidden p-4 md:p-8"
      style={{
        backgroundColor: primaryColor,
      }}
    >
      {/* Fondo secundario diagonal */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundColor: secondaryColor,
          clipPath: "polygon(58% 0, 100% 0, 100% 100%, 43% 100%)",
        }}
      />

      {/* Degradado decorativo */}
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          background: `linear-gradient(135deg, transparent 35%, ${secondaryColor} 65%)`,
        }}
      />

      <div className="relative z-10">
        {/* Cabecera */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/30 bg-white/10 px-4 py-2 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
          >
            ← Volver a equipos
          </button>

          <span className="text-xs font-semibold uppercase tracking-widest text-white/70">
            Team profile
          </span>
        </div>

        {/* Panel principal */}
        <div className="relative overflow-hidden rounded-2xl border border-white/20 bg-black/10 shadow-2xl">
          {/* Marca de agua del escudo */}
          {team.logo && (
            <img
              src={team.logo}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute right-[-90px] top-1/2 h-[650px] w-[650px] -translate-y-1/2 object-contain opacity-[0.09] grayscale"
            />
          )}

          <div className="relative z-10 grid min-h-[650px] grid-cols-1 md:grid-cols-2">
            {/* LADO IZQUIERDO */}
            <div className="flex flex-col justify-between p-8 md:p-12">
              <div>
                {/* Lema */}
                <div className="mb-8 flex items-center gap-3">
                  <div className="flex gap-2">
                    <span
                      className="h-1 w-10"
                      style={{ backgroundColor: primaryColor }}
                    />
                    <span
                      className="h-1 w-10"
                      style={{ backgroundColor: secondaryColor }}
                    />
                  </div>

                  <span className="text-xs font-bold uppercase tracking-[0.3em] text-white/80">
                    Más que un club
                  </span>
                </div>

                {/* Nombre */}
                <p className="mb-3 text-sm font-bold uppercase tracking-[0.3em] text-white/60">
                  {shortName || "Football Club"}
                </p>

                <h1 className="max-w-xl text-6xl font-black uppercase leading-[0.85] tracking-tight text-white md:text-8xl">
                  {teamName.split(" ").map((word, index) => (
                    <span key={`${word}-${index}`} className="block">
                      {word}
                    </span>
                  ))}
                </h1>

                <p className="mt-7 text-xs font-medium uppercase tracking-[0.35em] text-white/60">
                  MF LEGACY · TEAM PROFILE
                </p>
              </div>

              {/* Datos del equipo */}
              <div className="mt-16">
                <div className="grid grid-cols-2 gap-6 md:grid-cols-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">
                      Año de fundación
                    </p>

                    <p className="mt-2 text-lg font-bold text-white">
                      {foundedYear || "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">
                      País
                    </p>

                    <p className="mt-2 text-lg font-bold text-white">
                      {country || "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">
                      Ciudad
                    </p>

                    <p className="mt-2 text-lg font-bold text-white">
                      {city || "—"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Número de fundación */}
              <div className="mt-8 hidden overflow-hidden md:block">
                <span className="select-none text-[150px] font-black leading-none text-white/[0.08]">
                  {foundedYear || "FC"}
                </span>
              </div>
            </div>

            {/* LADO DERECHO */}
            <div className="relative flex min-h-[420px] flex-col items-center justify-center p-8 md:min-h-0 md:p-10">
              {/* Etiqueta de identidad */}
              <div className="absolute right-8 top-10 text-right md:right-12">
                <p className="text-xs font-bold uppercase tracking-[0.35em] text-white/80">
                  Identity
                </p>

                <div className="ml-auto mt-3 flex gap-2">
                  <span
                    className="h-1 w-8"
                    style={{ backgroundColor: primaryColor }}
                  />
                  <span
                    className="h-1 w-8"
                    style={{ backgroundColor: secondaryColor }}
                  />
                </div>
              </div>

              {/* Escudo */}
              <div className="relative mt-12 flex h-64 w-64 items-center justify-center md:h-[350px] md:w-[350px]">
                <div className="absolute inset-0 rounded-full bg-white/10 blur-3xl" />

                {team.logo ? (
                  <img
                    src={team.logo}
                    alt={`${teamName} logo`}
                    className="relative z-10 h-full w-full object-contain drop-shadow-2xl"
                  />
                ) : (
                  <div className="relative z-10 flex h-48 w-48 items-center justify-center rounded-full border border-white/30 bg-white/10 text-4xl font-black text-white">
                    {shortName || "FC"}
                  </div>
                )}
              </div>

              {/* Nombre corto */}
              <div className="mt-8 text-center">
                <p className="text-xs font-bold uppercase tracking-[0.35em] text-white/60">
                  {shortName || city || "Football Club"}
                </p>

                <h2 className="mt-3 text-2xl font-black uppercase tracking-[0.2em] text-white">
                  {city || country || "LEGACY"}
                </h2>
              </div>

              {/* Decoración lateral */}
              <div className="absolute bottom-10 right-8 flex items-center gap-3 md:right-12">
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/70">
                    Tradition
                  </p>

                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/70">
                    Identity
                  </p>

                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/70">
                    Legacy
                  </p>
                </div>

                <div className="flex h-16 w-1 flex-col">
                  <div
                    className="h-1/2"
                    style={{ backgroundColor: primaryColor }}
                  />

                  <div
                    className="h-1/2"
                    style={{ backgroundColor: secondaryColor }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Línea inferior */}
          <div className="absolute bottom-0 left-0 right-0 flex h-1">
            <div
              className="w-1/2"
              style={{ backgroundColor: primaryColor }}
            />

            <div
              className="w-1/2"
              style={{ backgroundColor: secondaryColor }}
            />
          </div>
        </div>
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
  const [selectedTeam, setSelectedTeam] = useState(null);
  const { setTeamTheme } = useOutletContext();

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

    const loadTeamLeagueRelations = async () => {
      try {
        const result = await base44.entities.TeamLeague.list();
        return getList(result);
      } catch (error) {
        console.error("Error loading team-league relations:", error);
        return [];
      }
    };

    const loadTeams = async (loadedCountries = [], loadedLeagues = [], relations = []) => {
      try {
        const result = await base44.entities.Team.list();
        const loadedTeams = getList(result);
        console.log("EQUIPOS CARGADOS DESDE BASE44:", loadedTeams);
        const currentRelationsByTeam = new globalThis.Map();
        relations.forEach((relation) => {
          const teamId = relation?.team_id || relation?.teamId || "";
          const isCurrent = relation?.is_current ?? relation?.isCurrent ?? true;
          if (teamId && isCurrent && !currentRelationsByTeam.has(String(teamId))) currentRelationsByTeam.set(String(teamId), relation);
        });

        const normalizedTeams = loadedTeams.map((team) => {
          const teamId = team.id || team._id || "";
          const teamCountryId = team.country_id || team.countryId || "";
          const country = loadedCountries.find((item) => String(item.id || "") === String(teamCountryId));
          const relation = currentRelationsByTeam.get(String(teamId));
          const leagueId = relation?.league_id || relation?.leagueId || "";
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
            market: marketValue(team.market, "0"),
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
            season: relation?.season || "",
            competition: league?.name || "Without competition",
            incomplete: !team.name || !team.short_name || !teamCountryId || !team.logo,
          };
        });
        if (!cancelled) setTeams(normalizedTeams);
      } catch (error) {
        console.error("Error loading teams:", error);
      }
    };

    const loadData = async () => {
      const [loadedCountries, loadedLeagues, relations] = await Promise.all([loadCountries(), loadLeagues(), loadTeamLeagueRelations()]);
      await loadTeams(loadedCountries, loadedLeagues, relations);
    };

    loadData();

    return () => {
      cancelled = true;
    };
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
      else if (activeFilter === "reputation") groupName = team.reputation || "Unclassified";
      else if (activeFilter === "market") groupName = team.market || "Unclassified";
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

    const newTeam = {
      id: `manual-${Date.now()}`,
      name: form.name.trim(),
      shortName: form.shortName.trim().toUpperCase(),
      country: form.country.trim(),
      countryId: form.countryId.trim(),
      countryCode: form.countryCode.trim().toUpperCase(),
      leagueId: form.leagueId.trim(),
      newLeagueName: form.newLeagueName.trim(),
      season: form.season.trim(),
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
      market: Number(form.market || 0),
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

        countryId = createdCountry?.id || createdCountry?.data?.id || createdCountry?._id || "";

        if (!countryId) {
          alert("The country was created, but Base44 did not return its ID. Check the Country entity response.");
          return;
        }

        setCountries((currentCountries) => [...currentCountries, { ...createdCountry, id: countryId }]);
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

      const generatedCode = newTeam.shortName
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 12) || `TEAM${Date.now()}`;

      const savedTeam = await base44.entities.Team.create({
    name: newTeam.name,
    short_name: newTeam.shortName,
    code: generatedCode,
    continent: newTeam.continent || "Europe",
    country_id: countryId,
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

  let savedRelation = null;
  if (leagueId) {
    savedRelation = await base44.entities.TeamLeague.create({
      team_id: savedTeam.id,
      league_id: leagueId,
      season: newTeam.season || "2026-2027",
      is_current: true,
    });
  }

  setTeams((currentTeams) => [
    ...currentTeams,
    {
      ...newTeam,
      id: savedTeam.id,
      competition: selectedLeague?.name || "Without competition",
      leagueId,
      season: savedRelation?.season || newTeam.season || "",
    },
  ]);

  setForm(emptyTeamForm);
  setAddModalOpen(false);
  setActiveFilter("countries");
} catch (error) {
  console.error("Error saving team:", error);
  const errorMessage =
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    (typeof error === "string" ? error : JSON.stringify(error));
  alert(`Error real de Base44:\n\n${errorMessage}`);
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

    if (selectedTeam) {
    return (
      <TeamDetail
        team={selectedTeam}
        onClose={() => setSelectedTeam(null)}
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
                        {competitionTeams.map((team) => (
  <TeamCard
    key={team.id}
    team={team}
    onOpen={() => setSelectedTeam(team)}
  />
))}
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
