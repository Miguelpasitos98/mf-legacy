/**
 * Explain observed metric coverage, without implying missing player data when
 * the actual blocker is the minimum comparison sample.
 */
export function v4MissingMetricExplanations(roleFit){
 if(!Array.isArray(roleFit?.metricDiagnostics))return [];
 return roleFit.metricDiagnostics.filter(metric=>metric.status!=="measured").map(metric=>{
  const name=metric.label||metric.key;
  const peers=metric.peerCount??0;
  if(metric.status==="insufficient_peers")
   return {key:metric.key,name,status:metric.status,
    reason:"Muestra insuficiente: "+peers+"/10 comparables externos.",
    detail:"Puede existir el dato del jugador, pero no hay diez registros equivalentes de su posición y temporada."};
  if(metric.status==="missing_player")
   return {key:metric.key,name,status:metric.status,
    reason:"Sin registro válido de esta métrica para el jugador.",
    detail:peers>=10?"La muestra de comparación sí está disponible.":"También hay "+peers+"/10 comparables externos."};
  return {key:metric.key,name,status:metric.status,
    reason:"No evaluable con los registros históricos disponibles.",detail:""};
 });
}
