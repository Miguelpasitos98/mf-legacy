import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {deriveRoleRequirements,evaluateRoleRequirements} from "../src/components/managers/managerRoleFit.mjs";
import {V4_ROLE_METRICS,V4_METRIC_LABELS,TACTICAL_REQUIREMENT_RULES} from "../src/components/managers/managerRoleRules.mjs";
import {collectPlayerSeasonMetrics,HIST_ROLE_METRICS,linkedManagerFitRows} from "../src/components/managers/managerFitHistorical.mjs";

const coach=roles=>({player_role_priorities:JSON.stringify(roles)});
test("the seven Liverpool role descriptions resolve to auditable, role-specific indicators",()=>{
 const profile=coach({GK:"Sweeper-keeper",CB:"Ball-playing/Fast",FB:"Playmaker/Attacking",
 DM:"Regista/Shield",AM:"Box-to-box/Creative",WG:"Inside-forward",ST:"False-nine/Complete-forward"});
 const roles=["GK","CB","FB","DM","AM","WG","ST"];
 for(const role of roles){
  const req=deriveRoleRequirements(profile,role);
  assert.ok(req.matched.length>=1,role);
  assert.ok(req.metricKeys.length>=2,role);
  assert.ok(req.metricKeys.every(key=>V4_ROLE_METRICS[role].includes(key)),role);
  assert.ok(req.metricKeys.every(key=>V4_METRIC_LABELS[key]),role);
 }
 assert.ok(deriveRoleRequirements(profile,"CB").unmeasuredTraits.some(x=>x.includes("Velocidad")));
});
test("V4 proxies use observed competition rows and leave V3 unchanged",()=>{
 assert.deepEqual(HIST_ROLE_METRICS.ST,["xg","chain","shot","pressure"]);
 const raw=[
  {player_id:"p",season:"2025/2026",competition:"LaLiga",minutes:1800,metrics:[
   {name:"Accurate passes",value:720,per90:36},
   {name:"Recoveries",value:100,per90:5},
   {name:"Tackles",value:60,per90:3},
   {name:"Defensive actions",value:120,per90:6}
  ]}
 ];
 const metrics=collectPlayerSeasonMetrics(raw,[],"2025/2026","p");
 for(const key of ["passing","recoveries","tackles","defensiveActions"])assert.ok(metrics[key].value>0,key);
 assert.equal(metrics.chain,undefined);
 assert.equal(metrics.defense,undefined);
});
test("same season, >=10 measured peers, distinct indicators and conservative missing states",()=>{
 const profile=coach({DM:"Regista/Shield"});
 const peers=Array.from({length:12},(_,i)=>({passing:{value:25+i},recoveries:{value:3+i*.1},
    defensiveActions:{value:2+i*.1},interceptions:{value:1+i*.2},tackles:{value:1+i*.3},
    longPassing:{value:1+i*.1},buildup:{value:i*.01}}));
 const measured={passing:{value:35,source:"FotMob"},recoveries:{value:5,source:"FotMob"},tackles:{value:3,source:"FotMob"}};
 const result=evaluateRoleRequirements(measured,peers,"DM",profile);
 assert.ok(result.score!==null);assert.equal(result.breakdown.length,3);
 assert.ok(result.metricDiagnostics.some(m=>m.key==="passing"&&m.status==="measured"&&m.peerCount===12));
 assert.ok(result.metricDiagnostics.some(m=>m.key==="interceptions"&&m.status==="missing_player"));
 assert.equal(result.coverage,Math.round(100*result.breakdown.length/result.requested));
 assert.equal(evaluateRoleRequirements(measured,peers.slice(0,7),"DM",profile).score,null);
 assert.equal(evaluateRoleRequirements({passing:measured.passing},peers,"DM",profile).score,null);
 const empty=evaluateRoleRequirements({},peers,"DM",profile);
 assert.equal(empty.score,null);assert.equal(empty.confidence,"insufficient");
});
test("no speed, leadership or positioning score from descriptive DNA alone",()=>{
 const profile=coach({WG:"Pacy",CB:"Líderes posicionales",ST:"Generador de espacios"});
 for(const role of ["WG","CB","ST"]){
  const req=deriveRoleRequirements(profile,role);
  assert.equal(req.matched.length,0,role);
  assert.equal(req.unmatched,true,role);
  assert.equal(evaluateRoleRequirements({},[],"WG",profile).score,null);
 }
 assert.ok(deriveRoleRequirements(profile,"WG").unmeasuredTraits.length);
});
test("Understat global scope is labelled and mixed-scope V4 confidence is capped",()=>{
 const p=coach({CB:"Ball-playing defender"});
 const peers=Array.from({length:12},(_,i)=>({passing:{value:i+25},buildup:{value:i*.05},longPassing:{value:1+i*.1}}));
 const v=evaluateRoleRequirements({passing:{value:31,source:"FotMob"},buildup:{value:.3,source:"Understat",scope:"temporada global, ligas cubiertas"},
  longPassing:{value:2,source:"FotMob"}},peers,"CB",p);
 assert.equal(v.confidence,"low");
 assert.ok(v.limitation.includes("alcance global"));
 assert.ok(v.breakdown.some(m=>m.scope?.includes("temporada global")));
});
test("role rules never assign a key that lacks a declared historical label",()=>{
 for(const rule of TACTICAL_REQUIREMENT_RULES)
  for(const role of rule.roles)
   for(const key of rule.metrics){
    assert.ok(V4_METRIC_LABELS[key],rule.id+" -> "+key);
    // Rules can offer metrics unsuitable for a particular role; the engine filters those out.
    assert.ok(V4_ROLE_METRICS[role].some(supported=>rule.metrics.includes(supported)),rule.id+"/"+role+" must retain a supported metric");
   }
 const code=readFileSync("src/components/managers/ManagerScoutingVisual.jsx","utf8");
 assert.match(code,/metricDiagnostics/);
 assert.match(code,/Muestra insuficiente/);
 assert.match(code,/Sin dato del jugador/);
});

