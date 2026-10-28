import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceDot, CartesianGrid } from "recharts";
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
const normClub = name => String(name || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\b(fc|cf|football club|futbol club)\b/g, "").replace(/[^a-z0-9]/g, "");
const clubAliases = name => {
  const clean = normClub(name);
  const aliases = [clean];
  if (/bayern/.test(clean)) aliases.push("bayern");
  if (/tottenham|spurs/.test(clean)) aliases.push("tottenham");
  if (/norwich/.test(clean)) aliases.push("norwich");
  return aliases;
};
const resolveClub = (row, clubs) => {
  const byId = clubs.find(c => row.club_id && String(c.id) === String(row.club_id));
  if (byId) return byId;
  const aliases = clubAliases(row.team);
  const exact = clubs.find(c => aliases.includes(normClub(c.name)) || aliases.includes(normClub(c.short_name)));
  if (exact) return exact;
  const alias = aliases.find(x => ["bayern", "tottenham", "norwich"].includes(x));
  if (!alias) return null;
  const matching = clubs.filter(c => clubAliases(c.name).includes(alias));
  return matching.length === 1 ? matching[0] : null;
};
const clubColor = club => {
  const primary = club?.primary_color || club?.primaryColor || "#23345a";
  const secondary = club?.secondary_color || club?.secondaryColor || "#23345a";
  // Los tonos blancos y casi blancos se sustituyen por el secundario para mantener contraste.
  const n = /^#[0-9a-f]{6}$/i.test(primary) ? [1,3,5].map(i=>parseInt(primary.slice(i,i+2),16)) : [30,45,80];
  return n.every(v=>v>225) ? secondary : primary;
};
function MiniTooltip({ active, payload, minimum, maximum }) {
  if (!active || !payload?.length) return null;
  const entry = payload.find(p => p?.payload?.date)?.payload;
  // Los puntos de unión entre equipos son interpolaciones visuales, no registros reales.
  if (!entry?.date || !Number.isFinite(entry.value)) return null;
  const isMax = entry.value === maximum;
  const isMin = entry.value === minimum;
  return <div className="min-w-[170px] rounded-xl border border-slate-200 bg-white/95 px-3 py-2.5 text-xs text-slate-900 shadow-xl">
    <div className="text-[10px] font-semibold text-slate-500">{new Date(entry.date + "T12:00:00").toLocaleDateString("es-ES", {day:"2-digit",month:"long",year:"numeric"})}</div>
    <div className="mt-1 text-lg font-black">{prettyMoney(entry.value)}</div>
    {entry.team && <div className="mt-1.5 flex items-center gap-2 border-t border-slate-100 pt-2 text-slate-700">
      {entry.clubLogo && <img src={entry.clubLogo} alt="" className="h-6 w-6 object-contain"/>}
      <span className="font-semibold">{entry.club?.name || entry.team}</span>
    </div>}
    {(isMax || isMin) && <div className="mt-2 flex gap-1.5">
      {isMax && <span className="rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">Máximo histórico</span>}
      {isMin && <span className="rounded-md bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-700">Mínimo histórico</span>}
    </div>}
  </div>;
}
export default function TransferChartMini({ player, clubs = [] }) {
  const id = player?.id;
  const [rows, setRows] = useState(() => readStored(id) ?? originalRows(player));
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => { setRows(readStored(id) ?? originalRows(player)); setOpen(false); }, [id]);
  useEffect(() => {
    const sync = (event) => {
      if (event.type === "storage" && event.key !== storageKey(id)) return;
      if (event.type === "mf-legacy-market-preview-updated" && String(event.detail?.playerId) !== String(id)) return;
      setRows(readStored(id) ?? originalRows(player));
    };
    window.addEventListener("mf-legacy-market-preview-updated", sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener("mf-legacy-market-preview-updated", sync); window.removeEventListener("storage", sync); };
  }, [id, player]);
  const data = useMemo(() => validRows(rows).map((r) => {
    const club = resolveClub(r,clubs);
    return {...r, timestamp:new Date(r.date+"T12:00:00").getTime(),
      team:r.team||club?.name||"", club, clubLogo:club?.logo||club?.logo_url||club?.badge_url||"",
      color:clubColor(club)};
  }), [rows, clubs]);
  const yearTicks=useMemo(()=>{
    if(!data.length)return [];
    const start=new Date(data[0].timestamp).getFullYear();
    const end=new Date(data[data.length-1].timestamp).getFullYear();
    const ticks=[];
    for(let year=Math.ceil(start/2)*2;year<=end;year+=2) {
      const time=new Date(year,0,1,12).getTime();
      if(time>=data[0].timestamp&&time<=data[data.length-1].timestamp)ticks.push(time);
    }
    return ticks;
  },[data]);
  const latest=data.at(-1);
  const maxValue=data.length?Math.max(...data.map(row=>row.value)):null;
  const minValue=data.length?Math.min(...data.map(row=>row.value)):null;
  const axisTop=maxValue===null?1:Math.max(1,maxValue*1.05);
  const axisTicks=[0,axisTop/2,axisTop].map(v=>Math.round(v*100)/100);
  const segments=useMemo(()=>{
    const result=[];
    data.forEach((point,i)=>{
      const key=point.club?.id||normClub(point.team)||"unknown";
      const last=result.at(-1);
      if(last?.key===key)last.indices.push(i);
      else result.push({key,club:point.club,color:point.color,indices:[i]});
    });
    return result;
  },[data]);
  const chartData=useMemo(()=>{
    const result=data.map(p=>({...p}));
    segments.forEach((segment,i)=>{
      segment.indices.forEach(j=>{result[j][`s${i}`]=result[j].value;});
    });
    // Frontera única entre etapas: punto interpolado a mitad del intervalo entre
    // la última valoración del club anterior y la primera del siguiente.
    // Ambas curvas comparten ese punto exacto sin inventar una nueva valoración.
    const boundaries=[];
    segments.slice(1).forEach((segment,i)=>{
      const leftIndex=segments[i].indices.at(-1);
      const rightIndex=segment.indices[0];
      const left=data[leftIndex],right=data[rightIndex];
      if(!left||!right||right.timestamp<=left.timestamp)return;
      const boundaryTime=(left.timestamp+right.timestamp)/2;
      const boundaryValue=(left.value+right.value)/2;
      boundaries.push({
        timestamp:boundaryTime,value:boundaryValue,date:"",
        [`s${i}`]:boundaryValue,[`s${i+1}`]:boundaryValue,
      });
    });
    return [...result,...boundaries].sort((a,b)=>a.timestamp-b.timestamp);
  },[data,segments]);
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
    <div className="pointer-events-auto relative flex h-full min-w-0 flex-1 flex-col text-slate-900">
      {data.length>0 ? <div className="min-h-0 flex-1" style={{minHeight:115}}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{top:24,right:9,bottom:0,left:1}}>
            <defs>{segments.map((seg,i)=><linearGradient key={i} id={`mini-market-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={seg.color} stopOpacity={0.35}/>
              <stop offset="100%" stopColor={seg.color} stopOpacity={0.02}/>
            </linearGradient>)}</defs>
            <XAxis dataKey="timestamp" type="number" domain={["dataMin","dataMax"]} ticks={yearTicks} interval={0} tickFormatter={v=>new Date(v).getFullYear()} tick={{fill:"#64748b",fontSize:9}} height={16} axisLine={false} tickLine={false} minTickGap={19}/>
            <YAxis yAxisId="market" hide domain={[0, axisTop]} ticks={axisTicks} allowDataOverflow={false}/>
            <CartesianGrid vertical={false} stroke="#64748b" strokeOpacity={0.13} strokeDasharray="3 4"/>
            <Tooltip content={<MiniTooltip minimum={minValue} maximum={maxValue}/>} cursor={{stroke:"#94a3b8",strokeDasharray:"3 3"}}/>
            {segments.map((seg,i)=><Area yAxisId="market" key={i} type="natural" dataKey={`s${i}`} stroke={seg.color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" fill={`url(#mini-market-${i})`} connectNulls={false} dot={false} activeDot={{r:3, strokeWidth:1.5}} isAnimationActive={false}/>)}
            {segments.map((segment,i)=>{
              const first=data[segment.indices[0]];
              const last=data[segment.indices[segment.indices.length-1]];
              if(!first?.clubLogo || !last)return null;
              // Punto medio temporal del tramo, con altura interpolada sobre la curva.
              const midpoint=(first.timestamp+last.timestamp)/2;
              const left=segment.indices.map(index=>data[index]).filter(point=>point.timestamp<=midpoint).at(-1)||first;
              const right=segment.indices.map(index=>chartData[index]).find(point=>point.timestamp>=midpoint)||last;
              const fraction=right.timestamp===left.timestamp?0:(midpoint-left.timestamp)/(right.timestamp-left.timestamp);
              const height=left.value+(right.value-left.value)*fraction;
              return <ReferenceDot yAxisId="market" key={i} x={midpoint} y={height} isFront={true} ifOverflow="visible"
                shape={({cx,cy})=><image href={first.clubLogo} x={cx-13} y={Math.max(0,cy-42)} width={26} height={26} preserveAspectRatio="xMidYMid meet"/>}/>;
            })}
          </AreaChart>
        </ResponsiveContainer>
      </div> : <div className="mt-3 flex flex-1 items-center text-xs text-slate-500">Pulsa + para introducir el primer valor histórico.</div>}
      <div className="mt-1 flex items-center justify-between gap-3 text-[10px]">
        <span className="text-slate-500">MÁXIMO <strong className="ml-1 font-black text-emerald-700">{maxValue === null ? "—" : prettyMoney(maxValue)}</strong></span>
        <span className="text-slate-500">MÍNIMO <strong className="ml-1 font-black text-rose-700">{minValue === null ? "—" : prettyMoney(minValue)}</strong></span>
      </div>
    </div>
    {open && typeof document !== "undefined" && createPortal(
      <div className="pointer-events-auto fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
        <div role="dialog" aria-modal="true" aria-label="Editar historial de mercado" className="max-h-[85vh] w-full max-w-[640px] overflow-y-auto rounded-2xl bg-white p-5 text-slate-900 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div><h2 className="text-lg font-black">Historial de valor de mercado</h2><p className="mt-1 text-xs text-slate-500">Primera prueba: fechas, millones de euros y club opcional. Los cambios se guardan solo en este navegador, no en Base44.</p></div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar"><X size={20}/></button>
          </div>
          <div className="mt-4 space-y-2">
            {draft.map((r, i) => <div key={i} className="grid grid-cols-[1fr_0.9fr_1.3fr_auto] items-center gap-2">
              <input aria-label="Fecha" type="date" className="min-w-0 rounded-lg border px-2 py-2 text-xs" value={r.date} onChange={(e) => setDraft((d) => d.map((x,j) => j===i?{...x,date:e.target.value}:x))}/>
              <input aria-label="Valor en millones de euros" type="number" step="any" min="0" placeholder="M€" className="min-w-0 rounded-lg border px-2 py-2 text-xs" value={r.value} onChange={(e) => setDraft((d) => d.map((x,j) => j===i?{...x,value:e.target.value}:x))}/>
              <input aria-label="Club" list="market-mini-clubs" placeholder="Club (opcional)" className="min-w-0 rounded-lg border px-2 py-2 text-xs" value={r.team} onChange={(e) => setDraft((d) => d.map((x,j) => j===i?{...x,team:e.target.value,club_id:""}:x))}/>
              <button type="button" title="Eliminar registro" aria-label="Eliminar registro" className="rounded-lg p-2 text-red-600" onClick={() => setDraft((d) => d.filter((_,j)=>j!==i))}><Trash2 size={16}/></button>
            </div>)}
            <datalist id="market-mini-clubs">{clubs.map((c) => <option key={c.id} value={c.name}/>)}</datalist>
          </div>
          <button type="button" className="mt-4 inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm" onClick={() => setDraft((d) => [...d, {date:"",value:"",team:"",club_id:""}])}><Plus size={16}/> Añadir fecha</button>
          {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
          <div className="mt-5 flex justify-end gap-2"><button type="button" className="rounded-lg border px-4 py-2 text-sm" onClick={() => setOpen(false)}>Cancelar</button><button type="button" className="rounded-lg bg-blue-800 px-4 py-2 text-sm font-semibold text-white" onClick={save}>Guardar prueba</button></div>
        </div>
      </div>, document.body
    )}
  </>;
}
