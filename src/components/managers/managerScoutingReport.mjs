/**
 * Read-only, evidence-labelled scouting report. There are no fabricated
 * assessments: strengths/risks require observed same-season percentiles.
 */
export const SCOUT_METRIC_NAMES={
 xa:"Asistencias esperadas /90",chain:"Participación xG Chain /90",buildup:"Construcción xG Buildup /90",
 pressure:"Recuperaciones en último tercio /90",defense:"Acciones defensivas ajustadas /90",
 defensiveActions:"Acciones defensivas /90 (sin ajustar)",tackles:"Entradas /90",interceptions:"Intercepciones /90",
 recoveries:"Recuperaciones /90",clearances:"Despejes /90",aerialsWon:"Duelos aéreos ganados /90 (volumen)",
 touchesBox:"Toques en área rival /90",chancesCreated:"Ocasiones creadas /90",
 dribbles:"Regates completados /90",xg:"xG sin penaltis /90",shot:"Tiros a puerta /90",
 passing:"Pases precisos /90",longPassing:"Pases largos precisos /90",creation:"Ocasiones claras creadas /90",preventing:"Goles evitados /90"
};
export function buildScoutingReport(player,role,profile,season,roleResult,historical,attributeResult){
 const measured=Array.isArray(roleResult?.breakdown)?roleResult.breakdown:[];
 const strengths=measured.filter(x=>x.percentile>=70).sort((a,b)=>b.percentile-a.percentile);
 const weaknesses=measured.filter(x=>x.percentile<=35).sort((a,b)=>a.percentile-b.percentile);
 const neutral=measured.filter(x=>x.percentile>35&&x.percentile<70);
 const unmeasured=(roleResult?.requested||0)-measured.length;
 const score=roleResult?.score??null;
 const fitLabel=score===null?"No evaluable":score>=80?"Encaje estadístico elevado":score>=60?"Encaje estadístico favorable":score>=40?"Encaje estadístico intermedio":"Encaje estadístico reducido";
 return {
  playerName:String(player?.name||"Jugador"),season,role,profileName:String(profile?.name||""),
  fit:score,fitLabel,confidence:roleResult?.confidence||"insufficient",
  strengths,weaknesses,neutral,
  unmeasured:Math.max(0,unmeasured),coverage:roleResult?.coverage||0,
  identifiedRequirements:roleResult?.requirements||[],
  metricDiagnostics:roleResult?.metricDiagnostics||[],
  functionBreakdown:roleResult?.requirementBreakdown||[],
  minimumPeers:roleResult?.minimumPeers??0,
  unmeasuredTraits:roleResult?.unmeasuredTraits||[],
  missingMetricReasons:roleResult?.missing||[],
  historicalScore:historical?.score??null,attributeScore:attributeResult?.score??null,
  positionScore:attributeResult?.position??null,
  ca:attributeResult?.quality??null,
  limitations:roleResult?.limitation||"No se pudieron evaluar requisitos del rol.",
  evidenceAvailable:measured.length>=2,
  summary:score===null
   ?"Los registros disponibles no permiten emitir una valoración de encaje por requisitos para esta temporada."
   :`Estimación de encaje de ${score}/100 basada en ${measured.length} indicadores comparados con jugadores del mismo rol y temporada. ${strengths.length?"Se observan fortalezas en "+strengths.map(x=>SCOUT_METRIC_NAMES[x.key]||x.key).join(", ")+". ":""}${weaknesses.length?"Los indicadores relativamente bajos son "+weaknesses.map(x=>SCOUT_METRIC_NAMES[x.key]||x.key).join(", ")+". ":""}${unmeasured>0?"Hay "+unmeasured+" indicadores del rol sin evidencia comparable.":""}`
 };
}
export function compareManagerProfiles(player,role,season,profiles,metrics,peers,evaluate){
 return profiles.map(profile=>{
  const result=evaluate(metrics,peers,role,profile,{playerId:player?.id??null});
  return {id:String(profile.id),name:String(profile.name||""),is_default:Boolean(profile.is_default),
   fit:result.score,coverage:result.coverage,confidence:result.confidence,
   evaluated:result.breakdown?.length||0};
 }).sort((a,b)=>Number(b.fit!==null)-Number(a.fit!==null)||(b.fit??-1)-(a.fit??-1)||a.name.localeCompare(b.name));
}
