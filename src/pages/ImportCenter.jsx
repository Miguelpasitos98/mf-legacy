import React, { useCallback, useEffect, useState } from "react";
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
  const [searching,setSearching]=useState(false);
  const [searchOpen,setSearchOpen]=useState(false);
  const [links,setLinks]=useState([]);
  const [jobs,setJobs]=useState([]);
  const [candidateRows,setCandidateRows]=useState([]);
  const [selectedJob,setSelectedJob]=useState("");
  const [selection,setSelection]=useState("");
  const [selectedPlayer,setSelectedPlayer]=useState(null);
  const [search,setSearch]=useState("");
  const [selectedSources,setSelectedSources]=useState(SOURCES.map(x=>x.id));
  const [fotmobDraft,setFotmobDraft]=useState("");
  const [identityConfirmed,setIdentityConfirmed]=useState(false);
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
  useEffect(()=>{
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
  useEffect(()=>{
    if(selectedPlayer && search===selectedPlayer.name){setSearching(false);return;}
    const term=search.trim();
    if(term.length<2){setPlayers([]);setSearching(false);return;}
    let cancelled=false;
    setSearching(true);
    const timer=setTimeout(async()=>{
      try{
        // Server-side search: works beyond the first 500 players.
        // Accent-tolerant for the most common Spanish/European names.
        const safe=term.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
        const accents={a:"[aáàäâãå]",e:"[eéèëê]",i:"[iíìïî]",o:"[oóòöôõ]",u:"[uúùüû]",n:"[nñ]",c:"[cç]"};
        const pattern=[...safe].map(ch=>accents[ch.toLowerCase()]||ch).join("");
        const result=responseRows(await base44.entities.Player.filter({name:{$regex:pattern,$options:"i"}},"name",30));
        if(!cancelled)setPlayers(result);
      }catch(e){if(!cancelled){setError(reason(e));setPlayers([]);}}
      finally{if(!cancelled)setSearching(false);}
    },300);
    return ()=>{cancelled=true;clearTimeout(timer);};
  },[search,selectedPlayer]);
  const player=selectedPlayer?.id===selection?selectedPlayer:players.find(p=>p.id===selection);
  const candidateIds=[...new Set(links.map(l=>String(l.fotmob_player_id||"")).filter(Boolean))];
  const fotmob=candidateIds.length===1?candidateIds[0]:"";
  const linked=links.some(l=>["confirmed","verified","manual","automatic_exact_name_unique"].includes(String(l.verification||"").toLowerCase()))&&Boolean(fotmob);
  const active=jobs.some(j=>j.player_id===selection&&ACTIVE.includes(j.status));
  const selectedJobData=jobs.find(j=>j.id===selectedJob);
  const operate=async(action,payload)=>{
    setBusy(true);setError("");setNotice("");
    try{
      const resp=await base44.functions.invoke("import-control",{action,...payload});
      setNotice(action==="start"?"Solicitud de extracción nueva registrada. Tu MF Legacy Studio la ejecutará cuando INICIAR_TRABAJADOR_V3.bat esté activo en tu ordenador.":action==="retry"?"Trabajo en cola de nuevo.":action==="release-stale"?"Concesión caducada liberada; ya puedes reintentar.":"Trabajo cancelado.");
      if(resp?.data?.job?.id)setSelectedJob(resp.data.job.id);
      await refresh();
    }catch(e){setError(reason(e));}
    finally{setBusy(false);}
  };
  const linkManually=async()=>{
    if(!player||!/^[0-9]{1,15}$/.test(fotmobDraft)||!identityConfirmed)return;
    setBusy(true);setError("");setNotice("");
    try{
      await base44.functions.invoke("import-control",{action:"link",player_id:player.id,
        fotmob_player_id:fotmobDraft,confirmed:true});
      const result=await base44.entities.PlayerFotmobLink.filter({player_id:player.id},undefined,30);
      setLinks(responseRows(result));setNotice("Identificador FotMob registrado. Ya puedes procesar fuentes históricas existentes.");
      setFotmobDraft("");setIdentityConfirmed(false);
    }catch(e){setError(reason(e));}finally{setBusy(false);}
  };
  const scanCache=async()=>{
    if(!player||!linked)return;
    setBusy(true);setError("");setNotice("");
    try{
      const response=await base44.functions.invoke("import-cache",{player_id:player.id,sources:selectedSources});
      const result=response?.data||{};
      if(!result.ok)throw Error(result.error||"El análisis de cachés no pudo completarse");
      setSelectedJob(result.job_id||"");
      setNotice((result.created||0)===0&&(result.already_staged||0)===0
        ? "Análisis finalizado sin datos: este jugador no tiene nuevas estadísticas archivadas que podamos aplicar. Necesita una primera importación de Studio o una fuente externa conectada. No se ha actualizado STATS."
        : "Datos ya guardados: "+(result.created||0)+" métricas nuevas propuestas, "+(result.already_staged||0)+" ya registradas y "+(result.unmatched||0)+" registros sin coincidencia exacta. No se ha sobrescrito ninguna estadística.");
      await refresh();
    }catch(e){setError(reason(e));}finally{setBusy(false);}
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
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 mb-4 text-sm text-amber-900 flex gap-2"><AlertTriangle size={19} className="shrink-0"/>{coordinator==="ready"?"Para jugadores sin historial, utiliza «Solicitar datos NUEVOS desde Studio». No requiere una API comercial, pero necesitas el trabajador Python encendido en tu PC y las fuentes permitidas/configuradas. Si está apagado, el trabajo seguirá en cola.":coordinator==="checking"?"Comprobando los servicios de importación...":"El backend de importaciones no es accesible. No se admiten solicitudes hasta restaurar el coordinador."}</div>
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <section className="rounded-xl bg-white border border-slate-200 p-5 space-y-3">
        <h2 className="font-semibold text-lg">Nueva importación</h2>
        <div className="relative">
          <Search size={16} className="absolute top-3 left-3 text-slate-400"/>
          <input aria-label="Buscar jugador por nombre" autoComplete="off" value={search} onChange={e=>{setSearch(e.target.value);setSelection("");setSelectedPlayer(null);setLinks([]);setSearchOpen(true);}} onFocus={()=>setSearchOpen(true)} placeholder="Escribe el nombre del jugador (ej. Rüdiger)..." className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2"/>
          {search.trim().length>=2&&searchOpen&&<div role="listbox" aria-label="Resultados de jugadores" className="absolute z-30 top-full mt-1 w-full max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg">
            {searching?<div className="p-3 text-sm text-slate-500">Buscando en todos los jugadores…</div>:
            players.length?players.map(p=><button role="option" aria-selected={p.id===selection} key={p.id} type="button" onClick={()=>{setSelection(p.id);setSelectedPlayer(p);setSearch(p.name);setSearchOpen(false);}} className="block w-full text-left px-3 py-2 text-sm hover:bg-blue-50 focus:bg-blue-50">{p.name}</button>):
            <div className="p-3 text-sm text-slate-500">No se encontraron jugadores.</div>}
          </div>}
        </div>
        {selection&&player&&<div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-sm"><strong>Seleccionado: {player.name}</strong><button type="button" onClick={()=>{setSelection("");setSelectedPlayer(null);setSearch("");setLinks([]);}} className="ml-3 text-blue-800 underline">Cambiar</button></div>}
        {selection&&<p className="text-sm text-slate-600">FotMob: <strong>{fotmob||"Sin vínculo único"}</strong>{linked?" · Vinculación registrada":" · Requiere revisión"}</p>}
        {player&&!linked&&links.length===0&&<div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
          <p className="text-sm font-semibold">Vincular identificador FotMob</p>
          <p className="text-xs text-slate-600">Introduce el ID numérico que hayas comprobado en el perfil o exportación original. No se buscará ni deducirá por nombre.</p>
          <input type="text" inputMode="numeric" aria-label="ID FotMob verificado" maxLength={15}
            value={fotmobDraft} onChange={e=>setFotmobDraft(e.target.value.replace(/[^0-9]/g,""))}
            placeholder="Ej. 276738" className="w-full border rounded-md px-3 py-2 text-sm"/>
          <label className="flex gap-2 items-start text-xs"><input type="checkbox" checked={identityConfirmed} onChange={e=>setIdentityConfirmed(e.target.checked)}/>
            He comprobado que el ID corresponde exactamente al jugador seleccionado.</label>
          <button type="button" onClick={linkManually} disabled={coordinator!=="ready"||busy||!identityConfirmed||!/^[0-9]{1,15}$/.test(fotmobDraft)}
            className="px-4 py-2 bg-[#003399] text-white rounded-md text-sm disabled:opacity-40">Guardar vinculación</button>
        </div>}
        <h3 className="font-semibold text-sm">Fuentes</h3>
        <div className="grid grid-cols-2 gap-2">{SOURCES.map(s=><label className="flex items-center gap-2 text-sm" key={s.id}><input type="checkbox" checked={selectedSources.includes(s.id)} onChange={e=>setSelectedSources(v=>e.target.checked?[...v,s.id]:v.filter(x=>x!==s.id))}/>{s.label}</label>)}</div>
        <button disabled={coordinator!=="ready"||!player||!linked||active||!selectedSources.length||busy} onClick={()=>operate("start",{player_id:player.id,sources:selectedSources})} className="w-full py-3 rounded-lg bg-[#003399] text-white font-semibold disabled:opacity-40">Solicitar datos NUEVOS desde Studio (PC)</button>
        <button disabled={coordinator!=="ready"||!player||!linked||!selectedSources.length||busy} onClick={scanCache} className="w-full py-2 rounded-lg border border-[#003399] text-[#003399] bg-white font-semibold disabled:opacity-40">Reutilizar datos ya guardados</button>
        {active&&<p className="text-xs text-amber-800">Este jugador ya tiene un trabajo en cola o ejecución.</p>}
        <p className="text-xs text-slate-500">Primera importación: el trabajador de tu PC consulta el perfil y las temporadas disponibles con los límites configurados. FIFA/FC y valores de mercado solo se completan desde catálogos históricos verificados. No se altera FM26.</p>
      </section>
      <section className="rounded-xl bg-white border border-slate-200 p-5 space-y-4">
        <h2 className="font-semibold text-lg">Control de integridad</h2>
        <div className="flex items-start gap-3 text-sm"><ShieldCheck className="text-[#003399] shrink-0"/><p>La información se guarda inicialmente como candidata. Solo se aplica cuando hay evidencia e identificación exacta.</p></div>
        <div className="flex items-start gap-3 text-sm"><Database className="text-[#003399] shrink-0"/><p>La sincronización conserva las entradas verificadas, correcciones manuales y diferencias entre competiciones.</p></div>
        <p className="text-xs text-slate-600">Cero es un valor válido; una métrica ausente no se convierte en cero. Las respuestas incompletas se conservan como pendientes de revisar.</p>
        <Link to="/import-unified" className="text-sm text-[#003399] underline">Importar el primer JSON del jugador desde MF Legacy Studio</Link>
        <p className="text-xs text-slate-600">El botón de caché no descarga temporadas nuevas. Para primeras importaciones, enciende el trabajador V3 desde tu PC y utiliza el botón principal «Solicitar datos NUEVOS desde Studio».</p>
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
            <td className="pr-3 py-3">{j.worker_version==="base44-cache-v1"&&j.status==="completed"&&(j.received_candidates||0)===0?"Sin datos nuevos":STATUS[j.status]||j.status}</td>
            <td className="pr-3 py-3">{j.worker_version==="base44-cache-v1"?"Análisis "+(j.progress||0)+"%":(j.progress||0)+"%"}</td>
            <td className="pr-3 py-3">{fmt(j.requested_at||j.created_date)}</td>
            <td className="py-3 space-x-2">
              <button onClick={()=>setSelectedJob(j.id)} className="text-[#003399] underline">Ver diagnóstico</button>
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 my-3">{(selectedJobData.sources||[]).map(s=><div key={s} className="border border-slate-200 rounded-md p-2 text-sm"><strong>{SOURCES.find(x=>x.id===s)?.label||s}:</strong> {selectedJobData.source_results?.[s]?.status==="complete"?"Revisada":selectedJobData.source_results?.[s]?.status==="error"?"Error":selectedJobData.source_results?.[s]?.status==="unavailable"?"Sin datos archivados disponibles":"Pendiente"}<div className="text-xs text-slate-500">{selectedJobData.source_results?.[s]?.note||""}</div></div>)}</div>
      {selectedJobData.worker_version==="base44-cache-v1"&&selectedJobData.status==="completed"&&(selectedJobData.received_candidates||0)===0&&<div className="rounded-lg border border-amber-200 bg-amber-50 p-3 my-3 text-sm"><strong>El análisis ha finalizado, pero no ha importado datos nuevos.</strong><p>Para este jugador necesitamos primero un archivo exportado de MF Legacy Studio o conectar una fuente autorizada.</p><Link to="/import-unified" className="inline-block mt-2 text-blue-800 underline">Ir a la primera importación JSON</Link></div>}
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