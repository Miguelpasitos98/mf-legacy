import test from "node:test";
import assert from "node:assert/strict";
import {readArchive} from "../base44/functions/understat-auto/core.mjs";
import {safeAutomaticPlan,automaticHistoricalImport} from "../base44/functions/understat-auto/autoSafe.mjs";
import {eligibleUnderstatBatchJobs,initialBulkRun,afterBulkResult} from "../src/utils/importUnderstatBatch.js";

const csv=[
 "id,player_name,season,team_title,league,time,xGChain,xGBuildup,goals,assists,xG,xA,npxG,shots,key_passes,npg,yellow_cards,red_cards,games",
 "44,Example Player,2016/17,Arsenal,EPL,2400,21,12,15,7,18,6,14,105,50,13,2,0,30",
 "44,Example Player,2017/18,Arsenal,EPL,2600,24,15,18,9,19,8,15,100,45,16,3,0,35",
 "44,Example Player,2018/19,Arsenal,EPL,2300,19,13,14,5,17,7,13,95,37,12,1,0,29"
].join("\n");
const job={id:"aaaaaaaaaaaaaaaaaaaaaaaa",player_id:"bbbbbbbbbbbbbbbbbbbbbbbb",
 player_name:"Example Player",fotmob_player_id:"777",sources:["understat","fotmob"],
 status:"completed",phase:"Trabajo finalizado",source_results:{}};
const stats=[
 {id:"r1",player_id:job.player_id,fotmob_player_id:"777",season:"2016/2017",competition:"Premier League",team_name:"Arsenal",minutes:2400,
  metrics:[{name:"Goals",value:0,source:"manual"}]},
 {id:"r2",player_id:job.player_id,fotmob_player_id:"777",season:"2017/2018",competition:"Premier League",team_name:"Arsenal",minutes:2600,
  metrics:[{name:"xG",value:19,source:"fotmob"}]}
];
const mock=()=>{
 const state={stats:structuredClone(stats),job:structuredClone(job)};
 const entities={
  ImportJob:{
   filter:async()=>[state.job],get:async()=>structuredClone(state.job),
   update:async(id,patch)=>{Object.assign(state.job,patch);return structuredClone(state.job)}
  },
  Player:{get:async()=>({id:job.player_id,name:"Example Player"})},
  PlayerFotmobLink:{filter:async()=>[{player_id:job.player_id,fotmob_player_id:"777",verification:"confirmed"}]},
  PlayerSeasonStats:{
   filter:async(q)=>{
    if(q.external_record_id)return state.stats.filter(r=>r.external_record_id===q.external_record_id);
    return structuredClone(state.stats);
   },
   get:async(id)=>structuredClone(state.stats.find(r=>r.id===id)),
   update:async(id,patch)=>{
    const row=state.stats.find(r=>r.id===id);Object.assign(row,patch);return structuredClone(row)
   },
   create:async(payload)=>{
    const created={id:"added-"+state.stats.length,...payload};state.stats.push(created);return structuredClone(created)
   }
  }
 };
 return {entities,state};
};
test("verified exact FotMob history can safely propose additional Understat league seasons",()=>{
 const plan=safeAutomaticPlan(readArchive(csv,"Example Player"),stats);
 assert.equal(plan.automatic_allowed,true);
 assert.equal(plan.proposals.find(p=>p.action==="create").season,"2018/2019");
});
test("bare name match is never an acceptable automatic identity",()=>{
 const plan=safeAutomaticPlan(readArchive(csv,"Example Player"),[]);
 assert.equal(plan.automatic_allowed,false);
 assert.equal(plan.proposals.length,0);
});
test("one bulk player pass adds missing metrics and season while preserving prior real values, even zero",async()=>{
 const {entities,state}=mock();
 const result=await automaticHistoricalImport(entities,job,csv);
 assert.equal(result.status,"finished");
 assert.equal(result.created,1);
 assert.ok(result.completed>=1);
 assert.equal(result.remaining,0);
 assert.equal(state.stats.length,3);
 assert.equal(state.stats[0].metrics.find(m=>m.name==="Goals").value,0);
 assert.equal(state.stats[1].metrics.find(m=>m.name==="xG").value,19);
 assert.equal(state.stats[2].source,"understat");
 assert.equal(state.job.source_results.understat_gap_audit.status,"no_detected_gaps");
});
test("queued worker blocks automatic writes until finished",async()=>{
 const {entities,state}=mock();
 state.job.status="running";
 const result=await automaticHistoricalImport(entities,{...job,status:"running"},csv);
 assert.equal(result.status,"waiting");
 assert.equal(state.stats.length,2);
});
test("queue selection is unique by player and skips already-audited clean players",()=>{
 const groups=[
  {playerId:"p",playerName:"Test A",sources:["understat","fotmob"],active:false,
   latest:{id:"1",status:"completed",phase:"done"}},
  {playerId:"p",playerName:"Test A",sources:["understat"],active:false,
   latest:{id:"2",status:"completed",phase:"done"}},
  {playerId:"q",playerName:"Test B",sources:["understat"],active:false,
   latest:{id:"3",status:"completed",phase:"done",
    source_results:{understat_gap_audit:{status:"no_detected_gaps",proposals:0,job_phase:"done"}}}},
  {playerId:"r",playerName:"Test C",sources:["understat"],active:true,
   latest:{id:"4",status:"running",phase:"running"}}
 ];
 assert.deepEqual(eligibleUnderstatBatchJobs(groups).map(p=>p.job_id),["1"]);
});
test("progress totals count each safe result and separately flag unresolved identities",()=>{
 const start=initialBulkRun([{job_id:"1",player_name:"A"}]);
 const result=afterBulkResult(start,{created:1,completed:2,metrics_added:14,status:"partial"},{player_name:"A"});
 assert.equal(result.seasons_created,1);
 assert.equal(result.seasons_completed,2);
 assert.equal(result.metrics_added,14);
 const after=afterBulkResult(result,{status:"manual_review"},{player_name:"B"});
 assert.equal(after.manual_review,1);
});
