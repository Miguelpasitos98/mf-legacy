import {canonicalHistoricalClub,canonicalHistoricalCompetition} from "./historicalJson.js";
import {normalizeSeason} from "./historicalValuation.js";
const str=v=>String(v??"").trim();
const number=v=>v===null||v===undefined||str(v)===""?null:Number(str(v).replace(",","."));
export const possessionKey=(teamId,season,competition)=>[str(teamId),normalizeSeason(season),canonicalHistoricalCompetition(competition)].join("|");
export function possessionPct(value){
 const v=number(value);
 return v!==null&&Number.isFinite(v)&&v>0&&v<100?v:null;
}
export function validatePossessionRow(row,teamList=[]){
 const teams=teamList.filter(t=>t?.id);
 const id=str(row.team_id);
 const name=canonicalHistoricalClub(row.team_name||row.club||row.team);
 const team=id?teams.find(t=>str(t.id)===id):(()=>{
  const matched=teams.filter(t=>canonicalHistoricalClub(t.name)===name);
  return matched.length===1?matched[0]:null;
 })();
 if(!team)throw Error("Club no reconocido o ambiguo: selecciona un club existente en Base44.");
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
 const idFotmob=str(row.fotmob_team_id||team.fotmob_id);
 if(row.fotmob_team_id&&team.fotmob_id&&str(team.fotmob_id)!==str(row.fotmob_team_id))throw Error("ID FotMob incompatible con el equipo.");
 return {team_id:str(team.id),team_name:str(team.name),...(idFotmob?{fotmob_team_id:idFotmob}:{}),season,competition,
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
   const row=validatePossessionRow(item,teams);
   const key=possessionKey(row.team_id,row.season,row.competition);
   if(seen.has(key))throw Error("Club, temporada y competición duplicados en el lote.");
   seen.add(key);rows.push(row);
  }catch(e){errors.push("Fila "+(i+1)+": "+e.message);}
 });
 return {rows,errors};
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
  if(pct===null||!row.team_id)continue;
  const team=teams.find(t=>str(t.id)===str(row.team_id));
  if(!team)continue; // require an existing, verified Base44 club identity
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
export function possessionAdjustedDefActions(records=[],getTotal,getPossession){
 if(!records.length||typeof getTotal!=="function"||typeof getPossession!=="function")return null;
 let adjusted=0,minsSum=0;
 for(const row of records){
  const actions=getTotal(row,["Defensive actions"]),minutes=number(row.minutes),pct=getPossession(row);
  if(actions===null||actions===undefined||!Number.isFinite(Number(actions))||Number(actions)<0||
     minutes===null||minutes<=0||pct===null||pct===undefined||possessionPct(pct)===null)return null;
  adjusted+=Number(actions)*50/(100-pct);
  minsSum+=minutes;
 }
 return minsSum>0?adjusted*90/minsSum:null;
}
