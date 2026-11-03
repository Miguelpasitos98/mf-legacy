import {DNA_AXES,PROFILE_BLANK,ROLES,profileScope} from "./managerModel.mjs";
import {normalizeFormationDescription} from "./managerFormationNormalization.mjs";
import {normalizeExplicitSeason,resolveExplicitManagerPeriod} from "./managerSeasonNormalization.mjs";
export {normalizeManagerFormation} from "./managerFormationNormalization.mjs";

export const FORMATIONS = ["4-3-3","4-2-3-1","4-4-2","4-4-2 (rombo)","3-5-2","3-2-5","2-3-5","4-6-0","3-4-3","4-3-1-2","5-3-2","4-1-4-1","4-2-2-2","3-4-2-1","4-1-2-1-2"];
export const TACTICAL_JSON_EXAMPLE = {
  identifiable:true,confidence:"medium",profile_scope:"period",reference_club:"Liverpool",period_start:"2018/2019",period_end:"2019/2020",suggested_name:"Liverpool 2018–2020",formation:"4-3-3",
  possession:65,pressing:85,tempo:78,defensive_line:75,attacking_width:60,risk_taking:65,
  build_up:"mixed",transition:"counter_press",defensive_block:"high",
  player_role_priorities:{GK:"Portero hábil con los pies",CB:"Central con capacidad de anticipación",FB:"Lateral con recorrido",DM:"Pivote que protege transiciones",AM:"Mediapunta creativo",WG:"Extremo con desborde",ST:"Delantero con presión"},
  profile_notes:"Ejemplo de justificación táctica; explicar modelo, etapa y límites de la evidencia.",
  source_urls:[]
};
const validHttp = value => typeof value==="string" && /^https?:\/\/[^\s]+$/i.test(value.trim());

