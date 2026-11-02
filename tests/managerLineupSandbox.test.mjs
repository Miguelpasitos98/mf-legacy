import test from 'node:test';
import assert from 'node:assert/strict';
import {applyLineupOverrides,canChooseLineupPlayer} from '../src/components/managers/managerLineupSandbox.mjs';
const players=[{player:{id:'1',name:'One',position:'GK'}},{player:{id:'2',name:'Two',position:'GK'}}];
const lineup={valid:true,assignments:[{id:'GK',role:'GK',primary:players[0]},{id:'bench',role:'GK',primary:players[1]}]};
test('vacating a slot does not edit source',()=>{
 const saved=JSON.stringify(lineup);
 const changed=applyLineupOverrides(lineup,players,null,{GK:''});
 assert.equal(changed.assignments[0].primary,null);
 assert.equal(changed.filled,1);
 assert.equal(JSON.stringify(lineup),saved);
});
test('duplicate selection blocked and never silently accepted',()=>{
 assert.equal(canChooseLineupPlayer('GK','2',{},lineup),false);
 const changed=applyLineupOverrides(lineup,players,null,{GK:'2'});
 assert.equal(changed.assignments[0].primary.player.id,'2');
 assert.equal(changed.assignments[1].primary,null);
 assert.equal(changed.assignments[1].invalidOverride,true);
});
test('missing player cannot create fake lineup selection',()=>{
 const changed=applyLineupOverrides(lineup,players,null,{GK:'unknown'});
 assert.equal(changed.assignments[0].primary,null);
});
