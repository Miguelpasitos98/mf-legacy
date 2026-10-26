import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {webcrypto} from "node:crypto";
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const src=readFileSync(new URL("../base44/functions/import-cache/entry.js",import.meta.url),"utf8")
 .replace('import { createClientFromRequest } from "npm:@base44/sdk";',"const createClientFromRequest=()=>globalThis.__cacheApi;");
const {default:handler}=await import("data:text/javascript;base64,"+Buffer.from(src).toString("base64"));
const playerId="aaaaaaaaaaaaaaaaaaaaaaaa",fotmobId="276738",player={id:playerId,name:"Antonio Rüdiger"};
let user,links,stats,sources,jobs,candidates,sequence=0;
const rows=(data,q,limit)=>data.filter(r=>Object.entries(q).every(([key,value])=>
 value&&typeof value==="object"&&value.$in?value.$in.includes(r[key]):r[key]===value)).slice(0,limit||300);
const db={
 Player:{get:async id=>id===playerId?player:null},
 PlayerFotmobLink:{filter:async(q,sort,limit)=>rows(links,q,limit)},
 PlayerSeasonStats:{filter:async(q,sort,limit)=>rows(stats,q,limit)},
 PlayerProviderRecord:{filter:async(q,sort,limit)=>rows(sources,q,limit)},
 ImportJob:{
  create:async data=>{const item={...data,id:(++sequence).toString(16).padStart(24,"0")};jobs.push(item);return item;},
  update:async(id,patch)=>{const item=jobs.find(j=>j.id===id);Object.assign(item,patch);return item;}
 },
 ImportCandidate:{
  filter:async(q,sort,limit)=>rows(candidates,q,limit),
  bulkCreate:async list=>{for(const r of list)candidates.push({...r,id:(++sequence).toString(16).padStart(24,"0")});}
 }
};
globalThis.__cacheApi={auth:{me:async()=>user},asServiceRole:{entities:db}};
function reset(){
 user={role:"admin"};sequence=0;jobs=[];candidates=[];
 links=[{player_id:playerId,fotmob_player_id:fotmobId,verification:"automatic_exact_name_unique"}];
 stats=[{id:"bbbbbbbbbbbbbbbbbbbbbbbb",player_id:playerId,fotmob_player_id:fotmobId,
   season:"2021/2022",competition:"Premier League",team_name:"Chelsea",fotmob_team_id:"8455",
   metrics:[{name:"Goals",value:3}]}];
 sources=[
  {fotmob_player_id:fotmobId,record_kind:"fotmob_season",record_key:"s1",
   season:"2021/2022",competition:"Premier League",team_name:"Chelsea",fotmob_team_id:"8455",
   metrics:[{name:"Clearances",value:96},{name:"Goals",value:3}]},
  {fotmob_player_id:fotmobId,record_kind:"understat_summary",record_key:"s2",
   season:"2021/2022",competition:"EPL",team_name:"Chelsea",
   metrics:[{name:"xG",value:1.1,per90:0.05}]},
 ];
}
async function invoke(body={player_id:playerId,sources:["fotmob","understat","fifa","market"]}){
 const res=await handler(new Request("https://test.app/import-cache",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)}));
 return {status:res.status,result:await res.json()};
}
test("cache historical staging only for exact player and team, no STATS mutations",async()=>{
 reset();const previous=JSON.stringify(stats);
 const {status,result}=await invoke();
 assert.equal(status,200);assert.equal(result.created,3);
 assert.equal(result.source_results.fotmob.status,"complete");
 assert.equal(result.source_results.understat.status,"complete");
 assert.equal(result.source_results.fifa.status,"unavailable");
 assert.equal(jobs.at(-1).status,"review");
 assert.equal(JSON.stringify(stats),previous);
 assert.equal(candidates.find(c=>c.metric_name==="Clearances").value,96);
 assert.ok(!candidates.some(c=>c.metric_name==="Goals"));
});
test("repeated scanning does not duplicate source candidate records",async()=>{
 reset();await invoke();const twice=await invoke();
 assert.equal(twice.result.created,0);assert.equal(twice.result.already_staged,3);
 assert.equal(candidates.length,3);
});
test("club mismatch is skipped not merged",async()=>{
 reset();sources[0].team_name="Other Chelsea";
 sources[0].fotmob_team_id="";
 const {result}=await invoke({player_id:playerId,sources:["fotmob"]});
 assert.equal(result.created,0);
 assert.equal(result.unmatched,1);
});
test("admin permissions and unique FotMob identity required",async()=>{
 reset();user.role="user";assert.equal((await invoke()).status,403);
 user.role="admin";links.push({player_id:playerId,fotmob_player_id:"999999",verification:"manual"});
 assert.equal((await invoke()).status,409);
 assert.equal(jobs.length,0);
});
