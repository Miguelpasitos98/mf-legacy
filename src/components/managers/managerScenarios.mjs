import {suggestFormationXI} from "./managerFormationPlanner.mjs";
import {applyLineupOverrides} from "./managerLineupSandbox.mjs";
import {analyzeTeamBalance,compareTeamBalance} from "./managerTeamBalance.mjs";
import {analyzeTacticalPartnerships} from "./managerChemistry.mjs";

/** Client-side scenario drafts only. Never writes to Base44. */
export const SCENARIO_IDS=["A","B"];
export const FORMATION_CHOICES=["4-3-3","4-2-3-1","4-4-2","3-4-2-1","3-5-2","4-2-2-2","5-3-2"];
export function emptyScenarios(){
 return {A:{formation:"",overrides:{}},B:{formation:"",overrides:{}}};
}
export function effectiveFormation(scenario,profileFormation,scenarioId){
 if(scenario?.formation)return scenario.formation;
 if(scenarioId==="A")return String(profileFormation||"");
 return profileFormation==="4-2-3-1"?"4-3-3":"4-2-3-1";
}
export function updateScenario(scenarios,id,patch){
 if(!SCENARIO_IDS.includes(id))return scenarios;
 return {...scenarios,[id]:{...scenarios[id],...patch,
  overrides:patch.overrides?{...patch.overrides}:{...scenarios[id].overrides}}};
}
export function duplicateScenario(scenarios,fromId,resolvedFormation){
 if(!SCENARIO_IDS.includes(fromId))return scenarios;
 const toId=fromId==="A"?"B":"A";
 // Copy the effective formation in the calling view if different defaults exist.
 return {...scenarios,[toId]:{formation:resolvedFormation||scenarios[fromId].formation,overrides:{...scenarios[fromId].overrides}}};
}
export function resetScenario(scenarios,id){
 return updateScenario(scenarios,id,{formation:"",overrides:{}});
}
export function evaluateScenario(plan,roster,scenario,id){
 const formation=effectiveFormation(scenario,plan?.profile?.formation,id);
 const auto=suggestFormationXI(plan,formation);
 const draft=applyLineupOverrides(auto,roster,plan?.profile,scenario?.overrides||{});
 return {id,formation,draft,balance:analyzeTeamBalance(draft),chemistry:analyzeTacticalPartnerships(draft)};
}
export function compareScenarios(a,b){
 const metrics=compareTeamBalance(a.balance,b.balance);
 const members=which=>{
  const map=new Map();
  for(const slot of which.draft?.assignments||[]){
   if(slot.primary?.player?.id!=null)map.set(String(slot.primary.player.id),slot.primary.player.name);
  }
  return map;
 };
 const aPlayers=members(a),bPlayers=members(b);
 const onlyA=[...aPlayers].filter(([id])=>!bPlayers.has(id)).map(([,name])=>name);
 const onlyB=[...bPlayers].filter(([id])=>!aPlayers.has(id)).map(([,name])=>name);
 const retained=[...aPlayers].filter(([id])=>bPlayers.has(id)).length;
 const pairEvidence=sc=>({evaluated:sc.chemistry.evaluated,unavailable:sc.chemistry.unavailable,
  scores:sc.chemistry.pairs.filter(p=>p.score!=null).map(p=>p.score)});
 return {metrics,onlyA,onlyB,retained,changed:onlyA.length+onlyB.length,
  pairA:pairEvidence(a),pairB:pairEvidence(b)};
}
