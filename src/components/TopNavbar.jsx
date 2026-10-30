import React, { useEffect, useState } from "react";
import { ChevronDown, Menu } from "lucide-react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { VIEW_OPTIONS } from "@/components/Sidebar";

const footballNav = [
    { label: "SCORES", path: "/scores" },
    { label: "STADIUMS", path: "/schedule" },
    { label: "KITS", path: "/news" },
    { label: "STATS", path: "/stats" },
    { label: "IMPORT", path: "/import-center" },
    { label: "POSESIÓN", path: "/possession" },
    { label: "PLAYERS", path: "/players" },
    { label: "TEAMS", path: "/teams" },
    { label: "TROPHIES", path: "/trophies" },
    { label: "COUNTRIES", path: "/countries" },
  ];

export default function TopNavbar() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const isActive = (item) => item.label === "IMPORT"
    ? location.pathname.startsWith("/import-")
    : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
  const current = footballNav.find(isActive);
  useEffect(() => setOpen(false), [location.key]);
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
              {footballNav.map(item => <Link key={item.path} to={item.path} aria-current={isActive(item) ? "page" : undefined} onClick={() => setOpen(false)}>{item.label}</Link>)}
            </nav>
            <p className="mb-2 mt-6 text-xs font-bold uppercase tracking-widest text-slate-500">Players · vistas</p>
            <nav aria-label="Vistas de jugadores" className="space-y-1 text-sm">
              {VIEW_OPTIONS.map(option => <Link key={option.id} to={option.id === "all" ? "/players" : `/players?view=${option.id}`} aria-current={current?.label === "PLAYERS" && (searchParams.get("view") || "all") === option.id ? "page" : undefined} onClick={() => setOpen(false)}>{option.label}</Link>)}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
      <nav aria-label="Navegación principal" className="mf-desktop-nav">
        {footballNav.map(item => <Link key={item.path} to={item.path} aria-current={isActive(item) ? "page" : undefined} className={`font-heading text-[13px] font-semibold tracking-[0.02em] transition-colors ${isActive(item) ? "text-[#003399]" : "text-[#222222] hover:text-[#003399]"}`}>{item.label}</Link>)}
      </nav>
      <span className="mf-nav-current">{current?.label || "MF LEGACY"}</span>
      <div className="mf-user-menu">
        <button type="button" className="rounded-full" aria-label="Perfil"><span className="h-9 w-9 rounded-full bg-[#D1D3D9] transition-colors hover:bg-[#C4C7CE]" /></button>
        <button type="button" aria-label="Abrir menú de usuario"><ChevronDown size={15} strokeWidth={1.8} className="text-[#333333]" /></button>
      </div>
    </header>
  );
}
