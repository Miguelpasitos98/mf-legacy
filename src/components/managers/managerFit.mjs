/**
 * Manager Fit V1: deterministic, auditable compatibility baseline.
 * No semantic matching of role descriptions and no guessed performance metrics.
 * Quality (FM26 CA) is shown separately and never influences tactical fit.
 */
export const ROLE_LABELS={GK:"Portero",CB:"Central",FB:"Lateral",DM:"Mediocentro",AM:"Mediapunta",WG:"Extremo",ST:"Delantero"};
const ROLE_POSITIONS={
 GK:["GK"],CB:["DFC","CB"],FB:["LD","LI","CRD","CRI","RB","LB","RWB","LWB"],
 DM:["CDM","CM","DM"],AM:["CAM","CM","AM"],WG:["EI","ED","LW","RW","LM","RM"],ST:["DC","ST","CF"]
};
const POSITION_RATINGS={
 GK:["portero"],CB:["defensa_central"],FB:["defensa_izquierdo","defensa_derecho","carrilero_izquierdo","carrilero_derecho"],
 DM:["mediocentro","centrocampista"],AM:["mediapunta_central","centrocampista"],WG:["mediapunta_por_la_izquierda","mediapunta_por_la_derecha","centrocampista_izquierdo","centrocampista_derecho"],ST:["delantero"]
};
export const validCA = v => v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))&&Number(v)>0&&Number(v)<=200?Number(v):null;
const positionList=p=>[p?.position,p?.secondary_position].filter(Boolean).map(x=>String(x).toUpperCase().trim());
export function roleCompatibility(player,role){
 if(!ROLE_POSITIONS[role])throw Error("Rol no válido");
 const positions=positionList(player);
 const supported=ROLE_POSITIONS[role];
 const first=positions[0]&&supported.includes(positions[0]);
 const secondary=positions.slice(1).some(x=>supported.includes(x));
 const rawRatings=POSITION_RATINGS[role].map(key=>Number(player?.position_ratings?.[key])).filter(n=>Number.isFinite(n)&&n>=1&&n<=20);
 const positionRating=rawRatings.length?Math.max(...rawRatings):null;
 // Position rating is FM's 1–20 positional suitability, not observed tactical performance.
 let fit;
 let evidence;
 if(positionRating!==null){
  fit=Math.round(positionRating/20*100);
  evidence="Valoración posicional FM26";
 }else if(first){
  fit=85;evidence="Posición principal registrada (aproximación)";
 }else if(secondary){
  fit=65;evidence="Posición secundaria registrada (aproximación)";
 }else {
  return {fit:null,evidence:"Sin datos suficientes de adecuación a este rol",rating:null};
 }
 return {fit,evidence,rating:positionRating};
}
export function managerFitV1(player,role,profile){
 const compatible=roleCompatibility(player,role);
 const ca=validCA(player?.ca);
 const roleDescription=String(profile?.player_role_priorities||"");
 let roleText="";
 try{const data=JSON.parse(roleDescription);roleText=typeof data?.[role]==="string"?data[role].trim():"";}catch{/* Metadata alone must not alter numeric fit. */}
 return {
  playerId:String(player?.id||""),role,
  fit:compatible.fit,
  quality:ca, // never added to fit
  reliability:compatible.rating!==null?"medium":compatible.fit!==null?"low":"insufficient",
  evidence:compatible.evidence,
  requirements:roleText,
  limitations:"Esta V1 mide adecuación posicional; todavía no evalúa presión, progresión, creatividad ni estadísticas de rendimiento por temporada."
 };
}
export function rankPlayers(players,role,profile,{minCA=0,search="",showUnknown=false}={}){
 const term=String(search).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
 return players.filter(p=>{
  if(term&&!String(p.name||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().includes(term))return false;
  const ca=validCA(p.ca);
  if(minCA>0&&(ca===null||ca<minCA))return false;
  return true;
 }).map(player=>({player,...managerFitV1(player,role,profile)}))
 .filter(row=>showUnknown||row.fit!==null)
 .sort((a,b)=>(b.fit??-1)-(a.fit??-1) || (b.quality??-1)-(a.quality??-1) || String(a.player.name).localeCompare(String(b.player.name)));
}
