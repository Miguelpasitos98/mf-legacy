import {canonicalHistoricalClub,canonicalHistoricalCompetition} from "./historicalJson.js";
import {normalizeSeason} from "./historicalValuation.js";

const str=value=>String(value??"").trim();
export const possessionSourceName=row=>str(row?.source_team_name)||str(row?.team_name);
export const possessionSourceKey=row=>canonicalHistoricalClub(possessionSourceName(row));
const periodKey=row=>normalizeSeason(row.season)+"|"+canonicalHistoricalCompetition(row.competition);
const sourceId=row=>str(row?.fotmob_team_id);

export function buildPossessionAudit(rows=[],teams=[]){
 const byId=new Map(teams.filter(t=>t?.id).map(t=>[str(t.id),t]));
 const groups=new Map();
 let linked=0,pending=0,invalid=0;
 for(const row of rows){
  const source=possessionSourceName(row);
  const key=possessionSourceKey(row)||(sourceId(row)?"id:"+sourceId(row):"sin-nombre");
  if(!groups.has(key))groups.set(key,{key,name:source||"Sin nombre",records:[],seasons:new Set(),competitions:new Set(),names:new Set(),fotmobIds:new Set(),linkedIds:new Set()});
  const group=groups.get(key);
  group.records.push(row);group.seasons.add(normalizeSeason(row.season));
  group.competitions.add(str(row.competition));group.names.add(source);
  if(sourceId(row))group.fotmobIds.add(sourceId(row));
  if(str(row.team_id)){
   if(byId.has(str(row.team_id))){linked++;group.linkedIds.add(str(row.team_id));}
   else invalid++;
  }else pending++;
 }
 const auditGroups=[...groups.values()].map(g=>{
  const missing=g.records.filter(row=>!str(row.team_id)).length;
  const invalidCount=g.records.filter(row=>str(row.team_id)&&!byId.has(str(row.team_id))).length;
  const distinctPeriods=new Set(g.records.map(periodKey));
  const duplicates=g.records.length-distinctPeriods.size;
  const conflict=invalidCount>0||g.linkedIds.size>1||g.fotmobIds.size>1||duplicates>0;
  return {...g,recordCount:g.records.length,seasonCount:g.seasons.size,
   competitionCount:g.competitions.size,pending:missing,invalid:invalidCount,
   duplicates,conflict,status:conflict?"conflict":missing?"pending":"linked"};
 }).sort((a,b)=>(a.status==="conflict"?0:a.status==="pending"?1:2)-(b.status==="conflict"?0:b.status==="pending"?1:2)||b.pending-a.pending||a.name.localeCompare(b.name,"es"));
 const knownIds=new Set(rows.map(row=>str(row.team_id)).filter(id=>byId.has(id)));
 const knownNames=new Set(auditGroups.map(group=>group.key));
 const teamsWithoutRecords=teams.filter(t=>t?.id&&!knownIds.has(str(t.id))&&!knownNames.has(canonicalHistoricalClub(t.name)));
 return {groups:auditGroups,records:rows.length,linked,pending,invalid,conflicts:auditGroups.filter(g=>g.conflict).length,
  teamsWithoutRecords,seasons:new Set(rows.map(r=>normalizeSeason(r.season))).size};
}

export function suggestPossessionTeam(group,teams=[]){
 if(!group||group.conflict)return null;
 const byName=teams.filter(t=>t?.id&&canonicalHistoricalClub(t.name)===group.key);
 const byFotmob=group.fotmobIds.size===1?teams.filter(t=>t?.id&&str(t.fotmob_id)===[...group.fotmobIds][0]):[];
 const matches=byFotmob.length===1?byFotmob:byName;
 if(matches.length!==1)return null;
 const team=matches[0];
 if(byFotmob.length===1&&byName.length===1&&byFotmob[0].id!==byName[0].id)return null;
 if(group.fotmobIds.size&&str(team.fotmob_id)&&!group.fotmobIds.has(str(team.fotmob_id)))return null;
 if(group.linkedIds.size&&(!group.linkedIds.has(str(team.id))||group.linkedIds.size!==1))return null;
 return team;
}

