import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 PERFORMANCE_TABS,GENERAL_PERFORMANCE_COLUMNS,showPerformanceGeneral,
 showPerformanceOverviewCards,performanceAdvancedKeys,visiblePerformanceMetricColumns
} from "../src/utils/performanceViewLayout.js";

test("Only Summary and Goalkeeping show PJ, minutes, team matches and rating",()=>{
 assert.deepEqual(PERFORMANCE_TABS,["Resumen","Ataque","Creación","Defensa","Portería","Físico"]);
 assert.deepEqual(GENERAL_PERFORMANCE_COLUMNS,["appearances","minutes","team_matches","rating"]);
 for(const tab of PERFORMANCE_TABS)
  assert.equal(showPerformanceGeneral(tab),tab==="Resumen"||tab==="Portería",tab);
});
test("Only Summary displays the five general snapshot cards",()=>{
 for(const tab of PERFORMANCE_TABS)
  assert.equal(showPerformanceOverviewCards(tab),tab==="Resumen",tab);
});
test("Advanced performance stats follow their own category without disappearing",()=>{
 assert.deepEqual(performanceAdvancedKeys("Resumen"),["chain","buildup","ground"]);
 assert.deepEqual(performanceAdvancedKeys("Creación"),["chain","buildup"]);
 assert.deepEqual(performanceAdvancedKeys("Defensa"),["ground"]);
 for(const tab of ["Ataque","Portería","Físico"])assert.deepEqual(performanceAdvancedKeys(tab),[]);
});
test("Saved custom layouts cannot duplicate the general columns",()=>{
 const cols=["appearances","goals","minutes","xa","rating","team_matches","xgot"];
 for(const tab of PERFORMANCE_TABS)assert.deepEqual(visiblePerformanceMetricColumns(cols,tab),["goals","xa","xgot"]);
});
test("Player detail Performance applies the same rule to all general headers, cells and empty-state colspan",()=>{
 const source=readFileSync(new URL("../src/pages/Stats.jsx",import.meta.url),"utf8");
 assert.match(source,/const performanceGeneral=showPerformanceGeneral\(category\)/);
 assert.match(source,/const selected=visiblePerformanceMetricColumns\(config\.columns\.competition\[category\]\|\|\[\],category\)/);
 assert.match(source,/performanceGeneral&&<><th className=\{["']px-3 py-3/);
 assert.match(source,/performanceGeneral&&<><td className=\{["']px-3 py-3/);
 assert.match(source,/colSpan=\{\(performanceGeneral\?6:2\)\+selected\.length\}/);
 assert.match(source,/showPerformanceOverviewCards\(category\)&&<div/);
 assert.match(source,/advancedKeys\.length>0&&<div/);
});
