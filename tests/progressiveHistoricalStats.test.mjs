import test from "node:test";
import assert from "node:assert/strict";
import {loadCompleteSeason,availableHistoricalSeasons} from "../src/utils/progressiveHistoricalStats.mjs";

test("returns only a full, validated season after walking all pages",async()=>{
 const calls=[],rows=Array.from({length:650},(_,i)=>({id:String(i),season:"2022/2023",minutes:90,metrics:[]}));
 const entity={filter:async(query,sort,limit,skip)=>{
   calls.push({query,sort,limit,skip});
   return rows.slice(skip,skip+limit);
 }};
 const got=await loadCompleteSeason(entity,"2022/2023");
 assert.equal(got.length,650);
 assert.deepEqual(calls.map(x=>x.skip),[0,300,600]);
 assert.ok(calls.every(x=>x.query.season==="2022/2023"&&x.limit===300));
});

test("rejects duplicate records and an incomplete cursor/season response",async()=>{
 const wrong={filter:async()=>[{id:"abc",season:"2024/2025"}]};
 await assert.rejects(loadCompleteSeason(wrong,"2022/2023"),/incoherente/);
 const duplicates={filter:async(_,__,limit,skip)=>skip===0?Array.from({length:limit},(_,i)=>({id:"x"+i,season:"2022/2023"})):[{id:"x1",season:"2022/2023"}]};
 await assert.rejects(loadCompleteSeason(duplicates,"2022/2023"),/incoherente/);
 const broken={filter:async()=>({items:null})};
 await assert.rejects(loadCompleteSeason(broken,"2022/2023"),/inválida/);
});

test("season discovery uses distinct values and a non-fabricating safe fallback",async()=>{
 const seasons=await availableHistoricalSeasons({list:async()=>({items:["2023/2024","2022/2023","2023/2024","invalid"],has_more:false})});
 assert.deepEqual(seasons,["2023/2024","2022/2023"]);
 const fallback=await availableHistoricalSeasons({list:async()=>{throw Error("distinct unavailable")}});
 assert.ok(fallback.includes("2022/2023"));
});
