import test from 'node:test';
import assert from 'node:assert/strict';
import {buildHistoricalObservations} from '../src/utils/historicalPeers.js';
import {createHistoricalPeerDataset} from '../src/utils/historicalPeerCache.js';
const id='6ace0e4a3bf1efbf9edd0bb6';
const player={id,name:'Kevin De Bruyne',position:'CAM'};
const understat=(name,value)=>({name,value,source:'understat',unit:'total'});
const fotmob=(name,value)=>({name,value,source:'fotmob',unit:'total'});
const row=(metrics)=>({id:'kdb-2017',player_id:id,player_name:'Kevin De Bruyne',season:'2017/2018',competition:'Premier League',team_name:'Manchester City',fotmob_team_id:'8456',is_national_team:false,minutes:3103,appearances:37,metrics});
const read=stats=>buildHistoricalObservations({players:[player],stats})[0].values;
test('De Bruyne 17/18: xA y npxG Understat se leen en Composite con sus minutos propios',()=>{
 const vals=read([row([understat('Understat minutes',3103),understat('Understat xA',13.101718165911734),understat('Understat npxG',5.40172931086272)])]);
 assert.ok(Math.abs(vals.xa_p90-13.101718165911734*90/3103)<1e-10);
 assert.ok(Math.abs(vals.npxg_p90-5.40172931086272*90/3103)<1e-10);
});
test('Las métricas FotMob nativas prevalecen sobre el fallback Understat, incluso valor cero',()=>{
 const vals=read([row([understat('Understat minutes',3103),understat('Understat xA',13),understat('Understat npxG',5),understat('Understat xG',9),
  fotmob('FotMob minutes',3083),fotmob('xA',0),fotmob('Non-penalty xG',3),fotmob('xG',7)])]);
 assert.equal(vals.xa_p90,0);
 assert.ok(Math.abs(vals.npxg_p90-3*90/3083)<1e-10);
 assert.ok(Math.abs(vals.xg_p90-7*90/3083)<1e-10);
});
test('Indicadores de FotMob 17/18 usan los minutos FotMob, aunque existan minutos Understat distintos',()=>{
 const vals=read([row([understat('Understat minutes',3103),understat('Understat xA',13),
  fotmob('FotMob minutes',3083),fotmob('Big chances created',19),fotmob('Possession won final 3rd',34),fotmob('Dribbles',63)])]);
 assert.ok(Math.abs(vals.big_chances_created_p90-19*90/3083)<1e-10);
 assert.ok(Math.abs(vals.possession_won_final_3rd_p90-34*90/3083)<1e-10);
 assert.ok(Math.abs(vals.successful_dribbles_p90-63*90/3083)<1e-10);
 assert.ok(Math.abs(vals.xa_p90-13*90/3103)<1e-10);
});
test('Dataset Composite se reconstruye con los nombres de fuente nuevos sin editar los registros',()=>{
 const dataset=createHistoricalPeerDataset({Player:[player],PlayerSeasonStats:[row([understat('Understat minutes',3103),understat('Understat xA',13),understat('Understat npxG',5)])]});
 assert.ok(dataset.observations[0].values.xa_p90>0);
 assert.ok(dataset.observations[0].values.npxg_p90>0);
});
