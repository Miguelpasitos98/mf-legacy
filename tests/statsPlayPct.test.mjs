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

test("Play % with team fixtures uses estimated minutes from appearances when real minutes are missing",()=>{
 const estimated={records:[
  {season:"2022/2023",competition:"Bundesliga",fotmob_team_id:"9823",minutes:null,appearances:20,team_matches:null},
  {season:"2022/2023",competition:"Champions League",fotmob_team_id:"9823",minutes:null,appearances:4,team_matches:null}
 ]};
 const value=playPctFromTeamMatches(estimated,matches);
 assert.ok(Math.abs(value-(24/44)*100)<1e-10);
 assert.equal(estimated.records[0].minutes,null); // Estimated minutes never overwrite official data.
});
test("Play % combines official and estimated minutes, preferring official where both exist",()=>{
 const combined={records:[
  {season:"2022/2023",competition:"Bundesliga",fotmob_team_id:"9823",minutes:1085,appearances:20,team_matches:null},
  {season:"2022/2023",competition:"Champions League",fotmob_team_id:"9823",minutes:null,appearances:4,team_matches:null}
 ]};
 assert.ok(Math.abs(playPctFromTeamMatches(combined,matches)-((1085+4*90)/(44*90))*100)<1e-10);
});
test("Play % does not invent minutes without appearances and respects actual zero",()=>{
 const noMinutes={records:[{season:"2022/2023",competition:"Bundesliga",fotmob_team_id:"9823",minutes:null,appearances:null}]};
 assert.equal(playPctFromTeamMatches(noMinutes,matches),null);
 const realZero={records:[{season:"2022/2023",competition:"Bundesliga",fotmob_team_id:"9823",minutes:0,appearances:10}]};
 assert.equal(playPctFromTeamMatches(realZero,matches),0);
});
test("Play % refuses conflicting club fixture counts even when minutes are estimated",()=>{
 const estimated={records:[{season:"2022/2023",competition:"Bundesliga",fotmob_team_id:"9823",minutes:null,appearances:12}]};
 assert.equal(playPctFromTeamMatches(estimated,[...matches,{...matches[0],team_matches:36}]),null);
});
