import test from "node:test";
import assert from "node:assert/strict";
import {initialConfig} from "../src/utils/statsColumns.js";
import {buildSeasonSummaries} from "../src/utils/statsSeason.js";
import {bestSeasonPerPlayer} from "../src/utils/statsBestSeason.js";
import {sortStatsItems} from "../src/utils/statsSort.js";

const config=initialConfig();
function record(player,season,goals,xg,minutes=1200,rating=7){
 return {
  player_id:player,player_name:player,season,competition:"LaLiga",team_name:"Barcelona",
  minutes,appearances:20,rating,
  metrics:goals===null?[]:[{name:"Goals",value:goals},{name:"xG",value:xg},{name:"Assists",value:2}]
 };
}
function entries(records){
 return buildSeasonSummaries(records,[]).map(summary=>({summary,player:{name:summary.player_name}}));
}
const seasons=entries([
 record("Raphinha","2023/2024",5,9,1000,7.8),
 record("Raphinha","2024/2025",19,17,1500,7.5),
 record("Raphinha","2025/2026",10,20,1100,8.2),
 record("Lewandowski","2023/2024",15,13,1700,7.6),
 record("Lewandowski","2024/2025",12,16,1600,8.0)
]);

test("cada jugador aparece solo una vez: mejor temporada por goles",()=>{
 const result=bestSeasonPerPlayer(seasons,"goals",config);
 assert.equal(result.length,2);
 assert.equal(result.find(x=>x.summary.player_id==="Raphinha").summary.season,"2024/2025");
 assert.equal(result.find(x=>x.summary.player_id==="Lewandowski").summary.season,"2023/2024");
});
test("nota media y xG seleccionan temporadas distintas del mismo futbolista",()=>{
 assert.equal(bestSeasonPerPlayer(seasons,"rating",config).find(x=>x.summary.player_id==="Raphinha").summary.season,"2025/2026");
 assert.equal(bestSeasonPerPlayer(seasons,"xg",config).find(x=>x.summary.player_id==="Raphinha").summary.season,"2025/2026");
 assert.equal(bestSeasonPerPlayer(seasons,"xg",config).find(x=>x.summary.player_id==="Lewandowski").summary.season,"2024/2025");
});
test("orden ascendente no cambia qué temporada ganó, solo la clasificación",()=>{
 const selected=bestSeasonPerPlayer(seasons,"goals",config);
 assert.equal(sortStatsItems(selected,"season","goals","asc",config)[0].summary.player_id,"Lewandowski");
 assert.equal(sortStatsItems(selected,"season","goals","desc",config)[0].summary.player_id,"Raphinha");
});
test("valor ausente no gana; un cero real sí es un dato válido",()=>{
 const rows=entries([record("P","2022/2023",null,0),record("P","2023/2024",0,0),record("Q","2024/2025",null,0)]);
 const result=bestSeasonPerPlayer(rows,"goals",config);
 assert.equal(result.length,1);
 assert.equal(result[0].summary.season,"2023/2024");
});
test("el mínimo de minutos se aplica antes de elegir mejor temporada",()=>{
 const eligible=seasons.filter(x=>x.summary.totals.minutes.value>=1200);
 const result=bestSeasonPerPlayer(eligible,"rating",config);
 assert.equal(result.find(x=>x.summary.player_id==="Raphinha").summary.season,"2024/2025");
});
test("en caso de empate gana la temporada con más minutos; después la más reciente",()=>{
 const row=entries([record("P","2023/2024",10,4,1000),record("P","2024/2025",10,5,1300),record("P","2025/2026",10,5,1300)]);
 assert.equal(bestSeasonPerPlayer(row,"goals",config)[0].summary.season,"2025/2026");
});
test("las fórmulas personalizadas también pueden elegir mejor temporada",()=>{
 const custom=initialConfig();
 custom.computed.push({id:"calc_score",name:"Índice",formula:"xg * 2 + goals",decimals:0});
 const result=bestSeasonPerPlayer(seasons,"calc_score",custom);
 assert.equal(result.find(x=>x.summary.player_id==="Raphinha").summary.season,"2025/2026");
});
test("nombres idénticos con IDs distintos siguen siendo jugadores separados",()=>{
 const row=entries([record("A","2025/2026",7,6),record("B","2025/2026",9,7)]);
 row.forEach(x=>x.player.name="Duplicado");
 assert.equal(bestSeasonPerPlayer(row,"goals",config).length,2);
});
