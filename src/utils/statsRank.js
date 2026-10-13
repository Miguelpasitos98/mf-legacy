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
export function rankPositions(sortedItems,mode){
 const rank=new Map();
 for(let i=0;i<(sortedItems||[]).length;i++){
  const key=rankIdentity(sortedItems[i],mode);
  if(key&&!rank.has(key))rank.set(key,i+1);
 }
 return rank;
}
