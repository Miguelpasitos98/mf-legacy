import {normaliseSearch} from "./trophyCatalog.js";
import {trophySeason} from "./trophySync.js";

const id=value=>String(value??"").trim();
const normalize=value=>normaliseSearch(value).replace(/[^a-z0-9]+/g," ").trim();
const aliasRules=[
 [/^(uefa )?champions league$|^liga de campeones$/,"uefa champions league"],
 [/^(uefa )?europa league$|^liga europa$/,"uefa europa league"],
 [/^(uefa )?europa conference league$|^conference league$/,"uefa conference league"],
 [/^la ?liga( ea sports)?$|^primera division( espanola)?$/,"laliga"],
 [/^copa del rey$/,"copa del rey"],
 [/^supercopa de espana$/,"supercopa de espana"],
 [/^(english )?premier league$/,"premier league"],
 [/^(the )?fa cup$|^fa cup$/,"fa cup"],
 [/^efl cup$|^carabao cup$|^league cup$/,"efl cup"],
 [/^bundesliga$/,"bundesliga"],
 [/^dfb pokal$/,"dfb pokal"],
 [/^ligue 1( mcdonalds| uber eats)?$/,"ligue 1"],
 [/^coupe de france$/,"coupe de france"],
 [/^serie a( enilive)?$/,"serie a"],
 [/^coppa italia$/,"coppa italia"],
 [/^eredivisie$/,"eredivisie"],
 [/^knvb beker$/,"knvb beker"],
 [/^primeira liga$|^liga portugal( betclic)?$/,"primeira liga"],
 [/^taca de portugal$/,"taca de portugal"]
];
export const normalizedTrophyCompetition=value=>{
 const norm=normalize(value);
 return aliasRules.find(([rule])=>rule.test(norm))?.[1]||norm;
};
export const trophyCreditLogicalKey=(teamId,season,trophySourceId,playerId)=>
 [id(teamId),trophySeason(season),id(trophySourceId),id(playerId)].join("|");
// Creates a plan, not persisted credits. Never creates a title.
// Exact identity and competition are mandatory; no name-only player matching.
export function planIncrementalTrophyCredits({
 honours=[],stats=[],credits=[],players=[],teams=[],trophies=[]
}={}){
 const playersById=new Set(players.map(p=>id(p.id)).filter(Boolean));
 const teamsById=new Set(teams.map(t=>id(t.id)).filter(Boolean));
 const trophiesById=new Map(trophies.map(t=>[id(t.source_id),t]));
 const existing=new Set();
 for(const c of credits){
  if(!c?.player_id||!c?.team_id||!c?.season)continue;
  const key=trophyCreditLogicalKey(c.team_id,c.season,c.trophy_source_id,c.player_id);
  if(c.trophy_source_id)existing.add(key);
  // Also preserve legacy credits that lack trophy_source_id.
  if(!c.trophy_source_id){
   const winner=honours.find(h=>id(h.id)===id(c.trophy_honour_id));
   if(winner)existing.add(trophyCreditLogicalKey(c.team_id,c.season,winner.trophy_source_id,c.player_id));
  }
 }
 const seasons=new Map(),participants=new Map();
 // Aggregate per player, per team, per season, per normalized competition.
 for(const row of stats){
  const playerId=id(row.player_id),teamId=id(row.team_id),season=trophySeason(row.season);
  const competition=normalizedTrophyCompetition(row.competition);
  if(!playerId||!teamId||!season||!competition||!(Number(row.appearances)>0))continue;
  if(!playersById.has(playerId)||!teamsById.has(teamId))continue;
  const key=[teamId,season,competition].join("|");
  const people=participants.get(key)||new Map();
  const entry=people.get(playerId)||{player_id:playerId,team_id:teamId,season,competition,matches:0,competition_names:new Set()};
  entry.matches+=Number(row.appearances)||0;
  entry.competition_names.add(id(row.competition));
  people.set(playerId,entry);participants.set(key,people);
  const bucket=seasons.get([teamId,season].join("|"))||new Set();
  bucket.add(playerId);seasons.set([teamId,season].join("|"),bucket);
 }
 const byEdition=new Map();
 for(const honour of honours){
  if(honour.recipient_type!=="Team"||honour.verified!==true)continue;
  const teamId=id(honour.recipient_id),season=trophySeason(honour.season);
  const sourceId=id(honour.trophy_source_id),trophy=trophiesById.get(sourceId);
  if(!honour.id||!teamId||!teamsById.has(teamId)||!season||!sourceId||!trophy||
    trophy.identification_status==="Pending"||trophy.trophy_type==="Individual Trophy")continue;
  const edition=trophyCreditLogicalKey(teamId,season,sourceId,"");
  const registered=byEdition.get(edition);
  if(registered){
   // All duplicate champion IDs point to the same logical trophy edition.
   if(registered.honour.source_url&&!honour.source_url)continue;
   if(!registered.honour.source_url&&honour.source_url)byEdition.set(edition,{honour,teamId,season,sourceId,trophy});
  }else byEdition.set(edition,{honour,teamId,season,sourceId,trophy});
 }
 const plans=[],review=[],skipped=[];
 const ordered=[...byEdition.values()].sort((a,b)=>a.teamId.localeCompare(b.teamId)||a.season.localeCompare(b.season)||a.sourceId.localeCompare(b.sourceId));
 for(const entry of ordered){
  const comp=normalizedTrophyCompetition(entry.trophy.name);
  const key=[entry.teamId,entry.season,comp].join("|");
  const matching=participants.get(key);
  const teamPlayers=seasons.get([entry.teamId,entry.season].join("|"));
  if(!matching?.size){
   review.push({team_id:entry.teamId,season:entry.season,trophy_source_id:entry.sourceId,
    trophy_name:entry.trophy.name,reason:teamPlayers?.size?
     "Hay jugadores de ese club y temporada, pero no consta participación en esta competición.":
     "No hay estadísticas con jugadores vinculados a ese club y temporada."});
   continue;
  }
  for(const participant of matching.values()){
   const creditKey=trophyCreditLogicalKey(entry.teamId,entry.season,entry.sourceId,participant.player_id);
   if(existing.has(creditKey)){
    skipped.push(creditKey);continue;
   }
   existing.add(creditKey);
   plans.push({
    key:creditKey,
    player_id:participant.player_id,team_id:entry.teamId,
    season:entry.season,trophy_honour_id:id(entry.honour.id),
    trophy_source_id:entry.sourceId,
    trophy_name:entry.trophy.name,matches:participant.matches,
    status:"candidate",verified:false,source_url:"",
    evidence_type:"competition_appearance",
    evidence_note:participant.matches+" apariciones registradas en "+
     [...participant.competition_names].join(", ")+
     " (STATS). Participación pendiente de acreditar como elegibilidad para el título."
   });
  }
 }
 return {plans,review,skipped:skipped.length,
  editions:ordered.length,
  seasons:[...new Set(plans.map(x=>x.season))].sort((a,b)=>b.localeCompare(a,"es",{numeric:true}))};
}