export function planPossessionAssociation(rows=[],teams=[],sourceKey,targetId){
 const team=teams.find(t=>str(t.id)===str(targetId));
 if(!team)throw Error("Selecciona un equipo existente de MF Legacy.");
 const key=canonicalHistoricalClub(sourceKey);
 if(!key)throw Error("El nombre de origen no es válido.");
 const members=rows.filter(row=>possessionSourceKey(row)===key);
 if(!members.length)throw Error("No hay registros con ese nombre de origen.");
 const conflicts=[],updates=[],memberIds=new Set(members.map(r=>str(r.id)));
 const seenPeriods=new Set();
 const fotmobIds=new Set(members.map(sourceId).filter(Boolean));
 if(fotmobIds.size>1)conflicts.push("El mismo nombre de origen tiene varios ID FotMob: revisa su identidad.");
 if(str(team.fotmob_id)&&[...fotmobIds].some(id=>id!==str(team.fotmob_id)))
  conflicts.push("El ID FotMob de origen no coincide con el equipo elegido.");
 for(const row of members){
  if(!row.id){conflicts.push("Hay un registro sin identificador interno.");continue;}
  if(str(row.team_id)&&str(row.team_id)!==str(team.id))
   conflicts.push(row.season+" · "+row.competition+": ya está vinculado a otro equipo.");
  const period=periodKey(row);
  if(seenPeriods.has(period))conflicts.push(row.season+" · "+row.competition+": hay registros de origen duplicados.");
  seenPeriods.add(period);
  const existing=rows.find(other=>!memberIds.has(str(other.id))&&str(other.team_id)===str(team.id)&&periodKey(other)===period);
  if(existing)conflicts.push(row.season+" · "+row.competition+": el equipo de destino ya tiene otro registro.");
  const sourceName=possessionSourceName(row);
  const changes={
   team_id:str(team.id),team_name:str(team.name),source_team_name:sourceName,
   ...(str(team.fotmob_id)&&!sourceId(row)?{fotmob_team_id:str(team.fotmob_id)}:{})
  };
  if(Object.entries(changes).some(([field,value])=>str(row[field])!==value))
   updates.push({id:str(row.id),changes,season:row.season,competition:row.competition});
 }
 return {team,sourceKey:key,total:members.length,updates,conflicts:[...new Set(conflicts)],
  seasons:[...new Set(members.map(row=>normalizeSeason(row.season)))].sort(),
  competitions:[...new Set(members.map(row=>str(row.competition)))].sort()};
}

// Persisted source_team_name allows the next JSON import to inherit a confirmed
// human association. Multiple target IDs, or contradictory FotMob IDs, never auto-link.
export function resolveImportedPossession(row,existingRows=[],teams=[]){
 if(str(row?.team_id))return row;
 const key=canonicalHistoricalClub(row?.team_name);
 if(!key)return row;
 const associations=existingRows.filter(r=>possessionSourceKey(r)===key&&str(r.team_id));
 const ids=[...new Set(associations.map(r=>str(r.team_id)))];
 if(ids.length!==1)return row;
 const team=teams.find(t=>str(t.id)===ids[0]);
 if(!team)return row;
 const observedIds=new Set(associations.map(sourceId).filter(Boolean));
 if(observedIds.size>1)return row;
 const inputFm=sourceId(row),targetFm=str(team.fotmob_id);
 if(inputFm&&((targetFm&&inputFm!==targetFm)||(observedIds.size&&!observedIds.has(inputFm))))return row;
 return {...row,team_id:str(team.id),team_name:str(team.name),source_team_name:possessionSourceName(row),
  ...(targetFm&&!inputFm?{fotmob_team_id:targetFm}:{})};
}
