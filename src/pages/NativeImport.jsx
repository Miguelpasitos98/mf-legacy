import React,{useEffect,useState} from "react";
import {Link} from "react-router-dom";
import {base44} from "@/api/base44Client";
import {ArrowLeft,Search,ShieldCheck,AlertTriangle} from "lucide-react";
const rows=x=>Array.isArray(x)?x:x?.items||x?.data||x?.entities||[];
const err=e=>e?.response?.data?.error||e?.message||"Error de operación";

export default function NativeImport(){
 const [player,setPlayer]=useState(null),[query,setQuery]=useState(""),[choices,setChoices]=useState([]),[searching,setSearching]=useState(false);
 const [pid,setPid]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
 const [status,setStatus]=useState("checking"),[snapshot,setSnapshot]=useState(null),[job,setJob]=useState(""),[candidates,setCandidates]=useState([]);
 const [jobs,setJobs]=useState([]);
 useEffect(()=>{
  base44.functions.invoke("import-native",{action:"health"}).then(r=>setStatus(r.data?.ok?"ready":"unavailable")).catch(()=>setStatus("unavailable"));
  base44.entities.ImportJob.list("-created_date",100).then(r=>setJobs(rows(r).filter(j=>j.worker_version==="base44-web-native-v1"))).catch(()=>{});
 },[]);
 useEffect(()=>{
  if(player&&query===player.name){setSearching(false);return;}
  if(query.trim().length<2){setChoices([]);setSearching(false);return;}
  let live=true;setSearching(true);
  const timer=setTimeout(async()=>{
   try{
    const term=query.trim().replace(/[\[\]().*+?^$|{}\\]/g,"\\$&");
    const r=rows(await base44.entities.Player.filter({name:{$regex:term,$options:"i"}},"name",30));
    if(live)setChoices(r);
   }catch(e){if(live)setError(err(e));}finally{if(live)setSearching(false);}
  },300);
  return()=>{live=false;clearTimeout(timer);};
 },[query,player]);
 useEffect(()=>{
  setPid("");if(!player)return;
  let live=true;
  base44.entities.PlayerFotmobLink.filter({player_id:player.id},undefined,30).then(r=>{
   if(!live)return;
   const ids=[...new Set(rows(r).map(x=>String(x.fotmob_player_id||"")).filter(Boolean))];
   setPid(ids.length===1?ids[0]:"");
  }).catch(e=>{if(live)setError(err(e));});
  return()=>{live=false;};
 },[player]);
 const loadJob=async id=>{
  setJob(id);const c=rows(await base44.entities.NativeSeasonCandidate.filter({job_id:id},"-received_at",60));setCandidates(c);
 };
 const prepare=async(action,extra={})=>{
  if(!player||!pid||busy)return;
  setBusy(true);setError("");setMessage("");
  try{
   const r=await base44.functions.invoke("import-native",{action,player_id:player.id,fotmob_player_id:pid,...extra});
   const d=r?.data||{};
   if(!d.ok)throw Error(d.error||"Error de normalización");
   if(d.job_id)await loadJob(d.job_id);
   setMessage(d.status==="unavailable"?d.reason:
    "Análisis finalizado: "+(d.created||0)+" temporadas nuevas para revisar; "+(d.already_present||0)+" ya registradas; "+(d.changed||0)+" discrepancias. No se han modificado tus STATS.");
   if(d.job_id){const list=rows(await base44.entities.ImportJob.list("-created_date",100));setJobs(list.filter(j=>j.worker_version==="base44-web-native-v1"));}
  }catch(e){setError(err(e));}finally{setBusy(false);}
 };
 const upload=async e=>{
  const f=e.target.files?.[0];e.target.value="";if(!f)return;
  setError("");setMessage("");
  if(f.size>150000){setError("Máximo de 150 KB por lote");return;}
  try{
   const d=JSON.parse(await f.text());
   if(d.schema!=="mf_legacy_native_snapshot_v1"||!Array.isArray(d.records))throw Error("Formato nativo no válido");
   setSnapshot(d);setMessage("Archivo leído: "+d.records.length+" registros. Se validará la identidad antes de guardarlos.");
  }catch(e){setSnapshot(null);setError(err(e));}
 };
 const review=async(candidate_id,action)=>{
  setBusy(true);setError("");setMessage("");
  try{
   const r=await base44.functions.invoke("review-native",{candidate_id,action});
   if(!r.data?.ok)throw Error(r.data?.error||"Revisión fallida");
   await loadJob(job);
   setMessage(action==="approve"?"Temporada añadida a STATS sin sustituir información anterior.":"Temporada descartada.");
  }catch(e){setError(err(e));}finally{setBusy(false);}
 };
 return <div className="h-full overflow-y-auto p-5 md:p-8 text-slate-800">
  <Link to="/import-center" className="flex gap-2 items-center text-blue-800 text-sm mb-3"><ArrowLeft size={16}/> Volver a IMPORT</Link>
  <h1 className="text-2xl font-bold">Motor de importación web V3</h1>
  <p className="text-sm text-slate-600 mb-4">Normalización, validación y creación de primeras temporadas sin ejecutar Python.</p>
  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 mb-4 flex gap-2 text-sm"><AlertTriangle size={20}/>
   <p>El motor está preparado, pero todavía <strong>no obtiene datos nuevos automáticamente desde proveedores externos</strong>. Puedes procesar observaciones archivadas o aportar datos estructurados de una fuente permitida. No consulta automáticamente FotMob.</p>
  </div>
  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
   <section className="rounded-xl border p-5 bg-white space-y-3">
    <h2 className="font-semibold">1. Jugador existente</h2>
    <div className="relative"><Search size={16} className="absolute top-3 left-3 text-slate-400"/>
     <input value={query} onChange={e=>{setQuery(e.target.value);setPlayer(null);setPid("");}}
      className="w-full border rounded-lg pl-9 pr-3 py-2" placeholder="Buscar jugador..."/>
     {!player&&query.trim().length>=2&&<div className="absolute z-20 top-full bg-white border rounded-md shadow-lg w-full max-h-52 overflow-y-auto">
      {searching?<p className="p-3 text-sm">Buscando...</p>:choices.length?choices.map(p=>
       <button key={p.id} onClick={()=>{setPlayer(p);setQuery(p.name);setChoices([]);}}
        className="block w-full text-left px-3 py-2 text-sm hover:bg-blue-50">{p.name}</button>):
       <p className="p-3 text-sm">No encontrado</p>}
     </div>}
    </div>
    {player&&<div className="p-3 text-sm bg-blue-50 rounded-lg"><strong>{player.name}</strong>
      <p className="text-xs text-slate-500">FotMob: {pid||"Sin vinculación. Regístrala en IMPORT antes de continuar."}</p></div>}
    <div className="text-sm text-slate-600 flex gap-2 items-center"><ShieldCheck size={16}/> Identidad verificada de nuevo en el backend.</div>
   </section>
   <section className="rounded-xl border p-5 bg-white space-y-3">
    <h2 className="font-semibold">2. Preparar nuevas temporadas</h2>
    <p className="text-xs text-slate-600">Este proceso también funciona si el jugador todavía no tiene temporadas en STATS.</p>
    <button disabled={status!=="ready"||!player||!pid||busy} onClick={()=>prepare("archive")}
      className="w-full rounded-lg bg-[#003399] text-white px-4 py-3 disabled:opacity-40">Preparar desde observaciones archivadas</button>
    <div className="border-t pt-3 space-y-2">
     <strong className="text-sm">Datos estructurados de una fuente permitida</strong>
     <input type="file" accept=".json,application/json" onChange={upload} className="block text-xs w-full"/>
     {snapshot&&<button disabled={status!=="ready"||!player||!pid||busy}
       onClick={()=>prepare("prepare",{schema:snapshot.schema,records:snapshot.records})}
       className="rounded-lg border border-[#003399] text-[#003399] px-4 py-2 text-sm disabled:opacity-40">
       Preparar {snapshot.records.length} registros</button>}
    </div>
   </section>
  </div>
  {error&&<p role="alert" className="rounded-lg p-3 my-3 bg-red-50 text-red-800">{error}</p>}
  {message&&<p role="status" className="rounded-lg p-3 my-3 bg-blue-50 text-blue-900">{message}</p>}
  <section className="rounded-xl border p-5 bg-white mt-4">
   <h2 className="font-semibold mb-3">3. Revisar y sincronizar STATS</h2>
   {jobs.length>0&&<div className="flex gap-2 flex-wrap mb-4">{jobs.slice(0,15).map(j=>
    <button key={j.id} className={"px-3 py-2 border rounded-lg text-xs "+(job===j.id?"bg-blue-50 border-blue-400":"")}
     onClick={()=>loadJob(j.id)}>{j.player_name} · {j.requested_at?.slice(0,10)||"Sin fecha"}</button>)}</div>}
   {!job?<p className="text-sm text-slate-500">No hay ningún trabajo seleccionado.</p>:
    !candidates.length?<p className="text-sm text-slate-500">El trabajo no contiene temporadas para revisar.</p>:
    <div className="space-y-2">{candidates.map(c=><div key={c.id} className="border rounded-lg p-3 flex flex-wrap justify-between items-center gap-3">
      <div><strong className="text-sm">{c.team_name} · {c.competition} · {c.season}</strong>
       <p className="text-xs text-slate-500">{c.provider} · equipo {c.fotmob_team_id||"ID pendiente"} · {c.metrics?.length||0} métricas · {c.status}</p>
       {c.warnings?.length>0&&<p className="text-xs text-amber-800">{c.warnings.join(" · ")}</p>}
      </div>
      {c.status==="pending"&&<div className="flex gap-2">
       <button disabled={busy||!c.fotmob_team_id} onClick={()=>review(c.id,"approve")}
        className="rounded-lg bg-[#003399] text-white px-4 py-2 text-sm disabled:opacity-40">Añadir a STATS</button>
       <button disabled={busy} onClick={()=>review(c.id,"reject")}
        className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40">Descartar</button>
      </div>}
    </div>)}</div>}
  </section>
 </div>;
}
