import test from "node:test";
import assert from "node:assert/strict";
import {parseFormula,evalFormula,initialConfig,sanitizeConfig,columnValue,getColumn} from "../src/utils/statsColumns.js";
import {buildSeasonSummaries} from "../src/utils/statsSeason.js";
const r={player_id:"raph",season:"2025/2026",competition:"LaLiga",appearances:20,minutes:1800,rating:7.5,metrics:[{name:"Goals",value:10},{name:"Assists",value:5},{name:"xG",value:11},{name:"xA",value:6}]};
test("el cálculo personalizado permite reglas aritméticas sin ejecutar código",()=>{
 const ast=parseFormula("(goals + assists) * 90 / minutes");
 assert.equal(evalFormula(ast,{goals:10,assists:5,minutes:1800}),.75);
});
test("fórmulas peligrosas, nombres desconocidos y expresiones incompletas se rechazan",()=>{
 for(const expression of ["window.alert(1)","goals; process.exit(1)","constructor","goals + nonexistent","(goals + assists","goals ++ * 2"]){
  assert.throws(()=>parseFormula(expression));
 }
});
test("división por cero y datos desconocidos devuelven nulo",()=>{
 const ast=parseFormula("goals / minutes");
 assert.equal(evalFormula(ast,{goals:2,minutes:0}),null);
 assert.equal(evalFormula(ast,{goals:null,minutes:1800}),null);
});
test("las columnas predeterminadas tienen categorías independientes por vista",()=>{
 const config=initialConfig();
 assert.ok(config.columns.season.Resumen.includes("gaper90"));
 assert.ok(config.columns.competition.Resumen.includes("goals"));
 assert.notEqual(config.columns.season.Resumen,config.columns.competition.Resumen);
});
test("se guarda una fórmula propia y se calcula en temporada y competición",()=>{
 const config=initialConfig();
 config.computed.push({id:"calc_points",name:"Puntos G+A",formula:"goals * 2 + assists",decimals:0});
 config.columns.season.Ataque.push("calc_points");
 const cleaned=sanitizeConfig(config);
 assert.ok(cleaned.columns.season.Ataque.includes("calc_points"));
 const summary=buildSeasonSummaries([r],[])[0];
 assert.equal(columnValue(summary,"season","calc_points",cleaned),25);
 assert.equal(columnValue(r,"competition","calc_points",cleaned),25);
});
test("una fórmula por 90 utiliza solo las competiciones con variables y minutos válidos",()=>{
 const summary=buildSeasonSummaries([r,{...r,competition:"Copa del Rey",minutes:200,metrics:[]}],[])[0];
 assert.equal(columnValue(summary,"season","gaper90",initialConfig()),(10+5)*90/1800);
});
test("un preset manipulado no puede introducir columnas, fórmulas u operadores desconocidos",()=>{
 const dirty=initialConfig();
 dirty.computed.push({id:"calc_x",name:"Maliciosa",formula:"alert(1)",decimals:2});
 dirty.columns.season.Resumen.push("calc_x","not_existing");
 const clean=sanitizeConfig(dirty);
 assert.equal(clean.computed.some(x=>x.id==="calc_x"),false);
 assert.equal(clean.columns.season.Resumen.includes("not_existing"),false);
});
test("se puede renombrar un indicador de fuente sin alterar las estadísticas",()=>{
 const config=initialConfig();config.labels.goals="Tantos";
 const c=sanitizeConfig(config);
 assert.equal(getColumn(c,"goals").name,"Tantos");
 assert.equal(columnValue(r,"competition","goals",c),10);
});

test("GPrev solo se calcula con PSxGOT y goles de disparos de igual cobertura",()=>{
 const config=initialConfig();
 const keeper={player_id:"keeper",season:"2025/2026",competition:"LaLiga",minutes:1800,appearances:20,metrics:[
  {name:"psxgot_against",value:28.4},{name:"goals_conceded_from_shots",value:20}
 ]};
 const summary=buildSeasonSummaries([keeper],[])[0];
 assert.ok(config.columns.season.Portería.includes("calc_goals_prevented"));
 assert.equal(columnValue(summary,"season","calc_goals_prevented",config),8.399999999999999);
 assert.ok(Math.abs(columnValue(summary,"season","calc_goals_prevented_p90",config)-0.42)<1e-10);
 const partial=buildSeasonSummaries([keeper,{...keeper,competition:"Copa del Rey",minutes:90,metrics:[{name:"psxgot_against",value:2}]}],[])[0];
 assert.equal(columnValue(partial,"season","calc_goals_prevented",config),8.399999999999999);
 assert.equal(columnValue(partial,"season","calc_goals_prevented_p90",config),columnValue(summary,"season","calc_goals_prevented_p90",config));
 assert.equal(columnValue({...keeper,metrics:[]},"competition","calc_goals_prevented",config),null);
});
test("las preferencias antiguas reciben indicadores GK sin borrar sus columnas",()=>{
 const old=initialConfig();
 old.columns.season.Portería=["saves","cleansheets"];
 const clean=sanitizeConfig(old);
 assert.deepEqual(clean.columns.season.Portería.slice(0,2),["saves","cleansheets"]);
 assert.ok(clean.columns.season.Portería.includes("calc_goals_prevented_p90"));
});

