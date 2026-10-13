import test from "node:test";
import assert from "node:assert/strict";
import {sortStatsItems,nextSorting} from "../src/utils/statsSort.js";
import {initialConfig} from "../src/utils/statsColumns.js";
import {buildSeasonSummaries} from "../src/utils/statsSeason.js";

const config=initialConfig();
const r=(player,season,minutes,goals,xg)=>({
 player_id:player,player_name:player,season,competition:"LaLiga",team_name:"Barcelona",
 appearances:20,minutes,rating:minutes/1000,
 metrics:goals===null?[]:[{name:"Goals",value:goals},{name:"xG",value:xg}]
});
const seasonData=buildSeasonSummaries([r("A","2024/2025",900,3,2),r("B","2025/2026",1600,12,10),r("C","2026/2027",1500,null,0)],[])
 .map(summary=>({summary,player:{name:summary.player_name}}));

test("cabecera min ordena descendente y ascendente",()=>{
 const down=sortStatsItems(seasonData,"season","minutes","desc",config);
 const up=sortStatsItems(seasonData,"season","minutes","asc",config);
 assert.deepEqual(down.map(x=>x.summary.totals.minutes.value),[1600,1500,900]);
 assert.deepEqual(up.map(x=>x.summary.totals.minutes.value),[900,1500,1600]);
});
test("al ordenar por goles no trata los ausentes como cero y quedan al final",()=>{
 const down=sortStatsItems(seasonData,"season","goals","desc",config);
 const up=sortStatsItems(seasonData,"season","goals","asc",config);
 assert.deepEqual(down.map(x=>x.player.name),["B","A","C"]);
 assert.deepEqual(up.map(x=>x.player.name),["A","B","C"]);
});
test("ordena por xG de manera numérica",()=>{
 const order=sortStatsItems(seasonData,"season","xg","desc",config);
 assert.deepEqual(order.map(x=>x.player.name),["B","A","C"]);
});
test("ordenación cronológica, alfabética y cambio de sentido",()=>{
 assert.deepEqual(sortStatsItems(seasonData,"season","season","asc",config).map(x=>x.player.name),["A","B","C"]);
 assert.deepEqual(sortStatsItems(seasonData,"season","player","desc",config).map(x=>x.player.name),["C","B","A"]);
 assert.deepEqual(nextSorting("rating","desc","rating"),{key:"rating",direction:"asc"});
 assert.deepEqual(nextSorting("rating","desc","season"),{key:"season",direction:"asc"});
});
test("métricas calculadas se pueden usar como criterio de orden",()=>{
 config.computed.push({id:"calc_score",name:"Puntos",formula:"goals * 2 + xg",decimals:2});
 const sorted=sortStatsItems(seasonData,"season","calc_score","desc",config);
 assert.deepEqual(sorted.map(x=>x.player.name),["B","A","C"]);
});
test("ordenación en competiciones consulta los valores de su propia fila",()=>{
 const competitionData=[r("A","2024/2025",100,0,4),r("B","2024/2025",100,3,1)].map(record=>({record,player:{name:record.player_name}}));
 assert.deepEqual(sortStatsItems(competitionData,"competition","goals","desc",config).map(x=>x.player.name),["B","A"]);
});
