import test from "node:test";
import assert from "node:assert/strict";
import {BASE_FORMATIONS,generateFormation,assignmentShape,templateName} from "../src/components/teams/managerFormationBridge.mjs";
test("preset layouts stay stable and valid",()=>{
 for(const [key,shape] of Object.entries(BASE_FORMATIONS))assert.deepEqual(generateFormation(key),shape);
});
test("Conte 3-4-3 and new five-back shapes generate 11 unique slots",()=>{
 for(const formation of ["3-4-3","3-4-2-1","3-4-1-2","4-1-4-1","4-1-2-1-2","5-3-2","4-2-2-2"]){
  const shape=generateFormation(formation);
  assert.equal(shape.length,11,formation);
  assert.equal(new Set(shape.map(x=>x[2])).size,11,formation);
  assert.ok(shape.every(([x,y])=>x>=0&&x<=100&&y>=0&&y<=100),formation);
 }
});
test("coach assignment takes explicit tactical DNA and normalizes diamond",()=>{
 const ass={id:"assignment",manager_id:"c",tactical_profile_id:"p"};
 const p=[{id:"p",manager_id:"c",formation:"4-4-2 (rombo)"}];
 const r=assignmentShape(ass,p,[{id:"c",name:"Conte"}]);
 assert.equal(r.formation,"4-1-2-1-2");
 assert.match(templateName(r.manager,r.formation),/Conte/);
 assert.equal(assignmentShape(ass,[{...p[0],formation:"invalid"}],[]),null);
});

test("Conte 3-4-3 includes true wingbacks/wide midfield and three attackers",()=>{
 const codes=generateFormation("3-4-3").map(s=>s[2]);
 for(const code of ["GK","CB1","CB2","CB3","LM","CM1","CM2","RM","LW","ST","RW"])assert.ok(codes.includes(code),code);
});
test("no guessed formation from a manager without valid tactical DNA",()=>{
 assert.equal(assignmentShape({manager_id:"m",tactical_profile_id:"p"},[{id:"p",manager_id:"m",formation:""}],[]),null);
});
