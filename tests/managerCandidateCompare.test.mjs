import test from "node:test";
import assert from "node:assert/strict";
import {MAX_COMPARE,toggleCandidate,compareCandidates,candidateOverview} from "../src/components/managers/managerCandidateCompare.mjs";
test("comparison supports four distinct selections and removal",()=>{
 let ids=[];
 for(let n=1;n<=MAX_COMPARE;n++)ids=toggleCandidate(ids,String(n));
 assert.equal(ids.length,4);
 assert.deepEqual(toggleCandidate(ids,"5"),ids);
 assert.deepEqual(toggleCandidate(ids,"2"),["1","3","4"]);
 assert.equal(toggleCandidate(["1"],"1").length,0);
});
test("comparison selection is id based, not positional index",()=>{
 const rows=[{player:{id:"b"}},{player:{id:"a"}}];
 assert.deepEqual(compareCandidates(rows,["a","b","missing"]).map(r=>r.player.id),["a","b"]);
});
test("budget never certifies affordability if one valuation is unknown",()=>{
 const rows=[{valuation:{eur:9000000}},{valuation:null}];
 const unknown=candidateOverview(rows,15);
 assert.equal(unknown.withinBudget,null);
 assert.equal(unknown.missing,1);
 assert.equal(candidateOverview([{valuation:{eur:9000000}}],15).withinBudget,true);
 assert.equal(candidateOverview([{valuation:{eur:9000000}}],5).withinBudget,false);
 assert.equal(candidateOverview([],null).withinBudget,null);
});
