import React, { useCallback, useEffect, useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import {useQueryClient} from "@tanstack/react-query";
import {STATS_ROWS_KEY,STATS_DETAIL_KEY} from "@/utils/statsRowsCache";
import {HISTORICAL_PEER_KEY} from "@/utils/historicalPeerCache";
import {RECORD_KEYS} from "@/api/recordQueries";
import {readCompleteRecords} from "@/utils/entityRecords";
import { AlertTriangle, Database, RefreshCw, ShieldCheck, Search } from "lucide-react";
import HistoricalReview from "@/components/imports/HistoricalReview";
import {historyCanRetry} from "@/utils/importHistoryReview";
import {importProgressSummary} from "@/utils/importCoverage";

const SOURCES=[{id:"fotmob",label:"FotMob"},{id:"understat",label:"Understat"},{id:"fifa",label:"FIFA / EA FC"},{id:"market",label:"Transfermarkt"}];
const ACTIVE=["queued","running"];
const STATUS={queued:"En cola",running:"Procesando",review:"Revisión pendiente",completed:"Completado",failed:"Error",cancelled:"Cancelado"};
const SOURCE_STATES={no_consultado:"No consultado",consulta_pendiente:"Consulta pendiente",dato_encontrado:"Dato encontrado",pendiente_verificacion:"Pendiente de verificación",verificado_guardado:"Verificado y guardado",fuera_cobertura:"Fuera de cobertura",error_temporal:"Error temporal"};
const fmt=x=>x?new Date(x).toLocaleString("es-ES"):"—";
const queuedTooLong=job=>job?.status==="queued"&&!job.started_at&&Number.isFinite(Date.parse(job.requested_at||job.created_date))&&Date.now()-Date.parse(job.requested_at||job.created_date)>120000;
const reason=e=>e?.response?.data?.error||e?.message||"Error inesperado";
const responseRows=r=>Array.isArray(r)?r:r?.items||r?.data||r?.entities||[];
const missingFotmobCaches=job=>(job?.source_results?.fotmob?.diagnostics||[]).filter(d=>["cache_absent","cache_mismatch","candidate_limit","query_failed","provider_paused","rate_limited"].includes(d.status)).length;

export default function ImportCenter(){
  const cache=useQueryClient();
  const invalidateApplied=()=>Promise.all([STATS_ROWS_KEY,STATS_DETAIL_KEY,HISTORICAL_PEER_KEY,
    RECORD_KEYS.PlayerHistoricalValuation,["mf-legacy","players","stats-presence"]].map(queryKey=>cache.invalidateQueries({queryKey})));
  const [players,setPlayers]=useState([]);
  const [searching,setSearching]=useState(false);
  const [searchOpen,setSearchOpen]=useState(false);
  const [links,setLinks]=useState([]);
  const [linksState,setLinksState]=useState("idle");
  const [jobs,setJobs]=useState([]);
  const [candidateRows,setCandidateRows]=useState([]);
  const [preview,setPreview]=useState(null);
  const [selectedJob,setSelectedJob]=useState("");
  const [selection,setSelection]=useState("");
  const [selectedPlayer,setSelectedPlayer]=useState(null);
  const [search,setSearch]=useState("");
  const [selectedSources,setSelectedSources]=useState(SOURCES.map(x=>x.id));
  const [fotmobDraft,setFotmobDraft]=useState("");
  const [identityConfirmed,setIdentityConfirmed]=useState(false);
  const [reviewedGroups,setReviewedGroups]=useState({});
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [loaded,setLoaded]=useState(false);
  const [candidatesLoading,setCandidatesLoading]=useState(false);
  const [coordinator,setCoordinator]=useState("checking");
  const [statsStatus,setStatsStatus]=useState({state:"idle",count:0});
  const refreshSequence=useRef(0),currentJob=useRef(selectedJob);
  currentJob.current=selectedJob;

  const refresh=useCallback(async({forceCandidates=false}={})=>{
    const request=++refreshSequence.current;
    try{
      const result=await base44.entities.ImportJob.list("-created_date",100);
      if(request!==refreshSequence.current)return;
      setJobs(responseRows(result));setLoaded(true);
      if(selectedJob){
        const queryKey=["mf-legacy","import-candidates",selectedJob];
        const job=responseRows(result).find(j=>j.id===selectedJob);
        if(forceCandidates)await cache.invalidateQueries({queryKey,exact:true,refetchType:"none"});
        const candidates=await cache.fetchQuery({queryKey,
          queryFn:({signal})=>readCompleteRecords({list:options=>base44.entities.ImportCandidate.filter({job_id:selectedJob},options)},{signal,maxRecords:10000}),
          staleTime:job?.status==="completed"?Infinity:10000,retry:false});
        if(request===refreshSequence.current&&currentJob.current===selectedJob){setCandidateRows(candidates);setCandidatesLoading(false);setError("");}
      }
    }catch(e){if(request===refreshSequence.current){setError(reason(e));setLoaded(true);setCandidatesLoading(false);}}
  },[selectedJob,cache]);
  useEffect(()=>{
    base44.functions.invoke("import-control",{action:"health"})
      .then(resp=>setCoordinator(resp.data?.ok?"ready":"unavailable"))
      .catch(e=>setCoordinator([401,403].includes(e?.response?.status)?"auth_required":"unavailable"));
  },[]);
  useEffect(()=>{
    refresh();
    const timer=setInterval(()=>{if(document.visibilityState==="visible")refresh();},15000);
    return ()=>clearInterval(timer);
  },[refresh]);
  useEffect(()=>{setCandidateRows([]);setCandidatesLoading(Boolean(selectedJob));setPreview(null);setReviewedGroups({});},[selectedJob]);
  useEffect(()=>{
    setLinks([]);
    if(!selection){setLinksState("idle");return;}
    setLinksState("loading");
    let live=true;
    base44.entities.PlayerFotmobLink.filter({player_id:selection},undefined,30)
      .then(result=>{if(live){setLinks(responseRows(result));setLinksState("ready");}})
      .catch(e=>{if(live){setLinksState("error");setError(reason(e));}});
    return ()=>{live=false;};
  },[selection]);
  useEffect(()=>{
    if(!selection){setStatsStatus({state:"idle",count:0});return;}
    let active=true;
    setStatsStatus({state:"loading",count:0});
    base44.entities.PlayerSeasonStats.filter({player_id:selection},undefined,200)
      .then(result=>{if(active){const list=responseRows(result);setStatsStatus({state:list.length>=200?"partial":"ready",count:list.length});}})
      .catch(()=>{if(active)setStatsStatus({state:"error",count:0});});
    return()=>{active=false;};
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
  const linked=links.some(l=>["confirmed","verified","manual","manual_confirmada","confirmada","automatic_exact_name_unique"].includes(String(l.verification||"").toLowerCase()))&&Boolean(fotmob);
  const active=jobs.some(j=>j.player_id===selection&&ACTIVE.includes(j.status));
  const selectedJobData=jobs.find(j=>j.id===selectedJob);
  const waitingForWorker=jobs.filter(queuedTooLong);
  const chainProgress=importProgressSummary(jobs,selectedJobData);
  const importCoverage=chainProgress?.coverage;
  const seasonGroups=Object.values(candidateRows.filter(c=>c.kind==="metric").reduce((acc,c)=>{
    const k=[selectedJob,c.source,c.season,c.competition,c.fotmob_team_id].join("|");
    if(!acc[k])acc[k]={key:k,source:c.source,season:c.season,competition:c.competition,
      team:c.team_name,teamId:c.fotmob_team_id,items:[]};
    acc[k].items.push(c);return acc;
  },{})).sort((x,y)=>y.season.localeCompare(x.season)||x.team.localeCompare(y.team));
  const operate=async(action,payload)=>{
    setBusy(true);setError("");setNotice("");
    try{
      const resp=await base44.functions.invoke("import-control",{action,...payload});
      setNotice(action==="start"?"Historial solicitado. El trabajador local reutilizará las cachés y consultará las fuentes disponibles; después podrás revisar todas las temporadas juntas.":action==="retry-fotmob"?"Solo las competiciones FotMob pendientes están en cola; los valores anteriores se conservan.":action==="retry-pending"?"Solo los periodos pendientes están en cola; los datos encontrados y guardados se reutilizan.":["retry","resume"].includes(action)?"Trabajo en cola para reanudar desde sus datos guardados.":action==="release-stale"?"Concesión caducada liberada; ya puedes reintentar.":"Trabajo cancelado.");
      if(resp?.data?.job?.id)setSelectedJob(resp.data.job.id);
      await refresh({forceCandidates:true});
    }catch(e){setError(reason(e));}
    finally{setBusy(false);}
  };
  const approveSeason=async(group)=>{
    if(!reviewedGroups[group.key]||busy)return;
    const first=group.items.find(c=>c.review_status==="pending");
    if(!first)return;
    setBusy(true);setError("");setNotice("");
    try{
      const r=await base44.functions.invoke("import-review",{
        action:"approve-season",candidate_id:first.id,confirm_source_reviewed:true
      });
      if(!r?.data?.ok)throw Error(r?.data?.error||"No se pudo aprobar la temporada");
      setNotice((r.data.created_season?"Nueva temporada creada en STATS. ":"Temporada existente completada. ")+
        (r.data.new_metrics||0)+" observaciones incorporadas; los datos anteriores se han conservado.");
      setReviewedGroups(v=>({...v,[group.key]:false}));
      await invalidateApplied();
      await refresh({forceCandidates:true});
    }catch(e){setError(reason(e));}finally{setBusy(false);}
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
      await refresh({forceCandidates:true});
    }catch(e){setError(reason(e));}finally{setBusy(false);}
  };
  const review=async(action,candidate_id)=>{
    setBusy(true);setError("");setNotice("");
    try{
      const result=await base44.functions.invoke("import-review",{action,candidate_id});
      if(action==="preview"||action==="preview-season"){setPreview(result.data);return;}
      if(action==="approve")await invalidateApplied();
      setNotice(action==="approve"?"Candidato incorporado sin reemplazar valores existentes.":action==="verify"?"Se ha registrado tu verificación de la fuente. Ya puedes aplicar el dato.":"Candidato descartado.");
      await refresh({forceCandidates:true});
    }catch(e){setError(reason(e));}
    finally{setBusy(false);}
  };

  return <div className="h-full overflow-y-auto p-4 md:p-7 text-slate-800">
    <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
      <div><h1 className="text-2xl font-bold tracking-tight">Centro de importaciones <span className="text-[#003399]">V3</span></h1><p className="text-sm text-slate-600">FotMob · Understat · FIFA / EA FC · Mercado histórico</p></div>
      <button onClick={()=>refresh({forceCandidates:true})} className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 bg-white hover:bg-slate-100"><RefreshCw size={16}/>Actualizar</button>
    </div>
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 mb-4 text-sm text-amber-900 flex gap-2"><AlertTriangle size={19} className="shrink-0"/>{coordinator==="ready"?"El trabajador Studio de tu PC puede solicitar estadísticas nuevas de FotMob para IDs confirmados, con un máximo de 8 peticiones por trabajo. Los resultados se revisan antes de guardarlos; Understat, FIFA y mercado dependen de catálogos verificados disponibles.":coordinator==="auth_required"?"Inicia sesión con una cuenta de administrador para solicitar y revisar importaciones.":coordinator==="checking"?"Comprobando los servicios de importación...":"El backend de importaciones no es accesible. No se admiten solicitudes hasta restaurar el coordinador."}</div>
    {coordinator==="auth_required"&&<button className="bg-[#003399] text-white rounded-lg px-4 py-2 mb-4" onClick={()=>base44.auth.loginWithProvider("google",window.location.href)}>Iniciar sesión de administrador</button>}
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <section className="rounded-xl bg-white border border-slate-200 p-5 space-y-3">
        <h2 className="font-semibold text-lg">1. Seleccionar jugador de PLAYERS</h2>
        <p className="text-sm text-slate-600">Busca un futbolista que ya exista en PLAYERS, aunque todavía no tenga ninguna temporada en STATS. No se crearán fichas duplicadas.</p>
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
        {selection&&<p className="text-sm font-medium text-[#003399]">{statsStatus.state==="loading"?"Comprobando temporadas en STATS…":statsStatus.state==="ready"?(statsStatus.count===0?"Sin temporadas en STATS · Primera importación":statsStatus.count+" registros en STATS · Puedes añadir temporadas que falten"):statsStatus.state==="partial"?"Más de 199 registros: recuento parcial":"No se pudo consultar STATS; no se han modificado datos."}</p>}
        {selection&&<p className="text-sm text-slate-600">FotMob: <strong>{linksState==="loading"?"Comprobando vinculación…":linksState==="error"?"No se pudo comprobar el vínculo":fotmob||"Sin vínculo único"}</strong>{linksState==="ready"?(linked?" · Vinculación registrada":" · Requiere revisión"):""}</p>}
        {player&&linksState==="ready"&&!linked&&links.length===0&&<div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
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
        <h3 className="font-semibold text-sm">2. Fuentes para extraer estadísticas</h3>
        <div className="grid grid-cols-2 gap-2">{SOURCES.map(s=><label className="flex items-center gap-2 text-sm" key={s.id}><input type="checkbox" checked={selectedSources.includes(s.id)} onChange={e=>setSelectedSources(v=>e.target.checked?[...v,s.id]:v.filter(x=>x!==s.id))}/>{s.label}</label>)}</div>
        <button disabled={coordinator!=="ready"||!player||!linked||active||!selectedSources.length||busy} onClick={()=>operate("start",{player_id:player.id,sources:selectedSources})} className="w-full py-3 rounded-lg border border-[#003399] text-[#003399] bg-white font-semibold disabled:opacity-40">3. Recuperar historial disponible desde Studio (PC)</button>
        <button disabled={coordinator!=="ready"||!player||!linked||!selectedSources.length||busy} onClick={scanCache} className="w-full py-2 rounded-lg border border-[#003399] text-[#003399] bg-white font-semibold disabled:opacity-40">Reutilizar datos ya guardados</button>
        {active&&<p className="text-xs text-amber-800">Este jugador ya tiene un trabajo en cola o ejecución.</p>}
        <Link to="/import-native" className="inline-block text-xs text-[#003399] underline">Importar observaciones estructuradas archivadas (alternativa sin Studio)</Link>
        <p className="text-xs text-slate-500">Primera importación: el trabajador de tu PC consulta el perfil y las temporadas disponibles con los límites configurados. Understat usa ligas compatibles y cachés/archivos públicos. FIFA/FC usa revisiones de Career Mode anteriores al lanzamiento; mercado usa valoraciones fechadas dentro de cada temporada. No se altera FM26.</p>
      </section>
      <section className="rounded-xl bg-white border border-slate-200 p-5 space-y-4">
        <h2 className="font-semibold text-lg">Protección de las estadísticas</h2>
        <p className="text-xs text-slate-600">El motor web ya normaliza y crea temporadas desde registros estructurados. La obtención directa de datos nuevos requiere fuentes con acceso autorizado.</p>
        <div className="flex items-start gap-3 text-sm"><ShieldCheck className="text-[#003399] shrink-0"/><p>La información se guarda inicialmente como candidata. Solo se aplica cuando hay evidencia e identificación exacta.</p></div>
        <div className="flex items-start gap-3 text-sm"><Database className="text-[#003399] shrink-0"/><p>La sincronización conserva las entradas verificadas, correcciones manuales y diferencias entre competiciones.</p></div>
        <p className="text-xs text-slate-600">Cero es un valor válido; una métrica ausente no se convierte en cero. Las respuestas incompletas se conservan como pendientes de revisar.</p>
        <a href="https://github.com/Miguelpasitos98/mf-legacy/tree/main/worker" target="_blank" rel="noopener noreferrer" className="block text-sm text-[#003399] underline">Trabajador local de Studio (respaldo para extracciones nuevas)</a>
        <Link to="/import-unified" className="text-sm text-slate-600 underline">Importador JSON anterior (opcional)</Link>
        <p className="text-xs text-slate-600">El motor web permite crear primeras temporadas. El trabajador local sigue disponible como respaldo para consultas puntuales sujetas a los permisos del proveedor.</p>
      </section>
    </div>
    {error&&<p role="alert" className="my-3 rounded-lg bg-red-50 border border-red-200 text-red-800 p-3 text-sm">{error}</p>}
    {notice&&<p role="status" className="my-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 p-3 text-sm">{notice}</p>}
    <section className="rounded-xl bg-white border border-slate-200 p-5 mt-5">
      <h2 className="font-semibold text-lg mb-4">Trabajos de importación</h2>
      {waitingForWorker.length>0&&<div role="status" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
        <p className="font-extrabold">Trabajador local sin recoger {waitingForWorker.length===1?"una importación":`${waitingForWorker.length} importaciones`} · 0 %</p>
        <p className="mt-1">Base44 ha guardado la solicitud, pero el proceso Python de tu PC todavía no ha iniciado la extracción. La cola se mantiene: no vuelvas a importar al mismo jugador.</p>
        <p className="mt-2">En el ordenador que contiene MF Legacy Studio, ejecuta <strong>worker/INICIAR_TRABAJADOR_V3.bat</strong> y deja abierta su ventana. Si aparece un error, ejecuta <strong>worker/COMPROBAR_TRABAJADOR_V3.bat</strong> para revisar la configuración local. Si el trabajador está abierto, comprueba la conexión y credenciales en su consola.</p>
        <p className="mt-2 text-xs text-amber-800">En condiciones normales, la cola se recoge automáticamente al conectar el trabajador (consulta cada 30 segundos). La web no puede iniciar el proceso Windows por sí sola.</p>
      </div>}
      {!loaded?<p>Cargando…</p>:!jobs.length?<p className="text-sm text-slate-500">No hay trabajos registrados.</p>:
        <div className="overflow-x-auto"><table className="w-full text-sm text-left">
          <thead><tr className="border-b"><th className="py-2 pr-3">Jugador</th><th className="pr-3">Fuentes</th><th className="pr-3">Estado</th><th className="pr-3">Progreso</th><th className="pr-3">Fecha</th><th>Opciones</th></tr></thead>
          <tbody>{jobs.map(j=><tr key={j.id} className="border-b align-top">
            <td className="py-3 pr-3 font-medium">{j.player_name||j.player_id}<div className="text-xs font-normal text-slate-500 max-w-56">{j.phase}</div>{j.last_error&&<div className="text-xs text-red-700">{j.last_error}</div>}</td>
            <td className="pr-3 py-3">{(j.sources||[]).join(", ")}</td>
            <td className="pr-3 py-3">{queuedTooLong(j)?"En espera del trabajador (PC)":j.worker_version==="base44-cache-v1"&&j.status==="completed"&&(j.received_candidates||0)===0?"Sin datos nuevos":STATUS[j.status]||j.status}</td>
            <td className="pr-3 py-3">{j.status==="running"&&(j.progress||0)<=2?<span className="text-amber-800 font-semibold" title="El porcentaje de extracción no se puede medir hasta recibir candidatos">{(j.progress||0)+"% · Extrayendo fuentes"}{j.heartbeat_at&&Date.now()-Date.parse(j.heartbeat_at)>90000?<span className="block text-xs font-normal text-red-700">Sin señales del PC desde hace {Math.floor((Date.now()-Date.parse(j.heartbeat_at))/60000)} min</span>:null}</span>:j.worker_version==="base44-cache-v1"?"Análisis "+(j.progress||0)+"%":(j.progress||0)+"%"}</td>
            <td className="pr-3 py-3">{fmt(j.requested_at||j.created_date)}</td>
            <td className="py-3 space-x-2">
              <button onClick={()=>setSelectedJob(j.id)} className="text-[#003399] underline">Ver diagnóstico</button>
              {ACTIVE.includes(j.status)&&<button disabled={busy||coordinator!=="ready"} onClick={()=>operate("cancel",{job_id:j.id})} className="text-amber-800 underline">Cancelar</button>}
              {j.status==="running"&&j.lease_expires_at&&Date.now()>new Date(j.lease_expires_at).getTime()&&<button disabled={busy||coordinator!=="ready"} onClick={()=>operate("resume",{job_id:j.id,player_id:j.player_id})} className="text-amber-800 underline">Reanudar trabajo</button>}
              {["failed","cancelled"].includes(j.status)&&<button disabled={busy||coordinator!=="ready"} onClick={()=>operate("retry",{job_id:j.id,player_id:j.player_id})} className="text-[#003399] underline">Reintentar</button>}
              {!ACTIVE.includes(j.status)&&historyCanRetry(j)&&<button disabled={busy||coordinator!=="ready"} onClick={()=>operate(missingFotmobCaches(j)>0?"retry-fotmob":"retry-pending",{job_id:j.id,player_id:j.player_id})} className="text-[#003399] underline">{missingFotmobCaches(j)>0?"Continuar solo FotMob":"Reintentar fuentes pendientes"}</button>}
            </td>
          </tr>)}</tbody>
        </table></div>}
    </section>
    {selectedJobData&&<section className="rounded-xl bg-white border border-slate-200 p-5 mt-4">
      <div className="flex items-center justify-between"><h2 className="font-semibold text-lg">Revisión · {selectedJobData.player_name}</h2><button onClick={()=>setSelectedJob("")} className="text-sm text-slate-500 underline">Cerrar</button></div>
      {chainProgress?.total>0&&<div className="my-4 space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4" role="status" aria-label="Progreso de importación y cobertura acumulada">
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
            <strong className="text-slate-800">Progreso del bloque {chainProgress.blockIndex}</strong>
            <span className="font-semibold tabular-nums text-[#003399]">{chainProgress.blockPercent}%</span>
          </div>
          <div role="progressbar" aria-label="Progreso del bloque de consultas" aria-valuenow={chainProgress.blockPercent} aria-valuemin={0} aria-valuemax={100} className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-slate-500 transition-[width] duration-500" style={{width:`${chainProgress.blockPercent}%`}}/>
          </div>
          <p className="mt-1.5 text-xs text-slate-500">{chainProgress.block.phase||"Esperando al trabajador"}</p>
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
            <strong className="text-slate-800">Cobertura acumulada de FotMob</strong>
            <span className="font-bold tabular-nums text-[#003399]">{chainProgress.coveragePercent}%</span>
          </div>
          <div role="progressbar" aria-label="Cobertura acumulada de competiciones FotMob" aria-valuenow={chainProgress.coveragePercent} aria-valuemin={0} aria-valuemax={100} className="h-2.5 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-[#003399] transition-[width] duration-500" style={{width:`${chainProgress.coveragePercent}%`}}/>
          </div>
          <p className="mt-1.5 text-xs text-slate-600">{chainProgress.covered} de {chainProgress.total} competiciones con respuesta · {importCoverage.missing} pendientes · {importCoverage.jobCount} bloques</p>
        </div>
      </div>}
      {importCoverage?.total>0&&<div className="my-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950" role="status">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <strong>Cobertura real de FotMob · {importCoverage.checked} de {importCoverage.total} competiciones consultadas con respuesta</strong>
          <span className="text-xs font-semibold">{importCoverage.running?"Extracción en curso":importCoverage.complete?"Inventario revisado":"Historial parcial"}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <span>{importCoverage.received} con estadísticas</span>
          <span>{importCoverage.noData} sin estadísticas del proveedor</span>
          <span className={importCoverage.missing?"font-bold text-amber-800":""}>{importCoverage.missing} por consultar o recuperar</span>
          <span className={importCoverage.withheld?"font-bold text-amber-800":""}>{importCoverage.withheld} con identidad/conflictos pendientes</span>
          <span>{importCoverage.jobCount} bloques de trabajo</span>
        </div>
        {importCoverage.stale&&<p className="mt-2 text-xs text-amber-800">El perfil de FotMob está desactualizado: el inventario no se considera completo.</p>}
        {importCoverage.limited&&<p className="mt-2 text-xs text-red-800">FotMob ha limitado o rechazado consultas. Se ha detenido la continuación automática para respetar el acceso del proveedor.</p>}
        <p className="mt-2 text-xs text-blue-800">El 100 % de «Progreso» indica que terminó un bloque de importación, no que FotMob ofrezca todos los indicadores de toda la carrera. STATS conserva los datos validados.</p>
      </div>}
      {missingFotmobCaches(selectedJobData)>0&&<div className="my-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950"><strong>Extracción FotMob incompleta:</strong> quedan {missingFotmobCaches(selectedJobData)} entradas históricas sin recuperar. Las peticiones anteriores ya alcanzaron el límite por trabajo. <button type="button" disabled={busy||coordinator!=="ready"||ACTIVE.includes(selectedJobData.status)} onClick={()=>operate("retry-fotmob",{job_id:selectedJobData.id,player_id:selectedJobData.player_id})} className="ml-2 font-semibold text-[#003399] underline disabled:opacity-40">Recuperar historial de FotMob</button><p className="mt-1 text-xs">El trabajador del PC recuperará entradas por bloques limitados, con intervalos y un máximo preventivo por solicitud; se detiene si FotMob restringe las consultas. Conserva las temporadas existentes. Las entradas que la fuente no proporcione seguirán sin estadísticas.</p></div>}
      {queuedTooLong(selectedJobData)&&<p role="status" className="my-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">Este trabajo aún no ha comenzado: ningún trabajador de Studio lo ha recogido. Inicia o comprueba el trabajador Python en tu PC; esta solicitud seguirá en cola y no es necesario repetirla.</p>}
      <p className="text-xs text-slate-500 my-2">Para crear una primera temporada, comprueba la fuente y aprueba el lote de esa competición. Para valores individuales FIFA/mercado conserva la revisión específica. Los datos anteriores nunca se sobrescriben.</p>
      {selectedJobData.status==="completed"&&candidateRows.length>0&&<p className="text-sm font-semibold text-emerald-700">Revisión completada · {candidateRows.filter(c=>c.review_status==="applied").length} candidatos aplicados.</p>}
      <p className="text-xs text-slate-500">Diagnóstico de extracción anterior a la revisión:</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 my-3">{(selectedJobData.sources||[]).map(s=><div key={s} className="border border-slate-200 rounded-md p-2 text-sm"><strong>{SOURCES.find(x=>x.id===s)?.label||s}:</strong> {selectedJobData.source_results?.[s]?.status==="complete"?"Datos recibidos":selectedJobData.source_results?.[s]?.status==="partial"?"Datos parciales · quedan temporadas pendientes":selectedJobData.source_results?.[s]?.status==="error"?"Error":selectedJobData.source_results?.[s]?.status==="unavailable"?"Sin datos archivados disponibles":"Pendiente"}<div className="text-xs text-slate-500">{selectedJobData.source_results?.[s]?.note||""}</div></div>)}</div>
      {selectedJobData.worker_version==="base44-cache-v1"&&selectedJobData.status==="completed"&&(selectedJobData.received_candidates||0)===0&&<div className="rounded-lg border border-amber-200 bg-amber-50 p-3 my-3 text-sm"><strong>El análisis de caché ha finalizado, pero no había datos previos.</strong><p>Para este jugador selecciona «Solicitar datos NUEVOS desde Studio (PC)» tras arrancar el trabajador local. No necesitas importar un JSON manualmente.</p></div>}
      {(selectedJobData.sources||[]).map(s=>(selectedJobData.source_results?.[s]?.diagnostics||[]).length>0&&<details key={s} className="my-3 border rounded p-2 text-sm"><summary>Diagnóstico por temporada · {s}</summary>
        {(selectedJobData.source_results[s].diagnostics||[]).map((d,i)=><div key={i} className="border-t py-2">
          <strong>{d.season} · {d.competition}</strong> · {d.team_name||"Equipo pendiente"}
          <div>{({cache_absent:"Caché ausente",no_statistics:"Sin estadísticas disponibles",incompatible_response:"Respuesta incompatible",team_unidentified:"Equipo no identificado · pendiente de conciliación",competition_unidentified:"Competición no identificada",pending_review:"Estadísticas recuperadas · pendientes de revisión",candidate_limit:"Pendiente por límite de candidatos",pending_reconciliation:"Estadísticas pendientes de conciliación",cache_mismatch:"Caché incompatible: se recuperará con identidad exacta",rate_limited:"FotMob ha limitado las consultas",access_denied:"Acceso no permitido por FotMob",provider_paused:"Consulta detenida por restricción del proveedor",provider_unavailable:"FotMob no proporciona este recurso"})[d.status]||SOURCE_STATES[d.status]||d.status} · {d.recovered_metrics||0} métricas</div>
          <div className="text-slate-500">{d.reason}</div>
        </div>)}
      </details>)}
      {preview&&<div className="my-3 border rounded p-3 text-sm"><strong>Escritura propuesta · {preview.plan?.operation}</strong><pre className="overflow-auto max-h-80 text-xs">{JSON.stringify(preview.plan||preview.candidate,null,2)}</pre><button className="underline" onClick={()=>setPreview(null)}>Cerrar vista previa</button></div>}
      <HistoricalReview job={selectedJobData} disabled={busy||coordinator!=="ready"} onBusyChange={setBusy} onApplied={async()=>{await invalidateApplied();await refresh({forceCandidates:true});}}/>
      <details className="mt-4"><summary className="cursor-pointer text-sm font-semibold text-blue-900">Revisión avanzada individual y por fuente</summary>
      {seasonGroups.length>0&&<section className="mt-4 space-y-3" aria-label="Primeras temporadas disponibles">
        <h3 className="font-semibold text-[#003399]">Temporadas detectadas · Revisión por lote</h3>
        <p className="text-xs text-slate-600">Revisa cada temporada y su perfil original antes de aprobarla. Se crearán las competiciones ausentes o se rellenarán únicamente métricas vacías; nunca se reemplazarán cifras existentes.</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {seasonGroups.map(group=>{
            const pending=group.items.filter(c=>c.review_status==="pending");
            const blocked=group.items.some(c=>!["pending","applied"].includes(c.review_status)||c.verification_status==="conflict");
            const evidence=group.items.find(c=>c.evidence_url)?.evidence_url;
            return <div key={group.key} className="border border-slate-200 rounded-lg p-3 space-y-2">
              <div className="flex flex-wrap justify-between gap-2 text-sm">
                <strong>{group.season} · {group.team} · {group.competition}</strong>
                <span className="text-xs text-slate-600">{group.source} · {group.items.length} datos · {pending.length} pendientes</span>
              </div>
              <p className="text-xs text-slate-500">FotMob equipo: {group.teamId||"ID desconocido"}</p>
              {evidence&&<a href={evidence} rel="noopener noreferrer" target="_blank" className="text-xs text-[#003399] underline">Revisar evidencia original</a>}
              <button disabled={busy} onClick={()=>review("preview-season",group.items.find(c=>c.review_status==="pending")?.id||group.items[0].id)} className="text-xs underline">Ver escritura propuesta de esta temporada</button>
              <details className="border rounded-md px-3 py-2">
                <summary className="cursor-pointer text-xs font-semibold">Ver las {group.items.length} observaciones y valores</summary>
                <div className="mt-2 text-xs space-y-1 max-h-56 overflow-y-auto">
                  {group.items.map(c=><div key={c.id} className="flex justify-between gap-2 border-b py-1">
                    <span>{c.metric_name}</span><span className="font-medium tabular-nums whitespace-nowrap">{c.value} {c.metric_unit}</span>
                  </div>)}
                </div>
              </details>
              {blocked?<p className="text-xs text-amber-800">Esta temporada contiene datos en conflicto o descartados. Usa la revisión individual.</p>:
                !pending.length?<p className="text-xs font-semibold text-emerald-700">Datos de esta fuente ya aplicados.</p>:
                <>
                  <label className="flex gap-2 text-xs items-start">
                    <input type="checkbox" className="mt-0.5" checked={!!reviewedGroups[group.key]}
                      onChange={e=>setReviewedGroups(v=>({...v,[group.key]:e.target.checked}))}/>
                    He revisado los valores, la fuente, el club y la competición, y apruebo su incorporación.
                  </label>
                  <button type="button" disabled={busy||coordinator!=="ready"||selectedJobData.status!=="review"||
                    !reviewedGroups[group.key]||!group.teamId||!evidence}
                    onClick={()=>approveSeason(group)}
                    className="rounded-lg bg-[#003399] text-white px-3 py-2 text-xs font-semibold disabled:opacity-40">
                    Crear o completar temporada en STATS
                  </button>
                </>}
            </div>;
          })}
        </div>
      </section>}
      {candidatesLoading&&<p role="status" className="text-sm text-slate-500">Cargando observaciones completas…</p>}
      {!candidatesLoading&&!error&&!candidateRows.length&&<p className="text-sm text-slate-500">Este trabajo aún no ha recibido observaciones.</p>}
      {candidateRows.length>0&&<details className="mt-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-700">Revisión individual de los {candidateRows.length} valores y candidatos FIFA/mercado</summary>
      <div className="space-y-2 mt-3">{candidateRows.map(c=><div key={c.id} className="flex flex-wrap gap-3 items-center justify-between border rounded-lg p-3">
        <div className="text-sm"><strong>{c.kind==="metric"?c.metric_name:c.kind==="overall"?"Overall FIFA/FC":"Valor de mercado"}</strong> · {c.value} {c.metric_unit||""}
          <div className="text-xs text-slate-500">{c.source} · {c.season} · {c.competition||c.fifa_edition||c.as_of_date||""} · {c.team_name||""}</div>
          <div className="text-xs text-slate-500">Evidencia: {c.verification_status} · {c.review_status}</div>
          {c.provenance&&<div className="text-xs text-slate-600">ID de fuente: {c.provenance.player_id||"—"} · {c.provenance.rating_kind==="launch_base"?"Career Mode · base de lanzamiento":"Alcance: "+(c.provenance.scope||"valor de mercado histórico")} {c.provenance.revision_date?" · "+c.provenance.revision_date:""}{c.provenance.revision?" · revisión "+c.provenance.revision:""}{c.fifa_fc_position?" · "+c.fifa_fc_position:""}</div>}
          {c.provenance?.archive_url&&<a className="mr-3 text-xs text-blue-800 underline" href={c.provenance.archive_url} target="_blank" rel="noopener noreferrer">Archivo público original</a>}
          {c.evidence_url&&<a className="text-xs text-blue-800 underline" href={c.evidence_url} target="_blank" rel="noopener noreferrer">Consultar fuente</a>}
        </div>
        {c.review_status==="pending"&&<div className="flex items-center gap-3 text-sm">
          {c.verification_status!=="verified"&&c.verification_status!=="conflict"&&c.evidence_url&&<button disabled={busy||coordinator!=="ready"} onClick={()=>review("verify",c.id)} className="text-amber-800 underline">He verificado la fuente</button>}
          <button disabled={busy||coordinator!=="ready"||c.verification_status!=="verified"} onClick={()=>review("approve",c.id)} className="text-[#003399] underline disabled:opacity-30">Aplicar</button>
          <button disabled={busy||coordinator!=="ready"} onClick={()=>review("reject",c.id)} className="text-red-700 underline">Descartar</button>
        </div>}
      </div>)}</div>
      </details>}
      </details>
    </section>}
  </div>;
}