test("Goals prevented de FotMob alimenta GPrev y GPrev/90 sin cambiar otras métricas",()=>{
 const config=initialConfig();
 const league={player_id:"courtois",season:"2023/2024",competition:"LaLiga",minutes:332,appearances:4,metrics:[{name:"Goals prevented",value:2.3}]};
 const champions={...league,competition:"Champions League",minutes:90,appearances:1,metrics:[{name:"Goals prevented",value:1.1}]};
 assert.equal(columnValue(league,"competition","calc_goals_prevented",config),2.3);
 assert.ok(Math.abs(columnValue(league,"competition","calc_goals_prevented_p90",config)-2.3*90/332)<1e-12);
 const summary=buildSeasonSummaries([league,champions],[])[0];
 assert.ok(Math.abs(columnValue(summary,"season","calc_goals_prevented",config)-3.4)<1e-12);
 assert.ok(Math.abs(columnValue(summary,"season","calc_goals_prevented_p90",config)-3.4*90/422)<1e-12);
 assert.equal(columnValue({...league,metrics:[]},"competition","calc_goals_prevented",config),null);
});
test('FotMob Goals prevented /90 se visualiza aunque falten minutos de la competición',()=>{
 const keeper={player_id:'kepa',season:'2024/2025',competition:'Premier League',appearances:31,minutes:null,
  metrics:[{name:'Goals prevented',value:2.13,per90:0.06870968111099734}]};
 const config=initialConfig();
 assert.equal(columnValue(keeper,'competition','calc_goals_prevented',config),2.13);
 assert.equal(columnValue(keeper,'competition','calc_goals_prevented_p90',config),0.06870968111099734);
 const negative={...keeper,metrics:[{name:'Goals prevented',value:-0.2,per90:-0.2}]};
 assert.equal(columnValue(negative,'competition','calc_goals_prevented_p90',config),-0.2);
});
test('las tasas /90 publicadas en FotMob se presentan sin minutos, sin cambiar formulas personalizadas',()=>{
 const row={player_id:'x',season:'2024/2025',competition:'LaLiga',minutes:null,appearances:12,metrics:[
  {name:'Goals',value:3,per90:0.31},{name:'Assists',value:2,per90:0.22},
  {name:'xG',value:4.2,per90:0.41},{name:'xA',value:1.9,per90:0.19}
 ]};
 const config=initialConfig();
 for(const [column,rate] of [['goalsper90',0.31],['assistsper90',0.22],['xgper90',0.41],['xaper90',0.19]])
  assert.equal(columnValue(row,'competition',column,config),rate);
 assert.equal(columnValue(row,'competition','gaper90',config),null);
 const custom=initialConfig();custom.computed.find(x=>x.id==='goalsper90').formula='goals * 45 / minutes';
 assert.equal(columnValue(row,'competition','goalsper90',custom),null);
});
test('el porcentaje de duelos importado se identifica por su nombre real',()=>{
 const row={player_id:'x',season:'2024/2025',competition:'LaLiga',metrics:[
  {name:'Duels won %',value:54.3},{name:'Aerials won %',value:62.5},
  {name:'Dribbles success rate',value:70.1},{name:'Goals conceded',value:12}
 ]};
 const config=initialConfig();
 assert.equal(columnValue(row,'competition','duelswonvariante2',config),54.3);
 assert.equal(columnValue(row,'competition','aerialswonvariante2',config),62.5);
 assert.equal(columnValue(row,'competition','dribblessuccessrate',config),70.1);
 assert.equal(columnValue(row,'competition','goalsconcededwhileonpitch',config),null);
});
test('Keylor Navas: Play %, SV/90 y xA/90 usan fuentes existentes sin crear minutos',()=>{
 const rows=[
  {season:'2025/2026',competition:'Liga MX Clausura',minutes:null,appearances:22,team_matches:23,metrics:[{name:'Saves',value:94,per90:94/22},{name:'xA',value:0.05,per90:0.002165059516714378}]},
  {season:'2025/2026',competition:'Liga MX Apertura',minutes:null,appearances:15,team_matches:18,metrics:[{name:'Saves',value:45,per90:3},{name:'xA',value:0.01,per90:0.0006570186465978623}]}
 ];
 const config=initialConfig();
 assert.ok(Math.abs(columnValue(rows[0],'competition','playpct',config)-22/23*100)<1e-8);
 assert.ok(Math.abs(columnValue(rows[0],'competition','savesper90',config)-94/22)<1e-8);
 assert.ok(Math.abs(columnValue(rows[0],'competition','xaper90',config)-0.002165059516714378)<1e-8);
 const season={records:rows};
 assert.ok(Math.abs(columnValue(season,'season','playpct',config)-37/41*100)<1e-8);
 assert.ok(Math.abs(columnValue(season,'season','savesper90',config)-139/37)<1e-8);
 const xaRate=(0.002165059516714378*22+0.0006570186465978623*15)/37;
 assert.ok(Math.abs(columnValue(season,'season','xaper90',config)-xaRate)<1e-8);
 assert.equal(rows[0].minutes,null);
});
test('preferencias antiguas de Portería reciben SV/90 y xA/90 sin perder columnas personales',()=>{
 const old=initialConfig();old.version=3;
 old.columns.season.Portería=['saves','calc_goals_prevented','my_metric'];
 old.columns.competition.Portería=['saves','cleansheets'];
 const upgraded=sanitizeConfig(old);
 for(const mode of ['season','competition']){
  assert.ok(upgraded.columns[mode].Portería.includes('savesper90'));
  assert.ok(upgraded.columns[mode].Portería.includes('xaper90'));
 }
 assert.ok(upgraded.columns.season.Portería.includes('calc_goals_prevented'));
 assert.equal(upgraded.version,4);
 const personalized=sanitizeConfig({...upgraded,columns:{...upgraded.columns,season:{...upgraded.columns.season,Portería:['saves']}}});
 assert.deepEqual(personalized.columns.season.Portería.filter(x=>['savesper90','xaper90'].includes(x)),[]);
});
