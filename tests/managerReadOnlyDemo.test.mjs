import test from "node:test";
import assert from "node:assert/strict";
import {makeManagerReadOnlyDemo,DEMO_REFERENCES,DEMO_TEAM_ID} from "../src/components/managers/managerReadOnlyDemo.mjs";
const team={id:DEMO_REFERENCES.teamId,name:"Borussia Dortmund",is_custom_club:false};
const manager={id:DEMO_REFERENCES.managerId,name:"Jürgen Klopp"};
const profile={id:DEMO_REFERENCES.profileId,manager_id:manager.id,name:"Dortmund: Heavy Metal",formation:"4-2-3-1"};
test("read-only demo requires all actual reference categories",()=>{
 const p=makeManagerReadOnlyDemo({teams:[team],managers:[manager],profiles:[profile],players:[]});
 assert.equal(p.valid,false);
});
test("read-only demo creates only in-memory memberships and assignment and preserves real records",()=>{
 const player={id:"fm-player",name:"Ejemplo",team_id:team.id,position:"DC"};
 const original=JSON.stringify({team,manager,profile,player});
 const result=makeManagerReadOnlyDemo({teams:[team],managers:[manager],profiles:[profile],players:[player]});
 assert.equal(result.valid,true);
 assert.equal(result.team.id,DEMO_TEAM_ID);
 assert.equal(result.isReadOnlyDemo,true);
 assert.equal(result.assignment.manager_id,manager.id);
 assert.equal(result.profile.formation,"4-2-3-1");
 assert.equal(result.rosterCount,1);
 assert.equal(result.roleSummary.find(x=>x.role==="ST").count,1);
 assert.equal(result.roleSummary.find(x=>x.role==="ST").roster[0].membership.status,undefined);
 assert.equal(JSON.stringify({team,manager,profile,player}),original);
});
test("missing original coach or wrong profile never invents an assignment",()=>{
 const player={id:"1",team_id:team.id,position:"DC"};
 const args={teams:[team],managers:[manager],profiles:[{...profile,manager_id:"wrong"}],players:[player]};
 assert.equal(makeManagerReadOnlyDemo(args).valid,false);
});
