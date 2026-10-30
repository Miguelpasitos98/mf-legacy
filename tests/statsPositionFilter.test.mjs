import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 STATS_POSITION_FILTER_OPTIONS, matchesStatsPosition, migrateStatsPositionFilter
} from "../src/utils/statsPositionFilter.js";

test("Extremos (ambas bandas) incluye las posiciones MF Legacy, FIFA y las abreviaturas FM",()=>{
 for(const code of ["EI","ED","LW","RW","LM","RM","W","AML","AMR","ML","MR"])
  assert.equal(matchesStatsPosition(code,"grupo:wing"),true,code);
 for(const code of ["GK","DFC","RB","CM","CAM","DC","ST"])
  assert.equal(matchesStatsPosition(code,"grupo:wing"),false,code);
});
test("El filtro derecho e izquierdo agrupa los sinónimos sin mezclar las bandas",()=>{
 for(const p of ["ED","RW","RM","AMR","MR"]) {
  assert.ok(matchesStatsPosition(p,"grupo:wing:right"),p);
  assert.ok(!matchesStatsPosition(p,"grupo:wing:left"),p);
 }
 for(const p of ["EI","LW","LM","AML","ML"]) {
  assert.ok(matchesStatsPosition(p,"grupo:wing:left"),p);
  assert.ok(!matchesStatsPosition(p,"grupo:wing:right"),p);
 }
});
test("Defensores antiguos y nuevos se agrupan sin mezclar centrales con laterales",()=>{
 for(const p of ["DFC","CB","D (C)"])assert.ok(matchesStatsPosition(p,"grupo:cb"),p);
 for(const p of ["LD","LI","RB","LB","D (R)","D (L)","FB"])assert.ok(matchesStatsPosition(p,"grupo:fb"),p);
 for(const p of ["CRD","CRI","RWB","LWB","WB (R)","WB (L)","WB"])assert.ok(matchesStatsPosition(p,"grupo:wb"),p);
 for(const p of ["CRD","CRI","RWB","LWB","WB (R)","WB (L)","WB"])
  assert.ok(matchesStatsPosition(p,"grupo:fb"),"Incluido en laterales: "+p);
 for(const p of ["DFC","CB","LD","LI","RB","LB","CRD","CRI","RWB","LWB"])assert.ok(matchesStatsPosition(p,"grupo:def"),p);
 for(const p of ["CRI","LWB","WB (L)","LI","LB"]) {
  assert.ok(matchesStatsPosition(p,"grupo:fb:left"),p);
  assert.ok(!matchesStatsPosition(p,"grupo:fb:right"),p);
 }
 for(const p of ["CRD","RWB","WB (R)","LD","RB"]) {
  assert.ok(matchesStatsPosition(p,"grupo:fb:right"),p);
  assert.ok(!matchesStatsPosition(p,"grupo:fb:left"),p);
 }
 assert.equal(matchesStatsPosition("CB","grupo:fb"),false);
});
test("Medios, mediapuntas y delanteros mantienen grupos propios",()=>{
 for(const p of ["CDM","DM","MCD"])assert.equal(matchesStatsPosition(p,"grupo:dm"),true,p);
 for(const p of ["CM","MC"])assert.equal(matchesStatsPosition(p,"grupo:cm"),true,p);
 for(const p of ["CAM","AM","AMC"])assert.equal(matchesStatsPosition(p,"grupo:cam"),true,p);
 for(const p of ["DC","ST","CF","STC"])assert.equal(matchesStatsPosition(p,"grupo:st"),true,p);
});
test("Filtros de Grupo clásico siguen aceptando posiciones de ambas nomenclaturas",()=>{
 for(const p of ["GK","DFC","CB","LD","RB","LI","LB"])assert.equal(matchesStatsPosition(p,p==="GK"?"grupo:gk":"grupo:def"),true,p);
 for(const p of ["CM","CDM","DM","LM","RM"])assert.equal(matchesStatsPosition(p,"grupo:mid"),true,p);
 for(const p of ["CAM","LW","RW","EI","ED","DC","ST","CF"])assert.equal(matchesStatsPosition(p,"grupo:att"),true,p);
});
test("Los filtros antiguos persistidos migran a grupos equivalentes, no desaparecen del select",()=>{
 const mapping={RW:"grupo:wing:right",ED:"grupo:wing:right",LW:"grupo:wing:left",EI:"grupo:wing:left",
  RB:"grupo:fb:right",LD:"grupo:fb:right",CB:"grupo:cb",DFC:"grupo:cb",
  CDM:"grupo:dm",DM:"grupo:dm",CM:"grupo:cm",CAM:"grupo:cam",ST:"grupo:st",CF:"grupo:st"};
 for(const [previous,current] of Object.entries(mapping))
  assert.equal(migrateStatsPositionFilter(previous),current,previous);
 assert.equal(migrateStatsPositionFilter("grupo:att"),"grupo:att");
 assert.equal(migrateStatsPositionFilter("grupo:wing"),"grupo:wing");
 assert.equal(migrateStatsPositionFilter("Todas"),"Todas");
 assert.equal(migrateStatsPositionFilter("cadena-incorrecta"),"Todas");
 const values=STATS_POSITION_FILTER_OPTIONS.map(o=>o.value);
 assert.equal(new Set(values).size,values.length);
 assert.ok(values.includes("grupo:wing"));
 assert.equal(STATS_POSITION_FILTER_OPTIONS.find(o=>o.value==="grupo:fb")?.label,"Laterales y carrileros");
 assert.ok(matchesStatsPosition("CRI","grupo:wb:left"));
 assert.ok(matchesStatsPosition("CRI","grupo:fb:left"));
 assert.equal(STATS_POSITION_FILTER_OPTIONS.find(o=>o.value==="grupo:wing")?.group,"Grupos principales");
 for(const value of Object.values(mapping))assert.ok(values.includes(value),value);
});
test("Los filtros se aplican a temporadas y competiciones y el selector muestra grupos",()=>{
 const stats=readFileSync(new URL("../src/pages/Stats.jsx",import.meta.url),"utf8");
 const controls=readFileSync(new URL("../src/components/stats/StatsControlBar.jsx",import.meta.url),"utf8");
 assert.match(stats,/const matchesPosition=value=>matchesStatsPosition\(value,positionFilter\)/);
 assert.match(stats,/useState\(\(\)=>migrateStatsPositionFilter\(savedView.positionFilter\)\)/);
 assert.match(stats,/matchesPosition\(record\?\.position\|\|player\?\.position/);
 assert.match(stats,/matchesPosition\(compositeIndex\.get/);
 assert.match(controls,/<optgroup key=\{group\} label=\{group\}>/);
});
