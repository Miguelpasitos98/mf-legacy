import test from "node:test";
import assert from "node:assert/strict";
import {LEAGUES,validateSelection,leaguePlayersFromJson,playerSeasonsFromJson,reconcilePlayer} from "../base44/functions/understat-live/core.mjs";

const leagueData={players:[
 {id:"406",player_name:"Luis Suárez",team_title:"Barcelona",time:"2800",xGChain:"30",xGBuildup:"6.5"},
 {id:"647",player_name:"Harry Kane",team_title:"Tottenham",time:"0",xGChain:"0",xGBuildup:"0"}
]};
const records=[
 {season:"2015/2016",competition:"LaLiga",team_name:"FC Barcelona",minutes:2700},
 {season:"2016/2017",competition:"LaLiga",team_name:"FC Barcelona",minutes:2800}
];
// Matches exact names/club: add FC prefix variant to supported club alias by using
// source and destination identical Barcelona in the test; no guess on real club IDs.
const stats=records.map(r=>({...r,team_name:"Barcelona"}));
const seasons={groups:{season:[
 {season:"2015",team:"Barcelona",time:"2700",xGChain:"28",xGBuildup:"6",xG:"20",xA:"10"},
 {season:"2016",team:"Barcelona",time:"2800",xGChain:"30",xGBuildup:"6.5",xG:"25",xA:"9"},
 {season:"2026",team:"Barcelona",time:"200",xGChain:"2",xGBuildup:"1"}
]}};
test("Understat: obtiene ID, nombre y métricas sin inventar valores cuando faltan minutos",()=>{
 assert.equal(LEAGUES.La_Liga,"LaLiga");
 assert.equal(validateSelection("La_Liga",2016),"2016");
 assert.throws(()=>validateSelection("bad",2016));
 const players=leaguePlayersFromJson(leagueData);
 assert.equal(players[0].understat_id,"406");
 assert.ok(Math.abs(players[0].xg_chain_p90-30*90/2800)<1e-12);
 assert.equal(players[1].xg_buildup_p90,null);
 assert.throws(()=>leaguePlayersFromJson({players:[]}));
});
test("Understat: verifica al menos dos temporadas y no guarda la temporada en curso",()=>{
 const result=reconcilePlayer({league:"La_Liga",season:"2016",playerName:"Luis Suarez",
  leaguePlayers:leaguePlayersFromJson(leagueData),providerSeasons:playerSeasonsFromJson(seasons),fotmobSeasons:stats});
 assert.equal(result.status,"verified");
 assert.equal(result.understat_id,"406");
 assert.equal(result.matches,2);
 assert.equal(result.rates.length,2);
 assert.ok(Math.abs(result.rates[1].xg_buildup_p90-6.5*90/2800)<1e-12);
 assert.equal(result.rates[1].xg_total,25);
 assert.ok(result.skipped.some(r=>r.season==="2026/2027"));
});
test("Understat: no empareja al jugador por nombre solo ni otro equipo",()=>{
 const bad=reconcilePlayer({league:"La_Liga",season:"2016",playerName:"Luis Suárez",
  leaguePlayers:leaguePlayersFromJson(leagueData),providerSeasons:playerSeasonsFromJson(seasons),
  fotmobSeasons:[{season:"2016/2017",competition:"LaLiga",team_name:"Real Madrid"}]});
 assert.equal(bad.status,"insufficient_identity");
 assert.equal(bad.rates,undefined);
 const duplicate=reconcilePlayer({league:"La_Liga",season:"2016",playerName:"Luis Suárez",
  leaguePlayers:[...leaguePlayersFromJson(leagueData),leaguePlayersFromJson(leagueData)[0]],
  providerSeasons:playerSeasonsFromJson(seasons),fotmobSeasons:stats});
 assert.equal(duplicate.status,"ambiguous_identity");
});
test("Understat: rechaza tasas incompletas o inconsistentes sin propagarlas",()=>{
 const bad=playerSeasonsFromJson(seasons).map(r=>r.season==="2015/2016"?{...r,buildup:r.chain+1}:r);
 const result=reconcilePlayer({league:"La_Liga",season:"2016",playerName:"Luis Suárez",
  leaguePlayers:leaguePlayersFromJson(leagueData),providerSeasons:bad,fotmobSeasons:stats});
 assert.equal(result.status,"verified");
 assert.equal(result.rates.length,1);
 assert.ok(result.skipped.some(r=>r.season==="2015/2016"));
});
