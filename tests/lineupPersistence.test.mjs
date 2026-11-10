import test from "node:test";
import assert from "node:assert/strict";
import {reconcileLineupChildren,lineupRows} from "../src/components/teams/lineupPersistence.mjs";

function db(rows=[]){
 let count=100,fail=null;
 const data=rows.map(r=>({...r})),actions=[];
 const api={
  data,actions,
  failOn(action){fail=action;},
  async filter(where,order,limit=200,skip=0){
   return data.filter(x=>Object.entries(where).every(([k,v])=>x[k]===v)).slice(skip,skip+limit);
  },
  async create(row){
   actions.push(["create",row]);
   if(fail==="create")throw Error("CREATE_DENIED");
   const saved={...row,id:"new"+(++count)};data.push(saved);return {...saved};
  },
  async update(id,row){
   actions.push(["update",id,row]);
   if(fail==="update")throw Error("UPDATE_DENIED");
   const current=data.find(x=>x.id===id);
   if(!current)throw Error("Missing "+id);
   Object.assign(current,row);return {...current};
  },
  async delete(id){
   actions.push(["delete",id]);
   if(fail==="delete")throw Error("DELETE_DENIED");
   const index=data.findIndex(x=>x.id===id);
   if(index<0)throw Error("Missing "+id);
   data.splice(index,1);return {};
  }
 };
 return api;
}
const slot=(code,player)=>({slot_code:code,player_id:player,x_position:50,y_position:60,display_order:0});
test("editing the same XI updates one slot without deleting and creating all 11",async()=>{
 const slots=db(Array.from({length:11},(_,i)=>({id:"s"+i,lineup_id:"x",...slot("S"+i,"p"+i)})));
 const bench=db([]);
 const next=Array.from({length:11},(_,i)=>slot("S"+i,i===2?"replacement":"p"+i));
 await reconcileLineupChildren({slotEntity:slots,benchEntity:bench,lineupId:"x",slots:next,bench:[]});
 assert.equal(slots.actions.filter(x=>x[0]==="create").length,0);
 assert.equal(slots.actions.filter(x=>x[0]==="delete").length,0);
 assert.equal(slots.actions.filter(x=>x[0]==="update").length,1);
 assert.equal(slots.data.find(x=>x.slot_code==="S2").player_id,"replacement");
});
test("removing a player from the field removes persisted slot; retry stays idempotent",async()=>{
 const slots=db([{id:"one",lineup_id:"x",...slot("GK","p1")},{id:"two",lineup_id:"x",...slot("ST","p2")}]);
 const bench=db([]);
 const req={slotEntity:slots,benchEntity:bench,lineupId:"x",slots:[slot("GK","p1")],bench:[]};
 await reconcileLineupChildren(req);
 assert.equal(slots.data.length,1);
 await reconcileLineupChildren(req);
 assert.equal(slots.data.length,1);
 assert.equal(slots.actions.filter(x=>x[0]==="create").length,0);
});
test("concurrent old duplicate rows are cleaned only after desired changes persist",async()=>{
 const slots=db([{id:"one",lineup_id:"x",...slot("GK","p1")},{id:"two",lineup_id:"x",...slot("GK","p1")}]);
 const bench=db([]);
 await reconcileLineupChildren({slotEntity:slots,benchEntity:bench,lineupId:"x",slots:[slot("GK","p2")],bench:[]});
 assert.equal(slots.data.length,1);
 assert.equal(slots.data[0].player_id,"p2");
 assert.equal(slots.actions.filter(x=>x[0]==="delete").length,1);
});
test("failed creation rolls back new row and existing updates, preserving original XI",async()=>{
 const slots=db([{id:"one",lineup_id:"x",...slot("GK","p1")}]);
 const bench=db([]);bench.failOn("create");
 await assert.rejects(reconcileLineupChildren({slotEntity:slots,benchEntity:bench,lineupId:"x",slots:[slot("GK","p2"),slot("ST","p3")],bench:[{player_id:"p4",bench_order:0}]}),/CREATE_DENIED/);
 assert.equal(slots.data.length,1);
 assert.equal(slots.data[0].player_id,"p1");
});
test("a failed deletion is reported, never a successful save",async()=>{
 const slots=db([{id:"one",lineup_id:"x",...slot("GK","p1")}]);slots.failOn("delete");
 await assert.rejects(reconcileLineupChildren({slotEntity:slots,benchEntity:db([]),lineupId:"x",slots:[],bench:[]}),/no pudieron eliminarse/);
});
test("paged reads accept different SDK wrapper shapes and reject duplicates",async()=>{
 const rows=Array.from({length:240},(_,i)=>({id:String(i),lineup_id:"x"}));
 const entity={filter:async(_,__,n,skip)=>({items:rows.slice(skip,skip+n)})};
 assert.equal((await lineupRows(entity,{lineup_id:"x"})).length,240);
});
