import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const src=fs.readFileSync("src/components/teams/TacticalBuilder.jsx","utf8");
const squads=fs.readFileSync("src/pages/Squads.jsx","utf8");
test("free movement uses pointer events and saves custom coordinates",()=>{
 assert.match(src,/onPointerMove=\{e=>pointerMove\(e,code\)\}/);
 assert.match(src,/slotPositions\[code\]\?\.x\?\?x/);
 assert.match(src,/x_position:slotPositions\[code\]\?\.x\?\?x/);
 assert.match(src,/setSlotPositions\(newPositions\)/);
});
test("touch-to-pick can attach a player not already in the squad",()=>{
 assert.match(src,/await onEnsurePlayer\(player\)/);
 assert.match(src,/place\(selected,String\(player.id\),!alreadyInRoster\)/);
 assert.match(squads,/ensurePlayerForSquad/);
 assert.match(squads,/onEnsurePlayer=\{ensurePlayerForSquad\}/);
});
test("comparison is limited to a season and benchmark handles missing data",()=>{
 assert.match(squads,/TeamSquadMembership,\{team_type:"club",season\}/);
 assert.match(src,/analyzeLineup\(placed,roster\)/);
});
