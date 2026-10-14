import test from "node:test";
import assert from "node:assert/strict";
import {seasonSummary} from "../src/utils/statsSeason.js";
import {columnValue,initialConfig} from "../src/utils/statsColumns.js";
const rec=(competition,appearances,minutes,rating,goals,assists,xg,xa,team_matches)=>({
 player_id:"asensio",season:"2025/2026",competition,appearances,minutes,rating,team_matches,
 metrics:[["goals",goals],["assists",assists],["xg",xg],["xa",xa]].filter(([,v])=>v!=null).map(([name,value])=>({name,value}))
});
const rows=[
 rec("Cup Grp. C",null,null,null,2,null,null,null,null),
 rec("Europa League",9,552,6.81,0,0,0.5,1.44,10),
 rec("Super Lig",25,1878,7.81,11,12,6.29,4.44,34)
];
test("copa sin PJ ni minutos mantiene goles conocidos pero no altera ratios",()=>{
 const s=seasonSummary(rows);
 assert.equal(s.excludedCompetitions,0);
 assert.equal(s.totals.goals.value,13);
 assert.equal(s.totals.assists.value,12);
 assert.equal(s.totals.minutes.value,2430);
 assert.equal(s.totals.appearances.value,34);
 assert.equal(s.totals.xg.partial,true);
 assert.ok(Math.abs(s.weightedRating-((6.81*9+7.81*25)/34))<1e-10);
});
test("G+A /90 y Play % no se bloquean por copa sin datos de uso",()=>{
 const s=seasonSummary(rows),cfg=initialConfig();
 assert.ok(Math.abs(columnValue(s,"season","gaper90",cfg)-23*90/2430)<1e-10);
 assert.ok(Math.abs(columnValue(s,"season","playpct",cfg)-2430/(44*90)*100)<1e-10);
 assert.equal(s.ratingPartial,true);
});
test("falta de xG en competición elegible sigue siendo dato parcial",()=>{
 const s=seasonSummary([rows[1],rec("Super Lig",25,1878,7.81,11,12,null,4.44,34)]);
 assert.equal(s.totals.xg.partial,true);
 assert.equal(columnValue(s,"season","xgper90",initialConfig()),0.5*90/552);
});
test("competición completa con nota ausente conserva goles y minutos y media parcial",()=>{
 const s=seasonSummary([rows[1],rec("Super Lig",25,1878,null,11,12,6.29,4.44,34)]);
 assert.equal(s.totals.goals.value,11);
 assert.equal(s.totals.minutes.value,2430);
 assert.equal(s.ratingPartial,true);
 assert.ok(s.weightedRating>0);
});
