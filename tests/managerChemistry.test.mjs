import test from "node:test";
import assert from "node:assert/strict";
import {analyzeTacticalPartnerships} from "../src/components/managers/managerChemistry.mjs";
test("missing formation is not scored",()=>{
 assert.deepEqual(analyzeTacticalPartnerships({valid:false,assignments:[]}),{pairs:[],evaluated:0,unavailable:0});
});
test("defender build-up and cover are complementary, but never observed chemistry",()=>{
 const slots=[
  {id:"d1",role:"CB",line:1,index:1,primary:{player:{name:"A"}},advanced:{options:[{id:"ball_playing",name:"Constructor",score:85,coverage:100}]}},
  {id:"d2",role:"CB",line:1,index:2,primary:{player:{name:"B"}},advanced:{options:[{id:"cover",name:"Cobertura",score:75,coverage:67}]}}
 ];
 const r=analyzeTacticalPartnerships({valid:true,assignments:slots});
 assert.equal(r.evaluated,1);assert.equal(r.pairs[0].score,80);
 assert.match(r.pairs[0].limitation,/hipotética/);
});
test("missing attributes are never interpreted as zero chemistry",()=>{
 const slots=[{id:"a",role:"DM",line:2,index:0,primary:{player:{name:"A"}},advanced:{options:[]}},
 {id:"b",role:"DM",line:2,index:1,primary:{player:{name:"B"}},advanced:{options:[]}}];
 const r=analyzeTacticalPartnerships({valid:true,assignments:slots});
 assert.equal(r.pairs[0].score,null);
 assert.equal(r.unavailable,1);
});
