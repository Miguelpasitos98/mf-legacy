import test from "node:test";
import assert from "node:assert/strict";
import {saveTeamLinkSafely,transientTeamLinkError} from "../src/utils/teamLinkSave.js";
import {nationalCompetition} from "../src/utils/statsViews.js";

const timeout=new Error("MongoDB: timed out (timeoutMS 20000)");
test("Africa Cup of Nations is national, not assignable to Galatasaray",()=>{
 assert.equal(nationalCompetition("Africa Cup of Nations"),true);
 assert.equal(nationalCompetition("AFCON"),true);
 assert.equal(nationalCompetition("FIFA Club World Cup"),false);
});
test("A committed write followed by timeout is detected and not repeated",async()=>{
 let db={id:"r",team_id:"Napoli"},updates=0;
 const result=await saveTeamLinkSafely({id:"r",teamId:"Galatasaray",
 read:async()=>db,update:async(id,patch)=>{updates++;db={...db,...patch};throw timeout;},
 wait:async()=>{}});
 assert.equal(result.status,"confirmed_after_timeout");
 assert.equal(updates,1);
 assert.equal(db.team_id,"Galatasaray");
});
test("Already saved record triggers no network write",async()=>{
 let updates=0;
 const result=await saveTeamLinkSafely({id:"r",teamId:"Galatasaray",
 read:async()=>({id:"r",team_id:"Galatasaray"}),update:async()=>{updates++;}});
 assert.equal(result.status,"already_saved");assert.equal(updates,0);
});
test("Transient uncommitted timeout retries with backoff",async()=>{
 let updates=0,db={id:"r",team_id:"Napoli"},waits=[];
 const result=await saveTeamLinkSafely({id:"r",teamId:"Galatasaray",
 read:async()=>db,update:async(id,patch)=>{updates++;if(updates===1)throw timeout;db={...db,...patch};},
 wait:async ms=>waits.push(ms)});
 assert.equal(result.status,"updated");
 assert.equal(updates,2);assert.deepEqual(waits,[600]);
});
test("Permanent error is not retried",async()=>{
 let calls=0;
 await assert.rejects(()=>saveTeamLinkSafely({id:"r",teamId:"Galatasaray",
 read:async()=>({id:"r",team_id:"Napoli"}),update:async()=>{calls++;throw Error("Permission denied");}}),/Permission denied/);
 assert.equal(calls,1);
});
test("Timeout is recognized as recoverable",()=>assert.equal(transientTeamLinkError(timeout),true));
