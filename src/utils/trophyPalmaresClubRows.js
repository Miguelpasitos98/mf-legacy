export function trophyPalmaresClubRows(entries=[]){
 const groups=new Map();
 for(const row of entries){
  if(!["auto_linked","manual_linked"].includes(row?.match_status)||!row.team_id)continue;
  const year=Number(row.calendar_year);
  if(!Number.isInteger(year)||year<1800||year>2100)continue;
  const key=String(row.team_id);
  if(!groups.has(key))groups.set(key,{team_id:key,team_name:row.team_name||"",winner:new Set(),runner_up:new Set(),third:new Set()});
  if(["winner","runner_up","third"].includes(row.rank))groups.get(key)[row.rank].add(year);
 }
 return [...groups.values()].map(group=>({
  team_id:group.team_id,team_name:group.team_name,
  winner:[...group.winner].sort((a,b)=>b-a),runner_up:[...group.runner_up].sort((a,b)=>b-a),third:[...group.third].sort((a,b)=>b-a)
 })).sort((a,b)=>b.winner.length-a.winner.length||b.runner_up.length-a.runner_up.length||a.team_name.localeCompare(b.team_name,"es"));
}

