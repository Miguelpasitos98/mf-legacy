// Team trophies in the same descending reputation order as Players -> Teams.
// TrophyHonour verified awards are kept strictly separate from provisional FM24.
export function teamReputationValue(team){
 const raw=team?.reputation??team?.data?.reputation??team?.data?.team?.reputation??0;
 const numeric=Number(String(raw).replace(/,/g,"").replace(/\s+/g,"").trim());
 return Number.isFinite(numeric)&&numeric>=0?numeric:0;
}
const normalize=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
const seasonKey=v=>String(v||"").trim().replace(/\/(\d{4})$/,(_all,year)=>"/"+year.slice(-2));
const editionYear=edition=>{
 const explicit=Number(edition?.edition_year);
 if(Number.isInteger(explicit)&&explicit>1800)return explicit;
 const value=String(edition?.season||"");
 const match=value.match(/^(\d{4})\/(\d{2}|\d{4})$/);
 if(!match)return null;
 const start=Number(match[1]),end=match[2].length===4?Number(match[2]):Math.floor(start/100)*100+Number(match[2])+(Number(match[2])<=start%100?100:0);
 return end===start+1?end:null;
};
export function groupTrophiesByTeamReputation({teams=[],catalog=[],honours=[],editions=[],palmares=[],allowedIds=null,query="",sourceMode="all"}={}){
 const trophyById=new Map(catalog.map(t=>[String(t.source_id),t]));
 const groups=new Map();
 for(const team of teams){
  if(!team?.id)continue;
  const id=String(team.id);
  groups.set(id,{id,team,reputation:teamReputationValue(team),itemsById:new Map()});
 }
 const getItem=(teamId,sourceId)=>{
  const group=groups.get(String(teamId)),trophy=trophyById.get(String(sourceId));
  if(!group||!trophy||allowedIds&&!allowedIds.has(String(sourceId)))return null;
  const key=String(sourceId);
  if(!group.itemsById.has(key))group.itemsById.set(key,{
   trophy,verifiedCount:0,historicalCount:0,runnerUpCount:0,thirdCount:0,
   historicalYears:new Set(),runnerYears:new Set(),thirdYears:new Set(),seasons:new Set(),latest:""
  });
  return group.itemsById.get(key);
 };
 const seenHonours=new Set();
 for(const honour of honours){
  if(honour?.verified!==true||honour?.recipient_type!=="Team")continue;
  const fingerprint=honour.id?String(honour.id):[honour.recipient_id,honour.trophy_source_id,seasonKey(honour.season)].join("|");
  if(seenHonours.has(fingerprint))continue;seenHonours.add(fingerprint);
  const item=getItem(honour.recipient_id,honour.trophy_source_id);
  if(!item)continue;
  item.verifiedCount++;
  if(honour.season)item.seasons.add(seasonKey(honour.season));
 };
 const seenEditions=new Set();
 for(const edition of editions){
  const fingerprint=edition.edition_key||edition.id||[edition.champion_team_id,edition.trophy_source_id,seasonKey(edition.season)].join("|");
  if(seenEditions.has(fingerprint))continue;seenEditions.add(fingerprint);
  const item=getItem(edition.champion_team_id,edition.trophy_source_id);
  if(!item)continue;
  const year=editionYear(edition);
  if(year)item.historicalYears.add(year);
 }
 const seenPalmares=new Set();
 for(const entry of palmares){
  if(!["auto_linked","manual_linked"].includes(entry?.match_status)||!entry?.trophy_source_id||!entry?.team_id)continue;
  // The source is not officially verified. Only the raw matching club and trophy
  // are trusted for grouping purposes; never create a TrophyHonour here.
  const key=String(entry.entry_key||[entry.team_id,entry.trophy_source_id,entry.rank,entry.calendar_year].join("|"));
  if(seenPalmares.has(key))continue;seenPalmares.add(key);
  const item=getItem(entry.team_id,entry.trophy_source_id),year=Number(entry.calendar_year);
  if(!item||!Number.isInteger(year)||year<1800||year>2100)continue;
  if(entry.rank==="winner")item.historicalYears.add(year);
  else if(entry.rank==="runner_up")item.runnerYears.add(year);
  else if(entry.rank==="third")item.thirdYears.add(year);
 }
 const needle=normalize(query);
 return [...groups.values()].filter(group=>{
  if(!needle)return true;
  return normalize([group.team?.name,group.team?.short_name,group.team?.city].filter(Boolean).join(" ")).includes(needle);
 }).map(group=>{
  const items=[...group.itemsById.values()].map(item=>({
   trophy:item.trophy,verifiedCount:item.verifiedCount,historicalCount:item.historicalYears.size,
   runnerUpCount:item.runnerYears.size,thirdCount:item.thirdYears.size,
   seasons:[...item.seasons].sort(),historicalYears:[...item.historicalYears].sort(),latest:[...item.historicalYears].sort().at(-1)||""
  })).filter(item=>sourceMode==="verified"?item.verifiedCount>0:sourceMode==="historical"?(item.historicalCount+item.runnerUpCount+item.thirdCount)>0:true)
    .sort((a,b)=>(b.verifiedCount+b.historicalCount)-(a.verifiedCount+a.historicalCount)||String(a.trophy.name).localeCompare(String(b.trophy.name),"es",{sensitivity:"base"}));
  return {id:group.id,team:group.team,reputation:group.reputation,
   verifiedCount:items.reduce((n,item)=>n+item.verifiedCount,0),
   historicalCount:items.reduce((n,item)=>n+item.historicalCount,0),
   items};
 }).sort((a,b)=>b.reputation-a.reputation||String(a.team.name||"").localeCompare(String(b.team.name||""),"es",{sensitivity:"base"}));
}