export function buildManagerTacticalPrompt(manager,profile={},referenceContext="") {
  const name=String(manager?.name||"").trim();
  if(name.length<2)throw Error("Selecciona primero un entrenador con nombre válido.");
  const fictional=manager.manager_kind==="fictional";
  const era=String(profile.season||"").trim();
  const scope=profileScope(profile);
  const clues=String(manager.biography||"").trim().slice(0,1800);
  const userNotes=String(profile.profile_notes||"").trim().slice(0,500);
  return `Eres analista táctico e historiador de fútbol para MF LEGACY.
ENTRENADOR: ${name}
TIPO: ${fictional?"Entrenador ficticio":"Entrenador real"}
TIPO DE PERFIL SOLICITADO: ${scope==="general"?"Sin periodo específico por defecto; investiga si hay un periodo representativo identificable":scope==="period"?"Etapa o periodo": "Temporada específica"}
TEMPORADA DEL PERFIL: ${era||"No especificada, describe su filosofía más representativa y aclara la etapa elegida"}
PERIODO YA INDICADO (si existe): ${profile.period_start||"sin inicio"} – ${profile.period_end||"sin fin"}
CLUB YA INDICADO (si existe): ${profile.reference_club||"sin club"}
CLUB O ETAPA SOLICITADOS: ${String(referenceContext||"").trim().slice(0,160)||"No especificados"}
INFORMACIÓN DE LA FICHA (orientativa, no contrastada): ${clues||"Sin biografía"}
INSTRUCCIONES DEL USUARIO (orientativas): ${userNotes||"No hay"}

Objetivo: elaborar un borrador de ADN táctico explicable para el editor Manager DNA. Investiga y contrasta, si es real, la filosofía de juego y el periodo solicitado, con fuentes de clubes, federaciones, competiciones y análisis tácticos reputados. Distingue periodos/clubes del entrenador y no atribuyas un estilo constante a toda su trayectoria. Si el nombre es ambiguo o no hay evidencia suficiente, devuelve identificable=false, sin inventar valores.
${fictional?"Este técnico es FICTICIO: plantea una interpretación creativa coherente con las indicaciones del usuario. No atribuyas fuentes reales ni afirmes que es evidencia histórica.":""}
Evalúa y estima seis parámetros de 0 a 100: possession (0 juego directo, 100 posesión), pressing (0 repliegue pasivo, 100 presión intensa), tempo (0 pausado, 100 transiciones muy verticales), defensive_line (0 bloque bajo, 100 línea alta), attacking_width (0 juego interior, 100 bandas), risk_taking (0 conservador, 100 creativo). IMPORTANTE: los números son una estimación analítica subjetiva para un editor, NO estadísticas observadas ni cifras oficiales. Evita extremos sin pruebas.
La formación NO está limitada a una lista cerrada. Puedes utilizar sistemas clásicos, actuales y subvariantes como "4-4-2 (rombo)", "4-3-3 (falso nueve)", "4-6-0", "2-3-5". Ejemplos ilustrativos, NO preferentes ni cerrados: ${FORMATIONS.join(", ")}. Investiga y escribe la formación histórica realmente representativa aunque no aparezca en los ejemplos; conserva la denominación original y la variante entre paréntesis si importa; el importador normalizará la disposición numérica de diez jugadores y guardará la variante en las notas. NO la sustituyas por otra distinta. CAMPOS ENUMERADOS: build_up SOLO short/mixed/direct (tipo de salida con balón); transition SOLO counter_press/regroup/balanced (reacción DEFENSIVA tras perder la posesión); defensive_block SOLO low/medium/high (altura de bloque). IMPORTANTE: fast_break, counter_attack, quick_transition y transiciones rápidas describen fases OFENSIVAS, NO son valores válidos para transition. Expresa esa velocidad con tempo y profile_notes. Si falta evidencia sobre la reacción tras pérdida, utiliza transition=balanced como marcador neutral y EXPLICA EN LAS NOTAS la incertidumbre; no atribuyas presión tras pérdida sin prueba. Describe qué busca en un GK, CB, FB, DM, AM, WG y ST, adaptado al periodo. Si un rol no tiene evidencia, escribe "Sin información suficiente"; no inventes atributos verificados. Identifica también el ALCANCE exacto del perfil. Escribe profile_scope: "general" si realmente describes filosofía transversal de varias etapas sin fechas; "period" si analizas una etapa de VARIAS temporadas; "season" si analizas una campaña concreta. Para "period": indica reference_club, period_start y period_end como temporadas exactas YYYY/YYYY (inclusive), no años calendario sueltos como "2014" ni rangos ambiguos como "2014-2016"; si solo puedes acreditar UNA campaña usa "season". Para "season": indica season con formato YYYY/YYYY. Para "general": deja vacíos los campos temporales y reference_club. suggested_name debe ser un título breve, por ejemplo "Liverpool 2018–2020", "Liverpool 2019/2020" o "Filosofía general". Si tienes dudas sobre las fechas, no inventes: usa "general" e indica incertidumbre. En profile_notes incluye explicación breve por líneas, argumentos sobre los valores y advertencias de incertidumbre; en source_urls solo URLs verdaderamente comprobadas, nunca inventadas.

RESPONDE SOLO JSON VÁLIDO con exactamente estas claves y tipos:
{"identifiable":true,"confidence":"high|medium|low","profile_scope":"general|period|season","reference_club":"club si procede","period_start":"YYYY/YYYY o vacío","period_end":"YYYY/YYYY o vacío","season":"YYYY/YYYY o vacío","suggested_name":"Nombre breve","formation":"4-3-3","possession":0,"pressing":0,"tempo":0,"defensive_line":0,"attacking_width":0,"risk_taking":0,"build_up":"short|mixed|direct","transition":"counter_press|regroup|balanced","defensive_block":"low|medium|high","player_role_priorities":{"GK":"texto","CB":"texto","FB":"texto","DM":"texto","AM":"texto","WG":"texto","ST":"texto"},"profile_notes":"explicación española con periodo y matices","source_urls":["https://fuente-real"]}.
Si falta evidencia suficiente del ENTRENADOR REAL o no es identificable, devuelve {"identifiable":false,"confidence":"low","reason":"Motivo en español","source_urls":[]} y omite los campos numéricos. No uses Markdown ni texto fuera del JSON.`;
}

function unwrapJSON(result) {
  let value=result;
  if(value && typeof value==="object" && !Array.isArray(value)){
    value=value.response??value.result??value.text??value.data??value;
  }
  if(value && typeof value==="object" && !Array.isArray(value))return value;
  if(typeof value!=="string")throw Error("La IA no devolvió una estructura JSON reconocible.");
  let text=value.trim().replace(/^\x60\x60\x60(?:json)?\s*/i,"").replace(/\s*\x60\x60\x60$/,"").trim();
  try{return JSON.parse(text)}catch {
    const first=text.indexOf("{"),last=text.lastIndexOf("}");
    if(first<0||last<=first)throw Error("No se encontró un objeto JSON de ADN táctico.");
    try{return JSON.parse(text.slice(first,last+1))}catch{throw Error("El JSON del ADN táctico está mal formado. Comprueba la respuesta de la IA.");}
  }
}

