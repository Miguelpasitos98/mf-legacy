import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  resolveHistoricalPosition,
  seasonReferencePosition,
  withCompetitionPosition,
  competitionPosition,
  normalizeHistoricalPosition,
} from "../src/utils/historicalPositions.js";
import { buildHistoricalObservations, compareHistoricalObservation } from "../src/utils/historicalPeers.js";
import { WEIGHTS_BY_ROLE } from "../src/utils/compositeEngine.js";
import { prepareHistoricalJson } from "../src/utils/historicalJson.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const players = [{ id: "k", name: "Havertz", position: "CAM", position_raw: "CAM" }];
const record = (player_id, season, competition, minutes, metric, amount) => ({
  player_id, season, competition, minutes, appearances: 20, rating: 7,
  metrics: [{ name: metric, value: amount }],
});

test("prioridad de posición: competición > temporada > FIFA > respaldo provisional", () => {
  const valuation = {
    fifa_fc_position: "CAM",
    historical_position_override: "CM",
    competition_positions: [{ competition: "Champions League", position: "ST" }],
  };
  assert.deepEqual(resolveHistoricalPosition({ valuation, competition: "Champions League" }),
    { position: "ST", source: "competition" });
  assert.deepEqual(resolveHistoricalPosition({ valuation, competition: "Bundesliga" }),
    { position: "CM", source: "season" });
  assert.deepEqual(resolveHistoricalPosition({ valuation: { fifa_fc_position: "CAM" }, competition: "Bundesliga" }),
    { position: "CAM", source: "fifa" });
  assert.deepEqual(resolveHistoricalPosition({ valuation: null, fallback: "DC" }),
    { position: "DC", source: "fallback" });
  assert.deepEqual(resolveHistoricalPosition({ valuation: null, fallback: "" }),
    { position: "", source: "none" });
});

test("nunca se inventa una posición FIFA cuando falta el dato", () => {
  const valuation = { transfermarkt_value_eur: 50000000 };
  const resolved = resolveHistoricalPosition({ valuation, competition: "Bundesliga", fallback: "ED" });
  assert.equal(resolved.source, "fallback");
  assert.equal(resolved.position, "ED");
  assert.equal(valuation.fifa_fc_position, undefined);
});

test("una temporada admite correcciones distintas por competición y se conservan", () => {
  const valuation = { fifa_fc_position: "CAM" };
  const updated = withCompetitionPosition(valuation, "Bundesliga", "st");
  assert.deepEqual(updated, [{ competition: "Bundesliga", position: "ST" }]);
  assert.equal(competitionPosition({ competition_positions: updated }, "bundesliga"), "ST");
  const cleared = withCompetitionPosition({ competition_positions: updated }, "Bundesliga", "");
  assert.deepEqual(cleared, []);
  assert.equal(normalizeHistoricalPosition(" cam "), "CAM");
});

test("la referencia de temporada usa la corrección común y avisa si las competiciones discrepan", () => {
  const agreed = {
    fifa_fc_position: "CAM",
    competition_positions: [
      { competition: "Bundesliga", position: "ST" },
      { competition: "Champions League", position: "ST" },
    ],
  };
  assert.deepEqual(seasonReferencePosition({ valuation: agreed, competitions: ["Bundesliga", "Champions League"] }),
    { position: "ST", source: "competition", mixed: false });
  const mixed = {
    fifa_fc_position: "CAM",
    competition_positions: [
      { competition: "Bundesliga", position: "ST" },
      { competition: "Champions League", position: "CAM" },
    ],
  };
  assert.deepEqual(seasonReferencePosition({ valuation: mixed, competitions: ["Bundesliga", "Champions League"] }),
    { position: "CAM", source: "fifa", mixed: true });
});

test("el arquetipo del Composite usa la posición histórica, no la posición actual", () => {
  const stats = [
    record("k", "2019/2020", "Bundesliga", 1800, "xA", 6),
    record("k", "2020/2021", "Bundesliga", 1800, "xA", 4),
  ];
  const valuations = [
    { player_id: "k", season: "2019/2020", fifa_fc_position: "CAM" },
    { player_id: "k", season: "2020/2021", fifa_fc_position: "DC" },
  ];
  const observations = buildHistoricalObservations({ stats, players, valuations });
  const cam = observations.find((o) => o.season === "2019/2020");
  const st = observations.find((o) => o.season === "2020/2021");
  assert.equal(cam.role, "CAM");
  assert.equal(cam.positionSource, "fifa");
  assert.equal(st.role, "ST");
  assert.equal(st.positionSource, "fifa");
});

