import test from 'node:test';
import assert from 'node:assert/strict';
import {selectedCandidatePool,candidatePoolValue,isExternalCandidate} from '../src/components/managers/managerCandidatePool.mjs';
import {applyLineupOverrides} from '../src/components/managers/managerLineupSandbox.mjs';
test('opt-in only: players at elite clubs remain excluded unless user marks them explicitly',()=>{
 const players=[
  {id:'elite',name:'Élite',team_id:'elite-club',manager_fit_candidate:false},
  {id:'selected',name:'Liga menor',team_id:'small-club',manager_fit_candidate:true},
  {id:'other',name:'Otro',team_id:'small-club'},
 ];
 assert.deepEqual(selectedCandidatePool(players,[],false),[]);
 const results=selectedCandidatePool(players,[],true);
 assert.deepEqual(results.map(x=>x.player.id),['selected']);
 assert.equal(results[0].player.team_id,'small-club');
 assert.equal(results[0].membership.status,undefined);
 assert.equal(results[0].externalCandidate,true);
});
test('manually selected elite-club player is eligible too, with no automatic league filter',()=>{
 const result=selectedCandidatePool([{id:'1',name:'Elegido',team_id:'elite',manager_fit_candidate:true}],[],true);
 assert.equal(result.length,1);
 assert.ok(isExternalCandidate(result[0]));
 assert.equal(candidatePoolValue('true'),false);
});
test('a candidate already on the roster never appears a second time; original records unchanged',()=>{
 const original={id:'p',name:'Jugador',manager_fit_candidate:true,team_id:'external'};
 const players=[original,{...original}];
 const selected=selectedCandidatePool(players,['p'],true);
 assert.deepEqual(selected,[]);
 assert.equal(original.team_id,'external');
});
test('pool candidates can be tried in temporary lineup without changing current club',()=>{
 const external=selectedCandidatePool([{id:'p',name:'Candidato',position:'DC',team_id:'outside',manager_fit_candidate:true}],[],true);
 const base={valid:true,assignments:[{id:'forward',role:'ST',primary:null}],filled:0};
 const changed=applyLineupOverrides(base,external,null,{forward:'p'});
 assert.equal(changed.assignments[0].primary.player.name,'Candidato');
 assert.equal(changed.assignments[0].primary.player.team_id,'outside');
 assert.equal(changed.assignments[0].primary.externalCandidate,true);
 assert.equal(changed.filled,1);
 assert.equal(base.assignments[0].primary,null);
});
