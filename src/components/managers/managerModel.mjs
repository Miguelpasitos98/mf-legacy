export const DNA_AXES = [
  { key:"possession", label:"Control del balón", low:"Juego directo", high:"Posesión" },
  { key:"pressing", label:"Intensidad de presión", low:"Pasivo", high:"Presión intensa" },
  { key:"tempo", label:"Ritmo ofensivo", low:"Pausado", high:"Vertical" },
  { key:"defensive_line", label:"Altura defensiva", low:"Bloque bajo", high:"Bloque alto" },
  { key:"attacking_width", label:"Amplitud ofensiva", low:"Juego interior", high:"Bandas" },
  { key:"risk_taking", label:"Riesgo con balón", low:"Conservador", high:"Creativo" }
];
export const ROLES = [
  {key:"GK",label:"Portero"},{key:"CB",label:"Central"},
  {key:"FB",label:"Lateral"},{key:"DM",label:"Mediocentro"},
  {key:"AM",label:"Mediapunta"},{key:"WG",label:"Extremo"},
  {key:"ST",label:"Delantero"}
];
export const MANAGER_BLANK = {
 name:"",display_name:"",nationality:"",date_of_birth:"",photo_url:"",
 manager_kind:"real",biography:"",notes:"",source_url:"",source_status:"manual",is_active:true
};
export const PROFILE_BLANK = {
 name:"Modelo principal",season:"",formation:"4-3-3",possession:50,pressing:50,tempo:50,
 defensive_line:50,attacking_width:50,risk_taking:50,build_up:"mixed",
 transition:"balanced",defensive_block:"medium",profile_notes:"",source_url:"",
 is_default:false,version:1
};
export const validSeason = s => /^20\d{2}\/20\d{2}$/.test(s) && Number(s.slice(5))===Number(s.slice(0,4))+1;
export const clampAxis = value => {
 const number=Number(value);
 if(!Number.isFinite(number))throw Error("Los parámetros del ADN deben ser números entre 0 y 100.");
 return Math.max(0,Math.min(100,Math.round(number)));
};
export const cleanManager = raw => {
 const name=String(raw.name||"").trim();
 if(name.length<2)throw Error("Escribe el nombre completo del entrenador.");
 const source=String(raw.source_url||"").trim();
 if(source && !/^https?:\/\//i.test(source))throw Error("La fuente debe ser una URL http(s).");
 if(raw.source_status==="verified" && !source)throw Error("Para marcar como verificado debes añadir una fuente.");
 const photo=String(raw.photo_url||"").trim();
 if(photo&&!/^https?:\/\//i.test(photo))throw Error("La fotografía debe tener una URL http(s).");
 return {
   name,display_name:String(raw.display_name||"").trim(),nationality:String(raw.nationality||"").trim(),
   date_of_birth:String(raw.date_of_birth||"").trim(),photo_url:photo,
   manager_kind:raw.manager_kind==="fictional"?"fictional":"real",
   biography:String(raw.biography||"").trim(),notes:String(raw.notes||"").trim(),
   source_url:source,source_status:["manual","verified","pending"].includes(raw.source_status)?raw.source_status:"manual",
   is_active:raw.is_active!==false
 };
};
export const cleanProfile = (raw,managerId,roleText={}) => {
 if(!managerId)throw Error("Selecciona primero un entrenador.");
 const name=String(raw.name||"").trim();
 if(name.length<2)throw Error("Escribe un nombre para el perfil táctico.");
 const season=String(raw.season||"").trim();
 if(season&&!validSeason(season))throw Error("La temporada debe ser YYYY/YYYY, por ejemplo 2026/2027.");
 const source=String(raw.source_url||"").trim();
 if(source && !/^https?:\/\//i.test(source))throw Error("La fuente táctica debe ser una URL http(s).");
 const roles=Object.fromEntries(ROLES.map(r=>[r.key,String(roleText[r.key]||"").trim()]).filter(([,v])=>v));
 return {
  manager_id:String(managerId),name,season,formation:String(raw.formation||"4-3-3").trim(),
  ...Object.fromEntries(DNA_AXES.map(({key})=>[key,clampAxis(raw[key])])),
  build_up:["short","mixed","direct"].includes(raw.build_up)?raw.build_up:"mixed",
  transition:["counter_press","regroup","balanced"].includes(raw.transition)?raw.transition:"balanced",
  defensive_block:["low","medium","high"].includes(raw.defensive_block)?raw.defensive_block:"medium",
  player_role_priorities:JSON.stringify(roles),
  profile_notes:String(raw.profile_notes||"").trim(),source_url:source,
  is_default:Boolean(raw.is_default),version:Number.isInteger(raw.version)&&raw.version>0?raw.version:1
 };
};
export function decodeRoleText(json){
 try{const parsed=JSON.parse(json||"{}");if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))return {};
  return Object.fromEntries(ROLES.map(r=>[r.key,typeof parsed[r.key]==="string"?parsed[r.key]:""]));
 }catch{return {};}
}
export function chooseAssignment(assignments,teamId,season){
 return assignments.find(a=>a.team_type==="club"&&String(a.team_id)===String(teamId)&&a.season===season&&a.is_primary!==false);
}
export const isCustomTeam = team => team?.is_custom_club===true || team?.isCustomClub===true;
