import test from "node:test";
import assert from "node:assert/strict";
import {validatePossessionRow,parsePossessionBatch,possessionKey,possessionPct,createPossessionLookup,possessionAdjustedDefActions,possessionAdjustedDefActionsDetail,matchingPossessionRecord,possessionImportDecision} from "../src/utils/teamPossession.js";
import {buildHistoricalObservations} from "../src/utils/historicalPeers.js";
const teams=[
 {id:"city",name:"Manchester City"},
 {id:"bayern",name:"FC Bayern München"},
 {id:"united",name:"Manchester United"}
];
const entry={team_id:"city",season:"2018/2019",competition:"Premier League",team_possession_pct:"67,9",source:"FBref"};
test("El administrador introduce porcentaje 67,9 en club temporada competición",()=>{
 const record=validatePossessionRow(entry,teams);
 assert.equal(record.team_possession_pct,67.9);
 assert.equal(record.team_id,"city");
 assert.equal(record.season,"2018/2019");
 assert.equal(possessionKey("city","2018-2019","Premier League"),"city|2018/2019|premier league");
});
test("No se aceptan valores sin porcentaje válido, temporadas y clubes falsos",()=>{
 for(const input of ["",null,0,100,102,"67.9%","un dato"]){
  assert.equal(possessionPct(input),null);
 }
 assert.throws(()=>validatePossessionRow({...entry,team_id:"fake"},teams));
 assert.throws(()=>validatePossessionRow({...entry,season:"2018/2021"},teams));
 assert.throws(()=>validatePossessionRow({...entry,team_id:"city",team_name:"Manchester United"},teams));
});
test("JSON array o records: identifica club por nombre exacto y rechaza duplicados",()=>{
 const json=JSON.stringify({records:[{team_name:"Manchester City",season:"2018/2019",competition:"Premier League",team_possession_pct:67.9}]});
 const result=parsePossessionBatch(json,teams);
 assert.equal(result.errors.length,0);assert.equal(result.rows[0].team_id,"city");
 const duplicate=parsePossessionBatch([entry,{...entry,competition:"premier league"}],teams);
 assert.equal(duplicate.rows.length,1);
 assert.match(duplicate.errors[0],/duplicados/);
});
test("Bundesliga 2025/2026: importa los 18 equipos, aunque solo cuatro existan en Team",()=>{
 const catalog=[
  ...teams,
  {id:"leverkusen",name:"Bayer 04 Leverkusen"},
  {id:"leipzig",name:"RB Leipzig"},
  {id:"dortmund",name:"Borussia Dortmund"}
 ];
 const names=["Bayern München","Bayer Leverkusen","VfB Stuttgart","Hoffenheim","Eintracht Frankfurt",
  "RB Leipzig","Borussia Dortmund","Werder Bremen","Freiburg","1. FC Köln","Borussia Mönchengladbach",
  "Hamburger SV","Wolfsburg","St. Pauli","Augsburg","Mainz 05","FC Heidenheim","Union Berlin"];
 const pct=[67.4,59.2,57.8,55.2,55,53.9,53.2,51.2,48.1,47,46.7,45.4,45.2,44.3,44,44,42.2,40.3];
 const rows=names.map((name,i)=>({team_name:name,season:"2025/2026",competition:"Bundesliga",team_possession_pct:pct[i],source:"FotMob",source_url:""}));
 const result=parsePossessionBatch({records:rows},catalog);
 assert.deepEqual(result.errors,[]);
 assert.equal(result.rows.length,18);
 assert.equal(result.rows.filter(row=>row.team_id).length,4);
 assert.equal(result.rows.filter(row=>!row.team_id).length,14);
 assert.equal(result.rows[2].team_name,"VfB Stuttgart");
 assert.equal(result.rows[2].team_id,"");
 assert.equal(result.rows[0].team_id,"bayern");
 assert.equal(result.rows[1].team_id,"leverkusen");
 assert.equal(result.rows[5].team_id,"leipzig");
 assert.equal(result.rows[6].team_id,"dortmund");
 // When the club is later added, importing the same snapshot links it.
 const improved=parsePossessionBatch({records:rows},[...catalog,{id:"stuttgart",name:"VfB Stuttgart"}]);
 assert.equal(improved.rows.filter(row=>row.team_id).length,5);
 assert.equal(improved.rows[2].team_id,"stuttgart");
});
test("La identidad explícita inválida no se convierte en registro pendiente",()=>{
 assert.throws(()=>validatePossessionRow({...entry,team_id:"inventado"},teams,{allowUnlinked:true}),/ID del club/);
 assert.throws(()=>validatePossessionRow({...entry,team_id:"city",team_name:"Manchester United"},teams,{allowUnlinked:true}),/no coincide/);
 const pending=parsePossessionBatch({records:[{...entry,team_id:"",team_name:"VfB Stuttgart"}]},teams);
 assert.equal(pending.errors.length,0);
 assert.equal(pending.rows[0].team_id,"");
 const duplicate=parsePossessionBatch({records:[{...entry,team_id:"",team_name:"VfB Stuttgart"},{...entry,team_id:"",team_name:"VfB Stuttgart"}]},teams);
 assert.equal(duplicate.errors.length,1);
});
test("No confunde clubes pendientes con la misma temporada, liga y team_id vacío",()=>{
 const imported=[
  {team_id:"",team_name:"VfB Stuttgart",season:"2025/2026",competition:"Bundesliga",team_possession_pct:57.8,source:"FotMob",source_url:""},
  {team_id:"",team_name:"Hoffenheim",season:"2025/2026",competition:"Bundesliga",team_possession_pct:55.2,source:"FotMob",source_url:""}
 ];
 const stuttgart=matchingPossessionRecord(imported,{...imported[0],team_id:"stuttgart"});
 const hoffenheim=matchingPossessionRecord(imported,{...imported[1],team_id:""});
 assert.strictEqual(stuttgart,imported[0]);
 assert.strictEqual(hoffenheim,imported[1]);
 assert.equal(possessionImportDecision(stuttgart,{...imported[0],team_id:"stuttgart"}),"update");
 assert.equal(possessionImportDecision(stuttgart,imported[0]),"unchanged");
 assert.throws(()=>possessionImportDecision({...imported[0],team_id:"stuttgart"},imported[0]),/no se puede desvincular/);
 assert.equal(matchingPossessionRecord(imported,{...imported[0],team_name:"Eintracht Frankfurt"}),null);
 assert.equal(possessionImportDecision(null,imported[1]),"create");
});
test("El motor no utiliza posesión de un club pendiente como si fuera vinculado",()=>{
 const pending=[{...entry,team_id:"",team_name:"VfB Stuttgart",team_possession_pct:57.8}];
 const lookup=createPossessionLookup(pending,teams);
 assert.equal(lookup({team_name:"VfB Stuttgart",season:"2018/2019",competition:"Premier League"}),null);
});
test("Vincula posesión de club por su identificador único y competición",()=>{
 const possessions=[
  {...entry,team_id:"city",team_possession_pct:67.9},
  {...entry,team_id:"bayern",team_possession_pct:68.3,competition:"Bundesliga",season:"2024/2025"}
 ];
 const get=createPossessionLookup(possessions,teams);
 assert.equal(get({team_id:"city",season:"2018/2019",competition:"Premier League"}),67.9);
 assert.equal(get({team_name:"Bayern München",season:"2024/2025",competition:"Bundesliga"}),68.3);
 assert.equal(get({team_name:"Manchester United",season:"2018/2019",competition:"Premier League"}),null);
 assert.equal(get({team_id:"city",season:"2018/2019",competition:"Champions League"}),null);
});
test("La posesión diferente en Champions no se sustituye por la de liga",()=>{
 const get=createPossessionLookup([{...entry,team_possession_pct:67.9}],teams);
 const stats=[{team_id:"city",season:"2018/2019",competition:"Premier League",minutes:900,metrics:[{name:"Defensive actions",value:30}]},
  {team_id:"city",season:"2018/2019",competition:"Champions League",minutes:450,metrics:[{name:"Defensive actions",value:12}]}];
 const getActions=row=>row.metrics[0].value;
 assert.equal(possessionAdjustedDefActions(stats,getActions,get),null);
 const complete=createPossessionLookup([{...entry,team_possession_pct:67.9},{...entry,competition:"Champions League",team_possession_pct:60.1}],teams);
 const calculated=possessionAdjustedDefActions(stats,getActions,complete);
 const expected=(30*50/(100-67.9)+12*50/(100-60.1))*90/1350;
 assert.ok(Math.abs(calculated-expected)<1e-10);
});
test("No se calcula PAdj si falta acciones, minutos o porcentaje, ni se divide por cero",()=>{
 const action=()=>10,poss=()=>50;
 assert.equal(possessionAdjustedDefActions([{minutes:0}],action,poss),null);
 assert.equal(possessionAdjustedDefActions([{minutes:90}],()=>null,poss),null);
 assert.equal(possessionAdjustedDefActions([{minutes:90}],action,()=>100),null);
 assert.equal(possessionAdjustedDefActions([{minutes:90}],action,()=>null),null);
});
test("Historial CM calcula PAdj sobre cobertura explícita de competiciones",()=>{
 const players=[{id:"p",name:"Test CM",position:"CM"}];
 const stats=[
  {id:"one",player_id:"p",team_id:"city",team_name:"Manchester City",season:"2018/2019",competition:"Premier League",minutes:900,appearances:10,metrics:[{name:"Defensive actions",value:30}]},
  {id:"two",player_id:"p",team_id:"city",team_name:"Manchester City",season:"2018/2019",competition:"Champions League",minutes:450,appearances:5,metrics:[{name:"Defensive actions",value:12}]}
 ];
 const build=teamPossessions=>buildHistoricalObservations({players,stats,teams,teamPossessions});
 const partial=build([{...entry,team_possession_pct:67.9}])[0];
 assert.ok(partial.values.def_actions_poss_adj_p90>0);
 assert.equal(partial.pAdjCoverage.covered,1);
 assert.equal(partial.pAdjCoverage.total,2);
 const value=build([{...entry,team_possession_pct:67.9},{...entry,competition:"Champions League",team_possession_pct:60.1}])[0].values.def_actions_poss_adj_p90;
 assert.ok(value>0&&Number.isFinite(value));
});

