import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {missingMarketSeasons,buildMissingMarketPrompt} from "../src/utils/missingMarketPrompt.js";
import {buildValuationPrompt} from "../src/utils/valuationPrompt.js";
import {prepareHistoricalJson,rowChanges} from "../src/utils/historicalJson.js";

const seasons=["2010/2011","2011/2012","2012/2013","2014/2015","2017/2018"];
const valuations=[
 {season:"2011/2012",transfermarkt_value_eur:9000000},
 {season:"2012/2013",transfermarkt_value_eur:10000000},
 {season:"2017/2018",transfermarkt_value_eur:150000000},
 {season:"2010/2011",transfermarkt_value_eur:null}
];
test("Solo marca temporadas cuyo mercado es null o nunca se ha registrado",()=>{
 assert.deepEqual(missingMarketSeasons(seasons,valuations),["2010/2011","2014/2015"]);
 assert.deepEqual(missingMarketSeasons([],valuations),[]);
});
test("La investigación de mercado usa un JSON market-only y conserva FotMob ID",()=>{
 const prompt=buildMissingMarketPrompt({playerName:"Kevin De Bruyne",fotmobId:"169200",seasons,valuations});
 const body=JSON.parse(prompt.slice(prompt.indexOf('{\n  "schema":')));
 assert.deepEqual(body.valuations.map(v=>v.season),["2010/2011","2014/2015"]);
 assert.deepEqual(Object.keys(body.valuations[0]),["season","transfermarkt_value_eur","market_value_as_of","transfermarkt_source_url"]);
 assert.equal(body.player.fotmob_id,"169200");
 assert.deepEqual(body.team_matches,[]);
 assert.match(prompt,/historial de valoraciones/i);
 assert.match(prompt,/precio/i);
 assert.match(prompt,/no inventes/i);
});
test("El prompt general exige historial cronológico y URLs y fechas por temporada",()=>{
 const prompt=buildValuationPrompt({playerName:"De Bruyne",fotmobPlayerId:"169200",seasons});
 assert.match(prompt,/HISTORIAL CRONOLÓGICO/);
 assert.match(prompt,/transfermarkt_source_url/);
 assert.match(prompt,/market_value_as_of/);
 assert.match(prompt,/NUNCA su máximo histórico/);
});
test("Import market-only no modifica el Overall ni posición anterior",()=>{
 const payload=JSON.stringify({schema:"mf_legacy_historical_import_v1",player:{name:"Kevin De Bruyne",fotmob_id:"169200"},valuations:[
  {season:"2014/2015",transfermarkt_value_eur:40000000,market_value_as_of:"2015-06-01",transfermarkt_source_url:"https://www.transfermarkt.com/kevin-de-bruyne/marktwertverlauf/spieler/88755"}
 ],team_matches:[]});
 const rows=prepareHistoricalJson(payload,{playerId:"p1",fotmobPlayerId:"169200"});
 assert.equal(rows.length,1);
 assert.deepEqual(rows[0].errors,[]);
 assert.equal(rows[0].payload.fifa_fc_overall,undefined);
 assert.equal(rows[0].payload.fifa_fc_position,undefined);
 const change=rowChanges(rows[0].payload,{id:"v1",season:"2014/2015",fifa_fc_overall:83,fifa_fc_position:"CAM",transfermarkt_value_eur:null},"valuation");
 assert.equal(change.status,"update");
 assert.ok(change.changes.every(c=>!["fifa_fc_overall","fifa_fc_position"].includes(c.field)));
});
test("La interfaz reutiliza el importador JSON con vista previa y confirmación individual",()=>{
 const page=readFileSync(new URL("../src/pages/Stats.jsx",import.meta.url),"utf8");
 const importer=readFileSync(new URL("../src/components/stats/HistoricalJsonImporter.jsx",import.meta.url),"utf8");
 assert.match(page,/Completar valores ausentes/);
 assert.match(page,/copyMissingMarket/);
 assert.match(page,/stats=\{stats\} teams=\{teams\} onSaved=/);
 assert.match(importer,/updates requieren autorización individual|actualizaciones requieren autorización individual/);
 assert.match(importer,/new Set\(decorated\.filter\(\(r\) => r\.status === "new"\)/);
});
