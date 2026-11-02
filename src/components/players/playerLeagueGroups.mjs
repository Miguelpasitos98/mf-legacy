/**
 * Current club league grouping (Team.league_id -> League.id).
 * Historical team affiliations are not inferred from the player card.
 * Every player appears exactly once, including those without a known league.
 */
const sortName=(a,b)=>String(a||"").localeCompare(String(b||""),"es",{sensitivity:"base"});
const EMPTY_LEAGUE_ID="__no_league__";
const EMPTY_TEAM_ID="__no_team__";
export function groupPlayersByLeague(players=[],teamById={},leagues=[]){
 const leagueById=new Map(leagues.filter(row=>row?.id).map(row=>[String(row.id),row]));
 const groups=new Map();
 for(const player of players){
  const team=teamById[String(player?.teamId||"")]||null;
  const leagueId=team?.leagueId||team?.league_id||"";
  const league=leagueById.get(String(leagueId))||null;
  const groupId=leagueId?String(leagueId):EMPTY_LEAGUE_ID;
  if(!groups.has(groupId))groups.set(groupId,{
   id:groupId,name:league?.name||(leagueId?"Liga pendiente de identificar":"Sin liga asignada"),
   logo:league?.logo||"",reputation:Number(league?.reputation)||0,
   teams:new Map(),count:0,unresolved:Boolean(leagueId&&!league)
  });
  const group=groups.get(groupId);
  const teamId=team?String(team.id):EMPTY_TEAM_ID;
  if(!group.teams.has(teamId))group.teams.set(teamId,{
    id:teamId,team,players:[],name:team?.name||"Sin equipo"
  });
  group.teams.get(teamId).players.push(player);
  group.count++;
 }
 return [...groups.values()].map(group=>({
  ...group,
  teams:[...group.teams.values()].sort((a,b)=>
   a.id===EMPTY_TEAM_ID?1:b.id===EMPTY_TEAM_ID?-1:sortName(a.name,b.name))
 })).sort((a,b)=>{
  if(a.id===EMPTY_LEAGUE_ID)return 1;
  if(b.id===EMPTY_LEAGUE_ID)return -1;
  if(a.unresolved!==b.unresolved)return a.unresolved?1:-1;
  return b.reputation-a.reputation||sortName(a.name,b.name);
 });
}
