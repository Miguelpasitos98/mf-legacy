import {candidatePoolValue} from "./managerCandidatePool.mjs";

/**
 * Only players explicitly opted in from PLAYERS are eligible for scouting
 * display, comparison, or report in MANAGER FIT. This is independent from
 * the full historical cohort used for statistical percentile comparisons.
 */
export function managerScoutingPool(players=[]){
 const seen=new Set();
 return players.filter(player=>{
  const id=String(player?.id??"").trim();
  if(!id||!candidatePoolValue(player.manager_fit_candidate)||seen.has(id))return false;
  seen.add(id);
  return true;
 });
}
export function managerScoutingCandidateIds(players=[]){
 return new Set(managerScoutingPool(players).map(p=>String(p.id)));
}
