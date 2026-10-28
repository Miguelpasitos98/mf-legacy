import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceDot } from "recharts";
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
function MiniTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const entry = payload.find(p=>p.payload)?.payload;
  if (!entry) return null;
  return <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-xl">
    <div>{new Date(entry.date + "T12:00:00").toLocaleDateString("es-ES")}</div>
    <strong>{prettyMoney(entry.value)}</strong>
    {entry.team && <div className="mt-1 flex items-center gap-1.5 text-slate-500">{entry.clubLogo && <img src={entry.clubLogo} alt="" className="h-4 w-4 object-contain"/>}{entry.team}</div>}
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
  const latest=data.at(-1);
  const maxValue=data.length?Math.max(...data.map(row=>row.value)):null;
  const minValue=data.length?Math.min(...data.map(row=>row.value)):null;
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
      if(i>0){const j=segment.indices[0];result[j][`s${i-1}`]=result[j].value;}
    });
    return result;
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
    <div className="pointer-events-auto flex h-full min-w-0 flex-1 flex-col text-slate-900">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-500">Evolución del valor de mercado</div>
          <div className="mt-0.5 text-[18px] font-black leading-none">{latest ? prettyMoney(latest.value) : "Sin datos"}</div>
        </div>
        <button type="button" aria-label="Editar historial de valor de mercado" onClick={() => {setDraft(data.map(({date,value,team,club_id})=>({date,value:String(value),team,club_id})));setError("");setOpen(true);}} className="shrink-0 rounded-lg border border-slate-200 bg-white/65 p-2 text-slate-700 hover:bg-white">
          {data.length ? <Pencil size={14}/> : <Plus size={16}/>}
        </button>
      </div>
      {data.length>0 ? <div className="mt-1 min-h-0 flex-1" style={{minHeight:94}}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{top:17,right:5,bottom:0,left:0}}>
            <defs>{segments.map((seg,i)=><linearGradient key={i} id={`mini-market-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={seg.color} stopOpacity={0.35}/>
              <stop offset="100%" stopColor={seg.color} stopOpacity={0.02}/>
            </linearGradient>)}</defs>
            <XAxis dataKey="timestamp" type="number" domain={["dataMin","dataMax"]} tickFormatter={v=>new Date(v).getFullYear()} tick={{fill:"#64748b",fontSize:9}} height={16} axisLine={false} tickLine={false} minTickGap={19}/>
            <YAxis hide domain={[0, maxValue === null ? 1 : Math.max(1, maxValue * 1.05)]} allowDataOverflow={false}/>
            <Tooltip content={<MiniTooltip/>} cursor={{stroke:"#94a3b8",strokeDasharray:"3 3"}}/>
            {segments.map((seg,i)=><Area key={i} type="monotone" dataKey={`s${i}`} stroke={seg.color} strokeWidth={2.6} fill={`url(#mini-market-${i})`} connectNulls={false} dot={false} activeDot={false} isAnimationActive={false}/>)}
            {segments.map((segment,i)=>{
              const first=chartData[segment.indices[0]];
              const last=chartData[segment.indices[segment.indices.length-1]];
              if(!first?.clubLogo || !last)return null;
              // Punto medio temporal del tramo, con altura interpolada sobre la curva.
              const midpoint=(first.timestamp+last.timestamp)/2;
              const left=segment.indices.map(index=>chartData[index]).filter(point=>point.timestamp<=midpoint).at(-1)||first;
              const right=segment.indices.map(index=>chartData[index]).find(point=>point.timestamp>=midpoint)||last;
              const fraction=right.timestamp===left.timestamp?0:(midpoint-left.timestamp)/(right.timestamp-left.timestamp);
              const height=left.value+(right.value-left.value)*fraction;
              return <ReferenceDot key={i} x={midpoint} y={height} isFront={true} ifOverflow="visible"
                shape={({cx})=><image href={first.clubLogo} x={cx-10} y={0} width={20} height={20} preserveAspectRatio="xMidYMid meet"/>}/>;
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
      </div>, document.body
    )}
  </>;
}
