import React, { useEffect, useState } from "react";
import { UserRoundCog } from "lucide-react";
import { base44 } from "@/api/base44Client";
import ManagerPortrait from "../managers/ManagerPortrait";

// Selección opcional del entrenador asociado al once. Se guarda junto al once
// (manager_id + manager_name), sin crear asignaciones ni tocar el club.
export default function LineupManagerPicker({ value, onChange, disabled = false }) {
  const [managers, setManagers] = useState([]);
  const [error, setError] = useState("");
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
  const selected = managers.find(m => String(m.id) === String(value?.id || ""));
  const change = id => {
    const manager = managers.find(m => String(m.id) === id);
    onChange(manager ? { id: String(manager.id), name: manager.display_name || manager.name || "" } : null);
  };
  return <div className="flex items-center gap-2">
    {selected
      ? <ManagerPortrait manager={selected} />
      : <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400"><UserRoundCog size={16} /></span>}
    <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Entrenador
      <select
        aria-label="Entrenador asociado al once"
        value={value?.id || ""}
        disabled={disabled}
        onChange={e => change(e.target.value)}
        className="mt-0.5 block w-40 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold normal-case tracking-normal text-slate-800 disabled:opacity-50">
        <option value="">Sin entrenador</option>
        {managers.map(m => <option key={m.id} value={m.id}>{m.display_name || m.name}</option>)}
        {value?.id && !selected && <option value={value.id}>{value.name || "Entrenador"}</option>}
      </select>
    </label>
    {error && <span className="text-[10px] text-amber-700">{error}</span>}
  </div>;
}