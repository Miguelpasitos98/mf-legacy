import {PROFILE_BLANK,cleanProfile,profileScope} from "./managerModel.mjs";
import {parseManagerTacticalResponse,previewManagerTacticalDraft} from "./managerTacticalAI.mjs";

export const CAREER_FORMAT = "mf_legacy_manager_career_dna_v1";
export const SUCCESS_TIERS = {
  very_successful:"Muy exitosa",successful:"Exitosa",mixed:"Resultados mixtos",
  limited:"Éxito limitado",unknown:"No evaluable"
};
const trim = (x,n=1200)=>String(x??"").trim().slice(0,n);
const url = x=>typeof x==="string" && /^https?:\/\/[^\s]+$/i.test(x.trim());
const norm=x=>trim(x,200).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
export const profileIdentity = p=>[
  profileScope(p),norm(p.reference_club),trim(p.season),trim(p.period_start),trim(p.period_end)
].join("::");

export function buildManagerCareerPrompt(manager,periodContext=""){
  const name=trim(manager?.name,160);
  if(name.length<2)throw Error("Selecciona primero un entrenador.");
  const fictional=manager.manager_kind==="fictional";
  const input=trim(periodContext,220);
  return `Eres historiador y analista táctico para MF LEGACY. INVESTIGA LA EVOLUCIÓN COMPLETA DEL ENTRENADOR, NO SOLO UNA TEMPORADA.
ENTRENADOR: ${name}
TIPO: ${fictional?"Ficticio":"Real"}
ALCANCE ESPECÍFICO SOLICITADO (opcional): ${input||"Toda la carrera como entrenador"}
BIOGRAFÍA ORIENTATIVA (NO LA TOMES POR PRUEBA): ${trim(manager?.biography,1400)||"No aportada"}

OBJETIVO: producir un único JSON con varios MODELOS TÁCTICOS HISTÓRICOS y, DESPUÉS de compararlos, una FILOSOFÍA GENERAL SINTETIZADA. Identifica SOLO los cambios de sistema y comportamiento más importantes, no una entrada por cada año ni por cada trofeo. Ordena cronológicamente. Crea entre 2 y 6 periodos cuando haya evidencia suficiente; menos si la carrera es corta. Puedes diferenciar dos periodos del mismo club cuando exista un cambio estructural demostrado. Para cada uno:
- Club, primera y última temporada exacta (YYYY/YYYY). Una sola campaña usa profile_scope=season; varias usan profile_scope=period.
- Formación predominante, salida de balón, presión tras pérdida, altura del bloque, seis estimaciones de estilo en escala 0–100 (NO estadísticas oficiales), los siete perfiles de futbolista GK, CB, FB, DM, AM, WG, ST, y matices.
- Principales diferencias respecto al periodo anterior, adaptaciones observables y por qué el modelo funcionó o no.
- Evidencia de RESULTADOS del periodo: títulos o hitos CONTRASTADOS con temporada y fuente, y limitaciones contextuales (calidad plantilla, rivales, recursos, duración). Nunca atribuyas una temporada a un título que no hayas confirmado; si no hay evidencia, dejar listas vacías y success_tier="unknown".
- success_tier SOLO una de very_successful, successful, mixed, limited, unknown. Es un juicio contextual QUALITATIVO, NO una métrica matemática. Explica su criterio en results_summary. No inventes porcentajes de victorias o puntos, ni números de trofeos.
- Para la comparación, distingue impacto histórico, resultados y sostenibilidad; el modelo más exitoso en resultados no es automáticamente el mejor tácticamente. Elige best_supported_model_id SOLO con evidencia suficiente, de lo contrario null. Explica por qué en comparative_reason.
- Cita únicamente URLs reales que puedas comprobar. Usa varias fuentes independientes cuando sea posible. Si hay información contradictoria, explica la incertidumbre en las notas. No atribuyas al entrenador cargos ejecutivos como si entrenara un primer equipo.
- Para entrenadores ficticios ${fictional?"trabaja únicamente como SIMULACIÓN creativa, success_tier=unknown y no atribuyas títulos ni URLs verificadas.":"NO inventes hechos ni periodos. Si no es identificable devuelve identifiable=false y reason."}

SÍNTESIS: después de analizar los modelos, general_philosophy recoge los PRINCIPIOS TÁCTICOS que aparecen de forma consistente, con un 4-3-3 o la formación PRINCIPAL histórica solo si justificable. Su profile_scope siempre "general", sin fechas ni club. Su nombre sugerido será "Filosofía general". Las seis notas de la síntesis NO deben calcularse como media aritmética de las etapas: deben ser una valoración analítica de rasgos transversales. En notes indica qué rasgos han cambiado, cuál fue el modelo más exitoso, qué evidencia lo respalda y qué no se puede generalizar. Añade las siete preferencias generales de jugadores. NO confundas identidad histórica con éxito deportivo.

Devuelve SOLO JSON válido (sin \`\`\`), con estructura:
{
 "format":"mf_legacy_manager_career_dna_v1","identifiable":true,"confidence":"high|medium|low",
 "models":[
  {
   "model_id":"codigo_unico_estable",
   "profile_scope":"period|season","reference_club":"Club","period_start":"2018/2019","period_end":"2019/2020","season":"","suggested_name":"Liverpool 2018–2020",
   "formation":"4-3-3","possession":65,"pressing":85,"tempo":80,"defensive_line":80,"attacking_width":75,"risk_taking":70,
   "build_up":"mixed","transition":"counter_press","defensive_block":"high",
   "player_role_priorities":{"GK":"...", "CB":"...", "FB":"...", "DM":"...", "AM":"...", "WG":"...", "ST":"..."},
   "profile_notes":"Explicación de 100-350 palabras, diferencias y bases tácticas",
   "success_tier":"successful","results_summary":"Resultados contextualizados y documentados",
   "verified_honours":[{"competition":"Nombre exacto","season":"2019/2020","source_url":"https://fuente-verificada"}],
   "main_changes":"Qué cambió respecto al modelo previo",
   "source_urls":["https://url-real"]
  }
 ],
 "best_supported_model_id":"codigo_unico_estable o null",
 "comparative_reason":"Comparación justificada entre los modelos y sus resultados, sin falsa precisión",
 "general_philosophy":{
   "profile_scope":"general","suggested_name":"Filosofía general","formation":"4-3-3",
   "possession":65,"pressing":80,"tempo":75,"defensive_line":75,"attacking_width":70,"risk_taking":70,
   "build_up":"mixed","transition":"counter_press","defensive_block":"high",
   "player_role_priorities":{"GK":"...", "CB":"...", "FB":"...", "DM":"...", "AM":"...", "WG":"...", "ST":"..."},
   "profile_notes":"Principios transversales y diferencias históricas",
   "source_urls":["https://url-real"]
 }
}
Si no hay evidencia suficiente, utiliza {"format":"mf_legacy_manager_career_dna_v1","identifiable":false,"confidence":"low","reason":"Motivo verificable","models":[]}. Evita modelos falsamente precisos: no fuerces seis modelos. Separa fuentes de interpretaciones. El resultado es un BORRADOR que debe revisar el usuario antes de guardar.`;
}

