import {HIST_ROLE_METRICS} from "./managerFitHistorical.mjs";

// Conservative dictionary of explicitly observable proxies. A term is matched
// as a whole phrase, never as arbitrary substrings, and only within its role.
const RULES=[
 {id:"high_pressure",label:"Presión y recuperación alta",terms:["presion alta","presion tras perdida","presionar","presionante","recuperacion alta","recuperar arriba","gegenpressing"],metrics:["pressure","defense"],roles:["ST","WG","AM","DM","FB","CB"]},
 {id:"build_up",label:"Participación en construcción",terms:["construccion","salida de balon","juego asociativo","juego de pies","circulacion","combinativo","iniciar juego"],metrics:["buildup","passing","chain"],roles:["GK","CB","FB","DM","AM"]},
 {id:"progressive",label:"Contribución a la progresión",terms:["progresivo","progresion","superar lineas","romper lineas","pases verticales"],metrics:["chain","longPassing","buildup"],roles:["CB","FB","DM","AM","WG"]},
 {id:"wing_attack",label:"Producción ofensiva por banda",terms:["lateral profundo","profundidad","incorporaciones","proyectarse","subidas","ataque por banda","centros","carril ofensivo"],metrics:["xa","chain","dribbles"],roles:["FB","WG"]},
 {id:"creation",label:"Creación de oportunidades",terms:["creatividad","creativo","vision","ultimo pase","asistencias","crear ocasiones","generador de juego"],metrics:["xa","creation","chain"],roles:["AM","WG","DM","FB"]},
 {id:"dribbling",label:"Desborde",terms:["desborde","regate","uno contra uno","desequilibrio"],metrics:["dribbles","xa"],roles:["WG","AM","FB"]},
 {id:"finishing",label:"Finalización y amenaza",terms:["rematador","finalizacion","goleador","atacar el area","desmarque","definicion"],metrics:["xg","shot"],roles:["ST","WG","AM"]},
 {id:"long_distribution",label:"Distribución larga",terms:["desplazamiento largo","pase largo","juego directo","cambio de orientacion"],metrics:["longPassing","passing"],roles:["GK","CB","DM"]},
 {id:"defensive",label:"Acciones defensivas",terms:["solidez defensiva","anticipacion","recuperaciones","defender","marcaje","duelos defensivos"],metrics:["defense","pressure"],roles:["CB","FB","DM"]}
];
const normalize=text=>String(text||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const contains=(text,term)=>(" "+text+" ").includes(" "+normalize(term)+" ");
export function deriveRoleRequirements(profile,role){
 let raw="";
 try{const parsed=typeof profile?.player_role_priorities==="string"?JSON.parse(profile.player_role_priorities):profile?.player_role_priorities;raw=typeof parsed?.[role]==="string"?parsed[role]:"";}catch{return {text:"",matched:[],unmatched:true};}
 const value=normalize(raw);
 const matched=RULES.filter(rule=>rule.roles.includes(role)&&rule.terms.some(term=>contains(value,term)));
 return {text:raw,matched,unmatched:matched.length===0};
}
export function evaluateRoleRequirements(metrics,peers,role,profile){
 const requirements=deriveRoleRequirements(profile,role);
 const candidates=[...new Set(requirements.matched.flatMap(x=>x.metrics))].filter(k=>(HIST_ROLE_METRICS[role]||[]).includes(k));
 const breakdown=[];
 for(const key of candidates){
  const observation=metrics?.[key]?.value;
  if(observation===null||observation===undefined||!Number.isFinite(observation))continue;
  const values=peers.map(x=>x?.[key]?.value).filter(x=>typeof x==="number"&&Number.isFinite(x)).sort((a,b)=>a-b);
  if(values.length<10)continue;
  const below=values.filter(x=>x<observation).length;
  const equal=values.filter(x=>x===observation).length;
  breakdown.push({key,percentile:Math.round(100*(below+equal/2)/values.length),value:observation,source:metrics[key]?.source,peerCount:values.length});
 }
 const coverage=candidates.length?Math.round(breakdown.length/candidates.length*100):0;
 // Do not calculate a score for insufficient evidence, unknown instructions
 // or a single indicator; never turn unknowns into neutral values.
 const score=breakdown.length>=2?Math.round(breakdown.reduce((s,x)=>s+x.percentile,0)/breakdown.length):null;
 return {score,coverage,breakdown,requested:candidates.length,requirements:requirements.matched.map(r=>r.label),unmatched:requirements.unmatched,
  confidence:score===null?"insufficient":coverage>=75&&breakdown.length>=3?"medium":"low",
  limitation:requirements.unmatched?"El texto del rol no contiene criterios inequívocos que podamos vincular a métricas históricas.":"Proxies estadísticos orientativos: no observan directamente todas las decisiones tácticas del futbolista."};
}
