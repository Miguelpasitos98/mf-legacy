import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const page=readFileSync("src/pages/ManagerFit.jsx","utf8");
const card=readFileSync("src/components/managers/ManagerScoutingVisual.jsx","utf8");
const entity=JSON.parse(readFileSync("base44/entities/ManagerPlayerAssignment.jsonc","utf8"));

test("assignment records are protected while public scouting remains readable",()=>{
 assert.deepEqual(entity.rls.read,{});
 for(const action of ["create","update","delete"])
  assert.equal(entity.rls[action].user_condition.role,"admin");
 assert.deepEqual(entity.properties.status.enum,["preselected","linked","released"]);
});
test("manager fit reads and persists manual decisions separately from historical statistics",()=>{
 assert.match(page,/all\(base44\.entities\.ManagerPlayerAssignment\)/);
 assert.match(page,/saveManagerPlayerDecision\(base44\.entities\.ManagerPlayerAssignment/);
 assert.match(page,/filterManagerPlayerAssignments\(eligible,assignmentsIndex,managerId,assignmentFilter\)/);
 assert.match(page,/const historicalPeerMetrics=useMemo/);
 assert.match(page,/Filtrar por adjudicación/);
 assert.match(page,/Mis jugadores vinculados y preseleccionados/);
});
test("a card offers reversible decisions and requires confirmation before reassignment",()=>{
 for(const title of ["Preseleccionar","Vincular a entrenador","Confirmar vínculo","Desvincular","Reasignar a este entrenador"]){
  assert.ok(card.includes(title),title);
 }
 assert.match(page,/window\.confirm\(player\.name\+" ya está adjudicado/);
 assert.match(page,/action==="release"/);
 assert.match(card,/assignmentConflict/);
});
