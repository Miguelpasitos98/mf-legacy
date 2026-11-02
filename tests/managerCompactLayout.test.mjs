import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("Manager Fit and Planner show compact headings instead of oversized dark banners",()=>{
 const pages=[
  fs.readFileSync("src/pages/ManagerFit.jsx","utf8"),
  fs.readFileSync("src/pages/ManagerSquadPlanner.jsx","utf8")
 ];
 for(const source of pages){
  assert.doesNotMatch(source,/<header className="[^"]*bg-\[#091e1b\]/);
  assert.match(source,/<h1 className="text-sm font-black/);
  assert.match(source,/max-w-\[1550px\]/);
 }
});
test("planner allows independent tactical coach and DNA selection, without requiring club writes",()=>{
 const code=fs.readFileSync("src/pages/ManagerSquadPlanner.jsx","utf8");
 assert.match(code,/Entrenador para el planificador/);
 assert.match(code,/ADN táctico para el planificador/);
 assert.match(code,/Demostración opcional/);
 assert.match(code,/selectedCandidatePool/);
 assert.match(code,/onChange=\{e=>setPreviewProfileId\(e.target.value\)\}/);
 assert.doesNotMatch(code,/TeamManagerAssignment\.create/);
});
test("ResizeObserver callbacks defer state changes to animation frames and clean up properly",()=>{
 for(const path of ["src/hooks/use-size.jsx","src/components/players/TransferChartMini.jsx"]){
  const source=fs.readFileSync(path,"utf8");
  assert.match(source,/new ResizeObserver/);
  assert.match(source,/requestAnimationFrame/);
  assert.match(source,/cancelAnimationFrame/);
  assert.match(source,/\.disconnect\(\)/);
 }
});
