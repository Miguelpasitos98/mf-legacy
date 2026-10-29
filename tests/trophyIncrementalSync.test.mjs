import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {normalizedTrophyCompetition,planIncrementalTrophyCredits,trophyCreditLogicalKey} from "../src/utils/trophyIncrementalSync.js";

const teams=[{id:"b",name:"FC Barcelona"},{id:"r",name:"Real Madrid"}];
const players=[{id:"p1",name:"Jugador 1"},{id:"p2",name:"Jugador 2"},{id:"p3",name:"Jugador 3"}];
const trophies=[
 {source_id:"l",name:"LaLiga EA Sports",trophy_type:"Team Trophy"},
 {source_id:"c",name:"UEFA Champions League",trophy_type:"Team Trophy"},
 {source_id:"s",name:"Supercopa de España",trophy_type:"Team Trophy"},
 {source_id:"i",name:"Balón de Oro",trophy_type:"Individual Trophy"}
];
const honours=[
 {id:"h1",trophy_source_id:"l",recipient_type:"Team",recipient_id:"b",season:"2024/2025",verified:true,source_url:"https://laliga.com"},
 {id:"h1copy",trophy_source_id:"l",recipient_type:"Team",recipient_id:"b",season:"2024/2025",verified:true},
 {id:"h2",trophy_source_id:"c",recipient_type:"Team",recipient_id:"b",season:"2024/2025",verified:true},
 {id:"h3",trophy_source_id:"s",recipient_type:"Team",recipient_id:"b",season:"2024/2025",verified:true},
 {id:"h4",trophy_source_id:"l",recipient_type:"Team",recipient_id:"r",season:"2023/2024",verified:false},
 {id:"h5",trophy_source_id:"i",recipient_type:"Team",recipient_id:"b",season:"2024/2025",verified:true}
];
const stats=[
 {id:"a",player_id:"p1",team_id:"b",season:"2024/2025",competition:"LaLiga EA Sports",appearances:31},
 {id:"b",player_id:"p2",team_id:"b",season:"2024/2025",competition:"LaLiga",appearances:2},
 {id:"c",player_id:"p1",team_id:"b",season:"2024/2025",competition:"Champions League",appearances:12},
 {id:"d",player_id:"p3",team_id:"b",season:"2024/2025",competition:"LaLiga",appearances:0},
 {id:"e",player_id:"p3",team_id:"r",season:"2024/2025",competition:"LaLiga",appearances:18},
 {id:"f",player_id:"p1",team_id:"b",season:"2023/2024",competition:"LaLiga",appearances:40},
 {id:"g",player_id:"p1",team_id:"b",season:"2024/2025",competition:"Champions League Qualifying",appearances:4},
 {id:"h",player_id:"missing",team_id:"b",season:"2024/2025",competition:"LaLiga",appearances:34}
];
const make=overrides=>planIncrementalTrophyCredits({honours,stats,players,teams,trophies,...overrides});
test("Strict competition aliases match actual STATS but reject qualification or other cups",()=>{
 assert.equal(normalizedTrophyCompetition("UEFA Champions League"),normalizedTrophyCompetition("Champions League"));
 assert.equal(normalizedTrophyCompetition("LaLiga EA Sports"),normalizedTrophyCompetition("LaLiga"));
 assert.notEqual(normalizedTrophyCompetition("Champions League Qualifying"),normalizedTrophyCompetition("UEFA Champions League"));
 assert.notEqual(normalizedTrophyCompetition("Copa del Rey"),normalizedTrophyCompetition("Supercopa de España"));
});
test("Only verified team titles and official-competition appearances produce candidates",()=>{
 const plan=make();
 assert.equal(plan.editions,3);
 assert.equal(plan.plans.length,3);
 assert.deepEqual(plan.plans.map(x=>[x.player_id,x.trophy_source_id]).sort(),[["p1","c"],["p1","l"],["p2","l"]]);
 assert.equal(plan.plans.every(row=>row.status==="candidate"&&row.verified===false&&row.source_url===""),true);
 assert.equal(plan.review.length,1);
 assert.equal(plan.review[0].trophy_source_id,"s");
 assert.equal(plan.plans.some(x=>x.player_id==="p3"),false);
});
test("Existing confirmed excluded or candidate credits across cloned winner editions are all preserved",()=>{
 const credits=[
 {trophy_honour_id:"h1copy",player_id:"p1",team_id:"b",season:"2024/2025",trophy_source_id:"l",status:"confirmed",verified:true},
 {trophy_honour_id:"h2",player_id:"p1",team_id:"b",season:"2024/2025",trophy_source_id:"c",status:"excluded",verified:false},
 {trophy_honour_id:"h1",player_id:"p2",team_id:"b",season:"2024/2025",trophy_source_id:"l",status:"candidate",verified:false}
 ];
 const plan=make({credits});
 assert.equal(plan.plans.length,0);
 assert.equal(plan.skipped,3);
 assert.equal(plan.editions,3);
});
test("A newly imported season is detected without scanning or overwriting old decisions",()=>{
 const older=make({stats:stats.filter(r=>r.season==="2023/2024")});
 assert.equal(older.plans.length,0);
 const fresh=make({stats});
 assert.equal(fresh.plans.length,3);
 const reloaded=make({stats,credits:fresh.plans.map((plan,i)=>({...plan,id:String(i)}))});
 assert.equal(reloaded.plans.length,0);
});
test("Missing identity, unspecified competitions or zero appearances never create credits",()=>{
 const broken=[{player_id:"p1",team_id:"",season:"2024/2025",competition:"LaLiga",appearances:30},
  {player_id:"p1",team_id:"b",season:"2024/2025",competition:"",appearances:30},
  {player_id:"p1",team_id:"b",season:"2024/2025",competition:"LaLiga",appearances:0},
  {player_id:"p2",team_id:"b",season:"2024/2025",competition:"LaLiga Femenina",appearances:24},
  {player_id:"p3",team_id:"b",season:"2024/2025",competition:"LaLiga",appearances:-4},
  {player_id:"nope",team_id:"b",season:"2024/2025",competition:"LaLiga",appearances:30}];
 const plan=make({stats:broken});
 assert.equal(plan.plans.length,0);
 assert.equal(plan.review.length,3);
});
test("A missing player in STATS cannot be inferred merely from the player name",()=>{
 const statsOne=[{team_id:"b",player_name:"Jugador 1",season:"2024/2025",competition:"LaLiga",appearances:28}];
 assert.equal(make({stats:statsOne}).plans.length,0);
});
test("UI auto-detects on Review mount, processes bounded batches, and checks full Stats snapshot",()=>{
 const panel=readFileSync(new URL("../src/components/trophies/TrophyIncrementalSync.jsx",import.meta.url),"utf8");
 const review=readFileSync(new URL("../src/components/trophies/TrophyReviewCenter.jsx",import.meta.url),"utf8");
 const page=readFileSync(new URL("../src/pages/Trophies.jsx",import.meta.url),"utf8");
 assert.match(panel,/const MAX_AUTO=40,MAX_MANUAL=200/);
 assert.match(panel,/void scan\(true\)/);
 assert.match(panel,/statsSnapshotOptions\(\)/);
 assert.match(panel,/staleTime:0/);
 assert.match(panel,/PlayerTrophyCredit\.create\(payload\)/);
 const planModule=readFileSync(new URL("../src/utils/trophyIncrementalSync.js",import.meta.url),"utf8");
 assert.match(planModule,/status:"candidate",verified:false/);
 assert.match(review,/<TrophyIncrementalSync/);
 assert.match(page,/catalogReady=/);
});
test("The credit logical key is stable for a team-season-trophy-player combination",()=>{
 assert.equal(trophyCreditLogicalKey("b","2024/2025","l","p1"),"b|2024/2025|l|p1");
 assert.notEqual(trophyCreditLogicalKey("b","2024/2025","l","p1"),trophyCreditLogicalKey("b","2023/2024","l","p1"));
});
