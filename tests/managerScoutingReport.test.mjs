import test from "node:test";
import assert from "node:assert/strict";
import {buildScoutingReport,compareManagerProfiles} from "../src/components/managers/managerScoutingReport.mjs";
test("scouting report distinguishes measured strength and weakness",()=>{
 const result=buildScoutingReport({name:"Ejemplo"},"FB",{name:"Modelo"},"2025/2026",
  {score:65,coverage:66,confidence:"low",requested:3,requirements:["Profundidad"],breakdown:[{key:"xa",percentile:82,source:"FotMob",peerCount:20},{key:"chain",percentile:25,source:"Understat",peerCount:20}],limitation:"Proxies"},
  {score:70},{score:61,position:90,quality:150});
 assert.equal(result.strengths.length,1);assert.equal(result.weaknesses.length,1);
 assert.equal(result.unmeasured,1);assert.equal(result.ca,150);
 assert.match(result.summary,/indicadores/);
});
test("no measured data means no report score or false absence of weakness",()=>{
 const result=buildScoutingReport({name:"Ejemplo"},"ST",{},"2024/2025",{score:null,breakdown:[],requested:2,coverage:0},null,null);
 assert.equal(result.fit,null);assert.equal(result.strengths.length,0);
 assert.equal(result.evidenceAvailable,false);
});
test("comparisons retain missing profiles rather than treating them as a zero",()=>{
 const profiles=[{id:"a",name:"General",is_default:true},{id:"b",name:"Liverpool"}];
 const results=compareManagerProfiles({}, "ST","2025/2026",profiles,{},[],(_m,_p,_role,p)=>({score:p.id==="a"?null:70,coverage:50,confidence:"low",breakdown:[{}]}));
 assert.deepEqual(results.map(r=>r.id),["b","a"]);
 assert.equal(results[1].fit,null);
});
