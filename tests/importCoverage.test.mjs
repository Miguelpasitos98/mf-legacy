import test from "node:test";
import assert from "node:assert/strict";
import {summarizeImportCoverage} from "../src/utils/importCoverage.js";

test("una temporada se cuenta una vez al reanudar con más datos",()=>{
 const root={id:"root",status:"review",requested_at:"2026-10-27T10:00:00Z",source_results:{fotmob:{diagnostics:[
  {season:"2024/2025",tournament_id:"87",competition:"LaLiga",status:"cache_absent"},
  {season:"2024/2025",tournament_id:"42",competition:"Champions",status:"pending_review"}
 ]}}};
 const child={id:"child",root_job_id:"root",status:"review",requested_at:"2026-10-27T10:02:00Z",source_results:{fotmob:{diagnostics:[
  {season:"2024/2025",tournament_id:"87",competition:"LaLiga",status:"pending_review"}]}}};
 const c=summarizeImportCoverage([child,root],root);
 assert.equal(c.total,2);assert.equal(c.received,2);assert.equal(c.missing,0);
 assert.equal(c.complete,true);assert.equal(c.jobCount,2);
});
test("no muestra completa una carrera pendiente, con bloqueo o perfil viejo",()=>{
 const root={id:"x",status:"review",source_results:{fotmob:{coverage:{profile_stale:true},diagnostics:[
  {season:"2025/2026",competition:"LaLiga",tournament_id:"87",status:"no_statistics"},
  {season:"2024/2025",competition:"Cup",tournament_id:"138",status:"rate_limited"},
  {season:"2023/2024",competition:"LaLiga",tournament_id:"87",status:"cache_absent"}
 ]}}};
 const c=summarizeImportCoverage([root],root);
 assert.equal(c.checked,1);assert.equal(c.missing,1);
 assert.equal(c.withheld,1);assert.equal(c.stale,true);assert.equal(c.complete,false);assert.equal(c.limited,true);
});
