import test from "node:test";
import assert from "node:assert/strict";
import {deriveRoleRequirements,evaluateRoleRequirements} from "../src/components/managers/managerRoleFit.mjs";
test("translates distinct preferred roles into different historical metric requirements",()=>{
 const offensive={player_role_priorities:JSON.stringify({FB:"Lateral profundo con centros y desborde",ST:"Delantero presionante, recuperación alta"})};
 const fullback=deriveRoleRequirements(offensive,"FB");
 const striker=deriveRoleRequirements(offensive,"ST");
 assert.ok(fullback.matched.some(x=>x.id==="wing_attack"));
 assert.ok(striker.matched.some(x=>x.id==="high_pressure"));
 assert.equal(striker.matched.some(x=>x.id==="wing_attack"),false);
});
test("uncertain role descriptions are not assigned phantom scores",()=>{
 const p={player_role_priorities:JSON.stringify({FB:"Jugador inteligente, simpático y completo"})};
 const result=evaluateRoleRequirements({},[],"FB",p);
 assert.equal(result.score,null);assert.equal(result.unmatched,true);
});
test("role match uses only observed peers and at least two supported indicators",()=>{
 const p={player_role_priorities:JSON.stringify({FB:"Lateral profundo con centros y desborde"})};
 const peers=Array.from({length:12},(_,i)=>({xa:{value:i*.04},chain:{value:i*.08},dribbles:{value:i*.1}}));
 const current={xa:{value:.33,source:"FotMob"},chain:{value:.7,source:"Understat"},dribbles:{value:1.0,source:"FotMob"}};
 const good=evaluateRoleRequirements(current,peers,"FB",p);
 assert.ok(good.score>=0&&good.score<=100);assert.ok(good.breakdown.length>=2);
 assert.equal(evaluateRoleRequirements(current,peers.slice(0,5),"FB",p).score,null);
 assert.equal(evaluateRoleRequirements({xa:current.xa},peers,"FB",p).score,null);
});
test("no cross-role metrics or hidden writes",()=>{
 const profile={player_role_priorities:JSON.stringify({CB:"Central rápido y con buena salida de balón"})};
 const before=JSON.stringify(profile);
 const result=evaluateRoleRequirements({},[],"CB",profile);
 assert.equal(result.score,null);
 assert.equal(JSON.stringify(profile),before);
});
