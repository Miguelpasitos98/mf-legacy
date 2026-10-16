import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {overviewHistoricalModel} from "../src/utils/statsOverviewModel.js";
import {nationalCompetition} from "../src/utils/statsViews.js";

const data={observations:[
 {playerId:"a",season:"2021/2022",role:"ST",values:{npxg_p90:0.3,rating:7.4}},
 {playerId:"a",season:"2022/2023",role:"ST",values:{npxg_p90:0.5,rating:7.8}},
 {playerId:"b",season:"2022/2023",role:"ST",values:{npxg_p90:0.2,rating:7.2}},
 {playerId:"wing",season:"2022/2023",role:"W",values:{npxg_p90:10,rating:10}},
]};
const source=path=>readFileSync(new URL(path,import.meta.url),"utf8");
test("El Overview usa exactamente el Composite histórico ST de la temporada elegida",()=>{
 const model=overviewHistoricalModel(data,"a","2021/2022");
 assert.equal(model.result.population,3);
 assert.equal(model.result.players,2);
 assert.equal(model.result.season,"2021/2022");
 assert.equal(model.result.rows.find(m=>m.key==="npxg_p90").percentile,50);
 assert.equal(model.trend.length,2);
 assert.equal(model.trend.filter(t=>t.selected).length,1);
 assert.equal(model.trend.find(t=>t.selected).season,"2021/2022");
 assert.equal(model.trend.find(t=>t.season==="2022/2023").score,null); // Una sola métrica no justifica Composite
});
test("No calcula un Composite ficticio cuando se selecciona el histórico completo",()=>{
 const m=overviewHistoricalModel(data,"a","Todas");
 assert.equal(m.result,null);
 assert.equal(m.trend.length,2);
 assert.ok(m.trend.every(t=>!t.selected));
});
test("No mezcla datos de distintos jugadores ni crea fallback sin datos",()=>{
 const m=overviewHistoricalModel(data,"b","2021/2022");
 assert.equal(m.result,null);
 assert.equal(overviewHistoricalModel(null,"b","2022/2023").result,null);
});
test("La vista Overview abre por defecto, es propia MF LEGACY y CraftedFC queda plegado",()=>{
 const stats=source("../src/pages/Stats.jsx");
 const view=source("../src/components/stats/MfLegacyOverview.jsx");
 assert.match(stats,/const \[section,setSection\]=useState\("overview"\)/);
 assert.match(stats,/\{section==="overview"&&<MfLegacyOverview/);
 assert.match(view,/Composite MF LEGACY/);
 assert.match(view,/useHistoricalPeerDataset\(true\)/);
 assert.match(view,/onSeasonChange\(t.season\)/);
 assert.match(view,/<details className="rounded-xl border border-slate-200 bg-slate-50 p-4">/);
 assert.match(view,/Referencia externa CraftedFC \(opcional\)/);
 assert.match(view,/showValuationHistory&&/);
});
test("Solo clubes excluye torneos de selecciones EURO y EURO U21 pero no Europa League",()=>{
 assert.equal(nationalCompetition("EURO"),true);
 assert.equal(nationalCompetition("EURO U21"),true);
 assert.equal(nationalCompetition("EURO 2024"),true);
 assert.equal(nationalCompetition("Europa League"),false);
 assert.equal(nationalCompetition("UEFA Super Cup"),false);
 assert.equal(nationalCompetition("FIFA Club World Cup"),false);
});
