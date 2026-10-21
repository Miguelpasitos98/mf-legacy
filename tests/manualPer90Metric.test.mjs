import test from "node:test";
import assert from "node:assert/strict";
import { buildHistoricalObservations, compareHistoricalObservation } from "../src/utils/historicalPeers.js";

const players = [
  { id: "p1", name: "Suarez", position: "DC" },
  { id: "p2", name: "Otro", position: "DC" },
  { id: "p3", name: "Tercero", position: "DC" },
];
const row = (player_id, metrics, minutes) => ({
  id: player_id, player_id, player_name: player_id, season: "2015/2016",
  competition: "LaLiga", minutes, appearances: 35, team_matches: 38, metrics,
});

test("un valor /90 introducido a mano se conserva como tasa y no se vuelve a dividir", () => {
  const stats = [
    row("p1", [{ name: "xG excl. penalty /90", value: 0.9151 }], 3150),
    row("p2", [{ name: "xG excl. penalty", value: 12 }], 3000),
    row("p3", [{ name: "xG excl. penalty", value: 8 }], 2500),
  ];
  const obs = buildHistoricalObservations({ stats, players, valuations: [], teamMatches: [], teams: [], teamPossessions: [] });
  const own = obs.find((o) => o.playerId === "p1");
  assert.equal(own.values.npxg_p90, 0.9151);
  const cmp = compareHistoricalObservation(own, obs, 10);
  assert.equal(cmp.rows.find((r) => r.key === "npxg_p90").value, 0.9151);
});

test("la tasa manual tiene prioridad sobre un total guardado para la misma métrica", () => {
  const stats = [
    row("p1", [{ name: "xG excl. penalty", value: 32 }, { name: "xG excl. penalty /90", value: 0.9151 }], 3150),
    row("p2", [{ name: "xG excl. penalty", value: 12 }], 3000),
    row("p3", [{ name: "xG excl. penalty", value: 8 }], 2500),
  ];
  const obs = buildHistoricalObservations({ stats, players, valuations: [], teamMatches: [], teams: [], teamPossessions: [] });
  assert.equal(obs.find((o) => o.playerId === "p1").values.npxg_p90, 0.9151);
});