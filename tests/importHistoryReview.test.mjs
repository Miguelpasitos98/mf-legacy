import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {importLandingView} from '../src/utils/importHistoryReview.js';
const source=readFileSync(new URL('../base44/functions/import-review/entry.js',import.meta.url),'utf8').replace('import {createClientFromRequest} from "npm:@base44/sdk";','const createClientFromRequest=()=>globalThis.__historyClient;').replace('console.error("import-review",e);','');
const {default:review,historyPlan,historyValueRows}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const jid='a'.repeat(24),pid='b'.repeat(24),cid='c'.repeat(24);
const item={id:cid,job_id:jid,player_id:pid,fotmob_player_id:'309328',kind:'metric',source:'understat',season:'2023/2024',competition:'Ligue 1',fotmob_team_id:'9847',team_name:'Paris Saint-Germain',fotmob_tournament_id:'53',is_national_team:false,metric_name:'xG Chain',metric_unit:'per90',value:.5161540821,verification_status:'verified',review_status:'pending',evidence_url:'https://understat.com/player/1223'};
const player={id:pid,name:'Milan Škriniar'};
test('return from an import reveals saved records without retaining incompatible filters',()=>{
 const saved={season:'2015/2016',minMinutes:1800,positionFilter:'GK',viewMode:'competition',search:'another',scrollTop:500};
 const view=importLandingView(saved,new URLSearchParams('stats_player=309328&import_batch=receipt'));
 assert.equal(view.season,'Todas');assert.equal(view.minMinutes,0);assert.equal(view.positionFilter,'Todas');assert.equal(view.search,'309328');assert.equal(view.viewMode,'season');
 assert.equal(saved.season,'2015/2016');assert.strictEqual(importLandingView(saved),saved);
});
const fifa={...item,id:'d'.repeat(24),source:'fifa',kind:'overall',metric_name:'',value:84,fifa_edition:'FC 24',fifa_fc_position:'CB'};
const market={...item,id:'e'.repeat(24),source:'market',kind:'market_value',metric_name:'',value:30000000,as_of_date:'2024-06-03'};
const clone=x=>structuredClone(x);
function matches(row,query={}){
 return Object.entries(query).every(([key,expected])=>{
  if(key==='$or')return expected.some(q=>matches(row,q));
  const actual=key.split('.').reduce((v,k)=>v?.[k],row);
  if(expected&&typeof expected==='object'&&!Array.isArray(expected))return Object.entries(expected).every(([op,value])=>op==='$in'?value.includes(actual):op==='$lt'?actual<value:op==='$exists'?(actual!==undefined)===value:false);
  return actual===expected;
 });
}
function fixture(candidates=[item],stats=[],valuations=[]){
 let counter=100,tick=0;
 const data={Player:[clone(player)],ImportJob:[{id:jid,player_id:pid,fotmob_player_id:'309328',status:'review'}],ImportCandidate:clone(candidates),PlayerSeasonStats:clone(stats),PlayerHistoricalValuation:clone(valuations),PlayerFotmobLink:[{id:'link',player_id:pid,fotmob_player_id:'309328',verification:'manual'}],Team:[],NationalTeam:[],ImportReviewBatch:[],ImportReviewPlanChunk:[]};
 const writes=[],hooks={};
 const db=Object.fromEntries(Object.keys(data).map(name=>[name,{
  filter:async(query,_sort,limit=100,skip=0)=>clone(data[name].filter(r=>matches(r,query)).slice(skip,skip+limit)),
  get:async id=>clone(data[name].find(r=>r.id===id)),
  bulkCreate:async records=>{const saved=[];for(const r of records)saved.push(await db[name].create(r));return saved;},
  create:async record=>{
   const saved={...clone(record),id:(counter++).toString(16).padStart(24,'0'),updated_date:'v'+(++tick)};data[name].push(saved);writes.push({name,op:'create',id:saved.id});
   if(hooks.create)await hooks.create(name,saved);return clone(saved);
  },
  update:async(id,patch)=>{
   const saved=data[name].find(r=>r.id===id);assert.ok(saved);Object.assign(saved,clone(patch),{updated_date:'v'+(++tick)});writes.push({name,op:'update',id});return clone(saved);
  },
  updateMany:async(query,update)=>{
   if(hooks.updateMany)await hooks.updateMany(name,query,update);
   const selected=data[name].filter(r=>matches(r,query));for(const saved of selected){Object.assign(saved,clone(update.$set),{updated_date:'v'+(++tick)});writes.push({name,op:'updateMany',id:saved.id});}return {updated:selected.length};
  }
 }]));
 globalThis.__historyClient={auth:{me:async()=>({id:'admin',role:'admin'})},asServiceRole:{entities:db}};
 const call=async(action,payload={})=>{const response=await review(new Request('https://example.test/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,job_id:jid,...payload})}));return {status:response.status,...await response.json()};};
 return {data,writes,hooks,call};
}
const plan=async f=>{const p=await f.call('history-preview');assert.equal(p.ok,true);return p;};
const approve=(f,p,keys=p.units.filter(u=>u.selectable).map(u=>u.key))=>f.call('history-approve',{confirmed:true,plan_token:p.plan_token,keys});
const savedUnits=f=>JSON.parse(f.data.ImportReviewPlanChunk.slice().sort((a,b)=>a.chunk_index-b.chunk_index).map(c=>c.chunk_json).join(''));

test('one valuation unit combines Overall and market without duplicate destinations',()=>{
 const units=historyPlan([fifa,market],player,[],[]);assert.equal(units.length,1);assert.equal(units[0].record.fifa_fc_overall,84);assert.equal(units[0].record.transfermarkt_value_eur,30000000);
});
test('manual conflicts, ambiguous rows and unverified sources cannot be batch selected',()=>{
 assert.equal(historyPlan([{...item,verification_status:'unverified'}],player,[],[])[0].selectable,false);
 const before={...item,id:'stats',metrics:[{name:'xG Chain',per90:.9,source:'manual'}]};
 assert.equal(historyPlan([item],player,[before],[])[0].action,'conflict');
 assert.equal(historyPlan([item],player,[before,{...before,id:'duplicate'}],[])[0].action,'conflict');
});
test('a source rate cannot replace the calculation implied by a manually corrected total',()=>{
 const old={...item,id:'stats',metrics:[{name:'xG Chain',value:18.5,per90:null},{name:'Understat minutes',value:1800}],manual_metric_history:[{metric_name:'xG Chain',new_value:18.5}]};
 const units=historyPlan([item],player,[old],[]);assert.equal(units[0].action,'conflict');assert.equal(units[0].selectable,false);assert.equal(old.metrics[0].per90,null);
});
test('unverified data remain pending when verified fields of the same destination are imported',async()=>{
 const unknown={...item,id:'f'.repeat(24),metric_name:'Goals',source:'fotmob',value:0,verification_status:'unverified'};
 const f=fixture([item,unknown]),p=await plan(f);assert.equal(p.units[0].unverified_count,1);assert.deepEqual(p.units[0].candidate_ids,[item.id]);
 const result=await approve(f,p);assert.equal(result.batch.counts.values,1);assert.equal(f.data.ImportCandidate.find(c=>c.id===unknown.id).review_status,'pending');assert.equal(f.data.ImportJob[0].status,'review');
});
test('review lists existing and new values, including already applied entries',()=>{
 const units=historyPlan([{...item,review_status:'applied'}],player,[{...item,metrics:[{name:'xG Chain',per90:item.value}]}],[]);
 const rows=historyValueRows(units[0]);assert.equal(rows[0].existing,item.value);assert.equal(rows[0].new_value,null);assert.equal(rows[0].action,'Conservar');
});
test('history preview is read-only; authorization and fresh proposal are mandatory',async()=>{
 const f=fixture(),p=await plan(f);assert.equal(f.writes.length,0);
 assert.equal((await f.call('history-approve',{plan_token:p.plan_token,keys:[p.units[0].key]})).status,409);
 assert.equal((await f.call('history-approve',{confirmed:true,plan_token:'stale',keys:[p.units[0].key]})).status,409);
 assert.equal(f.data.PlayerSeasonStats.length,0);
});
test('joint review creates, verifies persistence and repeating the same batch changes nothing',async()=>{
 const f=fixture([fifa,market]);const result=await approve(f,await plan(f));assert.equal(result.batch.status,'completed');assert.equal(result.batch.counts.created,1);assert.equal(f.data.PlayerHistoricalValuation.length,1);
 assert.equal(savedUnits(f)[0].before,null);
 const before=clone(f.data),again=await f.call('history-approve',{confirmed:true,batch_id:result.batch.id});assert.equal(again.batch.counts.created,1);assert.deepEqual(f.data,before);
});
test('long review saves its cursor and resumes only remaining destinations',async()=>{
 const candidates=Array.from({length:5},(_,i)=>({...item,id:String(i+1).padStart(24,'0'),season:`${2014+i}/${2015+i}`}));
 const f=fixture(candidates),first=await approve(f,await plan(f));assert.equal(first.batch.cursor,3);assert.equal(first.batch.status,'running');assert.equal(f.data.PlayerSeasonStats.length,3);
 const second=await f.call('history-approve',{confirmed:true,batch_id:first.batch.id});assert.equal(second.batch.status,'completed');assert.equal(f.data.PlayerSeasonStats.length,5);assert.equal(second.batch.counts.values,5);
});
test('lost response after a successful create is reconciled without duplicate writes',async()=>{
 const f=fixture();let once=true;
 f.hooks.create=(name)=>{if(name==='PlayerSeasonStats'&&once){once=false;throw Error('Response lost after persistence');}};
 const first=await approve(f,await plan(f));assert.equal(first.batch.status,'partial');assert.equal(f.data.PlayerSeasonStats.length,1);
 const resumed=await f.call('history-approve',{confirmed:true,batch_id:first.batch.id});assert.equal(resumed.batch.status,'completed');assert.equal(f.data.PlayerSeasonStats.length,1);assert.equal(f.writes.filter(w=>w.name==='PlayerSeasonStats'&&w.op==='create').length,1);
});
test('a concurrent manual correction prevents overwrite during a conditional update',async()=>{
 const old={id:'stats',player_id:pid,season:item.season,competition:item.competition,fotmob_team_id:item.fotmob_team_id,fotmob_tournament_id:'53',updated_date:'old',metrics:[],manual_metric_history:[{note:'preserve'}]};
 const f=fixture([item],[old]);let once=true;
 f.hooks.updateMany=name=>{if(name==='PlayerSeasonStats'&&once){once=false;f.data.PlayerSeasonStats[0].metrics=[{name:'xG Chain',per90:.99,source:'manual'}];f.data.PlayerSeasonStats[0].updated_date='manual';}};
 const first=await approve(f,await plan(f));assert.equal(first.batch.status,'partial');assert.equal(f.data.PlayerSeasonStats[0].metrics[0].per90,.99);
 const resumed=await f.call('history-approve',{confirmed:true,batch_id:first.batch.id});assert.equal(resumed.batch.counts.conflicts,1);assert.equal(f.data.ImportCandidate[0].review_status,'pending');assert.deepEqual(f.data.PlayerSeasonStats[0].manual_metric_history,old.manual_metric_history);
});
test('changed source values or FotMob identities cannot be silently resumed',async()=>{
 const candidates=Array.from({length:4},(_,i)=>({...item,id:String(i+1).padStart(24,'0'),season:`${2014+i}/${2015+i}`}));
 const f=fixture(candidates),first=await approve(f,await plan(f));
 const remainingKey=savedUnits(f)[3].candidate_ids[0];f.data.ImportCandidate.find(c=>c.id===remainingKey).value=7;
 const changed=await f.call('history-approve',{confirmed:true,batch_id:first.batch.id});assert.equal(changed.batch.status,'partial');assert.equal(f.data.PlayerSeasonStats.length,3);
 f.data.PlayerFotmobLink[0].fotmob_player_id='wrong';assert.equal((await f.call('history-approve',{confirmed:true,batch_id:first.batch.id})).ok,false);assert.equal(f.data.PlayerSeasonStats.length,3);
});
test('unchanged verified values close candidates without rewriting the sporting record',async()=>{
 const old={id:'stats',player_id:pid,season:item.season,competition:item.competition,fotmob_team_id:item.fotmob_team_id,fotmob_tournament_id:'53',updated_date:'old',metrics:[{name:'xG Chain',per90:item.value,source:'manual'}]};
 const f=fixture([item],[old]),result=await approve(f,await plan(f));assert.equal(result.batch.counts.omitted,1);assert.deepEqual(f.data.PlayerSeasonStats[0],old);assert.equal(f.data.ImportCandidate[0].review_status,'applied');
});

test('large proposals use bounded fragments and resume an interrupted plan upload',async()=>{
 const old={id:'stats',player_id:pid,season:item.season,competition:item.competition,fotmob_team_id:item.fotmob_team_id,fotmob_tournament_id:'53',updated_date:'old',metrics:[],notes:'preserved '.repeat(8000)};
 const f=fixture([item],[old]);let once=true;
 f.hooks.create=name=>{if(name==='ImportReviewPlanChunk'&&once){once=false;throw Error('Connection lost while uploading proposal');}};
 const first=await approve(f,await plan(f));assert.equal(first.batch.status,'partial');assert.deepEqual(f.data.PlayerSeasonStats[0],old);
 assert.equal(f.data.ImportReviewPlanChunk.length,1);
 assert.ok(f.data.ImportReviewBatch[0].plan_json.length<12000);assert.ok(f.data.ImportReviewPlanChunk.every(c=>c.chunk_json.length<=12000));
 const resumed=await f.call('history-approve',{confirmed:true,batch_id:first.batch.id});assert.equal(resumed.batch.status,'completed');assert.equal(f.data.PlayerSeasonStats[0].notes,old.notes);assert.equal(f.data.PlayerSeasonStats[0].metrics[0].per90,item.value);
});

test('fragment corruption prevents sporting writes before resumption',async()=>{
 const candidates=Array.from({length:4},(_,i)=>({...item,id:String(i+1).padStart(24,'0'),season:`${2014+i}/${2015+i}`,provenance:{provider:'archive',identity_rule:'evidence '.repeat(900)}}));
 const f=fixture(candidates),first=await approve(f,await plan(f));assert.equal(first.batch.status,'running');
 f.data.ImportReviewPlanChunk[0].chunk_json+='changed';
 const resumed=await f.call('history-approve',{confirmed:true,batch_id:first.batch.id});assert.equal(resumed.batch.status,'partial');assert.equal(f.data.PlayerSeasonStats.length,3);
});
