import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {webcrypto} from "node:crypto";

if(!globalThis.crypto)globalThis.crypto=webcrypto;
const SECRET="test_token_0123456789abcdef0123456789abcdef";
let configured=SECRET;
globalThis.Deno={env:{get:(key)=>key==="MF_V3_WORKER_TOKEN"?configured:""}};
const source=readFileSync(new URL("../base44/functions/import-worker/entry.js",import.meta.url),"utf8")
  .replace('import { createClientFromRequest } from "npm:@base44/sdk";',
           "const createClientFromRequest=()=>globalThis.__mfTestClient;");
const {default:worker}=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));
const JOB_ID="aaaaaaaaaaaaaaaaaaaaaaaa";
const PLAYER_ID="bbbbbbbbbbbbbbbbbbbbbbbb";
const jobs=new Map();
const candidates=new Map();
let nextId=1;
const filter=(items,q)=>{
  return items.filter(row=>Object.entries(q).every(([k,v])=>
    v&&typeof v==="object"&&v.$in?v.$in.includes(row[k]):row[k]===v
  ));
};
const db={
  ImportJob:{
    async filter(q,sort,limit=50){return filter([...jobs.values()],q).slice(0,limit);},
    async get(id){return jobs.get(id);},
    async update(id,patch){const row={...jobs.get(id),...patch};jobs.set(id,row);return row;}
  },
  ImportCandidate:{
    async filter(q,sort,limit=50,skip=0){return filter([...candidates.values()],q).slice(skip,skip+limit);},
    async bulkCreate(batch){
      for(const item of batch){
        const id=nextId.toString(16).padStart(24,"0");nextId++;
        candidates.set(id,{...item,id});
      }
    },
    async update(id,patch){candidates.set(id,{...candidates.get(id),...patch});return candidates.get(id);}
  }
};
globalThis.__mfTestClient={asServiceRole:{entities:db}};
function reset(){
  jobs.clear();candidates.clear();nextId=1;configured=SECRET;
  jobs.set(JOB_ID,{id:JOB_ID,player_id:PLAYER_ID,fotmob_player_id:"276738",player_name:"Antonio Rüdiger",
    status:"queued",requested_at:"2026-10-26T10:00:00.000Z",progress:0,sources:["fotmob"],
    source_results:{},received_candidates:0});
}
async function post(payload,token=SECRET){
  const req=new Request("https://example.test/import-worker",{method:"POST",
    headers:{"X-MF-Worker-Token":token,"Content-Type":"application/json"},
    body:JSON.stringify(payload)});
  const resp=await worker(req);
  return {status:resp.status,body:await resp.json()};
}
async function claim(){
  const result=await post({action:"claim",worker_id:"test-runner"});
  assert.equal(result.status,200);
  return result.body.job;
}
const observation={source:"fotmob",kind:"metric",season:"2021/2022",
  competition:"Premier League",fotmob_team_id:"8455",team_name:"Chelsea",
  metric_name:"Clearances",metric_unit:"total",value:0,
  source_record_id:"5-0:clearances:total",evidence_url:"https://www.fotmob.com/players/276738",
  verification_status:"unverified"};

test("sin secreto configurado: se bloquea el worker",async()=>{
  reset();configured="";
  const response=await post({action:"claim"});
  assert.equal(response.status,503);
  assert.equal(jobs.get(JOB_ID).status,"queued");
});
test("token erróneo: denegado sin mutaciones",async()=>{
  reset();
  const response=await post({action:"claim"},"incorrect-token");
  assert.equal(response.status,401);
  assert.equal(jobs.get(JOB_ID).status,"queued");
});
test("claim seguro + subida idempotente + cero real + fin en revisión",async()=>{
  reset();
  const picked=await claim();
  assert.equal(picked.player_id,PLAYER_ID);
  assert.equal(jobs.get(JOB_ID).status,"running");
  const payload={action:"submit",job_id:JOB_ID,claim_id:picked.claim_id,candidates:[observation]};
  const first=await post(payload);
  assert.equal(first.body.created,1);
  const second=await post(payload);
  assert.equal(second.body.unchanged,1);
  assert.equal(candidates.size,1);
  assert.equal([...candidates.values()][0].value,0);
  const done=await post({action:"finish",job_id:JOB_ID,claim_id:picked.claim_id,
    source_results:{fotmob:{status:"complete",note:"Caché encontrada"}}});
  assert.equal(done.body.status,"review");
  assert.equal(jobs.get(JOB_ID).received_candidates,1);
});
test("no permite un proveedor no solicitado",async()=>{
  reset();
  const picked=await claim();
  const response=await post({action:"submit",job_id:JOB_ID,claim_id:picked.claim_id,
    candidates:[{...observation,source:"understat"}]});
  assert.notEqual(response.status,200);
  assert.equal(candidates.size,0);
});
test("no acepta envíos de un trabajo cancelado",async()=>{
  reset();
  const picked=await claim();
  jobs.get(JOB_ID).status="cancelled";
  const response=await post({action:"submit",job_id:JOB_ID,claim_id:picked.claim_id,candidates:[observation]});
  assert.equal(response.status,409);
  assert.equal(candidates.size,0);
});
test("retains official competition, national scope and derivation in pending candidates",async()=>{
  reset();const picked=await claim();
  await post({action:"submit",job_id:JOB_ID,claim_id:picked.claim_id,candidates:[{
    ...observation,fotmob_tournament_id:"50",is_national_team:true,
    metric_unit:"percentage",value:50,derivation:"Four verified inputs"
  }]});
  const saved=[...candidates.values()][0];
  assert.equal(saved.fotmob_tournament_id,"50");assert.equal(saved.is_national_team,true);
  assert.equal(saved.derivation,"Four verified inputs");assert.equal(saved.review_status,"pending");
});
test("finish paginates more than 500 candidates and persists detailed diagnostics",async()=>{
  reset();const picked=await claim();
  for(let i=0;i<615;i++)candidates.set(String(i),{id:String(i),job_id:JOB_ID});
  const response=await post({action:"finish",job_id:JOB_ID,claim_id:picked.claim_id,source_results:{
    fotmob:{status:"complete",note:"Offline",counts:{cache_absent:39},diagnostics:[{
      season:"2024/2025",competition:"Super Cup",status:"team_unidentified",reason:"Two possible clubs",recovered_metrics:27
    }]}
  }});
  assert.equal(response.body.candidates,615);
  const state=jobs.get(JOB_ID).source_results.fotmob;
  assert.equal(state.counts.cache_absent,39);assert.equal(state.diagnostics[0].recovered_metrics,27);
  assert.equal(state.diagnostics[0].status,"team_unidentified");
});
test("supports signed keeper metrics and claims only the requested job",async()=>{
  reset();
  const selected=await post({action:"claim",job_id:JOB_ID});
  const response=await post({action:"submit",job_id:JOB_ID,claim_id:selected.body.job.claim_id,
    candidates:[{...observation,metric_name:"Goals prevented",value:-.39,percentile:21}]});
  assert.equal(response.body.created,1);assert.equal([...candidates.values()][0].value,-.39);
  assert.equal([...candidates.values()][0].percentile,21);
});
