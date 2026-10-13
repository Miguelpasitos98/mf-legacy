import test from "node:test";
import assert from "node:assert/strict";
import {buildSeasonSummaries, seasonSummary, statDisplay} from "../src/utils/statsSeason.js";
const teams=[{id:"b",name:"FC Barcelona",logo:"b.png"},{id:"l",name:"Leeds United FC",logo:"l.png"},{id:"r",name:"Rennes"}];
const base={player_id:"raph",fotmob_player_id:"696679",player_name:"Raphinha",season:"2025/2026",competition:"LaLiga",team_name:"Barcelona",appearances:20,minutes:1600,rating:7.5,metrics:[{name:"Goals",value:10},{name:"Assists",value:5},{name:"xG",value:9},{name:"xA",value:4},{name:"Shots",value:40}]};
test("una fila por jugador y temporada sin duplicar competiciones",()=>{
 const cup={...base,competition:"Copa del Rey",appearances:5,minutes:300,rating:8.5,metrics:[{name:"Goals",value:2},{name:"Assists",value:1},{name:"xG",value:2},{name:"xA",value:1},{name:"Shots",value:10}]};
 const result=buildSeasonSummaries([base,cup],teams);
 assert.equal(result.length,1);
 assert.equal(result[0].totals.goals.value,12);
 assert.equal(result[0].totals.appearances.value,25);
 assert.equal(result[0].totals.minutes.value,1900);
 assert.equal(result[0].per90.ga,18*90/1900);
 assert.equal(result[0].weightedRating,(20*7.5+5*8.5)/25);
 assert.equal(result[0].mainClub.id,"b");
});
test("competición internacional nunca entra en el subtotal de clubes",()=>{
 const world={...base,competition:"Copa America",metrics:[{name:"Goals",value:5}]};
 assert.equal(buildSeasonSummaries([base,world],teams)[0].totals.goals.value,10);
});
test("dos temporadas distintas generan dos filas",()=>{
 const result=buildSeasonSummaries([base,{...base,season:"2024/2025"}],teams);
 assert.deepEqual(result.map(r=>r.season).sort(),["2024/2025","2025/2026"]);
});
test("club principal por minutos y segundo club identificado",()=>{
 const other={...base,competition:"Premier League",team_name:"Leeds United",minutes:2100,appearances:21};
 const summary=seasonSummary([base,other],teams);
 assert.equal(summary.mainClub.id,"l");
 assert.equal(summary.otherClubs[0].id,"b");
});
test("equipo desconocido no se convierte en el club actual",()=>{
 const other={...base,competition:"Copa del Rey",team_name:"",minutes:100};
 const summary=seasonSummary([base,other],teams);
 assert.equal(summary.mainClub.id,"b");
 assert.equal(summary.unresolvedTeams,1);
});
test("una competición incompleta impide ratio global engañoso",()=>{
 const missing={...base,competition:"Champions League",minutes:400,metrics:[]};
 const summary=seasonSummary([base,missing],teams);
 assert.equal(summary.totals.goals.value,10);
 assert.equal(summary.totals.goals.partial,true);
 assert.equal(summary.per90.goals,null);
 assert.equal(summary.per90.ga,null);
});
test("desconocido no se convierte en cero y rating requiere ponderación",()=>{
 const unknown={...base,competition:"LaLiga",rating:null,minutes:null,appearances:null,metrics:[]};
 const summary=seasonSummary([unknown],teams);
 assert.equal(statDisplay(summary,"goals"),null);
 assert.equal(summary.weightedRating,null);
});
test("duplicados básico y detallado misma temporada no cuentan dos veces",()=>{
 const detailed={...base,team_name:"",metrics:[{name:"Goals",value:10},{name:"Assists",value:5},{name:"xG",value:9}]};
 const basic={...base,metrics:[]};
 const summary=seasonSummary([detailed,basic],teams);
 assert.equal(summary.totals.appearances.value,20);
 assert.equal(summary.totals.goals.value,10);
});
