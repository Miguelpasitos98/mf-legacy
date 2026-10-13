import {columnValue} from "./statsColumns.js";

// Rank each player's seasons by a chosen statistic, retaining the best eligible
// season only. Missing metrics are excluded; a genuine zero remains eligible.
// Never apply ascending table sort to decide the player's best season.
export function bestSeasonPerPlayer(items,metric,config){
 const best=new Map();
 for(const entry of items||[]){
  const summary=entry?.summary;
  if(!summary)continue;
  const playerId=String(summary.player_id||summary.fotmob_player_id||entry.player?.id||"").trim();
  if(!playerId)continue;
  const value=columnValue(summary,"season",metric,config);
  if(typeof value!=="number"||!Number.isFinite(value))continue;
  const current=best.get(playerId);
  if(!current){best.set(playerId,entry);continue;}
  const oldValue=columnValue(current.summary,"season",metric,config);
  const minutes=Number(summary.totals?.minutes?.value)||0;
  const oldMinutes=Number(current.summary.totals?.minutes?.value)||0;
  // Tie-break: more minutes, then newest year. Only one per player.
  if(value>oldValue || value===oldValue&&(minutes>oldMinutes||minutes===oldMinutes&&String(summary.season)>String(current.summary.season))){
   best.set(playerId,entry);
  }
 }
 return [...best.values()];
}
