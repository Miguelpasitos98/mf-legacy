import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {ballSecurityFromTotals,ballSecurityFromRecords,BALL_SECURITY_PRIOR_ACTIONS,BALL_SECURITY_MIN_MINUTES_COVERAGE_PCT} from "../src/utils/ballSecurity.js";
import {buildHistoricalObservations} from "../src/utils/historicalPeers.js";

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
 assert.match(source,/values\.ball_security=\["W","CAM","FB","WB"\]\.includes\(role\)&&security\.eligible\?security\.value:null/);
 assert.match(source,/ballSecurityFromRecords\(records,metricTotal\)/);
});

test("Winger's genuine FotMob Dribbles + Dispossessed produce a Composite Ball Security observation",()=>{
 const players=[{id:"winger-1",name:"Extremo de prueba",position:"ED"}];
 const stats=[{player_id:"winger-1",season:"2024/2025",competition:"LaLiga",minutes:2000,appearances:28,metrics:[
  {name:"Dribbles",value:50},{name:"Dispossessed",value:20}
 ]}];
 const [observation]=buildHistoricalObservations({players,stats});
 assert.equal(observation.role,"W");
 assert.equal(observation.values.ball_security,ballSecurityFromTotals(50,20));
 assert.equal(observation.ballSecurityDetail.inputs.dribbles,50);
 assert.equal(observation.ballSecurityDetail.inputs.dispossessed,20);
 assert.equal(observation.ballSecurityDetail.smoothing.priorActions,10);
});
test("Winger with missing Dispossessed in a cup gets no full-season Ball Security",()=>{
 const players=[{id:"winger-1",name:"Extremo de prueba",position:"ED"}];
 const stats=[
  {player_id:"winger-1",season:"2024/2025",competition:"LaLiga",minutes:1800,metrics:[{name:"Dribbles",value:50},{name:"Dispossessed",value:20}]},
  {player_id:"winger-1",season:"2024/2025",competition:"Champions League",minutes:500,metrics:[{name:"Dribbles",value:8}]}
 ];
 const [observation]=buildHistoricalObservations({players,stats});
 assert.equal(observation.values.ball_security,null);
 assert.equal(observation.ballSecurityDetail.partial,true);
 assert.equal(observation.ballSecurityDetail.excluded,1);
});

test("Phil Foden 2023/24: EFL Cup cameo without advanced stats cannot erase 99.59% real-minute coverage",()=>{
 const player={id:"foden",name:"Phil Foden",position:"EI"};
 const data=[
  {competition:"Premier League",minutes:2895,dribbles:47,lost:49},
  {competition:"Champions League",minutes:684,dribbles:11,lost:10},
  {competition:"FA Cup",minutes:436,dribbles:2,lost:6},
  {competition:"FIFA Club World Cup",minutes:146,dribbles:5,lost:1},
  {competition:"EFL Cup",minutes:17,dribbles:null,lost:null}
 ].map(x=>({player_id:player.id,season:"2023/2024",competition:x.competition,minutes:x.minutes,
   metrics:[...(x.dribbles===null?[]:[{name:"Dribbles",value:x.dribbles}]),
            ...(x.lost===null?[]:[{name:"Dispossessed",value:x.lost}])]}));
 const [observation]=buildHistoricalObservations({players:[player],stats:data});
 const audit=observation.ballSecurityDetail;
 assert.equal(BALL_SECURITY_MIN_MINUTES_COVERAGE_PCT,98);
 assert.equal(observation.role,"W");
 assert.deepEqual(audit.inputs,{dribbles:65,dispossessed:66,actions:131});
 assert.equal(audit.paired,4);
 assert.equal(audit.excluded,1);
 assert.equal(audit.coveredMinutes,4161);
 assert.equal(audit.allMinutes,4178);
 assert.equal(audit.coveragePct,99.59);
 assert.equal(audit.partial,true);
 assert.equal(audit.provisional,true);
 assert.equal(audit.eligible,true);
 assert.deepEqual(audit.missing,[{competition:"EFL Cup",season:"2023/2024",missing:["Dribbles","Dispossessed"],minutes:17}]);
 assert.equal(observation.values.ball_security,ballSecurityFromTotals(65,66));
 assert.equal(observation.values.ball_security,49.65);
});
test("Large missing competition must stay unavailable even if there are valid dribbles in another",()=>{
 const players=[{id:"foden",name:"Foden",position:"EI"}];
 const stats=[
  {player_id:"foden",season:"2023/2024",competition:"Premier League",minutes:1800,metrics:[{name:"Dribbles",value:45},{name:"Dispossessed",value:20}]},
  {player_id:"foden",season:"2023/2024",competition:"Champions League",minutes:300,metrics:[]}
 ];
 const [observation]=buildHistoricalObservations({players,stats});
 assert.equal(observation.ballSecurityDetail.coveragePct,85.71);
 assert.equal(observation.ballSecurityDetail.eligible,false);
 assert.equal(observation.values.ball_security,null);
});
test("Missing official minutes cannot certify partial Ball Security even with PJ estimates",()=>{
 const stats=[
  {competition:"Premier League",minutes:1800,appearances:20,metrics:[{name:"Dribbles",value:45},{name:"Dispossessed",value:20}]},
  {competition:"Cup",minutes:null,appearances:1,metrics:[]}
 ];
 const result=ballSecurityFromRecords(stats,metric);
 assert.equal(result.coverageReliable,false);
 assert.equal(result.coveragePct,null);
 assert.equal(result.provisional,false);
 assert.equal(result.eligible,false);
});
test("A complete source with missing minutes still calculates an observed Ball Security",()=>{
 const result=ballSecurityFromRecords([
  {competition:"LaLiga",minutes:null,metrics:[{name:"Dribbles",value:40},{name:"Dispossessed",value:15}]}
 ],metric);
 assert.equal(result.partial,false);
 assert.equal(result.provisional,false);
 assert.equal(result.eligible,true);
 assert.equal(result.coveragePct,null);
 assert.equal(result.value,ballSecurityFromTotals(40,15));
});
test("A real zero in the source counts as a paired competition; empty advanced stats do not",()=>{
 const result=ballSecurityFromRecords([
  {competition:"Copa",minutes:90,metrics:[{name:"Dribbles",value:0},{name:"Dispossessed",value:0}]},
  {competition:"Liga",minutes:900,metrics:[{name:"Dribbles",value:20},{name:"Dispossessed",value:10}]}
 ],metric);
 assert.equal(result.paired,2);
 assert.equal(result.excluded,0);
 assert.equal(result.eligible,true);
 assert.equal(result.value,ballSecurityFromTotals(20,10));
});
