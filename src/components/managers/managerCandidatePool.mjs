/**
 * The opt-in transfer/Manager Fit pool is a manual scouting choice.
 * Neither team importance nor league strength infers eligibility.
 */
export const candidatePoolValue=value=>value===true;
export function selectedCandidatePool(players=[],teamPlayerIds=[],enabled=false){
 if(!enabled)return [];
 const owned=new Set(teamPlayerIds.map(String));
 const seen=new Set();
 return players.filter(player=>{
  const id=String(player?.id||"");
  if(!id||!candidatePoolValue(player.manager_fit_candidate)||owned.has(id)||seen.has(id))return false;
  seen.add(id);
  return true;
 }).map(player=>({
  player,
  membership:{squad_role:"external",candidate_external:true},
  externalCandidate:true
 }));
}
export const isExternalCandidate=member=>member?.externalCandidate===true||member?.membership?.candidate_external===true;
