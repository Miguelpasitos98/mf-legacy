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
 name:"",display_name:"",country_id:"",nationality:"",date_of_birth:"",photo_url:"",
 manager_kind:"real",biography:"",notes:"",source_url:"",source_status:"manual",is_active:true
};
export const PROFILE_BLANK = {
 name:"Modelo principal",profile_scope:"general",reference_club:"",period_start:"",period_end:"",season:"",career_model_key:"",success_tier:"unknown",evidence_summary:"",generation_method:"",formation:"4-3-3",possession:50,pressing:50,tempo:50,
 defensive_line:50,attacking_width:50,risk_taking:50,build_up:"mixed",
 transition:"balanced",defensive_block:"medium",profile_notes:"",source_url:"",
 is_default:false,version:1
};
export const validSeason = s => /^(?:19|20)\d{2}\/(?:19|20)\d{2}$/.test(s) && Number(s.slice(5))===Number(s.slice(0,4))+1;
export const PROFILE_SCOPES = [
 {key:"general",title:"Filosofía general",description:"Identidad más representativa; sin fechas obligatorias"},
 {key:"period",title:"Etapa o periodo",description:"Varios años en un club o proyecto"},
 {key:"season",title:"Temporada específica",description:"Modelo de una campaña concreta"}
];
export const profileScope = raw =>
 ["general","period","season"].includes(raw?.profile_scope) ? raw.profile_scope :
 raw?.season ? "season" : raw?.period_start || raw?.period_end ? "period" : "general";
export const profileScopeLabel = raw => {
 const scope=profileScope(raw);
 if(scope==="season")return "Temporada · "+(raw.season||"sin fecha");
 if(scope==="period")return "Periodo · "+[raw.period_start,raw.period_end].filter(Boolean).join(" – ");
 return "Filosofía general";
};
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
   name,display_name:String(raw.display_name||"").trim(),country_id:String(raw.country_id||"").trim(),nationality:String(raw.nationality||"").trim(),
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
 const scope=profileScope(raw);
 const season=String(raw.season||"").trim();
 const periodStart=String(raw.period_start||"").trim();
 const periodEnd=String(raw.period_end||"").trim();
 const club=String(raw.reference_club||"").trim().slice(0,160);
 if(scope==="season"&&!validSeason(season))throw Error("El perfil de temporada necesita una campaña válida (ej. 2019/2020).");
 if(scope==="period"&&(!validSeason(periodStart)||!validSeason(periodEnd)||periodStart>periodEnd))
   throw Error("El periodo necesita temporadas de inicio y fin válidas y ordenadas.");
 if(scope==="period"&&periodStart===periodEnd)throw Error("Para una única temporada selecciona «Temporada específica».");

 const source=String(raw.source_url||"").trim();
 if(source && !/^https?:\/\//i.test(source))throw Error("La fuente táctica debe ser una URL http(s).");
 const roles=Object.fromEntries(ROLES.map(r=>[r.key,String(roleText[r.key]||"").trim()]).filter(([,v])=>v));
 return {
  manager_id:String(managerId),name,profile_scope:scope,
  season:scope==="season"?season:"",
  period_start:scope==="period"?periodStart:"",
  period_end:scope==="period"?periodEnd:"",
  reference_club:scope==="general"?"":club,
  formation:String(raw.formation||"4-3-3").trim(),
  ...Object.fromEntries(DNA_AXES.map(({key})=>[key,clampAxis(raw[key])])),
  build_up:["short","mixed","direct"].includes(raw.build_up)?raw.build_up:"mixed",
  transition:["counter_press","regroup","balanced"].includes(raw.transition)?raw.transition:"balanced",
  defensive_block:["low","medium","high"].includes(raw.defensive_block)?raw.defensive_block:"medium",
  player_role_priorities:JSON.stringify(roles),
  profile_notes:String(raw.profile_notes||"").trim(),source_url:source,
  career_model_key:String(raw.career_model_key||"").trim(),
  success_tier:["very_successful","successful","mixed","limited","unknown"].includes(raw.success_tier)?raw.success_tier:"unknown",
  evidence_summary:String(raw.evidence_summary||"").trim(),
  generation_method:String(raw.generation_method||"").trim(),
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
