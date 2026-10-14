import test from "node:test";
import assert from "node:assert/strict";
import {buildSeasonSummaries} from "../src/utils/statsSeason.js";
import {columnValue,formulaCoverage,initialConfig} from "../src/utils/statsColumns.js";
const mk=(competition,minutes,appearances,goals,assists,xg,xa)=>({player_id:"raphinha",season:"2023/2024",competition,minutes,appearances,rating:7.5,metrics:[["goals",goals],["assists",assists],["xg",xg],["xa",xa]].filter(([,v])=>v!==null).map(([name,value])=>({name,value}))});
test("Raphinha: xG+xA/90 excluye solo Supercopa y conserva sus goles",()=>{
 const rows=[mk("Champions League",473,7,3,2,2.53,1.42),mk("Copa del Rey",64,1,1,0,.37,.18),mk("LaLiga",1370,28,6,9,7.38,4.99),mk("Super Cup",169,2,2,1,null,null)];
 const sum=buildSeasonSummaries(rows,[])[0],cfg=initialConfig();
 assert.equal(sum.totals.goals.value,12);
 assert.equal(sum.totals.assists.value,12);
 assert.equal(sum.totals.minutes.value,2076);
 assert.equal(sum.totals.xg.value,10.28);
 assert.equal(sum.totals.xg.partial,true);
 assert.ok(Math.abs(columnValue(sum,"season","xgaper90",cfg)-(10.28+6.59)*90/1907)<1e-10);
 assert.ok(Math.abs(columnValue(sum,"season","gaper90",cfg)-24*90/2076)<1e-10);
 const coverage=formulaCoverage(sum,"season","xgaper90",cfg);
 assert.equal(coverage.available,3);assert.equal(coverage.total,4);assert.equal(coverage.minutes,1907);
});
test("fórmula personalizada usa solo las competiciones con todos sus operandos",()=>{
 const cfg=initialConfig();cfg.computed.push({id:"calc_mix",name:"xG mas goles /90",formula:"(xg+goals)*90/minutes",decimals:2});
 const sum=buildSeasonSummaries([mk("LaLiga",1000,13,7,3,4,2),mk("Super Cup",90,1,2,0,null,null)],[])[0];
 assert.equal(columnValue(sum,"season","calc_mix",cfg),(4+7)*90/1000);
});
