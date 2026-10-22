import test from "node:test";
import assert from "node:assert/strict";
import {providerMetricBridge,eligibleUnderstatSeason,enrichUnderstatSeason,enrichImportedUnderstat} from "../src/utils/understatHistoricalBridge.js";
import {buildHistoricalObservations,compareHistoricalObservation} from "../src/utils/historicalPeers.js";
const rice="6acd65944897bc1b68fe2b15";
const season={id:"fb-1",player_id:rice,fotmob_player_id:"654096",fotmob_team_id:"9825",
 team_name:"Arsenal",season:"2023/2024",competition:"Premier League",minutes:3230,appearances:38,rating:7.66,metrics:[]};
const u={id:"us-1",record_kind:"understat_summary",fotmob_player_id:"654096",
  fotmob_team_id:"9825",season:"2023/2024",competition:"EPL",
  minutes:3256,appearances:38,status:"manual_identity_unverified",
  metrics:[{name:"xA",value:5.9,per90:5.9*90/3256},{name:"npxG",value:3.19,per90:3.19*90/3256},
  {name:"xGBuildup",value:16.13,per90:16.13*90/3256},
  {name:"xGChain",value:19.68,per90:19.68*90/3256},
  {name:"goals",value:7},{name:"assists",value:8}]};
test("Traduce los indicadores de Understat a métricas de temporada conservando identidad y procedencia",()=>{
 const bridge=providerMetricBridge(u);
 assert.equal(bridge.metrics.find(m=>m.name==="xG Buildup").value,16.13);
 assert.equal(bridge.metrics.find(m=>m.name==="Non-penalty xG").value,3.19);
 assert.equal(bridge.metrics.find(m=>m.name==="Understat minutes").value,3256);
 assert.equal(bridge.metrics.find(m=>m.name==="xA").source,"Understat");
 assert.equal(bridge.metrics.find(m=>m.name==="xA").verification_status,"manual_identity_unverified");
 const result=enrichUnderstatSeason(season,u);
 assert.equal(result.changed,true);
 assert.equal(result.row.minutes,3230);
 assert.equal(result.row.metrics.find(m=>m.name==="xA").value,5.9);
 assert.equal(enrichUnderstatSeason(result.row,u).added,0);
});
test("La diferencia de minutos FotMob/Understat NO infla ni reduce xA, npxG, xG Chain ni Buildup",()=>{
 const converted=enrichUnderstatSeason(season,u).row;
 const observation=buildHistoricalObservations({players:[{id:rice,name:"Declan Rice",position:"CM"}],stats:[converted]})[0];
 assert.ok(Math.abs(observation.values.xa_p90-5.9*90/3256)<1e-10);
 assert.ok(Math.abs(observation.values.npxg_p90-3.19*90/3256)<1e-10);
 assert.ok(Math.abs(observation.values.xg_chain_p90-19.68*90/3256)<1e-10);
 assert.ok(Math.abs(observation.values.xg_buildup_p90-16.13*90/3256)<1e-10);
});
test("No inventa datos para otro club, año o competición ni rellena huecos sobre valores manuales",()=>{
 assert.equal(eligibleUnderstatSeason(u,{...season,fotmob_team_id:"8654"}),false);
 assert.equal(eligibleUnderstatSeason(u,{...season,season:"2022/2023"}),false);
 assert.equal(eligibleUnderstatSeason(u,{...season,competition:"FA Cup"}),false);
 assert.equal(enrichUnderstatSeason({...season,fotmob_team_id:"8654"},u).changed,false);
 const withManual={...season,metrics:[{name:"xA",value:9.1}]};
 const r=enrichUnderstatSeason(withManual,u);
 assert.equal(r.row.metrics.find(m=>m.name==="xA").value,9.1);
 assert.equal(r.row.metrics.filter(m=>m.name==="xA").length,1);
 assert.equal(providerMetricBridge({...u,minutes:1}),null);
});
test("Puede completar historiales de importación ya guardados sin duplicar ni pedir confirmación",async()=>{
 const rows=[{...season}];
 const db={entities:{
  PlayerProviderRecord:{filter:async()=>[u]},
  PlayerSeasonStats:{filter:async()=>rows,update:async(id,patch)=>{assert.equal(id,season.id);rows[0].metrics=patch.metrics;}}
 }};
 const a=await enrichImportedUnderstat(db,rice,"654096");
 assert.equal(a.updated,1);assert.equal(a.ambiguous,0);
 const b=await enrichImportedUnderstat(db,rice,"654096");
 assert.equal(b.updated,0);
});
test("No otorga Composite por una única estadística de posesión de minutos",()=>{
 const obs=[
  {role:"CM",playerId:"one",season:"2023/2024",values:{play_share:90},position:"CM"},
  {role:"CM",playerId:"two",season:"2023/2024",values:{play_share:20},position:"CM"}
 ];
 const r=compareHistoricalObservation(obs[0],obs);
 assert.equal(r.rows.find(m=>m.key==="play_share").percentile,100);
 assert.equal(r.composite.score,null);
 assert.equal(r.composite.status,"insufficient_coverage");
});

test("Integra LaLiga desde Understat por nombre exacto del club cuando la fuente carece de fotmob_team_id",()=>{
 const summary={record_kind:"understat_summary",fotmob_player_id:"440330",fotmob_team_id:"",team_name:"Atletico Madrid",season:"2025/2026",competition:"La_Liga",minutes:211,appearances:4,status:"dataset_identity_confirmed",metrics:[
  {name:"xGChain",value:0.8826632164418697,per90:0.8826632164418697*90/211},
  {name:"xGBuildup",value:0.031262032687664,per90:0.031262032687664*90/211}]};
 const season={id:"sorloth",fotmob_player_id:"440330",fotmob_team_id:"9906",team_name:"Atlético de Madrid",season:"2025/2026",competition:"LaLiga",minutes:1850,metrics:[]};
 assert.equal(eligibleUnderstatSeason(summary,season),true);
 const next=enrichUnderstatSeason(season,summary);
 assert.equal(next.changed,true);
 assert.ok(Math.abs(next.row.metrics.find(m=>m.name==="xG Chain").per90-0.376)<0.002);
 assert.ok(Math.abs(next.row.metrics.find(m=>m.name==="xG Buildup").per90-0.0133)<0.002);
 assert.equal(eligibleUnderstatSeason(summary,{...season,competition:"Champions League"}),false);
 assert.equal(eligibleUnderstatSeason(summary,{...season,team_name:"Real Sociedad"}),false);
});
