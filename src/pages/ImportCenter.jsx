import React, { useCallback, useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { AlertTriangle, Database, RefreshCw, ShieldCheck, Search } from "lucide-react";

const SOURCES=[{id:"fotmob",label:"FotMob"},{id:"understat",label:"Understat"},{id:"fifa",label:"FIFA / EA FC"},{id:"market",label:"Transfermarkt"}];
const ACTIVE=["queued","running"];
const STATUS={queued:"En cola",running:"Procesando",review:"Revisión pendiente",completed:"Completado",failed:"Error",cancelled:"Cancelado"};
const fmt=x=>x?new Date(x).toLocaleString("es-ES"):"—";
const reason=e=>e?.response?.data?.error||e?.message||"Error inesperado";
const responseRows=r=>Array.isArray(r)?r:r?.items||r?.data||r?.entities||[];

export default function ImportCenter(){
  const [players,setPlayers]=useState([]);
  const [canLoadMore,setCanLoadMore]=useState(true);
  const [links,setLinks]=useState([]);
  const [jobs,setJobs]=useState([]);
  const [candidateRows,setCandidateRows]=useState([]);
  const [selectedJob,setSelectedJob]=useState("");
  const [selection,setSelection]=useState("");
  const [search,setSearch]=useState("");
  const [selectedSources,setSelectedSources]=useState(SOURCES.map(x=>x.id));
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [loaded,setLoaded]=useState(false);
  const [coordinator,setCoordinator]=useState("checking");

  const refresh=useCallback(async()=>{
    try{
      const result=await base44.entities.ImportJob.list("-created_date",100);
      setJobs(responseRows(result));setLoaded(true);
      if(selectedJob){
        const candidates=await base44.entities.ImportCandidate.filter({job_id:selectedJob},"-received_at",200);
        setCandidateRows(responseRows(candidates));
      }
    }catch(e){setError(reason(e));setLoaded(true);}
  },[selectedJob]);
  const loadPlayers=async(skip=0)=>{
    try{
      const result=responseRows(await base44.entities.Player.list("-created_date",500,skip,["id","name"]));
      setPlayers(prev=>skip===0?result:[...prev,...result.filter(p=>!prev.some(x=>x.id===p.id))]);
      setCanLoadMore(result.length===500);
    }catch(e){setError(reason(e));}
  };
  useEffect(()=>{
    loadPlayers(0);
    base44.functions.invoke("import-control",{action:"health"})
      .then(resp=>setCoordinator(resp.data?.ok?"ready":"unavailable"))
      .catch(()=>setCoordinator("unavailable"));
  },[]);
  useEffect(()=>{
    refresh();
    const timer=setInterval(()=>{if(document.visibilityState==="visible")refresh();},15000);
    return ()=>clearInterval(timer);
  },[refresh]);
  useEffect(()=>{
    setLinks([]);
    if(!selection)return;
    let live=true;
    base44.entities.PlayerFotmobLink.filter({player_id:selection},undefined,30)
      .then(result=>{if(live)setLinks(responseRows(result));})
      .catch(e=>{if(live)setError(reason(e));});
    return ()=>{live=false;};
  },[selection]);
  const candidates=useMemo(()=>players.filter(p=>(p.name||"").toLocaleLowerCase().includes(search.toLocaleLowerCase())).slice(0,70),[players,search]);
  const player=players.find(p=>p.id===selection);
  const candidateIds=[...new Set(links.map(l=>String(l.fotmob_player_id||"")).filter(Boolean))];
  const fotmob=candidateIds.length===1?candidateIds[0]:"";
  const linked=links.some(l=>["confirmed","verified","manual","automatic_exact_name_unique"].includes(String(l.verification||"").toLowerCase()))&&Boolean(fotmob);
  const active=jobs.some(j=>j.player_id===selection&&ACTIVE.includes(j.status));
  const selectedJobData=jobs.find(j=>j.id===selectedJob);
  const operate=async(action,payload)=>{
    setBusy(true);setError("");setNotice("");
    try{
      const resp=await base44.functions.invoke("import-control",{action,...payload});
      setNotice(action==="start"?"Trabajo creado. Se ejecutará cuando el trabajador seguro esté conectado.":action==="retry"?"Trabajo en cola de nuevo.":action==="release-stale"?"Concesión caducada liberada; ya puedes reintentar.":"Trabajo cancelado.");
      if(resp?.data?.job?.id)setSelectedJob(resp.data.job.id);
      await refresh();
    }catch(e){setError(reason(e));}
    finally{setBusy(false);}
  };
  const review=async(action,candidate_id)=>{
    setBusy(true);setError("");setNotice("");
    try{
      await base44.functions.invoke("import-review",{action,candidate_id});
      setNotice(action==="approve"?"Candidato incorporado sin reemplazar valores existentes.":action==="verify"?"Se ha registrado tu verificación de la fuente. Ya puedes aplicar el dato.":"Candidato descartado.");
      await refresh();
    }catch(e){setError(reason(e));}
    finally{setBusy(false);}
  };

  return <div className="h-full overflow-y-auto p-4 md:p-7 text-slate-800">
    <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
      <div><h1 className="text-2xl font-bold tracking-tight">Centro de importaciones <span className="text-[#003399]">V3</span></h1><p className="text-sm text-slate-600">FotMob · Understat · FIFA / EA FC · Mercado histórico</p></div>
      <button onClick={refresh} className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 bg-white hover:bg-slate-100"><RefreshCw size={16}/>Actualizar</button>
    </div>
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 mb-4 text-sm text-amber-900 flex gap-2"><AlertTriangle size={19} className="shrink-0"/>{coordinator==="ready"?"Coordinador disponible. El procesamiento automático requiere un trabajador externo activo y sus credenciales.":coordinator==="checking"?"Comprobando los servicios de importación...":"El backend de importaciones todavía no está publicado o no es accesible. Se muestra el historial, pero no se aceptan nuevas solicitudes."}</div>
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <section className="rounded-xl bg-white border border-slate-200 p-5 space-y-3">
        <h2 className="font-semibold text-lg">Nueva importación</h2>
        <div className="relative"><Search size={16} className="absolute top-3 left-3 text-slate-400"/><input value={search} onChange={e=>{setSearch(e.target.value);setSelection("");}} placeholder="Buscar jugador..." className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2"/></div>
        <select aria-label="Jugador" value={selection} onChange={e=>setSelection(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2">
          <option value="">Seleccionar jugador existente</option>
          {candidates.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {canLoadMore&&<button className="text-sm text-[#003399] underline" onClick={()=>loadPlayers(players.length)}>Cargar más jugadores</button>}
        {selection&&<p className="text-sm text-slate-600">FotMob: <strong>{fotmob||"Sin vínculo único"}</strong>{linked?" · Vinculación registrada":" · Requiere revisión"}</p>}
        <h3 className="font-semibold text-sm">Fuentes</h3>
        <div className="grid grid-cols-2 gap-2">{SOURCES.map(s=><label className="flex items-center gap-2 text-sm" key={s.id}><input type="checkbox" checked={selectedSources.includes(s.id)} onChange={e=>setSelectedSources(v=>e.target.checked?[...v,s.id]:v.filter(x=>x!==s.id))}/>{s.label}</label>)}</div>
        <button disabled={coordinator!=="ready"||!player||!linked||active||!selectedSources.length||busy} onClick={()=>operate("start",{player_id:player.id,sources:selectedSources})} className="w-full py-3 rounded-lg bg-[#003399] text-white font-semibold disabled:opacity-40">Añadir a cola de importación</button>
        {active&&<p className="text-xs text-amber-800">Este jugador ya tiene un trabajo en cola o ejecución.</p>}
        <p className="text-xs text-slate-500">La identidad se vuelve a validar en el servidor; no se crean nuevos jugadores ni se altera FM26.</p>
      </section>
      <section className="rounded-xl bg-white border border-slate-200 p-5 space-y-4">
        <h2 className="font-semibold text-lg">Control de integridad</h2>
        <div className="flex items-start gap-3 text-sm"><ShieldCheck className="text-[#003399] shrink-0"/><p>La información se guarda inicialmente como candidata. Solo se aplica cuando hay evidencia e identificación exacta.</p></div>
        <div className="flex items-start gap-3 text-sm"><Database className="text-[#003399] shrink-0"/><p>La sincronización conserva las entradas verificadas, correcciones manuales y diferencias entre competiciones.</p></div>
        <p className="text-xs text-slate-600">Cero es un valor válido; una métrica ausente no se convierte en cero. Las respuestas incompletas se conservan como pendientes de revisar.</p>
        <Link to="/import-unified" className="text-sm text-[#003399] underline">Acceder al importador JSON anterior</Link>
      </section>
    </div>
    {error&&<p role="alert" className="my-3 rounded-lg bg-red-50 border border-red-200 text-red-800 p-3 text-sm">{error}</p>}
    {notice&&<p role="status" className="my-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 p-3 text-sm">{notice}</p>}
    <section className="rounded-xl bg-white border border-slate-200 p-5 mt-5">
      <h2 className="font-semibold text-lg mb-4">Trabajos de importación</h2>
      {!loaded?<p>Cargando…</p>:!jobs.length?<p className="text-sm text-slate-500">No hay trabajos registrados.</p>:
        <div className="overflow-x-auto"><table className="w-full text-sm text-left">
          <thead><tr className="border-b"><th className="py-2 pr-3">Jugador</th><th className="pr-3">Fuentes</th><th className="pr-3">Estado</th><th className="pr-3">Progreso</th><th className="pr-3">Fecha</th><th>Opciones</th></tr></thead>
          <tbody>{jobs.map(j=><tr key={j.id} className="border-b align-top">
            <td className="py-3 pr-3 font-medium">{j.player_name||j.player_id}<div className="text-xs font-normal text-slate-500 max-w-56">{j.phase}</div>{j.last_error&&<div className="text-xs text-red-700">{j.last_error}</div>}</td>
            <td className="pr-3 py-3">{(j.sources||[]).join(", ")}</td>
            <td className="pr-3 py-3">{STATUS[j.status]||j.status}</td>
            <td className="pr-3 py-3">{j.progress||0}%</td>
            <td className="pr-3 py-3">{fmt(j.requested_at||j.created_date)}</td>
            <td className="py-3 space-x-2">
              <button onClick={()=>setSelectedJob(j.id)} className="text-[#003399] underline">Ver detalles</button>
              {ACTIVE.includes(j.status)&&<button disabled={busy||coordinator!=="ready"} onClick={()=>operate("cancel",{job_id:j.id})} className="text-amber-800 underline">Cancelar</button>}
              {j.status==="running"&&j.lease_expires_at&&Date.now()>new Date(j.lease_expires_at).getTime()&&<button disabled={busy||coordinator!=="ready"} onClick={()=>operate("release-stale",{job_id:j.id})} className="text-amber-800 underline">Liberar bloqueo</button>}
              {["failed","cancelled"].includes(j.status)&&<button disabled={busy||coordinator!=="ready"} onClick={()=>operate("retry",{job_id:j.id,player_id:j.player_id})} className="text-[#003399] underline">Reintentar</button>}
            </td>
          </tr>)}</tbody>
        </table></div>}
    </section>
    {selectedJobData&&<section className="rounded-xl bg-white border border-slate-200 p-5 mt-4">
      <div className="flex items-center justify-between"><h2 className="font-semibold text-lg">Revisión · {selectedJobData.player_name}</h2><button onClick={()=>setSelectedJob("")} className="text-sm text-slate-500 underline">Cerrar</button></div>
      <p className="text-xs text-slate-500 my-2">Solo las observaciones verificadas y con coincidencia exacta se pueden aplicar. Las demás quedan disponibles para investigación.</p>
      <div className="space-y-2">{!candidateRows.length?<p className="text-sm text-slate-500">Este trabajo aún no ha recibido observaciones.</p>:candidateRows.map(c=><div key={c.id} className="flex flex-wrap gap-3 items-center justify-between border rounded-lg p-3">
        <div className="text-sm"><strong>{c.kind==="metric"?c.metric_name:c.kind==="overall"?"Overall FIFA/FC":"Valor de mercado"}</strong> · {c.value} {c.metric_unit||""}
          <div className="text-xs text-slate-500">{c.source} · {c.season} · {c.competition||c.fifa_edition||c.as_of_date||""}</div>
          <div className="text-xs text-slate-500">Evidencia: {c.verification_status} · {c.review_status}</div>
          {c.evidence_url&&<a className="text-xs text-blue-800 underline" href={c.evidence_url} target="_blank" rel="noopener noreferrer">Consultar fuente</a>}
        </div>
        {c.review_status==="pending"&&<div className="flex items-center gap-3 text-sm">
          {c.verification_status!=="verified"&&c.evidence_url&&<button disabled={busy||coordinator!=="ready"} onClick={()=>review("verify",c.id)} className="text-amber-800 underline">He verificado la fuente</button>}
          <button disabled={busy||coordinator!=="ready"||c.verification_status!=="verified"} onClick={()=>review("approve",c.id)} className="text-[#003399] underline disabled:opacity-30">Aplicar</button>
          <button disabled={busy||coordinator!=="ready"} onClick={()=>review("reject",c.id)} className="text-red-700 underline">Descartar</button>
        </div>}
      </div>)}</div>
    </section>}
  </div>;
}
