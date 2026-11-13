// MF LEGACY — evaluación táctica basada en atributos FM y métricas reales.
// Nunca infiere por nombre de jugador ni usa roles "especiales" sin contexto.
export const TACTICAL_AUTO_VERSION = "mf_legacy_roles_auto_v1";
export const TACTICAL_ROLE_FAMILIES = {
  GK: "Goalkeepers", DFC: "Centre-Backs",
  LI: "Full-Backs / Wing-Backs", LD: "Full-Backs / Wing-Backs",
  CRI: "Full-Backs / Wing-Backs", CRD: "Full-Backs / Wing-Backs",
  CDM: "Central Midfielders", CM: "Central Midfielders",
  CAM: "Attacking Midfielders",
  EI: "Wingers", ED: "Wingers", MI: "Wingers", MD: "Wingers",
  DC: "Strikers"
};

// m=mental, p=physical, t=technical, g=goalkeeping.
// Los pesos identifican qué atributos diferencian cada arquetipo; no son una
// puntuación de calidad general ni equivalen al CA de Football Manager.
export const TACTICAL_ROLE_PROFILES = {
  "Goalkeepers": [
    ["Traditional Goalkeeper", { "g.reflejos":3,"g.blocaje":3,"g.uno_contra_uno":2,"m.concentracion":2,"m.anticipacion":1 }, {"Saves":2,"Save percentage":2}],
    ["Modern Goalkeeper", { "g.reflejos":2,"g.saques_de_puerta":2,"g.saque_con_la_mano":2,"t.pases":2,"m.decisiones":2,"m.serenidad":2 }, {"Accurate passes":2,"Pass accuracy":1}],
    ["Positional Goalkeeper", { "g.blocaje":3,"g.balones_aereos":2,"g.mando_en_el_area":2,"m.colocacion":3,"m.concentracion":2 }, {"Save percentage":2}],
    ["Sweeper Distributor", { "g.saques_de_puerta":3,"g.saque_con_la_mano":3,"g.salidas_tendencia":2,"t.pases":2,"m.vision":2 }, {"Accurate long balls":3,"Accurate passes":2}],
    ["Sweeper Keeper", { "g.salidas_tendencia":3,"g.uno_contra_uno":2,"p.aceleracion":2,"m.anticipacion":2,"m.decisiones":2 }, {"Saves":1}],
    ["Penalty Specialist", { "g.uno_contra_uno":3,"g.reflejos":3,"m.anticipacion":2,"m.serenidad":2 }, {}]
  ],
  "Centre-Backs": [
    ["The Sweeper", {"m.anticipacion":3,"m.colocacion":3,"p.velocidad":2,"m.decisiones":2,"t.entradas":2}, {"Interceptions":2,"Recoveries":2}],
    ["Ball-Playing Defender", {"t.pases":3,"t.tecnica":3,"m.vision":3,"m.decisiones":2,"m.serenidad":2}, {"Line-breaking passes":3,"Accurate passes":2,"Accurate long balls":2}],
    ["Physical Dominator", {"p.fuerza":3,"p.alcance_de_salto":3,"t.cabeceo":3,"m.valentia":2,"t.marcaje":2}, {"Aerials won %":3,"Aerials won":2}],
    ["Aggressive Front-Foot Defender", {"m.agresividad":3,"t.entradas":3,"m.valentia":2,"p.aceleracion":2,"m.anticipacion":2}, {"Tackles":2,"Interceptions":2}],
    ["Libero Defender", {"t.pases":3,"t.tecnica":3,"m.vision":3,"p.velocidad":2,"m.movimiento":2}, {"Line-breaking passes":3,"Accurate passes":2}],
    ["Tactical Defender", {"m.colocacion":3,"m.concentracion":3,"m.anticipacion":3,"m.decisiones":3,"t.marcaje":2}, {"Interceptions":2,"Defensive actions":2}],
    ["Defensive Leader", {"m.liderazgo":3,"m.colocacion":2,"m.concentracion":2,"m.decisiones":2,"m.trabajo_de_equipo":2}, {"Defensive actions":1}],
    ["Hybrid Defender", {"t.pases":2,"t.marcaje":2,"t.entradas":2,"m.decisiones":2,"p.velocidad":2,"p.fuerza":2}, {"Accurate passes":1,"Tackles":1}]
  ],
  "Full-Backs / Wing-Backs": [
    ["Defensive Full-Back", {"t.entradas":3,"t.marcaje":3,"m.colocacion":3,"m.concentracion":2,"p.fuerza":2}, {"Defensive actions":2,"Tackles":2}],
    ["Overlapping Wing-Back", {"p.resistencia":3,"p.velocidad":3,"p.aceleracion":2,"t.centros":3,"m.movimiento":2}, {"Chances created":2,"Big chances created":2}],
    ["Complete Full-Back", {"p.resistencia":2,"t.centros":2,"t.entradas":2,"t.pases":2,"m.decisiones":2,"p.velocidad":2}, {"Chances created":1,"Tackles":1}],
    ["Versatile Full-Back", {"t.pases":2,"t.entradas":2,"t.centros":2,"m.decisiones":3,"m.trabajo_de_equipo":2}, {"Accurate passes":1,"Defensive actions":1}],
    ["Defensive Wing-Back", {"p.resistencia":2,"t.entradas":3,"t.marcaje":2,"m.trabajo_de_equipo":2,"m.colocacion":2}, {"Tackles":2}],
    ["Explosive Full-Back", {"p.aceleracion":4,"p.velocidad":4,"p.resistencia":2,"t.regate":2,"t.centros":2}, {"Dribbles":2}],
    ["Technical Full-Back", {"t.control":3,"t.tecnica":3,"t.pases":3,"t.centros":2,"m.decisiones":2}, {"Line-breaking passes":1,"Accurate passes":2}],
    ["Inverted Full-Back", {"t.pases":3,"m.vision":3,"m.decisiones":3,"m.colocacion":2,"t.control":2}, {"Accurate passes":2,"Line-breaking passes":2}]
  ],
  "Central Midfielders": [
    ["The Anchorman", {"m.colocacion":3,"m.concentracion":3,"t.entradas":2,"m.decisiones":3,"t.marcaje":2}, {"Interceptions":2,"Recoveries":2}],
    ["The Destroyer", {"t.entradas":3,"m.agresividad":3,"m.valentia":3,"p.fuerza":2,"m.sacrificio":2}, {"Tackles":2,"Defensive actions":2}],
    ["Regista", {"t.pases":3,"m.vision":4,"t.tecnica":3,"m.decisiones":2,"m.talento":2}, {"Line-breaking passes":3,"Accurate long balls":2}],
    ["Box-to-Box Controller", {"p.resistencia":3,"m.sacrificio":3,"m.movimiento":2,"t.pases":2,"t.entradas":2,"m.trabajo_de_equipo":2}, {"Recoveries":1,"Chances created":1}],
    ["Advanced Playmaker", {"m.vision":3,"t.tecnica":3,"t.pases":3,"m.movimiento":2,"t.control":2}, {"Chances created":2,"xA":2}],
    ["Deep-Lying Playmaker", {"t.pases":3,"m.vision":3,"m.decisiones":3,"m.colocacion":2,"m.serenidad":2}, {"Line-breaking passes":3,"Accurate passes":2}],
    ["Firefighter Midfielder", {"m.sacrificio":3,"t.entradas":2,"m.trabajo_de_equipo":3,"p.resistencia":3,"m.anticipacion":2}, {"Recoveries":2,"Defensive actions":2}],
    ["Methodical Midfielder", {"m.decisiones":3,"m.concentracion":2,"t.pases":3,"m.serenidad":3,"m.trabajo_de_equipo":2}, {"Pass accuracy":2,"Accurate passes":1}],
    ["Workhorse Midfielder", {"m.sacrificio":4,"p.resistencia":3,"m.trabajo_de_equipo":3,"m.determinacion":2,"t.entradas":2}, {"Recoveries":2}]
  ],
  "Attacking Midfielders": [
    ["The Architect", {"m.vision":4,"t.pases":3,"t.tecnica":3,"m.decisiones":2,"t.control":2}, {"Chances created":2,"xA":2}],
    ["Space Creator", {"m.movimiento":3,"m.vision":3,"t.regate":2,"t.pases":2,"m.talento":2}, {"Chances created":2,"Big chances created":2}],
    ["The Classic 10", {"m.talento":4,"m.vision":3,"t.tecnica":3,"t.control":3,"t.pases":2}, {"Chances created":1}],
    ["The Connector", {"t.pases":3,"m.trabajo_de_equipo":3,"m.decisiones":3,"t.control":2,"m.movimiento":2}, {"Accurate passes":2,"Pass accuracy":1}],
    ["Physical Playmaker", {"p.fuerza":3,"t.pases":3,"t.control":2,"m.vision":2,"m.serenidad":2}, {"Chances created":1}],
    ["Pressing Midfielder", {"m.sacrificio":3,"p.resistencia":3,"m.agresividad":2,"m.trabajo_de_equipo":2,"t.entradas":2}, {"Recoveries":2,"Defensive actions":2}],
    ["Late Runner", {"m.movimiento":4,"t.remate":3,"p.resistencia":2,"m.anticipacion":2,"p.aceleracion":2}, {"Touches in opposition box":2,"xG":2}],
    ["Gravitational Playmaker", {"m.talento":3,"t.regate":3,"m.vision":3,"t.tecnica":2,"t.control":2}, {"Dribbles":2,"Chances created":2}],
    ["Physical Creator", {"p.fuerza":3,"t.regate":2,"t.pases":3,"m.vision":2,"m.movimiento":2}, {"Chances created":1}]
  ],
  "Wingers": [
    ["Line Breaker", {"p.aceleracion":4,"p.velocidad":4,"t.regate":3,"m.movimiento":2}, {"Dribbles":3,"Touches in opposition box":1}],
    ["Wide Connector", {"t.pases":3,"m.trabajo_de_equipo":3,"t.control":2,"t.centros":2,"m.decisiones":2}, {"Accurate passes":2,"Chances created":1}],
    ["Inside Finisher", {"t.remate":4,"m.movimiento":3,"p.aceleracion":2,"m.serenidad":2,"t.regate":2}, {"xG":2,"Goals":2,"Touches in opposition box":1}],
    ["Wide Ball Carrier", {"t.regate":4,"p.aceleracion":3,"p.agilidad":3,"t.control":2,"p.balance":2}, {"Dribbles":3,"Dribbles success rate":2}],
    ["Creative Winger", {"m.vision":3,"t.centros":3,"t.pases":3,"t.tecnica":2,"m.talento":2}, {"Chances created":3,"xA":2}],
    ["Chaotic Winger", {"t.regate":3,"p.velocidad":3,"p.aceleracion":2,"m.talento":3,"m.movimiento":2}, {"Dribbles":2}],
    ["Defensive Winger", {"m.sacrificio":3,"m.trabajo_de_equipo":2,"p.resistencia":2,"t.entradas":3,"m.colocacion":2}, {"Tackles":2,"Recoveries":2}],
    ["Functional Winger", {"m.trabajo_de_equipo":3,"p.resistencia":2,"t.centros":3,"m.decisiones":2,"t.control":2}, {"Chances created":1}],
    ["Wide Forward", {"t.remate":3,"m.movimiento":3,"p.velocidad":2,"m.anticipacion":2,"t.regate":2}, {"xG":2,"Goals":2}]
  ],
  "Strikers": [
    ["Clinical Finisher", {"t.remate":4,"m.serenidad":4,"m.anticipacion":2,"t.tecnica":2}, {"Goals":2,"xG":2}],
    ["Dynamic Threat", {"p.velocidad":3,"p.aceleracion":3,"t.regate":3,"m.movimiento":2}, {"Dribbles":2,"xG":1}],
    ["Target Man", {"p.fuerza":4,"t.cabeceo":4,"p.alcance_de_salto":3,"m.valentia":2}, {"Aerials won %":3,"Aerials won":2}],
    ["Second Striker", {"t.pases":3,"m.vision":3,"t.control":3,"m.movimiento":2,"t.tecnica":2}, {"xA":2,"Chances created":2}],
    ["Space Creator", {"m.vision":3,"m.movimiento":2,"t.pases":3,"t.tecnica":2,"m.talento":2}, {"Chances created":2,"xA":2}],
    ["Space Attacker", {"m.movimiento":4,"m.anticipacion":3,"p.aceleracion":3,"t.remate":2}, {"Touches in opposition box":2,"xG":2}],
    ["Goal Hunter", {"t.remate":4,"m.movimiento":4,"m.anticipacion":3,"m.determinacion":2}, {"Goals":2,"Touches in opposition box":2}],
    ["Intelligent Forward", {"m.decisiones":3,"m.anticipacion":3,"m.movimiento":3,"t.control":2,"t.pases":2}, {"xA":1,"xG":1}],
    ["Breakaway Forward", {"p.aceleracion":4,"p.velocidad":4,"m.movimiento":3,"t.remate":2}, {"Touches in opposition box":2,"xG":1}],
    ["Ice-Cold Finisher", {"m.serenidad":4,"t.remate":4,"m.decisiones":2,"m.anticipacion":2}, {"Goals":2}]
  ]
};

