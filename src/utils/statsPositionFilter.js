// STATS visual filters: legacy MF Legacy positions and FIFA card positions
// map to the same functional groups WITHOUT modifying historical season data.
// The precise historical position still determines the Composite archetype.
import {normalizeHistoricalPosition} from "./historicalPositions.js";

const codes={
  goalkeepers:["GK","POR"],
  centralDefenders:["DFC","CB","DCB","DLC","DRC"],
  fullbacksLeft:["LI","LB","DL","LFB"],
  fullbacksRight:["LD","RB","DR","RFB"],
  fullbacksGeneric:["FB"],
  wingbacksLeft:["CRI","LWB","WBL"],
  wingbacksRight:["CRD","RWB","WBR"],
  wingbacksGeneric:["WB"],
  pivots:["CDM","DM","MCD","DMC"],
  centralMidfield:["CM","MC"],
  attackingMidfield:["CAM","AM","MCO","AMC"],
  wingersLeft:["EI","LW","LM","AML","ML"],
  wingersRight:["ED","RW","RM","AMR","MR"],
  wingersGeneric:["W"],
  forwards:["DC","ST","CF","STC","FW"]
};
const positions=Object.fromEntries(Object.entries(codes).map(([key,values])=>[key,new Set(values)]));
const matches=(value,...keys)=>keys.some(key=>positions[key].has(value));
const effectivePositionCode=raw=>{
 const value=String(raw??"").trim();
 // FM's "D (C)" means centre-back, while MF Legacy "DC" means striker.
 // Preserve the parenthesized shorthand before normalizing punctuation.
 if(/^D\s*\(\s*C\s*\)$/i.test(value))return "DFC";
 return normalizeHistoricalPosition(value);
};

export const STATS_POSITION_FILTER_OPTIONS=[
 {group:"Grupos principales",value:"grupo:gk",label:"Porteros"},
 {group:"Grupos principales",value:"grupo:def",label:"Defensas"},
 {group:"Grupos principales",value:"grupo:mid",label:"Centrocampistas"},
 {group:"Grupos principales",value:"grupo:att",label:"Atacantes"},
 {group:"Grupos principales",value:"grupo:wing",label:"Extremos (ambas bandas)"},
 {group:"Posiciones unificadas",value:"grupo:cb",label:"Centrales"},
 {group:"Posiciones unificadas",value:"grupo:fb",label:"Laterales"},
 {group:"Posiciones unificadas",value:"grupo:wb",label:"Carrileros"},
 {group:"Posiciones unificadas",value:"grupo:dm",label:"Pivotes defensivos"},
 {group:"Posiciones unificadas",value:"grupo:cm",label:"Mediocentros"},
 {group:"Posiciones unificadas",value:"grupo:cam",label:"Mediapuntas"},
 {group:"Posiciones unificadas",value:"grupo:st",label:"Delanteros"},
 {group:"Por banda",value:"grupo:wing:left",label:"Extremos izquierdos"},
 {group:"Por banda",value:"grupo:wing:right",label:"Extremos derechos"},
 {group:"Por banda",value:"grupo:fb:left",label:"Laterales izquierdos"},
 {group:"Por banda",value:"grupo:fb:right",label:"Laterales derechos"},
 {group:"Por banda",value:"grupo:wb:left",label:"Carrileros izquierdos"},
 {group:"Por banda",value:"grupo:wb:right",label:"Carrileros derechos"}
];

const supported=new Set(STATS_POSITION_FILTER_OPTIONS.map(o=>o.value));

export function matchesStatsPosition(rawPosition,filter="Todas"){
 if(!filter||filter==="Todas")return true;
 const value=effectivePositionCode(rawPosition);
 if(!value)return false;
 switch(filter){
 case "grupo:gk":return matches(value,"goalkeepers");
 case "grupo:def":return matches(value,"centralDefenders","fullbacksLeft","fullbacksRight","fullbacksGeneric","wingbacksLeft","wingbacksRight","wingbacksGeneric");
 case "grupo:mid":return matches(value,"pivots","centralMidfield","wingersLeft","wingersRight")&&
   (!matches(value,"wingersLeft","wingersRight")||["LM","RM","ML","MR"].includes(value));
 case "grupo:att":return matches(value,"attackingMidfield","wingersLeft","wingersRight","wingersGeneric","forwards")&&
   !["LM","RM","ML","MR"].includes(value);
 case "grupo:cb":return matches(value,"centralDefenders");
 case "grupo:fb":return matches(value,"fullbacksLeft","fullbacksRight","fullbacksGeneric");
 case "grupo:wb":return matches(value,"wingbacksLeft","wingbacksRight","wingbacksGeneric");
 case "grupo:dm":return matches(value,"pivots");
 case "grupo:cm":return matches(value,"centralMidfield");
 case "grupo:cam":return matches(value,"attackingMidfield");
 case "grupo:wing":return matches(value,"wingersLeft","wingersRight","wingersGeneric");
 case "grupo:wing:left":return matches(value,"wingersLeft");
 case "grupo:wing:right":return matches(value,"wingersRight");
 case "grupo:st":return matches(value,"forwards");
 case "grupo:fb:left":return matches(value,"fullbacksLeft");
 case "grupo:fb:right":return matches(value,"fullbacksRight");
 case "grupo:wb:left":return matches(value,"wingbacksLeft");
 case "grupo:wb:right":return matches(value,"wingbacksRight");
 default:return false;
 }
}

// Upgrade older saved raw-code filters to equivalent unified positions.
// A previously saved RW filter remains RIGHT-wing, not every winger.
export function migrateStatsPositionFilter(value){
 if(!value||value==="Todas")return "Todas";
 if(supported.has(value))return value;
 const code=effectivePositionCode(value);
 for(const [keys,target] of [
  [["goalkeepers"],"grupo:gk"],
  [["centralDefenders"],"grupo:cb"],
  [["fullbacksLeft"],"grupo:fb:left"],[["fullbacksRight"],"grupo:fb:right"],
  [["fullbacksGeneric"],"grupo:fb"],
  [["wingbacksLeft"],"grupo:wb:left"],[["wingbacksRight"],"grupo:wb:right"],
  [["wingbacksGeneric"],"grupo:wb"],
  [["pivots"],"grupo:dm"],[["centralMidfield"],"grupo:cm"],
  [["attackingMidfield"],"grupo:cam"],
  [["wingersLeft"],"grupo:wing:left"],[["wingersRight"],"grupo:wing:right"],
  [["wingersGeneric"],"grupo:wing"],
  [["forwards"],"grupo:st"]
 ]){
  if(matches(code,...keys))return target;
 }
 return "Todas";
}
