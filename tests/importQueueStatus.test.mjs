import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const view=readFileSync(new URL("../src/pages/ImportCenter.jsx",import.meta.url),"utf8");
const worker=readFileSync(new URL("../worker/mf_v3_worker.py",import.meta.url),"utf8");
test("Queued items do not incorrectly warn that the PC worker is offline while another job is running",()=>{
 assert.match(view,/currentWorkerJob=jobs.find\(j=>j.status==="running"/);
 assert.match(view,/En cola · trabajador ocupado/);
 assert.match(view,/El trabajador está procesando/);
 assert.match(view,/No hay ninguna extracción activa registrada/);
 assert.doesNotMatch(view,/trabajos esperan al trabajador local/);
});
test("Worker actually processes claims serially, submitting candidates in batches",()=>{
 assert.match(worker,/while True:\s*try:\s*found=run_once/);
 assert.match(worker,/for i in range\(0,total,15\):/);
 assert.match(worker,/call\("submit",job_id=jid,claim_id=claim,candidates=candidates\[i:i\+15\]\)/);
 assert.match(worker,/call\("finish",job_id=jid,claim_id=claim,source_results=states\)/);
});
