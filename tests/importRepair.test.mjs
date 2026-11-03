import test from "node:test";
import assert from "node:assert/strict";
import {repairRequest} from "../base44/shared/importRepair.js";
const match=(r,q)=>Object.entries(q).every(([k,v])=>k==="$or"?v.some(x=>match(r,x)):v&&typeof v==="object"?("$in" in v?v.$in.includes(r[k]):"$exists" in v?(r[k]!==undefined)===v.$exists:"$lt" in v?r[k]<v.$lt:false):r[k]===v);
function fixture(){
  let n=1,version=1;const data={Player:[{id:"p",name:"Player"}],PlayerFotmobLink:[{id:"l",player_id:"p",fotmob_player_id:"169200",verification:"manual"}],
    PlayerSeasonStats:[],PlayerHistoricalValuation:[],Team:[],ImportRepairRun:[],ImportRepairItem:[],
    ImportJob:[{id:"a".repeat(24),player_id:"p",fotmob_player_id:"169200",status:"review",source_results:{fotmob:{status:"complete"}}}],ImportCandidate:[]};
  data.ImportCandidate.push({id:"c",job_id:data.ImportJob[0].id,player_id:"p",fotmob_player_id:"169200",kind:"metric",source:"fotmob",season:"2017/2018",competition:"Premier League",fotmob_team_id:"8456",team_name:"Manchester City",fotmob_tournament_id:"47",is_national_team:false,metric_name:"Goals",metric_unit:"total",value:8,review_status:"pending",verification_status:"unverified",evidence_url:"https://www.fotmob.com/players/169200",source_record_id:"2017/2018:47:8456:goals:total"});
  const db=Object.fromEntries(Object.entries(data).map(([name,arr])=>[name,{
    filter:async(q,_sort,limit=100,skip=0)=>structuredClone(arr.filter(r=>match(r,q)).slice(skip,skip+limit)),get:async id=>structuredClone(arr.find(r=>r.id===id)),
    create:async record=>{const row={...structuredClone(record),id:(n++).toString(16).padStart(24,"0"),updated_date:String(++version)};arr.push(row);return structuredClone(row);},
    update:async(id,patch)=>{const row=arr.find(r=>r.id===id);Object.assign(row,structuredClone(patch),{updated_date:String(++version)});return structuredClone(row);},
    updateMany:async(q,patch)=>{for(const row of arr.filter(r=>match(r,q)))Object.assign(row,structuredClone(patch.$set),{updated_date:String(++version)});}
  }]));
  return {db,data};
}
test("global simulation, pause/resume, application and repeat preserve exactly one new sporting row",async()=>{
  const {db,data}=fixture();
  let {run}=await repairRequest(db,{action:"repair-create"},"admin");
  assert.equal(run.total,1);
  await repairRequest(db,{action:"repair-pause",run_id:run.id},"admin");
  assert.equal((await repairRequest(db,{action:"repair-step",run_id:run.id},"admin")).run.cursor,0);
  await repairRequest(db,{action:"repair-resume",run_id:run.id},"admin");
  const simulation=await repairRequest(db,{action:"repair-step",run_id:run.id},"admin");
  assert.equal(simulation.run.status,"completed");assert.equal(data.PlayerSeasonStats.length,0);
  assert.equal(simulation.report.added_values,1);assert.equal(data.ImportCandidate[0].review_status,"pending");
  const apply=await repairRequest(db,{action:"repair-apply",run_id:run.id},"admin");
  await repairRequest(db,{action:"repair-step",run_id:apply.run.id},"admin");
  assert.equal(data.PlayerSeasonStats.length,1);assert.equal(data.ImportCandidate[0].review_status,"applied");
  await repairRequest(db,{action:"repair-step",run_id:apply.run.id},"admin");
  assert.equal(data.PlayerSeasonStats.length,1);
  const second=await repairRequest(db,{action:"repair-create"},"admin");
  const again=await repairRequest(db,{action:"repair-step",run_id:second.run.id},"admin");
  assert.equal(again.report.applied,0);assert.equal(again.report.added_values,0);
});
test("application cannot start before a completed simulation",async()=>{
  const {db}=fixture();const {run}=await repairRequest(db,{action:"repair-create"},"admin");
  await assert.rejects(()=>repairRequest(db,{action:"repair-apply",run_id:run.id},"admin"),/simulación/);
});
test("a crash after persisting the batch report preserves its original counts on resume",async()=>{
  const {db,data}=fixture();const {run}=await repairRequest(db,{action:"repair-create"},"admin");
  await repairRequest(db,{action:"repair-step",run_id:run.id},"admin");
  const apply=await repairRequest(db,{action:"repair-apply",run_id:run.id},"admin");
  const completed=await repairRequest(db,{action:"repair-step",run_id:apply.run.id},"admin");
  const stats=JSON.stringify(data.PlayerSeasonStats);
  await db.ImportRepairRun.update(apply.run.id,{cursor:0,status:"ready",counts:{jobs:0,compatible:0,added:0,unchanged:0,conflicts:0,errors:0}});
  const resumed=await repairRequest(db,{action:"repair-step",run_id:apply.run.id},"admin");
  assert.deepEqual(resumed.run.counts,completed.run.counts);
  assert.equal(resumed.run.counts.added,1);
  assert.equal(JSON.stringify(data.PlayerSeasonStats),stats);
});
test("STATS players without any import job are included in the global report",async()=>{
  const {db,data}=fixture();data.PlayerSeasonStats.push({id:"old",player_id:"no-job"});
  const {run,players_without_jobs}=await repairRequest(db,{action:"repair-create"},"admin");
  assert.equal(run.total,2);assert.deepEqual(players_without_jobs,["no-job"]);
});
