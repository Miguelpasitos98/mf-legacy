import test from 'node:test';
import assert from 'node:assert/strict';
import {WEIGHTS_BY_ROLE, COMPOSITE_ROLES,calculateCompositeMF,metricPercentiles,normalizeRole,analyzeCompositeSensitivity} from '../src/utils/compositeEngine.js';

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

test('GK redistribuye xG Buildup ausente 60/40 entre los dos pases disponibles',()=>{
 const input={goals_prevented_p90:8,fc27_ovr:95,accurate_long_balls_p90:2,accurate_passes_p90:59,market_value:81,play_share:35,save_pct:69,rating:50};
 const result=calculateCompositeMF({metrics:[]},'GK',input);
 const get=key=>result.rows.find(r=>r.key===key);
 assert.equal(get('xg_buildup_p90').weight,0);
 assert.equal(get('accurate_long_balls_p90').weight,10.8);
 assert.equal(get('accurate_passes_p90').weight,4.2);
 assert.equal(get('accurate_long_balls_p90').baseWeight,6);
 assert.equal(get('accurate_passes_p90').baseWeight,1);
 assert.equal(get('accurate_long_balls_p90').contribution,0.22);
 assert.equal(get('accurate_passes_p90').contribution,2.48);
});
test('GK conserva pesos base cuando xG Buildup esta disponible',()=>{
 const input={xg_buildup_p90:75,accurate_long_balls_p90:40,accurate_passes_p90:65};
 const r=calculateCompositeMF({metrics:[]},'GK',input).rows;
 assert.equal(r.find(x=>x.key==='xg_buildup_p90').weight,8);
 assert.equal(r.find(x=>x.key==='accurate_long_balls_p90').weight,6);
 assert.equal(r.find(x=>x.key==='accurate_passes_p90').weight,1);
});
test('GK no inventa un percentil de pases cuando tambien faltan',()=>{
 const r=calculateCompositeMF({metrics:[]},'GK',{play_share:35}).rows;
 assert.equal(r.find(x=>x.key==='accurate_long_balls_p90').weight,6);
 assert.equal(r.find(x=>x.key==='accurate_passes_p90').weight,1);
 assert.equal(r.find(x=>x.key==='xg_buildup_p90').weight,0);
});

test('CB redistribuye ambos xG faltantes en pases y acciones ajustadas 45/40/15',()=>{
 const p={accurate_passes_p90:85,accurate_long_balls_p90:80,def_actions_poss_adj_p90:22,fc27_ovr:99};
 const r=calculateCompositeMF({metrics:[]},'CB',p);
 const get=k=>r.rows.find(x=>x.key===k);
 assert.equal(get('xg_buildup_p90').weight,0);
 assert.equal(get('xg_chain_p90').weight,0);
 assert.ok(Math.abs(get('accurate_passes_p90').weight-10.35)<1e-9);
 assert.ok(Math.abs(get('accurate_long_balls_p90').weight-11.2)<1e-9);
 assert.ok(Math.abs(get('def_actions_poss_adj_p90').weight-11.45)<1e-9);
 assert.equal(get('accurate_passes_p90').baseWeight,0);
 assert.equal(get('accurate_long_balls_p90').baseWeight,2);
 assert.equal(get('def_actions_poss_adj_p90').baseWeight,8);
});
test('CB redistribuye solo la métrica xG ausente; no transfiere a percentiles ausentes',()=>{
 const r=calculateCompositeMF({metrics:[]},'CB',{xg_buildup_p90:80,accurate_long_balls_p90:70,def_actions_poss_adj_p90:55});
 const get=k=>r.rows.find(x=>x.key===k);
 assert.equal(get('xg_buildup_p90').weight,18);
 assert.equal(get('xg_chain_p90').weight,0);
 assert.equal(get('accurate_long_balls_p90').weight,4);
 assert.equal(get('def_actions_poss_adj_p90').weight,8.75);
 assert.equal(get('accurate_passes_p90').weight,0);
});

test('Analizar nota recalcula escenarios sin mutar el Composite original',()=>{
 const input={goals_prevented_p90:90,fc27_ovr:70,accurate_long_balls_p90:60,
 accurate_passes_p90:50,market_value:70,play_share:80,save_pct:65,rating:75};
 const original=calculateCompositeMF({metrics:[]},'GK',input);
 const before=JSON.stringify(original);
 const scenarios=analyzeCompositeSensitivity(original);
 const goals=scenarios.find(s=>s.key==='goals_prevented_p90');
 assert.ok(goals);
 assert.equal(goals.original,original.score);
 assert.ok(Number.isFinite(goals.without));
 assert.ok(goals.without<goals.original);
 assert.equal(JSON.stringify(original),before);
 assert.deepEqual(analyzeCompositeSensitivity({role:'GK',score:null,rows:[]}),[]);
});

test('ST redistribuye xG Chain 10% y xG Buildup 5% en objetivos verificados',()=>{
 const p={xa_p90:80,xg_p90:75,accurate_long_balls_p90:60,accurate_passes_p90:70,successful_dribbles_p90:50,rating:72};
 const r=calculateCompositeMF({metrics:[]},'ST',p);
 const find=k=>r.rows.find(row=>row.key===k);
 assert.equal(find('xg_chain_p90').weight,0);
 assert.equal(find('xg_buildup_p90').weight,0);
 assert.equal(find('xg_chain_p90').baseWeight,10);
 assert.equal(find('xg_buildup_p90').baseWeight,5);
 assert.equal(find('xa_p90').weight,16);
 assert.equal(find('xa_p90').transferred,8);
 assert.equal(find('xg_p90').weight,5);
 assert.equal(find('accurate_long_balls_p90').weight,1.75);
 assert.equal(find('accurate_passes_p90').weight,.75);
 assert.equal(find('successful_dribbles_p90').weight,1.5);
 assert.ok(r.score!==null);
});
test('ST solo redistribuye la métrica ausente y nunca inventa un xG/90',()=>{
 const p={xa_p90:70,xg_p90:null,xg_chain_p90:50,xg_buildup_p90:null,accurate_long_balls_p90:null,rating:60};
 const r=calculateCompositeMF({metrics:[]},'ST',p);
 const find=k=>r.rows.find(row=>row.key===k);
 assert.equal(find('xg_chain_p90').weight,10);
 assert.equal(find('xg_buildup_p90').weight,0);
 assert.equal(find('xa_p90').weight,11);
 assert.equal(find('xg_p90').percentile,null);
 assert.equal(find('accurate_long_balls_p90').weight,1);
 const withoutBoth=calculateCompositeMF({metrics:[]},'ST',{xa_p90:50,rating:70});
 assert.equal(withoutBoth.rows.find(row=>row.key==='xg_p90').weight,0);
 assert.equal(withoutBoth.rows.find(row=>row.key==='xg_p90').percentile,null);
});
test('ST conserva pesos originales cuando Understat Chain y Buildup están disponibles',()=>{
 const r=calculateCompositeMF({metrics:[]},'ST',{xg_chain_p90:80,xg_buildup_p90:70,xa_p90:50,xg_p90:95});
 const find=k=>r.rows.find(row=>row.key===k);
 assert.equal(find('xg_chain_p90').weight,10);
 assert.equal(find('xg_buildup_p90').weight,5);
 assert.equal(find('xa_p90').weight,8);
 assert.equal(find('xg_p90').weight,0);
});
