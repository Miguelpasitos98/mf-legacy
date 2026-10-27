import test from 'node:test';
import assert from 'node:assert/strict';
import {auditStatsTransfer} from '../src/utils/statsTransferAudit.js';
const now=new Date('2026-10-27T21:00:00Z');
test('detecta métricas sin columna y conserva ceros, negativos y la identidad',()=>{
 const rows=[{player_id:'kepa',season:'2024/2025',competition:'Premier League',minutes:null,metrics:[
  {name:'Goals prevented',value:-2.13,per90:-0.08},
  {name:'Save percentage',value:0},
  {name:'Saves',value:15,per90:1.7},
 ]}];
 const result=auditStatsTransfer(rows,{now});
 assert.equal(result.totals.rows,1);
 assert.equal(result.totals.metrics,3);
 assert.equal(result.totals.ratesPresent,1);
 assert.equal(result.totals.ratesHidden,0);
 assert.equal(result.totals.missingMinutes,1);
 assert.equal(result.issues.find(x=>x.metric==='Save percentage')?.type,'no_column');
 assert.equal(result.issues.some(x=>x.metric==='Goals prevented'),false);
});
test('la temporada actual queda oculta sin alterar los registros',()=>{
 const r=[{season:'2026/2027',metrics:[{name:'Unknown',value:1}]},{season:'2025/2026',metrics:[{name:'Saves',value:2}]}];
 const audit=auditStatsTransfer(r,{now});
 assert.equal(audit.totals.rows,1);
 assert.equal(audit.totals.currentExcluded,1);
 assert.equal(audit.totals.notRepresented,0);
 assert.equal(r.length,2);
});
