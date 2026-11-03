import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {deriveRoleRequirements,evaluateRoleRequirements} from "../src/components/managers/managerRoleFit.mjs";
import {visibleManagerFitCandidates} from "../src/components/managers/managerFitVisibility.mjs";
import {buildScoutingReport,compareManagerProfiles} from "../src/components/managers/managerScoutingReport.mjs";

const profile={name:"Falso nueve y delantero completo",
 player_role_priorities:JSON.stringify({ST:"Falso nueve y delantero completo"})};
const data=j=>({
 xa:{value:j*.01,source:"FotMob",minutes:1200},
 chancesCreated:{value:j*.2,source:"FotMob",minutes:1200},
 chain:{value:j*.08,source:"Understat",scope:"temporada global, ligas cubiertas"},
 xg:{value:(25-j)*.03,source:"FotMob",minutes:1200},
 shot:{value:(25-j)*.1,source:"FotMob",minutes:1200}
});
const peers=Array.from({length:15},(_,i)=>({...data(i+1),__playerId:"p"+i}));
test("V4.1 derives distinct false-nine and complete-forward families",()=>{
 const requirements=deriveRoleRequirements(profile,"ST");
 assert.deepEqual(requirements.matched.map(x=>x.id),["false_nine","complete_forward"]);
 assert.deepEqual(new Set(requirements.metricKeys),new Set(["xa","chancesCreated","chain","xg","shot"]));
 const result=evaluateRoleRequirements(data(20),peers,"ST",profile);
 assert.equal(result.breakdown.length,5);
 assert.equal(result.requested,5);
 assert.equal(result.requirementBreakdown.length,2);
 assert.equal(result.evaluatedFunctions,2);
 assert.equal(result.requestedFunctions,2);
 const [falseNine,complete]=result.requirementBreakdown;
 assert.equal(falseNine.measured,3);
 assert.equal(complete.measured,4);
 assert.equal(result.score,Math.round((falseNine.score+complete.score)/2));
 const simple=Math.round(result.breakdown.reduce((sum,x)=>sum+x.percentile,0)/result.breakdown.length);
 assert.notEqual(result.score,simple,"a simple average would over-weight functions with more metrics");
 const report=buildScoutingReport({name:"Ejemplo",id:"star"},"ST",profile,"2025/2026",result,{},null);
 assert.deepEqual(report.functionBreakdown,result.requirementBreakdown);
});
test("one player never becomes one of their own 10 comparison peers",()=>{
 const otherNine=Array.from({length:9},(_,i)=>({...data(i+2),__playerId:"other"+i}));
 const self={...data(20),__playerId:"self"};
 const current={...data(20)};
 const tenIncludingSelf=[self,...otherNine];
 const excluded=evaluateRoleRequirements(current,tenIncludingSelf,"ST",profile,{playerId:"self"});
 assert.equal(excluded.score,null);
 assert.ok(excluded.metricDiagnostics.every(row=>row.peerCount===9));
 assert.ok(excluded.metricDiagnostics.every(row=>row.status==="insufficient_peers"));
 const tenth={...data(15),__playerId:"tenth"};
 const available=evaluateRoleRequirements(current,[...tenIncludingSelf,tenth],"ST",profile,{playerId:"self"});
 assert.notEqual(available.score,null);
 assert.ok(available.metricDiagnostics.every(row=>row.peerCount===10));
 assert.deepEqual(tenIncludingSelf.map(x=>x.__playerId)[0],"self");
});
test("different statistical sources or Understat scopes cannot inflate the sample",()=>{
 const sources=Array.from({length:15},(_,i)=>{
  const row={...data(i+1),__playerId:"test"+i};
  row.xa={...row.xa,source:i<9?"FotMob":"Understat"};
  return row;
 });
 const result=evaluateRoleRequirements(data(20),sources,"ST",profile);
 const xa=result.metricDiagnostics.find(x=>x.key==="xa");
 assert.equal(xa.peerCount,9);
 assert.equal(xa.status,"insufficient_peers");
 assert.ok(!result.breakdown.some(x=>x.key==="xa"));
 assert.equal(result.coverage,80);
 const badScope=sources.map((x,i)=>({...x,
  chain:{...x.chain,scope:i<7?"temporada global, ligas cubiertas":"alcance distinto"}
 }));
 const chain=evaluateRoleRequirements(data(20),badScope,"ST",profile).metricDiagnostics.find(x=>x.key==="chain");
 assert.equal(chain.peerCount,7);
});
test("less than 450 observed minutes reduces confidence, never substitutes a new score",()=>{
 const normal=evaluateRoleRequirements(data(20),peers,"ST",profile);
 assert.equal(normal.confidence,"medium");
 const lowMinutes={...data(20),xg:{...data(20).xg,minutes:140}};
 const restricted=evaluateRoleRequirements(lowMinutes,peers,"ST",profile);
 assert.equal(restricted.score,normal.score);
 assert.equal(restricted.confidence,"low");
 assert.match(restricted.limitation,/450 minutos/);
});
test("V4 comparison across coach models excludes player from its own cohort",()=>{
 const current={...data(20),id:"self",name:"Delantero"};
 const population=[{...data(20),__playerId:"self"},...Array.from({length:9},(_,i)=>({...data(i+2),__playerId:"op"+i}))];
 const selected=compareManagerProfiles(current,"ST","2025/2026",[{...profile,id:"tactic",is_default:true}],
  current,population,evaluateRoleRequirements);
 assert.equal(selected[0].fit,null);
 assert.equal(selected[0].evaluated,0);
});
test("V4.1 sort supports coverage and position without inventing scores or dropping unscored",()=>{
 const p=(id,score,coverage,fit)=>({
  player:{id,name:id},fit,quality:150,
  roleFit:{score,coverage,confidence:coverage>=75?"medium":"low"}
 });
 const rows=[p("a",82,40,75),p("b",70,90,85),p("c",null,0,95)];
 const score=visibleManagerFitCandidates(rows,{scoreMode:"role",showUnknown:true,sortMode:"score",limit:2});
 assert.deepEqual(score.rows.map(r=>r.player.id),["a","b"]);
 assert.equal(score.displayCount,3);
 assert.equal(score.shownCount,2);
 const coverage=visibleManagerFitCandidates(rows,{scoreMode:"role",showUnknown:true,sortMode:"coverage",limit:3});
 assert.deepEqual(coverage.rows.map(r=>r.player.id),["b","a","c"]);
 const positional=visibleManagerFitCandidates(rows,{scoreMode:"role",showUnknown:true,sortMode:"position",limit:3});
 assert.deepEqual(positional.rows.map(r=>r.player.id),["b","a","c"]);
});
test("cards, reports and page expose function-level evidence, sorting and incremental loading",()=>{
 const card=fs.readFileSync("src/components/managers/ManagerScoutingVisual.jsx","utf8");
 const page=fs.readFileSync("src/pages/ManagerFit.jsx","utf8");
 assert.match(card,/Funciones del ADN evaluadas/);
 assert.match(card,/item\.roleFit\.requirementBreakdown/);
 assert.match(card,/Confianza/);
 assert.match(card,/450 minutos|V4\.1/);
 assert.match(page,/Ajuste por funciones exigidas en el ADN \(V4\.1\)/);
 assert.match(page,/Orden de resultados V4/);
 assert.match(page,/setResultLimit\(n=>Math\.min\(500,n\+48\)\)/);
 assert.match(page,/compatibles sin puntuación/);
});
