import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {ballSecurityFromTotals,ballSecurityFromRecords,BALL_SECURITY_PRIOR_ACTIONS} from "../src/utils/ballSecurity.js";

const metric=(row,names)=>row.metrics.find(m=>names.includes(m.name))?.value??null;
const row=(dribbles,dispossessed,extra=[])=>({metrics:[
 ...(dribbles===null?[]:[{name:"Dribbles",value:dribbles}]),
 ...(dispossessed===null?[]:[{name:"Dispossessed",value:dispossessed}]),
 ...extra
]});

test("Ball Security: dribbles / (dribbles + dispossessions), smoothed towards 50%",()=>{
 assert.equal(BALL_SECURITY_PRIOR_ACTIONS,10);
 assert.equal(ballSecurityFromTotals(80,25),73.91); // (80+5)/(80+25+10)
 assert.equal(ballSecurityFromTotals(0,20),16.67);
 assert.equal(ballSecurityFromTotals(1,0),54.55);
 assert.equal(ballSecurityFromTotals(100,0),95.45);
});

test("Unknown data, zero-volume and invalid totals never turn into invented percentages",()=>{
 assert.equal(ballSecurityFromTotals(15,null),null);
 assert.equal(ballSecurityFromTotals(null,5),null);
 assert.equal(ballSecurityFromTotals(0,0),null);
 assert.equal(ballSecurityFromTotals(-1,4),null);
 assert.equal(ballSecurityFromTotals(2,-3),null);
 assert.equal(ballSecurityFromRecords([row(null,5)],metric).value,null);
 assert.equal(ballSecurityFromRecords([row(0,0)],metric).value,null);
});

test("Season smoothing occurs once after adding covered competitions",()=>{
 const result=ballSecurityFromRecords([row(80,25),row(10,8)],metric);
 assert.equal(result.value,Math.round((90+5)/(90+33+10)*10000)/100);
 assert.deepEqual(result.inputs,{dribbles:90,dispossessed:33,actions:123});
 assert.equal(result.rawValue,Math.round(90/123*10000)/100);
 assert.equal(result.partial,false);
 assert.equal(result.paired,2);
 assert.equal(result.excluded,0);
});

test("FotMob's Dribbles works even without attempts or dribble success percentage",()=>{
 const result=ballSecurityFromRecords([row(22,9)],metric);
 assert.equal(result.value,Math.round((22+5)/(22+9+10)*10000)/100);
 assert.equal(result.partial,false);
});

test("Reported attempted dribbles cannot replace missing completed dribbles",()=>{
 const result=ballSecurityFromRecords([row(null,3,[{name:"Dribbles attempted",value:30},{name:"Dribbles success rate",value:60}])],metric);
 assert.equal(result.value,null);
 assert.equal(result.partial,true);
 assert.equal(result.excluded,1);
});

test("Partial competition coverage cannot pretend to be full-season data",()=>{
 const result=ballSecurityFromRecords([row(10,2),row(5,null),row(null,4)],metric);
 assert.equal(result.paired,1);
 assert.equal(result.excluded,2);
 assert.equal(result.partial,true);
 assert.notEqual(result.value,null); // intermediate diagnostics only, Composite rejects partial
});

test("Identical count across few actions is pulled closer to average than a large sample",()=>{
 const small=ballSecurityFromTotals(3,1);
 const large=ballSecurityFromTotals(300,100);
 assert.ok(small<large);
 assert.ok(Math.abs(small-50)<Math.abs(large-50));
});

test("Winger Ball Security is exposed to the historical Composite with non-partial data",()=>{
 const source=readFileSync(new URL("../src/utils/historicalPeers.js",import.meta.url),"utf8");
 assert.match(source,/values\.ball_security=\["W","CAM","FB","WB"\]\.includes\(role\)&&!security\.partial\?security\.value:null/);
 assert.match(source,/ballSecurityFromRecords\(records,metricTotal\)/);
});
