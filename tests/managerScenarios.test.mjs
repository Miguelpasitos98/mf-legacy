import test from "node:test";
import assert from "node:assert/strict";
import {emptyScenarios,effectiveFormation,updateScenario,duplicateScenario,resetScenario,evaluateScenario,compareScenarios} from "../src/components/managers/managerScenarios.mjs";
test("independent A and B draft state, no mutation or shared nested overrides",()=>{
 const original=emptyScenarios();
 const a=updateScenario(original,"A",{formation:"4-3-3",overrides:{GK:"p1"}});
 const b=updateScenario(a,"B",{formation:"4-2-3-1",overrides:{GK:"p2"}});
 assert.deepEqual(original,emptyScenarios());
 assert.equal(a.B.overrides.GK,undefined);
 assert.equal(b.A.overrides.GK,"p1");
 assert.equal(b.B.overrides.GK,"p2");
 assert.notStrictEqual(b.A.overrides,b.B.overrides);
 const updated=resetScenario(b,"B");
 assert.equal(updated.A.overrides.GK,"p1");
 assert.deepEqual(updated.B,{formation:"",overrides:{}});
});
test("copy scenario preserves effective formation as well as overrides",()=>{
 const scenarios=updateScenario(emptyScenarios(),"A",{overrides:{GK:"p1"}});
 const result=duplicateScenario(scenarios,"A","3-4-2-1");
 assert.equal(result.B.formation,"3-4-2-1");
 assert.deepEqual(result.B.overrides,{GK:"p1"});
 assert.notStrictEqual(result.A.overrides,result.B.overrides);
 const changed=updateScenario(result,"A",{overrides:{GK:"p2"}});
 assert.equal(changed.B.overrides.GK,"p1");
});
test("default scenarios use distinct shapes; override does not mutate source",()=>{
 const x=emptyScenarios();
 assert.equal(effectiveFormation(x.A,"4-3-3","A"),"4-3-3");
 assert.equal(effectiveFormation(x.B,"4-3-3","B"),"4-2-3-1");
 assert.equal(effectiveFormation(x.B,"4-2-3-1","B"),"4-3-3");
});
test("empty and invalid evaluation has null metrics, not made-up zero chemistry",()=>{
 const plan={valid:false,profile:null,roleSummary:[]};
 const a=evaluateScenario(plan,[],{formation:"4-3-3",overrides:{}},"A");
 const b=evaluateScenario(plan,[],{formation:"4-2-3-1",overrides:{}},"B");
 assert.equal(a.balance.assessed,0);
 assert.equal(a.chemistry.evaluated,0);
 const comparison=compareScenarios(a,b);
 assert.equal(comparison.metrics.length,6);
 assert.ok(comparison.metrics.every(x=>x.delta===null));
 assert.equal(comparison.changed,0);
});
test("scenario comparison reports incoming/outgoing players without marking unchanged as transfers",()=>{
 const mk=(id,name)=>({player:{id,name}});
 const a={draft:{assignments:[{primary:mk("1","Uno")},{primary:mk("2","Dos")} ]},
 balance:{axes:[{key:"pressure",score:60}]},chemistry:{evaluated:1,unavailable:0,pairs:[]}};
 const b={draft:{assignments:[{primary:mk("1","Uno")},{primary:mk("3","Tres")} ]},
 balance:{axes:[{key:"pressure",score:70}]},chemistry:{evaluated:0,unavailable:1,pairs:[]}};
 const x=compareScenarios(a,b);
 assert.equal(x.retained,1);
 assert.deepEqual(x.onlyA,["Dos"]);
 assert.deepEqual(x.onlyB,["Tres"]);
 assert.equal(x.metrics[0].delta,10);
});
