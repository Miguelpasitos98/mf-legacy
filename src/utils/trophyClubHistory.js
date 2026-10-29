// Read-only and evidence-first club history projection.
// Stats participation and candidate credits NEVER create a winner.
const txt=v=>String(v??"").trim();
const latestFirst=(a,b)=>txt(b.season).localeCompare(txt(a.season),"es",{numeric:true});
const good=(a)=>a?.verified===true&&a?.recipient_type==="Team";

export function buildClubTrophyHistory(teamId,{honours=[],credits=[],catalog=[],players=[]}={}){
 const owner=txt(teamId);
 const trophyById=new Map(catalog.map(t=>[txt(t.source_id),t]));
 const people=new Map(players.map(p=>[txt(p.id),p]));
 const verified=new Map(),aliases=new Map();
 for(const h of honours){
  if(!good(h)||txt(h.recipient_id)!==owner||!txt(h.trophy_source_id)||!txt(h.season))continue;
  const key=[txt(h.trophy_source_id),txt(h.season)].join("|");
  const previous=verified.get(key);
  // Deduplicate editions while preserving the IDs of duplicate imports:
  // previously confirmed players may still point at an older winner ID.
  if(!aliases.has(key))aliases.set(key,new Set());
  if(txt(h.id))aliases.get(key).add(txt(h.id));
  if(!previous||(h.source_url&&!previous.source_url))verified.set(key,h);
 }
 const editions=[...verified.values()].sort(latestFirst);
 const winnerById=new Map();
 for(const h of editions){
  const key=[txt(h.trophy_source_id),txt(h.season)].join("|");
  for(const aliasId of aliases.get(key)||[])winnerById.set(aliasId,h);
 }
 const creditGroups=new Map();
 for(const c of credits){
  if(!["candidate","confirmed"].includes(c.status)||txt(c.team_id)!==owner||!txt(c.player_id))continue;
  if(c.status==="confirmed"&&c.verified!==true)continue;
  const winner=winnerById.get(txt(c.trophy_honour_id));
  if(!winner||txt(c.season)!==txt(winner.season)||txt(c.trophy_source_id||winner.trophy_source_id)!==txt(winner.trophy_source_id))continue;
  const key=[txt(winner.trophy_source_id),txt(winner.season)].join("|");
  const group=creditGroups.get(key)||new Map();
  const playerId=txt(c.player_id);
  const prior=group.get(playerId);
  if(!prior||c.status==="confirmed"&&prior.status!=="confirmed"){
   group.set(playerId,{
    id:playerId,status:c.status,
    name:people.get(playerId)?.name||"Jugador",
    player:people.get(playerId)||null,
    evidence_url:txt(c.source_url)
   });
  }
  creditGroups.set(key,group);
 }
 const competitions=new Map(),years=new Map(),playerCounts=new Map(),detailedEditions=[];
 for(const h of editions){
  const trophyId=txt(h.trophy_source_id);
  const trophy=trophyById.get(trophyId)||{source_id:trophyId,name:trophyId};
  const linked=[...(creditGroups.get([trophyId,txt(h.season)].join("|"))||new Map()).values()];
  const byName=(a,b)=>a.name.localeCompare(b.name,"es");
  const confirmed=linked.filter(c=>c.status==="confirmed").sort(byName);
  const candidates=linked.filter(c=>c.status==="candidate").sort(byName);
  const record={...h,trophy,confirmedPlayers:confirmed,confirmedPlayerCount:confirmed.length,
   candidatePlayers:candidates,candidatePlayerCount:candidates.length};
  detailedEditions.push(record);
  const comp=competitions.get(trophyId)||{source_id:trophyId,trophy,name:trophy.name,count:0,editions:[],latest:""};
  comp.count++;comp.editions.push(record);
  if(!comp.latest||txt(h.season)>comp.latest)comp.latest=txt(h.season);
  competitions.set(trophyId,comp);
  const year=txt(h.season),seasonList=years.get(year)||[];
  seasonList.push(record);years.set(year,seasonList);
  for(const person of confirmed){
   const row=playerCounts.get(person.id)||{
    id:person.id,name:person.name,player:person.player,
    count:0,editions:[],trophyIds:new Set()
   };
   row.count++;row.editions.push(record);row.trophyIds.add(trophyId);playerCounts.set(person.id,row);
  }
 }
 const competitionList=[...competitions.values()].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,"es"));
 const timeline=[...years.entries()].map(([season,items])=>({
  season,editions:items.sort((a,b)=>a.trophy.name.localeCompare(b.trophy.name,"es")),
  count:items.length
 })).sort(latestFirst);
 const playerRanking=[...playerCounts.values()].map(p=>({...p,distinct:p.trophyIds.size}))
  .sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,"es"));
 return {
  teamId:owner,total:editions.length,distinct:competitionList.length,
  earliest:timeline.at(-1)?.season||"",latest:timeline[0]?.season||"",
  editions:detailedEditions,competitions:competitionList,timeline,players:playerRanking,
  confirmedPlayerCount:playerRanking.length
 };
}
