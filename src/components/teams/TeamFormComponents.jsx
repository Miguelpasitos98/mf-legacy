import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Shield,
  Globe,
  TrendingUp,
  Building2,
  Users,
  Shirt,
  Database,
  X,
  ChevronDown,
  Search,
  Plus,
  Pipette,
  ClipboardPaste,
  Save,
} from "lucide-react";
import {
  inputClassName,
  textareaClassName,
  normalizeImageUrl,
  extractImagePalette,
  getCountryFlagUrl,
  formatMarketValue,
  cleanMarketInput,
  mapImportedTeamToForm,
  normalizeImportedTeamText,
} from "./teamUtils";
import TeamLogo from "./TeamLogo";

function FormField({ label, children, hint }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}

function SectionHeader({ icon: Icon, title, description, open }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
        <Icon size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-extrabold text-slate-900">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      </div>
      <ChevronDown size={17} className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
    </div>
  );
}

function CollapsibleSection({ icon, title, description, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-slate-50 md:px-5"
        aria-expanded={open}
      >
        <SectionHeader icon={icon} title={title} description={description} open={open} />
      </button>
      {open && (
        <div className="border-t border-slate-100 px-4 pb-5 pt-5 md:px-5">{children}</div>
      )}
    </section>
  );
}

function SearchableTeamSelect({
  value, onChange, options, kind, placeholder, searchPlaceholder, emptyOption, specialOption,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef(null);


  const getLabel = (item) => item?.name || "Unnamed";
  const getMeta = (item) =>
    kind === "country" ? item?.code || "" : item?.shortName || item?.short_name || "";
  const filteredOptions = options
    .filter((item) => item?.id && item?.name)
    .filter((item) => {
      const searchText = [item?.name, item?.shortName, item?.short_name, item?.code, item?.countryName]
        .filter(Boolean).join(" ").toLowerCase();
      return searchText.includes(query.trim().toLowerCase());
    })
    .sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || ""), "es", { sensitivity: "base" }));

  const selected = options.find((item) => String(item?.id) === String(value)) || null;
  const isEmptySelected = emptyOption && value === emptyOption.value;
  const isSpecialSelected = specialOption && value === specialOption.value;

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
              onError={(event) => { event.currentTarget.style.display = "none"; }}
            />
          ) : (
            <span className="text-[10px] font-bold text-slate-300">•</span>
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
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setQuery(""); }}>
      <PopoverAnchor asChild>
      <div ref={wrapperRef} className="relative min-w-0">
      <button
        type="button"
        onClick={() => { setOpen((current) => !current); setQuery(""); }}
        className={`${inputClassName} flex items-center gap-3 text-left`}
        aria-expanded={open}
      >
        {selected ? renderVisual(selected) : (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-[10px] font-bold text-slate-300">
            {kind === "country" ? "•" : "FC"}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate">
          <span className={selected ? "block text-slate-800" : "block text-slate-400"}>
            {selected ? getLabel(selected) : String(value) === String(emptyOption?.value) ? emptyOption.label : String(value) === String(specialOption?.value) ? specialOption.label : placeholder}
          </span>
        </span>
        {selected && getMeta(selected) ? (
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">{getMeta(selected)}</span>
        ) : null}
        <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      </div>
      </PopoverAnchor>
      {open && (
        <PopoverContent align="start" collisionPadding={12} sideOffset={6} onCloseAutoFocus={(event) => { event.preventDefault(); wrapperRef.current?.querySelector("button")?.focus(); }} className="w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-xl border border-slate-200 bg-white p-0 shadow-[0_18px_45px_rgba(15,23,42,0.14)]">
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
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${String(value) === String(emptyOption.value) ? "bg-[#003399]/[0.06] text-[#003399]" : "hover:bg-slate-50"}`}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-50 text-[10px] font-bold text-slate-300">{kind === "country" ? "•" : "FC"}</span>
                <span className="font-medium">{emptyOption.label}</span>
              </button>
            )}
            {filteredOptions.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => selectValue(item.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition ${String(item.id) === String(value) ? "bg-[#003399]/[0.06]" : "hover:bg-slate-50"}`}
              >
                {renderVisual(item)}
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{getLabel(item)}</span>
                {getMeta(item) ? (
                  <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">{getMeta(item)}</span>
                ) : null}
              </button>
            ))}
            {filteredOptions.length === 0 && (
              <div className="px-3 py-6 text-center text-xs text-slate-400">No results found.</div>
            )}
            {specialOption && (
              <button
                type="button"
                onClick={() => selectValue(specialOption.value)}
                className={`mt-1 flex w-full items-center gap-3 rounded-lg border-t border-slate-100 px-3 py-2.5 text-left text-sm font-semibold text-[#003399] transition hover:bg-[#003399]/[0.04] ${String(value) === String(specialOption.value) ? "bg-[#003399]/[0.06]" : ""}`}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#003399]/[0.08]"><Plus size={15} /></span>
                {specialOption.label}
              </button>
            )}
          </div>
        </PopoverContent>
      )}
    </Popover>
  );
}

