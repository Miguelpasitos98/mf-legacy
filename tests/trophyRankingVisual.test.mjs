import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {archiveOverview,searchArchiveRows} from "../src/utils/trophyArchiveOverview.js";
const trophies=[
 {source_id:"L",name:"LaLiga",trophy_type:"Team Trophy"},
 {source_id:"C",name:"Copa del Rey",trophy_type:"Team Trophy"}
];
const honours=[
 {id:"h1",trophy_source_id:"L",season:"2024/2025",recipient_type:"Team",recipient_id:"barca",recipient_name:"FC Barcelona",verified:true},
 {id:"h2",trophy_source_id:"C",season:"2024/2025",recipient_type:"Team",recipient_id:"barca",recipient_name:"FC Barcelona",verified:true},
 {id:"h3",trophy_source_id:"L",season:"2023/2024",recipient_type:"Team",recipient_id:"madrid",recipient_name:"Real Madrid",verified:true},
 {id:"h4",trophy_source_id:"L",season:"2022/2023",recipient_type:"Team",recipient_id:"barca",recipient_name:"FC Barcelona",verified:true},
 {id:"h5",trophy_source_id:"C",season:"2022/2023",recipient_type:"Team",recipient_id:"madrid",recipient_name:"Real Madrid",verified:false}
];
test("A club's trophy strip uses exact historical counts per distinct trophy",()=>{
 const overview=archiveOverview(honours,[],trophies);
 const barca=overview.clubs.find(c=>c.id==="barca");
 assert.equal(barca.total,3);
 assert.equal(barca.trophyCounts.get("L"),2);
 assert.equal(barca.trophyCounts.get("C"),1);
 assert.equal(barca.distinct,2);
 assert.equal(overview.competitions.find(c=>c.source_id==="L").latestWinner,"FC Barcelona");
});
test("Player awards count separately per verified competition and exclude pending",()=>{
 const credits=[
  {trophy_honour_id:"h1",team_id:"barca",player_id:"p",season:"2024/2025",status:"confirmed",verified:true},
  {trophy_honour_id:"h2",team_id:"barca",player_id:"p",season:"2024/2025",status:"confirmed",verified:true},
  {trophy_honour_id:"h3",team_id:"madrid",player_id:"p",season:"2023/2024",status:"candidate",verified:false},
  {trophy_honour_id:"h5",team_id:"madrid",player_id:"p",season:"2022/2023",status:"confirmed",verified:true}
 ];
 const overview=archiveOverview(honours,credits,trophies,[{id:"p",name:"Jugador Prueba"}]);
 const player=overview.players[0];
 assert.equal(player.total,2);
 assert.equal(player.trophyCounts.get("L"),1);
 assert.equal(player.trophyCounts.get("C"),1);
});
test("Season filtering recalculates club and player rankings on only selected editions",()=>{
 const filtered=honours.filter(h=>h.season==="2024/2025");
 const overview=archiveOverview(filtered,[],trophies);
 assert.equal(overview.clubs[0].total,2);
 assert.equal(overview.clubs.length,1);
 assert.equal(overview.competitions.length,2);
});
test("Rank cards link to the correct real profile routes and trophy details, not a made-up route",()=>{
 const cards=readFileSync(new URL("../src/components/trophies/TrophyRankingCard.jsx",import.meta.url),"utf8");
 const overview=readFileSync(new URL("../src/components/trophies/TrophyArchiveOverview.jsx",import.meta.url),"utf8");
 const players=readFileSync(new URL("../src/pages/Players.jsx",import.meta.url),"utf8");
 const teams=readFileSync(new URL("../src/pages/Teams.jsx",import.meta.url),"utf8");
 assert.match(cards,/onOpenProfile\?\.\(item\.id\)/);
 assert.match(cards,/onOpenTrophy\?\.\(sourceId\)/);
 assert.match(overview,/navigate\("\/players\?stats_player="\+encodeURIComponent\(id\)\)/);
 assert.match(overview,/navigate\("\/teams\?stats_team="\+encodeURIComponent\(id\)\)/);
 assert.match(players,/searchParams\.get\("stats_player"\)/);
 assert.match(teams,/statsQueryParams\.get\("stats_team"\)/);
 assert.match(overview,/rankById\.get\(String\(item\.id\)\)/);
});
test("Archive search is accent and punctuation insensitive with no invented matches",()=>{
 const overview=archiveOverview(honours,[],trophies);
 assert.equal(searchArchiveRows(overview.competitions,"la liga").length,1);
 assert.equal(searchArchiveRows(overview.competitions,"laliga").length,1);
 assert.equal(searchArchiveRows(overview.clubs,"barcelona").length,1);
 assert.equal(searchArchiveRows(overview.clubs,"nonsensical").length,0);
});
