/* V10: explicit tactical functions. Only reported FM26 attributes are scored. */
export const TACTICAL_FUNCTIONS={
 GK:[{id:"sweeper",name:"Portero-líbero",stats:["technical.pases","goalkeeping.saques_de_puerta","mental.decisiones"]},{id:"keeper",name:"Portero clásico",stats:["goalkeeping.reflejos","goalkeeping.blocaje","goalkeeping.uno_contra_uno"]}],
 CB:[{id:"ball_playing",name:"Central constructor",stats:["technical.pases","technical.control","mental.decisiones"]},{id:"cover",name:"Central de cobertura",stats:["physical.velocidad","mental.anticipacion","mental.colocacion"]}],
 FB:[{id:"attacking",name:"Lateral ofensivo",stats:["physical.resistencia","technical.centros","physical.velocidad"]},{id:"inverted",name:"Lateral invertido",stats:["technical.pases","mental.decisiones","technical.control"]}],
 DM:[{id:"playmaker",name:"Pivote organizador",stats:["technical.pases","mental.vision","mental.decisiones"]},{id:"ball_winner",name:"Pivote recuperador",stats:["technical.entradas","mental.sacrificio","mental.colocacion"]}],
 AM:[{id:"creator",name:"Mediapunta creador",stats:["mental.vision","technical.pases","technical.tecnica"]},{id:"runner",name:"Mediapunta llegador",stats:["mental.movimiento","technical.remate","physical.aceleracion"]}],
 WG:[{id:"inside",name:"Extremo interior",stats:["technical.regate","technical.remate","mental.movimiento"]},{id:"wide",name:"Extremo abierto",stats:["technical.centros","physical.velocidad","technical.regate"]}],
 ST:[{id:"pressing",name:"Delantero presionante",stats:["mental.sacrificio","physical.resistencia","mental.trabajo_de_equipo"]},{id:"false_nine",name:"Falso nueve",stats:["technical.pases","technical.control","mental.vision"]},{id:"finisher",name:"Delantero finalizador",stats:["technical.remate","mental.movimiento","mental.anticipacion"]}]
};
const norm=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const keyTerms={
 sweeper:["portero libero","juego de pies"],keeper:["portero clasico","seguridad bajo palos"],
 ball_playing:["salida de balon","constructor","progresion"],cover:["cobertura","velocidad","anticipacion"],
 attacking:["profund","ofensiv","centros","incorporaciones"],inverted:["invertid","interior","asociativo"],
 playmaker:["organizador","creador","distribucion"],ball_winner:["recuperador","presion","destruccion"],
 creator:["creativ","vision","ultimo pase"],runner:["llegador","desmarques","segunda linea"],
 inside:["interior","diagonal","pierna cambiada"],wide:["abierto","amplitud","centros"],
 pressing:["presion","sacrificio","gegenpressing"],false_nine:["falso nueve","asociativo","retrasarse"],finisher:["rematador","goleador","finalizador"]
};
export function functionPreferences(profile,role){
 let description="";
 try{const roles=typeof profile?.player_role_priorities==="string"?JSON.parse(profile.player_role_priorities):profile?.player_role_priorities;description=String(roles?.[role]||"");}catch{/* Unstructured content is optional. */}
 const t=norm(description);
 return (TACTICAL_FUNCTIONS[role]||[]).map(f=>({...f,matchingTerms:(keyTerms[f.id]||[]).filter(term=>t.includes(norm(term)))}));
}
export function functionSuitability(player,definition){
 const seen=definition.stats.map(path=>{
  const value=path.split(".").reduce((o,key)=>o?.[key],player?.stats);
  const n=Number(value);
  return value!==null&&value!==undefined&&value!==""&&Number.isFinite(n)&&n>=1&&n<=20?{path,value:n}:null;
 }).filter(Boolean);
 return {score:seen.length>=2?Math.round(seen.reduce((a,b)=>a+b.value,0)/seen.length*5):null,
  coverage:Math.round(seen.length/definition.stats.length*100),evidence:seen,
  confidence:seen.length===definition.stats.length?"medium":seen.length>=2?"low":"insufficient"};
}
export function evaluateTacticalFunctions(player,profile,role){
 const options=functionPreferences(profile,role).map(f=>({...f,...functionSuitability(player,f)}));
 const mentioned=options.filter(o=>o.matchingTerms.length);
 const considered=mentioned.length?mentioned:options;
 return {options,preferred:mentioned.map(x=>x.name),
  recommendation:[...considered].filter(x=>x.score!==null).sort((a,b)=>b.score-a.score)[0]||null,
  unmatched:mentioned.length===0};
}