test("V4 reads real Spanish FotMob labels without inventing missing rates",()=>{
 const row={player_id:"gk",season:"2025/2026",competition:"LaLiga",minutes:1800,metrics:[
  {name:"Pases completados",value:720,per90:36},
  {name:"Pases largos precisos",value:140,per90:7},
  {name:"Precisión de pases (%)",value:90},
 ]};
 const evidence=collectPlayerSeasonMetrics([row],[],"2025/2026","gk");
 assert.equal(evidence.passing.value,36);
 assert.equal(evidence.longPassing.value,7);
 assert.equal(evidence.passing.source,"FotMob");
 assert.equal(collectPlayerSeasonMetrics([row],[],"2024/2025","gk").passing,undefined);
});

test("confirmed unique FotMob links recover unlinked season stats without guessing names",()=>{
 const rows=[
  {fotmob_player_id:"100",player_id:"",season:"2025/2026",metrics:[]},
  {fotmob_player_id:"101",player_id:"other",season:"2025/2026",metrics:[]},
  {fotmob_player_id:"102",player_id:"",season:"2025/2026",metrics:[]},
  {fotmob_player_id:"103",player_id:"",season:"2025/2026",metrics:[]}
 ];
 const links=[
  {fotmob_player_id:"100",player_id:"known"},
  {fotmob_player_id:"101",player_id:"known"},
  {fotmob_player_id:"102",player_id:"known"},
  {fotmob_player_id:"102",player_id:"another"},
  {fotmob_player_id:"103",player_id:"absent"}
 ];
 const result=linkedManagerFitRows(rows,links,[{id:"known"},{id:"another"}]);
 assert.equal(result[0].player_id,"known");
 assert.equal(result[1].player_id,"other");
 assert.equal(result[2].player_id,"");
 assert.equal(result[3].player_id,"");
});
