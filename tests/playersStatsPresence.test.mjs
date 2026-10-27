import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../base44/functions/player-stats-presence/entry.js",import.meta.url),"utf8")
  .replace('import {createClientFromRequest} from "npm:@base44/sdk";',"const createClientFromRequest=()=>globalThis.__statsBadgeTestClient;");
const {collectStatsPlayerIds,default:handler}=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));

function database(input){
 const calls=[];
 const db={PlayerSeasonStats:{filter:async(query,sort,limit,skip)=>{
  calls.push({sort,limit,skip});
  return input.slice(skip,skip+limit);
 }}};
 return {db,calls};
}
test("Distingue estadísticas reales de jugadores y no confunde temporadas actuales ocultas",async()=>{
 const d=database([
  {player_id:"p1",season:"2026/2027"},{player_id:"p1",season:"2024/2025"},
  {player_id:"p2",season:"2026/2027"},{player_id:"p3",season:"2025/2026"},
  {player_id:"p3",season:"2023/2024"},{player_id:"",season:"2020/2021"}]);
 const ids=await collectStatsPlayerIds(d.db,{pageSize:2,maxRows:20,now:new Date("2026-10-27T18:00:00Z")});
 assert.deepEqual(ids,["p1","p3"]);
 assert.equal(d.calls.length,4);
});
test("La consulta nunca declara un subconjunto incompleto como resultado definitivo",async()=>{
 const d=database([{player_id:"p1",season:"2024/2025"},{player_id:"p2",season:"2025/2026"}]);
 await assert.rejects(collectStatsPlayerIds(d.db,{pageSize:1,maxRows:2,now:new Date("2026-10-27")}),/límite/);
});
test("La función solo responde a administradores",async()=>{
 globalThis.__statsBadgeTestClient={auth:{me:async()=>({role:"user"})},asServiceRole:{entities:database([]).db}};
 const r=await handler(new Request("https://example.org/",{method:"POST"}));
 assert.equal(r.status,403);
});
test("Una consulta autenticada devuelve únicamente IDs, no estadísticas",async()=>{
 globalThis.__statsBadgeTestClient={auth:{me:async()=>({role:"admin"})},
   asServiceRole:{entities:database([{player_id:"p1",season:"2024/2025",metrics:[{name:"Tackles",value:23}]}]).db}};
 const r=await handler(new Request("https://example.org/",{method:"POST"}));
 assert.equal(r.status,200);
 assert.deepEqual(await r.json(),{ok:true,player_ids:["p1"]});
});
