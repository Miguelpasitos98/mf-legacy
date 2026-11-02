import {roleCompatibility,validCA} from "./managerFit.mjs";
const ROLE_ATTRIBUTES={
 GK:[["goalkeeping","reflejos"],["goalkeeping","uno_contra_uno"],["mental","decisiones"]],
 CB:[["mental","anticipacion"],["mental","colocacion"],["technical","pases"],["physical","velocidad"]],
 FB:[["physical","resistencia"],["physical","velocidad"],["technical","centros"],["technical","pases"]],
 DM:[["mental","decisiones"],["mental","colocacion"],["technical","pases"],["mental","trabajo_de_equipo"]],
 AM:[["mental","vision"],["technical","pases"],["technical","tecnica"],["mental","decisiones"]],
 WG:[["physical","aceleracion"],["physical","velocidad"],["technical","regate"],["technical","centros"]],
 ST:[["mental","movimiento"],["technical","remate"],["mental","anticipacion"],["physical","aceleracion"]]
};
const STYLE_ATTRIBUTES={
 pressing:[["mental","sacrificio"],["mental","trabajo_de_equipo"],["physical","resistencia"]],
 possession:[["technical","pases"],["technical","control"],["mental","decisiones"]],
 tempo:[["physical","aceleracion"],["physical","velocidad"],["mental","movimiento"]],
 defensive_line:[["physical","velocidad"],["mental","anticipacion"]],
 attacking_width:[["technical","centros"],["physical","resistencia"]],
 risk_taking:[["technical","tecnica"],["mental","vision"],["technical","regate"]]
};
const val=(player,[family,key])=>{
 const n=player?.stats?.[family]?.[key];
 return n!==null&&n!==undefined&&n!==""&&Number.isFinite(Number(n))&&Number(n)>=1&&Number(n)<=20?Number(n):null;
};
const average=(player,pairs)=>{
 const observed=pairs.map(k=>val(player,k)).filter(v=>v!==null);
 return {score:observed.length?Math.round(observed.reduce((a,b)=>a+b,0)/observed.length/20*100):null,found:observed.length,total:pairs.length};
};
export function managerFitAttributes(player,role,profile){
 const position=roleCompatibility(player,role);
 const base=average(player,ROLE_ATTRIBUTES[role]||[]);
 const styleKeys=Object.keys(STYLE_ATTRIBUTES).filter(k=>Number.isFinite(Number(profile?.[k]))&&Number(profile[k])>=65);
 const stylePairs=[...new Set(styleKeys.flatMap(k=>STYLE_ATTRIBUTES[k].map(pair=>pair.join("."))))].map(key=>key.split("."));
 const style=average(player,stylePairs);
 const coverage={found:base.found+style.found,total:base.total+style.total};
 // Never claim to measure a tactical requirement from free-form prose.
 const elements=[{key:"position",value:position.fit,weight:0.4},{key:"attributes",value:base.score,weight:0.35},{key:"style",value:style.score,weight:0.25}].filter(x=>x.value!==null);
 const score=elements.length&&position.fit!==null&&base.found>=2?
  Math.round(elements.reduce((sum,x)=>sum+x.value*x.weight,0)/elements.reduce((sum,x)=>sum+x.weight,0)):null;
 return {
  score,position:position.fit,attributes:base.score,style:style.score,
  quality:validCA(player?.ca),
  coverage:coverage.total?Math.round(coverage.found/coverage.total*100):0,
  styleDimensions:styleKeys,
  confidence:score===null?"insufficient":coverage.found>=Math.ceil(coverage.total*.75)&&position.rating!==null?"medium":"low",
  explanation:score===null?"No hay atributos FM26 suficientes para valorar el ajuste; se mantiene la adecuación posicional por separado.":"Estimación basada en posición, atributos FM26 disponibles y exigencias generales del ADN. No incluye estadísticas históricas ni entiende aún el texto libre de los roles."
 };
}
