import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {webcrypto} from "node:crypto";
globalThis.crypto??=webcrypto;
globalThis.Deno={env:{get:()=>("test_key_012345678901234567890123456789")}};
let source=readFileSync(new URL("../base44/functions/import-worker/entry.js",import.meta.url),"utf8");
source=source.replace('import { createClientFromRequest } from "npm:@base44/sdk";',
  "const createClientFromRequest=()=>globalThis.__workerContinuationClient;");
source=source.replace('const {applyVerifiedHistoricals}=await import("./reviewAuto.js");',
  "const applyVerifiedHistoricals=async()=>({applied:0});");
const {default:worker}=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));
const jobId="aaaaaaaaaaaaaaaaaaaaaaaa",pid="bbbbbbbbbbbbbbbbbbbbbbbb",claim="claimed-token";
function setup({attempt=0,networkRequests=8,sources=["fotmob"]}={}) {
 const existing={id:jobId,claim_id:claim,status:"running",sources,player_id:pid,
 fotmob_player_id:"921253",player_name:"Ronald Araujo",retry_count:attempt,retry_pending:true,
 received_candidates:1,progress:2,lease_expires_at:"2099-01-01T00:00:00Z"};
 const jobs=[existing];
 const db={
  ImportJob:{
   get:async()=>existing,
   update:async(_id,patch)=>Object.assign(existing,patch),
   filter:async query=>jobs.filter(j=>j.job_key===query.job_key),
   create:async data=>{const row={id:String(jobs.length+1).padStart(24,"0"),...data};jobs.push(row);return row;}
  },
  ImportCandidate:{filter:async query=>query.review_status==="pending"?[{id:"candidate"}]:[{id:"candidate"}]},
 };
 globalThis.__workerContinuationClient={asServiceRole:{entities:db}};
 return {existing,jobs};
}
async function finish(networkRequests=8){
 const req=new Request("https://example.org/worker",{method:"POST",
 headers:{"X-MF-Worker-Token":"test_key_012345678901234567890123456789",
   "Content-Type":"application/json"},
 body:JSON.stringify({action:"finish",job_id:jobId,claim_id:claim,source_results:{
  fotmob:{status:"partial",network_requests:networkRequests,successful_requests:networkRequests,diagnostics:[
   {season:"2019/2020",competition:"LaLiga",status:"cache_absent"}]}}})});
 const response=await worker(req);return await response.json();
}
test("FotMob retry queues only a bounded next batch",async()=>{
 const f=setup();const result=await finish();
 assert.equal(f.jobs.length,2);
 assert.equal(result.next_job_id,f.jobs[1].id);
 assert.deepEqual(f.jobs[1].sources,["fotmob"]);
 assert.equal(f.jobs[1].retry_count,1);
 assert.equal(f.jobs[1].retry_pending,true);
});
test("Without network requests, no repeated auto-fetch",async()=>{
 const f=setup({networkRequests:0});await finish(0);
 assert.equal(f.jobs.length,1);
});
test("After the twelfth bounded block, no further work is queued",async()=>{
 const f=setup({attempt:11});await finish();
 assert.equal(f.jobs.length,1);
});
test("Mixed-source first import continues with only FotMob when historic caches are missing",async()=>{
 const f=setup({sources:["fotmob","fifa","market"]});await finish();
 assert.equal(f.jobs.length,2);
 assert.deepEqual(f.jobs[1].sources,["fotmob"]);
 assert.equal(f.jobs[1].retry_pending,true);
 assert.equal(f.jobs[1].retry_count,1);
});
