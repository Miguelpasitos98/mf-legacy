import test from "node:test";
import assert from "node:assert/strict";
import { canonicalHistoricalCompetition, prepareHistoricalJson, resolveHistoricalTeam, rowChanges } from "../src/utils/historicalJson.js";

const context = {
  playerId: "player-base44",
  fotmobPlayerId: "737066",
  stats: [{
    season: "2022/2023",
    competition: "Premier League",
    team_id: "city-id",
    fotmob_team_id: "8456",
    team_name: "Manchester City",
  }],
  teams: [{ id: "city-id", fotmob_id: "8456", name: "Manchester City" }],
};
const base = {
  schema: "mf_legacy_historical_import_v1",
  player: { fotmob_id: "737066", name: "Erling Haaland" },
  valuations: [{ season: "2022/2023", fifa_fc_overall: 88, transfermarkt_value_eur: 180000000 }],
  team_matches: [{ season: "2022/2023", team_name: "Manchester City", competition: "Premier League", team_matches: 38 }],
};
test("JSON completo genera Overall, valor de mercado y PJ Equipo, vinculados a club", () => {
  const [v, t] = prepareHistoricalJson(JSON.stringify(base), context);
  assert.deepEqual(v.errors, []);
  assert.equal(v.payload.fifa_fc_overall, 88);
  assert.equal(v.payload.transfermarkt_value_eur, 180000000);
  assert.equal(v.payload.fifa_edition, "FIFA 23");
  assert.deepEqual(t.errors, []);
  assert.equal(t.payload.team_id, "city-id");
  assert.equal(t.payload.team_matches, 38);
});
test("rechaza JSON de otro jugador", () => {
  const other = structuredClone(base);
  other.player.fotmob_id = "123";
  assert.throws(() => prepareHistoricalJson(JSON.stringify(other), context), /FotMob ID/);
});
test("ausencias nulas no se convierten en 0", () => {
  const input = structuredClone(base);
  input.valuations[0].transfermarkt_value_eur = null;
  const [v] = prepareHistoricalJson(JSON.stringify(input), context);
  assert.equal(v.errors.length, 0);
  assert.equal(v.payload.transfermarkt_value_eur, undefined);
});
test("duplicados bloquean ambas temporadas", () => {
  const input = structuredClone(base);
  input.valuations.push({ season: "2022/2023", fifa_fc_overall: 89 });
  const rows = prepareHistoricalJson(JSON.stringify(input), context).filter(r => r.type === "valuation");
  assert.equal(rows.every(r => r.errors.length > 0), true);
});
test("rechaza clubes desconocidos y PJ inválidos", () => {
  const input = structuredClone(base);
  input.team_matches[0].team_name = "Otro equipo";
  input.team_matches[0].team_matches = 0;
  const t = prepareHistoricalJson(JSON.stringify(input), context).find(r => r.type === "team");
  assert.ok(t.errors.some(e => e.includes("Club")));
  assert.ok(t.errors.some(e => e.includes("PJ Equipo")));
});
test("temporadas naturales no se confunden con partidas", () => {
  const input = structuredClone(base);
  input.valuations[0].season = "2018";
  const [v] = prepareHistoricalJson(JSON.stringify(input), context);
  assert.equal(v.season, "2018");
  assert.equal(v.payload.fifa_edition, undefined);
});
test("fecha posterior al cierre se rechaza", () => {
  const input = structuredClone(base);
  input.valuations[0].market_value_as_of = "2023-07-01";
  const [v] = prepareHistoricalJson(JSON.stringify(input), context);
  assert.ok(v.errors.some(e => e.includes("Fecha")));
});
test("reconcilia el Manchester City real: Team de Base44 sin FotMob y Stats con FotMob sin team_id", () => {
  const actualContext = {
    ...context,
    stats: [
      { season: "2022/2023", competition: "Community Shield", team_id: "", fotmob_team_id: "8456", team_name: "Manchester City" },
      { season: "2022/2023", competition: "Premier League", team_id: "", fotmob_team_id: "8456", team_name: "Manchester City" },
      { season: "2024/2025", competition: "Champions League", team_id: "", fotmob_team_id: "8456", team_name: "Manchester City" },
    ],
    teams: [{ id: "6ac60cf602cc5a0b7b24059a", name: "Manchester City", fotmob_id: null }],
  };
  const imported = structuredClone(base);
  imported.team_matches = [
    { season: "2022/2023", team_name: "Manchester City", competition: "FA Community Shield", team_matches: 1 },
    { season: "2024/2025", team_name: "Manchester City", competition: "Champions League", team_matches: 10 },
  ];
  const rows = prepareHistoricalJson(JSON.stringify(imported), actualContext).filter(r => r.type === "team");
  assert.equal(rows.length, 2);
  for (const r of rows) {
    assert.deepEqual(r.errors, []);
    assert.equal(r.payload.team_id, "6ac60cf602cc5a0b7b24059a");
    assert.equal(r.payload.fotmob_team_id, "8456");
  }
  assert.equal(rows[0].payload.competition, "Community Shield");
});

