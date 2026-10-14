import test from 'node:test';
import assert from 'node:assert/strict';
import {WEIGHTS_BY_ROLE, COMPOSITE_ROLES,calculateCompositeMF,metricPercentiles,normalizeRole} from '../src/utils/compositeEngine.js';

test('los ocho arquetipos conservan sus pesos visibles y un resto positivo para rating',()=>{
 assert.equal(COMPOSITE_ROLES.length,8);
 const hidden={ST:19,W:19,CM:18,CAM:21,GK:20,CB:28,FB:23,WB:23};
 for(const [role,weights] of Object.entries(WEIGHTS_BY_ROLE)){
   assert.equal(100-Object.values(weights).reduce((x,y)=>x+y,0),hidden[role]);
   const values=Object.fromEntries([...Object.keys(weights),'rating'].map(k=>[k,100]));
   const result=calculateCompositeMF({metrics:[]},role,values);
   assert.equal(result.status,'calculated');
   assert.equal(result.coverage,100);
   assert.equal(result.score,100);
 }
});

test('ST reconstruye score parcial desde percentiles sin asignar cero a indicadores ausentes',()=>{
 const row={metrics:[{name:'Rating',value:7.88,percentile:96.6},{name:'xG excl. penalty',value:20.69,percentile:94.9},{name:'xA',value:3.16,percentile:84.7},{name:'xGOT',value:25.05,percentile:94.9},{name:'Dispossessed',value:11,percentile:62.7}]};
 const output=calculateCompositeMF(row,'ST');
 assert.equal(output.role,'ST');
 assert.equal(output.status,'partial');
 assert.ok(output.coverage>0 && output.coverage<100);
 assert.ok(output.score>0 && output.score<=100);
 assert.ok(output.missing.includes('xg_chain_p90'));
 assert.equal(output.rows.find(r=>r.key==='dispossessed_p90').contribution,-0.63);
 assert.equal(output.rows.find(r=>r.key==='xg_chain_p90').percentile,null);
});

test('valores sin percentil o percentiles anómalos no cuentan',()=>{
 const row={metrics:[{name:'xA',value:1.2,percentile:-1.2},{name:'Rating',value:7.5,percentile:null}]};
 const output=calculateCompositeMF(row,'ST');
 assert.equal(output.score,null);
 assert.equal(output.status,'no_data');
 assert.equal(metricPercentiles(row).xa_p90,null);
});

test('no se asigna al DM el baremo de CM sin confirmación',()=>{
 assert.equal(normalizeRole('DM'),null);
 assert.equal(calculateCompositeMF({metrics:[]},'DM').score,null);
 assert.equal(normalizeRole('RW'),'W');
 assert.equal(normalizeRole('RB'),'FB');
 assert.equal(normalizeRole('LWB'),'WB');
});
