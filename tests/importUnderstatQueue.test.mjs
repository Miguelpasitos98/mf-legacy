import test from "node:test";
import assert from "node:assert/strict";
import {understatAuditOf,understatQueueState,understatQueueCounts} from "../src/utils/importUnderstatQueue.js";
const group=(status="completed",audit=null,phase="finished")=>({
 active:["running","queued"].includes(status),errors:0,reviews:status==="review"?1:0,
 sources:["fotmob","understat"],
 latest:{id:"job1",status,phase,source_results:audit?{understat_gap_audit:audit}:{}}
});
const audit=(status,proposals=0)=>({status,proposals,job_phase:"finished"});
test("in-progress blocks are never labelled historically complete",()=>{
 assert.equal(understatQueueState(group("running",audit("no_detected_gaps"))).kind,"active");
});
test("audits persist as source-specific states and count gap proposals",()=>{
 const list=[group("completed",audit("pending",4)),
  {...group("completed",audit("no_detected_gaps")),latest:{...group("completed",audit("no_detected_gaps")).latest,id:"job2"}},
  {...group("completed",audit("needs_identity_confirmation")),latest:{...group("completed",audit("needs_identity_confirmation")).latest,id:"job3"}}];
 const sums=understatQueueCounts(list);
 assert.equal(sums.pending,1);
 assert.equal(sums.proposals,4);
 assert.equal(sums.no_gaps,1);
 assert.equal(sums.identity,1);
 assert.match(understatQueueState(list[1]).label,/Understat/);
});
test("outdated audit is not mistaken for finished after worker advances phase",()=>{
 const old=group("completed",audit("no_detected_gaps"),"automatic reconciliation");
 assert.equal(understatAuditOf(old),null);
 assert.equal(understatQueueState(old).kind,"unscanned");
});
test("identity-needed is not a finished dataset and missing coverage is distinct",()=>{
 assert.equal(understatQueueState(group("completed",audit("needs_identity_confirmation"))).kind,"identity");
 assert.equal(understatQueueState(group("completed",audit("not_covered"))).kind,"not_covered");
 assert.equal(understatQueueState(group("completed",audit("no_detected_gaps"))).kind,"no_gaps");
});
