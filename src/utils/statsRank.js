// Ranking visible y general a partir del mismo conjunto de datos y ordenación.
// El ranking general se calcula ANTES de aplicar la búsqueda de jugadores.
export const rankIdentity=(entry,mode)=>{
 if(mode==="season")return entry?.summary?.id?String(entry.summary.id):null;
 const record=entry?.record;
 if(!record)return null;
 return String(record.id||record.external_record_id||[
   record.player_id||record.fotmob_player_id||"",
   record.season||"",
   record.competition||"",
   record.team_id||record.fotmob_team_id||record.team_name||""
 ].join("|"));
};
export function playerRankPositions(sortedItems,mode){
 const counts=new Map(),positions=new Map();
 for(const entry of sortedItems||[]){
  const id=mode==="season"?entry?.summary?.player_id||entry?.summary?.fotmob_player_id||entry?.player?.id:entry?.record?.player_id||entry?.record?.fotmob_player_id||entry?.player?.id;
  const key=rankIdentity(entry,mode);
  if(!id||!key)continue;
  const playerId=String(id);
  const next=(counts.get(playerId)||0)+1;
  counts.set(playerId,next);
  if(!positions.has(key))positions.set(key,next);
 }
 return positions;
}
export function rankPositions(sortedItems,mode){
 const rank=new Map();
 for(let i=0;i<(sortedItems||[]).length;i++){
  const key=rankIdentity(sortedItems[i],mode);
  if(key&&!rank.has(key))rank.set(key,i+1);
 }
 return rank;
}
