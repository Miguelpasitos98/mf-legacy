import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {deriveRoleRequirements,evaluateRoleRequirements} from "../src/components/managers/managerRoleFit.mjs";
const req=text=>deriveRoleRequirements({player_role_priorities:JSON.stringify({CB:text})},"CB");
test("known coach CB phrases resolve to measured activity proxies, not a role-empty V4",()=>{
 for(const [phrase,metric] of [
  ["Dominant in air","aerialsWon"],
  ["Dominio aéreo y salida","aerialsWon"],
  ["Salida limpia","passing"],
  ["Defensas centrales con salida limpia","passing"],
  ["Centrales con capacidad de salida","buildup"],
  ["High technical ability for build-up","passing"],
  ["Progressive passers","longPassing"],
  ["Progressive passing","longPassing"]
 ]){
  const result=req(phrase);
  assert.ok(result.matched.length>0,phrase);
  assert.ok(result.metricKeys.includes(metric),phrase+" expected "+metric);
 }
});
test("physical or positional intelligence without observed measures does not fabricate a V4 score",()=>{
 for(const term of ["Physical presence","Físico","Inteligencia táctica","Inteligencia posicional",
  "Líderes posicionales","Centrales con libertad para conducir"]){
  const result=req(term);
  assert.equal(result.unmatched,true,term);
  assert.equal(result.metricKeys.length,0,term);
  assert.ok(result.unmeasuredTraits.length>0,term);
  const scored=evaluateRoleRequirements({aerialsWon:{value:3},passing:{value:30}},[],"CB",
    {player_role_priorities:JSON.stringify({CB:term})});
  assert.equal(scored.score,null,term);
  assert.equal(scored.requested,0,term);
 }
});
test("recognizing a role phrase cannot score a player without two real measured metrics and enough peers",()=>{
 const profile={player_role_priorities:JSON.stringify({CB:"Dominant in air"})};
 const population=Array.from({length:30},(_,i)=>({aerialsWon:{value:i+1},clearances:{value:i+1}}));
 const onlyOne=evaluateRoleRequirements({aerialsWon:{value:20}},population,"CB",profile);
 assert.equal(onlyOne.score,null);
 const two=evaluateRoleRequirements({aerialsWon:{value:20},clearances:{value:20}},population,"CB",profile);
 assert.notEqual(two.score,null);
 assert.equal(two.requested,2);
 assert.ok(two.minimumPeers>=20);
});
test("manager V4 interface distinguishes unrecognized criteria from missing player data",()=>{
 const ui=fs.readFileSync("src/components/managers/ManagerScoutingVisual.jsx","utf8");
 assert.match(ui,/ADN sin métricas reconocibles/);
 assert.match(ui,/Cobertura no aplicable/);
 assert.match(ui,/Esto NO significa que los jugadores carezcan de estadísticas/);
 assert.match(ui,/Sin dato del jugador/);
});
