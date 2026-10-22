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
