import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {groupPlayersByLeague} from "../src/components/players/playerLeagueGroups.mjs";
import {sanitizePlayersViewState} from "../src/utils/playersViewState.js";

const leagues=[
 {id:"la",name:"LaLiga EA Sports",logo:"https://example.com/laliga.png",reputation:8000},
 {id:"pl",name:"Premier League",logo:"https://example.com/pl.png",reputation:9000}
];
const teams={
 barca:{id:"barca",name:"FC Barcelona",leagueId:"la",logo:"barca.png"},
 madrid:{id:"madrid",name:"Real Madrid",league_id:"la"},
 mancity:{id:"mancity",name:"Manchester City",leagueId:"pl"},
 orphan:{id:"orphan",name:"Unknown FC",league_id:"not-found"},
 unassigned:{id:"unassigned",name:"Local FC"}
};
const players=[
 {id:"p1",name:"Uno",teamId:"barca"}, {id:"p2",name:"Dos",teamId:"barca"},
 {id:"p3",name:"Tres",teamId:"madrid"}, {id:"p4",name:"Cuatro",teamId:"mancity"},
 {id:"p5",name:"Cinco",teamId:"orphan"}, {id:"p6",name:"Seis",teamId:"unassigned"},
 {id:"p7",name:"Siete",teamId:"missing"}
];
test("group by current league then club, with names and logos from existing records",()=>{
 const groups=groupPlayersByLeague(players,teams,leagues);
 assert.equal(groups[0].name,"Premier League");
 assert.equal(groups.find(g=>g.id==="la").name,"LaLiga EA Sports");
 assert.equal(groups.find(g=>g.id==="la").logo,leagues[0].logo);
 assert.equal(groups.find(g=>g.id==="la").count,3);
 assert.deepEqual(groups.find(g=>g.id==="la").teams.map(t=>t.name),["FC Barcelona","Real Madrid"]);
 assert.deepEqual(groups.find(g=>g.id==="la").teams[0].players.map(p=>p.id),["p1","p2"]);
});
test("unassigned and unknown leagues never lose or duplicate a player",()=>{
 const groups=groupPlayersByLeague(players,teams,leagues);
 const all=groups.flatMap(g=>g.teams.flatMap(t=>t.players));
 assert.deepEqual(new Set(all.map(p=>p.id)),new Set(players.map(p=>p.id)));
 assert.equal(all.length,players.length);
 const empty=groups.find(g=>g.id==="__no_league__");
 assert.ok(empty);
 assert.deepEqual(empty.teams.map(g=>g.name),["Local FC","Sin equipo"]);
 assert.equal(groups.find(g=>g.id==="not-found").unresolved,true);
});
test("grouping responds to existing filtered list, never a speculative historical league",()=>{
 const filtered=groupPlayersByLeague(players.filter(p=>p.id==="p1"),teams,leagues);
 assert.equal(filtered.length,1);
 assert.equal(filtered[0].count,1);
 assert.equal(filtered[0].teams[0].team.id,"barca");
 assert.deepEqual(groupPlayersByLeague([],teams,leagues),[]);
});
test("Players and sidebar recognise new views, and browser view state remembers them",()=>{
 const playersCode=fs.readFileSync("src/pages/Players.jsx","utf8");
 const sidebarCode=fs.readFileSync("src/components/Sidebar.jsx","utf8");
 for(const mode of ["leagues","candidates"]){
  assert.equal(sanitizePlayersViewState({view:mode}).view,mode);
  assert.ok(playersCode.includes(`viewMode === "${mode}"`));
  assert.ok(sidebarCode.includes(`id: "${mode}"`));
 }
 assert.match(playersCode,/base44.entities.League.list/);
 assert.match(playersCode,/groupPlayersByLeague\(filteredPlayers,teamById,catalogLeagues\)/);
 assert.match(sidebarCode,/VIEW_OPTIONS.slice\(4\)/);
 assert.match(sidebarCode,/\?view=\$\{view\}/);
});
