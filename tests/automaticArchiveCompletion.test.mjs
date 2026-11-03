import test from 'node:test';
import assert from 'node:assert/strict';
import {planArchiveAdditions,runHistoricalArchiveBackfill} from '../base44/functions/import-worker/understatArchiveBackfill.js';
import {readArchive,deriveStatsBackfill} from '../base44/functions/import-worker/understatArchiveCore.mjs';

const rows=[
 'id,player_name,season,team_title,league,time,xGChain,xGBuildup,goals,assists,xG,xA,npxG,shots',
 '447,Kevin De Bruyne,2017/18,Manchester City,EPL,3103,45,15,8,16,9.1,15,8.9,85',
 '447,Kevin De Bruyne,2019/20,Manchester City,EPL,2818,46,16,13,20,10,18,9.7,90',
 '447,Kevin De Bruyne,2025/26,Napoli,Serie_A,150,2,1,1,1,0.9,0.3,0.7,6'
].join('\n');
const stats=[
 {id:'s1',player_id:'owner',season:'2017/2018',team_name:'Manchester City',competition:'Premier League',is_national_team:false,metrics:[]},
 {id:'s2',player_id:'owner',season:'2019/2020',team_name:'Manchester City',competition:'Premier League',is_national_team:false,metrics:[]},
 {id:'s3',player_id:'owner',season:'2019/2020',team_name:'Manchester City',competition:'Champions League',is_national_team:false,metrics:[]}
];
test('La recuperación automática verifica identidad, temporada y competición y no crea filas sin contraste',()=>{
 const plan=deriveStatsBackfill(readArchive(rows,'Kevin De Bruyne'),stats);
 assert.equal(plan.status,'verified');assert.equal(plan.understat_id,'447');
 assert.deepEqual(plan.entries.map(x=>x.id),['s1','s2']);
 assert.equal(plan.entries[1].metrics.find(x=>x.name==='Understat Assists').value,20);
 assert.equal(plan.entries.some(x=>x.competition==='Champions League'),false);
 assert.equal(plan.entries.some(x=>x.season==='2025/2026'),false);
});
test('Los valores FotMob ganan incluso cuando son cero; solo añade métricas ausentes',()=>{
 const proposal=deriveStatsBackfill(readArchive(rows,'Kevin De Bruyne'),stats).entries[1].metrics;
 const old=[{name:'Goals',value:0,source:'fotmob'},{name:'xG',value:8.4,source:'fotmob'},
  {name:'Understat Assists',value:20,source:'understat'}];
 const plan=planArchiveAdditions(old,proposal);
 assert.equal(plan.conflicts,0);
 assert.equal(plan.additions.some(x=>x.name==='Understat Goals'),false);
 assert.equal(plan.additions.some(x=>x.name==='Understat xG'),false);
 assert.equal(plan.additions.some(x=>x.name==='Understat Assists'),false);
 assert.equal(plan.additions.some(x=>x.name==='Understat xA'),true);
 assert.equal(plan.additions.some(x=>x.name==='Understat npxG'),true);
 const rerun=planArchiveAdditions([...old,...plan.additions],proposal);
 assert.equal(rerun.additions.length,0);
});
test('Identidad FotMob no confirmada cancela recuperación sin descargas ni escrituras',async()=>{
 let called=0;
 const db={
  Player:{get:async()=>({name:'Kevin De Bruyne'})},
  PlayerFotmobLink:{filter:async()=>[{fotmob_player_id:'wrong',verification:'manual'}]},
  PlayerSeasonStats:{filter:async()=>[{...stats[0],fotmob_player_id:'169200'}],
   update:async()=>{called++}}
 };
 const r=await runHistoricalArchiveBackfill(db,{player_id:'a'.repeat(24),fotmob_player_id:'169200'});
 assert.equal(r.status,'skipped');
 assert.equal(r.reason,'Vinculación FotMob inconsistente');
 assert.equal(called,0);
});
test('La finalización del importador invoca la recuperación histórica automática',async()=>{
 const fs=await import('node:fs');
 const code=fs.readFileSync(new URL('../base44/functions/import-worker/entry.js',import.meta.url),'utf8');
 assert.match(code,/runHistoricalArchiveBackfill\(db,job\)/);
 assert.match(code,/source_results:\{\.\.\.\(previous.source_results\|\|source_results\),understat_archive:/);
});
