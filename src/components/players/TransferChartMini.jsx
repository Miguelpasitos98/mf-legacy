import React, { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Pencil, Plus, Trash2, X } from "lucide-react";

// Prototipo aislado: nunca modifica la entidad Player ni otros datos de Base44.
// Los cambios manuales se guardan exclusivamente en este navegador.
const storageKey = (id) => `mf-legacy-market-history-preview-v1:${id}`;
const validDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const prettyMoney = (v) => `${Number(v).toLocaleString("es-ES", { maximumFractionDigits: 2 })} M€`;
const validRows = (rows) => (Array.isArray(rows) ? rows : [])
  .filter((r) => validDate(String(r.date || "")) && Number.isFinite(Number(r.value)) && Number(r.value) >= 0)
  .map((r) => ({ date: String(r.date), value: Number(r.value), team: String(r.team || ""), club_id: String(r.club_id || "") }))
  .sort((a, b) => a.date.localeCompare(b.date));
const readStored = (id) => {
  if (!id || typeof window === "undefined") return null;
  try { const raw = window.localStorage.getItem(storageKey(id)); return raw === null ? null : validRows(JSON.parse(raw)); }
  catch { return null; }
};
const isoDate = (d) => {
  const v = String(d || "");
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : v;
};
const originalRows = (player) => validRows((player?.market_value_history || []).map((r) => ({ ...r, date: isoDate(r.date) })));
function MiniTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const entry = payload[0]?.payload;
  if (!entry) return null;
  return <div className="rounded-lg border border-white/20 bg-slate-950 px-3 py-2 text-xs text-white shadow-xl">
    <div>{new Date(entry.date + "T12:00:00").toLocaleDateString("es-ES")}</div>
    <strong>{prettyMoney(entry.value)}</strong>
    {entry.team && <div className="opacity-70">{entry.team}</div>}
  </div>;
}
export default function TransferChartMini({ player, clubs = [] }) {
  const id = player?.id;
  const [rows, setRows] = useState(() => readStored(id) ?? originalRows(player));
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => { setRows(readStored(id) ?? originalRows(player)); setOpen(false); }, [id]);
  const data = useMemo(() => validRows(rows).map((r) => ({
    ...r, timestamp: new Date(r.date + "T12:00:00").getTime(),
    team: r.team || clubs.find((c) => String(c.id) === r.club_id)?.name || "",
  })), [rows, clubs]);
  const latest = data.at(-1);
  const chartColor = "#ffffff";
  const save = () => {
    if (!id) { setError("El jugador no tiene ID."); return; }
    if (draft.some((r) => !validDate(r.date) || r.value === "" || !Number.isFinite(Number(r.value)) || Number(r.value) < 0)) {
      setError("Introduce una fecha válida y un valor mayor o igual a cero en cada registro."); return;
    }
    const next = validRows(draft);
    try { window.localStorage.setItem(storageKey(id), JSON.stringify(next)); }
    catch { setError("El navegador no permite guardar los datos locales."); return; }
    setRows(next); setOpen(false); setError("");
  };
  return <>
    <div className="pointer-events-auto flex h-full min-w-0 flex-1 flex-col text-white">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/65">Evolución del valor de mercado</div>
          <div className="mt-0.5 text-[19px] font-black leading-none">{latest ? prettyMoney(latest.value) : "Sin datos"}</div>
        </div>
        <button type="button" aria-label="Editar historial de valor de mercado" title="Añadir o editar valores (guardado local de prueba)" onClick={() => { setDraft(data.map(({date,value,team,club_id}) => ({date,value:String(value),team,club_id}))); setError(""); setOpen(true); }} className="shrink-0 rounded-lg bg-white/15 p-2 text-white transition hover:bg-white/25">
          {data.length ? <Pencil size={14}/> : <Plus size={16}/>}
        </button>
      </div>
      {data.length > 0 ? <div className="mt-2 min-h-0 flex-1" style={{ minHeight: 75 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 4, bottom: 0, left: -28 }}>
            <defs><linearGradient id="miniMarketFade" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={chartColor} stopOpacity={0.35}/><stop offset="100%" stopColor={chartColor} stopOpacity={0.01}/></linearGradient></defs>
            <XAxis dataKey="timestamp" type="number" domain={["dataMin", "dataMax"]} tickFormatter={(v) => new Date(v).getFullYear()} tick={{ fill:"#ffffffaa", fontSize:9 }} axisLine={false} tickLine={false} minTickGap={18} />
            <YAxis hide domain={[0, "auto"]}/>
            <Tooltip content={<MiniTooltip/>} cursor={{ stroke:"#ffffff55" }}/>
            <Area type="monotone" dataKey="value" stroke={chartColor} strokeWidth={2.5} fill="url(#miniMarketFade)" dot={data.length === 1} activeDot={{ r: 4 }} isAnimationActive={false}/>
          </AreaChart>
        </ResponsiveContainer>
      </div> : <div className="mt-3 flex flex-1 items-center text-xs text-white/70">Pulsa + para introducir el primer valor histórico.</div>}
      <span className="mt-1 text-[9px] text-white/50">Vista de prueba · datos manuales guardados en este navegador</span>
    </div>
    {open && typeof document !== "undefined" && (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
        <div role="dialog" aria-modal="true" aria-label="Editar historial de mercado" className="max-h-[85vh] w-full max-w-[640px] overflow-y-auto rounded-2xl bg-white p-5 text-slate-900 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div><h2 className="text-lg font-black">Historial de valor de mercado</h2><p className="mt-1 text-xs text-slate-500">Primera prueba: fechas, millones de euros y club opcional. Los cambios se guardan solo en este navegador, no en Base44.</p></div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar"><X size={20}/></button>
          </div>
          <div className="mt-4 space-y-2">
            {draft.map((r, i) => <div key={i} className="grid grid-cols-[1fr_0.9fr_1.3fr_auto] items-center gap-2">
              <input aria-label="Fecha" type="date" className="min-w-0 rounded-lg border px-2 py-2 text-xs" value={r.date} onChange={(e) => setDraft((d) => d.map((x,j) => j===i?{...x,date:e.target.value}:x))}/>
              <input aria-label="Valor en millones de euros" type="number" step="0.01" min="0" placeholder="M€" className="min-w-0 rounded-lg border px-2 py-2 text-xs" value={r.value} onChange={(e) => setDraft((d) => d.map((x,j) => j===i?{...x,value:e.target.value}:x))}/>
              <input aria-label="Club" list="market-mini-clubs" placeholder="Club (opcional)" className="min-w-0 rounded-lg border px-2 py-2 text-xs" value={r.team} onChange={(e) => setDraft((d) => d.map((x,j) => j===i?{...x,team:e.target.value,club_id:""}:x))}/>
              <button type="button" title="Eliminar registro" aria-label="Eliminar registro" className="rounded-lg p-2 text-red-600" onClick={() => setDraft((d) => d.filter((_,j)=>j!==i))}><Trash2 size={16}/></button>
            </div>)}
            <datalist id="market-mini-clubs">{clubs.map((c) => <option key={c.id} value={c.name}/>)}</datalist>
          </div>
          <button type="button" className="mt-4 inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm" onClick={() => setDraft((d) => [...d, {date:"",value:"",team:"",club_id:""}])}><Plus size={16}/> Añadir fecha</button>
          {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
          <div className="mt-5 flex justify-end gap-2"><button type="button" className="rounded-lg border px-4 py-2 text-sm" onClick={() => setOpen(false)}>Cancelar</button><button type="button" className="rounded-lg bg-blue-800 px-4 py-2 text-sm font-semibold text-white" onClick={save}>Guardar prueba</button></div>
        </div>
      </div>
    )}
  </>;
}
