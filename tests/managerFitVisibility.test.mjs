import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {visibleManagerFitCandidates} from "../src/components/managers/managerFitVisibility.mjs";
import {deriveRoleRequirements,evaluateRoleRequirements} from "../src/components/managers/managerRoleFit.mjs";
import {rankPlayers} from "../src/components/managers/managerFit.mjs";
import {filterScoutingCandidates} from "../src/components/managers/managerTransferScout.mjs";
const profile={player_role_priorities:JSON.stringify({DM:"Regista/Shield",FB:"Lateral profundo con centros"})};
const players=[
 {id:"dm1",name:"Interior",position:"CM",ca:145,position_ratings:{centrocampista:19}},
 {id:"dm2",name:"Pivote",position:"CDM",ca:140,position_ratings:{mediocentro:17}},
 {id:"gk",name:"Portero",position:"GK",ca:198,position_ratings:{centrocampista:2}}
];
const mock=(list,role="DM")=>rankPlayers(list,role,profile,{showUnknown:true}).map(item=>({
 ...item,roleFit:evaluateRoleRequirements({},[],role,profile),
 historical:{score:null,coverage:0},advanced:{score:null,coverage:0}
}));
test("Klopp Liverpool 2015/20 Regista/Shield now provides two audited metric families",()=>{
 const req=deriveRoleRequirements(profile,"DM");
 assert.ok(req.matched.some(x=>x.id==="regista"));
 assert.ok(req.matched.some(x=>x.id==="shield"));
 assert.ok(req.matched.some(x=>x.metrics.includes("passing")));
 assert.ok(req.matched.some(x=>x.metrics.includes("defense")));
 // Matching text is NOT a claim of observed performance.
 assert.equal(evaluateRoleRequirements({},[], "DM",profile).score,null);
});
test("V4 displays eligible midfielders with unavailable score instead of returning zero, without inventing scores",()=>{
 const view=visibleManagerFitCandidates(mock(players),{scoreMode:"role",showUnknown:false});
 assert.equal(view.fallback,true);
 assert.equal(view.compatibleCount,2);
 assert.equal(view.scoredCount,0);
 assert.deepEqual(view.rows.map(x=>x.player.id),["dm1","dm2"]);
 assert.equal(view.rows[0].roleFit.score,null);
 assert.equal(view.rows[1].roleFit.score,null);
 assert.equal(view.rows[0].fit,95);
});
test("V3 and V2 also show a position-only fallback when no evidence is sufficient",()=>{
 for(const scoreMode of ["historical","attributes"]){
  const view=visibleManagerFitCandidates(mock(players),{scoreMode,showUnknown:false});
  assert.equal(view.fallback,true);
  assert.equal(view.rows.length,2);
 }
});
test("when at least one score is valid, non-evaluable players remain hidden unless requested",()=>{
 const rows=mock(players);
 rows.find(x=>x.player.id==="dm2").roleFit={score:77,coverage:100};
 const rated=visibleManagerFitCandidates(rows,{scoreMode:"role",showUnknown:false});
 assert.equal(rated.fallback,false);
 assert.deepEqual(rated.rows.map(x=>x.player.id),["dm2"]);
 const inclusive=visibleManagerFitCandidates(rows,{scoreMode:"role",showUnknown:true});
 assert.deepEqual(inclusive.rows.map(x=>x.player.id),["dm2","dm1"]);
});
test("other position and current filters are respected in fallback",()=>{
 const rows=mock(players);
 assert.equal(visibleManagerFitCandidates(rows,{scoreMode:"role",minPositionFit:98}).rows.length,0);
 const afterCA=filterScoutingCandidates(rows.filter(x=>x.quality>=143),{season:"2025/2026"});
 assert.deepEqual(visibleManagerFitCandidates(afterCA,{scoreMode:"role"}).rows.map(x=>x.player.id),["dm1"]);
});
test("coverage filter uses current analysis mode instead of unrelated V4 data",()=>{
 const one={player:{id:"dm",date_of_birth:"01/01/2000"},fit:86,roleFit:{coverage:0},advanced:{coverage:80},historical:{coverage:40}};
 assert.equal(filterScoutingCandidates([one],{season:"2025/2026",minimumCoverage:50,coverageMode:"attributes"}).length,1);
 assert.equal(filterScoutingCandidates([one],{season:"2025/2026",minimumCoverage:50,coverageMode:"historical"}).length,0);
 assert.equal(filterScoutingCandidates([one],{season:"2025/2026",minimumCoverage:50,coverageMode:"role"}).length,0);
});
test("Manager Fit UI distinguishes positional fallback and historical evidence instead of hiding players",()=>{
 const ui=fs.readFileSync("src/pages/ManagerFit.jsx","utf8");
 assert.match(ui,/visibleManagerFitCandidates\(eligible,\{scoreMode,showUnknown,sortMode:resultSort,limit:resultLimit\}\)/);
 assert.match(ui,/visibility\.fallback/);
 assert.match(ui,/adecuación posicional/);
 assert.match(ui,/visibility\.compatibleCount/);
});
