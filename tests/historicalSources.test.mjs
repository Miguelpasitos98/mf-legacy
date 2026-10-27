import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {advancedTotals} from '../src/utils/statsAdvanced.js';
const moduleFrom=async(path,replace)=>import('data:text/javascript;base64,'+Buffer.from(readFileSync(new URL(path,import.meta.url),'utf8').replace(replace,'const createClientFromRequest=()=>({});')).toString('base64'));
const {valuationPlan,reviewedCurrentTeamLink}=await moduleFrom('../base44/functions/import-review/entry.js','import {createClientFromRequest} from "npm:@base44/sdk";');
const {pendingSources}=await moduleFrom('../base44/functions/import-control/entry.js','import { createClientFromRequest } from "npm:@base44/sdk";');
const {provenanceRecord}=await moduleFrom('../base44/functions/import-worker/entry.js','import { createClientFromRequest } from "npm:@base44/sdk";');
const fifa={kind:'overall',season:'2023/2024',value:84,fifa_edition:'FC 24',fifa_fc_position:'CB',evidence_url:'https://sofifa.com/player/232363/test/240002',provenance:{provider:'sofifa_archive',player_id:'232363',revision:'240002',revision_date:'2023-09-22',release_date:'2023-09-29',rating_kind:'launch_base',mode:'career'}};
test('reviewed current club link requires membership, exact club and compatible external ID',()=>{
 const player={team_id:'madrid'},team={id:'madrid',name:'Real Madrid CF'},item={team_name:'Real Madrid',fotmob_team_id:'8633',is_national_team:false};
 assert.deepEqual(reviewedCurrentTeamLink(player,team,item),{team_id:'madrid'});
 assert.deepEqual(reviewedCurrentTeamLink(player,team,{...item,team_name:'Inter'}),{});
 assert.deepEqual(reviewedCurrentTeamLink(player,{...team,fotmob_id:999},item),{});
 assert.deepEqual(reviewedCurrentTeamLink({team_id:'other'},team,item),{});
 assert.deepEqual(reviewedCurrentTeamLink(player,team,{...item,is_national_team:true}),{});
});
test('historical FIFA plan preserves edition, revision and exact primary position',()=>{
 const p=valuationPlan(fifa);assert.equal(p.operation,'create');assert.equal(p.record.fifa_source_date,'2023-09-22');assert.equal(p.record.fifa_source_revision,'240002');assert.equal(p.record.fifa_fc_position,'CB');
 assert.throws(()=>valuationPlan({...fifa,fifa_edition:'FC 25'}),/edición/);
 assert.throws(()=>valuationPlan({...fifa,provenance:{...fifa.provenance,rating_kind:'historical_update'}}),/lanzamiento/);
 assert.throws(()=>valuationPlan({...fifa,provenance:{...fifa.provenance,revision_date:'2023-10-01'}}),/posterior/);
});
test('existing manual Overall, position, market date and corrections are never replaced',()=>{
 assert.throws(()=>valuationPlan(fifa,{fifa_fc_overall:85}),/sobrescribe/);
 assert.throws(()=>valuationPlan(fifa,{fifa_fc_position:'CDM'}),/posición/);
 const p=valuationPlan(fifa,{id:'v',fifa_fc_overall:84,fifa_fc_position:'CB',historical_position_override:'CDM',notes:'manual'});
 assert.equal(p.operation,'update');assert.equal(p.record.fifa_fc_overall,undefined);assert.equal(p.record.historical_position_override,undefined);assert.equal(p.record.notes,undefined);
});
test('market plan rejects wrong dates/transfer values and keeps dated EUR zero',()=>{
 const value={kind:'market_value',season:'2023/2024',value:0,as_of_date:'2024-02-29',evidence_url:'https://www.transfermarkt.com/test/marktwertverlauf/spieler/1',provenance:{value_kind:'market_value',player_id:'1',selection_rule:'latest_dated_value_within_Jul01_Jun30'}};
 assert.equal(valuationPlan(value).record.transfermarkt_value_eur,0);
 assert.throws(()=>valuationPlan({...value,as_of_date:'2024-02-30'}),/fecha/);
 assert.throws(()=>valuationPlan({...value,as_of_date:'2024-07-01'}),/fecha/);
 assert.throws(()=>valuationPlan({...value,provenance:{value_kind:'transfer_fee'}}),/mercado/);
 assert.throws(()=>valuationPlan(value,{transfermarkt_value_eur:0,market_value_as_of:'2024-01-01'}),/fecha/);
});
test('Understat totals use their own clock and explicit per90 is never divided again',()=>{
 const row={season:'2023/2024',minutes:1623,metrics:[{name:'xG Chain',value:9.250628160312772,per90:0.5161540821005266,source:'understat'},{name:'xG Buildup',value:9.250628160312772,per90:0.5161540821005266,source:'understat'},{name:'Understat minutes',value:1613}]};
 const a=advancedTotals([row]);assert.equal(a.xg_chain_p90,0.5161540821005266);assert.equal(a.xg_buildup_p90,a.xg_chain_p90);
 const rate=advancedTotals([{minutes:900,metrics:[{name:'xG Chain',per90:0.8}]}]);assert.equal(rate.xg_chain_p90,0.8);
 const partial=advancedTotals([{metrics:[{name:'xG Chain',per90:0.8}]},{metrics:[]}]);assert.equal(partial.xg_chain_p90,null);
});
test('retry selects pending sources and never re-requests resolved or outside coverage',()=>{
 const job={sources:['fotmob','understat','fifa','market'],source_results:{fotmob:{status:'complete'},understat:{status:'unavailable',diagnostics:[{status:'fuera_cobertura'}]},fifa:{status:'partial'},market:{status:'error'}}};
 assert.deepEqual(pendingSources(job),['fifa','market']);
});
test('candidate provenance is bounded and retains the denominator without secrets',()=>{
 const p=provenanceRecord({...fifa.provenance,provider_minutes:1613,token:'not-stored'});
 assert.equal(p.provider_minutes,1613);assert.equal(p.token,undefined);assert.throws(()=>provenanceRecord({extra:'x'.repeat(5000)}));
});
