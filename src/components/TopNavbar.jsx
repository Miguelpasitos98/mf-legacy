import React, { useEffect, useState } from "react";
import { ChevronDown, Menu } from "lucide-react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { VIEW_OPTIONS } from "@/components/Sidebar";

// Keep the existing routes intact: these groups only change navigation presentation.
const footballNav = [
  { label: "PLAYERS", path: "/players", items: [{ label: "Players", path: "/players" }] },
  { label: "TEAMS", path: "/teams", items: [
    { label: "Teams", path: "/teams" },
    { label: "Stadiums", path: "/schedule" },
    { label: "Kits", path: "/news" },
    { label: "Countries", path: "/countries" },
  ] },
  { label: "DATA", path: "/stats", items: [
    { label: "Stats", path: "/stats" },
    { label: "Scores", path: "/scores" },
    { label: "Posesión", path: "/possession" },
  ] },
  { label: "TACTICS", path: "/squads", items: [
    { label: "Plantillas", path: "/squads" },
    { label: "Planificador", path: "/squad-planner" },
  ] },
  { label: "MANAGERS", path: "/managers", items: [
    { label: "Managers", path: "/managers" },
    { label: "Manager Fit", path: "/manager-fit" },
  ] },
  { label: "TROPHIES", path: "/trophies", items: [{ label: "Trophies", path: "/trophies" }] },
  { label: "STUDIO", path: "/import-center", items: [
    { label: "Import", path: "/import-center" },
    { label: "Explorador FM26/27", path: "/fm-explorer" },
    { label: "Catálogo", path: "/identity-catalog" },
  ] },
];

export default function TopNavbar() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState(null);

  const isActive = (item) => item.path === "/import-center"
    ? location.pathname.startsWith("/import-")
    : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
  const activeGroup = footballNav.find(group => group.items.some(isActive));
  const activeItem = activeGroup?.items.find(isActive);

  useEffect(() => { setOpen(false); setExpandedGroup(null); }, [location.key]);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1200px) and (hover: hover) and (pointer: fine)");
    const closeOnDesktop = () => { if (media.matches) setOpen(false); };
    media.addEventListener("change", closeOnDesktop);
    return () => media.removeEventListener("change", closeOnDesktop);
  }, []);

  return (
    <header className="mf-topnav border-b border-black/5 bg-white">
      <div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button type="button" className="mf-nav-trigger text-[#003399] hover:bg-slate-100" aria-label="Abrir navegación"><Menu size={22} /></button>
          </SheetTrigger>
          <SheetContent side="left" className="mf-nav-drawer w-[min(360px,90vw)]">
            <SheetTitle className="text-left text-[#003399]">MF LEGACY</SheetTitle>
            <SheetDescription className="mb-4 text-left">Navegación y vistas de jugadores</SheetDescription>
            <nav aria-label="Navegación móvil" className="space-y-1 text-sm font-semibold">
              {footballNav.map(group => (
                <div key={group.label}>
                  <div className="flex items-center gap-1">
                    <Link to={group.path} className="min-w-0 flex-1" aria-current={isActive(group.items[0]) ? "page" : undefined} onClick={() => setOpen(false)}>{group.label}</Link>
                    {group.items.length > 1 && (
                      <button type="button" className="flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-slate-100" aria-label={`Mostrar secciones de ${group.label}`} aria-expanded={expandedGroup === group.label} onClick={() => setExpandedGroup(expandedGroup === group.label ? null : group.label)}>
                        <ChevronDown size={16} className={`transition-transform ${expandedGroup === group.label ? "rotate-180" : ""}`} />
                      </button>
                    )}
                  </div>
                  {group.items.length > 1 && expandedGroup === group.label && (
                    <div className="ml-3 border-l border-slate-200 pl-2">
                      {group.items.map(item => <Link key={item.path} to={item.path} aria-current={isActive(item) ? "page" : undefined} onClick={() => setOpen(false)}>{item.label}</Link>)}
                    </div>
                  )}
                </div>
              ))}
            </nav>
            <p className="mb-2 mt-6 text-xs font-bold uppercase tracking-widest text-slate-500">Players · vistas</p>
            <nav aria-label="Vistas de jugadores" className="space-y-1 text-sm">
              {VIEW_OPTIONS.map(option => <Link key={option.id} to={option.id === "all" ? "/players" : `/players?view=${option.id}`} aria-current={activeItem?.path === "/players" && (searchParams.get("view") || "all") === option.id ? "page" : undefined} onClick={() => setOpen(false)}>{option.label}</Link>)}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
      <nav aria-label="Navegación principal" className="mf-desktop-nav">
        {footballNav.map(group => (
          <div key={group.label} className="group relative flex h-full items-center">
            <Link
              to={group.path}
              aria-current={activeGroup?.label === group.label ? "page" : undefined}
              className={`font-heading inline-flex min-h-11 items-center gap-1 whitespace-nowrap text-[13px] font-semibold tracking-[0.02em] transition-colors ${activeGroup?.label === group.label ? "text-[#003399]" : "text-[#222222] hover:text-[#003399]"}`}
            >
              {group.label}
              {group.items.length > 1 && <ChevronDown size={13} strokeWidth={1.8} className="transition-transform group-hover:rotate-180 group-focus-within:rotate-180" />}
            </Link>
            {group.items.length > 1 && (
              <div className="invisible absolute left-1/2 top-full z-[80] min-w-[174px] -translate-x-1/2 translate-y-1 rounded-xl border border-slate-200 bg-white p-1.5 opacity-0 shadow-xl transition-[opacity,transform,visibility] duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
                {group.items.map(item => (
                  <Link
                    key={item.path}
                    to={item.path}
                    aria-current={isActive(item) ? "page" : undefined}
                    className={`!flex !min-h-9 rounded-lg px-3 py-2 text-[12px] font-semibold transition-colors ${isActive(item) ? "bg-blue-50 text-[#003399]" : "text-slate-700 hover:bg-slate-100 hover:text-[#003399]"}`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>
      <span className="mf-nav-current">{activeItem?.label || activeGroup?.label || "MF LEGACY"}</span>
      <div className="mf-user-menu">
        <button type="button" className="rounded-full" aria-label="Perfil"><span className="h-9 w-9 rounded-full bg-[#D1D3D9] transition-colors hover:bg-[#C4C7CE]" /></button>
        <button type="button" aria-label="Abrir menú de usuario"><ChevronDown size={15} strokeWidth={1.8} className="text-[#333333]" /></button>
      </div>
    </header>
  );
}
