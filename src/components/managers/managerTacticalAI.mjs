import {DNA_AXES,PROFILE_BLANK,ROLES,validSeason,profileScope} from "./managerModel.mjs";

export const FORMATIONS = ["4-3-3","4-2-3-1","4-4-2","3-5-2","3-4-3","4-3-1-2","5-3-2","4-1-4-1"];
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
Prioriza formation entre ${FORMATIONS.join(", ")}, pero si la formación histórica contrastada es otra (por ejemplo 4-2-2-2, 3-4-2-1 o 4-1-2-1-2), consérvala exactamente como sistema de diez jugadores de campo separado por guiones; NO la sustituyas por otra; build_up: short/mixed/direct; transition: counter_press/regroup/balanced; defensive_block: low/medium/high. Describe qué busca en un GK, CB, FB, DM, AM, WG y ST, adaptado al periodo. Si un rol no tiene evidencia, escribe "Sin información suficiente"; no inventes atributos verificados. Identifica también el ALCANCE exacto del perfil. Escribe profile_scope: "general" si realmente describes filosofía transversal de varias etapas sin fechas; "period" si analizas una etapa de VARIAS temporadas; "season" si analizas una campaña concreta. Para "period": indica reference_club, period_start y period_end con formato YYYY/YYYY (inclusive). Para "season": indica season con formato YYYY/YYYY. Para "general": deja vacíos los campos temporales y reference_club. suggested_name debe ser un título breve, por ejemplo "Liverpool 2018–2020", "Liverpool 2019/2020" o "Filosofía general". Si tienes dudas sobre las fechas, no inventes: usa "general" e indica incertidumbre. En profile_notes incluye explicación breve por líneas, argumentos sobre los valores y advertencias de incertidumbre; en source_urls solo URLs verdaderamente comprobadas, nunca inventadas.

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
export function inferManagerProfileContext(data){
  const scope=data?.profile_scope;
  if(["general","period","season"].includes(scope)){
    const club=String(data.reference_club||"").trim().slice(0,160);
    if(scope==="season" && validSeason(data.season))
      return {scope,reference_club:club,season:data.season,period_start:"",period_end:"",suggested_name:String(data.suggested_name||"").trim(),origin:"structured"};
    if(scope==="period" && validSeason(data.period_start) && validSeason(data.period_end) &&
      data.period_start < data.period_end)
      return {scope,reference_club:club,season:"",period_start:data.period_start,period_end:data.period_end,
        suggested_name:String(data.suggested_name||"").trim(),origin:"structured"};
    if(scope==="general")
      return {scope,reference_club:"",season:"",period_start:"",period_end:"",suggested_name:String(data.suggested_name||"").trim(),origin:"structured"};
    throw Error("La IA ha indicado un periodo sin fechas compatibles; revisa su respuesta.");
  }
  const notes=String(data?.profile_notes||"");
  const match=notes.match(/(?:^|\n)\s*ETAPA REPRESENTADA\s*:\s*([^\n]{0,350})/i);
  if(match){
    const header=match[1];
    const seasons=[...new Set((header.match(/(?:19|20)\d{2}\/(?:19|20)\d{2}/g)||[]).filter(validSeason))].sort();
    const club=header.split(/[,.;]|(?:temporadas?|campañas?|periodo|período)/i)[0]
      .replace(/\b(?:FC|CF|F\.C\.)\b/gi,"").trim().slice(0,160);
    if(seasons.length>=2 && seasons[0]<seasons[seasons.length-1]){
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

// Interpret only unambiguous synonyms; do not guess when the AI describes
// a different tactic or returns an unsupported composite value.
const tacticalAliases={
 build_up:{
   short:["short","short_passing","short_passes","short_build_up","possession","elaborate","elaborated","build_from_back","salida_corta","corta","pases_cortos","combinativo"],
   mixed:["mixed","balanced","hybrid","flexible","variable","mixto","mixta","equilibrado","equilibrada","combinada"],
   direct:["direct","direct_play","long","long_ball","long_balls","long_passing","vertical","directo","directa","juego_directo","balon_largo"]
 },
 transition:{
   counter_press:["counter_press","counterpress","counter_pressing","counterpressing","gegenpressing","press_after_loss","press_after_possession_loss","presion_tras_perdida","contrapresion"],
   regroup:["regroup","regrouping","fall_back","reorganize","reorganise","repliegue","replegar","reorganizarse"],
   balanced:["balanced","mixed","neutral","equilibrada","equilibrado","mixta","mixto"]
 },
 defensive_block:{
   low:["low","low_block","deep","deep_block","bajo","bloque_bajo"],
   medium:["medium","mid","mid_block","medium_block","middle","medio","bloque_medio"],
   high:["high","high_block","advanced","alto","bloque_alto"]
 }
};
export function normalizeTacticalEnum(field,value){
 const choices=tacticalAliases[field];
 if(!choices)throw Error("Parámetro táctico desconocido: "+field);
 const normalized=typeof value==="string"?value.trim().toLocaleLowerCase().normalize("NFD")
   .replace(/[\u0300-\u036f]/g,"").replace(/[\s-]+/g,"_"):"";
 for(const [canonical,aliases] of Object.entries(choices)){
   if(aliases.includes(normalized))return canonical;
 }
 throw Error("La IA devolvió un valor desconocido para "+field+": "+JSON.stringify(value)+
   ". Valores admitidos: "+Object.keys(choices).join(", ")+". Puedes corregirlo en el JSON sin repetir la investigación.");
}

// Coach histories may contain formations not available as editable pitch presets.
// Retain a valid eleven-player outfield formation rather than silently replacing it
// with a different shape (for example 4-2-2-2 is NOT 4-2-3-1).
export function normalizeManagerFormation(raw){
 if(typeof raw!=="string")throw Error("Formación ausente o no textual: "+JSON.stringify(raw));
 const stripped=raw.trim().replace(/[–—−_./\s]+/g,"-").replace(/^-+|-+$/g,"");
 const canonical=stripped.replace(/^sistema-?/i,"").replace(/^formaci[oó]n-?/i,"");
 const parts=canonical.split("-");
 const counts=parts.map(Number);
 if(parts.length<2||parts.length>5||parts.some(p=>!/^\d$/.test(p))||
    counts.some(n=>n<1||n>5)||counts[0]<3||counts[0]>5||counts.reduce((a,b)=>a+b,0)!==10)
  throw Error("La formación no es válida: "+JSON.stringify(raw)+
    ". Introduce una distribución válida de 10 jugadores de campo, por ejemplo 4-2-2-2, sin contar al portero.");
 return parts.join("-");
}
export function parseManagerTacticalResponse(input) {
  const data=unwrapJSON(input);
  if(data.identifiable!==true)throw Error(String(data.reason||"La identidad o el estilo del entrenador no se han podido verificar.").slice(0,250));
  if(!["high","medium","low"].includes(data.confidence))throw Error("La IA no ha indicado un nivel de confianza válido.");
  const formation=normalizeManagerFormation(data.formation);
  const tacticalValues=Object.fromEntries(["build_up","transition","defensive_block"]
    .map(key=>[key,normalizeTacticalEnum(key,data[key])]));
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
  const context=inferManagerProfileContext(data);
  return {context,values:{...numeric,formation,...tacticalValues},roleText,notes:data.profile_notes.trim().slice(0,3500),
    sourceUrls,confidence:data.confidence};
}

// Avoid silently erasing an existing, deliberately selected season or period
// when an older JSON contains no reliable identification of its own period.
export function effectiveProfileContext(current,parsed){
  const suggested=parsed.context||inferManagerProfileContext({});
  const existingScope=profileScope(current);
  if(suggested.origin==="not_specified" && (
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
    profile_notes:[caveat,parsed.notes,sources].join("\n\n"),
    source_url:parsed.sourceUrls[0]||current.source_url||""
  };
}
