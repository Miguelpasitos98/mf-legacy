import test from "node:test";
import assert from "node:assert/strict";
import {existsSync,readFileSync} from "node:fs";
import {prepareReview} from "../worker/prepare_stats_review.mjs";

const player={id:"bbbbbbbbbbbbbbbbbbbbbbbb",name:"Milan Škriniar"};
const context={player,links:[{player_id:player.id,fotmob_player_id:"309328",verification:"manual"}],existing_stats:[]};
test("offline manifest rejects a changed player link",()=>{
 assert.throws(()=>prepareReview({fotmob_player_id:"309328",candidates:[]},{...context,links:[]}),/vinculación/);
});
const local=new URL("../worker/review/skriniar-extraction.json",import.meta.url);
test("real Skriniar extraction builds complete Base44-compatible season proposals",{skip:!existsSync(local)},()=>{
 const input=JSON.parse(readFileSync(local,"utf8"));
 const first=prepareReview(input,context);
 assert.equal(first.proposals.length,12);
 assert.equal(first.base44_writes,0);assert.equal(first.approval_required,true);
 const schema=JSON.parse(readFileSync(new URL("../base44/entities/PlayerSeasonStats.jsonc",import.meta.url)));
 const keys=new Set();
 for(const plan of first.proposals) {
   assert.equal(plan.operation,"create");assert.ok(!keys.has(plan.record.external_record_id));keys.add(plan.record.external_record_id);
   for(const key of schema.required)assert.ok(plan.record[key]);
   assert.ok(plan.record.appearances>0);assert.ok(plan.record.minutes>0);
   for(const m of plan.record.metrics)for(const field of ["value","per90","per_match"])
     if(m[field]!=null)assert.ok(Number.isFinite(m[field]));
   if(plan.is_national_team)assert.equal(plan.record.team_id,undefined);
 }
 const second=prepareReview(input,{...context,existing_stats:first.proposals.map((p,i)=>({...p.record,id:String(i)}))});
 assert.ok(second.proposals.every(p=>p.operation==="unchanged"));
});
