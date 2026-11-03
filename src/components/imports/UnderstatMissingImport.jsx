import React,{useEffect,useRef,useState} from "react";
import {base44} from "@/api/base44Client";
import {Database,ShieldCheck,RefreshCw} from "lucide-react";
const fmt=v=>v===null||v===undefined||!Number.isFinite(Number(v))?"—":Number(v).toLocaleString("es-ES",{maximumFractionDigits:2});
const errorOf=e=>e?.response?.data?.error||e?.message||"No se pudo consultar el archivo histórico";

export default function UnderstatMissingImport({player,linked,fotmobId,workerBusy=false,onApplied}){
 const [plan,setPlan]=useState(null);
 const [candidate,setCandidate]=useState("");
 const [approved,setApproved]=useState(false);
 const [busy,setBusy]=useState("");
 const [message,setMessage]=useState("");
 const [error,setError]=useState("");
 const [batchProgress,setBatchProgress]=useState(null);
 const current=useRef(0);
 const autoScan=useRef("");
 useEffect(()=>{
  current.current+=1;
  autoScan.current="";
  setPlan(null);setCandidate("");setApproved(false);setBusy("");setMessage("");setError("");setBatchProgress(null);
 },[player?.id,fotmobId]);
 const eligible=Boolean(player?.id&&linked&&fotmobId&&!workerBusy);
 const context={
  player_id:player?.id,fotmob_player_id:fotmobId,
  ...(candidate&&approved?{understat_id:candidate,confirm_identity:true}:{})
 };
 const preview=async({automatic=false}={})=>{
  if(!eligible||busy)return;
  const request=++current.current;
  setBusy("preview");setMessage("");setError("");
  try{
   const {data}=await base44.functions.invoke("understat-auto",{action:"preview-missing",...context});
   if(request!==current.current)return;
   if(!data?.ok)throw Error(data?.error||"No se pudo obtener la vista previa");
   setPlan(data);
   if(data.status==="verified"&&!candidate)setCandidate(String(data.understat_id));
   if(data.status==="needs_identity_confirmation")setMessage(data.reason);
  }catch(e){if(request===current.current)setError(errorOf(e));}
  finally{if(request===current.current)setBusy("");}
 };
 // Understat is part of the selected IMPORT sources: automatically inspect
 // historical gaps when a confirmed FotMob identity becomes available.
 useEffect(()=>{
  if(!eligible||busy||plan)return;
  const key=player?.id+"|"+fotmobId;
  if(autoScan.current===key)return;
  autoScan.current=key;
  preview({automatic:true});
 },[eligible,player?.id,fotmobId,plan,busy]);
 const apply=async(item)=>{
  if(!eligible||busy||!plan)return;
  if(plan.status==="manually_confirmed"&&!approved){setError("Confirma primero la identidad Understat.");return}
  setBusy(item.key);setError("");setMessage("");
  try{
   const {data}=await base44.functions.invoke("understat-auto",{
    action:"apply-missing",...context,
    row_key:item.key,source_revision:plan.source_revision,confirm_apply:true
   });
   if(!data?.ok)throw Error(data?.error||"No se pudo guardar la temporada");
   setMessage(data.status==="created"
    ?item.season+" · "+item.team+": temporada de liga añadida a STATS, con "+data.metrics_added+" estadísticas del archivo Understat."
    :item.season+" · "+item.team+": "+data.metrics_added+" estadísticas ausentes completadas sin reemplazar las existentes.");
   await onApplied?.();
   const fresh=await base44.functions.invoke("understat-auto",{action:"preview-missing",...context});
   if(fresh?.data?.ok)setPlan(fresh.data);
  }catch(e){setError(errorOf(e));}
  finally{setBusy("");}
 };
 const applyAll=async()=>{
  if(!eligible||busy||!plan||!["verified","manually_confirmed"].includes(plan.status)||!plan.proposals?.length)return;
  if(plan.status==="manually_confirmed"&&!approved){setError("Confirma la identidad Understat antes de incorporar todas las temporadas.");return}
  // Snapshot the exact reviewed proposals and identity; each server operation
  // independently rechecks the current record and immutable source revision.
  const proposals=[...plan.proposals],request=++current.current;
  const identity={...context};
  const summary={total:proposals.length,processed:0,created:0,completed:0,metrics:0,unchanged:0,errors:[]};
  setBusy("all");setError("");setMessage("");setBatchProgress({...summary});
  try{
   for(const item of proposals){
    if(current.current!==request)break;
    try{
     const {data}=await base44.functions.invoke("understat-auto",{
      action:"apply-missing",...identity,row_key:item.key,
      source_revision:plan.source_revision,confirm_apply:true
     });
     if(!data?.ok)throw Error(data?.error||"No se pudo incorporar la propuesta");
     if(data.status==="created")summary.created++;
     else if(data.status==="completed")summary.completed++;
     else summary.unchanged++;
     summary.metrics+=Number(data.metrics_added)||0;
    }catch(e){
     summary.errors.push({season:item.season,team:item.team,reason:errorOf(e)});
    }
    summary.processed++;
    if(current.current===request)setBatchProgress({...summary,errors:[...summary.errors]});
   }
   if(current.current!==request)return;
   setMessage("Importación terminada: "+summary.created+" temporadas nuevas, "+summary.completed+
    " temporadas completadas y "+summary.metrics+" métricas incorporadas. "+
    (summary.errors.length?summary.errors.length+" propuestas pendientes de revisión.":"Sin errores."));
   if(summary.created+summary.completed>0)await onApplied?.();
   try{
    const {data}=await base44.functions.invoke("understat-auto",{action:"preview-missing",...identity});
    if(current.current===request&&data?.ok)setPlan(data);
   }catch(e){
    if(current.current===request)setError("Los cambios se han guardado, pero no se pudo actualizar el diagnóstico: "+errorOf(e));
   }
  }finally{
   if(current.current===request)setBusy("");
  }
 };
 return <section className="rounded-xl border border-blue-200 bg-[#f5f8fd] p-3 space-y-3" data-understat-missing-import="true">
  <div className="flex items-start gap-2">
   <Database className="mt-0.5 shrink-0 text-[#003399]" size={18}/>
   <div>
    <h3 className="text-sm font-bold text-[#003399]">Understat histórico · completar lo que falta</h3>
    <p className="mt-1 text-xs text-slate-600">Se analiza automáticamente al seleccionar un jugador con ID FotMob confirmado. Detecta temporadas de liga ausentes y estadísticas vacías. No sustituye datos existentes ni inventa xGOT.</p>
   </div>
  </div>
  <div className="flex flex-wrap gap-2 items-center">
   <button type="button" disabled={!eligible||!!busy} onClick={()=>preview()}
    className="inline-flex items-center gap-2 rounded-lg bg-[#003399] px-3 py-2 text-xs font-bold text-white disabled:opacity-40">
    {busy==="preview"?<RefreshCw className="animate-spin" size={14}/>:<Database size={14}/>}
    {busy==="preview"?"Analizando archivo histórico…":plan?"Actualizar diagnóstico":"Buscar temporadas y estadísticas ausentes"}
   </button>
   <span className="text-[11px] text-slate-500">Archivo verificado · temporadas completas hasta 2024/25 · no necesita Understat.com</span>
  </div>
  {!linked&&player&&<p className="text-xs text-amber-800">Confirma primero el ID FotMob del jugador en IMPORT. No se usa el nombre como vínculo automático.</p>}
  {workerBusy&&<p className="text-xs text-amber-800">Hay una importación activa de este jugador; esta revisión se habilitará al terminar.</p>}
  {plan&&<>
   {plan.status==="needs_identity_confirmation"&&<div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
    <p className="text-xs text-amber-900">No hay suficientes temporadas coincidentes para validar automáticamente su ID Understat. Comprueba las opciones antes de autorizar una nueva temporada.</p>
    <label className="block text-xs font-medium text-slate-700">Identidad Understat
     <select value={candidate} onChange={e=>{setCandidate(e.target.value);setApproved(false);}}
       className="mt-1 block w-full rounded-md border border-slate-300 bg-white p-2">
       <option value="">Selecciona el ID correcto</option>
       {(plan.candidates||[]).map(c=><option key={c.understat_id} value={c.understat_id}>{c.understat_id} · {c.season_count} temporadas · {c.club_samples.join(", ")}</option>)}
     </select>
    </label>
    <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={approved} onChange={e=>setApproved(e.target.checked)} className="mt-0.5"/>
      Confirmo que este ID Understat pertenece al jugador seleccionado y he revisado los clubes de su histórico.</label>
    <button type="button" disabled={!eligible||!!busy||!candidate||!approved} onClick={()=>preview()}
      className="rounded-md border border-blue-300 px-3 py-2 text-xs font-semibold text-[#003399] disabled:opacity-40">Mostrar propuestas para el ID confirmado</button>
   </div>}
   {["verified","manually_confirmed"].includes(plan.status)&&<div className="space-y-2">
    <p className="text-xs text-emerald-800 flex items-center gap-2"><ShieldCheck size={15}/>
     Identidad {plan.identity_auto?"verificada con temporadas y clubes":"confirmada manualmente"} · ID Understat {plan.understat_id} · {(plan.proposals||[]).length} propuestas
    </p>
    {plan.proposals?.length>0&&<div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
     <div className="text-xs text-slate-700">
      <strong>{plan.proposals.length} propuestas listas</strong> · {plan.proposals.filter(x=>x.action==="create").length} temporadas nuevas · {plan.proposals.filter(x=>x.action==="complete").length} por completar.
      <p className="mt-1 text-[11px] text-slate-500">Cada propuesta se verifica antes de guardarse; las que tengan conflictos se omiten y se notifican.</p>
     </div>
     <button type="button" disabled={!eligible||!!busy||(plan.status==="manually_confirmed"&&!approved)} onClick={applyAll}
      className="rounded-lg bg-[#003399] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40">
      {busy==="all"?"Completando…":"Completar todas ("+plan.proposals.length+")"}
     </button>
    </div>}
    {batchProgress&&<div role="status" className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700">
     <p className="font-semibold">Procesadas {batchProgress.processed} de {batchProgress.total} propuestas · {batchProgress.metrics} estadísticas añadidas</p>
     <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-blue-600 transition-all" style={{width:(batchProgress.total?Math.min(100,100*batchProgress.processed/batchProgress.total):0)+"%"}}/></div>
     {batchProgress.errors?.length>0&&<details className="mt-2 text-amber-800"><summary>Propuestas pendientes ({batchProgress.errors.length})</summary>
      {batchProgress.errors.map((item,i)=><p key={i} className="mt-1">{item.season} · {item.team}: {item.reason}</p>)}</details>}
    </div>}
    {plan.proposals?.length?<div className="max-h-[380px] overflow-y-auto space-y-2">
     {plan.proposals.map(item=><div key={item.key} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
      <div className="min-w-0 flex-1">
       <strong className="text-xs text-slate-800">{item.season} · {item.team}</strong>
       <span className="ml-2 text-[10px] font-bold text-blue-700">{item.action==="create"?"TEMPORADA AUSENTE":"COMPLETAR EXISTENTE"}</span>
       <p className="mt-1 text-[11px] text-slate-600">{item.league} · {fmt(item.minutes)} minutos Understat · {item.missing_metrics} estadísticas disponibles para añadir</p>
       <details className="mt-1 text-[11px] text-slate-600"><summary className="cursor-pointer text-[#003399]">Ver los datos propuestos</summary>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
         {item.additions.map(m=><div key={m.name}>{m.name}: <strong>{fmt(m.value)}</strong>{m.per90!==null?" · "+fmt(m.per90)+"/90":""}</div>)}
        </div></details>
      </div>
      <button type="button" disabled={!eligible||!!busy} onClick={()=>apply(item)}
       className="rounded-lg border border-[#003399] bg-white px-3 py-2 text-xs font-bold text-[#003399] disabled:opacity-40">
       {busy===item.key?"Guardando…":item.action==="create"?"Aprobar temporada":"Completar faltantes"}
      </button>
     </div>)}
    </div>:<p className="text-xs text-slate-600">No hay nuevas estadísticas compatibles que añadir desde este archivo.</p>}
   </div>}
   {plan.skipped?.length>0&&<details className="text-xs text-slate-600">
    <summary className="cursor-pointer text-amber-800">{plan.skipped.length} registros excluidos o sin cambios</summary>
    <div className="mt-2 max-h-40 overflow-y-auto">{plan.skipped.map((s,i)=><p key={i} className="py-1 border-t">{s.season} · {s.team||"—"}: {s.reason}</p>)}</div>
   </details>}
  </>}
  {error&&<p role="alert" className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800">{error}</p>}
  {message&&<p role="status" className="rounded-md border border-blue-200 bg-white p-2 text-xs text-blue-900">{message}</p>}
  <p className="text-[11px] text-slate-500">Understat aporta xG, xA, npxG, xGChain, xGBuildup y otras métricas del CSV. El xGOT procede solo de FotMob. Las copas, Champions y ligas sin cobertura no se completan con datos supuestos.</p>
 </section>;
}
