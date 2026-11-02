import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeTeamBalance,compareTeamBalance} from '../src/components/managers/managerTeamBalance.mjs';
test('missing data remains unknown',()=>{const x=analyzeTeamBalance({valid:false});assert.equal(x.assessed,0);assert.equal(x.axes.length,6);assert.ok(x.axes.every(a=>a.score===null));});
test('one player contributes only once to same function axis',()=>{const x=analyzeTeamBalance({valid:true,assignments:[{primary:{player:{id:'a',name:'A'}},advanced:{options:[{id:'playmaker',score:80},{id:'false_nine',score:90}]}},{primary:{player:{id:'b',name:'B'}},advanced:{options:[{id:'sweeper',score:70}]}}]});assert.equal(x.axes.find(a=>a.key==='buildup').score,80);});
test('unknown comparison has no artificial difference',()=>{const x=analyzeTeamBalance({valid:false});assert.equal(compareTeamBalance(x,x)[0].delta,null);});
