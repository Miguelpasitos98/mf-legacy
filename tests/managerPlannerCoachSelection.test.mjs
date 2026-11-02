import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {planSquad} from "../src/components/managers/managerSquadPlanner.mjs";
import {selectedCandidatePool} from "../src/components/managers/managerCandidatePool.mjs";
import {evaluateScenario} from "../src/components/managers/managerScenarios.mjs";

const team={id:"custom",name:"AFC Wimbledon",is_custom_club:true};
const managers=[{id:"m1",name:"Entrenador Uno"},{id:"m2",name:"Entrenador Dos"}];
const profiles=[
 {id:"p1",manager_id:"m1",name:"Control",formation:"4-3-3",is_default:true},
 {id:"p2",manager_id:"m2",name:"Presión",formation:"4-2-3-1",is_default:true},
 {id:"p3",manager_id:"m2",name:"Otra",formation:"4-4-2",is_default:false},
 {id:"foreign",manager_id:"m1",name:"No corresponde",formation:"5-3-2"}
];
const season="2026/2027",players=[{id:"p",name:"Local",position:"LD"}];
const memberships=[{team_id:team.id,player_id:"p",season,team_type:"club"}];
const assignments=[];
const args={team,season,players,memberships,assignments,managers,profiles};
test("coach can be selected temporarily without official club assignment",()=>{
 const x=planSquad({...args,previewManagerId:"m2"});
 assert.equal(x.valid,true);
 assert.equal(x.assignment,null);
 assert.equal(x.manager.name,"Entrenador Dos");
 assert.equal(x.profile.id,"p2");
 assert.equal(x.temporaryManager,true);
 assert.equal(x.rosterCount,1);
 assert.deepEqual(assignments,[]);
 assert.equal(x.roleSummary.find(x=>x.role==="FB").count,1);
});
test("coach-specific DNA selector never accepts profile from another coach",()=>{
 const choice=planSquad({...args,previewManagerId:"m2",previewProfileId:"foreign"});
 assert.equal(choice.profile.id,"p2");
 const specific=planSquad({...args,previewManagerId:"m2",previewProfileId:"p3"});
 assert.equal(specific.profile.id,"p3");
 assert.equal(specific.profile.formation,"4-4-2");
});
test("saved assignment remains unchanged when choosing a simulation coach",()=>{
 const existing=[{team_type:"club",team_id:team.id,season,manager_id:"m1",tactical_profile_id:"p1",is_primary:true}];
 const x=planSquad({...args,assignments:existing,previewManagerId:"m2"});
 assert.equal(x.manager.id,"m2");
 assert.equal(x.profile.id,"p2");
 assert.equal(existing[0].manager_id,"m1");
 const y=planSquad({...args,assignments:existing});
 assert.equal(y.manager.id,"m1");
});
test("external candidate pool is included in generated XI but never written to club memberships",()=>{
 const outsiders=[
  {id:"GK",name:"Portero marcado",team_id:"original",position:"GK",manager_fit_candidate:true},
  {id:"CB",name:"Central marcado",team_id:"original",position:"DFC",manager_fit_candidate:true},
  {id:"WG",name:"Extremo marcado",team_id:"original",position:"EI",manager_fit_candidate:true}
 ];
 const plan=planSquad({...args,previewManagerId:"m2"});
 const internal=plan.roleSummary.flatMap(x=>x.roster);
 const external=selectedCandidatePool(outsiders,internal.map(x=>x.player.id),true);
 const evaluated=evaluateScenario(plan,[...internal,...external],{formation:"",overrides:{}},"A");
 const selected=evaluated.draft.assignments.filter(x=>x.primary).map(x=>x.primary);
 assert.ok(selected.some(x=>x.externalCandidate));
 assert.ok(selected.some(x=>x.player.name==="Portero marcado"));
 assert.equal(evaluated.formation,"4-2-3-1");
 assert.equal(evaluated.draft.filled,4);
 assert.equal(memberships.length,1);
 assert.equal(outsiders[0].team_id,"original");
});
test("no coach still allows a labelled provisional 4-3-3, without fabricated DNA scores",()=>{
 const plan=planSquad(args);
 const roster=plan.roleSummary.flatMap(x=>x.roster);
 const first=evaluateScenario(plan,roster,{formation:"",overrides:{}},"A");
 assert.equal(first.formation,"4-3-3");
 assert.equal(first.draft.assignments.length,11);
 assert.equal(first.draft.assignments.filter(x=>x.primary).length,1);
 assert.equal(first.draft.assignments.find(x=>x.primary)?.primary.estimatedFit,null);
});
test("planner renders selectors and keeps quick demo optional",()=>{
 const src=fs.readFileSync("src/pages/ManagerSquadPlanner.jsx","utf8");
 assert.match(src,/Entrenador para el planificador/);
 assert.match(src,/ADN táctico para el planificador/);
 assert.match(src,/previewManagerId,previewProfileId/);
 assert.match(src,/Demostración opcional/);
 assert.match(src,/Permitir candidatos externos/);
});
