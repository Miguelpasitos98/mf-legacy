import {persistMarketHistory} from "@/utils/persistMarketHistory";
import React, { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { parseMarketBulk } from "./MarketBulkImport";

// Snapshot generado por scripts/build_market_dataset.py en el repositorio.
const ROOT = "https://raw.githubusercontent.com/Miguelpasitos98/mf-legacy/main/public/data/market";
const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const dateOnly = s => String(s || "").slice(0,10);
const savedKey = id => `mf-legacy-market-history-preview-v1:${id}`;
const knownIds = player => [player?.transfermarkt_id,player?.transfermarktId,player?.tm_id,player?.tmId].map(String).filter(v => /^\d+$/.test(v));
const bucket = id => String(Number(id) % 128).padStart(3,"0");
export default function HistoricalMarketLookup({ player }) {
  const [index,setIndex] = useState(null);
  const [status,setStatus] = useState("");
  const [selected,setSelected] = useState(null);
  const [query,setQuery] = useState(player?.name || "");
  const [history,setHistory] = useState(null);
  const [error,setError] = useState("");
  useEffect(()=>{setQuery(player?.name || "");setSelected(null);setHistory(null);setError("");},[player?.id]);
  const candidates = useMemo(()=>{
    if(!index) return [];
    const exactId = knownIds(player);
    const same = index.filter(p=>exactId.includes(String(p.id)));
    if(same.length) return same.slice(0,10);
    const n = normalize(query);
    if(n.length < 3) return [];
    return index.filter(p=>normalize(p.name).includes(n)).slice(0,30);
  },[index,player,query]);
  async function loadIndex(){
    setStatus("Cargando índice público…");setError("");
    try{
      const response=await fetch(`${ROOT}/players-index.json`);
      if(!response.ok) throw new Error(response.status===404?"El índice aún no está generado en GitHub Actions.":"HTTP "+response.status);
      const rows=await response.json();
      if(!Array.isArray(rows))throw new Error("Formato de índice no válido");
      setIndex(rows);setStatus(`${rows.length.toLocaleString("es-ES")} jugadores en el índice`);
    }catch(e){setError(e.message);setStatus("");}
  }
  async function loadHistory(candidate){
    setSelected(candidate);setHistory(null);setError("");setStatus("Cargando historial…");
    try{
      const response=await fetch(`${ROOT}/valuations-${bucket(candidate.id)}.json`);
      if(!response.ok)throw new Error("No se ha podido cargar el bloque histórico");
      const shard=await response.json();
      const historyRows=shard[String(candidate.id)];
      if(!Array.isArray(historyRows)||!historyRows.length)throw new Error("No hay valoraciones históricas para este jugador");
      const parsed=parseMarketBulk(JSON.stringify(historyRows.map(r=>({date:r[0],value:Number(r[1])/1e6,team:r[2]}))));
      setHistory(parsed);setStatus(`${parsed.length} valoraciones encontradas`);
    }catch(e){setError(e.message);setStatus("");}
  }
  async function importRows(){
    if(!history?.length||!player?.id||!selected)return;
    if (!knownIds(player).includes(String(selected.id)) && normalize(player?.name) !== normalize(selected.name)) {
      setError("El nombre seleccionado no coincide exactamente con el jugador de MF Legacy. Comprueba su ID y nombre antes de importar.");
      return;
    }
    // Las fechas de nacimiento de MF Legacy pueden estar editadas deliberadamente.
    // La importación respeta esas modificaciones y no compara nacimientos.
    try {
      const old=window.localStorage.getItem(savedKey(player.id));
      const current=old===null?(Array.isArray(player.market_value_history)?player.market_value_history:[]):JSON.parse(old);
      const normalized=Array.isArray(current)?current.map(r=>({...r,date:dateOnly(r.date),value:Number(r.value)})).filter(r=>/^\d{4}-\d\d-\d\d$/.test(r.date)&&Number.isFinite(r.value)&&r.value>=0):[];
      const dates=new Set(normalized.map(r=>r.date));
      // Conserva prioritariamente los valores manuales ya creados.
      const merged=[...normalized,...history.filter(r=>!dates.has(r.date))].sort((a,b)=>a.date.localeCompare(b.date));
      const saved=await persistMarketHistory(player.id,merged);
      setStatus(\`\${saved.length} registros guardados y comprobados en Base44\`);
      setError("");
    }catch(e){setError("No se ha podido guardar el historial local: "+e.message);}
  }
  return <section className="rounded-2xl border border-slate-200 bg-white p-5">
    <h3 className="text-sm font-black">Buscar historial en la base de datos</h3>
    <p className="mt-2 text-xs text-slate-500">Fuente: dcaribou/transfermarkt-datasets · instantánea hasta 12/06/2026. No es una consulta en vivo a Transfermarkt. Verifica el jugador antes de importar.</p>
    <div className="mt-3 flex flex-wrap gap-2">
      <input aria-label="Buscar jugador Transfermarkt" value={query} onChange={e=>setQuery(e.target.value)} className="min-w-[200px] flex-1 rounded-lg border px-3 py-2 text-sm" placeholder="Nombre del futbolista"/>
      <button type="button" onClick={loadIndex} className="inline-flex items-center gap-2 rounded-lg bg-[#003399] px-3 py-2 text-xs font-bold text-white"><Search size={14}/> {index?"Actualizar índice":"Buscar jugadores"}</button>
    </div>
    {status&&<p className="mt-2 text-xs text-slate-600">{status}</p>}
    {error&&<p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
    {index&&<div className="mt-3 max-h-40 overflow-y-auto rounded-lg border border-slate-200">
      {candidates.length?candidates.map(p=><button key={p.id} type="button" onClick={()=>loadHistory(p)} className="flex w-full items-center justify-between gap-3 border-b px-3 py-2 text-left text-xs hover:bg-slate-50 last:border-none">
        <span><strong>{p.name}</strong><span className="ml-2 text-slate-500">ID {p.id}</span></span><span className="text-slate-500">{p.dob||"Sin fecha"} · {p.club||"Sin club"}</span>
      </button>):<p className="p-3 text-xs text-slate-500">Sin coincidencias. Comprueba el nombre.</p>}
    </div>}
    {selected&&history&&<div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-sm font-bold">{selected.name} · {history.length} valores</p>
      <p className="mt-1 text-xs text-slate-500">{history[0]?.date} → {history.at(-1)?.date} · último: {history.at(-1)?.value} M€</p>
      <div className="mt-2 max-h-28 overflow-auto text-[11px] text-slate-600">{history.slice(-8).map(r=><p key={r.date}>{r.date} · {r.value} M€ · {r.team}</p>)}</div>
      <button type="button" className="mt-3 rounded-lg bg-[#003399] px-4 py-2 text-xs font-bold text-white" onClick={importRows}>Importar al gráfico (prueba local)</button>
    </div>}
  </section>;
}
