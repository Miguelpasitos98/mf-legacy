import test from 'node:test';
import assert from 'node:assert/strict';
import {groupImportJobs,visibleImportGroups,importGroupActivity} from '../src/utils/importJobGroups.js';
const job=(id,player_id,requested_at,status='completed',extra={})=>({id,player_id,player_name:player_id,requested_at,status,progress:100,received_candidates:20,sources:['fotmob'],...extra});
test('agrupa los bloques por jugador, no borra historial ni duplicados de cadena',()=>{
 const jobs=[job('a','Kepa','2026-10-26T10:00:00Z'),job('b','Kepa','2026-10-27T10:00:00Z','review'),
  job('c','Gerard','2026-10-27T09:00:00Z','completed')];
 const groups=groupImportJobs(jobs);
 assert.equal(groups.length,2);
 assert.equal(groups.find(x=>x.id==='Kepa').items.length,2);
 assert.equal(groups.find(x=>x.id==='Kepa').received,40);
 assert.equal(groups.find(x=>x.id==='Kepa').status,'review');
 assert.deepEqual(groups.find(x=>x.id==='Kepa').items.map(x=>x.id),['b','a']);
});
test('el trabajo activo nunca desaparece al ocultar el historial antiguo',()=>{
 const jobs=Array.from({length:15},(_,i)=>job(String(i),'p'+i,'2026-10-27T'+String(i).padStart(2,'0')+':00:00Z'));
 jobs[0].status='running';
 const groups=groupImportJobs(jobs);
 const visible=visibleImportGroups(groups,false,8);
 assert.ok(visible.some(g=>g.id==='p0'));
 assert.equal(visible.length,8);
 assert.equal(visibleImportGroups(groups,true,8).length,15);
});
test('resume valores incorporados y pendientes sin inventar datos para trabajos sin informe',()=>{
 const activity=importGroupActivity([
  {phase:'Automático: 203 candidatos compatibles incorporados; 80 pendientes de revisión'},
  {phase:'Conciliación histórica: 30 valores incorporados; 18 por revisar'},
  {phase:'Cobertura FotMob: siguiente bloque de competiciones pendientes'},
 ]);
 assert.equal(activity.incorporated,233);
 assert.equal(activity.pending,98);
 assert.equal(activity.reviewedJobs,2);
 assert.equal(importGroupActivity([{phase:'Esperando'}]).pending,null);
});
test('no borra ni altera objetos originales',()=>{
 const jobs=[job('old','Kepa','2026-10-01T10:00:00Z','failed'),job('new','Kepa','2026-10-27T10:00:00Z','running',{progress:30})];
 const before=JSON.stringify(jobs);
 const [group]=groupImportJobs(jobs);
 assert.equal(group.main.id,'new');
 assert.equal(group.errors,1);
 assert.equal(JSON.stringify(jobs),before);
});
