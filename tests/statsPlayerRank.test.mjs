import test from "node:test";
import assert from "node:assert/strict";
import {rankIdentity,rankPositions,playerRankPositions} from "../src/utils/statsRank.js";
const item=(player,season)=>({summary:{id:player+"|"+season,player_id:player,season},player:{name:player}});
test("rank por jugador reinicia con su primera temporada aunque sea cuarto global",()=>{
 const items=[item("Raphinha","2026/2027"),item("Raphinha","2024/2025"),item("Raphinha","2025/2026"),item("Marco Asensio","2025/2026"),item("Raphinha","2023/2024")];
 const own=playerRankPositions(items,"season"),general=rankPositions(items,"season");
 assert.equal(own.get(rankIdentity(items[3],"season")),1);
 assert.equal(general.get(rankIdentity(items[3],"season")),4);
 assert.deepEqual(items.map(x=>own.get(rankIdentity(x,"season"))),[1,2,3,1,4]);
});
test("rank personal sigue el orden escogido y no la paginacion",()=>{
 const items=[item("A","2025/2026"),item("B","2025/2026"),item("B","2024/2025"),item("A","2024/2025")];
 const own=playerRankPositions(items,"season");
 assert.deepEqual(items.map(x=>own.get(rankIdentity(x,"season"))),[1,1,2,2]);
});
test("rank de competicion distingue jugadores de igual nombre mediante su ID",()=>{
 const items=[{record:{id:"c1",player_id:"a"}},{record:{id:"c2",player_id:"b"}},{record:{id:"c3",player_id:"a"}}];
 const own=playerRankPositions(items,"competition");
 assert.deepEqual(items.map(x=>own.get(rankIdentity(x,"competition"))),[1,1,2]);
});
