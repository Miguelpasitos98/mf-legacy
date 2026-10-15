import test from "node:test";
import assert from "node:assert/strict";
import {validatePossessionRow,parsePossessionBatch,possessionKey,possessionPct,createPossessionLookup,possessionAdjustedDefActions} from "../src/utils/teamPossession.js";
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
test("Historial CM utiliza posesión para PAdj y exige cubrir todas las competiciones",()=>{
 const players=[{id:"p",name:"Test CM",position:"CM"}];
 const stats=[
  {id:"one",player_id:"p",team_id:"city",team_name:"Manchester City",season:"2018/2019",competition:"Premier League",minutes:900,appearances:10,metrics:[{name:"Defensive actions",value:30}]},
  {id:"two",player_id:"p",team_id:"city",team_name:"Manchester City",season:"2018/2019",competition:"Champions League",minutes:450,appearances:5,metrics:[{name:"Defensive actions",value:12}]}
 ];
 const build=teamPossessions=>buildHistoricalObservations({players,stats,teams,teamPossessions});
 assert.equal(build([{...entry,team_possession_pct:67.9}])[0].values.def_actions_poss_adj_p90,null);
 const value=build([{...entry,team_possession_pct:67.9},{...entry,competition:"Champions League",team_possession_pct:60.1}])[0].values.def_actions_poss_adj_p90;
 assert.ok(value>0&&Number.isFinite(value));
});
