import { test } from "node:test";
import assert from "node:assert/strict";
import { coverageForComparison } from "../src/utils/craftedfcCoverage.js";

const snapshot = {
  payload: {
    current_season:"2026/2027",
    current_comp:"ENG-PremierLeague",
    current_team_id:8456,
    current_matches_played:7,
    current_minutes:620,
  }
};
const row={season:"2026/2027",competition:"Premier League",fotmob_team_id:"8456",appearances:7,minutes:620};
test("CraftedFC: coinciden temporada, competición, club, partidos y minutos",()=>{
  assert.equal(coverageForComparison(snapshot,[row]).comparable,true);
});
test("no se comparan temporadas diferentes",()=>{
  const actual=coverageForComparison(snapshot,[{...row,season:"2025/2026"}]);
  assert.equal(actual.comparable,false);
  assert.match(actual.reason,/Temporadas/);
});
test("no se comparan distintas competiciones ni agregados de dos copas",()=>{
  assert.equal(coverageForComparison(snapshot,[{...row,competition:"FA Cup"}]).comparable,false);
  assert.equal(coverageForComparison(snapshot,[row,row]).comparable,false);
});
test("diferencias en minutos o partidos significan coberturas distintas",()=>{
  assert.equal(coverageForComparison(snapshot,[{...row,minutes:619}]).comparable,false);
  assert.equal(coverageForComparison(snapshot,[{...row,appearances:6}]).comparable,false);
});
test("un ID de club no validado impide comparar",()=>{
  assert.equal(coverageForComparison(snapshot,[{...row,fotmob_team_id:""}]).comparable,false);
});
test("sin snapshot, sin competencia ni temporadas: no se infieren valores",()=>{
  assert.equal(coverageForComparison(null,[row]).comparable,false);
  assert.equal(coverageForComparison(snapshot,[{...row,season:"Todas"}]).comparable,false);
});
