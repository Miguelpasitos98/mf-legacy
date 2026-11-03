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
/**
 * V4.1: measure only independent same-season observations.
 * - Players with IDs are excluded from their OWN comparison sample.
 * - Peer source/scope is matched where supplied, to avoid comparing
 *   FotMob and season-global Understat as though they were identical.
 * - Requested tactical functions are weighted equally. A verbose function
 *   does not get extra weight merely because it has more available metrics.
 * - The ≥2 DISTINCT measured indicators / ≥10 external peers guardrails remain.
 */
export function evaluateRoleRequirements(metrics,peers,role,profile,{playerId=null}={}){
 const requirements=deriveRoleRequirements(profile,role);
 const candidates=requirements.metricKeys;
 const breakdown=[],metricDiagnostics=[];
 const cohort=Array.isArray(peers)?peers:[];
 for(const key of candidates){
  const current=metrics?.[key];
  const observation=current?.value;
  const observed=typeof observation==="number"&&Number.isFinite(observation)&&observation>=0;
  const source=current?.source||null;
  const scope=current?.scope||null;
  const hasSource=Boolean(source);
  const comparable=cohort.filter(x=>{
   if(playerId!==null&&String(x?.__playerId||"")===String(playerId))return false;
   const peer=x?.[key];
   if(!peer||typeof peer.value!=="number"||!Number.isFinite(peer.value)||peer.value<0)return false;
   if(hasSource&&peer.source&&peer.source!==source)return false;
   if(scope&&peer.scope&&peer.scope!==scope)return false;
   return true;
  });
  const population=comparable.map(x=>x[key].value).sort((a,b)=>a-b);
  const status=!observed?"missing_player":population.length<10?"insufficient_peers":"measured";
  const item={key,label:V4_METRIC_LABELS[key]||key,peerCount:population.length,
   status,source:observed?source:null,scope:observed?scope:null,
   minutes:observed?current?.minutes??null:null};
  metricDiagnostics.push(item);
  if(status!=="measured")continue;
  const below=population.filter(v=>v<observation).length;
  const equal=population.filter(v=>v===observation).length;
  breakdown.push({...item,percentile:Math.round(100*(below+equal/2)/population.length),value:observation});
 }
 const coverage=candidates.length?Math.round(breakdown.length/candidates.length*100):0;
 const byKey=new Map(breakdown.map(row=>[row.key,row]));
 const requirementBreakdown=requirements.matched.map(rule=>{
  const keys=[...new Set(rule.metrics)].filter(key=>(V4_ROLE_METRICS[role]||[]).includes(key));
  const available=keys.map(key=>byKey.get(key)).filter(Boolean);
  const familyScore=available.length?
   Math.round(available.reduce((sum,row)=>sum+row.percentile,0)/available.length):null;
  return {id:rule.id,label:rule.label,score:familyScore,
   measured:available.length,requested:keys.length,
   coverage:keys.length?Math.round(100*available.length/keys.length):0,
   metricKeys:keys,missingKeys:keys.filter(key=>!byKey.has(key))};
 });
 // Each explicitly requested tactical FUNCTION counts once, regardless of
 // how many statistical proxies happen to describe it. No invented weights.
 const validFamilies=requirementBreakdown.filter(family=>family.score!==null);
 const score=breakdown.length>=2&&validFamilies.length?
  Math.round(validFamilies.reduce((sum,family)=>sum+family.score,0)/validFamilies.length):null;
 const mixedGlobal=breakdown.some(x=>x.scope?.includes("temporada global"))&&breakdown.some(x=>!x.scope?.includes("temporada global"));
 const lowerMinutes=breakdown.some(x=>x.minutes!==null&&x.minutes<450);
 const confidence=score===null?"insufficient":
  mixedGlobal||lowerMinutes?"low":
  coverage>=75&&breakdown.length>=3&&validFamilies.length>=2?"medium":"low";
 const limitation=requirements.unmatched
  ?"El rol no expresa requisitos vinculables con seguridad a los indicadores históricos disponibles."
  :score===null?"No hay al menos dos indicadores medidos con diez futbolistas comparables para esta temporada y posición."
  :"Las funciones del ADN tienen el mismo peso; sus indicadores son proxies de actividad, no observan directamente las decisiones tácticas ni garantizan adaptación.";
 const caveats=[
  mixedGlobal?"Incluye una fuente Understat de alcance global distinto de las métricas FotMob.":null,
  lowerMinutes?"Algún indicador procede de menos de 450 minutos observados; la confianza se reduce.":null
 ].filter(Boolean);
 return {score,coverage,breakdown,requested:candidates.length,
  requirements:requirements.matched.map(r=>r.label),requirementBreakdown,
  evaluatedFunctions:validFamilies.length,requestedFunctions:requirementBreakdown.length,
  unmatched:requirements.unmatched,unmeasuredTraits:requirements.unmeasuredTraits,
  metricDiagnostics,missing:metricDiagnostics.filter(item=>item.status!=="measured"),
  confidence,limitation:limitation+(caveats.length?" "+caveats.join(" "):"")};
}
