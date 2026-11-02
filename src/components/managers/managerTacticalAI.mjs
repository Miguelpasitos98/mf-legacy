import {DNA_AXES,PROFILE_BLANK,ROLES} from "./managerModel.mjs";

export const FORMATIONS = ["4-3-3","4-2-3-1","4-4-2","3-5-2","3-4-3","4-3-1-2","5-3-2","4-1-4-1"];
export const TACTICAL_JSON_EXAMPLE = {
  identifiable:true,confidence:"medium",formation:"4-3-3",
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
  const clues=String(manager.biography||"").trim().slice(0,1800);
  const userNotes=String(profile.profile_notes||"").trim().slice(0,500);
  return `Eres analista táctico e historiador de fútbol para MF LEGACY.
ENTRENADOR: ${name}
TIPO: ${fictional?"Entrenador ficticio":"Entrenador real"}
TEMPORADA DEL PERFIL: ${era||"No especificada, describe su filosofía más representativa y aclara la etapa elegida"}
CLUB O ETAPA SOLICITADOS: ${String(referenceContext||"").trim().slice(0,160)||"No especificados"}
INFORMACIÓN DE LA FICHA (orientativa, no contrastada): ${clues||"Sin biografía"}
INSTRUCCIONES DEL USUARIO (orientativas): ${userNotes||"No hay"}

Objetivo: elaborar un borrador de ADN táctico explicable para el editor Manager DNA. Investiga y contrasta, si es real, la filosofía de juego y el periodo solicitado, con fuentes de clubes, federaciones, competiciones y análisis tácticos reputados. Distingue periodos/clubes del entrenador y no atribuyas un estilo constante a toda su trayectoria. Si el nombre es ambiguo o no hay evidencia suficiente, devuelve identificable=false, sin inventar valores.
${fictional?"Este técnico es FICTICIO: plantea una interpretación creativa coherente con las indicaciones del usuario. No atribuyas fuentes reales ni afirmes que es evidencia histórica.":""}
Evalúa y estima seis parámetros de 0 a 100: possession (0 juego directo, 100 posesión), pressing (0 repliegue pasivo, 100 presión intensa), tempo (0 pausado, 100 transiciones muy verticales), defensive_line (0 bloque bajo, 100 línea alta), attacking_width (0 juego interior, 100 bandas), risk_taking (0 conservador, 100 creativo). IMPORTANTE: los números son una estimación analítica subjetiva para un editor, NO estadísticas observadas ni cifras oficiales. Evita extremos sin pruebas.
Elige formation entre ${FORMATIONS.join(", ")}; build_up: short/mixed/direct; transition: counter_press/regroup/balanced; defensive_block: low/medium/high. Describe qué busca en un GK, CB, FB, DM, AM, WG y ST, adaptado al periodo. Si un rol no tiene evidencia, escribe "Sin información suficiente"; no inventes atributos verificados. En profile_notes incluye explicación breve por líneas, argumentos sobre los valores y advertencias de incertidumbre; en source_urls solo URLs verdaderamente comprobadas, nunca inventadas.

RESPONDE SOLO JSON VÁLIDO con exactamente estas claves y tipos:
{"identifiable":true,"confidence":"high|medium|low","formation":"4-3-3","possession":0,"pressing":0,"tempo":0,"defensive_line":0,"attacking_width":0,"risk_taking":0,"build_up":"short|mixed|direct","transition":"counter_press|regroup|balanced","defensive_block":"low|medium|high","player_role_priorities":{"GK":"texto","CB":"texto","FB":"texto","DM":"texto","AM":"texto","WG":"texto","ST":"texto"},"profile_notes":"explicación española con periodo y matices","source_urls":["https://fuente-real"]}.
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

export function parseManagerTacticalResponse(input) {
  const data=unwrapJSON(input);
  if(data.identifiable!==true)throw Error(String(data.reason||"La identidad o el estilo del entrenador no se han podido verificar.").slice(0,250));
  if(!["high","medium","low"].includes(data.confidence))throw Error("La IA no ha indicado un nivel de confianza válido.");
  if(!FORMATIONS.includes(data.formation))throw Error("La formación devuelta no es compatible con el editor.");
  const enums={build_up:["short","mixed","direct"],transition:["counter_press","regroup","balanced"],defensive_block:["low","medium","high"]};
  for(const [key,allowed] of Object.entries(enums)){
    if(!allowed.includes(data[key]))throw Error("La IA devolvió un valor desconocido para "+key+".");
  }
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
  return {values:{...numeric,formation:data.formation,build_up:data.build_up,transition:data.transition,
    defensive_block:data.defensive_block},roleText,notes:data.profile_notes.trim().slice(0,3500),
    sourceUrls,confidence:data.confidence};
}

export function previewManagerTacticalDraft(current,parsed) {
  const confidence={high:"alta",medium:"media",low:"baja"}[parsed.confidence];
  const caveat="ADN propuesto por IA (confianza "+confidence+"). Valores 0–100 estimados, no métricas oficiales. Revisar la evidencia antes de confirmar.";
  const sources=parsed.sourceUrls.length?"Fuentes sugeridas (pendientes de revisión):\n"+parsed.sourceUrls.join("\n"):"Fuentes no aportadas; pendiente de investigación documental.";
  return {
    ...PROFILE_BLANK,...current,...parsed.values,
    profile_notes:[caveat,parsed.notes,sources].join("\n\n"),
    source_url:parsed.sourceUrls[0]||current.source_url||""
  };
}