// Older JSON exports have no structured dates. Only inspect the explicit
// "ETAPA REPRESENTADA" introduction, never the full biography/history list.
export function inferManagerProfileContext(data,{onWarning}={}){
  const scope=data?.profile_scope;
  if(["general","period","season"].includes(scope)){
    const club=String(data.reference_club||"").trim().slice(0,160);
    const resolved=resolveExplicitManagerPeriod(data,scope);
    const suggested_name=String(data.suggested_name||"").trim();
    if(resolved.origin==="invalid_dates"){
      onWarning?.({field:"periodo",original:JSON.stringify(resolved.raw),fallback:"general (provisional)",
        reason:"no hay dos temporadas explícitas, consecutivas y ordenadas; se conserva la referencia original para revisión, sin inventar fechas"});
      return {...resolved,reference_club:"",suggested_name:suggested_name||"Filosofía general (fechas por revisar)"};
    }
    if(resolved.scope!==scope){
      onWarning?.({field:"profile_scope",original:scope,fallback:resolved.scope,
        reason:resolved.scope==="season"?"las fechas indican una sola campaña documentada":"las fechas indican varias campañas; se ha corregido el alcance sin alterar las temporadas"});
    }
    return {...resolved,reference_club:resolved.scope==="general"?"":club,
      suggested_name,origin:resolved.origin==="corrected"?"dates_corrected":"structured"};
  }
  // Only read the explicitly labelled stage heading from legacy JSON.
  // Do not mine the rest of a biography for dates.
  const notes=String(data?.profile_notes||"");
  const match=notes.match(/(?:^|\n)\s*ETAPA REPRESENTADA\s*:\s*([^\n]{0,350})/i);
  if(match){
    const header=match[1];
    const rawSeasons=header.match(/(?:19|20)\d{2}[\s/.-]+(?:(?:19|20)\d{2}|\d{2})/g)||[];
    const seasons=[...new Set(rawSeasons.map(normalizeExplicitSeason).filter(Boolean))].sort();
    const club=header.split(/[,.;]|(?:temporadas?|campa(?:n|ñ)as?|periodo|período)/i)[0]
      .replace(/\b(?:FC|CF|F\.C\.)\b/gi,"").trim().slice(0,160);
    if(seasons.length>=2&&seasons[0]<seasons[seasons.length-1]){
      const start=seasons[0],end=seasons[seasons.length-1];
      return {scope:"period",reference_club:club,season:"",period_start:start,period_end:end,
        suggested_name:[club,start.slice(0,4)+"–"+end.slice(5)].filter(Boolean).join(" "),origin:"explicit_notes"};
    }
    if(seasons.length===1){
      return {scope:"season",reference_club:club,season:seasons[0],period_start:"",period_end:"",
        suggested_name:[club,seasons[0]].filter(Boolean).join(" "),origin:"explicit_notes"};
    }
  }
  return {scope:"general",reference_club:"",season:"",period_start:"",period_end:"",
    suggested_name:"Filosofía general",origin:"not_specified"};
}

// IA responses sometimes use synonyms or concepts from a different tactical
// dimension. These can never crash an otherwise complete investigation. When
// a meaning is uncertain, use a neutral EDITABLE placeholder and an explicit
// warning retaining the original; never invent tactical evidence.
export const TACTICAL_ENUM_DEFAULTS=Object.freeze({
 build_up:"mixed",transition:"balanced",defensive_block:"medium"
});
const tacticalAliases={
 build_up:{
   short:["short","short_passing","short_passes","short_build_up","possession","elaborate","elaborated","build_from_back","salida_corta","corta","pases_cortos","combinativo","patient_build_up","positional_play","juego_de_posicion"],
   mixed:["mixed","balanced","hybrid","flexible","variable","mixto","mixta","equilibrado","equilibrada","combinada","combined","versatile"],
   direct:["direct","direct_play","long","long_ball","long_balls","long_passing","vertical","directo","directa","juego_directo","balon_largo","direct_build_up","long_passes"]
 },
 transition:{
   counter_press:["counter_press","counterpress","counter_pressing","counterpressing","gegenpressing","press_after_loss","press_after_possession_loss","presion_tras_perdida","contrapresion","counter_pressure","counterpress_after_loss","immediate_press_after_loss","pressing_after_loss","press_immediately"],
   regroup:["regroup","regrouping","fall_back","reorganize","reorganise","repliegue","replegar","reorganizarse","drop_back","drop_into_shape","recover_shape","fall_into_shape","reorganizacion"],
   balanced:["balanced","mixed","neutral","equilibrada","equilibrado","mixta","mixto","standard","adaptive","situational"]
 },
 defensive_block:{
   low:["low","low_block","deep","deep_block","bajo","bloque_bajo","deep_defensive_block"],
   medium:["medium","mid","mid_block","medium_block","middle","medio","bloque_medio","midfield_block"],
   high:["high","high_block","advanced","alto","bloque_alto","high_defensive_block","high_line"]
 }
};
const cleanEnumToken=value=>typeof value==="string"?value.trim()
 .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
 .replace(/([a-z])([A-Z])/g,"$1_$2").toLowerCase()
 .replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,""):"";
