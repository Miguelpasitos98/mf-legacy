import test from "node:test";
import assert from "node:assert/strict";
import { buildValuationPrompt } from "../src/utils/valuationPrompt.js";
import { normalizeHistoricalPosition } from "../src/utils/historicalPositions.js";

test("el prompt exige valores históricos, posición exacta FIFA, Transfermarkt y PJ Equipo con JSON",()=>{
  const prompt=buildValuationPrompt({
    playerName:"Havertz",seasons:["2019/2020","2020/2021"],
    fm26Uid:"62087624",fotmobPlayerId:"749736",
  });
  assert.match(prompt,/posici[oó]n principal EXACTA/i);
  assert.match(prompt,/No inventes datos/);
  assert.match(prompt,/mf_legacy_historical_import_v1/);
  assert.match(prompt,/62087624/);
  assert.match(prompt,/ID FotMob: 749736/);
  assert.match(prompt,/"season": "2019\/2020"/);
  assert.match(prompt,/"season": "2020\/2021"/);
  assert.match(prompt,/"fifa_fc_position": null/);
  assert.match(prompt,/"transfermarkt_value_eur": null/);
  assert.match(prompt,/"team_matches": \[\]/);
});
test("el ejemplo JSON del prompt respeta el importador histórico y temporadas",()=>{
  const prompt=buildValuationPrompt({playerName:"X",seasons:["2022/2023","2022/2023"]});
  const opening=prompt.indexOf('{\n  "schema":');
  assert.notEqual(opening,-1);
  const parsed=JSON.parse(prompt.slice(opening));
  assert.equal(parsed.schema,"mf_legacy_historical_import_v1");
  assert.equal(parsed.valuations.length,1);
  assert.equal(parsed.valuations[0].season,"2022/2023");
  assert.equal(parsed.player.name,"X");
  assert.equal(parsed.player.fotmob_id,"");
  assert.deepEqual(parsed.team_matches,[]);
});
test("una posición FIFA vacía no se convierte en posición inventada",()=>{
  assert.equal(normalizeHistoricalPosition(""),"");
  assert.equal(normalizeHistoricalPosition(null),"");
  assert.equal(normalizeHistoricalPosition(" cam "),"CAM");
});
