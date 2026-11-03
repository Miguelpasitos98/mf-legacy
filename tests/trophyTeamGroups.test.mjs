import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {groupTrophiesByTeamReputation,teamReputationValue} from "../src/utils/trophyTeamGroups.js";
import {trophyViewGroups} from "../src/utils/trophyViews.js";
const teams=[
 {id:"B",name:"Barcelona",reputation:"9,400",logo:"https://example.com/b.png"},
 {id:"R",name:"Real Madrid",reputation:"9700"},
 {id:"C",name:"Cádiz CF",reputation:"6 300"},
 {id:"Q",name:"Equipo sin reputación",reputation:""}
];
const catalog=[
 {source_id:"ucl",name:"UEFA Champions League",reputation:195,country_resolution:"international"},
 {source_id:"league",name:"LaLiga",reputation:185,country_id:"es",category:"League"},
 {source_id:"cup",name:"Copa del Rey",reputation:169,country_id:"es",category:"Cup"}
];
const honours=[
 {id:"h1",trophy_source_id:"league",recipient_type:"Team",recipient_id:"B",verified:true,season:"2024/25"},
 {id:"h2",trophy_source_id:"league",recipient_type:"Team",recipient_id:"B",verified:true,season:"2023/24"},
 {id:"h3",trophy_source_id:"cup",recipient_type:"Team",recipient_id:"C",verified:false,season:"2023/24"},
 {id:"h4",trophy_source_id:"league",recipient_type:"Team",recipient_id:"R",verified:true,season:"2022/23"}
];
const editions=[
 {edition_key:"ucl_2022_23",champion_team_id:"R",trophy_source_id:"ucl",season:"2022/23",verification_status:"source_extracted"},
 {edition_key:"ucl_2021_22",champion_team_id:"R",trophy_source_id:"ucl",season:"2021/22",verification_status:"source_extracted"},
 {edition_key:"ucl_2020_21",champion_team_id:"B",trophy_source_id:"ucl",season:"2020/21",verification_status:"source_extracted"}
];
test("All teams appear including teams without honours, descending by same 0–10000 reputation as Players",()=>{
 const groups=groupTrophiesByTeamReputation({teams,catalog,honours,editions});
 assert.deepEqual(groups.map(g=>g.id),["R","B","C","Q"]);
 assert.deepEqual(groups.map(g=>g.reputation),[9700,9400,6300,0]);
 assert.equal(groups.find(g=>g.id==="Q").items.length,0);
 assert.equal(teamReputationValue({reputation:"9,400"}),9400);
});
test("Trophies appear under clubs with unique trophy cards and distinct provisional & verified counts",()=>{
 const groups=groupTrophiesByTeamReputation({teams,catalog,honours,editions});
 const madrid=groups.find(g=>g.id==="R");
 assert.equal(madrid.items.length,2);
 assert.equal(madrid.items.find(x=>x.trophy.source_id==="ucl").historicalCount,2);
 assert.equal(madrid.items.find(x=>x.trophy.source_id==="league").verifiedCount,1);
 const barca=groups.find(g=>g.id==="B");
 assert.equal(barca.items.length,2);
 assert.equal(barca.items.find(x=>x.trophy.source_id==="league").verifiedCount,2);
 assert.equal(barca.items.find(x=>x.trophy.source_id==="ucl").historicalCount,1);
 assert.equal(groups.find(g=>g.id==="C").items.length,0);
});
test("Filtering group names, records and title source works without deleting empty teams",()=>{
 const a=groupTrophiesByTeamReputation({teams,catalog,honours,editions,query:"cadiz"});
 assert.deepEqual(a.map(g=>g.id),["C"]);
 const b=groupTrophiesByTeamReputation({teams,catalog,honours,editions,sourceMode:"historical"});
 assert.equal(b.find(g=>g.id==="R").items.length,1);
 assert.equal(b.find(g=>g.id==="R").items[0].trophy.source_id,"ucl");
 assert.equal(b.find(g=>g.id==="Q").items.length,0);
 const filtered=groupTrophiesByTeamReputation({teams,catalog,honours,editions,allowedIds:new Set(["league"])});
 assert.equal(filtered.find(g=>g.id==="R").items.length,1);
});
test("Accepted archive champions appear as the same trophies as verified cards without duplicate editions",()=>{
 const palmares=[
  {entry_key:"L1",team_id:"B",trophy_source_id:"league",rank:"winner",calendar_year:2025,match_status:"manual_linked"},
  {entry_key:"L2",team_id:"R",trophy_source_id:"league",rank:"winner",calendar_year:2023,match_status:"auto_linked"},
  {entry_key:"L3",team_id:"R",trophy_source_id:"league",rank:"winner",calendar_year:2022,match_status:"auto_linked"},
  {entry_key:"L4",team_id:"R",trophy_source_id:"league",rank:"runner_up",calendar_year:2021,match_status:"manual_linked"},
  {entry_key:"L5",team_id:"R",trophy_source_id:"league",rank:"winner",calendar_year:2020,match_status:"needs_review"}
 ];
 const groups=groupTrophiesByTeamReputation({teams,catalog,honours,editions,palmares});
 const barca=groups.find(g=>g.id==="B").items.find(x=>x.trophy.source_id==="league");
 assert.equal(barca.verifiedCount,2);
 assert.equal(barca.totalWins,2);
 const madrid=groups.find(g=>g.id==="R").items.find(x=>x.trophy.source_id==="league");
 assert.equal(madrid.historicalCount,2);
 assert.equal(madrid.totalWins,2);
 assert.equal(madrid.runnerUpCount,1);
});
test("Club catalog keeps image ID review separate from accepted historical trophy counts",()=>{
 const page=readFileSync(new URL("../src/components/trophies/TrophyClubCatalogView.jsx",import.meta.url),"utf8");
 assert.match(page,/count=\{item.totalWins\}/);
 assert.match(page,/item.totalWins>0/);
 assert.doesNotMatch(page,/FM24 provisional/);
 assert.match(page,/Las coincidencias de identidad pendientes no se incluyen/);
});
test("Trophy strips rank each club trophy by editorial reputation, not title count",()=>{
 const groups=groupTrophiesByTeamReputation({teams,catalog,honours,editions});
 assert.deepEqual(groups.find(g=>g.id==="R").items.map(x=>x.trophy.source_id),["ucl","league"]);
 const highWins=[{entry_key:"many-1",team_id:"R",trophy_source_id:"league",rank:"winner",calendar_year:2018,match_status:"manual_linked"},
  {entry_key:"many-2",team_id:"R",trophy_source_id:"league",rank:"winner",calendar_year:2019,match_status:"manual_linked"}];
 const ordered=groupTrophiesByTeamReputation({teams,catalog,honours,editions,palmares:highWins});
 assert.deepEqual(ordered.find(g=>g.id==="R").items.map(x=>x.reputationScore),[195,185]);
});
test("Club view uses one horizontal scrollable row with arrows per team",()=>{
 const view=readFileSync(new URL("../src/components/trophies/TrophyClubCatalogView.jsx",import.meta.url),"utf8");
 assert.match(view,/overflow-x-auto/);
 assert.match(view,/scrollBy\(\{left:direction\*420,behavior:"smooth"\}\)/);
 assert.match(view,/snap-x snap-proximity/);
 assert.match(view,/shrink-0 snap-start/);
 assert.match(view,/TrophyHorizontalStrip group=\{group\}/);
 assert.doesNotMatch(view,/grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6/);
});
test("Gallery defaults to highest trophy reputation but optional name sorting remains",()=>{
 const page=readFileSync(new URL("../src/pages/Trophies.jsx",import.meta.url),"utf8");
 assert.match(page,/const \[sortMode,setSortMode\]=useState\("reputation_desc"\)/);
 assert.match(page,/setSortMode\("reputation_desc"\)/);
 const gallery=trophyViewGroups(catalog,"gallery",[],[],"reputation_desc");
 const ranks=gallery.flatMap(g=>g.items.map(t=>t.reputation));
 assert.deepEqual(ranks,[195,185,169]);
 const alpha=trophyViewGroups(catalog,"gallery",[],[],"name");
 assert.equal(alpha.flatMap(g=>g.items).length,3);
});
