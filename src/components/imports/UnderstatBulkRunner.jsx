import React,{useEffect,useRef,useState} from "react";
import {base44} from "@/api/base44Client";
import {CheckCircle2,PauseCircle,PlayCircle,RefreshCw} from "lucide-react";
import {rateLimitDetails} from "@/utils/importRateLimit";
import {eligibleUnderstatBatchJobs,initialBulkRun,afterBulkResult} from "@/utils/importUnderstatBatch";

const KEY="mf-legacy-understat-bulk-verified-v1";
const read=()=>{
 try{
  const state=JSON.parse(window.sessionStorage.getItem(KEY)||"null");
  if(state&&Array.isArray(state.jobs))return {...state,status:"paused",active:""};
 }catch(e){/* Empty on browsers that prohibit storage. */}
 return null;
};
const save=state=>{
 try{if(state)window.sessionStorage.setItem(KEY,JSON.stringify(state));
 else window.sessionStorage.removeItem(KEY);
 }catch(e){/* The runner can operate without persistent browser storage. */}
};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const format=v=>Number(v||0).toLocaleString("es-ES");
const err=e=>String(e?.response?.data?.error||e?.message||"Error desconocido");

export default function UnderstatBulkRunner({groups,audits,onAudit,onComplete}){
 const [batch,setBatch]=useState(read);
 const [running,setRunning]=useState(false);
 const cancel=useRef(false);
 const mounted=useRef(true);
 const busy=useRef(false);
 const [reviewOpen,setReviewOpen]=useState(false);
 useEffect(()=>()=>{mounted.current=false;cancel.current=true},[]);
 const update=next=>{
  save(next);
  if(mounted.current)setBatch(next);
 };
 const remaining=eligibleUnderstatBatchJobs(groups,audits);
 const resume=batch?.status==="paused"&&batch.position<batch.jobs.length;
 const start=async()=>{
  if(busy.current)return;
  const state=resume?
   {...batch,status:"running",active:"",errors:[...(batch.errors||[])]}:
   {...initialBulkRun(remaining),status:"running"};
  if(!state.jobs.length)return;
  cancel.current=false;busy.current=true;setRunning(true);update(state);
  let progress=state;
  try{
   for(let position=state.position;position<state.jobs.length;position++){
    if(cancel.current||!mounted.current)break;
    const job=state.jobs[position];
    progress={...progress,position,active:job.player_name,status:"running"};
    update(progress);
    let loops=0,rateTries=0;
    for(;;){
     if(cancel.current||!mounted.current)break;
     try{
      const response=await base44.functions.invoke("understat-auto",{
       action:"auto-safe-player",job_id:job.job_id
      });
      const data=response?.data||{};
      if(!data.ok)throw Error(data.error||"No se pudo analizar la fuente");
      progress=afterBulkResult(progress,data,job);
      if(data.audit)onAudit?.(job.job_id,data.audit);
      rateTries=0;
      loops++;
      // A call modifies at most four safe league rows. Any further gaps are
      // explicitly revalidated on the next call rather than blindly patched.
      if(data.status==="partial"&&data.remaining>0&&loops<12&&
        (Number(data.created)||Number(data.completed)||Number(data.metrics_added))>0){
       await wait(20000);
       continue;
      }
      if(data.status==="partial"&&data.remaining>0){
       progress={...progress,errors:[...progress.errors,{
        name:job.player_name,
        reason:"Quedan propuestas después del límite de seguridad. Se podrán reanalizar."}]};
      }
      break;
     }catch(e){
      const quota=rateLimitDetails(e);
      if(quota&&rateTries<1){
       rateTries++;
       progress={...progress,active:"Base44 ha limitado las consultas · reanudación automática",status:"quota_pause",
        retries:(progress.retries||0)+1};
       update(progress);
       await wait(quota.seconds*1000);
       continue;
      }
      progress={...progress,errors:[...progress.errors,{
       name:job.player_name,reason:quota?.message||err(e)}]};
      if(quota){
       progress={...progress,status:"paused",active:"",
        notice:"Límite de Base44 alcanzado. El progreso queda guardado; puedes reanudar el análisis."};
       update(progress);
       return;
      }
      break;
     }
    }
    if(cancel.current||!mounted.current)break;
    progress={...progress,position:position+1,active:"",players_reviewed:progress.players_reviewed+1};
    update(progress);
    if(position+1<state.jobs.length)await wait(20000);
   }
   if(mounted.current){
    if(cancel.current)update({...progress,active:"",status:"paused"});
    else{
     update({...progress,active:"",status:"complete",position:state.jobs.length});
     await onComplete?.();
    }
   }
  }finally{
   busy.current=false;
   if(mounted.current)setRunning(false);
  }
 };
 const stop=()=>{cancel.current=true};
 const progressPct=batch?.jobs?.length?Math.round((batch.position||0)*100/batch.jobs.length):0;
 return <div className="flex flex-wrap items-center gap-2" data-understat-bulk-runner>
   <button type="button" disabled={running||(!resume&&!remaining.length)}
    onClick={start} className="inline-flex items-center gap-1.5 rounded-lg border border-[#003399] bg-[#003399] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">
    {running?<RefreshCw className="animate-spin" size={14}/>:resume?<PlayCircle size={14}/>:<CheckCircle2 size={14}/>}
    {running?"Analizando Understat…":resume?"Reanudar Understat":"Analizar y completar Understat"}
   </button>
   {running&&<button type="button" onClick={stop}
    className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
    <PauseCircle size={14}/> Detener
   </button>}
   {batch&&<div className="w-full basis-full rounded-lg border border-blue-100 bg-blue-50/60 p-3 text-xs" role="status" aria-label="Progreso de completado histórico">
     <div className="flex flex-wrap items-center justify-between gap-2">
      <strong className="text-[#0d315b]">{batch.status==="complete"?"Revisión automática finalizada":
       batch.status==="paused"?"Revisión en pausa":batch.status==="quota_pause"?"Pausa por límite Base44":
       "Procesando historial de jugadores"}
      </strong>
      <span className="tabular-nums font-semibold">{batch.position} / {batch.jobs.length} jugadores · {progressPct}%</span>
     </div>
     <div className="mt-2 h-2 overflow-hidden rounded-full bg-blue-100">
      <div className="h-full bg-[#003399] transition-[width] duration-500" style={{width:progressPct+"%"}}/>
     </div>
     {batch.active&&<p className="mt-2 text-slate-700">{batch.active}</p>}
     {batch.notice&&<p className="mt-2 text-amber-800">{batch.notice}</p>}
     <p className="mt-2 text-slate-700">
      {format(batch.players_reviewed)} jugadores revisados · {format(batch.seasons_created)} temporadas nuevas · {format(batch.seasons_completed)} temporadas completadas · {format(batch.metrics_added)} métricas añadidas · {format(batch.manual_review)} identidades pendientes.
     </p>
     {batch.errors?.length>0&&<div className="mt-2">
       <button type="button" onClick={()=>setReviewOpen(v=>!v)} className="text-left font-semibold text-amber-800 underline">
        {batch.errors.length} incidencias · {reviewOpen?"Ocultar":"Ver detalle"}
       </button>
       {reviewOpen&&<div className="mt-1 max-h-40 overflow-y-auto rounded-md bg-white p-2">
        {batch.errors.slice(-80).map((e,i)=><p key={i} className="border-b border-slate-100 py-1">{e.name}: {e.reason}</p>)}
       </div>}
     </div>}
     <p className="mt-2 text-[11px] text-slate-500">Solo se incorporan datos verificados y faltantes; las identidades dudosas quedan para revisión. El recorrido avanza de forma secuencial para respetar el límite de Base44. Mantén esta pestaña abierta; si se interrumpe, podrás reanudar desde el último jugador guardado.</p>
   </div>}
 </div>;
}
