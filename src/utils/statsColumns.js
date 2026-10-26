// Calculadora segura y configurable para columnas de STATS: nunca ejecuta JavaScript del usuario.
import {metricsValue,statNum} from "./statsViews.js";
import {statDisplay} from "./statsSeason.js";
import {alignedFormulaInputs} from "./statsAligned.js";
export const MODES=["season","competition"];
export const CATEGORIES=["Resumen","Ataque","Creación","Defensa","Portería","Físico"];
export const RAW_METRICS=[
 ["appearances","Partidos"],["minutes","Minutos"],["rating","Nota FotMob"],["team_matches","PJ del equipo"],
 ["goals","Goles"],["assists","Asistencias"],["xg","xG"],["xa","xA"],["xgot","xGOT"],
 ["shots","Tiros"],["shotsontarget","Tiros a puerta"],["tackles","Entradas"],
 ["recoveries","Recuperaciones"],["interceptions","Intercepciones"],["clearances","Despejes"],
 ["cleansheets","Porterías a cero"],["chancescreated","Oportunidades creadas"],
 ["bigchancescreated","Ocasiones claras"],["accuratepasses","Pases precisos"],
 ["successfulcrosses","Centros precisos"],["saves","Paradas"],["numberofsprints","Sprints"],
 ["totaldistancecovered","Distancia (m)"],["goalsconcededwhileonpitch","Goles encajados en campo"],
 ["xgexclpenalty","xG sin penaltis"],["headedshots","Tiros de cabeza"],["topspeed","Velocidad máxima"],
 ["walking","Distancia andando"],["jogging","Distancia trotando"],["running","Distancia corriendo"],["sprinting","Distancia al sprint"],
 ["passaccuracy","Precisión de pases (%)"],["accuratelongballs","Pases largos precisos"],["longballaccuracy","Precisión de pases largos (%)"],
 ["linebreakingpasses","Pases que rompen líneas"],["crossaccuracy","Precisión de centros (%)"],["dribbles","Regates exitosos"],
 ["dribblessuccessrate","Éxito en regates (%)"],["duelswon","Duelos ganados"],["duelswonvariante2","Éxito en duelos (%)"],
 ["aerialswon","Duelos aéreos ganados"],["aerialswonvariante2","Éxito en duelos aéreos (%)"],
 ["touches","Toques"],["touchesinoppositionbox","Toques en área rival"],["dispossessed","Pérdidas de balón"],
 ["foulswon","Faltas recibidas"],["foulscommitted","Faltas cometidas"],["defensiveactions","Acciones defensivas"],
 ["blockedscoringattempt","Tiros bloqueados"],["possessionwonfinal3rd","Recuperaciones en campo rival"],["dribbledpast","Regateado"],
 ["xgagainstwhileonpitch","xG encajado en campo"],["yellowcards","Tarjetas amarillas"],["redcards","Tarjetas rojas"],
 ["penaltygoals","Goles de penalti"],["penaltiesawarded","Penaltis provocados"],["started","Titularidades"],
 ["xgchain","xG Chain (total Understat)"],["xgbuildup","xG Buildup (total Understat)"],["understatminutes","Minutos Understat"],
 ["goals_prevented","Goles evitados (FotMob)"],["psxgot_against","PSxG a puerta recibido"],["goals_conceded_from_shots","Goles encajados por disparos"],
 ["groundduelswon","Duelos terrestres ganados"],["groundduelscontested","Duelos terrestres disputados"]
];
export const COMPUTED=[
 {id:"ga",name:"Goles + asistencias",formula:"goals + assists",decimals:0},
 {id:"xga",name:"xG + xA",formula:"xg + xa",decimals:2},
 {id:"goalsper90",name:"Goles /90",formula:"goals * 90 / minutes",decimals:2},
 {id:"assistsper90",name:"Asistencias /90",formula:"assists * 90 / minutes",decimals:2},
 {id:"gaper90",name:"G+A /90",formula:"(goals + assists) * 90 / minutes",decimals:2},
 {id:"xgper90",name:"xG /90",formula:"xg * 90 / minutes",decimals:2},
 {id:"xaper90",name:"xA /90",formula:"xa * 90 / minutes",decimals:2},
 {id:"xgaper90",name:"xG+xA /90",formula:"(xg + xa) * 90 / minutes",decimals:2},
 {id:"playpct",name:"Play %",formula:"minutes / (team_matches * 90) * 100",decimals:1},
 {id:"calc_xgchainper90",name:"xG Chain /90 (Understat)",formula:"xgchain * 90 / understatminutes",decimals:2},
 {id:"calc_xgbuildupper90",name:"xG Buildup /90 (Understat)",formula:"xgbuildup * 90 / understatminutes",decimals:2},
 {id:"calc_goals_prevented",name:"Goles evitados",formula:"psxgot_against - goals_conceded_from_shots",decimals:2},
 {id:"calc_goals_prevented_p90",name:"Goles evitados /90",formula:"(psxgot_against - goals_conceded_from_shots) * 90 / minutes",decimals:2},
 {id:"calc_groundduelspct",name:"Duelos terrestres ganados (%)",formula:"groundduelswon * 100 / groundduelscontested",decimals:2}
];
export const RAW_IDS=new Set(RAW_METRICS.map(x=>x[0]));
export const COMPUTED_IDS=new Set(COMPUTED.map(x=>x.id));
export const DEFAULT_COLS={
 season:{
 Resumen:["goals","assists","xg","xa","gaper90","xgaper90","playpct"],
 Ataque:["goals","assists","ga","goalsper90","assistsper90","gaper90","xg","xa","xgper90","xaper90","xgaper90","shots","shotsontarget"],
 Creación:["chancescreated","bigchancescreated","accuratepasses","successfulcrosses","xa","xaper90","calc_xgchainper90","calc_xgbuildupper90"],
 Defensa:["tackles","interceptions","recoveries","clearances","cleansheets","calc_groundduelspct"],
 Portería:["saves","cleansheets","goalsconcededwhileonpitch","calc_goals_prevented","calc_goals_prevented_p90"],
 Físico:["totaldistancecovered","numberofsprints"]
 },
 competition:{
 Resumen:["goals","assists","xg","xa","shots","shotsontarget","playpct"],
 Ataque:["goals","assists","xg","xa","xgot","shots","shotsontarget","bigchancescreated"],
 Creación:["accuratepasses","chancescreated","bigchancescreated","xa","successfulcrosses","calc_xgchainper90","calc_xgbuildupper90"],
 Defensa:["tackles","interceptions","recoveries","clearances","calc_groundduelspct"],
 Portería:["saves","cleansheets","goalsconcededwhileonpitch","calc_goals_prevented","calc_goals_prevented_p90"],
 Físico:["totaldistancecovered","numberofsprints"]
 }
};
export const initialConfig=()=>({version:3,columns:structuredClone(DEFAULT_COLS),dividers:{season:{},competition:{}},computed:COMPUTED.map(x=>({...x})),labels:{}});
export function sanitizeConfig(data){
 const value=data&&typeof data==="object"?data:{};
 const formulas=Array.isArray(value.computed)?value.computed:COMPUTED;
 const computed=[];
 for(const d of formulas.slice(0,80)){
  if(!d||typeof d!=="object"||typeof d.id!=="string"||!/^(?:calc_[a-z0-9_]+|ga|xga|goalsper90|assistsper90|gaper90|xgper90|xaper90|xgaper90|playpct)$/.test(d.id))continue;
  if(typeof d.name!=="string"||!d.name.trim()||d.name.length>60||typeof d.formula!=="string")continue;
  try{parseFormula(d.formula);}catch{continue;}
  if(!computed.some(a=>a.id===d.id))computed.push({id:d.id,name:d.name.trim(),formula:d.formula,decimals:Math.min(4,Math.max(0,Number(d.decimals)||0))});
 }
 for(const original of COMPUTED)if(!computed.some(c=>c.id===original.id))computed.push({...original});
 const ids=new Set([...RAW_IDS,...computed.map(c=>c.id)]);
 const columns={};
 for(const mode of MODES){
  columns[mode]={};
  for(const category of CATEGORIES){
   const input=value.columns?.[mode]?.[category];
   const legacyDefault=mode==="season"?["goals","assists","xg","xa","gaper90","xgaper90"]:["goals","assists","xg","xa","shots","shotsontarget"];
   const fromOldDefault=Number(value.version||1)<2&&category==="Resumen"&&Array.isArray(input)&&JSON.stringify(input)===JSON.stringify(legacyDefault);
   columns[mode][category]=Array.isArray(input)?[...new Set(input.filter(k=>typeof k==="string"&&ids.has(k)))].slice(0,30):[...DEFAULT_COLS[mode][category]];
   if(fromOldDefault&&!columns[mode][category].includes("playpct"))columns[mode][category].push("playpct");
   if(category==="Portería")for(const id of ["calc_goals_prevented","calc_goals_prevented_p90"])if(!columns[mode][category].includes(id))columns[mode][category].push(id);
  }
 }
 const dividers={season:{},competition:{}};
 for(const mode of MODES)for(const category of CATEGORIES){
  const allowed=new Set([...columns[mode][category],...(mode==="season"?["rank","player","season","club","appearances","minutes","rating"]:["rank","player","season","competition","season_competition","club","appearances","minutes","team_matches","rating"])]);
  dividers[mode][category]=[...new Set((Array.isArray(value.dividers?.[mode]?.[category])?value.dividers[mode][category]:[]).filter(id=>typeof id==="string"&&allowed.has(id)))];
 }
 const labels={};
 if(value.labels&&typeof value.labels==="object")for(const [key,display] of Object.entries(value.labels)){
  if(RAW_IDS.has(key)&&typeof display==="string"&&display.trim().length&&display.length<=60)labels[key]=display.trim();
 }
 return {version:3,columns,dividers,computed,labels};
}
export function parseFormula(expression){
 const input=String(expression||"").trim();
 if(!input||input.length>220)throw Error("La fórmula debe tener entre 1 y 220 caracteres.");
 const matches=input.match(/(?:\d+(?:\.\d+)?|\.\d+|[a-zA-Z][a-zA-Z0-9_]*|[()+\-*/])/g)||[];
 if(matches.join("")!==input.replace(/\s+/g,""))throw Error("Solo se permiten nombres de métricas, números, paréntesis y + - * /.");
 const allowed=new Set(RAW_IDS);
 let i=0,nodes=0;
 const primary=()=>{
  if(++nodes>120)throw Error("Fórmula demasiado compleja.");
  const token=matches[i++];
  if(token==="("){const sub=expr();if(matches[i++]!==")")throw Error("Falta cerrar un paréntesis.");return sub;}
  if(token==="+"||token==="-")return {type:"unary",op:token,child:primary()};
  if(token&&/^(?:\d|\.)/.test(token)){const n=Number(token);if(!Number.isFinite(n))throw Error("Número no válido.");return {type:"number",value:n};}
  if(token&&/^[a-zA-Z]/.test(token)){if(!allowed.has(token))throw Error("Métrica desconocida: "+token);return {type:"variable",name:token};}
  throw Error("Fórmula incompleta.");
 };
 const product=()=>{let left=primary();while(matches[i]==="*"||matches[i]==="/"){const op=matches[i++];left={type:"operation",op,left,right:primary()};}return left;};
 const expr=()=>{let left=product();while(matches[i]==="+"||matches[i]==="-"){const op=matches[i++];left={type:"operation",op,left,right:product()};}return left;};
 const tree=expr();
 if(i!==matches.length)throw Error("La fórmula contiene elementos adicionales.");
 return tree;
}
export function evalFormula(ast,values){
 const walk=(node,depth)=>{
  if(depth>80)return null;
  if(node.type==="number")return node.value;
  if(node.type==="variable"){const v=values[node.name];return v===null||v===undefined||!Number.isFinite(Number(v))?null:Number(v);}
  if(node.type==="unary"){const v=walk(node.child,depth+1);return v===null?null:node.op==="-"?-v:v;}
  const a=walk(node.left,depth+1),b=walk(node.right,depth+1);
  if(a===null||b===null||node.op==="/"&&b===0)return null;
  const v=node.op==="+"?a+b:node.op==="-"?a-b:node.op==="*"?a*b:a/b;
  return Number.isFinite(v)&&Math.abs(v)<1e12?v:null;
 };
 return walk(ast,0);
}
export function getColumn(config,id){
 const def=config.computed.find(d=>d.id===id);
 const raw=RAW_METRICS.find(([key])=>key===id);
 return def?{...def,kind:"computed",unit:["playpct","calc_groundduelspct"].includes(id)?"%":""}:raw?{id,name:config.labels[id]||raw[1],decimals:["rating","xg","xa","xgot","xgexclpenalty","xgagainstwhileonpitch","psxgot_against"].includes(id)?2:["topspeed","passaccuracy","longballaccuracy","crossaccuracy","dribblessuccessrate","duelswonvariante2","aerialswonvariante2"].includes(id)?1:0,kind:"raw"}:null;
}
export const rowValues=(row,mode)=>{
 const values={};
 for(const [id] of RAW_METRICS){
  if(mode==="season"){
   const stat=row?.totals?.[id];
   // A formula using an incomplete aggregated metric must not assert a valid ratio.
   values[id]=id==="rating"?row?.ratingPartial?null:row?.weightedRating:stat?.partial?null:stat?.value??null;
  }else values[id]=id==="minutes"?statNum(row.minutes):metricsValue(row,id);
 }
 return values;
};
export function formulaCoverage(row,mode,id,config){
 if(mode!=="season"||!Array.isArray(row?.records))return null;
 const def=config.computed.find(d=>d.id===id);
 if(!def)return null;
 try{
  const vars=[...new Set(def.formula.match(/[a-zA-Z][a-zA-Z0-9_]*/g)||[])];
  return alignedFormulaInputs(row.records,vars);
 }catch{return null;}
}
export function columnValue(row,mode,id,config){
 if(!row)return null;
 const definition=config.computed.find(d=>d.id===id);
 if(definition){try{
  // The default GK calculations use the provider-supplied Goals prevented
  // before trying the PSxGOT reconstruction. Custom formulas are untouched.
  const isDefaultGK=["calc_goals_prevented","calc_goals_prevented_p90"].includes(id)
   &&definition.formula===COMPUTED.find(d=>d.id===id)?.formula;
  if(isDefaultGK){
   const p90=id==="calc_goals_prevented_p90";
   if(mode==="season"&&Array.isArray(row.records)){
    const direct=alignedFormulaInputs(row.records,p90?["goals_prevented","minutes"]:["goals_prevented"]);
    if(direct.available&&(!p90||direct.totals.minutes>0))
     return p90?direct.totals.goals_prevented*90/direct.totals.minutes:direct.totals.goals_prevented;
   }else{
    const direct=metricsValue(row,"goals_prevented"),minutes=statNum(row.minutes);
    if(direct!==null&&(!p90||minutes>0))return p90?direct*90/minutes:direct;
   }
  }
  const ast=parseFormula(definition.formula);
  if(mode==="season"&&Array.isArray(row.records)){
   const vars=[...new Set((definition.formula.match(/[a-zA-Z][a-zA-Z0-9_]*/g)||[]))];
   const aligned=alignedFormulaInputs(row.records,vars);
   if(!aligned.available)return null;
   // Cada variable procede exactamente de las mismas competiciones.
   return evalFormula(ast,aligned.totals);
  }
  return evalFormula(ast,rowValues(row,mode));
 }catch{return null;}}
 return mode==="season"?statDisplay(row,id):metricsValue(row,id);
}
