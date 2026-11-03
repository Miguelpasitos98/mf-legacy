import {deriveRoleRequirements} from "./managerRoleFit.mjs";

/**
 * MANAGER FIT · Deep Fit (experimental).
 * Compare two *different, explicitly labelled* evidence sources:
 *   V4 same-season role activity percentiles + FM26 role-specific attributes.
 * Position suitability and general FM26 style demands are distinct axes.
 *
 * The original V4 score, CA and V2 are NEVER overwritten. An incomplete
 * historical or FM26 role assessment cannot be replaced with guesses/zeros.
 * One known role function must have evidence from BOTH sources.
 */
export const DEEP_FIT_PRESETS={
 balanced:{historical:50,functions:30,style:10,position:10},
 historical:{historical:70,functions:20,style:5,position:5},
 tactical:{historical:35,functions:45,style:15,position:5}
};
export const DEEP_COMPONENT_LABELS={
 historical:"Actividad real por función (V4)",
 functions:"Atributos del rol (FM26)",
 style:"Estilo general del entrenador (FM26)",
 position:"Adecuación a la posición (FM26)"
};
export const FM_ATTRIBUTE_LABELS={
 "mental.anticipacion":"Anticipación","mental.colocacion":"Colocación",
 "mental.decisiones":"Decisiones","mental.concentracion":"Concentración",
 "mental.trabajo_de_equipo":"Trabajo en equipo","mental.sacrificio":"Sacrificio",
 "mental.vision":"Visión","mental.movimiento":"Desmarques","mental.valentia":"Valentía",
 "mental.liderazgo":"Liderazgo","mental.agresividad":"Agresividad",
 "physical.velocidad":"Velocidad","physical.aceleracion":"Aceleración",
 "physical.resistencia":"Resistencia","physical.fuerza":"Fuerza",
 "physical.alcance_de_salto":"Salto",
 "technical.pases":"Pases","technical.tecnica":"Técnica",
 "technical.control":"Control","technical.cabeceo":"Cabeceo",
 "technical.entradas":"Entradas","technical.marcaje":"Marcaje",
 "technical.centros":"Centros","technical.regate":"Regate",
 "technical.remate":"Remate",
 "goalkeeping.reflejos":"Reflejos","goalkeeping.uno_contra_uno":"Uno contra uno",
 "goalkeeping.blocaje":"Blocaje","goalkeeping.saques_de_puerta":"Saques de puerta",
 "goalkeeping.saque_con_la_mano":"Saque con la mano"
};
// Rules are explicit and inspectable; generic/unmeasured text does not
// silently assign an attribute score. Missing attributes remain unavailable.
export const FUNCTION_FM_ATTRIBUTES={
 sweeper_keeper_distribution:["goalkeeping.saques_de_puerta","goalkeeping.saque_con_la_mano","mental.decisiones"],
 goalkeeper_distribution:["goalkeeping.saques_de_puerta","goalkeeping.saque_con_la_mano","mental.decisiones"],
 goalkeeper_stopping:["goalkeeping.reflejos","goalkeeping.uno_contra_uno","goalkeeping.blocaje"],
 ball_playing_defender:["technical.pases","technical.tecnica","mental.decisiones","mental.vision"],
 defensive_stopper:["technical.entradas","technical.marcaje","mental.anticipacion","mental.agresividad"],
 defensive_cover:["mental.colocacion","mental.anticipacion","technical.marcaje","mental.concentracion"],
 aerial_presence:["physical.alcance_de_salto","technical.cabeceo","physical.fuerza"],
 wing_attack:["technical.centros","physical.resistencia","technical.regate","physical.aceleracion"],
 inverted_fullback:["technical.pases","mental.decisiones","technical.control","mental.vision"],
 defensive_fullback:["mental.colocacion","technical.entradas","technical.marcaje","physical.resistencia"],
 fullback_workrate:["physical.resistencia","mental.sacrificio","mental.trabajo_de_equipo"],
 regista:["technical.pases","mental.vision","mental.decisiones","technical.control"],
 shield:["mental.colocacion","technical.entradas","mental.anticipacion","mental.trabajo_de_equipo"],
 pivot_balanced:["mental.decisiones","technical.pases","mental.colocacion","mental.trabajo_de_equipo"],
 high_pressure:["mental.sacrificio","physical.resistencia","mental.trabajo_de_equipo","mental.anticipacion"],
 creative_playmaker:["mental.vision","technical.pases","technical.tecnica","mental.decisiones"],
 box_to_box:["physical.resistencia","mental.sacrificio","mental.movimiento","technical.pases"],
 wing_dribbling:["technical.regate","physical.aceleracion","technical.tecnica","technical.control"],
 inside_forward:["technical.remate","mental.movimiento","physical.aceleracion","technical.regate"],
 wing_tracking:["mental.sacrificio","physical.resistencia","mental.trabajo_de_equipo"],
 wing_direct:["physical.aceleracion","technical.regate","mental.movimiento"],
 false_nine:["mental.vision","technical.control","technical.pases","mental.movimiento"],
 target_man:["physical.fuerza","technical.cabeceo","physical.alcance_de_salto","technical.control"],
 complete_forward:["technical.remate","mental.movimiento","technical.control","mental.anticipacion"],
 finishing:["technical.remate","mental.movimiento","mental.anticipacion","technical.control"],
 progressive_passer_cb:["technical.pases","mental.vision","mental.decisiones"],
 progressive:["technical.pases","mental.vision","technical.tecnica"],
 long_distribution:["technical.pases","mental.vision","mental.decisiones"],
 defensive:["technical.entradas","technical.marcaje","mental.anticipacion","mental.colocacion"],
 passing_possession:["technical.pases","technical.control","mental.decisiones"]
};
const scoreAttribute=(player,key)=>{
 const [family,attribute]=key.split(".");
 const value=player?.stats?.[family]?.[attribute];
 if(value===null||value===undefined||value===""||!Number.isFinite(Number(value))||
    Number(value)<1||Number(value)>20)return null;
 return Number(value);
};
export function assessCoachFunctionsFM26(player,role,profile){
 const requirements=deriveRoleRequirements(profile,role);
 const families=requirements.matched.map(rule=>{
  const keys=FUNCTION_FM_ATTRIBUTES[rule.id]||[];
  const evidence=keys.map(key=>({key,label:FM_ATTRIBUTE_LABELS[key]||key,
   raw:scoreAttribute(player,key)}));
  const observed=evidence.filter(x=>x.raw!==null);
  // 2+ measured FM26 abilities and >= half of requested for each function.
  const sufficient=observed.length>=2&&observed.length>=Math.ceil(keys.length/2);
  const score=sufficient?Math.round(observed.reduce((sum,x)=>sum+x.raw,0)/observed.length/20*100):null;
  return {id:rule.id,label:rule.label,score,evidence,
   found:observed.length,requested:keys.length,measurable:keys.length>0};
 });
 const valid=families.filter(x=>x.score!==null);
 const requested=families.reduce((sum,x)=>sum+x.requested,0);
 const found=families.reduce((sum,x)=>sum+x.found,0);
 const score=valid.length?Math.round(valid.reduce((sum,x)=>sum+x.score,0)/valid.length):null;
 return {score,families,validFunctions:valid.length,requestedFunctions:families.length,
  coverage:requested?Math.round(found/requested*100):0,
  unmeasuredTraits:requirements.unmeasuredTraits};
}
export function normalizeDeepWeights(value=DEEP_FIT_PRESETS.balanced){
 const keys=Object.keys(DEEP_FIT_PRESETS.balanced);
 const result={};
 for(const key of keys){
  const number=Number(value?.[key]);
  result[key]=Number.isFinite(number)?Math.max(0,Math.min(100,number)):0;
 }
 const sum=keys.reduce((a,k)=>a+result[k],0);
 return sum>0?Object.fromEntries(keys.map(key=>[key,result[key]/sum])):null;
}
export function evaluateDeepFit({
 player,role,profile,roleFit,advanced,weights=DEEP_FIT_PRESETS.balanced,season=""
}={}){
 const functions=assessCoachFunctionsFM26(player,role,profile);
 const historicalScore=roleFit?.score??null;
 const positionScore=advanced?.position??null;
 const styleScore=advanced?.styleDimensions?.length?advanced?.style??null:null;
 const components=[
  {key:"historical",score:historicalScore,source:"Datos reales de "+season},
  {key:"functions",score:functions.score,source:"Atributos FM26 (videojuego)"},
  {key:"style",score:styleScore,source:"Atributos FM26 (videojuego)"},
  {key:"position",score:positionScore,source:"Adecuación posicional FM26"}
 ];
 const weightsUsed=normalizeDeepWeights(weights);
 const sharedFamilies=functions.families.filter(x=>x.score!==null&&
    roleFit?.requirementBreakdown?.some(r=>r.id===x.id&&r.score!==null));
 const prerequisites=historicalScore!==null&&functions.score!==null&&
   positionScore!==null&&positionScore>=60&&sharedFamilies.length>0;
 // No V4 source, no FM function or no overlap means no blended rating.
 const available=components.filter(x=>x.score!==null&&weightsUsed?.[x.key]>0);
 const weightSum=available.reduce((sum,x)=>sum+(weightsUsed?.[x.key]||0),0);
 const score=prerequisites&&weightSum>0&&weightsUsed?.historical>0&&weightsUsed?.functions>0?
   Math.round(available.reduce((sum,x)=>sum+x.score*weightsUsed[x.key],0)/weightSum):null;
 const disagreement=historicalScore!==null&&functions.score!==null?
   Math.abs(historicalScore-functions.score):null;
 const confidence=score===null?"insufficient":
  roleFit?.confidence==="medium"&&functions.coverage>=75&&disagreement<=25&&sharedFamilies.length>=2?"medium":"low";
 const missing=[
  historicalScore===null?"No hay suficiente rendimiento histórico V4 de la temporada seleccionada.":null,
  functions.score===null?"No hay atributos FM26 suficientes vinculados explícitamente a las funciones del ADN.":null,
  !sharedFamilies.length?"No hay ninguna función táctica evaluable en las dos fuentes.":null,
  positionScore===null||positionScore<60?"Posición FM26 incompatible o sin evidencia suficiente.":null,
  !weightsUsed||weightsUsed.historical<=0||weightsUsed.functions<=0?
   "Los pesos de datos reales y atributos de funciones deben ser mayores de cero.":null
 ].filter(Boolean);
 const caution=[
  disagreement!==null&&disagreement>25?"Las señales históricas y los atributos FM26 difieren más de 25 puntos; revisar cada fuente.":null,
  roleFit?.confidence==="low"?"Confianza limitada de la muestra estadística V4.":null,
  styleScore===null?"Sin factor de estilo FM26 medible; su peso no se imputa.":null,
  functions.unmeasuredTraits.length?"Hay rasgos solicitados por el entrenador sin medida histórica directa.":null
 ].filter(Boolean);
 return {score,confidence,functions,sharedFunctions:sharedFamilies.map(x=>x.id),
  components:components.map(x=>({...x,weight:weightsUsed?.[x.key]??0,
    effectiveWeight:score!==null&&x.score!==null&&weightSum>0?
      Math.round(100*(weightsUsed?.[x.key]||0)/weightSum):0})),
  disagreement,missing,caution,
  explanation:score===null?"No se genera una nota combinada sin evidencia histórica y del videojuego para al menos una misma función del ADN.":
   "Índice experimental de ajuste: combina percentiles históricos V4, atributos tácticos FM26, estilo y posición. No es una predicción de rendimiento ni un cálculo del CA."};
}
