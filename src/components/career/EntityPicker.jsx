import React, { useEffect, useRef, useState } from "react";
import { Search, ChevronDown } from "lucide-react";

// Selector buscable reutilizable para jugadores o equipos.
// options: [{ id, name, short_name?, logo?, code? }]
export default function EntityPicker({
  value,
  onChange,
  options,
  placeholder = "Seleccionar...",
  getLabel,
  getImage,
  disabled,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handler = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const labelFn = getLabel || ((item) => item?.name || "—");
  const selected = options.find((item) => String(item.id) === String(value)) || null;

  const filtered = options.filter((item) => {
    const text = [item?.name, item?.short_name, item?.code]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return text.includes(query.trim().toLowerCase());
  });

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setOpen((o) => !o);
          setQuery("");
        }}
        className="flex h-9 w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 text-left text-xs transition hover:border-slate-300 disabled:opacity-50"
      >
        {selected && getImage?.(selected) ? (
          <img
            src={getImage(selected)}
            alt=""
            className="h-4 w-4 shrink-0 object-contain"
          />
        ) : null}
        <span
          className={`min-w-0 flex-1 truncate ${
            selected ? "text-slate-800" : "text-slate-400"
          }`}
        >
          {selected ? labelFn(selected) : placeholder}
        </span>
        <ChevronDown size={14} className="shrink-0 text-slate-400" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-[90] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 p-1.5">
            <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2">
              <Search size={13} className="text-slate-400" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar..."
                className="h-8 min-w-0 flex-1 bg-transparent text-xs outline-none"
              />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto p-1">
            {filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onChange(item.id);
                  setOpen(false);
                  setQuery("");
                }}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition ${
                  String(item.id) === String(value)
                    ? "bg-[#003399]/[0.08] font-bold text-[#003399]"
                    : "hover:bg-slate-50"
                }`}
              >
                {getImage?.(item) ? (
                  <img
                    src={getImage(item)}
                    alt=""
                    className="h-4 w-4 shrink-0 object-contain"
                  />
                ) : null}
                <span className="min-w-0 flex-1 truncate">{labelFn(item)}</span>
              </button>
            ))}
            {!filtered.length && (
              <p className="p-3 text-center text-xs text-slate-400">
                Sin resultados
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}