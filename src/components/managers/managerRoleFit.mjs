import {TACTICAL_REQUIREMENT_RULES,V4_ROLE_METRICS,V4_METRIC_LABELS,UNMEASURED_ROLE_TRAITS} from "./managerRoleRules.mjs";

// Conservative: only explicit role instructions, complete phrases, and metrics
// measured in the selected historical season. No hidden AI or score imputation.
const normalize=text=>String(text||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const contains=(text,term)=>(" "+text+" ").includes(" "+normalize(term)+" ");
export function deriveRoleRequirements(profile,role){
 let raw="";
 try{
  const parsed=typeof profile?.player_role_priorities==="string"?JSON.parse(profile.player_role_priorities):profile?.player_role_priorities;
  raw=typeof parsed?.[role]==="string"?parsed[role]:"";
 }catch{return {text:"",matched:[],unmatched:true,unmeasuredTraits:[],metricKeys:[]};}
 const value=normalize(raw);
 const supported=new Set(V4_ROLE_METRICS[role]||[]);
 const matched=TACTICAL_REQUIREMENT_RULES.filter(rule=>rule.roles.includes(role)&&rule.terms.some(term=>contains(value,term))
  &&rule.metrics.some(metric=>supported.has(metric)));
 const unmeasuredTraits=UNMEASURED_ROLE_TRAITS.filter(rule=>rule.roles.includes(role)&&rule.terms.some(term=>contains(value,term))).map(r=>r.label);
 const metricKeys=[...new Set(matched.flatMap(rule=>rule.metrics))].filter(metric=>supported.has(metric));
 return {text:raw,matched,unmatched:matched.length===0,unmeasuredTraits,metricKeys};
}
export function evaluateRoleRequirements(metrics,peers,role,profile){
 const requirements=deriveRoleRequirements(profile,role);
 const candidates=requirements.metricKeys;
 const breakdown=[],metricDiagnostics=[];
 for(const key of candidates){
  const observation=metrics?.[key]?.value;
  const population=(Array.isArray(peers)?peers:[]).map(x=>x?.[key]?.value)
   .filter(v=>typeof v==="number"&&Number.isFinite(v)&&v>=0).sort((a,b)=>a-b);
  const observed=typeof observation==="number"&&Number.isFinite(observation)&&observation>=0;
  const item={key,label:V4_METRIC_LABELS[key]||key,peerCount:population.length,
   status:!observed?"missing_player":population.length<10?"insufficient_peers":"measured",
   source:observed?metrics[key]?.source||null:null,scope:observed?metrics[key]?.scope||null:null};
  metricDiagnostics.push(item);
  if(item.status!=="measured")continue;
  const below=population.filter(v=>v<observation).length;
  const equal=population.filter(v=>v===observation).length;
  breakdown.push({...item,percentile:Math.round(100*(below+equal/2)/population.length),value:observation});
 }
 const coverage=candidates.length?Math.round(breakdown.length/candidates.length*100):0;
 // V4 is unavailable until >=2 DISTINCT audited historical indicators are measured.
 const score=breakdown.length>=2?Math.round(breakdown.reduce((sum,item)=>sum+item.percentile,0)/breakdown.length):null;
 const mixedGlobal=breakdown.some(x=>x.scope?.includes("temporada global"))&&breakdown.some(x=>!x.scope?.includes("temporada global"));
 const limitation=requirements.unmatched
  ?"El rol no expresa requisitos vinculables con seguridad a los indicadores históricos disponibles."
  :score===null?"No hay al menos dos indicadores medidos con diez futbolistas comparables para esta temporada y posición."
  :"Los indicadores son proxies de actividad, no observan directamente las decisiones tácticas ni garantizan adaptación.";
 return {score,coverage,breakdown,requested:candidates.length,requirements:requirements.matched.map(r=>r.label),
  unmatched:requirements.unmatched,unmeasuredTraits:requirements.unmeasuredTraits,
  metricDiagnostics,missing:metricDiagnostics.filter(item=>item.status!=="measured"),
  confidence:score===null?"insufficient":mixedGlobal?"low":coverage>=75&&breakdown.length>=3?"medium":"low",
  limitation:mixedGlobal?limitation+" Incluye una fuente Understat de alcance global distinto de las métricas FotMob; interpretar con cautela.":limitation};
}

