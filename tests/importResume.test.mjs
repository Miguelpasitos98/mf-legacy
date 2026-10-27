import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../base44/functions/import-control/entry.js',import.meta.url),'utf8').replace('import { createClientFromRequest } from "npm:@base44/sdk";','const createClientFromRequest=()=>globalThis.__resumeSdk;');
const {default:handler,pendingSources,pendingScopes}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const id='a'.repeat(24),jid='b'.repeat(24);
function fixture(status='failed'){
 const job={id:jid,player_id:id,player_name:'Player',fotmob_player_id:'123',status,sources:['understat'],received_candidates:31,source_results:{understat:{status:'complete'}},lease_expires_at:'2000-01-01T00:00:00Z'};
 const writes=[];const db={Player:{get:async()=>({id,name:'Player'})},PlayerFotmobLink:{filter:async()=>[{player_id:id,fotmob_player_id:'123',verification:'manual'}]},ImportJob:{get:async()=>job,filter:async()=>[job],update:async(_,patch)=>{Object.assign(job,patch);writes.push(patch);return job;},create:async()=>{throw Error('Must reuse original job');}}};
 globalThis.__resumeSdk={auth:{me:async()=>({role:'admin'})},asServiceRole:{entities:db}};
 return {job,writes,invoke:async action=>{const response=await handler(new Request('https://test',{method:'POST',body:JSON.stringify({action,job_id:jid,player_id:id})}));return {status:response.status,body:await response.json()};}};
}
test('Retry only unresolved scopes, not found or saved source data',()=>{
 const job={sources:['fotmob','fifa','understat'],source_results:{fotmob:{status:'partial',diagnostics:[{season:'2024/2025',season_id:'1-0',tournament_id:'87',status:'cache_absent'},{season:'2023/2024',status:'pending_verification'}]},fifa:{status:'partial',diagnostics:[{status:'verificado_guardado'}]},understat:{status:'complete',diagnostics:[{season:'2026/2027',status:'error_temporal'}]}}};
 assert.deepEqual(pendingSources(job),['fotmob','understat']);
 assert.deepEqual(pendingScopes(job).fotmob,[{season:'2024/2025',season_id:'1-0',tournament_id:'87',competition:''}]);
});
test('Failed and expired jobs resume same identity without resetting candidates',async()=>{
 for(const [status,action] of [['failed','retry'],['running','resume']]){
  const f=fixture(status),response=await f.invoke(action);assert.equal(response.status,200);assert.equal(response.body.job.id,jid);assert.equal(f.job.status,'queued');assert.equal(f.job.received_candidates,31);assert.equal(f.writes[0].source_results,undefined);
 }
});
test('Live lease cannot be resumed',async()=>{
 const f=fixture('running');f.job.lease_expires_at='2099-01-01T00:00:00Z';const response=await f.invoke('resume');assert.equal(response.status,409);assert.equal(f.writes.length,0);
});
test('Changed FotMob link cannot resume an old payload',async()=>{
 const f=fixture();f.job.fotmob_player_id='456';const response=await f.invoke('retry');assert.equal(response.status,409);assert.equal(f.writes.length,0);
});
