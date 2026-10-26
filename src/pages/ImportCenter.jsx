import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { RefreshCw, Database, ShieldCheck, AlertTriangle } from "lucide-react";

const SOURCES = [{id:"fotmob",label:"FotMob"},{id:"understat",label:"Understat"},{id:"fifa",label:"FIFA / EA FC"},{id:"market",label:"Transfermarkt"}];
const ACTIVE = ["queued","running","review"];
const fmt = (date) => date ? new Date(date).toLocaleString("es-ES") : "—";

export default function ImportCenter() {
  const [players,setPlayers] = useState([]);
  const [links,setLinks] = useState([]);
  const [jobs,setJobs] = useState([]);
  const [selection,setSelection] = useState("");
  const [search,setSearch] = useState("");
  const [selected,setSelected] = useState(SOURCES.map(s=>s.id));
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [message,setMessage] = useState("");
  const [loaded,setLoaded] = useState(false);
  const refresh = async () => {
    try {
      const [ps,ls,js] = await Promise.all([
        base44.entities.Player.list("-created_date",500),
        base44.entities.PlayerFotmobLink.list("-created_date",500),
        base44.entities.ImportJob.list("-created_date",100)
      ]);
      setPlayers(ps || []);setLinks(ls || []);setJobs(js || []);setError("");setLoaded(true);
    } catch(e) {setError(e?.message || "No se pudieron cargar los registros");setLoaded(true);}
  };
  useEffect(()=>{refresh();const timer=setInterval(()=>{if(document.visibilityState==="visible")refresh();},15000);return ()=>clearInterval(timer);},[]);
  const candidates=useMemo(()=>players.filter(p=>(p.name||"").toLocaleLowerCase().includes(search.toLocaleLowerCase())).slice(0,60),[players,search]);
  const player=players.find(p=>p.id===selection);
  const linked=links.filter(l=>l.player_id===selection);
  const confirmed=linked.filter(l=>["confirmed","verified","manual"].includes((l.verification||"").toLowerCase()));
  const fotmob=confirmed.length===1 ? confirmed[0].fotmob_player_id : "";
  const launch=async()=>{
    setError("");setMessage("");
    if(!player || !selected.length) return;
    if(!fotmob) {setError("La vinculación FotMob no está confirmada de forma inequívoca. Revísala antes de crear el trabajo.");return;}
    if(jobs.some(j=>j.player_id===player.id && ACTIVE.includes(j.status))) {setError("Ya hay una importación abierta para este jugador. Revísala antes de crear otra.");return;}
    setBusy(true);
    try {
      const now=new Date().toISOString();
      await base44.entities.ImportJob.create({
        job_key:"mfv3:"+player.id+":"+Date.now(),
        player_id:player.id,
        player_name:player.name,
        fotmob_player_id:String(fotmob),
        sources:selected,
        status:"queued",
        phase:"Esperando trabajador Python; todavía no hay extractor conectado",
        progress:0,
        requested_at:now,
        source_results:Object.fromEntries(selected.map(s=>[s,{status:"pending"}]))
      });
      setMessage("Trabajo registrado en cola. La extracción no comenzará hasta conectar y activar el trabajador externo.");
      await refresh();
    } catch(e) {setError(e?.message||"No se pudo crear el trabajo");}
    finally {setBusy(false);}
  };
  return <div className="h-full overflow-y-auto p-5 md:p-8 text-slate-800">
    <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
      <div><h1 className="text-2xl font-bold tracking-tight">Centro de importaciones <span className="text-blue-800">V3</span></h1><p className="text-sm text-slate-600">FotMob · Understat · FIFA/FC · Mercado histórico</p></div>
      <button onClick={refresh} className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 bg-white hover:bg-slate-100"><RefreshCw size={16}/> Actualizar estado</button>
    </div>
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-5 text-sm text-amber-900 flex gap-2"><AlertTriangle size={19} className="shrink-0"/>Fase 1: la cola y el seguimiento están preparados. El trabajador Python externo y los accesos autorizados a las fuentes todavía no están conectados. Crear un trabajo no extrae estadísticas ni modifica STATS.</div>
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <section className="rounded-xl bg-white border border-slate-200 p-5 space-y-4">
        <h2 className="font-semibold text-lg">Nueva importación</h2>
        <label className="block text-sm font-medium">Buscar jugador existente</label>
        <input value={search} onChange={e=>{setSearch(e.target.value);setSelection("");}} placeholder="Nombre del jugador..." className="w-full border border-slate-300 rounded-lg px-3 py-2"/>
        <select value={selection} onChange={e=>setSelection(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2"><option value="">Selecciona un jugador</option>{candidates.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
        {selection && <p className="text-sm text-slate-600">ID FotMob confirmado: <strong>{fotmob||"Pendiente de confirmar"}</strong>{linked.length>1?" · Hay varias vinculaciones":""}</p>}
        <h3 className="font-medium text-sm">Fuentes solicitadas</h3>
        <div className="grid grid-cols-2 gap-3">{SOURCES.map(s=><label className="flex gap-2 items-center text-sm" key={s.id}><input type="checkbox" checked={selected.includes(s.id)} onChange={e=>setSelected(prev=>e.target.checked?[...prev,s.id]:prev.filter(x=>x!==s.id))}/>{s.label}</label>)}</div>
        <button disabled={!selection||!fotmob||!selected.length||busy} onClick={launch} className="w-full py-3 rounded-lg bg-blue-800 text-white font-semibold disabled:opacity-40">Registrar importación en cola</button>
        {error && <p role="alert" className="text-red-700 text-sm">{error}</p>}
        {message && <p role="status" className="text-emerald-800 text-sm">{message}</p>}
        <p className="text-xs text-slate-500">Solo administradores. No se modifican los datos de Player, PlayerSeasonStats ni PlayerHistoricalValuation al crear una solicitud.</p>
      </section>
      <section className="rounded-xl bg-white border border-slate-200 p-5 space-y-4">
        <h2 className="font-semibold text-lg">Integridad de datos</h2>
        <div className="flex items-start gap-3 text-sm"><ShieldCheck className="text-blue-800 shrink-0"/><p>Se mantienen las entidades actuales y las correcciones manuales. Los datos ausentes nunca se convierten en cero.</p></div>
        <div className="flex items-start gap-3 text-sm"><Database className="text-blue-800 shrink-0"/><p>Un trabajo requiere un jugador existente con vínculo FotMob confirmado. Las cuatro fuentes se almacenan como resultados independientes.</p></div>
        <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">Para importar automáticamente es necesario desplegar el motor Python y un puente autenticado servidor-servidor. Este panel no realiza scraping desde el navegador.</div>
        <Link to="/import-unified" className="inline-block text-blue-800 underline text-sm">Abrir importador JSON existente</Link>
      </section>
    </div>
    <section className="rounded-xl bg-white border border-slate-200 p-5 mt-5">
      <h2 className="font-semibold text-lg mb-4">Trabajos y sincronización</h2>
      {!loaded?<p>Cargando…</p>:jobs.length===0?<p className="text-sm text-slate-500">Aún no hay trabajos registrados.</p>:<div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr className="border-b"><th className="py-2 pr-4">Jugador</th><th className="pr-4">Fuentes</th><th className="pr-4">Estado</th><th className="pr-4">Progreso</th><th>Creado</th></tr></thead><tbody>{jobs.map(j=><tr className="border-b" key={j.id}><td className="py-3 pr-4 font-medium">{j.player_name||j.player_id}<div className="text-xs text-slate-500">{j.phase||""}</div>{j.last_error&&<div className="text-xs text-red-700">{j.last_error}</div>}</td><td className="pr-4">{(j.sources||[]).join(", ")}</td><td className="pr-4">{j.status}</td><td className="pr-4">{j.progress||0}%</td><td>{fmt(j.requested_at||j.created_date)}</td></tr>)}</tbody></table></div>}
    </section>
  </div>;
}