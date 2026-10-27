import React, { useState } from "react";
import { Upload } from "lucide-react";

const key = (id) => `mf-legacy-market-history-preview-v1:${id}`;
const toIso = (date) => {
  const v = String(date ?? "").trim();
  let m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
  const iso = m ? `${m[3]}-${m[2]}-${m[1]}` : v;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(iso + "T12:00:00");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso ? iso : null;
};
const numeric = (value) => {
  if (typeof value === "number") return value;
  const v = String(value ?? "").trim().replace(/\s/g, "").replace(",", ".");
  return v ? Number(v) : NaN;
};
export function parseMarketBulk(text) {
  const source = String(text || "").trim();
  if (!source) throw new Error("Pega primero los registros.");
  let entries;
  if (source.startsWith("[") || source.startsWith("{")) {
    const json = JSON.parse(source);
    entries = Array.isArray(json) ? json : json.market_value_history || json.valuations || json.records;
    if (!Array.isArray(entries)) throw new Error("El JSON debe ser un array o contener market_value_history, valuations o records.");
  } else {
    entries = source.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
      .filter(s => !/^(DD\/MM\/AAAA|FECHA|DATE)\s*\|/i.test(s))
      .map((line, i) => {
        const parts = line.split("|").map(s => s.trim());
        if (parts.length < 2 || parts.length > 3) throw new Error(`Línea ${i + 1}: utiliza FECHA | VALOR | CLUB.`);
        return { date: parts[0], value: parts[1], team: parts[2] || "" };
      });
  }
  if (!entries.length) throw new Error("No hay registros para importar.");
  return entries.map((item, i) => {
    const date = toIso(item.date ?? item.fecha);
    const value = numeric(item.value ?? item.valor);
    const team = String(item.team ?? item.club ?? "").trim();
    if (!date || !Number.isFinite(value) || value < 0) throw new Error(`Registro ${i + 1}: fecha o valor no válido.`);
    return { date, value, team, club_id: String(item.club_id || "") };
  }).sort((a,b)=>a.date.localeCompare(b.date));
}
export default function MarketBulkImport({ player }) {
  const [raw, setRaw] = useState("");
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [mode, setMode] = useState("merge");
  const parse = () => {
    try { const parsed = parseMarketBulk(raw); setPreview(parsed); setError(""); }
    catch(e) { setPreview(null); setError(e.message); }
  };
  const save = () => {
    if (!preview || !player?.id) return;
    try {
      const oldRaw = window.localStorage.getItem(key(player.id));
      const existing = oldRaw === null ? (Array.isArray(player.market_value_history) ? player.market_value_history : []) : JSON.parse(oldRaw);
      const normalizedExisting = existing.map(item => ({...item,date:toIso(item.date),value:numeric(item.value)}))
        .filter(item=>item.date && Number.isFinite(item.value) && item.value>=0);
      const merged = mode === "replace" ? preview : [...normalizedExisting.filter(r => !preview.some(n => n.date === r.date)), ...preview];
      merged.sort((a,b)=>a.date.localeCompare(b.date));
      window.localStorage.setItem(key(player.id), JSON.stringify(merged));
      window.dispatchEvent(new CustomEvent("mf-legacy-market-preview-updated", { detail: { playerId: player.id } }));
      setError(""); setPreview(null); setRaw("");
      alert(`${merged.length} registros guardados en este navegador para ${player.name || "el jugador"}.`);
    } catch { setError("No se han podido guardar los datos en el navegador."); }
  };
  return <section className="rounded-2xl border border-slate-200 bg-white p-5">
    <div className="flex items-center gap-2"><Upload size={17}/><h3 className="text-sm font-black">Bulk Import · Valor de mercado</h3></div>
    <p className="mt-2 text-xs text-slate-500">Pega registros por línea en formato <strong>DD/MM/AAAA | VALOR | CLUB</strong>, con importes en millones de euros. También admite JSON. Esta prueba guarda datos exclusivamente en tu navegador, no en Base44.</p>
    <textarea aria-label="Datos de valor de mercado por lotes" value={raw} onChange={e=>{setRaw(e.target.value);setPreview(null);setError("");}} rows={7} placeholder={"DD/MM/AAAA | VALOR | CLUB\n06/08/2014 | 68 | FC Barcelona\n23/10/2015 | 95 | FC Barcelona\n15/05/2018 | 190 | Paris Saint-Germain"} className="mt-4 w-full rounded-xl border border-slate-200 p-3 font-mono text-xs outline-none focus:border-blue-600"/>
    <p className="mt-2 text-xs text-slate-500">JSON compatible: <code>[{"{"}"date":"2018-05-15","value":190,"team":"Paris Saint-Germain"{"}"}]</code></p>
    <div className="mt-4 flex flex-wrap items-center gap-4 text-xs">
      <label><input type="radio" checked={mode==="merge"} onChange={()=>setMode("merge")} className="mr-1"/> Combinar (misma fecha: sustituir)</label>
      <label><input type="radio" checked={mode==="replace"} onChange={()=>setMode("replace")} className="mr-1"/> Sustituir todo el historial local</label>
    </div>
    <button type="button" onClick={parse} className="mt-4 rounded-lg border border-blue-200 px-4 py-2 text-xs font-bold text-blue-900">Validar y previsualizar</button>
    {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
    {preview && <div className="mt-4">
      <p className="text-xs font-bold">{preview.length} registros válidos</p>
      <div className="mt-2 max-h-48 overflow-auto rounded-lg border text-xs">
        {preview.map((r,i)=><div key={i} className="grid grid-cols-3 gap-3 border-b px-3 py-2 last:border-0"><span>{r.date}</span><span>{r.value} M€</span><span>{r.team || "—"}</span></div>)}
      </div>
      <button type="button" onClick={save} className="mt-3 rounded-lg bg-blue-900 px-4 py-2 text-xs font-bold text-white">Importar {preview.length} registros</button>
    </div>}
  </section>;
}