const splitKey = key => ({m:"mental",p:"physical",t:"technical",g:"goalkeeping"})[key[0]]+"."+key.slice(2);
const clean = role => String(role||"").replace(/^[^\p{L}\p{N}]+/u,"").trim().toLowerCase();
const numeric = value => typeof value === "number" && Number.isFinite(value) ? value : null;
const statValue = (player, key) => {
  const path = splitKey(key).split(".");
  const value = numeric(player?.stats?.[path[0]]?.[path[1]]);
  return value != null && value >= 1 && value <= 20 ? value : null;
};
export function hasTacticalRole(player) {
  return !!(String(player?.description || "").trim() || (player?.tactical_roles||[]).some(role=>String(role?.name||"").trim() || String(role?.description||"").trim()));
}
export function needsTacticalRoles(player) { return !hasTacticalRole(player); }

function chosenSeason(records) {
  return (records||[]).filter(row=>row?.source==="fotmob" && numeric(row.minutes)>=450 && Array.isArray(row.metrics) && row.metrics.length>=8)
    .sort((a,b)=>Number(b.minutes||0)-Number(a.minutes||0))[0] || null;
}
function realMetric(record, name) {
  const found=(record?.metrics||[]).find(m=>String(m?.name||"").toLowerCase()===name.toLowerCase());
  if (!found || found.verification_status==="conflict") return null;
  const pct=numeric(found.percentile_per90) ?? numeric(found.percentile);
  if(pct===null || pct<0 || pct>100) return null;
  return {pct, metric: found};
}
function profileScore(player, role, season) {
  const [name, attrs, real] = role;
  // Roles que requieren hechos contextuales no se infieren de buenos atributos generales.
  if(name==="Penalty Specialist")return null; // no hay histórico de penaltis parados fiable
  if(name==="Chaotic Winger" && !(statValue(player,"m.consistencia")<=10 && statValue(player,"m.talento")>=14 && statValue(player,"m.decisiones")<=12))return null;
  if(name==="Defensive Leader" && !(statValue(player,"m.liderazgo")>=14))return null;
  if(name==="Libero Defender" && !(Number(player?.position_ratings?.mediocentro||0)>=12))return null;
  let sum=0, weight=0, missing=0, details=[];
  for(const [key,importance] of Object.entries(attrs)){
    const value=statValue(player,key);
    if(value===null) {missing++;continue;}
    weight+=importance;sum+=value*importance;
    details.push({key:splitKey(key),value,weight:importance});
  }
  if(weight<7 || details.length<3)return null;
  const fmScore=sum/weight;
  let realWeighted=0, realWeight=0, realDetails=[];
  if(season){
    for(const [metricName,importance] of Object.entries(real)){
      const found=realMetric(season,metricName);
      if(!found)continue;
      realWeight+=importance;
      realWeighted+=((found.pct-50)/25)*importance;
      realDetails.push({name:metricName,pct:found.pct,value:found.metric.per90??found.metric.value,unit:found.metric.per90!=null?"per90":"total"});
    }
  }
  const reliability=season?Math.min(1,Math.max(0,(Number(season.minutes||0)-450)/1000)):0;
  const realBonus=realWeight?0.65*reliability*(realWeighted/realWeight):0;
  return { name, score:fmScore+realBonus, fmScore, realBonus, coverage:details.length/(details.length+missing), details:details.sort((a,b)=>(b.value-10)*b.weight-(a.value-10)*a.weight), realDetails, keys:Object.keys(attrs) };
}

