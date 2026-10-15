import test from "node:test";
import assert from "node:assert/strict";
import {calculateExperimentalFallback,FALLBACK_RESEARCH_VERSION} from "../src/utils/experimentalFallback.js";
import {calculateCompositeMF} from "../src/utils/compositeEngine.js";
const P={rating:88,xa_p90:70,npxg_p90:60,xgot_p90:45,xg_buildup_p90:null,xg_chain_p90:null,successful_dribbles_p90:80,accurate_long_balls_p90:65,fc27_ovr:90};
test("ST: Chain 10% → xA 5pp, y xG fuera del perfil se descarta",()=>{
 const exp=calculateExperimentalFallback("ST",P);
 assert.equal(exp.method,FALLBACK_RESEARCH_VERSION);
 assert.equal(exp.trace.find(t=>t.source==="xg_chain_p90"&&t.target==="xa_p90").weight,5);
 assert.equal(exp.trace.find(t=>t.source==="xg_chain_p90"&&t.target==="xg_p90").action,"target-not-in-base");
 assert.equal(exp.rows.find(r=>r.key==="xa_p90").effectiveWeight,16);
 assert.equal(exp.rows.find(r=>r.key==="xg_chain_p90").effectiveWeight,0);
 assert.ok(exp.score!==null);
});
test("CAM: Chain destina 60% nominal a xA y npxG; sólo percentiles válidos retienen peso",()=>{
 const exp=calculateExperimentalFallback("CAM",{rating:80,xa_p90:55,npxg_p90:70});
 assert.equal(exp.trace.find(t=>t.source==="xg_chain_p90"&&t.target==="xa_p90").weight,3.5999999999999996);
 assert.equal(exp.trace.find(t=>t.source==="xg_chain_p90"&&t.target==="npxg_p90").action,"retained");
});
test("Sin cohortes suficientes no crea percentiles ni Composite",()=>{
 const exp=calculateExperimentalFallback("ST",{xa_p90:null});
 assert.equal(exp.score,null);
 assert.equal(exp.status,"insufficient");
 assert.equal(exp.retainedCount,0);
});
test("No cambia los pesos ni el cálculo actual",()=>{
 const v={rating:80,xa_p90:60,npxg_p90:40};
 const before=calculateCompositeMF({metrics:[]},"ST",v);
 calculateExperimentalFallback("ST",v);
 const after=calculateCompositeMF({metrics:[]},"ST",v);
 assert.deepEqual(after,before);
});
test("El fallback no transfiere recursivamente peso que acaba de recibir",()=>{
 const exp=calculateExperimentalFallback("ST",{rating:80,xa_p90:50});
 const chain=exp.trace.filter(t=>t.source==="xg_chain_p90");
 assert.equal(chain.length,2);
 assert.equal(chain.find(t=>t.target==="xa_p90").action,"retained");
 assert.equal(chain.find(t=>t.target==="xg_p90").action,"target-not-in-base");
 assert.equal(exp.trace.filter(t=>t.source==="xg_chain_p90").length,2);
});
test("Penalizaciones mantienen signo y denominador firmado",()=>{
 const exp=calculateExperimentalFallback("ST",{rating:75,dispossessed_p90:90});
 assert.ok(exp.rows.find(r=>r.key==="dispossessed_p90").effectiveWeight<0);
 assert.ok(exp.denominator>0);
});
