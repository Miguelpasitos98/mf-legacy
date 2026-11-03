import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const planner=readFileSync("src/pages/ManagerSquadPlanner.jsx","utf8");
const scouting=readFileSync("src/pages/ManagerFit.jsx","utf8");
const visual=readFileSync("src/components/managers/ManagerLineupVisual.jsx","utf8");
const candidate=readFileSync("src/components/managers/ManagerScoutingVisual.jsx","utf8");

test("Planner field has portraits, distinct provisional FM26 labels, real XI and collapsible slot details",()=>{
 assert.match(planner,/ManagerLineupVisual draft=\{draft\}/);
 assert.match(visual,/PlayerPortrait/);
 assert.match(visual,/draft\?\.assignments/);
 assert.match(visual,/FM26/);
 assert.match(visual,/no son puntuaciones V4 históricas/);
 assert.match(visual,/showDetail&&/);
 assert.match(visual,/Buscar refuerzos/);
 assert.match(visual,/Sin nota FM26/);
 assert.doesNotMatch(visual,/estimatedFit\?\?0/);
});
test("Candidate bag preserves opt-in while clarifying that selection does not transfer footballers",()=>{
 assert.match(planner,/checked=\{includeCandidates\}/);
 assert.match(planner,/setIncludeCandidates/);
 assert.match(planner,/no realiza fichajes/);
 assert.match(planner,/\{manuallyMarked\}/);
});
test("Scouting separates scored / unscored, keeps comparisons and reports and displays available evidence on demand",()=>{
 assert.match(scouting,/ManagerScoutingSummary scoreMode=\{scoreMode\}/);
 assert.match(scouting,/ScoutingCandidateCard/);
 assert.match(scouting,/onCompare=\{\(\)=>setComparedIds/);
 assert.match(scouting,/onReport=\{\(\)=>setScoutingPlayerId/);
 assert.match(candidate,/visibility\.scoredCount/);
 assert.match(candidate,/ADN sin métricas reconocibles/);
 assert.match(candidate,/Evidencia insuficiente para puntuar/);
 assert.match(candidate,/more&&/);
 assert.match(candidate,/score===null\?"—"/);
 assert.match(candidate,/V4\.1 · Requisitos del ADN/);
 assert.match(candidate,/Funciones del ADN evaluadas/);
 assert.match(candidate,/predice/i);
});
