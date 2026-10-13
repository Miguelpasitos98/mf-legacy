import { normalizeLabel } from "./statsImport";

export const isNationalCompetition = (name) => {
  const value=normalizeLabel(name);
  return /(worldcup|copamerica|copaamerica|conmebol|nationsleague|eurosqualification|europeanchampionship|uefaeuro|afcon|africacupofnations|asiancup|concacafnations|goldcup|internationalfriendly|friendlies|olympicgames|nationalteam)/.test(value);
};
export const seasonEndYear = season => {
  const match=String(season||"").match(/^(\d{4})\/(\d{4})$/);
  return match?Number(match[2]):null;
};
export const seasonInProgress = (season, now=new Date()) => {
  const end=seasonEndYear(season);
  if(!end)return false;
  const activeEnd=now.getMonth()>=6?now.getFullYear()+1:now.getFullYear();
  return end>=activeEnd;
};
export const defaultStatsSeason=(stats,preferred="",now=new Date())=>{
  const available=[...new Set((stats||[]).map(r=>r.season).filter(Boolean))].sort().reverse();
  if(preferred&&available.includes(preferred))return preferred;
  return available.find(s=>!seasonInProgress(s,now))||available[0]||"Todas";
};
export const normalizedClubName=name=>normalizeLabel(name).replace(/^(fc|cf|afc)/,"").replace(/(fc|cf)$/,"");
const one=values=>values.length===1?values[0]:null;
export function resolveStatTeam(row,teams,referenceRows=[]){
  const id=String(row?.team_id||"").trim();
  if(id){const club=teams.find(t=>String(t.id)===id);if(club)return {team:club,status:"confirmed",basis:"ID vinculado"};}
  const fid=String(row?.fotmob_team_id||"").trim();
  if(fid){
    const club=one(teams.filter(t=>t.fotmob_id&&String(t.fotmob_id)===fid));
    if(club)return {team:club,status:"confirmed",basis:"ID FotMob"};
  }
  const name=normalizedClubName(row?.team_name);
  if(name){
    const clubs=teams.filter(t=>normalizedClubName(t.name)===name || normalizedClubName(t.short_name)===name);
    const club=one(clubs);
    if(club)return {team:club,status:"confirmed",basis:"Nombre explícito único"};
  }
  if(isNationalCompetition(row?.competition)){
    return {team:null,status:"national",basis:"Competiciones de selecciones"};
  }
  if(name||fid)return {team:null,status:"unknown",basis:"Equipo no encontrado o ambiguo"};
  // La liga base puede contener un club confirmado, pero jamás asumir que otra
  // competición de esa temporada le corresponde automáticamente.
  const candidates=new Map();
  for(const ref of referenceRows){
    if(ref===row||ref.season!==row?.season||!ref.team_name&&!ref.team_id&&!ref.fotmob_team_id)continue;
    if(isNationalCompetition(ref.competition))continue;
    const matching=resolveStatTeam(ref,teams,[]);
    if(matching.team)candidates.set(String(matching.team.id),matching.team);
  }
  if(candidates.size===1)return {team:null,suggestion:[...candidates.values()][0],status:"suggestion",basis:"Club en otra competición de la temporada; requiere confirmación"};
  return {team:null,status:"unknown",basis:"No se conoce el equipo de esta competición"};
}
export const ADDITIVE_KEYS=["goals","assists","xg","xa","shots","tackles","recoveries"];
export function aggregateStatRows(rows,getMetric){
  const totals={};
  // Los registros resumen no deben sumarse con sus competiciones.
  const ordinary=(rows||[]).filter(r=>!["totaltemporada","totalseason","allcompetitions"].includes(normalizeLabel(r.competition)));
  for(const key of ADDITIVE_KEYS){
    let value=0,count=0;
    for(const r of ordinary){const v=getMetric(r,key);if(typeof v==="number"&&Number.isFinite(v)){value+=v;count++;}}
    totals[key]=count?{value,count,totalRows:ordinary.length}:null;
  }
  return totals;
}
