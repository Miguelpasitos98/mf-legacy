import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {managerScoutingPool,managerScoutingCandidateIds} from "../src/components/managers/managerScoutingPool.mjs";
import {visibleManagerFitCandidates} from "../src/components/managers/managerFitVisibility.mjs";
import {v4MissingMetricExplanations} from "../src/components/managers/managerV4MetricExplanation.mjs";
import {rankPlayers} from "../src/components/managers/managerFit.mjs";
const coach={player_role_priorities:JSON.stringify({CB:"Salida de balón"})};
const testPlayers=[
 {id:"unmarkedA",name:"Alessandro Bastoni",position:"DFC",ca:180,manager_fit_candidate:false,position_ratings:{central:20}},
 {id:"unmarkedB",name:"Marquinhos",position:"DFC",ca:179,position_ratings:{central:20}},
 {id:"markedA",name:"Central en bolsa A",position:"DFC",ca:155,manager_fit_candidate:true,position_ratings:{central:17}},
 {id:"markedB",name:"Central en bolsa B",position:"DFC",ca:152,manager_fit_candidate:true,position_ratings:{central:17}}
];
test("scouting only includes manually marked players, not top players from outside the bag",()=>{
 const original=testPlayers.map(p=>({...p}));
 const pool=managerScoutingPool(testPlayers);
 assert.deepEqual(pool.map(p=>p.id),["markedA","markedB"]);
 assert.deepEqual([...managerScoutingCandidateIds(testPlayers)],["markedA","markedB"]);
 assert.deepEqual(testPlayers,original,"no mutation of Players entity");
});
test("a marked player is included even when their club is elite; false and string true are excluded",()=>{
 const players=[{id:"clubElite",team_id:"elite",manager_fit_candidate:true},
  {id:"false",manager_fit_candidate:false},{id:"string",manager_fit_candidate:"true"},
  {id:"clubElite",manager_fit_candidate:true},{id:"",manager_fit_candidate:true}];
 assert.deepEqual(managerScoutingPool(players).map(p=>p.id),["clubElite"]);
});
test("V4 only ranks selected candidates, but uses external peer data for historical percentiles",()=>{
 const bag=managerScoutingPool(testPlayers);
 const scored=rankPlayers(bag,"CB",coach,{minCA:0,showUnknown:true})
  .map(x=>({...x,roleFit:{score:x.player.id==="markedA"?77:null,coverage:67}}));
 const selected=visibleManagerFitCandidates(scored,{scoreMode:"role"});
 assert.equal(selected.compatibleCount,2);
 assert.deepEqual(selected.rows.map(x=>x.player.id),["markedA"]);
 const inclusive=visibleManagerFitCandidates(scored,{scoreMode:"role",showUnknown:true});
 assert.deepEqual(inclusive.rows.map(x=>x.player.id),["markedA","markedB"]);
});
test("showing ALL candidates is not artificially truncated to 48 or 500",()=>{
 const rows=Array.from({length:680},(_,i)=>({
  player:{id:String(i),name:"c"+i},fit:80,quality:150,roleFit:{score:i%100,coverage:80}
 }));
 const limited=visibleManagerFitCandidates(rows,{scoreMode:"role",limit:48});
 assert.equal(limited.shownCount,48);
 assert.equal(limited.displayCount,680);
 const all=visibleManagerFitCandidates(rows,{scoreMode:"role",limit:Number.POSITIVE_INFINITY});
 assert.equal(all.shownCount,680);
 assert.equal(all.rows.length,680);
});
test("V4 2/3 description distinguishes missing player data from insufficient external peers",()=>{
 const explanations=v4MissingMetricExplanations({metricDiagnostics:[
  {key:"passing",label:"Pases precisos /90",status:"measured",peerCount:27},
  {key:"longPassing",label:"Pases largos precisos /90",status:"measured",peerCount:27},
  {key:"buildup",label:"xG Buildup /90",status:"insufficient_peers",peerCount:7}
 ]});
 assert.equal(explanations.length,1);
 assert.equal(explanations[0].name,"xG Buildup /90");
 assert.match(explanations[0].reason,/7\/10 comparables/);
 assert.match(explanations[0].detail,/Puede existir el dato/);
 const missing=v4MissingMetricExplanations({metricDiagnostics:[
  {key:"buildup",label:"xG Buildup /90",status:"missing_player",peerCount:22}
 ]});
 assert.match(missing[0].reason,/Sin registro válido/);
 assert.match(missing[0].detail,/sí está disponible/);
});
test("MANAGER FIT filters candidates strictly but keeps statistical comparison from the full catalogue",()=>{
 const page=fs.readFileSync("src/pages/ManagerFit.jsx","utf8");
 assert.match(page,/const candidates=useMemo\(\(\)=>managerScoutingPool\(players\),\[players\]\)/);
 assert.match(page,/rankPlayers\(candidates,role,profile/);
 assert.match(page,/historicalRoleCandidates\(players,role\)/);
 assert.match(page,/managerScoutingCandidateIds\(players\)/);
 assert.match(page,/if\(!player\|\|!candidateIds\.has\(String\(player\.id\)\)\)return null/);
 assert.match(page,/const scoutingPlayer=candidates\.find\(/);
 assert.match(page,/\/players\?view=candidates/);
 assert.match(page,/setShowAllResults\(true\)/);
 assert.match(page,/const resultLimit=showAllResults\?Number\.POSITIVE_INFINITY:48/);
 assert.doesNotMatch(page,/Math\.min\(500,n\+48\)/);
 const visual=fs.readFileSync("src/components/managers/ManagerScoutingVisual.jsx","utf8");
 assert.match(visual,/¿Por qué \{item\.roleFit\.breakdown\.length\}\/\{item\.roleFit\.requested\}\?/);
 assert.match(visual,/v4MissingMetricExplanations/);
});
