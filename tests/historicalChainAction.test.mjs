import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildHistoricalObservations} from "../src/utils/historicalPeers.js";
const source=path=>readFileSync(new URL(path,import.meta.url),"utf8");

test("No asocia xG Chain global de CraftedFC con Arsenal 2023/2024",()=>{
 const player={id:"havertz",name:"Kai Havertz",position:"ST"};
 const rows=[
  {player_id:"havertz",season:"2023/2024",team_name:"Arsenal",competition:"Premier League",minutes:2639,metrics:[{name:"xG",value:11.23}]},
  {player_id:"havertz",season:"2023/2024",team_name:"Arsenal",competition:"Champions League",minutes:832,metrics:[]},
 ];
 const snapshot={stats:{us_xGChain90:.6144,us_xGBuildup90:.2959},current_season:"2026/2027"};
 const observations=buildHistoricalObservations({players:[player],stats:rows,valuations:[],teamMatches:[]});
 const historical=observations.find(x=>x.playerId==="havertz");
 assert.equal(historical.values.xg_chain_p90,null);
 assert.equal(historical.values.xg_buildup_p90,null);
 assert.equal(snapshot.stats.us_xGChain90,.6144);
});
test("La pestaña Análisis ofrece introducción manual desde ambas filas ausentes",()=>{
 const preview=source("../src/components/stats/HistoricalPeerPreview.jsx");
 const wrapper=source("../src/components/stats/CraftedfcAnalysis.jsx");
 const page=source("../src/pages/Stats.jsx");
 for(const pattern of [/onSetMetric&&\!NON_EDITABLE_COMPOSITE\.has\(item\.key\)/,/xg_chain_p90/,/xg_buildup_p90/,/Añadir \+/,/<OverviewManualEditor mode=\{manualMode/,/records=\{rowsToEdit\}/,/season===season/])assert.match(preview,pattern);
 assert.match(preview,/snapshot global de CraftedFC/);
 assert.match(wrapper,/editableRows=\{editableRows\} onSetMetric=\{onSetMetric\}/);
 assert.match(page,/initialSeason=\{activeSeason\} editableRows=\{stats\} onSetMetric=\{onSetMetric\}/);
});
