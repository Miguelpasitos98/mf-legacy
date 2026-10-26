import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {webcrypto} from "node:crypto";
import {pathToFileURL} from "node:url";
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const base=new URL("../base44/functions/import-native/core.js",import.meta.url).href;
async function load(relative,oldImport,replacement){
 const s=readFileSync(new URL(relative,import.meta.url),"utf8")
  .replace('import {createClientFromRequest} from "npm:@base44/sdk";',"const createClientFromRequest=()=>globalThis.__mfNativeTestApi;")
  .replace(oldImport,replacement);
 return (await import("data:text/javascript;base64,"+Buffer.from(s).toString("base64"))).default;
}
const prepare=await load("../base44/functions/import-native/entry.js",
 'import {validateSeason} from "./core.js";',
 'const {validateSeason}=await import('+JSON.stringify(base)+');');
const review=await load("../base44/functions/review-native/entry.js",
 'import {checkOverwrite} from "../import-native/core.js";',
 '');
const playerId="aaaaaaaaaaaaaaaaaaaaaaaa",pid="795179";
const byType={ImportJob:[],NativeSeasonCandidate:[],PlayerSeasonStats:[]};
let seq=1,auth={role:"admin"},links,providerRecords=[],teams=[];
const query=(table,q,limit)=>{
 if(!q)return table.slice(0,limit);
 return table.filter(row=>Object.entries(q).every(([k,v])=>v&&typeof v==="object"&&v.$in?v.$in.includes(row[k]):row[k]===v)).slice(0,limit??100);
};
const api={
 auth:{me:async()=>auth},
 asServiceRole:{entities:{
  Player:{get:async id=>id===playerId?{id:playerId,name:"Gabriel Magalhães"}:null},
  PlayerFotmobLink:{filter:async(q,sort,limit)=>query(links,q,limit)},
  PlayerProviderRecord:{filter:async(q,sort,limit)=>query(providerRecords,q,limit)},
  Team:{filter:async(q,sort,limit)=>query(teams,q,limit)},
  ...Object.fromEntries(Object.keys(byType).map(name=>[name,{
   filter:async(q,sort,limit)=>query(byType[name],q,limit),
   get:async id=>byType[name].find(x=>x.id===id),
   create:async data=>{
    const row={...data,id:(seq++).toString(16).padStart(24,"0")};byType[name].push(row);return row;
   },
   update:async(id,patch)=>{
    const original=byType[name].find(x=>x.id===id);Object.assign(original,patch);return original;
   }
  }]))
 }}};
globalThis.__mfNativeTestApi=api;
function reset(){
 seq=1;auth={role:"admin"};for(const key of Object.keys(byType))byType[key].length=0;
 links=[{player_id:playerId,fotmob_player_id:pid,verification:"manual"}];
 providerRecords=[];teams=[{id:"cccccccccccccccccccccccc",fotmob_id:"9825",name:"Arsenal"}];
}
const snapshot={schema:"mf_legacy_native_snapshot_v1",records:[{
 provider:"fotmob",fotmob_player_id:pid,season:"2021/2022",
 competition:"Premier League",team_name:"Arsenal",fotmob_team_id:"9825",
 source_record_id:"5-0",statistics:{statsSection:{items:[{localizedTitleId:"clearances",title:"Clearances",statValue:"96"},
 {localizedTitleId:"interceptions",title:"Interceptions",statValue:0}]}}
}]};
async function invoke(handler,body){
 const res=await handler(new Request("https://test.invalid/native",{method:"POST",
  headers:{"content-type":"application/json"},body:JSON.stringify(body)}));
 return {status:res.status,body:await res.json()};
}
const invokePrepare=(extra={})=>invoke(prepare,{action:"prepare",schema:snapshot.schema,
 player_id:playerId,fotmob_player_id:pid,records:snapshot.records,...extra});
test("First season created only after admin review, no duplicates",async()=>{
 reset();
 const p=await invokePrepare();
 assert.equal(p.status,200);assert.equal(p.body.created,1);assert.equal(byType.PlayerSeasonStats.length,0);
 const candidate=byType.NativeSeasonCandidate[0];
 assert.equal(candidate.metrics.find(x=>x.name==="Clearances").value,96);
 const done=await invoke(review,{action:"approve",candidate_id:candidate.id});
 assert.equal(done.status,200);assert.equal(byType.PlayerSeasonStats.length,1);
 assert.equal(byType.PlayerSeasonStats[0].team_id,teams[0].id);
 assert.equal(byType.PlayerSeasonStats[0].metrics.find(x=>x.name==="Interceptions").value,0);
 const repeat=await invoke(review,{action:"approve",candidate_id:candidate.id});
 assert.equal(repeat.body.unchanged,true);
 assert.equal(byType.PlayerSeasonStats.length,1);
});
test("Existing verified competition cannot be overwritten",async()=>{
 reset();byType.PlayerSeasonStats.push({id:"eeeeeeeeeeeeeeeeeeeeeeee",player_id:playerId,
  season:"2021/2022",competition:"Premier League",team_name:"Arsenal",fotmob_team_id:"9825",
  external_record_id:"old:verified",metrics:[{name:"Clearances",value:100}]});
 await invokePrepare();
 const r=await invoke(review,{action:"approve",candidate_id:byType.NativeSeasonCandidate[0].id});
 assert.equal(r.status,409);
 assert.equal(byType.PlayerSeasonStats[0].metrics[0].value,100);
 assert.equal(byType.PlayerSeasonStats.length,1);
});
test("Missing source team id stays review only",async()=>{
 reset();await invokePrepare({records:[{...snapshot.records[0],fotmob_team_id:""}]});
 const r=await invoke(review,{action:"approve",candidate_id:byType.NativeSeasonCandidate[0].id});
 assert.equal(r.status,409);assert.equal(byType.PlayerSeasonStats.length,0);
});
test("Wrong player id or unauthorized caller cannot prepare",async()=>{
 reset();
 const wrong=await invokePrepare({fotmob_player_id:"276738"});
 assert.equal(wrong.status,500);assert.equal(byType.NativeSeasonCandidate.length,0);
 auth.role="user";const denied=await invokePrepare();
 assert.equal(denied.status,403);
});
test("Import on unchanged snapshot is idempotent",async()=>{
 reset();await invokePrepare();const second=await invokePrepare();
 assert.equal(second.body.created,0);assert.equal(second.body.already_present,1);
 assert.equal(byType.NativeSeasonCandidate.length,1);
});
