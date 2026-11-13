import test from "node:test";
import assert from "node:assert/strict";
import { buildFmSaveIndex, findFmPlayers, findFmClubs, filterFmTeamDetails, buildFmExport } from "../src/utils/fmSaveSearch.mjs";

const sample = buildFmSaveIndex({
  count: 4,
  numbers: {
    uid: new Float64Array([1234567890, 2234567890, 3234567890, 4234567890]),
    club_uid: new Float64Array([0, 0, 22, NaN]),
    team_slot: new Float32Array([0, 1, 0, NaN]),
    ability_current: new Float32Array([170, 120, 165, 140]),
    ability_potential: new Float32Array([185, 160, 175, 160]),
    age: new Float32Array([27, 18, 31, 25]),
  },
  text: {
    name: ["Álvaro García", "Alvaro Ruiz", "García Méndez", "Libre Ejemplo"],
    club_name: ["Atlético FC", "Atlético FC", "City", null],
    natural_positions: ["STC", "MC", "DC", "AMC"],
  },
});

test("busca nombres sin acentos y preserva identificadores amplios", () => {
  assert.deepEqual(findFmPlayers(sample, "alvaro"), [0, 1]);
  assert.equal(sample.uid[0], 1234567890);
});
test("agrupa por ID, incluido el club cero, sin mezclar jugadores libres", () => {
  assert.equal(findFmClubs(sample, "atletico")[0].members.length, 2);
  assert.equal(findFmClubs(sample, "atletico")[0].uid, 0);
  assert.equal(sample.clubs.length, 2);
  assert.equal(sample.teamSlot[sample.clubs[0].members[0]], 0);
});
test("la exportación de primera plantilla solo toma team_slot cero", () => {
  const details = [
    { player: { uid: 1, team_slot: 0 }, stats: [{ minutes: 90 }] },
    { player: { uid: 2, team_slot: 1 }, stats: [{ minutes: 45 }] },
  ];
  const filtered = filterFmTeamDetails(details, true);
  assert.equal(filtered.length, 1);
  const exportData = buildFmExport({ meta: { game: "FM27", build: "27.0.1", fmsave: "0.12.2" }, selection: { type: "team" }, details: filtered });
  assert.equal(exportData.players.length, 1);
  assert.equal(exportData.player_season_stats[0].minutes, 90);
  assert.equal(exportData.source.game, "FM27");
});
