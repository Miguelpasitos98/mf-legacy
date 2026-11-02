import test from "node:test";
import assert from "node:assert/strict";
import {optimizeTacticalXI,OPTIMIZER_GOALS} from "../src/components/managers/managerLineupOptimizer.mjs";
import {evaluateTacticalFunctions} from "../src/components/managers/managerAdvancedRoles.mjs";
import {managerFitAttributes} from "../src/components/managers/managerFitAttributes.mjs";
import {analyzeTeamBalance} from "../src/components/managers/managerTeamBalance.mjs";
import {applyLineupOverrides} from "../src/components/managers/managerLineupSandbox.mjs";

const profile={name:"Prueba",player_role_priorities:JSON.stringify({ST:"Delantero presionante",DM:"Pivote recuperador"})};
const striker=(id,name,press,status="active")=>({player:{
 id,name,position:"DC",stats:{
 mental:{movimiento:14,anticipacion:14,sacrificio:press,trabajo_de_equipo:press},
 physical:{aceleracion:14,resistencia:press},technical:{remate:14}
 }},membership:{status,squad_role:"rotation"}});
const pivot={player:{id:"pivot",name:"Pivote",position:"CDM",stats:{
 mental:{decisiones:14,colocacion:15,trabajo_de_equipo:14,sacrificio:15},
 technical:{pases:14,entradas:15},physical:{resistencia:15}
}},membership:{status:"active",squad_role:"starter"}};
const occupied=(id,role,member)=>({
 id,role,line:1,index:0,primary:{...member,estimatedFit:managerFitAttributes(member.player,role,profile).score},
 advanced:evaluateTacticalFunctions(member.player,profile,role),
 alternatives:[]
});
function fixture(incomingStatus="active"){
 const start=striker("starter","Titular",5);
 const bench=striker("bench","Suplente",19,incomingStatus);
 const slots=[
 occupied("L-0","ST",start),
 occupied("L-1","DM",pivot),
 ...Array.from({length:9},(_,i)=>({id:"other-"+i,role:"CB",line:1,index:i,primary:null,advanced:null,alternatives:[]}))
 ];
 return {draft:{valid:true,formation:"4-3-3",assignments:slots,filled:2,vacancies:9},
  roster:[start,bench,pivot],profile};
}
test("optimizer recommends a measured gain from same registered roster, without duplicate players or mutation",()=>{
 const input=fixture();
 const original=JSON.stringify(input.draft);
 const before=analyzeTeamBalance(input.draft).axes.find(x=>x.key==="pressure").score;
 assert.ok(before!==null);
 const out=optimizeTacticalXI({...input,goal:"pressure",maxChanges:2});
 assert.equal(out.status,"suggested");
 assert.equal(out.changes.length,1);
 assert.equal(out.changes[0].incoming,"Suplente");
 assert.equal(out.changes[0].outgoing,"Titular");
 assert.ok(out.after.axes.find(x=>x.key==="pressure").score>before);
 assert.equal(JSON.stringify(input.draft),original);
 const p=applyLineupOverrides(input.draft,input.roster,input.profile,out.overrides);
 assert.equal(new Set(p.assignments.filter(s=>s.primary).map(s=>s.primary.player.id)).size,p.filled);
 assert.equal(p.filled,input.draft.filled);
});
test("unavailable and loaned squad players cannot enter suggested eleven",()=>{
 const input=fixture("injured");
 assert.equal(optimizeTacticalXI({...input,goal:"pressure"}).status,"no_improvement");
 input.roster[1].membership.status="active";
 input.roster[1].membership.squad_role="loan";
 assert.equal(optimizeTacticalXI({...input,goal:"pressure"}).status,"no_improvement");
});
test("missing axis is not an invented optimization opportunity",()=>{
 const input=fixture();
 assert.equal(analyzeTeamBalance(input.draft).axes.find(x=>x.key==="width").score,null);
 const out=optimizeTacticalXI({...input,goal:"width"});
 assert.equal(out.status,"insufficient");
 assert.equal(out.changes.length,0);
});
test("optimizer caps changes and validates role, formation and objective",()=>{
 const input=fixture();
 assert.equal(Object.keys(OPTIMIZER_GOALS).length,6);
 assert.equal(optimizeTacticalXI({...input,goal:"fictional"}).status,"insufficient");
 assert.equal(optimizeTacticalXI({...input,draft:{valid:false,assignments:[]}}).status,"insufficient");
 const out=optimizeTacticalXI({...input,goal:"pressure",maxChanges:100});
 assert.ok(out.changes.length<=3);
});
test("guardrail rejects a large drop on a different measurable dimension",()=>{
 const input=fixture();
 const runner={player:{id:"runner",name:"Mediapunta",position:"CAM",stats:{
  technical:{remate:17,pases:15,tecnica:15},
  mental:{movimiento:17,vision:15,decisiones:15},
  physical:{aceleracion:17}
 }},membership:{status:"active",squad_role:"starter"}};
 input.draft.assignments[2]=occupied("other-0","AM",runner);
 input.draft.filled=3;input.draft.vacancies=8;
 input.roster.push(runner);
 // Stronger pressure but much weaker finishing. Current finishing is
 // measurable thanks to the striker + runner, so the candidate must be vetoed.
 const bench=input.roster.find(p=>p.player.id==="bench").player;
 bench.stats.technical.remate=5;
 bench.stats.mental.movimiento=5;
 bench.stats.mental.anticipacion=5;
 const before=analyzeTeamBalance(input.draft);
 assert.ok(before.axes.find(x=>x.key==="finishing").score!==null);
 const out=optimizeTacticalXI({...input,goal:"pressure"});
 assert.equal(out.status,"no_improvement");
 assert.equal(out.changes.length,0);
});
test("optimizer never selects an out-of-position candidate or data-less player",()=>{
 const input=fixture();
 input.roster[1].player.position="GK";
 const invalid=optimizeTacticalXI({...input,goal:"pressure"});
 assert.equal(invalid.status,"no_improvement");
 input.roster[1].player.position="DC";
 input.roster[1].player.stats={};
 assert.equal(optimizeTacticalXI({...input,goal:"pressure"}).status,"no_improvement");
});
