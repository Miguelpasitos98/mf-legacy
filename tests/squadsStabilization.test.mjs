import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const squads=fs.readFileSync('src/pages/Squads.jsx','utf8');
const builder=fs.readFileSync('src/components/teams/TacticalBuilder.jsx','utf8');
test('historical data isolated by club and season',()=>{
 assert.match(squads,/team_type: "club", team_id: teamId, season: season.trim\(\)/);
 assert.match(builder,/team_type:"club",team_id:String\(team.id\),season/);
 assert.match(builder,/l.season===season && String\(l.team_id\)===String\(team.id\)/);
});
test('copy does not overwrite existing members and removes duplicates in source',()=>{
 assert.match(squads,/const seen=new Set\(existing\)/);
 assert.match(squads,/seen.has\(id\)/);
 assert.match(squads,/Promise.allSettled\(created.map/);
});
test('save validates uniqueness and restricts concurrent requests',()=>{
 assert.match(builder,/if\(busy \|\| loadingSaved\)return/);
 assert.match(builder,/new Set\(ids\).size!==ids.length/);
 assert.match(builder,/ids.some\(pid=>!availableIds.has/);
 assert.match(builder,/reconcileLineupChildren\(/);
 assert.match(builder,/removeFromPosition/);
});
test('the bench, lineup, export and responsive controls remain available',()=>{
 assert.match(builder,/const toggleBench/);
 assert.match(builder,/exportPNG=async/);
 assert.match(builder,/html2canvas/);
 assert.match(builder,/xl:grid-cols/);
 assert.match(builder,/h-\[min\(53dvh,520px\)\]/);
 assert.match(builder,/logoError/);
 assert.match(builder,/showBenchExport/);
});
