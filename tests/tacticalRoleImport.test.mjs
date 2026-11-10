import test from "node:test";
import assert from "node:assert/strict";
import { ROLE_IMPORT_FORMAT, ROLE_BASE44_REVIEW_FORMAT, parseTacticalRoleImport, buildTacticalRoleImportPlan, tacticalRolePatch } from "../src/utils/tacticalRoleImport.mjs";

const roles = ["🎩 Space Creator", "🌀 Space Creator", "🧠 Ball-Playing Defender", "📐 Tactical Defender", "⚡ Line Breaker"];
const item = (id, name = "Pau Cubarsí") => ({
  fm26_uid: id, name,
  tactical_roles: [
    { name: "🧠 Ball-Playing Defender", description: "Saca el balón jugado." },
    { name: "📐 Tactical Defender", description: "Defiende los espacios." },
  ],
});
const doc = players => ({ format: ROLE_IMPORT_FORMAT, players_count: players.length, players });

test("validación del esquema original y roles con emoji", () => {
  const data = parseTacticalRoleImport(doc([item("2000296491")]), roles);
  assert.equal(data.entries[0].roles[0].name, "🧠 Ball-Playing Defender");
  assert.deepEqual(data.warnings, []);
});
test("espacios creadores homónimos: preservar emoji exacto y rechazar nombre ambiguo", () => {
  const full = item("1");
  full.tactical_roles[1].name = "🎩 Space Creator";
  assert.equal(parseTacticalRoleImport(doc([full]), roles).entries[0].roles[1].name, "🎩 Space Creator");
  full.tactical_roles[1].name = "Space Creator";
  assert.match(parseTacticalRoleImport(doc([full]), roles).entries[0].errors.join(" "), /ambiguo/);
});
test("duplicados, ausencia e IDs de Base44 duplicados nunca escriben", () => {
  const data = parseTacticalRoleImport(doc([item("1"), item("1"), item("2"), item("3")]), roles);
  const plan = buildTacticalRoleImportPlan(data.entries, [
    { id: "db3", fm26_uid: "3" }, { id: "db4", fm26_uid: "3" },
  ]);
  assert.deepEqual(plan.map(p => p.status), ["invalid", "invalid", "unmatched", "ambiguous"]);
});
test("protección predeterminada y modo sobrescritura", () => {
  const [entry] = parseTacticalRoleImport(doc([item("9")]), roles).entries;
  const existing = { id: "base44", name: entry.name, fm26_uid: "9", description: "Anterior",
    tactical_roles: [{ name: "⚡ Line Breaker", description: "" }, { name: "", description: "" }] };
  assert.equal(buildTacticalRoleImportPlan([entry], [existing])[0].status, "protected");
  const row = buildTacticalRoleImportPlan([entry], [existing], { overwrite: true })[0];
  assert.equal(row.status, "ready");
  assert.deepEqual(Object.keys(tacticalRolePatch(row)).sort(), ["description", "tactical_roles"]);
});
test("reimportar datos idénticos es idempotente", () => {
  const [entry] = parseTacticalRoleImport(doc([item("9")]), roles).entries;
  const player = { id: "base44", name: entry.name, fm26_uid: "9",
    description: entry.roles[0].name, tactical_roles: entry.roles };
  assert.equal(buildTacticalRoleImportPlan([entry], [player])[0].status, "unchanged");
});
test("formato original de FM no puede confundirse con importación de roles", () => {
  assert.throws(() => parseTacticalRoleImport([item("1")], roles), /Formato no compatible/);
});

test("permite la revisión de leyendas sin UID FM26, vinculadas por ID interno", () => {
  const id = "6af30b6f584b3537cdf15e5b";
  const row = { base44_player_id:id, name:"Eden Hazard", fm26_uid:null, tactical_roles:[
    {name:"⚡ Line Breaker",description:"Desborde"},
    {name:"🎩 Space Creator",description:"Creación"}]};
  for (const format of [ROLE_IMPORT_FORMAT,ROLE_BASE44_REVIEW_FORMAT]) {
    const parsed = parseTacticalRoleImport({format,matching_key:"base44_player_id",players_count:1,players:[row]},roles);
    assert.equal(parsed.matchingKey,"base44_player_id");
    assert.equal(parsed.entries[0].errors.length,0);
    const player = {id,name:"Eden Hazard",fm26_uid:null,description:"",tactical_roles:[]};
    const plan=buildTacticalRoleImportPlan(parsed.entries,[player]);
    assert.equal(plan[0].status,"ready");
    assert.deepEqual(Object.keys(tacticalRolePatch(plan[0])).sort(),["description","tactical_roles"]);
    assert.equal(buildTacticalRoleImportPlan(parsed.entries,[{...player,name:"Otro jugador"}])[0].status,"invalid");
  }
});

test("no admite IDs Base44 falsos, nombres ajenos ni duplicados", () => {
  const id="6af30b6f584b3537cdf15e5b";
  const row={...item(null,"Eden Hazard"),base44_player_id:id};
  const duplicate=parseTacticalRoleImport({format:ROLE_IMPORT_FORMAT,matching_key:"base44_player_id",players:[row,row]},roles);
  assert.equal(duplicate.entries[0].errors.some(e=>e.includes("repetido")),true);
  const broken=parseTacticalRoleImport({format:ROLE_IMPORT_FORMAT,matching_key:"base44_player_id",players:[{...row,base44_player_id:"not-an-id"}]},roles);
  assert.equal(broken.entries[0].errors.length>0,true);
  assert.throws(()=>parseTacticalRoleImport({format:ROLE_IMPORT_FORMAT,matching_key:"unknown",players:[row]},roles),/matching_key/);
});
