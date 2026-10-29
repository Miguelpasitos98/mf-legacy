import test from "node:test";
import assert from "node:assert/strict";
import {advancedTotals} from "../src/utils/statsAdvanced.js";
import {initialConfig,columnValue,getColumn} from "../src/utils/statsColumns.js";
const row=(minutes,chain,buildup,won,total)=>({minutes:minutes*2,metrics:[
 {name:"Understat minutes",value:minutes},{name:"xG Chain",value:chain},
 {name:"xG Buildup",value:buildup},{name:"Ground duels won",value:won},
 {name:"Ground duels contested",value:total},{name:"Ground duels won %",value:100*won/total}
]});

test('Published verified league rate survives cups without manufacturing Understat minutes',()=>{
 const provenance={provider:'craftedfc_understat',scope:'league_team_season',rate_kind:'published_per90'};
 const league={season:'2025/2026',fotmob_team_id:'8633',fotmob_tournament_id:'87',minutes:2746,metrics:[{name:'xG Chain /90',per90:.6203,provenance},{name:'xG Buildup /90',per90:.4981,provenance}]};
 const result=advancedTotals([league,{season:'2025/2026',metrics:[]}]);
 assert.equal(result.xg_chain_p90,.6203);assert.equal(result.xg_buildup_p90,.4981);
 assert.equal(result.understatMinutes,0);assert.equal(result.understatRows,1);
 assert.equal(columnValue(league,'competition','calc_xgchainper90',initialConfig()),.6203);
 assert.equal(columnValue({records:[league,{season:'2025/2026',metrics:[]}]},'season','calc_xgbuildupper90',initialConfig()),.4981);
 assert.equal(advancedTotals([league,{...league,season:'2026/2027'}]).xg_chain_p90,null);
});
test("Ficha de jugador detecta los tres indicadores importados",()=>{
 const r=advancedTotals([row(1000,20,5,11,28),row(500,5,2,9,12)]);
 assert.equal(r.xg_chain_p90,1.5);
 assert.equal(r.xg_buildup_p90,0.42);
 assert.equal(r.ground_duels_won_pct,50);
 assert.equal(r.understatRows,2);
 assert.equal(r.duelRows,2);
});
test("Cobertura parcial omite competiciones sin Understat, sin sumar sus minutos",()=>{
 const r=advancedTotals([row(1000,20,5,11,28),{minutes:800,metrics:[{name:"Goals",value:8}]}]);
 assert.equal(r.xg_chain_p90,1.8);
 assert.equal(r.understatRows,1);
 assert.equal(r.totalRows,2);
});
test("Las tasas importadas de liga siguen visibles cuando hay copas sin Understat",()=>{
 const league=row(1613,9.250628160312772,9.250628160312772,1,2);
 league.metrics.find(m=>m.name==='xG Chain').per90=0.5161540821005266;
 league.metrics.find(m=>m.name==='xG Buildup').per90=0.5161540821005266;
 const result=advancedTotals([league,{minutes:500,metrics:[]},{minutes:15,metrics:[]}]);
 assert.equal(result.xg_chain_p90,0.5161540821005266);assert.equal(result.xg_buildup_p90,result.xg_chain_p90);
 assert.equal(result.understatMinutes,1613);assert.equal(result.understatRows,1);assert.equal(result.totalRows,3);
});
test("Sin recuentos o minutos, el resultado está ausente, nunca es cero",()=>{
 const r=advancedTotals([{metrics:[{name:"Ground duels won %",value:70},{name:"xG Chain",value:5}]}]);
 assert.equal(r.ground_duels_won_pct,null);
 assert.equal(r.xg_chain_p90,null);
 assert.equal(r.xg_buildup_p90,null);
});
test("Los nuevos indicadores son columnas configurables por competición",()=>{
 const config=initialConfig(),r=row(1000,20,5,11,28);
 assert.equal(columnValue(r,"competition","calc_xgchainper90",config),1.8);
 assert.equal(columnValue(r,"competition","calc_xgbuildupper90",config),0.45);
 assert.equal(columnValue(r,"competition","calc_groundduelspct",config),11/28*100);
 assert.equal(getColumn(config,"calc_groundduelspct").unit,"%");
});

test("Ter Stegen: rate explicitly entered for the full season survives Barcelona → Girona transfer",()=>{
 const records=[
  {season:"2025/2026",team_id:"barcelona",competition:"Copa del Rey",minutes:null,appearances:1,metrics:[]},
  {season:"2025/2026",team_id:"girona",competition:"LaLiga",minutes:null,appearances:2,metrics:[{name:"xG Buildup season /90",value:0.01}]}
 ];
 assert.equal(advancedTotals(records).xg_buildup_p90,0.01);
 assert.equal(advancedTotals(records,{includeSeasonRates:false}).xg_buildup_p90,null);
 // A season-wide rate must not be projected into a single club/competition.
 assert.equal(advancedTotals([records[0]],{includeSeasonRates:false}).xg_buildup_p90,null);
});
test("A conflicting full-season rate is rejected, never chosen from an arbitrary club",()=>{
 const original=[
  {season:"2025/2026",team_id:"barcelona",metrics:[{name:"xG Buildup season /90",value:0.5}]},
  {season:"2025/2026",team_id:"girona",metrics:[{name:"xG Buildup season /90",value:0.9}]}
 ];
 assert.equal(advancedTotals(original).xg_buildup_p90,null);
 assert.equal(advancedTotals(original.map(v=>({...v,metrics:[{name:"xG Buildup season /90",value:0.5}]}))).xg_buildup_p90,0.5);
 assert.equal(advancedTotals([{...original[0],season:"2024/2025"},original[1]]).xg_buildup_p90,null);
});
