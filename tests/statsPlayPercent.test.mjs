import test from "node:test";
import assert from "node:assert/strict";
import {initialConfig, sanitizeConfig, getColumn, columnValue} from "../src/utils/statsColumns.js";
import {parseStatsText} from "../src/utils/statsImport.js";
import {buildSeasonSummaries} from "../src/utils/statsSeason.js";
import {groupStatRows} from "../src/utils/statsViews.js";

const config=initialConfig();
const mk=(competition,minutes,teamMatches)=>({
 player_id:"p1",fotmob_player_id:"696679",player_name:"Raphinha",team_name:"Barcelona",
 season:"2025/2026",competition,appearances:18,minutes,team_matches:teamMatches,
 metrics:[{name:"Goals",value:5}]
});
test("Play % usa partidos del equipo, no los partidos jugados por el futbolista",()=>{
 const league={...mk("LaLiga",1388,22),appearances:18};
 const pct=columnValue(league,"competition","playpct",config);
 assert.ok(Math.abs(pct-70.1010101)<0.0001);
 assert.equal(getColumn(config,"playpct").unit,"%");
});
test("no inventar Play % si team_matches está ausente o es cero",()=>{
 assert.equal(columnValue(mk("LaLiga",1388,null),"competition","playpct",config),null);
 assert.equal(columnValue(mk("LaLiga",1388,0),"competition","playpct",config),null);
 assert.equal(columnValue(mk("LaLiga",null,22),"competition","playpct",config),null);
});
test("temporada con dos competiciones usa suma de minutos y PJ equipo",()=>{
 const summary=buildSeasonSummaries([mk("LaLiga",1388,22),mk("Champions League",544,7)],[])[0];
 const pct=columnValue(summary,"season","playpct",config);
 assert.ok(Math.abs(pct-(1932/(29*90)*100))<0.0001);
});
test("Play % usa únicamente los partidos y minutos con denominador conocido",()=>{
 const summary=buildSeasonSummaries([mk("LaLiga",1388,22),mk("Champions League",544,null)],[])[0];
 assert.equal(summary.totals.team_matches.partial,true);
 assert.ok(Math.abs(columnValue(summary,"season","playpct",config)-1388/(22*90)*100)<0.0001);
 assert.ok(columnValue(mk("LaLiga",1388,22),"competition","playpct",config)>0);
});
test("deduplicación conserva los PJ del equipo si están en la fuente básica",()=>{
 const detailed=mk("LaLiga",1388,null),basic={...mk("LaLiga",1388,22),metrics:[]};
 const merged=groupStatRows([detailed,basic]);
 assert.equal(merged.length,1);
 assert.equal(merged[0].team_matches,22);
});
test("importar JSON con team_matches opcional conserva y valida el número",()=>{
 const input={fotmob_player_id:"696679",season:"2025/2026",competition:"LaLiga",minutes:1388,team_matches:22};
 const json=(obj)=>parseStatsText(JSON.stringify({records:[obj]}),"detalle.json").records[0];
 assert.equal(json(input).team_matches,22);
 assert.equal(json({...input,team_matches:null}).team_matches,null);
 assert.equal(json({...input,team_matches:undefined}).team_matches,null);
 for(const bad of [0,-1,1.5,201,"desconocido"])assert.throws(()=>json({...input,team_matches:bad}),/team_matches/);
});
test("la configuración guardada admite la fórmula Play % y no ejecuta código libre",()=>{
 const old=initialConfig();
 old.version=1;
 old.computed=old.computed.filter(d=>d.id!=="playpct");
 old.columns.competition.Resumen=old.columns.competition.Resumen.filter(x=>x!=="playpct");
 old.columns.season.Resumen=old.columns.season.Resumen.filter(x=>x!=="playpct");
 const migrated=sanitizeConfig(old);
 assert.ok(migrated.computed.some(d=>d.id==="playpct"));
 assert.ok(migrated.columns.competition.Resumen.includes("playpct"));
 assert.ok(migrated.columns.season.Resumen.includes("playpct"));
 assert.equal(migrated.version,3);
 assert.equal(getColumn(migrated,"playpct").formula,"minutes / (team_matches * 90) * 100");
});
test("quien oculte Play % en v2 mantiene su preferencia",()=>{
 const current=initialConfig();
 current.columns.competition.Resumen=current.columns.competition.Resumen.filter(x=>x!=="playpct");
 assert.ok(!sanitizeConfig(current).columns.competition.Resumen.includes("playpct"));
});
