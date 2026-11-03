import React,{useEffect,useRef,useState} from "react";
import {base44} from "@/api/base44Client";
export default function ImportRepairPanel({onApplied}){
  const [run,setRun]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const processing=useRef(false);
  const invoke=async(action,extra={})=>{
    setBusy(true);setError("");
    try{
      const {data}=await base44.functions.invoke("import-review",{action,run_id:run?.id,...extra});
      if(data.run){setRun(data.run);sessionStorage.setItem("mf-import-repair-run",data.run.id);}
      if(action==="repair-step"&&run?.mode==="apply")await onApplied?.();
    }catch(e){setError(e.response?.data?.error||e.message);}
    finally{setBusy(false);}
  };
  useEffect(()=>{
    const id=sessionStorage.getItem("mf-import-repair-run");
    if(id)base44.functions.invoke("import-review",{action:"repair-status",run_id:id}).then(r=>setRun(r.data.run)).catch(()=>{});
  },[]);
  const processAll=async()=>{
    if(!run||busy)return;
    processing.current=true;setBusy(true);setError("");
    let current=run;
    try{
      while(processing.current&&current.status==="ready"){
        const {data}=await base44.functions.invoke("import-review",{action:"repair-step",run_id:current.id});
        current=data.run;setRun(current);
      }
      if(!processing.current&&current.status==="ready"){
        const {data}=await base44.functions.invoke("import-review",{action:"repair-pause",run_id:current.id});setRun(data.run);
      }
      if(current.mode==="apply")await onApplied?.();
    }catch(e){setError(e.response?.data?.error||e.message);}
    finally{processing.current=false;setBusy(false);}
  };
  const downloadReport=async()=>{
    setBusy(true);setError("");
    try{
      const {data}=await base44.functions.invoke("import-review",{action:"repair-status",run_id:run.id});
      const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));
      const anchor=document.createElement("a");anchor.href=url;anchor.download="mf-import-repair-"+run.id+".json";anchor.click();URL.revokeObjectURL(url);
    }catch(e){setError(e.response?.data?.error||e.message);}finally{setBusy(false);}
  };
  return <details className="rounded-xl border border-slate-200 bg-white p-4">
    <summary className="cursor-pointer font-semibold">Reparar importaciones anteriores</summary>
    <p className="my-3 text-xs text-slate-600">Examina los trabajos de todos los jugadores, completa campos vacíos y conserva las correcciones manuales. La simulación genera un informe antes de permitir la aplicación. Cada lote se guarda y puede reanudarse.</p>
    {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
    {run&&<p className="my-2 text-sm">{run.mode==="simulation"?"Simulación":"Aplicación"}: {run.cursor}/{run.total} trabajos · {run.status}. {run.counts?.added||0} valores nuevos · {run.counts?.unchanged||0} ya existentes · {run.counts?.conflicts||0} conflictos · {run.counts?.errors||0} incidencias.</p>}
    <div className="flex flex-wrap gap-3 text-sm text-[#003399]">
      <button disabled={busy} onClick={()=>invoke("repair-create")}>Nueva simulación global</button>
      {run?.status==="ready"&&<><button disabled={busy} onClick={processAll}>Procesar todos los lotes</button><button disabled={busy} onClick={()=>invoke("repair-step")}>Siguiente lote</button><button disabled={busy} onClick={()=>invoke("repair-pause")}>Pausar</button></>}
      {busy&&processing.current&&<button onClick={()=>{processing.current=false;}}>Detener después de este lote</button>}
      {run?.status==="paused"&&<button disabled={busy} onClick={()=>invoke("repair-resume")}>Reanudar</button>}
      {run?.status==="completed"&&run.mode==="simulation"&&<button disabled={busy} onClick={()=>invoke("repair-apply")}>Aplicar valores compatibles</button>}
      {run?.status==="completed"&&run.mode==="apply"&&<button disabled={busy} onClick={()=>invoke("repair-recover")}>Solicitar fuentes adicionales</button>}
      {run&&<button disabled={busy} onClick={downloadReport}>Descargar informe</button>}
    </div>
  </details>;
}