test("CAM y ST usan ponderaciones distintas sin reiniciar las fórmulas", () => {
  const stats = [
    record("k", "2019/2020", "Bundesliga", 1800, "xA", 6),
    record("k", "2020/2021", "Bundesliga", 1800, "xA", 4),
  ];
  const valuations = [
    { player_id: "k", season: "2019/2020", fifa_fc_position: "CAM" },
    { player_id: "k", season: "2020/2021", fifa_fc_position: "DC" },
  ];
  const observations = buildHistoricalObservations({ stats, players, valuations });
  const cam = compareHistoricalObservation(observations[0], observations);
  const st = compareHistoricalObservation(observations[1], observations);
  assert.equal(cam.rows.find((r) => r.key === "xa_p90").weight, WEIGHTS_BY_ROLE.CAM.xa_p90);
  assert.equal(st.rows.find((r) => r.key === "xa_p90").weight, WEIGHTS_BY_ROLE.ST.xa_p90);
  assert.notEqual(WEIGHTS_BY_ROLE.CAM.xa_p90, WEIGHTS_BY_ROLE.ST.xa_p90);
  assert.equal(stats[0].metrics[0].value, 6);
});

test("una corrección manual recalcula el arquetipo sin tocar las estadísticas importadas", () => {
  const stats = [record("k", "2019/2020", "Bundesliga", 1800, "xA", 6)];
  const before = buildHistoricalObservations({ stats, players, valuations: [] })[0];
  assert.equal(before.role, "CAM");
  assert.equal(before.positionSource, "fallback");
  const after = buildHistoricalObservations({
    stats, players,
    valuations: [{ player_id: "k", season: "2019/2020", historical_position_override: "DC" }],
  })[0];
  assert.equal(after.role, "ST");
  assert.equal(after.positionSource, "season");
  assert.equal(stats[0].metrics[0].value, 6);
});

test("el JSON histórico antiguo sigue siendo válido y los null no sobrescriben", () => {
  const base = { schema: "mf_legacy_historical_import_v1", player: { fotmob_id: "1" } };
  const legacy = prepareHistoricalJson(
    JSON.stringify({ ...base, valuations: [{ season: "2019/2020", fifa_fc_overall: 84 }] }),
    { playerId: "k", fotmobPlayerId: "1", stats: [], teams: [] }
  );
  assert.equal(legacy[0].errors.length, 0);
  assert.equal(legacy[0].payload.fifa_fc_position, undefined);

  const withPosition = prepareHistoricalJson(
    JSON.stringify({
      ...base,
      valuations: [
        { season: "2020/2021", fifa_fc_overall: 85, fifa_fc_position: "cam" },
        { season: "2021/2022", fifa_fc_overall: 86, fifa_fc_position: null },
      ],
    }),
    { playerId: "k", fotmobPlayerId: "1", stats: [], teams: [] }
  );
  assert.equal(withPosition[0].payload.fifa_fc_position, "CAM");
  assert.equal(withPosition[1].payload.fifa_fc_position, undefined);
  assert.equal(withPosition[1].errors.length, 0);
});

test("la interfaz persiste la posición histórica en la entidad y recalcula el Composite", () => {
  const table = read("../src/components/stats/HistoricalValuationsTable.jsx");
  const editor = read("../src/components/stats/HistoricalPositionEditor.jsx");
  const competition = read("../src/components/stats/CompetitionPositionEditor.jsx");
  assert.match(table, /PlayerHistoricalValuation\.update\(record\.id, patch\)/);
  assert.match(table, /historical_position_override/);
  assert.match(table, /competition_positions/);
  assert.match(table, /patchHistoricalPeerCache\(queryClient,"PlayerHistoricalValuation",record\.id,patch\)/);
  assert.match(editor, /Restaurar FIFA original/);
  assert.match(editor, /resolveHistoricalPosition/);
  assert.match(competition, /withCompetitionPosition/);
});