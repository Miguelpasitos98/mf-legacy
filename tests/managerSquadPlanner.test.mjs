import test from "node:test";
import assert from "node:assert/strict";
import {planSquad,squadPlannerRole,PLANNER_ROLES} from "../src/components/managers/managerSquadPlanner.mjs";
const custom={id:"c1",name:"Club personalizado",is_custom_club:true};
test("only custom clubs are eligible for planning",()=>{
 assert.equal(planSquad({team:{id:"x",is_custom_club:false},season:"2026/2027"}).valid,false);
 assert.equal(PLANNER_ROLES.length,7);
});
test("plan links a seasonal manager profile, not another team's manager",()=>{
 const input={team:custom,season:"2026/2027",
 players:[{id:"p",name:"Jugador lateral",position:"LD",stats:{physical:{resistencia:16,velocidad:15},technical:{centros:14,pases:16}},position_ratings:{defensa_derecho:18}}],
 memberships:[{team_id:"c1",team_type:"club",season:"2026/2027",player_id:"p"},{team_id:"other",team_type:"club",season:"2026/2027",player_id:"p"}],
 assignments:[{team_id:"c1",team_type:"club",season:"2026/2027",manager_id:"m",tactical_profile_id:"dna",is_primary:true}],
 managers:[{id:"m",name:"Entrenador"}],profiles:[{id:"dna",manager_id:"m",name:"Táctica"}]};
 const result=planSquad(input);
 assert.equal(result.valid,true);
 assert.equal(result.profile.name,"Táctica");
 assert.equal(result.rosterCount,1);
 assert.equal(result.roleSummary.find(r=>r.role==="FB").count,1);
 assert.equal(result.roleSummary.find(r=>r.role==="GK").needsReview,"empty");
});
test("uncertain attribute coverage is not flagged as bad performance",()=>{
 const result=planSquad({team:custom,season:"2026/2027",players:[{id:"p",position:"DC"}],
 memberships:[{team_type:"club",team_id:"c1",player_id:"p",season:"2026/2027"}],
 assignments:[],managers:[],profiles:[]});
 assert.equal(result.roleSummary.find(r=>r.role==="ST").needsReview,"missing_data");
 assert.equal(result.roleSummary.find(r=>r.role==="ST").best,null);
 assert.equal(squadPlannerRole("CRI"),"FB");
});