const rawEnumLabel=value=>{
 const label=typeof value==="string"?value:JSON.stringify(value);
 return String(label??"ausente").trim().slice(0,130)||"vacío";
};
export function normalizeTacticalEnum(field,value,{onWarning}={}){
 const choices=tacticalAliases[field];
 if(!choices)throw Error("Parámetro táctico desconocido: "+field);
 const normalized=cleanEnumToken(value);
 for(const [canonical,aliases] of Object.entries(choices)){
   if(aliases.includes(normalized))return canonical;
 }
 const fallback=TACTICAL_ENUM_DEFAULTS[field];
 const offensiveTransition=field==="transition"&&
  ["fast_break","fast_breaks","counter_attack","counter_attacks","counter_attacking",
   "quick_transition","rapid_transition","fast_transition","quick_counter",
   "counterattack","counterattacks","ataque_rapido","transicion_rapida",
   "transiciones_rapidas","contraataque","contraataques"].includes(normalized);
 const reason=offensiveTransition?
  "describe una transición ofensiva y no permite identificar la reacción defensiva tras pérdida":
  "no corresponde de forma inequívoca a ningún valor admitido";
 onWarning?.({field,original:rawEnumLabel(value),fallback,reason});
 return fallback;
}
export function normalizeResearchConfidence(value,{onWarning}={}){
 const aliases={
  high:["high","alta","alto","very_high","muy_alta","strong"],
  medium:["medium","media","medio","moderate","moderada","moderado","mid"],
  low:["low","baja","bajo","very_low","muy_baja","uncertain"]
 };
 const normalized=cleanEnumToken(value);
 for(const [canonical,items] of Object.entries(aliases))if(items.includes(normalized))return canonical;
 onWarning?.({field:"confidence",original:rawEnumLabel(value),fallback:"low",
  reason:"no se reconoció el nivel de confianza; se aplica el mínimo por prudencia"});
 return "low";
}
export function normalizeResearchScope(data,{onWarning}={}){
 const aliases={
  general:["general","overall","career","career_wide","general_philosophy","filosofia_general","global","transversal"],
  period:["period","periodo","era","stage","etapa","multi_season","multi_year"],
  season:["season","single_season","temporada","campaign","campana"]
 };
 const normalized=cleanEnumToken(data?.profile_scope);
 const hasSeason=Boolean(String(data?.season||"").trim());
 const hasPeriod=Boolean(String(data?.period_start||"").trim()||String(data?.period_end||"").trim());
 if(!normalized&&!hasSeason&&!hasPeriod){
   // Legacy JSON with only a documented ETAPA REPRESENTADA heading.
   return null;
 }
 for(const [canonical,items] of Object.entries(aliases))if(items.includes(normalized))return canonical;
 // For missing/unknown scope, prefer the explicit field family so the
 // downstream context resolver can validate dates AND surface a warning.
 // Never silently demote a broken period to "general" here.
 const fallback=hasPeriod?"period":hasSeason?"season":"general";
 onWarning?.({field:"profile_scope",original:rawEnumLabel(data?.profile_scope),fallback,
   reason:"alcance ausente o desconocido; se deduce únicamente qué campos de fechas se proporcionaron; las fechas se validan por separado"});
 return fallback;
}
export const formatTacticalWarnings=warnings=>(warnings||[]).length?
 "VALORES DE IA QUE REQUIEREN REVISIÓN (sin inferencia táctica):\n"+
 warnings.map(w=>"- "+w.field+": la IA devolvió "+JSON.stringify(w.original)+
 " → valor provisional "+JSON.stringify(w.fallback)+". Motivo: "+w.reason+".").join("\n"):"";

