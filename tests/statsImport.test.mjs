import test from "node:test";
import assert from "node:assert/strict";
import {parseStatsText,recordKey} from "../src/utils/statsImport.js";
const fixture={fotmob_player_id:"777",fotmob_team_id:"9825",player_name:"Ejemplo",team_name:"Club Ejemplo",season:"2025/2026",competition:"Premier League",metrics:[{name:"Goals",value:4},{name:"Assists",value:0}]};
test("JSON exportado: mantiene ID, goles y cero real",()=>{
  const result=parseStatsText(JSON.stringify({schema:"mf_legacy_fotmob_player_stats_batch_review_v1",records:[fixture]}),"temporadas.json");
  assert.equal(result.records.length,1);
  assert.equal(result.records[0].metrics[1].value,0);
  assert.equal(result.records[0].fotmob_team_id,"9825");
});
test("JSONC con comentarios",()=>{
  const source='{\n // comentario\n "records": ['+JSON.stringify(fixture)+',]\n}';
  assert.equal(parseStatsText(source,"temporadas.jsonc").records.length,1);
});
test("CSV de caché: separador ; y campos numéricos",()=>{
  const csv="fotmob_player_id;fotmob_team_id;team_name;season;competition;appearances;minutes;rating\n777;9825;Club Ejemplo;2025/2026;Premier League;38;3000;7.34";
  const out=parseStatsText(csv,"estadisticas.csv");
  assert.equal(out.records[0].appearances,38);
  assert.equal(out.records[0].rating,7.34);
  assert.equal(out.records[0].metrics.length,0);
});
test("CSV detallado agrupa métricas sin duplicar etapas",()=>{
  const csv="fotmob_player_id;fotmob_team_id;season;competition;statistic;value\n777;9825;2025/2026;Premier League;Goals;4\n777;9825;2025/2026;Premier League;Assists;0";
  const out=parseStatsText(csv,"detalladas.csv");
  assert.equal(out.records.length,1);
  assert.equal(out.records[0].metrics.length,2);
});
test("registros con mismo identificador y datos distintos dan error",()=>{
  const different={...fixture,metrics:[{name:"Goals",value:9}]};
  assert.throws(()=>parseStatsText(JSON.stringify({records:[fixture,different]}),"lote.json"),/duplicada/i);
});
test("jugador sin FotMob ID no se importa",()=>{
  assert.throws(()=>parseStatsText(JSON.stringify({records:[{...fixture,fotmob_player_id:""}]}),"lote.json"),/Falta ID/);
});
