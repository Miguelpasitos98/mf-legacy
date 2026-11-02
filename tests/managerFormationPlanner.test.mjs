import test from "node:test";
import assert from "node:assert/strict";
import {formationSlots,suggestFormationXI} from "../src/components/managers/managerFormationPlanner.mjs";
test("common shapes generate exactly eleven positions without fake players",()=>{
 for(const f of ["4-3-3","4-2-3-1","3-4-2-1","4-2-2-2","5-3-2"]){
  const x=formationSlots(f);
  assert.equal(x.valid,true,f);
  assert.equal(x.slots.length,11,f);
  assert.equal(new Set(x.slots.map(s=>s.id)).size,11);
 }
 assert.equal(formationSlots("4-4-4").valid,false);
});
test("a player cannot be assigned to two starting slots",()=>{
 const players=[
  {id:"g",name:"Goalkeeper",position:"GK",position_ratings:{portero:18}},
  {id:"d1",name:"Defender1",position:"DFC",position_ratings:{defensa_central:18}},
  {id:"d2",name:"Defender2",position:"DFC",position_ratings:{defensa_central:16}},
  {id:"l",name:"Lateral",position:"LD",position_ratings:{defensa_derecho:17}}
 ];
 const plan={valid:true,profile:{formation:"4-3-3"},roleSummary:players.map((p)=>({roster:[{player:p,membership:{}}]}))};
 const result=suggestFormationXI(plan,"4-3-3");
 const chosen=result.assignments.filter(x=>x.primary).map(x=>x.primary.player.id);
 assert.equal(new Set(chosen).size,chosen.length);
 assert.equal(result.filled+result.vacancies,11);
 assert.equal(result.isProvisional,true);
});
test("missing tactical profile never invents scores",()=>{
 const plan={valid:true,profile:null,roleSummary:[{roster:[{player:{id:"1",name:"GK",position:"GK"}}]}]};
 const result=suggestFormationXI(plan,"4-3-3");
 assert.equal(result.assignments.find(x=>x.role==="GK").primary.estimatedFit,null);
});
