import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../base44/functions/import-control/entry.js",import.meta.url),"utf8").replace('import { createClientFromRequest } from "npm:@base44/sdk";','const createClientFromRequest=()=>globalThis.__simpleImportSdk;');
const {default:handler}=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));
const pid="a".repeat(24);
const fixture=({statsIds=["815006","815006"],otherOwner=""}={})=>{
 const links=[],jobs=[],created=[];
 const db={
  Player:{get:async()=>({id:pid,name:"Phil Foden"})},
  PlayerSeasonStats:{filter:async()=>statsIds.map(id=>({fotmob_player_id:id,player_id:pid}))},
  PlayerFotmobLink:{
   filter:async q=>q.player_id?links.filter(l=>l.player_id===q.player_id):[
    ...links.filter(l=>l.fotmob_player_id===q.fotmob_player_id),
    ...(otherOwner===q.fotmob_player_id?[{player_id:"b".repeat(24),fotmob_player_id:otherOwner}]:[])
   ],
   create:async row=>{created.push(row);const saved={...row,id:"c".repeat(24)};links.push(saved);return saved;}
  },
  ImportJob:{filter:async()=>jobs,create:async row=>{const saved={...row,id:"d".repeat(24)};jobs.push(saved);return saved;}}
 };
 globalThis.__simpleImportSdk={auth:{me:async()=>({role:"admin"})},asServiceRole:{entities:db}};
 const invoke=async body=>{const response=await handler(new Request("https://test",{method:"POST",body:JSON.stringify(body)}));return {code:response.status,data:await response.json()};};
 return {invoke,links,jobs,created};
};
test("One click can reuse a unique historical FotMob ID before starting the job",async()=>{
 const f=fixture();
 const link=await f.invoke({action:"link",player_id:pid,use_stored_fotmob_id:true});
 assert.equal(link.code,200);assert.equal(link.data.pid,"815006");
 assert.equal(f.created[0].verification,"automatic_existing_stats_unique");
 const run=await f.invoke({action:"start",player_id:pid,sources:["fotmob","understat","fifa","market"]});
 assert.equal(run.code,200);assert.equal(run.data.job.fotmob_player_id,"815006");
 assert.deepEqual(f.jobs[0].sources,["fotmob","understat","fifa","market"]);
});
test("Conflicting historical IDs are never automatically linked",async()=>{
 const f=fixture({statsIds:["815006","815007"]});
 const result=await f.invoke({action:"link",player_id:pid,use_stored_fotmob_id:true});
 assert.equal(result.code,409);assert.equal(f.created.length,0);
});
test("Cross-player FotMob ID collisions still block a new link",async()=>{
 const f=fixture({otherOwner:"815006"});
 const result=await f.invoke({action:"link",player_id:pid,use_stored_fotmob_id:true});
 assert.equal(result.code,409);assert.equal(f.created.length,0);
});
test("Truncated historical records cannot establish an automatic identity",async()=>{
 const f=fixture({statsIds:Array(200).fill("815006")});
 const result=await f.invoke({action:"link",player_id:pid,use_stored_fotmob_id:true});
 assert.equal(result.code,409);assert.equal(f.created.length,0);
});
test("UI selects all sources and only requires recovery click after player selection",()=>{
 const ui=readFileSync(new URL("../src/pages/ImportCenter.jsx",import.meta.url),"utf8");
 assert.doesNotMatch(ui,/PublicReferenceImport|identityConfirmed|He comprobado que el ID corresponde/);
 assert.match(ui,/>Recuperar historial disponible<\/button>/);
 assert.match(ui,/use_stored_fotmob_id:true/);
 assert.match(ui,/useState\(SOURCES.map\(x=>x.id\)\)/);
 assert.match(ui,/setFotmobDraft/);
 assert.ok(ui.indexOf("const active=jobs.some(")<ui.indexOf("const canStartHistory="));
});
