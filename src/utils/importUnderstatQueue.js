// Understat import is a source-specific gap audit, not a claim that the
// player's entire career is complete. Derived from the durable latest job.
export function understatAuditOf(group,localAudits={}){
 if(!group)return null;
 const job=group.latest;
 const own=localAudits[job?.id];
 return own||job?.source_results?.understat_gap_audit||null;
}
export function understatQueueState(group,localAudits={}){
 if(!group?.sources?.includes("understat"))return {kind:"not_selected",label:"Understat no solicitado"};
 if(group.active)return {kind:"active",label:"Understat se revisará al terminar"};
 const audit=understatAuditOf(group,localAudits);
 if(!audit)return {kind:group.errors&&!group.reviews?"error":"unscanned",label:group.errors&&!group.reviews?
  "Trabajo fallido · revisar":"Understat pendiente de diagnóstico"};
 const count=Math.max(0,Math.floor(Number(audit.proposals)||0));
 switch(audit.status){
  case "pending":return {kind:"pending",count,label:"Understat · "+count+" propuestas pendientes"};
  case "no_detected_gaps":return {kind:"no_gaps",count:0,label:"Understat · sin huecos detectados"};
  case "needs_identity_confirmation":return {kind:"identity",label:"Understat · confirmar identidad"};
  case "needs_fotmob_link":return {kind:"identity",label:"Confirmar vínculo FotMob"};
  case "not_covered":return {kind:"not_covered",label:"Understat · sin cobertura en archivo"};
  case "needs_review":return {kind:"review",label:"Understat · requiere revisión"};
  case "error":return {kind:"error",label:"Error al analizar Understat"};
  default:return {kind:"unscanned",label:"Understat pendiente de diagnóstico"};
 }
}
export function understatQueueCounts(groups,audits={}){
 const withSource=groups.filter(g=>g.sources.includes("understat"));
 const counts={total:withSource.length,active:0,unscanned:0,pending:0,identity:0,
   no_gaps:0,not_covered:0,review:0,error:0,proposals:0};
 for(const g of withSource){
  const s=understatQueueState(g,audits);
  if(s.kind in counts)counts[s.kind]++;
  counts.proposals+=s.kind==="pending"?s.count:0;
 }
 return counts;
}
