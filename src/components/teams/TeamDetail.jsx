import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { normalizeImageUrl, formatMarketValue } from "./teamUtils";
import { AddTeamModal } from "./TeamFormComponents";
import KitImage from "./KitImage";

export default function TeamDetail({ team, onClose, onEdit, form, setForm, countries, leagues, onCloseEdit, onSubmit }) {
  const [editPanelOpen, setEditPanelOpen] = useState(false);
  const [isPageTransitioning, setIsPageTransitioning] = useState(false);
  const detailScrollRef = useRef(null);
  const transitionTimeoutRef = useRef(null);

  useLayoutEffect(() => {
    const container = detailScrollRef.current;
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
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    };

    resetScroll();
    const frame = window.requestAnimationFrame(resetScroll);
    return () => window.cancelAnimationFrame(frame);
  }, [team?.id]);

  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current) window.clearTimeout(transitionTimeoutRef.current);
    };
  }, []);

  // Precargar las imágenes de las camisetas lo antes posible (antes del
  // render del <img>) para reducir el retraso de la primera equipación.
  // El navegador deduplica solicitudes idénticas y reutiliza la caché en
  // visitas posteriores. No modifica las URL originales.
  useEffect(() => {
    const targets = [
      { href: kitHomeUrl, high: true },
      { href: kitsOverviewUrl, high: false },
    ].filter((t) => t.href);
    if (!targets.length) return;
    const links = targets.map(({ href, high }) => {
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "image";
      link.href = href;
      if (high) link.setAttribute("fetchpriority", "high");
      document.head.appendChild(link);
      return link;
    });
    return () => {
      links.forEach((link) => link.remove());
    };
  }, [kitHomeUrl, kitsOverviewUrl]);

  const goToSection = (sectionIndex) => {
    const container = detailScrollRef.current;
    if (!container || isPageTransitioning) return;

    const sections = Array.from(container.querySelectorAll("[data-scroll-section]"));
    const targetSection = sections[sectionIndex];
    if (!targetSection) return;

    setIsPageTransitioning(true);
    const containerRect = container.getBoundingClientRect();
    const targetRect = targetSection.getBoundingClientRect();
    const targetTop = container.scrollTop + (targetRect.top - containerRect.top);

    container.scrollTo({ top: targetTop, behavior: "smooth" });
    transitionTimeoutRef.current = window.setTimeout(() => setIsPageTransitioning(false), 900);
  };

  const primaryColor = team.primaryColor || team.primary_color || "#063B78";
  const secondaryColor = team.secondaryColor || team.secondary_color || "#941638";
  const foundedYear = team.foundedYear || team.founded_year || team.yearFounded || "";
  const city = team.city || "";
  const country = team.country || "";
  const marketDisplay = formatMarketValue(team.market, "");
  const teamName = team.name || "Equipo";
  const shortName = team.shortName || team.short_name || "";
  const stadium = team.stadium || team.stadium_name || team.stadiumName || "";
  const stadiumCapacity = team.stadiumCapacity || team.stadium_capacity || team.capacity || "";
  const ranking = team.ranking || team.worldRanking || team.world_ranking || "";

  const kitHomeUrl = normalizeImageUrl(
    team.kit1_photo_url || team.kit1PhotoUrl || team.kit_home_url || team.kitHomeUrl ||
    team.home_kit_url || team.homeKitUrl || team.kit_url || team.kits?.kit1?.photo_url || ""
  );

  const kitsOverviewUrl = normalizeImageUrl(
    team.kits_overview_url || team.kitsOverviewUrl || team.kits_image_url || team.kitsImageUrl || ""
  );

  const countryMapUrl = normalizeImageUrl(team.country_map_url || team.countryMapUrl || "");
  const countryTeamMapUrl = normalizeImageUrl(team.country_team_map_url || team.countryTeamMapUrl || "");
  const displayName = teamName.toUpperCase();

  return (
    <div ref={detailScrollRef} className="relative h-[calc(100vh-4rem)] overflow-y-auto overscroll-none p-3 sm:p-4 md:p-6 [&::-webkit-scrollbar]:hidden" style={{ backgroundColor: primaryColor, scrollbarWidth: "none", msOverflowStyle: "none" }}>
      <div className="pointer-events-none absolute inset-0" style={{ backgroundColor: secondaryColor, clipPath: "polygon(60% 0, 100% 0, 100% 100%, 42% 100%)" }} />
      <div className="pointer-events-none absolute inset-0 opacity-25" style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, transparent 45%, ${secondaryColor} 100%)` }} />

      <div className="relative z-10">
        <div data-scroll-section className="relative min-h-full overflow-hidden rounded-2xl border border-white/20 bg-black/10 shadow-2xl">
          {countryMapUrl && (
            <img src={countryMapUrl} alt="" aria-hidden="true" className="pointer-events-none absolute bottom-[150px] right-4 z-0 h-[70%] w-auto max-w-[55%] object-contain opacity-35 grayscale" />
          )}
          {countryTeamMapUrl && (
            <img src={countryTeamMapUrl} alt="" aria-hidden="true" className="pointer-events-none absolute bottom-[150px] right-4 z-0 h-[70%] w-auto max-w-[55%] object-contain" />
          )}

          <div className="relative z-30 flex items-center justify-between gap-4 px-5 pt-5 md:px-8 md:pt-7">
            <button type="button" onClick={onClose} className="rounded-full border border-white/40 bg-black/10 px-4 py-2 text-[11px] font-semibold text-white backdrop-blur-sm transition hover:bg-white/20">← Volver a equipos</button>
            <button type="button" onClick={() => { setEditPanelOpen(true); onEdit(team); }} className="cursor-pointer rounded-sm text-[10px] font-bold uppercase tracking-[0.3em] text-white/75 transition hover:text-white focus:outline-none focus:ring-1 focus:ring-white/60">Team profile</button>
          </div>

          <div className="relative z-10 grid min-h-[720px] grid-cols-1 md:grid-cols-[55%_45%]">
            <div className="relative flex flex-col justify-between p-6 pt-14 sm:p-8 sm:pt-16 md:p-12 md:pt-20">
              <div>
                <div className="mb-8 flex items-center gap-3">
                  <div className="flex gap-2">
                    <span className="h-1 w-9" style={{ backgroundColor: primaryColor }} />
                    <span className="h-1 w-9" style={{ backgroundColor: secondaryColor }} />
                  </div>
                  <span className="team-section-label text-[10px] text-white/80 sm:text-xs">Más que un club</span>
                </div>
                <p className="team-section-label mb-4 text-xs text-white/65">{city || shortName || "Football Club"}</p>
                <h1 className="team-display-title max-w-none text-5xl text-white sm:text-7xl md:text-[8rem]">
                  {displayName.split(" ").map((word, index) => (<span key={index} className="block">{word}</span>))}
                </h1>
                <p className="team-section-label mt-7 text-[9px] text-white/65 sm:text-xs">MF LEGACY · TEAM PROFILE</p>
              </div>

              <div className="relative z-20 mt-14 md:mt-8">
                <div className="grid grid-cols-2 gap-x-5 gap-y-7 md:grid-cols-3">
                  <div><p className="team-section-label text-[9px] text-white/55">Año de fundación</p><p className="team-data-value mt-2 text-xl text-white">{foundedYear || "—"}</p></div>
                  <div><p className="team-section-label text-[9px] text-white/55">País</p><p className="team-data-value mt-2 text-xl text-white">{country || "—"}</p></div>
                  <div><p className="team-section-label text-[9px] text-white/55">Market value</p><p className="team-data-value mt-2 text-xl text-white">{marketDisplay || "—"}</p></div>
                  <div><p className="team-section-label text-[9px] text-white/55">Ciudad</p><p className="team-data-value mt-2 text-xl text-white">{city || "—"}</p></div>
                </div>

                {(stadium || stadiumCapacity || ranking) && (
                  <div className="mt-8 grid grid-cols-2 gap-5 border-t border-white/20 pt-5">
                    {(ranking || ranking === 0) && (<div><p className="team-section-label text-[9px] text-white/55">Ranking</p><p className="team-data-value mt-2 text-lg text-white">{ranking}</p></div>)}
                    {stadium && (<div><p className="team-section-label text-[9px] text-white/55">Estadio</p><p className="team-data-value mt-2 text-sm text-white">{stadium}</p>{stadiumCapacity && <p className="mt-1 text-xs text-white/60">Capacidad {stadiumCapacity}</p>}</div>)}
                  </div>
                )}
              </div>

              <div className="pointer-events-none absolute bottom-[-10px] left-5 select-none overflow-hidden md:left-10">
                <span className="text-[110px] font-black leading-none text-white/[0.07] sm:text-[150px] md:text-[190px]">{foundedYear || "FC"}</span>
              </div>
            </div>

            <div className="relative flex min-h-[450px] flex-col items-center justify-center p-6 pt-20 sm:p-10 md:absolute md:inset-0 md:z-20 md:min-h-0 md:p-0">
              <div className="absolute right-6 top-12 text-right sm:right-10 md:right-12">
                <p className="team-section-label text-[10px] text-white/80 sm:text-xs">Identity</p>
                <div className="ml-auto mt-3 flex gap-2">
                  <span className="h-1 w-7" style={{ backgroundColor: primaryColor }} />
                  <span className="h-1 w-7" style={{ backgroundColor: secondaryColor }} />
                </div>
              </div>

              {kitHomeUrl && (
                <div className="relative z-10 flex w-full items-center justify-center px-4 py-6 md:absolute md:left-1/2 md:top-1/2 md:w-[68%] md:-translate-x-1/2 md:-translate-y-1/2 md:px-0">
                  <KitImage
                    src={kitHomeUrl}
                    alt={`${teamName} primera equipación`}
                    priority
                    placeholderMinHeight={420}
                    className="max-h-[520px] w-full max-w-[520px] object-contain drop-shadow-[0_25px_35px_rgba(0,0,0,0.45)] transition-all duration-500 hover:scale-105 sm:max-h-[560px] sm:max-w-[560px] md:max-h-[650px] md:max-w-[620px]"
                  />
                </div>
              )}

              <button type="button" onClick={() => goToSection(1)} disabled={isPageTransitioning} aria-label="Ir a History" className={`group absolute bottom-8 right-6 flex items-center gap-3 text-right transition-all duration-500 sm:right-10 md:right-12 ${isPageTransitioning ? "translate-x-2 opacity-50" : "hover:-translate-x-1"}`}>
                <span className="flex flex-col">
                  <span className="team-section-label text-[9px] text-white/70 transition-colors duration-300 group-hover:text-white">Tradition</span>
                  <span className="team-section-label text-[9px] text-white/70 transition-colors duration-300 group-hover:text-white">Identity</span>
                  <span className="team-section-label text-[9px] text-white/70 transition-colors duration-300 group-hover:text-white">Legacy</span>
                  <span className="mt-2 text-[8px] uppercase tracking-[0.25em] text-white/45 transition-colors duration-300 group-hover:text-white/80">Enter history →</span>
                </span>
                <span className="flex h-16 w-1 flex-col">
                  <div className="h-1/2" style={{ backgroundColor: primaryColor }} />
                  <div className="h-1/2" style={{ backgroundColor: secondaryColor }} />
                </span>
              </button>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 z-30 flex h-1">
            <div className="w-1/2" style={{ backgroundColor: primaryColor }} />
            <div className="w-1/2" style={{ backgroundColor: secondaryColor }} />
          </div>

          {editPanelOpen && (
            <AddTeamModal form={form} setForm={setForm} countries={countries} leagues={leagues} isEditing onClose={() => { setEditPanelOpen(false); onCloseEdit(); }} onSubmit={async (event) => { const saved = await onSubmit(event); if (saved) setEditPanelOpen(false); }} />
          )}
        </div>

        <section data-scroll-section className="relative mt-6 min-h-[100vh] rounded-2xl border border-white/20 bg-black/10 p-6 shadow-2xl md:p-12">
          <div className="mx-auto grid min-h-[80vh] max-w-6xl items-center gap-10 md:grid-cols-[1fr_1fr]">
            <div>
              <p className="team-section-label text-xs uppercase tracking-[0.3em] text-white/70">MF LEGACY · CLUB HISTORY</p>
              <h2 className="mt-4 text-5xl font-black uppercase text-white md:text-8xl">History</h2>
              <div className="mt-10 max-w-3xl border-l-2 border-white/30 pl-5">
                <p className="text-sm leading-7 text-white/80 md:text-base">{team.history || "Añade la historia del club desde Team profile para mostrarla aquí."}</p>
              </div>
            </div>
            <div className="relative flex min-h-[360px] items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/10 p-5 md:min-h-[520px]">
              {kitsOverviewUrl || kitHomeUrl ? (
                <>
                  <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10 blur-3xl md:h-[420px] md:w-[420px]" />
                  <KitImage
                    src={kitsOverviewUrl || kitHomeUrl}
                    alt={kitsOverviewUrl ? `${teamName} tres equipaciones` : `${teamName} camiseta local`}
                    placeholderMinHeight={360}
                    className="relative z-10 mx-auto h-auto max-h-[460px] w-full object-contain drop-shadow-[0_25px_30px_rgba(0,0,0,0.45)] transition-all duration-500 hover:scale-[1.04]"
                  />
                </>
              ) : (
                <p className="text-center text-xs uppercase tracking-[0.3em] text-white/60">Añade la imagen de las tres equipaciones</p>
              )}
            </div>
          </div>

          <button type="button" onClick={() => goToSection(0)} disabled={isPageTransitioning} aria-label="Volver a la página principal" className={`group absolute bottom-8 right-6 flex items-center gap-3 text-right transition-all duration-500 sm:right-10 md:right-12 ${isPageTransitioning ? "translate-x-2 opacity-50" : "hover:-translate-x-1"}`}>
            <span className="flex flex-col">
              <span className="team-section-label text-[9px] text-white/70 transition-colors duration-300 group-hover:text-white">Tradition</span>
              <span className="team-section-label text-[9px] text-white/70 transition-colors duration-300 group-hover:text-white">Identity</span>
              <span className="team-section-label text-[9px] text-white/70 transition-colors duration-300 group-hover:text-white">Legacy</span>
              <span className="mt-2 text-[8px] uppercase tracking-[0.25em] text-white/45 transition-colors duration-300 group-hover:text-white/80">Back to identity ←</span>
            </span>
            <span className="flex h-16 w-1 flex-col">
              <div className="h-1/2" style={{ backgroundColor: primaryColor }} />
              <div className="h-1/2" style={{ backgroundColor: secondaryColor }} />
            </span>
          </button>
        </section>

        <section data-scroll-section className="mt-6 min-h-[100vh] rounded-2xl border border-white/20 bg-black/10 p-6 shadow-2xl md:p-12">
          <div className="mx-auto grid min-h-[80vh] max-w-6xl items-center gap-10 md:grid-cols-2">
            <div>
              <p className="team-section-label text-xs uppercase tracking-[0.3em] text-white/70">MF LEGACY · CLUB DATA</p>
              <h2 className="mt-4 text-5xl font-black uppercase text-white md:text-7xl">Stadium</h2>
              <p className="mt-6 text-sm leading-7 text-white/80 md:text-base">{stadium || "Estadio no disponible"}</p>
              {stadiumCapacity && <p className="mt-2 text-sm text-white/60">Capacidad: {stadiumCapacity}</p>}
            </div>
            <div className="overflow-hidden rounded-2xl border border-white/20 bg-black/20">
              {team.stadium_exterior_url || team.stadiumExteriorUrl ? (
                <img src={team.stadium_exterior_url || team.stadiumExteriorUrl} alt={`${teamName} estadio`} className="h-full max-h-[520px] w-full object-cover" />
              ) : (
                <div className="flex min-h-[300px] items-center justify-center p-6 text-center text-xs uppercase tracking-[0.25em] text-white/50">Añade una imagen exterior del estadio</div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}