export function parseManagerTacticalResponse(input) {
  const data=unwrapJSON(input);
  if(data.identifiable!==true)throw Error(String(data.reason||"La identidad o el estilo del entrenador no se han podido verificar.").slice(0,250));
  const warnings=[];
  const onWarning=warning=>warnings.push(warning);
  const confidence=normalizeResearchConfidence(data.confidence,{onWarning});
  const scope=normalizeResearchScope(data,{onWarning});
  const shape=normalizeFormationDescription(data.formation);
  const formation=shape.formation;
  if(shape.warning)onWarning(shape.warning);
  const tacticalValues=Object.fromEntries(["build_up","transition","defensive_block"]
    .map(key=>[key,normalizeTacticalEnum(key,data[key],{onWarning})]));
  const numeric={};
  for(const {key} of DNA_AXES){
    if(typeof data[key]!=="number"||!Number.isFinite(data[key])||data[key]<0||data[key]>100)
      throw Error("Falta una estimación válida (0–100) para "+key+"; no se completará el perfil con cifras inventadas.");
    numeric[key]=Math.round(data[key]);
  }
  if(!data.player_role_priorities||typeof data.player_role_priorities!=="object"||Array.isArray(data.player_role_priorities))
    throw Error("La IA no devolvió los perfiles por posición.");
  const roleText={};
  for(const {key} of ROLES){
    const role=data.player_role_priorities[key];
    if(typeof role!=="string")throw Error("Falta la preferencia del rol "+key+".");
    roleText[key]=role.slice(0,700).trim();
  }
  if(typeof data.profile_notes!=="string"||data.profile_notes.trim().length<35)
    throw Error("Falta la justificación del análisis táctico.");
  const sourceUrls=Array.isArray(data.source_urls)
    ? [...new Set(data.source_urls.filter(validHttp).map(x=>x.trim()))].slice(0,8):[];
  const context=inferManagerProfileContext(scope===null?data:{...data,profile_scope:scope},{onWarning});
  return {context,values:{...numeric,formation,...tacticalValues},roleText,notes:data.profile_notes.trim().slice(0,3500),
    sourceUrls,confidence,warnings};
}

// Avoid silently erasing an existing, deliberately selected season or period
// when an older JSON contains no reliable identification of its own period.
export function effectiveProfileContext(current,parsed){
  const suggested=parsed.context||inferManagerProfileContext({});
  const existingScope=profileScope(current);
  if(["not_specified","invalid_dates"].includes(suggested.origin) && (
    existingScope==="season" || existingScope==="period" ||
    Boolean(current?.period_start||current?.period_end||current?.season)
  ))return {scope:existingScope,reference_club:current.reference_club||"",
    season:current.season||"",period_start:current.period_start||"",period_end:current.period_end||"",
    suggested_name:"",origin:"existing_preserved"};
  return suggested;
}
export function previewManagerTacticalDraft(current,parsed) {
  const confidence={high:"alta",medium:"media",low:"baja"}[parsed.confidence];
  const caveat="ADN propuesto por IA (confianza "+confidence+"). Valores 0–100 estimados, no métricas oficiales. Revisar la evidencia antes de confirmar.";
  const sources=parsed.sourceUrls.length?"Fuentes sugeridas (pendientes de revisión):\n"+parsed.sourceUrls.join("\n"):"Fuentes no aportadas; pendiente de investigación documental.";
  const context=effectiveProfileContext(current,parsed);
  const genericName = ["Modelo principal","Nuevo perfil","Filosofía general"].includes(String(current.name||"").trim());
  return {
    ...PROFILE_BLANK,...current,...parsed.values,
    profile_scope:context.scope,
    reference_club:context.reference_club,
    season:context.scope==="season"?context.season:"",
    period_start:context.scope==="period"?context.period_start:"",
    period_end:context.scope==="period"?context.period_end:"",
    name:genericName&&context.suggested_name?context.suggested_name:current.name,
    profile_notes:[caveat,formatTacticalWarnings(parsed.warnings),parsed.notes,sources].filter(Boolean).join("\n\n"),
    source_url:parsed.sourceUrls[0]||current.source_url||""
  };
}
