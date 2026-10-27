import test from "node:test";
import assert from "node:assert/strict";
import {filterSeasonSummariesForDisplay,withoutCurrentStatsSeason} from "../src/utils/statsSeason.js";

const now=new Date("2026-10-27T19:00:00Z");
const sample=["2022/2023","2025/2026","2026/2027"].map(season=>({season}));
test("Todas las temporadas oculta la temporada en curso 2026/27",()=>{
 assert.deepEqual(filterSeasonSummariesForDisplay(sample,"all",now).map(r=>r.season),["2022/2023","2025/2026"]);
});
test("Los ajustes antiguos no reactivan la temporada actual y mejor temporada sigue funcionando",()=>{
 assert.deepEqual(filterSeasonSummariesForDisplay(sample,"current",now),[]);
 assert.deepEqual(filterSeasonSummariesForDisplay(sample,"best",now).map(r=>r.season),["2022/2023","2025/2026"]);
});
test("Se ocultan filas de competición y detalle sin borrar los originales",()=>{
 const input=[{season:"2025/2026",competition:"LaLiga"},{season:"2026/2027",competition:"Premier League"}];
 assert.deepEqual(withoutCurrentStatsSeason(input,now),[input[0]]);
 assert.equal(input.length,2);
});
test("Una vez terminada la temporada, sus datos vuelven a ser visibles",()=>{
 assert.deepEqual(withoutCurrentStatsSeason(sample,new Date("2027-10-27T19:00:00Z")).map(r=>r.season),["2022/2023","2025/2026","2026/2027"]);
});
