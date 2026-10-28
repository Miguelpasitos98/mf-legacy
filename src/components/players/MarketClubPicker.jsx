import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

const norm = text => String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const logo = club => club?.logo || club?.logo_url || club?.badge_url || "";
export default function MarketClubPicker({ clubs = [], value = "", onChange, placeholder = "Buscar club...", compact = false }) {
  const selected = clubs.find(c => String(c.id) === String(value));
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef(null);
  useEffect(() => { if (!open) setQuery(""); }, [open, value]);
  useEffect(() => {
    const outside = event => { if (!root.current?.contains(event.target)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  const matches = useMemo(() => {
    const needle = norm(query);
    const list = clubs.filter(c => {
      const names = [c.name, c.short_name, c.shortName].map(norm);
      return !needle || names.some(n => n.includes(needle));
    });
    return list.slice(0, 40);
  }, [clubs, query]);
  const choose = club => { onChange(String(club.id)); setOpen(false); setQuery(""); };
  return <div ref={root} className="relative min-w-0 flex-1">
    <div className={"flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 " + (compact ? "h-8" : "h-10")}>
      {selected && !open && logo(selected) ? <img src={logo(selected)} alt="" className="h-5 w-5 shrink-0 object-contain"/> : <Search size={14} className="shrink-0 text-slate-400"/>}
      <input type="text" value={open ? query : (selected?.name || "")} placeholder={placeholder}
        aria-label={placeholder} aria-expanded={open} role="combobox" aria-autocomplete="list"
        onFocus={() => { setOpen(true); setActive(0); }}
        onChange={e => { setOpen(true); setQuery(e.target.value); setActive(0); }}
        onKeyDown={e => {
          if (e.key === "Escape") { setOpen(false); return; }
          if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive(i => Math.min(i+1, matches.length-1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setActive(i => Math.max(0,i-1)); }
          if (e.key === "Enter" && open && matches[active]) { e.preventDefault(); choose(matches[active]); }
        }}
        className="w-full min-w-0 bg-transparent text-xs text-slate-800 outline-none placeholder:text-slate-400"/>
      {selected && <button type="button" title="Desvincular club" aria-label="Desvincular club" onClick={() => { onChange(""); setQuery(""); setOpen(false); }} className="text-slate-400 hover:text-red-600"><X size={13}/></button>}
      <button type="button" aria-label="Abrir listado de clubes" onClick={() => { setOpen(v => !v); setQuery(""); }} className="text-slate-400 hover:text-slate-700"><ChevronDown size={14}/></button>
    </div>
    {open && <div role="listbox" className="absolute left-0 top-full z-[100] mt-1 max-h-52 w-full min-w-[220px] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-[0_12px_30px_rgba(15,23,42,0.18)]">
      {matches.length ? matches.map((club, i) => <button key={club.id} role="option" aria-selected={String(value)===String(club.id)} type="button" onMouseDown={e=>e.preventDefault()} onClick={() => choose(club)}
        className={"flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-blue-50 " + (i === active ? "bg-blue-50" : "")}>
        {logo(club) ? <img src={logo(club)} alt="" className="h-7 w-7 shrink-0 object-contain"/> : <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[9px] font-bold text-slate-400">FC</span>}
        <span className="min-w-0 flex-1 truncate font-medium text-slate-800">{club.name}</span>
        {String(value)===String(club.id) && <Check size={15} className="shrink-0 text-blue-700"/>}
      </button>) : <p className="p-3 text-xs text-slate-500">No se encontraron clubes.</p>}
    </div>}
  </div>;
}
