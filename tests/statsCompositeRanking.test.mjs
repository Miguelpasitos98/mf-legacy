import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildCompositeSeasonIndex,bestSeasonByComposite,sortByComposite,compositeSeasonKey,displaySeasonPosition} from "../src/utils/statsCompositeRanking.js";
import {rankIdentity,rankPositions} from "../src/utils/statsRank.js";
import {historicalRole} from "../src/utils/historicalPeers.js";

const entry=(id,season,minutes=1600)=>({
  player:{id,name:id},summary:{id:id+season,player_id:id,season,totals:{minutes:{value:minutes}}}
});
const scoreIndex=new Map([
  ["a|2023/2024",{score:74.6,role:"ST",position:"DC",source:"fallback"}],
  ["a|2024/2025",{score:86.2,role:"ST",position:"ST",source:"fifa"}],
  ["b|2024/2025",{score:85.4,role:"ST",position:"DC",source:"fallback"}],
  ["c|2024/2025",{score:72.7,role:"CAM",position:"CAM",source:"fifa"}]
]);
const samples=[
 entry("a","2023/2024"),entry("b","2024/2025"),
 entry("c","2024/2025"),entry("a","2024/2025"),entry("d","2024/2025")
];
test("Toda la base se ordena por Composite descendente y no por nota o por orden inicial",()=>{
 const ranked=sortByComposite(samples,scoreIndex,"desc");
 assert.deepEqual(ranked.map(x=>x.summary.player_id+"|"+x.summary.season),
  ["a|2024/2025","b|2024/2025","a|2023/2024","c|2024/2025","d|2024/2025"]);
 const positions=rankPositions(ranked,"season");
 assert.equal(positions.get(rankIdentity(ranked[0],"season")),1);
 assert.equal(positions.get(rankIdentity(ranked[1],"season")),2);
 assert.equal(positions.get(rankIdentity(ranked[2],"season")),3);
});
test("También se puede ordenar ascendente; valores ausentes siguen al final",()=>{
 const sorted=sortByComposite(samples,scoreIndex,"asc");
 assert.deepEqual(sorted.map(x=>x.summary.player_id),["c","a","b","a","d"]);
});
test("Mejor temporada se elige por Composite, no por la primera ni por goles",()=>{
 const best=bestSeasonByComposite(samples,scoreIndex);
 assert.equal(best.length,3);
 assert.equal(best.find(e=>e.summary.player_id==="a").summary.season,"2024/2025");
 assert.equal(best.find(e=>e.summary.player_id==="b").summary.season,"2024/2025");
 assert.equal(best.some(e=>e.summary.player_id==="d"),false);
 const ordered=sortByComposite(best,scoreIndex,"desc");
 assert.deepEqual(ordered.map(x=>x.summary.player_id),["a","b","c"]);
});
test("Desempate en Mejor temporada por minutos y después año",()=>{
 const idx=new Map([["a|2023/2024",{score:80}],["a|2024/2025",{score:80}]]);
 assert.equal(bestSeasonByComposite([entry("a","2023/2024",3000),entry("a","2024/2025",2000)],idx)[0].summary.season,"2023/2024");
 assert.equal(bestSeasonByComposite([entry("a","2023/2024",3000),entry("a","2024/2025",3000)],idx)[0].summary.season,"2024/2025");
});
test("DC y ST son un mismo arquetipo y muestran ST sin modificar datos originales",()=>{
 assert.equal(historicalRole("DC"),"ST");
 assert.equal(historicalRole("ST"),"ST");
 assert.equal(displaySeasonPosition("DC"),"ST");
 assert.equal(displaySeasonPosition("ST"),"ST");
 assert.equal(displaySeasonPosition("CAM"),"CAM");
 assert.equal(displaySeasonPosition(null),"—");
 assert.equal(scoreIndex.get(compositeSeasonKey("a","2023/2024")).position,"DC");
});
test("El contenedor único calcula la clasificación y la tabla no la reordena localmente",()=>{
 const base=readFileSync(new URL("../src/pages/Stats.jsx",import.meta.url),"utf8");
 const table=readFileSync(new URL("../src/components/stats/SeasonStatsTable.jsx",import.meta.url),"utf8");
 assert.match(base,/sort==="composite"\?sortByComposite\(ranked,compositeIndex,sortDirection\)/);
 assert.match(base,/bestMetric==="composite"\?bestSeasonByComposite\(enough,compositeIndex\)/);
 assert.match(base,/\[bestMetric,setBestMetric\]=useState\("composite"\)/);
 assert.match(table,/const pageRows=items\.filter/);
 assert.match(table,/displaySeasonPosition\(x\?\.position\)/);
 assert.doesNotMatch(table,/sortKey==="composite"\?\[/);
});
