import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {canAutoCloseTacticalRoleImport} from "../src/utils/tacticalRoleImport.mjs";
const verified=(n,status="unchanged")=>Array.from({length:n},()=>({status}));
test("closes after all JSON roles are saved and verified",()=>{
 assert.equal(canAutoCloseTacticalRoleImport({done:36,failed:0,pending:36,verifiedRows:verified(36)}),true);
 assert.equal(canAutoCloseTacticalRoleImport({done:1,failed:0,pending:1,verifiedRows:verified(1)}),true);
});
test("never auto-closes failed, partial, unverified, or no-op imports",()=>{
 assert.equal(canAutoCloseTacticalRoleImport({done:35,failed:1,pending:36,verifiedRows:verified(36)}),false);
 assert.equal(canAutoCloseTacticalRoleImport({done:35,failed:0,pending:36,verifiedRows:verified(36)}),false);
 assert.equal(canAutoCloseTacticalRoleImport({done:36,failed:0,pending:36,verifiedRows:null}),false);
 assert.equal(canAutoCloseTacticalRoleImport({done:0,failed:0,pending:0,verifiedRows:verified(36)}),false);
 assert.equal(canAutoCloseTacticalRoleImport({done:36,failed:0,pending:36,verifiedRows:[]}),false);
});
test("leave modal open for any unresolved, protected, invalid or pending rows",()=>{
 for(const status of ["unmatched","ambiguous","protected","invalid","ready"]){
  assert.equal(canAutoCloseTacticalRoleImport({
   done:35,failed:0,pending:35,verifiedRows:[...verified(35),{status}]
  }),false,status);
 }
});
test("modal verifies writes before auto-close; parent retains non-modal success feedback",()=>{
 const modal=fs.readFileSync("src/components/players/TacticalRoleImportModal.jsx","utf8");
 const page=fs.readFileSync("src/pages/Players.jsx","utf8");
 const verifiedAt=modal.indexOf("verifiedRows = buildTacticalRoleImportPlan");
 const closeCheckAt=modal.indexOf("canAutoCloseTacticalRoleImport({");
 assert.ok(verifiedAt>0 && closeCheckAt>verifiedAt);
 assert.match(modal,/await cache\.invalidateQueries/);
 assert.match(modal,/onCompleted\?\.\(done\);\s*onClose\(\)/);
 assert.match(page,/onCompleted=\{count=>setTacticalRoleImportNotice/);
 assert.match(page,/tacticalRoleImportNotice&&<div role="status"/);
});
