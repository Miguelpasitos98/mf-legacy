// A strictly separate view of source-extracted FM24 records.
// These are NOT officially verified TrophyHonour records.
const normal=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
export function fm24PalmaresOverview(entries=[],catalog=[],teams=[],{query="",rank="all",season="all"}={}){
 const trophyMap=new Map(catalog.map(t=>[String(t.source_id),t]));
 const teamMap=new Map(teams.map(t=>[String(t.id),t]));
 const groups=new Map();
 let linked=0,pending=0,ignored=0;
 const seen=new Set();
 for(const entry of entries){
  const key=String(entry.entry_key||entry.id||[entry.team_id,entry.trophy_name_raw,entry.rank,entry.calendar_year].join("|"));
  if(seen.has(key))continue;
  seen.add(key);
  if(entry.match_status==="ignored"){ignored++;continue;}
  const isLinked=["auto_linked","manual_linked"].includes(entry.match_status)&&Boolean(entry.trophy_source_id)&&Boolean(teamMap.get(String(entry.team_id)))&&Boolean(trophyMap.get(String(entry.trophy_source_id)));
  if(!isLinked){pending++;continue;}
  linked++;
  const year=Number(entry.calendar_year);
  if(!Number.isInteger(year)||year<1800||year>2100||!["winner","runner_up","third"].includes(entry.rank))continue;
  if(rank!=="all"&&rank!==entry.rank)continue;
  if(season!=="all"&&String(year)!==String(season))continue;
  const team=teamMap.get(String(entry.team_id)),trophy=trophyMap.get(String(entry.trophy_source_id));
  const search=[team.name,trophy.name,entry.trophy_name_raw,team.short_name,year].map(normal).join(" ");
  if(query&&!search.includes(normal(query)))continue;
  const teamId=String(team.id);
  if(!groups.has(teamId))groups.set(teamId,{team,team_id:teamId,competitions:new Map(),total:0,winner:0,runner_up:0,third:0});
  const group=groups.get(teamId),trophyId=String(trophy.source_id);
  if(!group.competitions.has(trophyId))group.competitions.set(trophyId,{trophy,source_id:trophyId,years:{winner:new Set(),runner_up:new Set(),third:new Set()},notes:new Set()});
  const item=group.competitions.get(trophyId);
  item.years[entry.rank].add(year);
  if(entry.source_note)item.notes.add(entry.source_note);
 }
 const results=[...groups.values()].map(g=>{
  const competitions=[...g.competitions.values()].map(c=>({
   trophy:c.trophy,source_id:c.source_id,
   winner:[...c.years.winner].sort((a,b)=>b-a),
   runner_up:[...c.years.runner_up].sort((a,b)=>b-a),
   third:[...c.years.third].sort((a,b)=>b-a),
   description:[...c.notes][0]||""
  })).sort((a,b)=>b.winner.length-a.winner.length||a.trophy.name.localeCompare(b.trophy.name,"es"));
  return {...g,competitions,
   winner:competitions.reduce((n,c)=>n+c.winner.length,0),
   runner_up:competitions.reduce((n,c)=>n+c.runner_up.length,0),
   third:competitions.reduce((n,c)=>n+c.third.length,0),
   total:competitions.reduce((n,c)=>n+c.winner.length+c.runner_up.length+c.third.length,0)
  };
 }).sort((a,b)=>Number(String(b.team.reputation||0).replace(/[, ]/g,""))-Number(String(a.team.reputation||0).replace(/[, ]/g,""))||a.team.name.localeCompare(b.team.name,"es"));
 return {teams:results,source:{entries:seen.size,linked,pending,ignored},totals:{
  teams:results.length,competitions:results.reduce((n,g)=>n+g.competitions.length,0),
  winner:results.reduce((n,g)=>n+g.winner,0),runner_up:results.reduce((n,g)=>n+g.runner_up,0),third:results.reduce((n,g)=>n+g.third,0)
 }};
}