export function evaluateTacticalRoles(player, seasonRecords=[], roleGroups=[]) {
  const family=TACTICAL_ROLE_FAMILIES[String(player?.position||"").toUpperCase()];
  if(!family)return {status:"insufficient",reason:"Posición sin equivalencia táctica en MF LEGACY"};
  const available=roleGroups.find(group=>group.group===family)?.options||[];
  if(!available.length)return {status:"insufficient",reason:"Falta el catálogo táctico del editor"};
  const season=chosenSeason(seasonRecords);
  const scores=(TACTICAL_ROLE_PROFILES[family]||[]).map(spec=>profileScore(player,spec,season)).filter(Boolean)
    .filter(x=>available.some(role=>clean(role)===clean(x.name)))
    .map(x=>({...x,name:available.find(role=>clean(role)===clean(x.name))}))
    .sort((a,b)=>b.score-a.score);
  if(scores.length<2)return {status:"insufficient",reason:"Faltan suficientes atributos FM para elegir dos roles con respaldo"};
  const first=scores[0];
  const others=scores.slice(1).map(candidate=>{
    const union=new Set([...first.keys,...candidate.keys]);
    const overlap=first.keys.filter(key=>candidate.keys.includes(key)).length/union.size;
    return {...candidate,complementaryScore:candidate.score-overlap*0.40};
  }).sort((a,b)=>b.complementaryScore-a.complementaryScore);
  const second=others[0];
  const strong=first.details.length>=4 && first.coverage>=0.80;
  const confidence=strong && first.score>=14 && (first.score-scores[2]?.score>=0.3 || Number(season?.minutes||0)>=1200)?"alta":strong?"media":"baja";
  const describe=result=>{
    const top=result.details.slice(0,3).map(d=>d.key.split(".").at(-1).replaceAll("_"," ")+" "+d.value+"/20").join(", ");
    const real=result.realDetails.sort((a,b)=>b.pct-a.pct)[0];
    const evidence=real && Number(season?.minutes||0)>=600
      ? ". FotMob "+season.season+" ("+season.minutes+" min): "+real.name+" percentil "+Math.round(real.pct)
      : "";
    return "Perfil valorado por "+top+" en FM"+evidence+". Asignación automática revisable.";
  };
  return {status:"ready",player_id:player.id,name:player.name,position:player.position,confidence,
    season:season?{season:season.season,competition:season.competition,minutes:season.minutes}:null,
    roles:[{name:first.name,description:describe(first)},{name:second.name,description:describe(second)}],
    scores:[first,second],margin:first.score-(scores[2]?.score||0),model:TACTICAL_AUTO_VERSION};
}
