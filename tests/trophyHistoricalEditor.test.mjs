import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeHistoricalSeason,findHistoricalDuplicate,proposedHistoricalEditionKey,buildHistoricalEditionPayload,historicalEventDefaults,buildHistoricalEventPayload} from '../src/utils/trophyHistoricalForms.js';

const trophy={id:'local-trophy-id',source_id:'1301394',name:'UEFA Champions League'};
const teams=[{id:'RM',name:'Real Madrid CF'},{id:'MC',name:'Manchester City FC'},{id:'IN',name:'Inter Milan'}];
const countries=[{id:'TR',name:'Turquía'},{id:'ES',name:'España'}];
const sample={
 id:'historical-final-id',edition_key:'rob_fm24_ucl_2022_23',
 season:'2022/23',champion_name:'Manchester City',champion_team_id:'MC',champion_raw:'Man City',
 runner_up_name:'Inter de Milán',runner_up_team_id:'IN',runner_up_raw:'Inter',
 stadium_name:'Estadio Olímpico Atatürk',city:'Estambul',country:'Turquía',
 source_dataset:'Rob FM24 screenshots',evidence_type:'screenshot',verification_status:'source_extracted',
 is_officially_verified:false
};

test('Historical season validation supports year rollovers and normalizes long season form',()=>{
 assert.equal(normalizeHistoricalSeason('1999/00'),'1999/00');
 assert.equal(normalizeHistoricalSeason('1999/2000'),'1999/00');
 assert.equal(normalizeHistoricalSeason('2023/2024'),'2023/24');
 assert.equal(normalizeHistoricalSeason('1955/56'),'1955/56');
 assert.equal(normalizeHistoricalSeason('2023/25'),null);
 assert.equal(normalizeHistoricalSeason('foo'),null);
});

test('Historical edition payload preserves raw source, winner/runner, venue and linked existing Teams',()=>{
 const result=buildHistoricalEditionPayload({draft:sample,trophy,teams,countries});
 assert.equal(result.edition_key,'rob_fm24_ucl_2022_23');
 assert.equal(result.champion_raw,'Man City');
 assert.equal(result.champion_name,'Manchester City');
 assert.equal(result.champion_team_id,'MC');
 assert.equal(result.runner_up_name,'Inter de Milán');
 assert.equal(result.runner_up_team_id,'IN');
 assert.equal(result.stadium_name,'Estadio Olímpico Atatürk');
 assert.equal(result.city,'Estambul');
 assert.equal(result.country_id,'TR');
 assert.equal(result.edition_year,2023);
 assert.equal(result.verification_status,'source_extracted');
 assert.equal(result.is_officially_verified,false);
});

test('New finals cannot self-verify or accidentally create TrophyHonour',()=>{
 const draft={...sample,id:undefined,edition_key:undefined,season:'2023/24',champion_name:'Real Madrid',runner_up_name:'Borussia Dortmund',verification_status:'externally_verified',is_officially_verified:true};
 const result=buildHistoricalEditionPayload({draft,trophy,teams,countries});
 assert.equal(result.edition_key,proposedHistoricalEditionKey('1301394','2023/24'));
 assert.equal(result.is_officially_verified,false);
 assert.equal(result.verification_status,'needs_review');
 assert.equal(result.season,'2023/24');
 const file=readFileSync(new URL('../src/components/trophies/TrophyHistoricalEditor.jsx',import.meta.url),'utf8');
 assert.match(file,/base44\.entities\.TrophyEdition\.create/);
 assert.doesNotMatch(file,/base44\.entities\.TrophyHonour\.(create|update|delete)/);
});

test('Edition collision detection prevents duplicate seasons regardless of input notation',()=>{
 assert.equal(findHistoricalDuplicate([sample],'2022/23')?.id,sample.id);
 assert.equal(findHistoricalDuplicate([sample],'2022/23',sample.id),null);
 assert.equal(findHistoricalDuplicate([{...sample,season:'2023/2024'}],'2023/24')?.id,sample.id);
 assert.throws(()=>buildHistoricalEditionPayload({draft:{...sample,champion_name:'Inter',runner_up_name:'Inter'},trophy,teams,countries}),/distintos/);
});

test('Historical narratives remain distinct from finals and preserve original English text',()=>{
 const event={...historicalEventDefaults(trophy),season:'1987/88',description_es:'Tras Heysel...',original_text:'The first three seasons after Heysel...',event_type:'historical_context'};
 const record=buildHistoricalEventPayload({draft:event,trophy});
 assert.equal(record.season,'1987/88');
 assert.equal(record.original_text,event.original_text);
 assert.equal(record.is_cancellation,false);
 assert.equal(record.verification_status,'needs_review');
});

test('Trophies Edit exposes final, narrative and verifiable honours editors side by side',()=>{
 const page=readFileSync(new URL('../src/pages/Trophies.jsx',import.meta.url),'utf8');
 const editor=readFileSync(new URL('../src/components/trophies/TrophyHistoricalEditor.jsx',import.meta.url),'utf8');
 assert.match(page,/TrophyHistoricalEditor/);
 assert.match(page,/Finales e historia/);
 assert.match(page,/Palmarés verificable/);
 assert.match(page,/editorPane==="historical"/);
 assert.match(page,/setEditorPane\("honours"\)/);
 assert.match(editor,/Campeón/);
 assert.match(editor,/Subcampeón/);
 assert.match(editor,/Sede de la final/);
 assert.match(editor,/Resultado de la final/);
 assert.match(editor,/Descripción en español/);
 assert.match(editor,/Texto original de Rob/);
 assert.match(editor,/base44\.entities\.TrophyEdition\.update/);
 assert.match(editor,/base44\.entities\.TrophyHistoricalEvent\.update/);
});
