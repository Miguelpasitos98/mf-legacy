// Read-only reconciliation of TrophyHonour, TrophyPalmaresEntry and TrophyEdition.
// One display record per competition + club + position + calendar year.
// A verified TrophyHonour can enrich the same FM24 entry without elevating the FM24 source.
const text=v=>String(v??"").trim();
const normalize=v=>text(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const teamName=v=>normalize(v).replace(/[^a-z0-9]+/g," ").trim();
export function honourEndYear(season){
 const raw=text(season),m=raw.match(/^(\d{4})\/(\d{2}|\d{4})$/);
 if(m){
  const begin=Number(m[1]),value=Number(m[2]);
  const end=m[2].length===4?value:Math.floor(begin/100)*100+value+(value<=begin%100?100:0);
  return end===begin+1?end:null;
 }
 return /^\d{4}$/.test(raw)?Number(raw):null;
}
export function historicalFinalYear(edition){
 const given=Number(edition?.edition_year);
 if(Number.isInteger(given)&&given>1800)return given;
 return honourEndYear(edition?.season);
}
export function unifiedTrophyClubHistory({honours=[],palmares=[],editions=[],teams=[]}={}){
 const teamMap=new Map(teams.map(t=>[text(t.id),t]));
 const byTeam=new Map(),withoutYear=[];
 const getTeam=(id,name)=>{
  const key=text(id)||"name:"+teamName(name);
  if(!key||key==="name:")return null;
  if(!byTeam.has(key))byTeam.set(key,{team_id:text(id),name:teamMap.get(text(id))?.name||text(name)||"Equipo",team:teamMap.get(text(id))||null,records:new Map()});
  return byTeam.get(key);
 };
 const add=(club,{rank,year,source,verified=false,season="",reference="",sourceKey=""})=>{
  if(!club||!["winner","runner_up","third"].includes(rank)||!Number.isInteger(year)||year<1800||year>2100)return;
  const key=rank+"|"+year;
  let record=club.records.get(key);
  if(!record){record={rank,year,verified:false,verifiedSeasons:new Set(),sources:new Set(),sourceIds:new Set(),references:new Set()};club.records.set(key,record);}
  record.sources.add(source);
  if(sourceKey)record.sourceIds.add(sourceKey);
  if(reference)record.references.add(reference);
  if(verified){record.verified=true;if(season)record.verifiedSeasons.add(season);}
 };
 for(const h of honours){
  if(h?.recipient_type!=="Team"||!h?.recipient_id||h.verified!==true)continue;
  const club=getTeam(h.recipient_id,h.recipient_name);
  const year=honourEndYear(h.season);
  if(!year){withoutYear.push(h);continue;}
  add(club,{rank:"winner",year,source:"official",verified:true,season:text(h.season),reference:text(h.source_url),sourceKey:text(h.id)});
 }
 for(const row of palmares){
  if(!["auto_linked","manual_linked"].includes(row?.match_status)||!row?.team_id)continue;
  const year=Number(row.calendar_year);
  const club=getTeam(row.team_id,row.team_name);
  add(club,{rank:row.rank,year,source:"fm24",sourceKey:text(row.entry_key||row.id)});
 }
 for(const row of editions){
  if(!row?.champion_team_id)continue;
  const year=historicalFinalYear(row),club=getTeam(row.champion_team_id,row.champion_name);
  add(club,{rank:"winner",year,source:"rob_final",sourceKey:text(row.edition_key||row.id)});
  // Runner-up can only be assigned if there is an explicit Team link.
  if(row?.runner_up_team_id){
   add(getTeam(row.runner_up_team_id,row.runner_up_name),{rank:"runner_up",year,source:"rob_final",sourceKey:text(row.edition_key||row.id)});
  }
 }
 const clubs=[...byTeam.values()].map(c=>{
  const records=[...c.records.values()].map(r=>({...r,verifiedSeasons:[...r.verifiedSeasons].sort(),sources:[...r.sources],sourceIds:[...r.sourceIds],references:[...r.references]})).sort((a,b)=>b.year-a.year||["winner","runner_up","third"].indexOf(a.rank)-["winner","runner_up","third"].indexOf(b.rank));
  const yearsFor=rank=>records.filter(r=>r.rank===rank);
  const wins=yearsFor("winner");
  return {team_id:c.team_id,name:c.name,team:c.team,records,
   winner:wins,runner_up:yearsFor("runner_up"),third:yearsFor("third"),
   verifiedWins:wins.filter(w=>w.verified).length,provisionalWins:wins.filter(w=>!w.verified).length};
 }).sort((a,b)=>b.winner.length-a.winner.length||b.verifiedWins-a.verifiedWins||a.name.localeCompare(b.name,"es"));
 return {clubs,orphanHonours:withoutYear,totals:{
  winner:clubs.reduce((n,c)=>n+c.winner.length,0),
  runner_up:clubs.reduce((n,c)=>n+c.runner_up.length,0),
  third:clubs.reduce((n,c)=>n+c.third.length,0),
  verified:clubs.reduce((n,c)=>n+c.verifiedWins,0)
 }};
}
