import React,{useEffect,useState} from "react";
import {useNavigate} from "react-router-dom";
import {base44} from "@/api/base44Client";

const labels={create:"Crear registro",update:"Completar campos vacíos",unchanged:"Conservar; sin cambios",omitted:"Ya revisado",pending:"Revisión individual",conflict:"Conflicto"};
const value=x=>x===null||x===undefined?"—":Number(x).toLocaleString("es-ES",{maximumFractionDigits:8});
const reason=e=>e?.response?.data?.error||e?.message||"No se pudo completar la revisión";
export default function HistoricalReview({job,disabled=false,onApplied,onBusyChange}){
  const navigate=useNavigate();
  const [plan,setPlan]=useState(null),[keys,setKeys]=useState([]),[confirmed,setConfirmed]=useState(false);
  const [working,setWorking]=useState(false),[error,setError]=useState(""),[batches,setBatches]=useState([]),[progress,setProgress]=useState(null);
  useEffect(()=>{setPlan(null);setKeys([]);setConfirmed(false);setBatches([]);setProgress(null);setError("");},[job.id]);
  const invoke=async(action,payload={})=>{
    const response=await base44.functions.invoke("import-review",{action,job_id:job.id,...payload});
    if(!response?.data?.ok)throw Error(response?.data?.error||"Respuesta de revisión incompleta");
    return response.data;
  };
  const load=async()=>{
    setWorking(true);setError("");
    try{
      const [next,history]=await Promise.all([invoke("history-preview"),invoke("history-batches")]);
      setPlan(next);setKeys([]);setConfirmed(false);setBatches(history.batches);
    }catch(e){setError(reason(e));}finally{setWorking(false);}
  };
  const apply=async(resume)=>{
    if(!confirmed||(!resume&&!keys.length))return;
    setWorking(true);onBusyChange?.(true);setError("");
    try{
      let batch=resume||null;
      for(let turn=0;turn<200;turn++){
        const response=await invoke("history-approve",{confirmed:true,...(batch?{batch_id:batch.id}:{keys,plan_token:plan.plan_token})});
        batch=response.batch;setProgress(batch);
        if(batch.status==="partial"){setError(batch.error||"Revisión interrumpida. Puedes reanudar sin repetir escrituras");break;}
        if(batch.status==="completed")break;
      }
      await onApplied?.();
      if(batch?.status==="completed"&&!batch.counts?.conflicts)navigate("/stats?stats_player="+encodeURIComponent(job.fotmob_player_id)+"&import_batch="+encodeURIComponent(batch.id),{state:{importSummary:batch.counts}});
      else{
        const history=await invoke("history-batches");setBatches(history.batches);
        if(batch?.counts?.conflicts)setError("Hay "+batch.counts.conflicts+" registros que cambiaron durante la revisión. Se conservaron; actualiza la propuesta");
      }
    }catch(e){setError(reason(e));await onApplied?.();}finally{setWorking(false);onBusyChange?.(false);setConfirmed(false);}
  };
  const safe=plan?.units.filter(u=>u.selectable)||[];
  const toggle=key=>setKeys(old=>old.includes(key)?old.filter(x=>x!==key):[...old,key]);
  return <section className="my-4 rounded-xl border border-blue-200 bg-blue-50/40 p-4" aria-label="Revisión conjunta del historial">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold">Revisar el historial disponible</h3><p className="text-xs text-slate-600">Una fila por registro de destino. Solo puedes seleccionar datos verificados y sin conflictos.</p></div>
      <button type="button" onClick={load} disabled={working||disabled||!["review","completed"].includes(job.status)} className="rounded-lg border border-blue-300 bg-white px-4 py-2 text-sm font-semibold text-blue-900 disabled:opacity-40">{working?"Procesando revisión…":plan?"Actualizar propuesta completa":"Revisar todas las temporadas disponibles"}</button></div>
    {error&&<p role="alert" className="my-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}
    {progress&&<p role="status" className="my-3 text-sm font-semibold">{progress.cursor} / {progress.total} registros revisados · {progress.counts?.created||0} creados · {progress.counts?.completed||0} completados · {progress.counts?.omitted||0} omitidos · {progress.counts?.conflicts||0} conflictos · {progress.counts?.values||0} valores conciliados</p>}
    {plan&&<>
      <p className="my-3 text-sm">{plan.counts.records} registros · {plan.counts.create} nuevos · {plan.counts.complete} para completar · {plan.counts.omitted} sin cambios · {plan.counts.pending} pendientes · {plan.counts.conflicts} conflictos · {plan.counts.rejected} candidatos rechazados</p>
      <label className="mb-3 flex items-center gap-2 text-sm"><input type="checkbox" disabled={working||!safe.length} checked={safe.length>0&&keys.length===safe.length} onChange={e=>setKeys(e.target.checked?safe.map(u=>u.key):[])}/>Seleccionar todos los registros verificados sin conflictos</label>
      <div className="max-h-[65dvh] overflow-auto rounded-lg border border-slate-200 bg-white"><table className="w-full min-w-[850px] text-left text-xs"><thead className="sticky top-0 bg-blue-950 text-white"><tr><th className="p-2">Seleccionar</th><th>Temporada y club</th><th>Competición</th><th>Fuentes</th><th>Valores encontrados / existentes / nuevos</th><th>Verificación</th><th>Acción propuesta</th></tr></thead>
        <tbody>{plan.units.map(unit=><tr key={unit.key} className="border-t align-top"><td className="p-2"><input type="checkbox" aria-label={"Importar "+unit.season+" "+unit.club+" "+unit.competition} disabled={working||!unit.selectable} checked={keys.includes(unit.key)} onChange={()=>toggle(unit.key)}/></td><td className="p-2"><strong>{unit.season}</strong><div>{unit.club}</div></td><td className="p-2">{unit.competition}</td><td className="p-2">{unit.sources.join(", ")}{unit.selected_sources.length>0&&<p className="mt-1 font-semibold">Seleccionables: {unit.selected_sources.join(", ")}</p>}</td>
          <td className="p-2"><details><summary className="cursor-pointer font-semibold">{unit.values.length} valores · {unit.values.filter(v=>v.new_value!==null).length} campos vacíos</summary>
            <table className="mt-2 min-w-[540px]"><thead><tr><th>Dato / fuente</th><th>Encontrado</th><th>Existente</th><th>Nuevo</th><th>Estado</th></tr></thead><tbody>{unit.values.map(v=><tr key={v.candidate_id} className="border-t"><td className="py-2 pr-2">{v.name} {v.unit}<div className="text-slate-500">{v.provenance.provider||v.source} · {v.verification}</div>{v.provenance.player_id&&<div>ID {v.provenance.player_id} · {v.provenance.revision_date||v.provenance.selection_rule||v.provenance.retrieved_at||""}</div>}{v.evidence_url&&<a className="text-blue-800 underline" href={v.evidence_url} target="_blank" rel="noopener noreferrer">Fuente</a>}</td><td>{value(v.found)}</td><td>{value(v.existing)}</td><td>{value(v.new_value)}</td><td>{v.action} · {v.status}</td></tr>)}</tbody></table>
          </details><details className="mt-2"><summary className="cursor-pointer">Ver campos y procedencia a guardar</summary><pre className="mt-2 max-w-[600px] overflow-auto whitespace-pre-wrap text-[10px]">{JSON.stringify(unit.record,null,2)}</pre></details></td><td className="p-2">{unit.verification==="verified"?"Verificados: "+unit.candidate_ids.length:"Pendiente"}{unit.unverified_count>0&&<div className="text-amber-800">{unit.unverified_count} sin verificar; excluidos</div>}</td><td className="p-2"><strong>{labels[unit.action]||unit.action}</strong>{unit.conflict&&<p className="mt-1 text-amber-800">{unit.conflict}</p>}{unit.reason&&<p>{unit.reason}</p>}</td></tr>)}</tbody></table></div>
      <label className="my-4 flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} disabled={working}/>He revisado los valores, las fuentes y las acciones propuestas. Autorizo exclusivamente los registros seleccionados, conservando los datos existentes.</label>
      <button type="button" disabled={working||disabled||!confirmed||!keys.length} onClick={()=>apply(null)} className="rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Importar {keys.length} registros seleccionados y ver STATS</button>
      {batches.filter(b=>b.status!=="completed").map(batch=><div key={batch.id} className="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm"><p>Revisión guardada: {batch.cursor}/{batch.total} registros. {batch.error}</p><button type="button" disabled={working||disabled||!confirmed} onClick={()=>apply(batch)} className="mt-2 font-semibold text-blue-900 underline disabled:opacity-40">Reanudar la selección previamente autorizada</button></div>)}
      <p className="mt-3 text-xs text-slate-500">Cada bloque se guarda con su propuesta original y una lectura posterior. Si cierras el navegador, vuelve a esta revisión y reanuda la selección guardada. No se repiten los registros ya conciliados.</p>
    </>}
  </section>;
}
