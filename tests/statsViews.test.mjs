import test from "node:test";
import assert from "node:assert/strict";
import {aggregate, groupStatRows, resolveTeam, nationalCompetition, seasonActive, defaultSeason} from "../src/utils/statsViews.js";

const clubs=[
 {id:"bar",name:"FC Barcelona",logo:"bar.png"},
 {id:"lee",name:"Leeds United FC",logo:"lee.png"},
 {id:"rm",name:"Real Madrid CF"},
];
const raphinha={player_id:"raph",season:"2025/2026",competition:"LaLiga",fotmob_team_id:"8634",team_name:"Barcelona",appearances:22,minutes:1388,rating:7.77,metrics:[]};
const detailed={...raphinha,id:"one",team_name:"",fotmob_team_id:"",metrics:[{name:"Goals",value:13},{name:"Assists",value:3},{name:"xG",value:10.36}]};
test("unir registro básico y detallado sin duplicar cifras",()=>{
 const out=groupStatRows([raphinha,detailed]);
 assert.equal(out.length,1);
 assert.equal(out[0].team_name,"Barcelona");
 assert.equal(out[0].metrics.length,3);
 assert.equal(out[0]._sourceRows,2);
 assert.equal(aggregate(out,["goals"]).goals.value,13);
});
test("Barcelona se vincula visualmente a FC Barcelona, sin inventar Team ID",()=>{
 const row=groupStatRows([raphinha,detailed])[0];
 const resolution=resolveTeam(row,clubs,[row]);
 assert.equal(resolution.team.id,"bar");
 assert.equal(resolution.status,"confirmed");
});
test("copas sin equipo solo reciben sugerencias no confirmadas",()=>{
 const cup={player_id:"raph",season:"2025/2026",competition:"Copa del Rey",team_name:""};
 const res=resolveTeam(cup,clubs,[cup,raphinha]);
 assert.equal(res.team.id,"bar");
 assert.equal(res.status,"suggested");
});
test("sin fuente histórica no atribuir el equipo actual",()=>{
 const cup={player_id:"raph",season:"2017/2018",competition:"Europa League",team_name:""};
 assert.equal(resolveTeam(cup,clubs,[cup]).status,"unknown");
});
test("la selección nacional no se confunde con un club",()=>{
 assert.equal(nationalCompetition("World Cup CONMEBOL qualification"),true);
 assert.equal(nationalCompetition("Copa America"),true);
 assert.equal(nationalCompetition("Club World Cup"),false);
 const row={...raphinha,team_name:"",fotmob_team_id:"",competition:"World Cup"};
 assert.equal(resolveTeam(row,clubs,[row,raphinha]).status,"national");
});
test("los subtotales exponen métricas faltantes",()=>{
 const result=aggregate([detailed,{...detailed,competition:"Champions League",metrics:[]}],["goals","xa"]);
 assert.equal(result.goals.value,13);
 assert.equal(result.goals.partial,true);
 assert.equal(result.goals.available,1);
 assert.equal(result.xa.value,null);
});
test("temporada 2026/2027 en octubre está en curso",()=>{
 assert.equal(seasonActive("2026/2027",new Date("2026-10-13T12:00:00Z")),true);
 assert.equal(seasonActive("2025/2026",new Date("2026-10-13T12:00:00Z")),false);
});
test("abre la última temporada finalizada salvo que se elija otra",()=>{
 const rows=[{season:"2024/2025"},{season:"2025/2026"},{season:"2026/2027"}];
 const date=new Date("2026-10-13T12:00:00Z");
 assert.equal(defaultSeason(rows,"",date),"2025/2026");
 assert.equal(defaultSeason(rows,"2026/2027",date),"2026/2027");
});
test("dos clubes explícitos distintos no se fusionan",()=>{
 const other={...raphinha,fotmob_team_id:"8463",team_name:"Leeds United"};
 assert.equal(groupStatRows([raphinha,other]).length,2);
});
