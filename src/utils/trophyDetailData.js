// Read-only projections for the trophy archive. Verification gates are used
// consistently in the overview, club ranking and player award totals.
const id=value=>String(value??"").trim();
const seasonOrder=(a,b)=>id(b.season).localeCompare(id(a.season),"es",{numeric:true});
const dedupe=(rows,keyFor)=>{
 const seen=new Set();
 return (rows||[]).filter(item=>{const key=keyFor(item);if(seen.has(key))return false;seen.add(key);return true;});
};
export const trophyEditionRows=honours=>
 dedupe(honours,h=>[h.recipient_type,h.recipient_id,h.season].map(id).join("|"))
  .sort(seasonOrder);

export function trophyDetailSummary(honours=[]){
 const editions=trophyEditionRows(honours);
 const verified=editions.filter(h=>h.verified===true);
 const teamAwards=verified.filter(h=>h.recipient_type==="Team");
 const teams=new Set(teamAwards.map(h=>id(h.recipient_id)));
 return {
  all:editions,verified,teamAwards,
  verifiedCount:verified.length,pendingCount:editions.length-verified.length,
  clubCount:teams.size,
  newest:verified[0]?.season||"",
  earliest:verified.length?verified[verified.length-1].season:""
 };
}
export function trophyClubRanking(honours=[]){
 const verified=trophyEditionRows(honours).filter(h=>h.verified===true&&h.recipient_type==="Team");
 const clubs=new Map();
 for(const h of verified){
  const key=id(h.recipient_id);if(!key)continue;
  const entry=clubs.get(key)||{team_id:key,name:h.recipient_name||"Equipo",count:0,seasons:[]};
  entry.count++;entry.seasons.push(h.season);clubs.set(key,entry);
 }
 return [...clubs.values()].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,"es"));
}
// Return titles credited to a player only after BOTH winner and individual
// entitlement are verified. A participation candidate never counts as a win.
export function trophyPlayerRanking(honours=[],credits=[],players=[]){
 const verified=trophyEditionRows(honours).filter(h=>h.verified===true);
 const byHonourId=new Map(verified.map(h=>[id(h.id),h]));
 const playersById=new Map(players.map(p=>[id(p.id),p]));
 const awardKeys=new Set(),totals=new Map();
 const credit=(playerId,season,kind,h)=>{
  const key=[playerId,h.trophy_source_id,season,kind].join("|");
  if(awardKeys.has(key))return;
  awardKeys.add(key);
  const p=playersById.get(id(playerId));
  const row=totals.get(playerId)||{player_id:playerId,name:p?.name||"Jugador",count:0,collective:0,individual:0,seasons:[]};
  row.count++;row[kind==="individual"?"individual":"collective"]++;row.seasons.push(season);
  totals.set(playerId,row);
 };
 for(const h of verified){
  if(h.recipient_type==="Player"&&h.recipient_id)credit(id(h.recipient_id),h.season,"individual",h);
 }
 for(const c of credits||[]){
  if(c.status!=="confirmed"||c.verified!==true)continue;
  const honour=byHonourId.get(id(c.trophy_honour_id));
  if(!honour||honour.recipient_type!=="Team")continue;
  if(id(c.team_id)!==id(honour.recipient_id)||id(c.season)!==id(honour.season))continue;
  if(id(c.player_id))credit(id(c.player_id),honour.season,"collective",honour);
 }
 return [...totals.values()].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,"es"));
}
