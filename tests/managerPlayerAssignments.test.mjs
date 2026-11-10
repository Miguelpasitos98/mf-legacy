import test from "node:test";
import assert from "node:assert/strict";
import {
 indexManagerPlayerAssignments,filterManagerPlayerAssignments,
 countManagerPlayerAssignments,saveManagerPlayerDecision
} from "../src/components/managers/managerPlayerAssignments.mjs";

function fakeEntity(seed=[]){
 let serial=0;
 const rows=seed.map(x=>({...x,history:[...(x.history||[])]}));
 return {
  rows,
  async filter(query){return rows.filter(x=>Object.entries(query).every(([k,v])=>x[k]===v));},
  async create(payload){
   const record={...payload,id:"new"+(++serial)};
   rows.push(record);return {...record};
  },
  async update(id,payload){
   const record=rows.find(r=>r.id===id);
   if(!record)throw Error("Missing");
   Object.assign(record,payload);return {...record};
  }
 };
}
const decision=(action,managerId="klopp",options={})=>({
 action,playerId:"salah",managerId,profileId:"period",role:"WG",...options
});
test("link, preselect and release use one persisted record and preserve history",async()=>{
 const entity=fakeEntity();
 await saveManagerPlayerDecision(entity,decision("preselect"));
 assert.equal(entity.rows.length,1);
 assert.equal(entity.rows[0].status,"preselected");
 await saveManagerPlayerDecision(entity,decision("link"));
 assert.equal(entity.rows.length,1);
 assert.equal(entity.rows[0].status,"linked");
 assert.equal(entity.rows[0].history.length,2);
 await saveManagerPlayerDecision(entity,decision("release"));
 assert.equal(entity.rows[0].status,"released");
 assert.equal(entity.rows[0].history.length,3);
 await saveManagerPlayerDecision(entity,decision("link"));
 assert.equal(entity.rows[0].history.length,4);
 assert.equal(entity.rows.length,1);
});
test("another coach cannot silently claim a linked player",async()=>{
 const entity=fakeEntity();
 await saveManagerPlayerDecision(entity,decision("link"));
 await assert.rejects(saveManagerPlayerDecision(entity,decision("link","ancelotti")),/otro entrenador/);
 assert.equal(entity.rows[0].manager_id,"klopp");
 await saveManagerPlayerDecision(entity,decision("link","ancelotti",{confirmReassign:true}));
 assert.equal(entity.rows[0].manager_id,"ancelotti");
 assert.equal(entity.rows[0].history.at(-1).from_manager_id,"klopp");
 assert.equal(entity.rows[0].history.at(-1).to_manager_id,"ancelotti");
});
test("released players are available but linked players are reserved, regardless of their score",()=>{
 const rows=[{player:{id:"p1"}},{player:{id:"p2"}},{player:{id:"p3"}}];
 const idx=indexManagerPlayerAssignments([
  {player_id:"p1",manager_id:"a",status:"linked"},
  {player_id:"p2",manager_id:"a",status:"preselected"},
  {player_id:"p3",manager_id:"b",status:"released"}
 ]);
 assert.deepEqual(filterManagerPlayerAssignments(rows,idx,"a","available").map(r=>r.player.id),["p3"]);
 assert.deepEqual(filterManagerPlayerAssignments(rows,idx,"a","linked").map(r=>r.player.id),["p1"]);
 assert.deepEqual(filterManagerPlayerAssignments(rows,idx,"a","preselected").map(r=>r.player.id),["p2"]);
 assert.deepEqual(countManagerPlayerAssignments(idx,"a"),{linked:1,preselected:1,occupied:2,conflicts:0});
});
test("multiple records for one player are blocked rather than silently resolved",async()=>{
 const rows=[
  {id:"one",player_id:"salah",manager_id:"a",status:"linked"},
  {id:"two",player_id:"salah",manager_id:"b",status:"linked"}
 ];
 const idx=indexManagerPlayerAssignments(rows);
 assert.equal(idx.conflicts.has("salah"),true);
 const entity=fakeEntity(rows);
 await assert.rejects(saveManagerPlayerDecision(entity,decision("link")) ,/duplicados/);
});
test("release from a different manager is denied",async()=>{
 const entity=fakeEntity([{id:"one",player_id:"salah",manager_id:"klopp",status:"linked"}]);
 await assert.rejects(saveManagerPlayerDecision(entity,decision("release","ancelotti")),/Solo puedes liberar/);
});
test("validations preserve player club and historical stats",async()=>{
 const entity=fakeEntity();
 const result=await saveManagerPlayerDecision(entity,decision("link"));
 assert.equal(result.player_id,"salah");
 assert.equal("team_id" in result,false);
 assert.equal("stats" in result,false);
 assert.equal("ca" in result,false);
});
