import test from "node:test";
import assert from "node:assert/strict";
import {rankIdentity,rankPositions} from "../src/utils/statsRank.js";
import {sortStatsItems} from "../src/utils/statsSort.js";
import {initialConfig} from "../src/utils/statsColumns.js";
import {buildSeasonSummaries} from "../src/utils/statsSeason.js";
import {bestSeasonPerPlayer} from "../src/utils/statsBestSeason.js";

const cfg=initialConfig();
const mk=(id,season,goals)=>({
 player_id:id,player_name:id,season,competition:"LaLiga",
 minutes:1200,appearances:20,rating:7,
 metrics:[{name:"Goals",value:goals}]
});
function items(rows){
 return buildSeasonSummaries(rows,[]).map(summary=>({summary,player:{name:summary.player_name}}));
}
test("al filtrar por un jugador, su rank local empieza en 1 y el general mantiene su lugar",()=>{
 const all=sortStatsItems(items([mk("A","2024/2025",3),mk("B","2024/2025",20),mk("C","2024/2025",10)]),"season","goals","desc",cfg);
 const filtered=all.filter(x=>x.player.name==="A");
 const general=rankPositions(all,"season");
 assert.equal(filtered.length,1);
 assert.equal(general.get(rankIdentity(filtered[0],"season")),3);
});
test("dos temporadas del mismo jugador tienen distintas posiciones generales",()=>{
 const all=sortStatsItems(items([mk("A","2024/2025",3),mk("A","2025/2026",10),mk("B","2025/2026",20)]),"season","goals","desc",cfg);
 const ranks=rankPositions(all,"season");
 const samePlayer=all.filter(x=>x.summary.player_id==="A");
 assert.deepEqual(samePlayer.map(x=>ranks.get(rankIdentity(x,"season"))),[2,3]);
});
test("modo mejor temporada sigue teniendo rank general pero una fila por futbolista",()=>{
 const full=items([mk("A","2024/2025",3),mk("A","2025/2026",10),mk("B","2024/2025",20)]);
 const best=sortStatsItems(bestSeasonPerPlayer(full,"goals",cfg),"season","goals","desc",cfg);
 const ranks=rankPositions(best,"season");
 assert.equal(best.length,2);
 assert.deepEqual(best.map(x=>ranks.get(rankIdentity(x,"season"))),[1,2]);
});
test("cambiar la columna de ordenación actualiza los rankings generales",()=>{
 const data=items([mk("A","2024/2025",20),mk("B","2025/2026",10)]);
 const desc=sortStatsItems(data,"season","goals","desc",cfg);
 const asc=sortStatsItems(data,"season","goals","asc",cfg);
 assert.equal(rankPositions(desc,"season").get(rankIdentity(desc.find(x=>x.player.name==="A"),"season")),1);
 assert.equal(rankPositions(asc,"season").get(rankIdentity(asc.find(x=>x.player.name==="A"),"season")),2);
});
test("rank de competición usa identificador del registro, no su nombre de jugador",()=>{
 const a={record:{id:"42",season:"2024/2025"},player:{name:"Duplicado"}};
 const b={record:{id:"43",season:"2024/2025"},player:{name:"Duplicado"}};
 const map=rankPositions([a,b],"competition");
 assert.equal(map.get(rankIdentity(a,"competition")),1);
 assert.equal(map.get(rankIdentity(b,"competition")),2);
});
test("una fila del catálogo sin estadísticas no recibe un rank general inventado",()=>{
 const empty={record:null,player:{name:"Pendiente"}};
 assert.equal(rankIdentity(empty,"competition"),null);
 assert.equal(rankPositions([empty],"competition").size,0);
});
