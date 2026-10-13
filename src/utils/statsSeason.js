// Resúmenes de temporada derivados. No se guardan ni alteran registros FotMob.
import {aggregate, groupStatRows, metricsValue, nationalCompetition, norm, resolveTeam, statNum} from "./statsViews.js";

const SUM_KEYS=["appearances","minutes","goals","assists","xg","xa","shots","shotsontarget","xgot","tackles","recoveries","interceptions","clearances","cleansheets","chancescreated","bigchancescreated","accuratepasses","successfulcrosses","saves","goalsconcededwhileonpitch","totaldistancecovered","numberofsprints"];
const groupId=row=>String(row.player_id||row.fotmob_player_id||"");

export function seasonSummary(rows,teams=[]){
 const records=groupStatRows(rows).filter(r=>!nationalCompetition(r.competition));
 if(!records.length)return null;
 const season=records[0].season;
 const totals=aggregate(records,SUM_KEYS);
 const rated=records.filter(r=>statNum(r.rating)!==null && statNum(r.appearances)>0);
 const ratingMatches=rated.reduce((n,r)=>n+Number(r.appearances),0);
 const weightedRating=ratingMatches>0?rated.reduce((n,r)=>n+Number(r.rating)*Number(r.appearances),0)/ratingMatches:null;
 const clubs=new Map();
 let unresolved=0;
 for(const r of records){
  const resolution=resolveTeam(r,teams,records);
  if(resolution.status!=="confirmed"||!resolution.team){unresolved++;continue;}
  const club=resolution.team;
  const id=String(club.id);
  if(!clubs.has(id))clubs.set(id,{team:club,minutes:0,matches:0,records:0});
  const entry=clubs.get(id);
  entry.minutes+=Math.max(0,statNum(r.minutes)||0);
  entry.matches+=Math.max(0,statNum(r.appearances)||0);
  entry.records++;
 }
 const ordered=[...clubs.values()].sort((a,b)=>b.minutes-a.minutes||b.matches-a.matches||a.team.name.localeCompare(b.team.name,"es"));
 const mainClub=ordered[0]?.team||null;
 // Los ratios solo se presentan cuando TODOS los registros contienen los datos necesarios.
 const minutes=totals.minutes;
 const safePer90=key=>{
  const metric=totals[key];
  if(!metric||metric.value===null||metric.partial||!minutes||minutes.partial||!Number.isFinite(minutes.value)||minutes.value<=0)return null;
  return metric.value*90/minutes.value;
 };
 const goals=totals.goals,assists=totals.assists,xg=totals.xg,xa=totals.xa;
 const combined=(one,two)=>{
  if(!one||!two||one.value===null||two.value===null)return null;
  return {value:one.value+two.value,partial:one.partial||two.partial};
 };
 const ga=combined(goals,assists),xga=combined(xg,xa);
 const per90combined=combinedTotal=>{
  if(!combinedTotal||combinedTotal.partial||minutes.value===null||minutes.partial||minutes.value<=0)return null;
  return combinedTotal.value*90/minutes.value;
 };
 return {
  id:groupId(records[0])+"|"+season,
  player_id:records[0].player_id||"",
  fotmob_player_id:records[0].fotmob_player_id||"",
  player_name:records.find(r=>r.player_name)?.player_name||"",
  season, records,
  mainClub, otherClubs:ordered.slice(1).map(c=>c.team), clubsKnown:ordered.length,
  unresolvedTeams:unresolved, competitions:records.length,
  activeVerification:records.some(r=>r.review_status==="pending"||r.verification_status==="pendiente_revision"||String(r.verification_status||"").includes("no_verificada")),
  totals,
  weightedRating, ratingPartial:rated.length!==records.length,
  goalsAndAssists:ga, xgAndXa:xga,
  per90:{
   goals:safePer90("goals"),assists:safePer90("assists"),xg:safePer90("xg"),xa:safePer90("xa"),
   ga:per90combined(ga),
   xga:per90combined(xga)
  },
  // Identifica si hay competiciones incompletas, no afirma haber encontrado todas.
  partial:Object.values(totals).some(v=>v.partial)
 };
}
export function buildSeasonSummaries(rows,teams=[]){
 const grouped=new Map();
 for(const r of rows||[]){
  if(!groupId(r)||!r.season||nationalCompetition(r.competition))continue;
  const key=groupId(r)+"|"+r.season;
  if(!grouped.has(key))grouped.set(key,[]);
  grouped.get(key).push(r);
 }
 return [...grouped.values()].map(r=>seasonSummary(r,teams)).filter(Boolean);
}
export function statDisplay(summary,key){
 if(!summary)return null;
 if(key==="rating")return summary.weightedRating;
 if(key==="ga")return summary.goalsAndAssists?.value??null;
 if(key==="xga")return summary.xgAndXa?.value??null;
 if(key==="goalsper90")return summary.per90.goals;
 if(key==="assistsper90")return summary.per90.assists;
 if(key==="gaper90")return summary.per90.ga;
 if(key==="xgper90")return summary.per90.xg;
 if(key==="xaper90")return summary.per90.xa;
 if(key==="xgaper90")return summary.per90.xga;
 return summary.totals[key]?.value??null;
}
