// Métricas y etiquetas de la vista detallada de comparación.
// Solo presentación: los valores salen siempre de los resúmenes de temporada
// ya calculados, con las mismas fórmulas y coberturas que la tabla de STATS.
import {getColumn} from "./statsColumns.js";
import {metricLabel} from "./statsImport.js";
import {statDisplay} from "./statsSeason.js";

export const COMPARE_GROUPS=[
 {title:"Volumen y participación",keys:["appearances","minutes","rating"]},
 {title:"Ataque",keys:["goals","assists","ga","goalsper90","assistsper90","gaper90","xg","xa","xga","xgper90","xaper90","xgaper90","shots","shotsontarget"]},
 {title:"Creación",keys:["chancescreated","bigchancescreated","accuratepasses","successfulcrosses"]},
 {title:"Defensa",keys:["tackles","interceptions","recoveries","clearances","cleansheets"]},
 {title:"Portería",keys:["saves","goalsconcededwhileonpitch"]}
];

const LABELS={
 appearances:"Partidos jugados",minutes:"Minutos",rating:"Nota media (ponderada por partidos)",
 goals:"Goles",assists:"Asistencias",ga:"Goles + asistencias",
 goalsper90:"Goles /90",assistsper90:"Asistencias /90",gaper90:"G + A /90",
 xg:"xG",xa:"xA",xga:"xG + xA",xgper90:"xG /90",xaper90:"xA /90",xgaper90:"xG + xA /90",
 shots:"Tiros",shotsontarget:"Tiros a puerta",
 chancescreated:"Ocasiones creadas",bigchancescreated:"Grandes ocasiones creadas",
 accuratepasses:"Pases precisos",successfulcrosses:"Centros con éxito",
 tackles:"Entradas",interceptions:"Intercepciones",recoveries:"Recuperaciones",
 clearances:"Despejes",cleansheets:"Porterías a cero",
 saves:"Paradas",goalsconcededwhileonpitch:"Goles encajados en campo"
};

// En estos indicadores el valor más bajo es el mejor de la fila.
export const COMPARE_LOWER_IS_BETTER=new Set(["goalsconcededwhileonpitch"]);
const DECIMAL_KEYS=new Set(["rating","xg","xa","xga","goalsper90","assistsper90","gaper90","xgper90","xaper90","xgaper90"]);

export const compareLabel=(config,key)=>getColumn(config,key)?.name||LABELS[key]||metricLabel(key);
export const compareDecimals=(config,key)=>getColumn(config,key)?.decimals??(DECIMAL_KEYS.has(key)?2:0);
export const compareUnit=(config,key)=>getColumn(config,key)?.unit||"";
export const compareValue=(summary,key)=>summary?statDisplay(summary,key):null;

// Mejor valor de la fila: solo se destaca cuando hay al menos dos cifras reales.
export function compareBest(summaries,key){
 const values=(summaries||[]).map(s=>compareValue(s,key)).filter(v=>v!==null&&v!==undefined&&Number.isFinite(Number(v)));
 if(values.length<2)return null;
 return COMPARE_LOWER_IS_BETTER.has(key)?Math.min(...values):Math.max(...values);
}

export const compareFormat=(value,decimals=0)=>value===null||value===undefined||value===""||!Number.isFinite(Number(value))?"—":Number(value).toLocaleString("es-ES",{minimumFractionDigits:decimals,maximumFractionDigits:decimals});

export const shortSeason=value=>String(value||"").replace(/^(\d{4})[/-](\d{4})$/,(_,start,end)=>start+"/"+end.slice(-2));