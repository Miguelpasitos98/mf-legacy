import test from "node:test";
import assert from "node:assert/strict";
import {playPctFromTeamMatches} from "../src/utils/statsPlayPct.js";
const summary={records:[
 {season:"2022/2023",competition:"Bundesliga",fotmob_team_id:"9823",minutes:1080,team_matches:null},
 {season:"2022/2023",competition:"Champions League",fotmob_team_id:"9823",minutes:270,team_matches:null}
]};
const matches=[
 {season:"2022/2023",competition:"Bundesliga",fotmob_team_id:"9823",team_matches:34},
 {season:"2022/2023",competition:"Champions League",fotmob_team_id:"9823",team_matches:10},
 {season:"2022/2023",competition:"DFB Pokal",fotmob_team_id:"9823",team_matches:4}
];
test("Neuer Play % uses Bayern fixtures aligned with his competitions",()=>{
 assert.ok(Math.abs(playPctFromTeamMatches(summary,matches)-34.0909090909)<1e-7);
});
test("Unknown fixtures stay null; wrong club or season never used",()=>{
 assert.equal(playPctFromTeamMatches(summary,[]),null);
 assert.equal(playPctFromTeamMatches(summary,matches.map(m=>({...m,fotmob_team_id:"9999"}))),null);
 assert.equal(playPctFromTeamMatches(summary,matches.map(m=>({...m,season:"2021/2022"}))),null);
});