test("Reconstruye acciones defensivas con cuatro métricas y posesión vinculada",()=>{
 const stats=[{team_id:"city",season:"2018/2019",competition:"Premier League",minutes:900,metrics:[
  {name:"Tackles",value:9},{name:"Interceptions",value:8},
  {name:"Clearances",value:10},{name:"Blocked shots",value:3}
 ]}];
 const pick=(r,names)=>r.metrics.find(m=>names.includes(m.name))?.value??null;
 const get=createPossessionLookup([entry],teams);
 const detail=possessionAdjustedDefActionsDetail(stats,pick,get);
 assert.equal(detail.covered,1);
 assert.ok(Math.abs(detail.value-(30*50/(100-67.9))*90/900)<1e-10);
 assert.deepEqual(detail.methods,["reconstructed"]);
});
test("Solo calcula con competiciones cubiertas y declara por qué excluye otras",()=>{
 const r=[
  {team_id:"city",season:"2018/2019",competition:"Premier League",minutes:900,metrics:[{name:"Defensive actions",value:40}]},
  {team_id:"city",season:"2018/2019",competition:"Champions League",minutes:400,metrics:[{name:"Defensive actions",value:20}]}
 ];
 const get=createPossessionLookup([entry],teams);
 const pick=(row,names)=>row.metrics.find(m=>names.includes(m.name))?.value??null;
 const detail=possessionAdjustedDefActionsDetail(r,pick,get);
 assert.equal(detail.covered,1);
 assert.equal(detail.total,2);
 assert.equal(detail.minutesCovered,900);
 assert.deepEqual(detail.excluded[0].reasons,["team_possession"]);
 assert.equal(possessionAdjustedDefActions(r,pick,get),null);
 const observations=buildHistoricalObservations({players:[{id:"p",position:"CB"}],stats:r.map(x=>({...x,player_id:"p",appearances:10})),teams,teamPossessions:[entry]});
 assert.equal(observations[0].pAdjCoverage.covered,1);
 assert.ok(observations[0].values.def_actions_poss_adj_p90>0);
});

