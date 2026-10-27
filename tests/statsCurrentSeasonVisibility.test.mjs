import test from "node:test";
import assert from "node:assert/strict";
import {filterSeasonSummariesForDisplay} from "../src/utils/statsSeason.js";

const now=new Date("2026-10-27T19:00:00Z");
const sample=["2022/2023","2025/2026","2026/2027"].map(season=>({season}));
test("Todas las temporadas includes the current season in STATS",()=>{
 assert.deepEqual(filterSeasonSummariesForDisplay(sample,"all",now).map(r=>r.season),sample.map(r=>r.season));
});
test("Temporada actual and mejor temporada still filter correctly",()=>{
 assert.deepEqual(filterSeasonSummariesForDisplay(sample,"current",now).map(r=>r.season),["2026/2027"]);
 assert.deepEqual(filterSeasonSummariesForDisplay(sample,"best",now).map(r=>r.season),["2022/2023","2025/2026"]);
});
