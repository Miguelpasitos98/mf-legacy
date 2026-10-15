import test from "node:test";
import assert from "node:assert/strict";
import {applyManualStatChange} from "../src/utils/manualStats.js";
import {assessHistoricalEnrichment} from "../src/utils/statsEnrichment.js";
const row={id:"r-1",player_id:"p-1",fotmob_player_id:"737066",season:"2018/2019",competition:"Bundesliga",minutes:900,appearances:10,rating:7.4,
  metrics:[{name:"xG",value:5.1,per90:0.51,percentile:70},{name:"Duels won",value:33}]};
const change=(name,value)=>({name,value,sourceNote:"FotMob histórico; fuente comprobada",changedAt:"2026-10-15T12:00:00Z"});
test("cambia una métrica con auditoría, conserva las otras y anula percentil antiguo",()=>{
 const {update,audit}=applyManualStatChange(row,change("xG","5,25"));
 assert.equal(update.metrics[0].value,5.25);
 assert.equal(update.metrics[0].per90,null);
 assert.equal(update.metrics[0].percentile,null);
 assert.equal(update.metrics[1].value,33);
 assert.equal(audit.old_value,5.1);
 assert.equal(audit.new_value,5.25);
 assert.equal(row.metrics[0].value,5.1);
});
test("permite incorporar datos anteriores, valores 0 y porcentajes diferentes de totales",()=>{
 const {update}=applyManualStatChange(row,change("Ground duels won %","41,76"));
 assert.equal(update.metrics.at(-1).value,41.76);
 assert.equal(applyManualStatChange({...row,...update},change("Ground duels won",0)).update.metrics.at(-1).value,0);
 assert.notEqual(update.metrics.at(-1).name,"Ground duels won");
});
test("edita campos PJ, minutos y nota sin mutar el original",()=>{
 const {update}=applyManualStatChange(row,{...change("Nota",7.7),field:"rating"});
 assert.equal(update.rating,7.7);
 assert.equal(row.rating,7.4);
 assert.equal(update.manual_metric_history[0].metric_name,"$field:rating");
});
test("rechaza porcentaje fuera de rango, minutos negativos y valores vacíos",()=>{
 for(const c of [change("Ground duels won %",120),{...change("Minutes",-1),field:"minutes"},change("xG","")]){
  assert.throws(()=>applyManualStatChange(row,c));
 }
});
test("acepta el dato sin exigir fuente",()=>{
 const {update,audit}=applyManualStatChange(row,{name:"xG",value:6,changedAt:"2026-10-15T12:00:00Z"});
 assert.equal(update.metrics[0].value,6);
 assert.equal(audit.source_note,"Registro manual");
});
test("importaciones siguientes no sobrescriben una corrección manual",()=>{
 const {update}=applyManualStatChange(row,change("xG",5.25));
 const corrected={...row,...update};
 const result=assessHistoricalEnrichment(corrected,{player_fotmob_id:"737066",season:"2018/2019",competition:"Bundesliga",minutes:900,appearances:10,metrics:[{name:"xG",value:100},{name:"xG Chain",value:12}]},row.player_id);
 assert.equal(result.ok,true);
 assert.equal(result.metrics.find(m=>m.name==="xG").value,5.25);
 assert.deepEqual(result.conflicts,["xG"]);
 assert.equal(result.added,1);
});