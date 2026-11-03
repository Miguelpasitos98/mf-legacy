import test from "node:test";
import assert from "node:assert/strict";
import {summarizeFotmobXgot,xgotObservations} from "../src/utils/fotmobXgot.js";
import {normalizeRecord} from "../src/utils/statsImport.js";
const base={fotmob_player_id:"123",player_name:"Test",season:"2022/2023",competition:"LaLiga",team_name:"Club",minutes:900,verification_status:"verified"};
const metric=(value,extra={})=>({name:"xGOT",value,source:"fotmob",verification_status:"verified",...extra});
test("xGOT total and per90 use only FotMob minutes",()=>{
 const data=summarizeFotmobXgot([{...base,metrics:[metric(5)]}], "123");
 assert.equal(data.seasons[0].total,5);
 assert.equal(data.seasons[0].per90,0.5);
 assert.equal(data.seasons[0].entries[0].rateOrigin,"calculado");
});
test("explicit xGOT /90 is never divided twice",()=>{
 const result=xgotObservations([{...base,metrics:[metric(5,{per90:0.53})]}],"123");
 assert.equal(result[0].per90,0.53);
});
test("different competitions are combined only when supported, with partial coverage",()=>{
 const result=summarizeFotmobXgot([
  {...base,metrics:[metric(4)]},
  {...base,competition:"Champions League",minutes:450,metrics:[]}
 ],"123").seasons[0];
 assert.equal(result.total,4);
 assert.equal(result.per90,0.4);
 assert.equal(result.partial,true);
 assert.equal(result.knownCompetitions,1);
 assert.equal(result.allCompetitions,2);
});
test("missing is not zero; no xG/xGBuildup surrogate",()=>{
 const result=summarizeFotmobXgot([{...base,metrics:[{name:"xG",value:9,source:"fotmob",verification_status:"verified"}]}],"123").seasons[0];
 assert.equal(result.total,null);
 assert.equal(result.per90,null);
 assert.equal(result.partial,true);
});
test("reject identity mismatch, unverified values, PSxG and duplicate competition rows",()=>{
 const rows=[
 {...base,metrics:[metric(3)]},
 {...base,metrics:[metric(5)]},
 {...base,fotmob_player_id:"987",metrics:[metric(8)]},
 {...base,competition:"Cup",metrics:[{name:"xGOT",value:5,source:"fotmob",verification_status:"unverified"}]},
 {...base,competition:"Other",metrics:[{name:"PSxGOT against",value:12,source:"fotmob",verification_status:"verified"}]}
 ];
 const out=summarizeFotmobXgot(rows,"123").seasons[0];
 assert.equal(out.total,3);
 assert.equal(out.allCompetitions,3);
 assert.equal(out.partial,true);
});
test("top-level FotMob xGOT is recognized and derived from own minutes",()=>{
 const result=normalizeRecord({fotmob_player_id:"654096",player_name:"Test",season:"2022/23",competition:"Premier League",team_name:"Club",minutes:450,xGOT:2.5,metrics:[{name:"xG",value:7}]});
 const xgot=result.metrics.find(x=>x.name==="xGOT");
 assert.ok(xgot);
 assert.equal(xgot.value,2.5);
 assert.equal(xgot.per90,0.5);
 assert.equal(result.metrics.find(x=>x.name==="xG").value,7);
});

test("single-competition published rate is preserved without dividing again",()=>{
 const result=summarizeFotmobXgot([{...base,metrics:[metric(4,{per90:0.42})]}],"123").seasons[0];
 assert.equal(result.total,4);assert.equal(result.per90,0.42);
});
test("published rate without total never fabricates an xGOT total",()=>{
 const result=summarizeFotmobXgot([{...base,metrics:[{name:"xGOT",value:null,per90:0.35,source:"fotmob",verification_status:"verified"}]}],"123").seasons[0];
 assert.equal(result.total,null);assert.equal(result.per90,0.35);
});