function KitColorPicker({ kitNumber, photoUrl, badgeBg, badgeText, onChangeColor }) {
  const [palette, setPalette] = useState([]);
  const [imageError, setImageError] = useState(false);
  const [target, setTarget] = useState("badgeBg");
  const normalizedPhotoUrl = normalizeImageUrl(photoUrl);

  useEffect(() => {
    setPalette([]);
    setImageError(false);
    if (!normalizedPhotoUrl) return;
    const paletteImage = new Image();
    paletteImage.crossOrigin = "anonymous";
    paletteImage.onload = () => setPalette(extractImagePalette(paletteImage));
    paletteImage.onerror = () => { setPalette([]); setImageError(true); };
    paletteImage.src = normalizedPhotoUrl;
  }, [normalizedPhotoUrl]);

  const pickScreenColor = async () => {
    if (typeof window === "undefined" || !window.EyeDropper) return;
    try {
      const result = await new window.EyeDropper().open();
      if (result?.sRGBHex) onChangeColor(target, result.sRGBHex.toUpperCase());
    } catch { /* user cancelled */ }
  };

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-700">Kit colors</p>
          <p className="mt-1 text-[11px] text-slate-400">Selecciona el color del fondo o del texto de la insignia.</p>
        </div>
        <button
          type="button"
          onClick={pickScreenColor}
          disabled={typeof window === "undefined" || !window.EyeDropper}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          title="Usar cuentagotas del navegador"
        >
          <Pipette size={14} /> Cuentagotas
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => setTarget("badgeBg")} className={`rounded-lg px-3 py-2 text-[11px] font-semibold transition ${target === "badgeBg" ? "bg-[#003399] text-white" : "border border-slate-200 bg-white text-slate-700"}`}>Badge background</button>
        <button type="button" onClick={() => setTarget("badgeText")} className={`rounded-lg px-3 py-2 text-[11px] font-semibold transition ${target === "badgeText" ? "bg-[#003399] text-white" : "border border-slate-200 bg-white text-slate-700"}`}>Badge text</button>
        <input
          type="color"
          value={/^#[0-9A-Fa-f]{6}$/.test(target === "badgeBg" ? badgeBg : badgeText) ? (target === "badgeBg" ? badgeBg : badgeText) : "#FFFFFF"}
          onChange={(event) => onChangeColor(target, event.target.value.toUpperCase())}
          className="h-9 w-12 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
          title="Seleccionar color"
        />
      </div>

      {normalizedPhotoUrl ? (
        <div className="mt-3 grid gap-3 md:grid-cols-[180px_1fr]">
          <div className="flex min-h-[170px] items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-3">
            <img src={normalizedPhotoUrl} alt={`Kit ${kitNumber} preview`} className="max-h-[180px] w-full object-contain" onLoad={() => setImageError(false)} onError={() => setImageError(true)} />
          </div>
          <div>
            {imageError ? (
              <p className="text-xs text-red-600">No se pudo cargar la camiseta o el servidor no permite analizar sus colores.</p>
            ) : palette.length > 0 ? (
              <>
                <p className="text-[11px] font-semibold text-slate-600">Colores detectados</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {palette.map((color) => (
                    <button key={color} type="button" onClick={() => onChangeColor(target, color)} title={`Asignar ${color} a ${target === "badgeBg" ? "Badge background" : "Badge text"}`} className="group flex w-14 flex-col items-center gap-1 rounded-lg border border-slate-200 bg-white p-1.5 transition hover:border-[#003399]">
                      <span className="h-8 w-8 rounded-md border border-slate-200" style={{ backgroundColor: color }} />
                      <span className="text-[9px] font-semibold text-slate-500">{color}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-400">Introduce la URL de la camiseta para detectar una paleta de colores.</p>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-400">Introduce primero la foto de la camiseta.</p>
      )}
    </div>
  );
}

export function AddTeamModal({ form, setForm, countries, leagues, onClose, onSubmit, isEditing = false, formError = "" }) {
  const [logoImageError, setLogoImageError] = useState(false);
  const [logoPalette, setLogoPalette] = useState([]);
  const [colorTarget, setColorTarget] = useState("primary");
  const [isLogoZoomOpen, setIsLogoZoomOpen] = useState(false);
  const [isCreatingNewCountry, setIsCreatingNewCountry] = useState(!form.countryId);
  const [isCreatingNewLeague, setIsCreatingNewLeague] = useState(Boolean(form.newLeagueName?.trim()));

  const logoPreviewUrl = normalizeImageUrl(form.logo);

  const updateField = (field, value) => setForm((currentForm) => ({ ...currentForm, [field]: value }));

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
        step={options.step}
        inputMode={options.inputMode}
        required={Boolean(options.required)}
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

  const handleCountryChange = (selectedId) => {
    if (selectedId === "__new__") {
      setIsCreatingNewCountry(true);
      updateField("countryId", "");
      updateField("country", "");
      updateField("countryCode", "");
      return;
    }
    const selectedCountry = countries.find((country) => String(country.id) === String(selectedId));
    setIsCreatingNewCountry(false);
    updateField("countryId", selectedId);
    updateField("country", selectedCountry?.name || "");
    updateField("countryCode", selectedCountry?.code || "");
    if (selectedCountry?.continent) updateField("continent", selectedCountry.continent);
  };

  const handleLeagueChange = (selectedId) => {
    if (selectedId === "__new__") {
      setIsCreatingNewLeague(true);
      updateField("leagueId", "");
      return;
    }
    setIsCreatingNewLeague(false);
    updateField("leagueId", selectedId);
    updateField("newLeagueName", "");
  };

  const handleKitColorChange = (kitNumber, field, color) => {
    updateField(`kit${kitNumber}${field === "badgeBg" ? "BadgeBg" : "BadgeText"}`, color);
  };

  const modalContent = (
    <div className="mf-modal-overlay fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="add-team-title">
      <div className="mf-modal-panel relative z-10 max-h-[92dvh] w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="max-h-[92dvh] overflow-y-auto p-5 md:p-6">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h2 id="add-team-title" className="text-lg font-extrabold text-slate-900">{isEditing ? "Edit team" : "Add team"}</h2>
              <p className="mt-1 text-xs text-slate-500">{isEditing ? "Update the team's information." : "Create a complete club profile manually."}</p>
            </div>
            <button type="button" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800" aria-label="Close modal"><X size={18} /></button>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <CollapsibleSection icon={Shield} title="Identity" description="The essential information that defines the club." defaultOpen>
              <div className="grid gap-4 md:grid-cols-2">
                {textField("name", "Team name *", "e.g. Real Madrid", { required: true })}
                {textField("shortName", "Short name *", "e.g. RMA", { required: true })}
                <FormField label="Country *" hint="Busca un país por nombre o código.">
                  <SearchableTeamSelect value={form.countryId || "__new__"} onChange={handleCountryChange} options={countries} kind="country" placeholder="Select country" searchPlaceholder="Search country..." specialOption={{ value: "__new__", label: "+ Create or enter a new country" }} />
                </FormField>
                <div className="md:col-span-1">
                  {isCreatingNewCountry && (
                    <div className="grid gap-4">
                      {textField("country", "New country name *", "e.g. Spain", { required: true })}
                      {textField("countryCode", "Country code *", "e.g. ESP", { required: true, hint: "Código de 2 o 3 letras. Se utiliza al crear el país." })}
                    </div>
                  )}
                </div>
                {textField("city", "City", "e.g. Madrid")}
                {textField("foundedYear", "Founded year", "1902", { type: "number", min: 1800, max: 2100 })}
                <FormField label="Logo *" hint="El logo se usa como identidad principal del club.">
                  <input type="text" value={form.logo} onChange={(event) => { updateField("logo", event.target.value); setLogoImageError(false); setLogoPalette([]); }} placeholder="https://..." className={inputClassName} required />
                </FormField>
                <div className="md:col-span-2">
                  {logoPreviewUrl && (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="grid items-start gap-4 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
                        <div className="relative flex h-56 w-full items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-5">
                          <img src={logoPreviewUrl} alt="Logo preview" className="max-h-40 max-w-full object-contain" onLoad={() => { setLogoImageError(false); const paletteImage = new Image(); paletteImage.crossOrigin = "anonymous"; paletteImage.onload = () => setLogoPalette(extractImagePalette(paletteImage)); paletteImage.onerror = () => setLogoPalette([]); paletteImage.src = logoPreviewUrl; }} onError={() => { setLogoImageError(true); setLogoPalette([]); }} />
                          <button type="button" onClick={() => setIsLogoZoomOpen(true)} className="absolute bottom-2 right-2 rounded-lg bg-slate-900/80 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-900">Ampliar imagen</button>
                        </div>
                        <div className="min-w-0">
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <h4 className="text-xs font-extrabold uppercase tracking-wide text-slate-800">Logo palette</h4>
                              <p className="mt-1 text-[11px] text-slate-500">Pulsa un color para asignarlo al campo seleccionado.</p>
                            </div>
                            <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-slate-500">{colorTarget === "primary" ? "Primary" : "Secondary"}</span>
                          </div>
                          <div className="mb-3 flex flex-wrap gap-2">
                            <button type="button" onClick={() => setColorTarget("primary")} className={`rounded-lg px-3 py-2 text-xs font-semibold ${colorTarget === "primary" ? "bg-[#003399] text-white" : "border border-slate-200 bg-white text-slate-700"}`}>Seleccionar primario</button>
                            <button type="button" onClick={() => setColorTarget("secondary")} className={`rounded-lg px-3 py-2 text-xs font-semibold ${colorTarget === "secondary" ? "bg-[#003399] text-white" : "border border-slate-200 bg-white text-slate-700"}`}>Seleccionar secundario</button>
                          </div>
                          {logoImageError ? (
                            <p className="text-xs text-red-600">No se pudo cargar la imagen. Comprueba que la URL sea pública y completa.</p>
                          ) : logoPalette.length > 0 ? (
                            <div className="grid grid-cols-[repeat(auto-fill,minmax(58px,1fr))] gap-2">
                              {logoPalette.map((color) => (
                                <button key={color} type="button" title={`Asignar ${color} a ${colorTarget}`} onClick={() => updateField(colorTarget === "primary" ? "primaryColor" : "secondaryColor", color)} className="group flex min-w-0 flex-col items-center gap-1 rounded-lg border border-slate-200 bg-white p-1.5 hover:border-[#003399]">
                                  <span className="h-8 w-8 rounded-md border border-slate-200" style={{ backgroundColor: color }} />
                                  <span className="text-[9px] font-semibold text-slate-500">{color}</span>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400">Introduce una imagen compatible para detectar colores.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="md:col-span-2">
                  <p className="text-[11px] text-slate-400">El continente se completa automáticamente al seleccionar un país.</p>
                </div>
              </div>
            </CollapsibleSection>

            <CollapsibleSection icon={Globe} title="Competition" description="League and current competition." defaultOpen>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="League" hint="Busca una liga por nombre o abreviatura.">
                  <SearchableTeamSelect value={isCreatingNewLeague ? "__new__" : form.leagueId} onChange={handleLeagueChange} options={leagues} kind="league" placeholder="Without league" searchPlaceholder="Search league..." emptyOption={{ value: "", label: "Without league" }} specialOption={{ value: "__new__", label: "+ Create new league" }} />
                </FormField>
                {isCreatingNewLeague && (
                  <FormField label="New league name *" hint="Se intentará crearla si no existe.">
                    <input type="text" value={form.newLeagueName} onChange={(event) => updateField("newLeagueName", event.target.value)} placeholder="e.g. LaLiga EA Sports" className={inputClassName} required />
                  </FormField>
                )}
              </div>
            </CollapsibleSection>

            <CollapsibleSection icon={TrendingUp} title="Classification" description="Club colors, reputation and market." defaultOpen>
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
                <FormField label="Market value (€)" hint="Introduce el valor en euros. Se guardará y mostrará como 230,975,207 (€).">
                  <input type="text" value={form.market} onChange={(event) => updateField("market", cleanMarketInput(event.target.value))} onBlur={() => updateField("market", formatMarketValue(form.market, ""))} placeholder="230,975,207 (€)" className={inputClassName} inputMode="numeric" />
                </FormField>
              </div>
            </CollapsibleSection>

            <CollapsibleSection icon={Building2} title="Stadium" description="Stadium information and images.">
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
            </CollapsibleSection>

            <CollapsibleSection icon={Users} title="Staff & key players" description="Current personnel. Leave fields blank when unknown.">
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
            </CollapsibleSection>

            <CollapsibleSection icon={Shirt} title="Kits" description="Home, away and third kit information.">
              <div className="space-y-5">
                {[1, 2, 3].map((kitNumber) => (
                  <div key={kitNumber} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                    <div className="mb-3">
                      <h4 className="text-xs font-extrabold uppercase tracking-wide text-slate-700">{kitNumber === 1 ? "First kit" : kitNumber === 2 ? "Second kit" : "Third kit"}</h4>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {textField(`kit${kitNumber}PhotoUrl`, "Photo URL", "https://...")}
                      {textField(`kit${kitNumber}ShopUrl`, "Shop URL", "https://...")}
                    </div>
                    <KitColorPicker kitNumber={kitNumber} photoUrl={form[`kit${kitNumber}PhotoUrl`]} badgeBg={form[`kit${kitNumber}BadgeBg`]} badgeText={form[`kit${kitNumber}BadgeText`]} onChangeColor={(field, color) => handleKitColorChange(kitNumber, field, color)} />
                  </div>
                ))}
                <FormField label="Kits overview image" hint="Imagen general opcional de las equipaciones.">
                  <input type="text" value={form.kitsOverviewUrl} onChange={(event) => updateField("kitsOverviewUrl", event.target.value)} placeholder="https://..." className={inputClassName} />
                </FormField>
              </div>
            </CollapsibleSection>

            <CollapsibleSection icon={Database} title="Legacy & status" description="History, metadata and completion state.">
              <div className="space-y-4">
                <FormField label="Club history">
                  <textarea value={form.history} onChange={(event) => updateField("history", event.target.value)} placeholder="Write the club history here..." className={textareaClassName} />
                </FormField>
                <div className="grid gap-4 md:grid-cols-2">
                  {selectField("dataSource", "Data source", ["Manual", "Other"])}
                  <FormField label="Club creado por mí">
                    <label className="flex min-h-10 items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-950">
                      <input type="checkbox" checked={Boolean(form.isCustomClub)} onChange={(event) => updateField("isCustomClub", event.target.checked)} />
                      Es un club ficticio o creado por mí
                    </label>
                    <p className="mt-1 text-xs text-slate-500">Solo los clubes marcados aparecen en la galería «Mis clubes». No se marca automáticamente ningún equipo real.</p>
                  </FormField>
                  <FormField label="Active club">
                    <label className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm text-slate-700">
                      <input type="checkbox" checked={form.isActive} onChange={(event) => updateField("isActive", event.target.checked)} /> Team is active
                    </label>
                  </FormField>
                </div>
              </div>
            </CollapsibleSection>

            {isLogoZoomOpen && logoPreviewUrl && (
              <div className="mf-modal-overlay fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 p-5" role="dialog" aria-modal="true" aria-label="Expanded logo preview">
                <button type="button" onClick={() => setIsLogoZoomOpen(false)} className="absolute right-5 top-5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-800">Cerrar</button>
                <img src={logoPreviewUrl} alt="Expanded logo preview" className="max-h-[85dvh] max-w-[90vw] object-contain" />
              </div>
            )}

            {formError&&<div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{formError}</div>}
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-5">
              <button type="button" onClick={onClose} className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">Cancel</button>
              <button type="submit" className="flex h-10 items-center gap-2 rounded-xl bg-[#003399] px-4 text-xs font-semibold text-white transition hover:bg-[#002477]">{isEditing ? <Save size={15} /> : <Plus size={15} />}{isEditing ? "Save changes" : "Add team"}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modalContent, document.body) : null;
}

export function ImportTeamJsonModal({ onClose, onImport }) {
  const [mode, setMode] = useState("text");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");

  const handleImport = (event) => {
    event.preventDefault();
    setError("");
    const parsed = normalizeImportedTeamText(content);
    if (!parsed || (!parsed.name && !parsed.short_name)) {
      setError(mode === "text" ? "No se han identificado datos suficientes. Pega el JSON completo generado por el prompt o utiliza líneas con formato Campo: valor." : "El contenido debe ser un objeto JSON válido con al menos name o short_name.");
      return;
    }
    onImport(mapImportedTeamToForm(parsed));
  };

  return (
    <div className="mf-modal-overlay fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="import-team-json-title">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl md:p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id="import-team-json-title" className="text-lg font-extrabold text-slate-900">Añadir equipo mediante información</h2>
            <p className="mt-1 text-xs text-slate-500">Pega el resultado completo del prompt y carga los datos en el editor.</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800" aria-label="Close import dialog"><X size={18} /></button>
        </div>
        <div className="mb-4 flex gap-2">
          <button type="button" onClick={() => { setMode("text"); setError(""); }} className={`rounded-lg border px-4 py-2 text-xs font-semibold transition ${mode === "text" ? "border-[#073B35] bg-[#003399] text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>Pegar texto</button>
          <button type="button" onClick={() => { setMode("json"); setError(""); }} className={`rounded-lg border px-4 py-2 text-xs font-semibold transition ${mode === "json" ? "border-[#073B35] bg-[#003399] text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>JSON</button>
        </div>
        <form onSubmit={handleImport} className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            {mode === "text" ? "Pega aquí toda la información del club. Se aceptan el JSON del prompt, bloques JSON con formato Markdown o líneas como Nombre: Real Madrid." : "Pega el objeto JSON completo generado por el prompt. También se aceptan bloques con formato ```json ... ```."}
          </div>
          <textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder={mode === "text" ? "Pega aquí toda la información del equipo..." : '{\n  "name": "Real Madrid",\n  "short_name": "RMA",\n  "country": "Spain"\n}'} className={`${textareaClassName} min-h-[320px] font-mono text-xs`} autoFocus required />
          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" onClick={onClose} className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">Cancelar</button>
            <button type="submit" className="flex h-10 items-center gap-2 rounded-xl bg-[#003399] px-4 text-xs font-semibold text-white transition hover:bg-[#002477]"><ClipboardPaste size={15} />Detectar información</button>
          </div>
        </form>
      </div>
    </div>
  );
}