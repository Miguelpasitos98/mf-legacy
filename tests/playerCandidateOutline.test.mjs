import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {candidateOutlineClass} from "../src/components/players/playerCandidateOutline.mjs";
test("candidate receives green outline but normal players stay neutral",()=>{
 assert.match(candidateOutlineClass({manager_fit_candidate:true}),/border-emerald-600/);
 assert.match(candidateOutlineClass({manager_fit_candidate:true}),/ring-emerald-300/);
 assert.equal(candidateOutlineClass({manager_fit_candidate:false}),"border-slate-200 hover:border-slate-300");
 assert.equal(candidateOutlineClass({}),"border-slate-200 hover:border-slate-300");
});
test("bulk selection stays blue, but candidate identity remains visible simultaneously",()=>{
 const selected=candidateOutlineClass({manager_fit_candidate:false},true);
 assert.match(selected,/border-blue-700/);
 assert.match(selected,/ring-blue-300/);
 const both=candidateOutlineClass({manager_fit_candidate:true},true);
 assert.match(both,/border-emerald-600/);
 assert.match(both,/ring-blue-400/);
 assert.doesNotMatch(both,/ring-emerald-300/);
});
test("nonboolean values cannot label a player as opted-in",()=>{
 assert.equal(candidateOutlineClass({manager_fit_candidate:"true"}),candidateOutlineClass({}));
 assert.equal(candidateOutlineClass({manager_fit_candidate:null}),candidateOutlineClass({}));
});
test("all PLAYERS views use the same card and saved candidate flag",()=>{
 const card=fs.readFileSync("src/components/players/PlayerCard.jsx","utf8");
 const players=fs.readFileSync("src/pages/Players.jsx","utf8");
 assert.match(card,/candidateOutlineClass\(player,selected\)/);
 assert.match(card,/en bolsa de candidatos Manager Fit/);
 assert.match(players,/const normalizePlayer = \(player\) => \(\{\s*\.\.\.player,/);
 for(const mode of ['viewMode === "all"','viewMode === "teams"','viewMode === "countries"','viewMode === "positions"','viewMode === "age"']){
   assert.ok(players.includes(mode));
 }
});