test("reconcilia Dortmund, Bryne FK, Molde FK, Red Bull Salzburg desde registros históricos de Haaland", () => {
  const historical = [
    { name: "Borussia Dortmund", fotmob: "9789", season: "2020/2021", competition: "DFB Pokal", inputCompetition: "DFB-Pokal" },
    { name: "Bryne", fotmob: "8531", season: "2016", competition: "1. Divisjon", inputName: "Bryne FK", inputCompetition: "Norwegian First Division" },
    { name: "Molde", fotmob: "9917", season: "2017", competition: "Cup", inputName: "Molde FK", inputCompetition: "Norwegian Cup" },
    { name: "Salzburg", fotmob: "10013", season: "2018/2019", competition: "Bundesliga", inputName: "Red Bull Salzburg", inputCompetition: "Austrian Bundesliga" },
  ];
  const ctx = {
    ...context,
    stats: historical.map(h => ({ season: h.season, team_name: h.name,
      fotmob_team_id: h.fotmob, team_id: "", competition: h.competition })),
    teams: [{ id: "dortmund-base44", name: "Borussia Dortmund", fotmob_id: null }],
  };
  const input = structuredClone(base);
  input.team_matches = historical.map(h => ({
    season: h.season, team_name: h.inputName || h.name,
    competition: h.inputCompetition, team_matches: 2,
  }));
  const rows = prepareHistoricalJson(JSON.stringify(input), ctx).filter(r => r.type === "team");
  assert.equal(rows.length, 4);
  for (let i = 0; i < historical.length; i++) {
    assert.deepEqual(rows[i].errors, []);
    assert.equal(rows[i].payload.fotmob_team_id, historical[i].fotmob);
    assert.equal(rows[i].payload.competition, historical[i].competition);
  }
  assert.equal(rows[0].payload.team_id, "dortmund-base44");
});

test("no fusiona dos clubes con el mismo nombre y FotMob IDs incompatibles", () => {
  const lookup = resolveHistoricalTeam({ team_name: "Manchester City" }, [
    { team_name: "Manchester City", fotmob_team_id: "8456", team_id: "" },
    { team_name: "Manchester City", fotmob_team_id: "111111", team_id: "" },
  ], []);
  assert.equal(lookup.team, null);
  assert.match(lookup.error, /incompatibles/);
});

test("no confunde nombres de competición que designan eliminatorias diferentes", () => {
  assert.equal(canonicalHistoricalCompetition("Europa League Qualification qualification") !==
               canonicalHistoricalCompetition("Europa League"), true);
});

test("conserva otros valores al editar solo Overall", () => {
  const v = { fifa_fc_overall: 91, fifa_edition: "FIFA 23" };
  const previous = { fifa_fc_overall: 88, transfermarkt_value_eur: 180000000 };
  const change = rowChanges(v, previous, "valuation");
  assert.equal(change.status, "update");
  assert.equal(change.changes.some(c => c.field === "transfermarkt_value_eur"), false);
});
