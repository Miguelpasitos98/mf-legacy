import test from 'node:test';
import assert from 'node:assert/strict';
import {indicatorHistoricalRanking} from '../src/utils/indicatorHistoricalRanking.js';
const o=(playerId,season,role,value)=>({playerId,playerName:playerId,season,role,values:{x:value}});
test('ranking por arquetipo y temporada, empates comparten puesto',()=>{
 const result=indicatorHistoricalRanking([o('a','2022/2023','CB',5),o('b','2023/2024','CB',5),o('c','2020/2021','CB',2),o('d','2025/2026','ST',100)],'CB','x');
 assert.deepEqual(result.map(r=>r.rank),[1,1,3]);assert.equal(result.length,3);
 assert.equal(result[0].n,3);assert.equal(result[2].percentile,0);
});
test('indicador penalizado ordena menor valor primero y excluye ausentes',()=>{
 const result=indicatorHistoricalRanking([o('a','2024/2025','CB',9),o('b','2022/2023','CB',1),o('c','2023/2024','CB',null)],'CB','x',true);
 assert.deepEqual(result.map(r=>r.playerId),['b','a']);
 assert.deepEqual(result.map(r=>r.rank),[1,2]);
});
