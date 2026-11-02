import test from "node:test";
import assert from "node:assert/strict";
import {analyzeLineup,validCA,zoneAt,positionFit,referenceTeams} from "../src/components/teams/lineupAnalysis.mjs";
test("CA missing is unknown rather than zero",()=>{
 assert.equal(validCA(undefined),null);
 assert.equal(validCA(""),null);
 assert.equal(validCA("151"),151);
 assert.equal(validCA(201),null);
});
test("movable positional zones depend on coordinates",()=>{
 assert.equal(zoneAt(50,89),"GK");
 assert.equal(zoneAt(80,18),"ATT");
 assert.equal(positionFit({position:"ED"},85,22),1);
 assert.equal(positionFit({position:"ED"},15,22),0.85);
 assert.equal(positionFit({position:"GK"},50,20),0.25);
});
test("metrics react to moving and missing CA",()=>{
 const roster=[{player_id:"a",player:{ca:170,position:"GK"}},{player_id:"b",player:{ca:150,position:"DFC"}},{player_id:"c",player:{position:"DC"}}];
 const good=analyzeLineup([{player_id:"a",x:50,y:91},{player_id:"b",x:40,y:77},{player_id:"c",x:50,y:20}],roster);
 const bad=analyzeLineup([{player_id:"a",x:50,y:20},{player_id:"b",x:40,y:77},{player_id:"c",x:50,y:91}],roster);
 assert.equal(good.knownCA,2);
 assert.equal(good.quality,160);
 assert.ok(good.balance>bad.balance);
});
test("benchmark excludes active team and ignores unverified CA",()=>{
 const players=[{id:"1",ca:150},{id:"2",ca:165},{id:"3",ca:0}];
 const members=[{team_id:"a",player_id:"1"},{team_id:"b",player_id:"2"},{team_id:"b",player_id:"3"}];
 assert.deepEqual(referenceTeams(members,players,"a"),[]);
});
