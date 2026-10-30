import {canonicalHistoricalClub,canonicalHistoricalCompetition} from "./historicalJson.js";
import {normalizeSeason} from "./historicalValuation.js";
const str=v=>String(v??"").trim();
const number=v=>v===null||v===undefined||str(v)===""?null:Number(str(v).replace(",","."));
export const possessionKey=(teamId,season,competition)=>[str(teamId),normalizeSeason(season),canonicalHistoricalCompetition(competition)].join("|");
export const possessionIdentity=row=>str(row.team_name)?canonicalHistoricalClub(row.team_name):"";
// A missing Base44 club is a pending association, NOT a reason to discard
// historical possession. Never create a Team from an external name alone.
export const possessionRecordKey=row=>possessionKey(possessionIdentity(row)||str(row.team_id),row.season,row.competition);
export function possessionPct(value){
 const v=number(value);
 return v!==null&&Number.isFinite(v)&&v>0&&v<100?v:null;
}
export function validatePossessionRow(row,teamList=[],{allowUnlinked=false}={}){
 const teams=teamList.filter(t=>t?.id);
 const id=str(row.team_id);
 const rawName=str(row.team_name||row.club||row.team);
 const name=canonicalHistoricalClub(rawName);
 const matches=id?teams.filter(t=>str(t.id)===id):teams.filter(t=>name&&canonicalHistoricalClub(t.name)===name);
 if(matches.length>1)throw Error("Varios clubes coinciden con este nombre. Hay que resolver la identidad.");
 if(id&&matches.length!==1)throw Error("El ID del club no existe en Base44.");
 const team=matches[0]||null;
 if(!team&&!allowUnlinked)throw Error("Club no reconocido: selecciona un club existente en Base44.");
 if(!team&&!rawName)throw Error("Sin vinculación, es obligatorio indicar el nombre del club.");
 if(id&&name&&canonicalHistoricalClub(team.name)!==name)throw Error("El nombre del club no coincide con su ID de Base44.");
 const season=normalizeSeason(row.season),span=season.match(/^(\d{4})\/(\d{4})$/);
 if(!(/^\d{4}$/.test(season)||(span&&+span[2]===+span[1]+1)))throw Error("Temporada inválida. Ejemplo: 2018/2019.");
 const competition=str(row.competition);
 if(!competition || !canonicalHistoricalCompetition(competition))throw Error("Indica la competición.");
 const pct=possessionPct(row.team_possession_pct??row.possession_pct??row.possession);
 if(pct===null)throw Error("Introduce la posesión media del equipo como porcentaje mayor que 0 y menor que 100 (ej. 67,9).");
 const url=str(row.source_url);
 if(url&&!/^https?:\/\/[^\s]+$/i.test(url))throw Error("La fuente debe ser una URL http(s) válida.");
 const mc=row.matches_covered===null||row.matches_covered===undefined||str(row.matches_covered)===""?null:Number(row.matches_covered);
 if(mc!==null&&(!Number.isInteger(mc)||mc<1||mc>200))throw Error("Partidos cubiertos debe ser un entero entre 1 y 200.");
 const idFotmob=str(row.fotmob_team_id||team?.fotmob_id);
 if(row.fotmob_team_id&&team?.fotmob_id&&str(team.fotmob_id)!==str(row.fotmob_team_id))throw Error("ID FotMob incompatible con el equipo.");
 return {team_id:team?str(team.id):"",team_name:team?str(team.name):rawName,
  ...(str(row.source_team_name)?{source_team_name:str(row.source_team_name)}:{}),
  ...(idFotmob?{fotmob_team_id:idFotmob}:{}),season,competition,
  team_possession_pct:pct,source:str(row.source)||"Manual",source_url:url,
  ...(mc!==null?{matches_covered:mc}:{}),
  verification_status:row.verification_status==="verified"?"verified":"pending",
  notes:str(row.notes)};
}
export function parsePossessionBatch(raw,teams){
 let data;
 try{data=typeof raw==="string"?JSON.parse(raw):raw;}catch{throw Error("El JSON no es válido.");}
 const items=Array.isArray(data)?data:Array.isArray(data?.records)?data.records:Array.isArray(data?.possessions)?data.possessions:null;
 if(!items||!items.length)throw Error('Se necesita un array JSON o un objeto con "records".');
 if(items.length>1000)throw Error("Máximo 1000 registros por lote.");
 const seen=new Set(),errors=[],rows=[];
 items.forEach((item,i)=>{
  try{
   if(!item||typeof item!=="object")throw Error("Registro inválido.");
   const row=validatePossessionRow(item,teams,{allowUnlinked:true});
   const key=possessionRecordKey(row);
   if(seen.has(key))throw Error("Club, temporada y competición duplicados en el lote.");
   seen.add(key);rows.push(row);
  }catch(e){errors.push("Fila "+(i+1)+": "+e.message);}
 });
 return {rows,errors};
}
export function matchingPossessionRecord(existingRows=[],row){
 const name=canonicalHistoricalClub(row.team_name);
 const matching=existingRows.filter(item=>
  canonicalHistoricalCompetition(item.competition)===canonicalHistoricalCompetition(row.competition) &&
  normalizeSeason(item.season)===normalizeSeason(row.season) &&
  ((row.team_id&&item.team_id&&str(row.team_id)===str(item.team_id)) ||
   (name&&[item.team_name,item.source_team_name].some(label=>canonicalHistoricalClub(label)===name))));
 if(matching.length>1)throw Error("Ya existen varios registros de esa combinación. Revisa duplicados antes de guardar.");
 return matching[0]||null;
}
export function possessionImportDecision(existing,row){
 if(!existing)return "create";
 if(existing.team_id&&!row.team_id)throw Error("El registro ya está vinculado: no se puede desvincular mediante una importación sin identidad.");
 if(Number(existing.team_possession_pct)===row.team_possession_pct&&
    str(existing.source_url)===str(row.source_url)&&
    str(existing.team_id)===str(row.team_id)&&
    str(existing.source)===str(row.source))return "unchanged";
 return "update";
}
export function createPossessionLookup(possessions=[],teams=[]){
 const canonicalIds=new Map();
 for(const t of teams){
  const name=canonicalHistoricalClub(t.name);
  if(!name||!t.id)continue;
  if(!canonicalIds.has(name))canonicalIds.set(name,new Set());
  canonicalIds.get(name).add(str(t.id));
 }
 const byId=new Map(),byFotmob=new Map(),byName=new Map();
 function push(map,key,value){
  if(!key)return;
  const prior=map.get(key);
  map.set(key,prior===undefined?value:(prior===null||prior!==value?null:value));
 }
 for(const row of possessions){
  const pct=possessionPct(row.team_possession_pct);
  if(pct===null)continue;
  const inputName=canonicalHistoricalClub(row.team_name);
  const exactId=teams.filter(t=>row.team_id&&str(t.id)===str(row.team_id));
  const named=teams.filter(t=>inputName&&canonicalHistoricalClub(t.name)===inputName);
  // Historical possession batches frequently contain an unresolved team_id.
  // Permit only an unambiguous exact canonical name match to an existing Team.
  // Explicit IDs must exist and agree with the supplied name.
  if(row.team_id&&exactId.length!==1)continue;
  const team=row.team_id?exactId[0]:named.length===1?named[0]:null;
  if(!team)continue;
  if(inputName&&canonicalHistoricalClub(team.name)!==inputName)continue;
  const season=normalizeSeason(row.season),comp=canonicalHistoricalCompetition(row.competition);
  const code=season+"|"+comp;
  push(byId,str(team.id)+"|"+code,pct);
  const fm=str(row.fotmob_team_id||team.fotmob_id);
  if(fm)push(byFotmob,fm+"|"+code,pct);
  const name=canonicalHistoricalClub(team.name);
  if(canonicalIds.get(name)?.size===1)push(byName,name+"|"+code,pct);
 }
 return row=>{
  const code=normalizeSeason(row.season)+"|"+canonicalHistoricalCompetition(row.competition);
  const matches=[
   row.team_id&&byId.get(str(row.team_id)+"|"+code),
   row.fotmob_team_id&&byFotmob.get(str(row.fotmob_team_id)+"|"+code),
   row.team_name&&byName.get(canonicalHistoricalClub(row.team_name)+"|"+code)
  ].filter(v=>v!==undefined&&v!==""&&v!==false);
  if(!matches.length||matches.some(v=>v===null)||new Set(matches).size>1)return null;
  return matches[0];
 };
}
// Possession normalised to a neutral 50% share of match possession.
// Experimental MF LEGACY convention, not verified as CraftedFC's code.
// Explicit provider "Defensive actions" wins; reconstruction requires ALL FOUR
// components, and never guesses a missing component as zero.
export function defensiveActionsTotal(row,getTotal){
 const direct=getTotal(row,["Defensive actions"]);
 if(direct!==null&&direct!==undefined&&Number.isFinite(Number(direct))&&Number(direct)>=0)
  return {value:Number(direct),method:"direct"};
 const components=[
  ["Tackles","Tackles won"],
  ["Interceptions"],
  ["Clearances"],
  ["Blocked shots","Blocked scoring attempts","Blocked scoring attempt"]
 ];
 const values=components.map(names=>getTotal(row,names));
 if(values.some(v=>v===null||v===undefined||!Number.isFinite(Number(v))||Number(v)<0))
  return {value:null,method:"missing_actions"};
 return {value:values.reduce((s,n)=>s+Number(n),0),method:"reconstructed"};
}
export function possessionAdjustedDefActionsDetail(records=[],getTotal,getPossession){
 const result={value:null,covered:0,total:records.length,minutesCovered:0,minutesTotal:0,excluded:[],methods:[]};
 if(!records.length||typeof getTotal!=="function"||typeof getPossession!=="function")return result;
 let adjusted=0;
 for(const row of records){
  const minutes=number(row.minutes),pct=getPossession(row),actions=defensiveActionsTotal(row,getTotal);
  if(minutes!==null&&minutes>0)result.minutesTotal+=minutes;
  const reasons=[];
  if(minutes===null||minutes<=0)reasons.push("minutes");
  if(possessionPct(pct)===null)reasons.push("team_possession");
  if(actions.value===null)reasons.push("defensive_actions");
  if(reasons.length){
   result.excluded.push({season:row.season,competition:row.competition,team:row.team_name||"",reasons});
   continue;
  }
  adjusted+=actions.value*50/(100-pct);
  result.minutesCovered+=minutes;
  result.covered++;
  result.methods.push(actions.method);
 }
 if(result.minutesCovered>0)result.value=adjusted*90/result.minutesCovered;
 return result;
}
// Backwards-compatible strict API: partial coverage requires callers to
// explicitly opt into the detailed result, never silently return a full-season value.
export function possessionAdjustedDefActions(records=[],getTotal,getPossession){
 const detail=possessionAdjustedDefActionsDetail(records,getTotal,getPossession);
 return detail.covered===detail.total?detail.value:null;
}
