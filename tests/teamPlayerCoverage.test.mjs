import test from "node:test";
import assert from "node:assert/strict";
import { countCurrentPlayersByTeam, coveredTeamsCount, TEAM_COVERAGE_THRESHOLD } from "../src/components/teams/teamPlayerCoverage.mjs";

test("la cobertura usa IDs actuales y umbral de cinco jugadores", () => {
  const players = [
    ...Array.from({ length: 5 }, (_, index) => ({ id: "a" + index, team_id: "team-a", career_status: "active" })),
    ...Array.from({ length: 4 }, (_, index) => ({ id: "b" + index, teamId: "team-b" })),
    { id: "a0", team_id: "team-a" }, // Registro duplicado: no cuenta dos veces.
    { id: "free", team_id: "", career_status: "free_agent" },
    { id: "retired", team_id: "team-a", career_status: "retired" },
    { id: "old", last_team_id: "team-a" }, // La trayectoria no es la plantilla actual.
    { id: "club", club_id: "team-c" },
  ];
  const counts = countCurrentPlayersByTeam(players);
  assert.equal(TEAM_COVERAGE_THRESHOLD, 5);
  assert.equal(counts.get("team-a"), 5);
  assert.equal(counts.get("team-b"), 4);
  assert.equal(counts.get("team-c"), 1);
  assert.equal(coveredTeamsCount([{id:"team-a"},{id:"team-b"},{id:"team-c"}], counts), 1);
  assert.equal(coveredTeamsCount([{id:"team-b"},{id:"team-c"}], counts), 0);
});

test("un jugador con referencias históricas no genera cobertura falsa", () => {
  const counts = countCurrentPlayersByTeam([
    { id:"1", last_team_id:"a" },
    { id:"2", team_id:"", last_team_id:"a" },
    { id:"3", team_id:"__retired__" },
    { id:"4", teamId:"a", careerStatus:"free_agent" },
  ]);
  assert.equal(counts.size, 0);
  assert.equal(coveredTeamsCount([{id:"a"}], counts), 0);
});

test("la cuenta es segura si falta la instantánea de Players", () => {
  assert.equal(countCurrentPlayersByTeam(undefined).size, 0);
  assert.equal(coveredTeamsCount([], new Map()), 0);
});
