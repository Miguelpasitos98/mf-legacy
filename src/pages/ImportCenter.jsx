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
  const [newPlayerName,setNewPlayerName]=useState("");
  const [newFotmobId,setNewFotmobId]=useState("");
  const [newIdentityConfirmed,setNewIdentityConfirmed]=useState(false);
  const [homonymConfirmed,setHomonymConfirmed]=useState(false);
  const [homonymMatches,setHomonymMatches]=useState([]);
  const [reviewedGroups,setReviewedGroups]=useState({});
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
        const candidates=await base44.entities.ImportCandidate.filter({job_id:selectedJob},"-received_at",500);
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
      setNotice(action==="start"?"Solicitud de extracción nueva registrada. Tu MF Legacy Studio la ejecutará cuando INICIAR_TRABAJADOR_V3.bat esté activo en tu ordenador.":action==="retry"?"Trabajo en cola de nuevo.":action==="release-stale"?"Concesión caducada liberada; ya puedes reintentar.":"Trabajo cancelado.");
      if(resp?.data?.job?.id)setSelectedJob(resp.data.job.id);
      await refresh();
    }catch(e){setError(reason(e));}
    finally{setBusy(false);}
  };
  const createNewPlayer=async()=>{
    const name=newPlayerName.trim(),pid=newFotmobId.trim();
    if(!name||!/^\d{1,15}$/.test(pid)||!newIdentityConfirmed||!selectedSources.length)return;
    setBusy(true);setError("");setNotice("");
    try{
      const resp=await base44.functions.invoke("import-control",{
        action:"create-and-start",player_name:name,fotmob_player_id:pid,
        sources:selectedSources,confirmed:true,confirm_homonym:homonymConfirmed
      });
      const result=resp?.data||{};
      if(!result.ok||!result.player?.id||!result.job?.id)throw Error(result.error||"El servidor no confirmó la nueva ficha.");
      setSelectedJob(result.job.id);setCandidateRows([]);
      setSelection(result.player.id);setSelectedPlayer(result.player);setSearch(result.player.name);
      setNewPlayerName("");setNewFotmobId("");setNewIdentityConfirmed(false);
      setHomonymConfirmed(false);setHomonymMatches([]);
      setNotice("Jugador nuevo creado con identidad FotMob confirmada y trabajo en cola. El PC recopilará sus observaciones y podrás aprobar las primeras temporadas.");
      const all=await base44.entities.ImportJob.list("-created_date",100);
      setJobs(responseRows(all));
    }catch(e){
      if(e?.response?.data?.requires_homonym_confirmation){
        setHomonymMatches(e.response.data.matches||[]);setHomonymConfirmed(false);
      }
      setError(reason(e));
    }
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
        (r.data.new_metrics||0)+" métricas incorporadas; los datos anteriores se han conservado.");
      setReviewedGroups(v=>({...v,[group.key]:false}));
      await refresh();
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
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 mb-4 text-sm text-amber-900 flex gap-2"><AlertTriangle size={19} className="shrink-0"/>{coordinator==="ready"?"El trabajador Studio de tu PC puede solicitar estadísticas nuevas de FotMob para IDs confirmados, con un máximo de 8 peticiones por trabajo. Los resultados se revisan antes de guardarlos; Understat, FIFA y mercado dependen de catálogos verificados disponibles.":coordinator==="checking"?"Comprobando los servicios de importación...":"El backend de importaciones no es accesible. No se admiten solicitudes hasta restaurar el coordinador."}</div>
    <section className="rounded-xl bg-white border-2 border-[#003399] p-5 mb-5 space-y-3">
      <div className="flex flex-wrap justify-between gap-2">
        <div><h2 className="font-semibold text-lg text-[#003399]">Nuevo jugador · Primera importación</h2>
          <p className="text-sm text-slate-600">Para futbolistas que todavía NO existen en MF Legacy. No necesitas crearlos antes ni importar un JSON.</p></div>
        <span className="rounded-full bg-blue-50 text-[#003399] px-3 py-1 text-xs h-fit font-semibold">Desde Studio (PC)</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="text-sm font-medium">Nombre completo del jugador
          <input value={newPlayerName} onChange={e=>{setNewPlayerName(e.target.value);setNewIdentityConfirmed(false);setHomonymMatches([]);setHomonymConfirmed(false);}}
            maxLength={120} placeholder="Nombre oficial del futbolista" className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 font-normal"/>
        </label>
        <label className="text-sm font-medium">ID de FotMob
          <input value={newFotmobId} onChange={e=>{
            const value=e.target.value.trim();
            const fromUrl=/^https:\/\/(?:www\.)?fotmob\.com\/players\/(\d{1,15})(?:[/?#]|$)/i.exec(value);
            setNewFotmobId(fromUrl?fromUrl[1]:value.replace(/[^0-9]/g,"").slice(0,15));
            setNewIdentityConfirmed(false);setHomonymMatches([]);setHomonymConfirmed(false);
          }}
            maxLength={300} placeholder="ID numérico o pega la URL de FotMob" className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 font-normal"/>
        </label>
      </div>
      {/^\d{1,15}$/.test(newFotmobId)&&<a className="inline-block text-sm text-[#003399] underline"
        href={"https://www.fotmob.com/players/"+newFotmobId} rel="noopener noreferrer" target="_blank">
        Comprobar el perfil original de FotMob
      </a>}
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {SOURCES.map(s=><label key={s.id} className="text-sm flex items-center gap-2">
          <input type="checkbox" checked={selectedSources.includes(s.id)}
            onChange={e=>setSelectedSources(v=>e.target.checked?[...v,s.id]:v.filter(x=>x!==s.id))}/>{s.label}
        </label>)}
      </div>
      <label className="flex gap-2 items-start text-sm text-slate-700">
        <input type="checkbox" checked={newIdentityConfirmed} onChange={e=>setNewIdentityConfirmed(e.target.checked)} className="mt-1"/>
        He comprobado personalmente que el nombre y el ID de FotMob corresponden a este mismo futbolista y que no está registrado en MF Legacy.
      </label>
      {homonymMatches.length>0&&<div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-2">
        <strong className="text-sm text-amber-950">Ya existe un jugador con este nombre</strong>
        <p className="text-xs text-amber-900">Revisa estas fichas antes de continuar. Si se trata de la misma persona, utiliza «Jugador ya registrado» y vincula su FotMob. Si realmente es otro futbolista, puedes crear un homónimo diferente.</p>
        <ul className="text-xs text-amber-950 list-disc ml-5">{homonymMatches.map(p=><li key={p.id}>{p.name} · ficha {p.id}</li>)}</ul>
        <label className="text-xs flex gap-2 items-start">
          <input type="checkbox" checked={homonymConfirmed} onChange={e=>setHomonymConfirmed(e.target.checked)}/>
          Confirmo que se trata de un futbolista diferente y quiero crear otra ficha con este nombre.
        </label>
      </div>}
      <button type="button" disabled={coordinator!=="ready"||busy||newPlayerName.trim().length<3||
        (homonymMatches.length>0&&!homonymConfirmed)||
        !/^\d{1,15}$/.test(newFotmobId)||!newIdentityConfirmed||!selectedSources.length}
        onClick={createNewPlayer}
        className="rounded-lg bg-[#003399] text-white px-5 py-3 text-sm font-semibold disabled:opacity-40">
        {busy?"Registrando…":"Crear jugador nuevo y solicitar extracción"}
      </button>
      <p className="text-xs text-slate-500">Se crea una ficha mínima y una vinculación FotMob, sin inventar atributos de FM26 ni sobrescribir fichas existentes.
        Las primeras temporadas quedan pendientes de tu revisión. FotMob permite consultas puntuales limitadas;
        Understat y los históricos FIFA/Transfermarkt solo estarán disponibles si Studio ya dispone de esos datos verificados.</p>
    </section>
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <section className="rounded-xl bg-white border border-slate-200 p-5 space-y-3">
        <h2 className="font-semibold text-lg">Jugador ya registrado · Añadir datos</h2>
        <Link to="/import-native" className="block rounded-lg bg-[#003399] text-white px-4 py-3 text-sm font-semibold text-center">Abrir motor WEB V3 · Importar primeras temporadas</Link>
        <p className="text-xs text-slate-600">Procesa estadísticas estructuradas dentro de Base44; no requiere que el Studio esté abierto. Los proveedores externos todavía no se consultan automáticamente.</p>
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
        <button disabled={coordinator!=="ready"||!player||!linked||active||!selectedSources.length||busy} onClick={()=>operate("start",{player_id:player.id,sources:selectedSources})} className="w-full py-3 rounded-lg border border-[#003399] text-[#003399] bg-white font-semibold disabled:opacity-40">Solicitar extracción desde Studio (alternativa local)</button>
        <button disabled={coordinator!=="ready"||!player||!linked||!selectedSources.length||busy} onClick={scanCache} className="w-full py-2 rounded-lg border border-[#003399] text-[#003399] bg-white font-semibold disabled:opacity-40">Reutilizar datos ya guardados</button>
        {active&&<p className="text-xs text-amber-800">Este jugador ya tiene un trabajo en cola o ejecución.</p>}
        <p className="text-xs text-slate-500">Primera importación: el trabajador de tu PC consulta el perfil y las temporadas disponibles con los límites configurados. FIFA/FC y valores de mercado solo se completan desde catálogos históricos verificados. No se altera FM26.</p>
      </section>
      <section className="rounded-xl bg-white border border-slate-200 p-5 space-y-4">
        <h2 className="font-semibold text-lg">Control de integridad</h2>
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
      <p className="text-xs text-slate-500 my-2">Para crear una primera temporada, comprueba la fuente y aprueba el lote de esa competición. Para valores individuales FIFA/mercado conserva la revisión específica. Los datos anteriores nunca se sobrescriben.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 my-3">{(selectedJobData.sources||[]).map(s=><div key={s} className="border border-slate-200 rounded-md p-2 text-sm"><strong>{SOURCES.find(x=>x.id===s)?.label||s}:</strong> {selectedJobData.source_results?.[s]?.status==="complete"?"Datos recibidos":selectedJobData.source_results?.[s]?.status==="error"?"Error":selectedJobData.source_results?.[s]?.status==="unavailable"?"Sin datos archivados disponibles":"Pendiente"}<div className="text-xs text-slate-500">{selectedJobData.source_results?.[s]?.note||""}</div></div>)}</div>
      {selectedJobData.worker_version==="base44-cache-v1"&&selectedJobData.status==="completed"&&(selectedJobData.received_candidates||0)===0&&<div className="rounded-lg border border-amber-200 bg-amber-50 p-3 my-3 text-sm"><strong>El análisis de caché ha finalizado, pero no había datos previos.</strong><p>Para este jugador selecciona «Solicitar datos NUEVOS desde Studio (PC)» tras arrancar el trabajador local. No necesitas importar un JSON manualmente.</p></div>}
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
      {!candidateRows.length&&<p className="text-sm text-slate-500">Este trabajo aún no ha recibido observaciones.</p>}
      {candidateRows.length>0&&<details className="mt-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-700">Revisión individual de los {candidateRows.length} valores y candidatos FIFA/mercado</summary>
      <div className="space-y-2 mt-3">{candidateRows.map(c=><div key={c.id} className="flex flex-wrap gap-3 items-center justify-between border rounded-lg p-3">
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
      </details>}
    </section>}
  </div>;
}