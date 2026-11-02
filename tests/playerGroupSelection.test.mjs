import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {groupPlayerIds,selectedGroupCount,toggleGroupSelection} from "../src/components/players/playerGroupSelection.mjs";
const teams={
 red:[{id:"r1"},{id:"r2"}],
 blue:[{id:"b1"},{id:"b2"}]
};
const league=[...teams.red,...teams.blue];
test("select entire league with one click without touching other existing selections",()=>{
 const selected=toggleGroupSelection(["other"],league);
 assert.deepEqual(selected,["other","r1","r2","b1","b2"]);
 assert.equal(selectedGroupCount(selected,league),4);
 assert.deepEqual(toggleGroupSelection(selected,league),["other"]);
});
test("select a single team and then all of its league, then deselect only a team",()=>{
 let chosen=toggleGroupSelection([],teams.red);
 assert.deepEqual(chosen,["r1","r2"]);
 chosen=toggleGroupSelection(chosen,league);
 assert.equal(chosen.length,4);
 chosen=toggleGroupSelection(chosen,teams.red);
 assert.deepEqual(chosen,["b1","b2"]);
});
test("partial group selection selects all, while fully selected group clears",()=>{
 assert.deepEqual(toggleGroupSelection(["r1","outside"],teams.red),["r1","outside","r2"]);
 assert.deepEqual(toggleGroupSelection(["r1","r2","outside"],teams.red),["outside"]);
});
test("select filtered visible players, preserve hidden ones and never duplicate IDs",()=>{
 const filtered=[{id:"r1"},{id:"r1"},{id:""},{id:null},{id:"r2"}];
 assert.deepEqual(groupPlayerIds(filtered),["r1","r2"]);
 assert.deepEqual(toggleGroupSelection(["outside","r1"],filtered),["outside","r1","r2"]);
 assert.equal(selectedGroupCount(new Set(["r1","outside"]),filtered),1);
 assert.deepEqual(toggleGroupSelection(["unseen"],[]),["unseen"]);
 const original=["unseen"];
 toggleGroupSelection(original,filtered);
 assert.deepEqual(original,["unseen"]);
});
test("UI shows select league, select team, fold league and fold all; only in bulk mode",()=>{
 const code=fs.readFileSync("src/pages/Players.jsx","utf8");
 assert.match(code,/viewMode === "leagues"/);
 assert.match(code,/toggleBulkGroup\(leaguePlayers\)/);
 assert.match(code,/toggleBulkGroup\(group\.players\)/);
 assert.match(code,/Plegar todas/);
 assert.match(code,/Desplegar todas/);
 assert.match(code,/toggleLeagueFold\(leagueKey\)/);
 assert.match(code,/toggleLeagueTeamFold\(teamKey\)/);
 assert.match(code,/!isLeagueClosed&&/);
 assert.match(code,/!isTeamClosed&&/);
 assert.match(code,/\{bulkMode&&<button type="button" disabled=\{bulkBusy/);
 assert.doesNotMatch(code,/candidateView=/);
 assert.match(code,/selectionMode=\{bulkMode\}/);
});
