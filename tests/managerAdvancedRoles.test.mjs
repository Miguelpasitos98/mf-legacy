import test from "node:test";
import assert from "node:assert/strict";
import {functionPreferences,functionSuitability,evaluateTacticalFunctions,TACTICAL_FUNCTIONS} from "../src/components/managers/managerAdvancedRoles.mjs";
test("football roles have distinct actionable tactical functions",()=>{
 for(const r of ["GK","CB","FB","DM","AM","WG","ST"])assert.ok(TACTICAL_FUNCTIONS[r].length>=2);
});
test("coach role requirements identify inverted fullback and pressing striker separately",()=>{
 const p={player_role_priorities:JSON.stringify({FB:"Lateral invertido y juego asociativo",ST:"Delantero presionante y sacrificio"})};
 assert.ok(functionPreferences(p,"FB").find(x=>x.id==="inverted").matchingTerms.length>0);
 assert.ok(functionPreferences(p,"ST").find(x=>x.id==="pressing").matchingTerms.length>0);
 assert.equal(functionPreferences(p,"FB").some(x=>x.id==="pressing"),false);
});
test("only actual FM26 attributes count; no scores for empty player",()=>{
 const f=TACTICAL_FUNCTIONS.FB.find(x=>x.id==="inverted");
 assert.equal(functionSuitability({},f).score,null);
 const player={stats:{technical:{pases:16,control:14},mental:{decisiones:18}}};
 const result=functionSuitability(player,f);
 assert.equal(result.score,80);assert.equal(result.coverage,100);
 const snapshot=JSON.stringify(player);
 assert.equal(evaluateTacticalFunctions(player,{player_role_priorities:JSON.stringify({FB:"Lateral invertido"})},"FB").recommendation.id,"inverted");
 assert.equal(JSON.stringify(player),snapshot);
});
