import test from "node:test";
import assert from "node:assert/strict";
import {ballSecurityFromTotals,ballSecurityFromRecords,inferDribbleAttempts} from "../src/utils/ballSecurity.js";
import {readFileSync} from "node:fs";
test("Ball Security calcula completados/(intentados+desposeído), expresado como porcentaje",()=>{
 assert.equal(ballSecurityFromTotals(80,110,25),59.26);
 assert.equal(ballSecurityFromTotals(0,20,0),0);
});
test("No inventa valor si falta uno de los tres totales",()=>{
 assert.equal(ballSecurityFromTotals(15,null,5),null);
 assert.equal(ballSecurityFromTotals(15,20,undefined),null);
 assert.equal(ballSecurityFromTotals(10,8,4),null);
 assert.equal(ballSecurityFromTotals(0,0,0),null);
});
test("Agrupa totales emparejados por competición, no medias de porcentajes",()=>{
 const rows=[
  {metrics:[{name:"Successful dribbles",value:80},{name:"Dribbles attempted",value:110},{name:"Dispossessed",value:25}]},
  {metrics:[{name:"Successful dribbles",value:10},{name:"Dribbles attempted",value:12},{name:"Dispossessed",value:8}]}
 ];
 const extract=(row,names)=>row.metrics.find(m=>names.includes(m.name))?.value??null;
 const x=ballSecurityFromRecords(rows,extract);
 assert.equal(x.value,Math.round(90/(110+12+25+8)*10000)/100);
 assert.equal(x.paired,2);
 assert.equal(x.excluded,0);
});
test("Diferencias de cobertura no permiten un porcentaje completo engañoso",()=>{
 const rows=[
  {metrics:[{name:"Dribbles",value:10},{name:"Dribbles attempted",value:15},{name:"Dispossessed",value:2}]},
  {metrics:[{name:"Dribbles",value:5},{name:"Dispossessed",value:3}]}
 ];
 const extract=(row,names)=>row.metrics.find(m=>names.includes(m.name))?.value??null;
 const x=ballSecurityFromRecords(rows,extract);
 assert.equal(x.partial,true);
 assert.equal(x.paired,1);
 assert.equal(x.excluded,1);
});
test("Musiala Bayern 2024/2025: intenta 131+61+15, genera 36.76%",()=>{
 const pairs=[
  [72,54.961832061068705,33],
  [23,37.704918032786885,26],
  [5,33.333333333333336,6]
 ];
 assert.deepEqual(pairs.map(([c,r])=>inferDribbleAttempts(c,r)),[131,61,15]);
 const rows=pairs.map(([c,r,d])=>({metrics:[
  {name:"Dribbles",value:c},{name:"Dribbles success rate",value:r},{name:"Dispossessed",value:d}]}));
 const get=(row,names)=>row.metrics.find(m=>names.includes(m.name))?.value??null;
 const result=ballSecurityFromRecords(rows,get);
 assert.equal(result.value,36.76);
 assert.deepEqual(result.inputs,{completed:100,attempted:207,dispossessed:65});
 assert.equal(result.partial,false);
});
test("El redondeo ambiguo, ratio cero y ausencia de tasa NO inventan intentos",()=>{
 assert.equal(inferDribbleAttempts(0,0),null);
 assert.equal(inferDribbleAttempts(13,null),null);
 assert.equal(inferDribbleAttempts(1,0.1),null);
 assert.equal(inferDribbleAttempts(5,120),null);
});
test("El índice histórico lo calcula solo para W/CAM/FB/WB y no finge ser una fórmula oficial",()=>{
 const source=readFileSync(new URL("../src/utils/historicalPeers.js",import.meta.url),"utf8");
 assert.match(source,/values\.ball_security=\["W","CAM","FB","WB"\]\.includes\(role\)&&!security\.partial\?security\.value:null/);
 assert.match(source,/ballSecurityFromRecords\(records,metricTotal\)/);
});
