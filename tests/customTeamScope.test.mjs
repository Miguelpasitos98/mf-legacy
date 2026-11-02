import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { isCustomSquadTeam, filterCustomTeamRecords } from "../src/components/teams/customTeamScope.mjs";
test("Only explicitly custom clubs qualify, not all manually imported teams", () => {
  assert.equal(isCustomSquadTeam({is_custom_club:true, data_source:"Manual"}),true);
  assert.equal(isCustomSquadTeam({is_custom_club:true, data_source:"FotMob"}),true);
  assert.equal(isCustomSquadTeam({is_custom_club:false, data_source:"Manual"}),false);
  assert.equal(isCustomSquadTeam({data_source:"Manual"}),false);
  assert.equal(isCustomSquadTeam({isCustomClub:true}),true);
  assert.equal(isCustomSquadTeam(null),false);
});
test("Comparison only includes custom-team records", () => {
  const records=[{team_id:"mine"},{team_id:"real"},{team_id:"mine"}];
  assert.deepEqual(filterCustomTeamRecords(records,new Set(["mine"])),[records[0],records[2]]);
});
test("Squad UI guards invalid links and mutable actions", () => {
  const src=fs.readFileSync("src/pages/Squads.jsx","utf8");
  assert.match(src,/const team = customTeams.find/);
  assert.match(src,/!allowedTeamIds.has\(String\(id\)\)/);
  assert.match(src,/!team\|\|!player\?\.id/);
  assert.match(src,/if\(!team\|\|!validSeason/);
  assert.match(src,/filterCustomTeamRecords\(membershipRows,allowedTeamIds\)/);
});
