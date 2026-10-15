import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {canonicalHistoricalClub,resolveHistoricalTeam,prepareHistoricalJson} from "../src/utils/historicalJson.js";

const scenarios=[
 ["Bayern Munich","FC Bayern München"],
 ["FC Bayern Munchen","Bayern Munich"],
 ["FC Barcelona","Barcelona"],
 ["Real Madrid CF","Real Madrid"],
 ["Arsenal FC","Arsenal"],
 ["Manchester City FC","Manchester City"],
 ["Bayer 04 Leverkusen","Bayer Leverkusen"],
 ["Paris Saint-Germain","PSG"],
 ["Red Bull Salzburg","Salzburg"],
 ["Inter Milan","FC Internazionale Milano"],
 ["Atlético de Madrid","Atletico Madrid"],
 ["Tottenham","Tottenham Hotspur"],
 ["RB Leipzig","RasenBallsport Leipzig"]
];
test("Las variantes genéricas y aliases inequívocos se resuelven sin copiar IDs falsos",()=>{
 for(const [external,known] of scenarios){
  const team={id:"base44-id",name:known,fotmob_id:null};
  const result=resolveHistoricalTeam({team_name:external},[],[team]);
  assert.equal(result.error,"",external+" → "+known+": "+result.error);
  assert.equal(result.team.team_id,"base44-id",external);
  assert.equal(result.team.team_name,known);
 }
});
test("No normaliza en exceso: Barcelona SC, Bayern Munich II y Manchester United son diferentes",()=>{
 for(const [name,known] of [
  ["Barcelona SC","FC Barcelona"],
  ["Bayern Munich II","FC Bayern München"],
  ["Manchester United","Manchester City"],
  ["Arsenal de Sarandí","Arsenal"]
 ]){
  assert.notEqual(canonicalHistoricalClub(name),canonicalHistoricalClub(known));
  assert.match(resolveHistoricalTeam({team_name:name},[],[{id:"foo",name:known}]).error,/no reconocido/i);
 }
});
test("IDs FotMob incompatibles para un mismo nombre siguen sin atribución automática",()=>{
 const stats=[{team_name:"FC Bayern München",fotmob_team_id:"111"},
              {team_name:"Bayern Munich",fotmob_team_id:"222"}];
 const res=resolveHistoricalTeam({team_name:"Bayern Munich"},stats,[{id:"bayern",name:"FC Bayern München"}]);
 assert.equal(res.team,null);
 assert.match(res.error,/IDs incompatibles/);
});
test("Un FotMob ID explícito que contradice el nombre no permite asignar otro club",()=>{
 const res=resolveHistoricalTeam({team_name:"Bayern Munich",fotmob_team_id:"123"},
   [{team_name:"Manchester City",fotmob_team_id:"123"}],[{name:"FC Bayern München",id:"bayern"}]);
 assert.equal(res.team,null);
 assert.match(res.error,/nombre del club no coincide/i);
});
test("JSON con 30 PJ Bayern München importables y 7 valoraciones sin cambios ni error de identidad",()=>{
 const rows=Array.from({length:30},(_,i)=>({
  season:(2019+Math.floor(i/5))+"/"+(2020+Math.floor(i/5)),
  competition:["Bundesliga","DFB-Pokal","Champions League","DFL-Supercup","FIFA Club World Cup"][i%5],
  team_name:"Bayern Munich",team_matches: i%5===0?34:4
 }));
 const json={schema:"mf_legacy_historical_import_v1",player:{fotmob_id:"194165",name:"Robert Lewandowski"},valuations:
 Array.from({length:7},(_,i)=>({season:(2017+i)+"/"+(2018+i),fifa_fc_overall:88})),team_matches:rows};
 const result=prepareHistoricalJson(JSON.stringify(json),{
  playerId:"player-bayern",fotmobPlayerId:"194165",stats:[],
  teams:[{id:"6abfed78891b4f7324a149ec",name:"FC Bayern München"}]
 });
 assert.equal(result.length,37);
 assert.deepEqual(result.filter(r=>r.type==="team"&&r.errors.length),[]);
 assert.equal(result.filter(r=>r.type==="team").length,30);
 assert.ok(result.filter(r=>r.type==="team").every(r=>r.payload.team_id==="6abfed78891b4f7324a149ec"));
});
test("Importador independiente PJ Equipo utiliza el mismo resolver estricto",()=>{
 const jsx=readFileSync(new URL("../src/components/stats/TeamMatchesImporter.jsx",import.meta.url),"utf8");
 assert.match(jsx,/historicalTeamCatalog,resolveHistoricalTeam/);
 assert.match(jsx,/resolveHistoricalTeam\(row,stats,teams,teamCatalog\)/);
 assert.doesNotMatch(jsx,/byName\.get\(normalizeName\(row\.team_name\)\)/);
});
