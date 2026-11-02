import test from 'node:test';
import assert from 'node:assert/strict';
import {normalized,readArchive,deriveRates,LAST_COMPLETE_SEASON_START} from '../base44/functions/understat-auto/core.mjs';
const header='id,player_name,season,team_title,league,time,xGChain,xGBuildup';
const csv=[header,
 '2517,Martin Odegaard,2019/20,Real Sociedad,La_Liga,2545,11.995471032336354,8.068087588995695',
 '2517,Martin Odegaard,2020/21,Real Madrid,La_Liga,230,0.6706940084695816,0.1682616025209427',
 '2517,Martin Odegaard,2020/21,Arsenal,EPL,865,5.297232031822205,4.07069668546319',
 '2517,Martin Odegaard,2021/22,Arsenal,EPL,2803,18.23505182750523,10.91330983582884',
 '2517,Martin Odegaard,2025/26,Arsenal,EPL,163,0.2879353500902653,0.1889845728874206'
].join('\n');
const stats=[
 {season:'2019/2020',team_name:'Real Sociedad',competition:'LaLiga'},
 {season:'2020/2021',team_name:'Real Madrid',competition:'LaLiga'},
 {season:'2020/2021',team_name:'Arsenal',competition:'Premier League'},
 {season:'2021/2022',team_name:'Arsenal',competition:'Premier League'},
 {season:'2025/2026',team_name:'Arsenal',competition:'Premier League'},
];
test('Transliteración estricta de jugadores sin perder identidad',()=>{
 assert.equal(normalized('Martin Ødegaard'),normalized('Martin Odegaard'));
 assert.equal(normalized('Alexander Sørloth'),normalized('Alexander Sorloth'));
 assert.equal(normalized('Łukasz Fabiański'),normalized('Lukasz Fabianski'));
 assert.notEqual(normalized('Martin Odegaard'),normalized('Martin Odegaarden'));
});
test('Los valores /90 se ponderan por minutos Understat en temporadas con dos clubes',()=>{
 const r=deriveRates(readArchive(csv,'Martin Ødegaard'),stats);
 assert.equal(r.status,'verified');assert.equal(r.understat_id,'2517');
 const season=r.rates.find(x=>x.season==='2020/2021');
 assert.equal(season.minutes,1095);assert.equal(season.team_count,2);
 assert.ok(Math.abs(season.xg_chain_p90-(5.297232031822205+0.6706940084695816)*90/1095)<1e-12);
 assert.ok(Math.abs(season.xg_buildup_p90-(4.07069668546319+0.1682616025209427)*90/1095)<1e-12);
 assert.equal(r.rates.some(x=>x.season==='2025/2026'),false);
 assert.equal(LAST_COMPLETE_SEASON_START,2024);
 assert.equal(r.skipped.find(x=>x.season==='2025/2026')?.season,'2025/2026');
});
test('No completa una temporada con un club ausente en la base de FotMob',()=>{
 const partial=stats.filter(x=>x.team_name!=='Real Madrid');
 const r=deriveRates(readArchive(csv,'Martin Ødegaard'),partial);
 assert.equal(r.status,'verified');assert.equal(r.rates.some(x=>x.season==='2020/2021'),false);
});
test('No acredita homónimos, una sola coincidencia ni minutos o fuentes inconsistentes',()=>{
 const onlyOne=deriveRates(readArchive(csv,'Martin Ødegaard'),stats.slice(0,1));
 assert.equal(onlyOne.status,'insufficient_identity');
 const dup=[csv,'333,Martin Odegaard,2019/20,Real Sociedad,La_Liga,2545,1,0',
 '333,Martin Odegaard,2021/22,Arsenal,EPL,2803,1,0'].join('\n');
 assert.equal(deriveRates(readArchive(dup,'Martin Ødegaard'),stats).status,'ambiguous_identity');
 const corrupt=csv.replace('2545,11.995471032336354,8.068087588995695','2545,3,8');
 const r=deriveRates(readArchive(corrupt,'Martin Ødegaard'),stats);
 assert.equal(r.rates.some(x=>x.season==='2019/2020'),false);
});
test('Sin filas de Holanda no se crean temporadas no cubiertas',()=>{
 const r=deriveRates(readArchive(csv,'Martin Ødegaard'),[...stats,
 {season:'2018/2019',team_name:'Vitesse',competition:'Eredivisie'}]);
 assert.equal(r.rates.some(x=>x.season==='2018/2019'),false);
});
