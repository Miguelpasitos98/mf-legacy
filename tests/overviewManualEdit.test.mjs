import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createOverviewManualChanges} from "../src/utils/overviewManualChanges.js";
import {applyManualStatChanges} from "../src/utils/manualStats.js";
import {advancedTotals} from "../src/utils/statsAdvanced.js";
const source="Understat histórico, temporada y competición revisadas";
const record={id:"f-1",player_id:"player-1",fotmob_player_id:"194165",season:"2020/2021",
 competition:"Bundesliga",minutes:3274,appearances:29,
 metrics:[{name:"Goals",value:41},{name:"xG",value:30},{name:"xG Chain",value:14}]};
const changes=(mode,form,rec=record)=>createOverviewManualChanges(rec,mode,form,source);
test("xG Chain total + minutos Understat se guardan juntos y el Composite obtiene /90",()=>{
 const updates=changes("chain",{value:"18,5",sourceMinutes:"1800",unit:"total"});
 assert.deepEqual(updates.map(c=>c.name),["xG Chain","Understat minutes"]);
 const merged={...record,...applyManualStatChanges(record,updates).update};
 assert.equal(advancedTotals([merged]).xg_chain_p90,.925);
 assert.equal(advancedTotals([merged]).xg_buildup_p90,null);
 assert.equal(merged.manual_metric_history.length,2);
 assert.equal(record.metrics.length,3);
});
test("xG Buildup se puede introducir por separado sin inventar xG Chain",()=>{
 const rec={...record,metrics:[{name:"Goals",value:41}]};
 const updates=changes("buildup",{value:"3,6",sourceMinutes:"900",unit:"total"},rec);
 const combined={...rec,...applyManualStatChanges(rec,updates).update};
 const result=advancedTotals([combined]);
 assert.equal(result.xg_chain_p90,null);
 assert.equal(result.xg_buildup_p90,.36);
 assert.equal(result.buildupRows,1);
});
test("Valor xG Chain /90 con denominador reconstruye el total trazablemente",()=>{
 const r={...record,metrics:[]};
 const all=changes("chain",{value:"0,9",sourceMinutes:"1200",unit:"per90"},r);
 const result=applyManualStatChanges(r,all);
 assert.equal(result.update.metrics.find(m=>m.name==="xG Chain").value,12);
 assert.match(result.update.manual_metric_history[0].source_note,/derivado/i);
});
test("Duelos terrestres guardan denominador, numerador y porcentaje en una sola operación",()=>{
 const update=applyManualStatChanges(record,changes("ground",{won:"11",contested:"28"})).update;
 const stats=advancedTotals([{...record,...update}]);
 assert.equal(stats.ground_duels_won_pct,11/28*100);
 assert.equal(update.metrics.filter(m=>m.name.startsWith("Ground duels")).length,3);
 assert.equal(update.manual_metric_history.length,3);
});
test("Solo se alteran estadísticas editadas y el valor anterior queda registrado",()=>{
 const update=applyManualStatChanges(record,changes("xg",{value:"30,25"})).update;
 assert.equal(update.metrics.find(m=>m.name==="Goals").value,41);
 assert.equal(update.manual_metric_history[0].old_value,30);
 assert.equal(update.manual_metric_history[0].new_value,30.25);
});
test("Rechaza duelos imposibles, minutos inválidos y buildup superior a chain",()=>{
 assert.throws(()=>changes("ground",{won:"29",contested:"28"}),/duelos/i);
 assert.throws(()=>changes("ground",{won:"3,5",contested:"28"}),/entero/i);
 assert.throws(()=>changes("chain",{value:"2",sourceMinutes:"0",unit:"total"}),/mayores/i);
 assert.throws(()=>changes("buildup",{value:"15",sourceMinutes:"1000",unit:"total"}),/no puede superar/i);
 assert.throws(()=>changes("xg",{value:"30"}),/coinciden/i);
});
test("El dato manual se guarda sin exigir fuente",()=>{
 const updates=createOverviewManualChanges(record,"xg",{value:"34"},"");
 assert.equal(updates[0].sourceNote,"Registro manual");
});
test("El Overview tiene accesos de edición por tarjeta y una modal por competición",()=>{
 const read=f=>readFileSync(new URL(f,import.meta.url),"utf8");
 const view=read("../src/components/stats/MfLegacyOverview.jsx");
 const modal=read("../src/components/stats/OverviewManualEditor.jsx");
 const stats=read("../src/pages/Stats.jsx");
 for(const mode of ["chain","buildup","ground","xg","xa","goals","assists","minutes","rating"]){
  assert.match(view,new RegExp('edit\\("'+mode+'"\\)'));
 }
 assert.match(view,/<OverviewManualEditor mode=\{manualMode\}/);
 assert.match(view,/onSave=\{onSetMetric\}/);
 assert.match(modal,/createOverviewManualChanges/);
 assert.match(modal,/sorted\.map/);
 assert.match(stats,/onSetMetric=\{onSetMetric\}/);
 assert.match(stats,/applyManualStatChanges/);
});