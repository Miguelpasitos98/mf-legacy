import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import test from "node:test";
import {parsePossessionBatch, validatePossessionRow} from "../../src/utils/teamPossession.js";

const directory = fileURLToPath(new URL(".", import.meta.url));
const converted = spawnSync(process.env.PYTHON || "python", ["-c", `
import json
from extract_fotmob import FileClient, extract, ROOT
client=FileClient(ROOT/'fixtures')
records=[]
for lid,sid,label,competition in [(55,27044,'2025/2026','Serie A'),(55,10692,'2016/2017','Serie A'),(130,29580,'2026','MLS')]:
    data,source=client.get(lid,sid)
    records.extend(extract(data,{'id':str(sid),'league_id':str(lid),'name':label},competition,source))
print(json.dumps({'records':records}))
`], {cwd: directory, encoding: "utf8"});
assert.equal(converted.status, 0, converted.stderr);
const batch = JSON.parse(converted.stdout);

test("70 real sample rows produced by Python pass the actual MF Legacy validator", () => {
  const {rows, errors} = parsePossessionBatch(batch, []);
  assert.deepEqual(errors, []);
  assert.equal(rows.length, 70);
  assert(rows.every(r => r.verification_status === "pending" && !r.team_id));
  assert.equal(rows.find(r => r.team_name === "Inter" && r.season === "2025/2026").team_possession_pct, 59.7);
  assert(rows.every(r => !Object.hasOwn(r, "matches_covered")));
  assert(rows.every(r => r.notes.includes("league=") && r.notes.includes("season=")));
});

test("the actual batch validator detects repeated team/competition/season", () => {
  const {errors} = parsePossessionBatch({records: [batch.records[0], batch.records[0]]}, []);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /duplicados/);
});

test("existing team IDs survive validation and conflicting FotMob IDs fail", () => {
  const inter = batch.records.find(r => r.fotmob_team_id === "8636");
  const team = {id: "existing-team", name: "Inter", fotmob_id: "8636"};
  assert.equal(validatePossessionRow({...inter, team_id: team.id}, [team]).team_id, team.id);
  assert.throws(() => validatePossessionRow({...inter, team_id: team.id}, [{...team, fotmob_id: "9999"}]), /incompatible/);
});
