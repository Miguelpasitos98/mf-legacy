import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const finals=JSON.parse(fs.readFileSync(new URL('../scripts/rob_ucl_1955_2023_finals.json',import.meta.url),'utf8'));
const events=JSON.parse(fs.readFileSync(new URL('../scripts/rob_ucl_historical_events.json',import.meta.url),'utf8'));
test('Rob Champions: exactly 68 consecutive final seasons from 1955/56 to 2022/23',()=>{
 assert.equal(finals.length,68);
 assert.equal(new Set(finals.map(x=>x.edition_key)).size,68);
 const expected=Array.from({length:68},(_,i)=>{const start=1955+i;return String(start)+'/'+String(start+1).slice(-2);});
 assert.deepEqual(finals.map(x=>x.season).sort(),expected);
});
test('Rob Champions: no final entry can become verified TrophyHonour by accident',()=>{
 for(const f of finals){
  assert.equal(f.trophy_source_id,'1301394');
  assert.equal(f.verification_status,'source_extracted');
  assert.equal(f.is_officially_verified,false);
  assert.ok(f.champion_name && f.runner_up_name && f.stadium_name);
  assert.equal(f.final_score,'');
  assert.ok(f.edition_key);
 }
});
test('Historical notes are distinct events, never cancelled competitions',()=>{
 assert.equal(events.length,29);
 assert.equal(new Set(events.map(x=>x.event_key)).size,28);
 for(const event of events){
  assert.equal(event.trophy_source_id,'1301394');
  assert.equal(event.verification_status,'source_extracted');
  assert.equal(event.is_cancellation,false);
  assert.ok(event.description_es);
  assert.ok(event.original_text.length>30);
 }
});
test('Trophy edition view shows Rob rows and retains a separate verified section',()=>{
 const visual=fs.readFileSync(new URL('../src/components/trophies/TrophyDetailVisual.jsx',import.meta.url),'utf8');
 const view=fs.readFileSync(new URL('../src/components/trophies/TrophyHistoricalArchive.jsx',import.meta.url),'utf8');
 assert.match(visual,/tab==="Historia"/);
 assert.match(visual,/TrophyHistoricalArchive mode="editions"/);
 assert.match(visual,/TrophyHistoricalArchive mode="events"/);
 assert.match(visual,/palmarés de MF LEGACY/);
 assert.match(visual,/TrophyEdition\.filter/);
 assert.match(visual,/TrophyHistoricalEvent\.filter/);
 assert.match(view,/Exportar CSV/);
 assert.match(view,/Rob \/ FM24 · sin contrastar externamente/);
});
