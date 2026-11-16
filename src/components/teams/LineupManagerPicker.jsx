import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, UserRoundCog } from "lucide-react";
import { base44 } from "@/api/base44Client";
import ManagerPortrait from "../managers/ManagerPortrait";

const normalize = value => String(value || "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// Selección opcional del entrenador asociado al once, con buscador por nombre.
// Se guarda junto al once (manager_id + manager_name), sin crear asignaciones.
export default function LineupManagerPicker({ value, onChange, disabled = false }) {
  const [managers, setManagers] = useState([]);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const boxRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    let live = true;
    base44.entities.Manager.list({ limit: 500 })
      .then(result => {
        if (!live) return;
        const rows = Array.isArray(result) ? result : result?.items || result?.data || [];
        setManagers(rows
          .filter(m => m.is_active !== false)
          .sort((a, b) => String(a.display_name || a.name || "").localeCompare(String(b.display_name || b.name || ""), "es")));
      })
      .catch(() => { if (live) setError("No se pudieron cargar los entrenadores."); });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const close = event => { if (boxRef.current && !boxRef.current.contains(event.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const selected = managers.find(m => String(m.id) === String(value?.id || ""));
  const results = useMemo(() => {
    const q = normalize(query).trim();
    if (!q) return managers.slice(0, 40);
    return managers
      .filter(m => normalize([m.display_name, m.name, m.nationality].join(" ")).includes(q))
      .slice(0, 40);
  }, [managers, query]);

  const choose = id => {
    const manager = managers.find(m => String(m.id) === String(id));
    onChange(manager ? { id: String(manager.id), name: manager.display_name || manager.name || "" } : null);
    setOpen(false);
    setQuery("");
  };

  return <div ref={boxRef} className="relative">
    <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-500">Entrenador</span>
    {open ? <div className="mt-0.5 w-60 rounded-lg border border-blue-300 bg-white shadow-lg">
      <div className="flex items-center gap-1 border-b px-2">
        <Search size={14} className="text-slate-400" />
        <input
          ref={inputRef}
          aria-label="Buscar entrenador"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar por nombre…"
          className="w-full bg-transparent py-1.5 text-xs font-semibold text-slate-800 outline-none" />
        <button type="button" aria-label="Cerrar buscador" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700"><X size={14} /></button>
      </div>
      <div className="max-h-56 overflow-y-auto py-1">
        <button type="button" onClick={() => choose("")} className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs font-semibold text-slate-600 hover:bg-slate-100">Sin entrenador</button>
        {results.length === 0
          ? <p className="px-2 py-2 text-xs text-slate-500">Sin resultados.</p>
          : results.map(m => <button
            type="button"
            key={m.id}
            onClick={() => choose(m.id)}
            className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-blue-50 ${String(m.id) === String(value?.id || "") ? "bg-blue-50 font-bold" : ""}`}>
            <ManagerPortrait manager={m} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{m.display_name || m.name}</span>
              {m.nationality && <span className="block truncate text-[10px] text-slate-500">{m.nationality}</span>}
            </span>
          </button>)}
      </div>
    </div> : <button
      type="button"
      disabled={disabled}
      onClick={() => setOpen(true)}
      className="mt-0.5 flex w-60 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-left text-xs font-semibold text-slate-800 disabled:opacity-50">
      {selected
        ? <ManagerPortrait manager={selected} />
        : <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400"><UserRoundCog size={16} /></span>}
      <span className="min-w-0 flex-1 truncate">{selected ? selected.display_name || selected.name : "Buscar entrenador…"}</span>
      <Search size={13} className="shrink-0 text-slate-400" />
    </button>}
    {error && <span className="text-[10px] text-amber-700">{error}</span>}
  </div>;
}