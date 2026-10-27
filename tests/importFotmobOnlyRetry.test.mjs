import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {webcrypto} from "node:crypto";
globalThis.crypto??=webcrypto;
let source=readFileSync(new URL("../base44/functions/import-control/entry.js",import.meta.url),"utf8");
source=source.replace('import { createClientFromRequest } from "npm:@base44/sdk";',
  "const createClientFromRequest=()=>globalThis.__fotmobControlTestClient;");
const {default:control}=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));
test("Recuperar FotMob no vuelve a cargar FIFA ni mercado",async()=>{
 const playerId="bbbbbbbbbbbbbbbbbbbbbbbb";
 const previous={id:"aaaaaaaaaaaaaaaaaaaaaaaa",player_id:playerId,status:"review",retry_count:2,
   sources:["fotmob","fifa","market"],source_results:{fotmob:{diagnostics:[{status:"cache_absent"}]}}};
 let created;
 const db={
  Player:{get:async()=>({id:playerId,name:"Ronald Araujo"})},
  PlayerFotmobLink:{filter:async()=>[{player_id:playerId,fotmob_player_id:"921253",verification:"manual"}]},
  ImportJob:{get:async()=>previous,filter:async()=>[previous],
    create:async x=>{created=x;return {id:"cccccccccccccccccccccccc",...x};}}
 };
 globalThis.__fotmobControlTestClient={auth:{me:async()=>({role:"admin"})},asServiceRole:{entities:db}};
 const req=new Request("https://example.org/import-control",{method:"POST",
   headers:{"Content-Type":"application/json"},body:JSON.stringify({
    action:"retry-fotmob",job_id:previous.id,player_id:playerId})});
 const response=await control(req),body=await response.json();
 assert.equal(response.status,200,JSON.stringify(body));
 assert.deepEqual(created.sources,["fotmob"]);
 assert.equal(created.retry_pending,true);
 assert.equal(created.retry_count,0);
});
