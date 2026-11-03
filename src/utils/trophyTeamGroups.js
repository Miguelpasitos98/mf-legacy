// Groups ALL teams exactly like Players -> Teams. No inferred trophy ownership.
export function teamReputationValue(team){
 const raw=team?.reputation??team?.data?.reputation??team?.data?.team?.reputation??0;
 const numeric=Number(String(raw).replace(/,/g,"").replace(/\s+/g,"").trim());
 return Number.isFinite(numeric)&&numeric>=0?numeric:0;
}
const normalize=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
const seasonKey=v=>String(v||"").trim().replace(/\/(\d{4})$/,(_all,year)=>"/"+year.slice(-2));
export function groupTrophiesByTeamReputation({teams=[],catalog=[],honours=[],editions=[],allowedIds=null,query="",sourceMode="all"}={}){
 const trophyById=new Map(catalog.map(t=>[String(t.source_id),t]));
 const groups=new Map();
 for(const team of teams){
  if(!team?.id)continue;
  const id=String(team.id);
  groups.set(id,{id,team,reputation:teamReputationValue(team),itemsById:new Map(),verifiedCount:0,historicalCount:0});
 }
 const attach=(teamId,sourceId,kind,season)=>{
  const group=groups.get(String(teamId)),trophy=trophyById.get(String(sourceId));
  if(!group||!trophy||allowedIds&&!allowedIds.has(String(sourceId)))return;
  const id=String(sourceId);
  let item=group.itemsById.get(id);
  if(!item){item={trophy,verifiedCount:0,historicalCount:0,seasons:new Set(),latest:""};group.itemsById.set(id,item);}
  if(kind==="verified"){item.verifiedCount++;group.verifiedCount++;}
  else{item.historicalCount++;group.historicalCount++;}
  const normalized=seasonKey(season);
  if(normalized){item.seasons.add(normalized);if(normalized>item.latest)item.latest=normalized;}
 };
 const seenHonours=new Set();
 for(const honour of honours){
  if(honour?.verified!==true||honour?.recipient_type!=="Team")continue;
  const fingerprint=honour.id?String(honour.id):[honour.recipient_id,honour.trophy_source_id,seasonKey(honour.season)].join("|");
  if(seenHonours.has(fingerprint))continue;
  seenHonours.add(fingerprint);
  attach(honour.recipient_id,honour.trophy_source_id,"verified",honour.season);
 }
 const seenEditions=new Set();
 for(const edition of editions){
  const fingerprint=edition.edition_key||edition.id||[edition.champion_team_id,edition.trophy_source_id,seasonKey(edition.season)].join("|");
  if(seenEditions.has(fingerprint))continue;seenEditions.add(fingerprint);
  attach(edition.champion_team_id,edition.trophy_source_id,"historical",edition.season);
 }
 const needle=normalize(query);
 return [...groups.values()].filter(group=>{
  if(!needle)return true;
  return normalize([group.team?.name,group.team?.short_name,group.team?.city].filter(Boolean).join(" ")).includes(needle);
 }).map(group=>({
  id:group.id,team:group.team,reputation:group.reputation,verifiedCount:group.verifiedCount,historicalCount:group.historicalCount,
  items:[...group.itemsById.values()].filter(item=>sourceMode==="verified"?item.verifiedCount>0:sourceMode==="historical"?item.historicalCount>0:true)
   .sort((a,b)=>(b.verifiedCount+b.historicalCount)-(a.verifiedCount+a.historicalCount)||String(a.trophy.name).localeCompare(String(b.trophy.name),"es",{sensitivity:"base"}))
 })).sort((a,b)=>b.reputation-a.reputation||String(a.team.name||"").localeCompare(String(b.team.name||""),"es",{sensitivity:"base"}));
}
