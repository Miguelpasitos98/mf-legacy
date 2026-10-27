export function importLandingView(saved={},params=new URLSearchParams()){
  if(!params.get("import_batch"))return saved;
  return {...saved,season:"Todas",competition:"Todas",search:params.get("stats_player")||"",viewMode:"season",
    minMinutes:0,positionFilter:"Todas",seasonDisplay:"all",tab:"con",category:"Resumen",page:0,scrollTop:0,scrollLeft:0};
}
export function historyCanRetry(job){
  const pending=new Set(["consulta_pendiente","error_temporal","cache_absent","candidate_limit","query_failed"]);
  return (job.sources||[]).some(source=>{
    const r=job.source_results?.[source]||{},d=r.diagnostics||[];
    return ["error","pending"].includes(r.status)||r.status==="partial"&&!d.length
      ||r.status==="unavailable"&&(!d.length||!d.every(x=>x.status==="fuera_cobertura"))||d.some(x=>pending.has(x.status));
  });
}