test("PAdj enlaza posesión pendiente si existe un único club exacto por nombre normalizado",()=>{
 const pending=[{team_id:"",team_name:"Manchester City",season:"2018/2019",competition:"Premier League",team_possession_pct:67.9}];
 const get=createPossessionLookup(pending,teams);
 assert.equal(get({team_id:"city",team_name:"Manchester City",season:"2018/2019",competition:"Premier League"}),67.9);
 assert.equal(get({team_name:"Manchester City",season:"2018/2019",competition:"Champions League"}),null);
 assert.equal(createPossessionLookup(pending,[...teams,{id:"city2",name:"Manchester City"}])({team_name:"Manchester City",season:"2018/2019",competition:"Premier League"}),null);
 const mismatched=[{...pending[0],team_id:"united"}];
 assert.equal(createPossessionLookup(mismatched,teams)({team_id:"city",season:"2018/2019",competition:"Premier League"}),null);
});

test("Inter 2023/24: enlaza posesión Serie A aun si Team se llama Inter Milan",()=>{
 const inter=[{id:"inter",name:"Inter Milan"}];
 const possession=[{team_id:"",team_name:"Inter",season:"2023/2024",competition:"Serie A",team_possession_pct:57.2}];
 const get=createPossessionLookup(possession,inter);
 const row={team_id:"inter",team_name:"Internazionale",season:"2023/2024",competition:"Serie A",minutes:2283,metrics:[{name:"Defensive actions",value:123}]};
 assert.equal(get(row),57.2);
 const total=(r,names)=>r.metrics.find(m=>names.includes(m.name))?.value??null;
 const detail=possessionAdjustedDefActionsDetail([row],total,get);
 assert.equal(detail.covered,1);
 assert.ok(Math.abs(detail.value-123*50/(100-57.2)*90/2283)<1e-10);
 assert.equal(get({...row,competition:"Champions League"}),null);
});

test("Militao 2022/23: LaLiga de FotMob coincide con posesion LaLiga EA Sports",()=>{
 const madrid=[{id:"rm",name:"Real Madrid CF"}];
 const possessions=[{team_id:"rm",team_name:"Real Madrid CF",season:"2022/2023",competition:"LaLiga EA Sports",team_possession_pct:61.1}];
 const lookup=createPossessionLookup(possessions,madrid);
 const row={team_id:"rm",team_name:"Real Madrid",season:"2022/2023",competition:"LaLiga",minutes:2703,metrics:[{name:"Defensive actions",value:226}]};
 assert.equal(lookup(row),61.1);
 const total=(r,n)=>r.metrics.find(m=>n.includes(m.name))?.value??null;
 const detail=possessionAdjustedDefActionsDetail([row,{...row,competition:"Copa del Rey",minutes:525}],total,lookup);
 assert.equal(detail.covered,1);
 assert.equal(detail.total,2);
 assert.ok(Math.abs(detail.value-226*50/(100-61.1)*90/2703)<1e-10);
 assert.equal(lookup({...row,competition:"Champions League"}),null);
});
