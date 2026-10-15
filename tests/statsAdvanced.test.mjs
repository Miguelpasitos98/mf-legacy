import test from "node:test";
import assert from "node:assert/strict";
import {advancedTotals} from "../src/utils/statsAdvanced.js";
import {initialConfig,columnValue,getColumn} from "../src/utils/statsColumns.js";
const row=(minutes,chain,buildup,won,total)=>({minutes:minutes*2,metrics:[
 {name:"Understat minutes",value:minutes},{name:"xG Chain",value:chain},
 {name:"xG Buildup",value:buildup},{name:"Ground duels won",value:won},
 {name:"Ground duels contested",value:total},{name:"Ground duels won %",value:100*won/total}
]});
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
