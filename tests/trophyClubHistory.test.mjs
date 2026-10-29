import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildClubTrophyHistory} from "../src/utils/trophyClubHistory.js";

const catalog=[{source_id:"L",name:"LaLiga"},{source_id:"C",name:"Copa del Rey"},{source_id:"U",name:"UEFA Champions League"}];
const honours=[
 {id:"la",trophy_source_id:"L",season:"2024/2025",recipient_type:"Team",recipient_id:"barca",recipient_name:"FC Barcelona",verified:true,source_url:"https://liga.example"},
 {id:"co",trophy_source_id:"C",season:"2024/2025",recipient_type:"Team",recipient_id:"barca",recipient_name:"FC Barcelona",verified:true,source_url:"https://rfef.example"},
 {id:"la2",trophy_source_id:"L",season:"2022/2023",recipient_type:"Team",recipient_id:"barca",recipient_name:"FC Barcelona",verified:true},
 {id:"pending",trophy_source_id:"U",season:"2024/2025",recipient_type:"Team",recipient_id:"barca",recipient_name:"FC Barcelona",verified:false},
 {id:"foreign",trophy_source_id:"U",season:"2023/2024",recipient_type:"Team",recipient_id:"madrid",recipient_name:"Real Madrid",verified:true},
 {id:"award",trophy_source_id:"U",season:"2024/2025",recipient_type:"Player",recipient_id:"p1",verified:true},
 {id:"la-copy",trophy_source_id:"L",season:"2024/2025",recipient_type:"Team",recipient_id:"barca",verified:true}
];
const players=[{id:"p1",name:"Jugador Uno"},{id:"p2",name:"Jugador Dos"},{id:"p3",name:"Jugador Tres"}];
const credits=[
 {trophy_honour_id:"la",player_id:"p1",team_id:"barca",season:"2024/2025",trophy_source_id:"L",status:"confirmed",verified:true},
 {trophy_honour_id:"la",player_id:"p1",team_id:"barca",season:"2024/2025",trophy_source_id:"L",status:"confirmed",verified:true},
 {trophy_honour_id:"co",player_id:"p1",team_id:"barca",season:"2024/2025",trophy_source_id:"C",status:"confirmed",verified:true},
 {trophy_honour_id:"co",player_id:"p2",team_id:"barca",season:"2024/2025",trophy_source_id:"C",status:"candidate",verified:false},
 {trophy_honour_id:"pending",player_id:"p2",team_id:"barca",season:"2024/2025",trophy_source_id:"U",status:"confirmed",verified:true},
 {trophy_honour_id:"foreign",player_id:"p1",team_id:"madrid",season:"2023/2024",trophy_source_id:"U",status:"confirmed",verified:true},
 {trophy_honour_id:"la",player_id:"p3",team_id:"madrid",season:"2024/2025",trophy_source_id:"L",status:"confirmed",verified:true},
 {trophy_honour_id:"la",player_id:"p3",team_id:"barca",season:"2023/2024",trophy_source_id:"L",status:"confirmed",verified:true},
 {trophy_honour_id:"la",player_id:"p3",team_id:"barca",season:"2024/2025",trophy_source_id:"C",status:"confirmed",verified:true}
];
test("Club history includes only verified honours of the exact Base44 Team ID",()=>{
 const result=buildClubTrophyHistory("barca",{honours,credits,catalog,players});
 assert.equal(result.total,3);
 assert.equal(result.distinct,2);
 assert.equal(result.latest,"2024/2025");
 assert.equal(result.earliest,"2022/2023");
 assert.equal(result.competitions[0].source_id,"L");
 assert.equal(result.competitions[0].count,2);
 assert.equal(result.timeline.find(g=>g.season==="2024/2025").count,2);
 assert.deepEqual(result.timeline.map(g=>g.season),["2024/2025","2022/2023"]);
});
test("Only verified credits matching team season and trophy are shown",()=>{
 const result=buildClubTrophyHistory("barca",{honours,credits,catalog,players});
 assert.equal(result.confirmedPlayerCount,1);
 assert.equal(result.players[0].id,"p1");
 assert.equal(result.players[0].count,2);
 const liga=result.editions.find(h=>h.id==="la");
 assert.equal(liga.confirmedPlayerCount,1);
 assert.equal(liga.confirmedPlayers[0].name,"Jugador Uno");
 const copa=result.editions.find(h=>h.id==="co");
 assert.equal(copa.confirmedPlayerCount,1);
});
test("Empty club and missing credits do not invent winners",()=>{
 assert.deepEqual(buildClubTrophyHistory("unknown",{honours,credits,catalog,players}).editions,[]);
 const noCredits=buildClubTrophyHistory("barca",{honours,credits:[],catalog,players:[]});
 assert.equal(noCredits.total,3);
 assert.equal(noCredits.confirmedPlayerCount,0);
 assert.equal(noCredits.editions.every(h=>h.confirmedPlayers.length===0),true);
});
test("Club UI keeps the Palmarés section after returning from a trophy modal",()=>{
 const view=readFileSync(new URL("../src/components/trophies/ClubTrophyHistory.jsx",import.meta.url),"utf8");
 const rankings=readFileSync(new URL("../src/components/trophies/TrophyArchiveOverview.jsx",import.meta.url),"utf8");
 const card=readFileSync(new URL("../src/components/trophies/TrophyRankingCard.jsx",import.meta.url),"utf8");
 const page=readFileSync(new URL("../src/pages/Trophies.jsx",import.meta.url),"utf8");
 assert.match(rankings,/onOpenArchive=\{openClub\}/);
 assert.match(rankings,/<ClubTrophyHistory/);
 assert.match(card,/Ver palmarés/);
 assert.match(view,/Volver al ranking/);
 assert.match(view,/Solo adjudicaciones individuales confirmadas/);
 assert.match(page,/onOpenTrophy=\{open\}/);
});