export function unwrapCareerJSON(result){
  let value=result;
  if(value && typeof value==="object" && !Array.isArray(value))
    value=value.response??value.result??value.text??value;
  if(value && typeof value==="object" && !Array.isArray(value))return value;
  if(typeof value!=="string")throw Error("La respuesta no contiene un JSON válido.");
  const text=value.trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,"");
  try{return JSON.parse(text);}catch{
    const a=text.indexOf("{"),b=text.lastIndexOf("}");
    if(a<0||b<=a)throw Error("No se encontró el JSON de trayectoria.");
    try{return JSON.parse(text.slice(a,b+1));}catch{throw Error("JSON de trayectoria inválido.");}
  }
}

export function parseManagerCareerResponse(input){
  const data=unwrapCareerJSON(input);
  if(data.format!==CAREER_FORMAT)throw Error("El JSON no utiliza el formato de trayectoria Manager DNA. Usa el importador de perfil individual para el JSON antiguo.");
  if(data.identifiable!==true)throw Error(trim(data.reason||"No se pudo identificar el entrenador.",250));
  if(!["high","medium","low"].includes(data.confidence))throw Error("La investigación no indica un nivel de confianza válido.");
  if(!Array.isArray(data.models)||data.models.length<1||data.models.length>6)
    throw Error("Se necesitan entre 1 y 6 evoluciones tácticas verificables.");
  if(!data.general_philosophy||data.general_philosophy.profile_scope!=="general")
    throw Error("Falta la filosofía general independiente de los periodos.");
  const ids=new Set(), identities=new Set();
  const models=data.models.map((model,index)=>{
    const id=trim(model?.model_id,100);
    if(!/^[\w-]{2,100}$/.test(id)||ids.has(id))throw Error("Identificador repetido o inválido en un periodo.");
    ids.add(id);
    if(!["period","season"].includes(model.profile_scope))throw Error("Cada evolución requiere periodo o temporada específicos.");
    const normalized=parseManagerTacticalResponse({...model,identifiable:true,confidence:data.confidence});
    // Also check compatible dates with the canonical saved entity schema.
    const draft=previewManagerTacticalDraft({...PROFILE_BLANK,name:"Modelo principal"},normalized);
    draft.name=trim(model.suggested_name||draft.name,140);
    cleanProfile(draft,"placeholder",normalized.roleText);
    const identity=profileIdentity(draft);
    if(identities.has(identity))throw Error("Dos evoluciones representan el mismo club y periodo.");
    identities.add(identity);
    if(!Object.hasOwn(SUCCESS_TIERS,model.success_tier))throw Error("Falta la clasificación cualitativa de resultados del periodo "+id+".");
    const resultSummary=trim(model.results_summary,1600);
    if(resultSummary.length<20)throw Error("La etapa "+id+" necesita una explicación contextual de sus resultados.");
    const honours=Array.isArray(model.verified_honours)?model.verified_honours.slice(0,20).map(h=>{
      if(!h || typeof h.competition!=="string" || !h.competition.trim() || !h.season || !/^(?:19|20)\d{2}\/20\d{2}$/.test(h.season) || !url(h.source_url))
        throw Error("Un título del periodo "+id+" carece de temporada o URL verificable; elimínalo o completa la evidencia.");
      return {competition:trim(h.competition,180),season:h.season,source_url:h.source_url.trim()};
    }):[];
    const changes=trim(model.main_changes,1200);
    return {id,index,profile:draft,roleText:normalized.roleText,sourceUrls:normalized.sourceUrls,
      successTier:model.success_tier,resultsSummary:resultSummary,honours,changes};
  });
  const generalParsed=parseManagerTacticalResponse({...data.general_philosophy,identifiable:true,confidence:data.confidence});
  const general=previewManagerTacticalDraft({...PROFILE_BLANK,name:"Filosofía general"},generalParsed);
  general.name="Filosofía general"; general.profile_scope="general";
  cleanProfile(general,"placeholder",generalParsed.roleText);
  const bestId=data.best_supported_model_id==null?null:trim(data.best_supported_model_id,100);
  if(bestId && !ids.has(bestId))throw Error("El modelo identificado como más exitoso no aparece en la lista de etapas.");
  const reason=trim(data.comparative_reason,2300);
  if(reason.length<30)throw Error("La comparación histórica necesita una justificación.");
  const modelList=models.sort((a,b)=>String(a.profile.period_start||a.profile.season).localeCompare(String(b.profile.period_start||b.profile.season)));
  return {format:CAREER_FORMAT,confidence:data.confidence,models:modelList,
    general:{id:"general",profile:general,roleText:generalParsed.roleText,sourceUrls:generalParsed.sourceUrls},
    bestId,reason};
}

export function careerToProfilePayload(item,managerId,{defaultProfile=false}={}){
  const payload=cleanProfile({...item.profile,is_default:defaultProfile},managerId,item.roleText);
  const evidence=item.id==="general"?
    "SÍNTESIS DE FILOSOFÍA GENERAL: estimación analítica transversal; no mezcla estadística automática de períodos.":
    "EVALUACIÓN DE RESULTADOS: "+SUCCESS_TIERS[item.successTier]+
    "\nJUSTIFICACIÓN: "+item.resultsSummary+
    "\nEVOLUCIÓN: "+(item.changes||"No documentada.")+
    "\nTÍTULOS CON FUENTE (revisar): "+(item.honours.length?item.honours.map(h=>h.competition+" "+h.season+" "+h.source_url).join("; "):"No aportados.");
  return {...payload,profile_notes:[payload.profile_notes,evidence].filter(Boolean).join("\n\n"),
    career_model_key:item.id,success_tier:item.successTier||"unknown",
    evidence_summary:item.resultsSummary||"",generation_method:"ai_draft_reviewed"};
}
