import test from "node:test";
import {readFileSync} from "node:fs";
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
 assert.equal(columnValue(row,'competition','goalsconcededwhileonpitch',config),12);
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
test('preferencias antiguas de Portería mantienen SV/90 sin reintroducir xA/90',()=>{
 const old=initialConfig();old.version=3;
 old.columns.season.Portería=['saves','calc_goals_prevented','my_metric'];
 old.columns.competition.Portería=['saves','cleansheets'];
 const upgraded=sanitizeConfig(old);
 for(const mode of ['season','competition']){
  assert.ok(upgraded.columns[mode].Portería.includes('savesper90'));
  assert.ok(!upgraded.columns[mode].Portería.includes('xaper90'));
 }
 assert.ok(upgraded.columns.season.Portería.includes('calc_goals_prevented'));
 assert.equal(upgraded.version,4);
 const personalized=sanitizeConfig({...upgraded,columns:{...upgraded.columns,season:{...upgraded.columns.season,Portería:['saves']}}});
 assert.deepEqual(personalized.columns.season.Portería.filter(x=>['savesper90','xaper90'].includes(x)),[]);
});
test('las tasas pequeñas no se convierten visualmente en cero',async()=>{
 const {formatStatRate}=await import('../src/utils/statsColumns.js');
 assert.equal(formatStatRate(0.001553,2),'0,00155');
 assert.equal(formatStatRate(3.7567,2),'3,76');
 assert.equal(formatStatRate(0,2),'0,00');
});
test('columnas personalizadas SV/90 y xA/90 de Keylor leen FotMob y no duplican migración',()=>{
 const old=initialConfig();old.version=3;
 old.computed.push({id:'calc_mvjxvg1a',name:'SV/90',formula:'saves * 90 / minutes',decimals:2});
 old.computed.push({id:'calc_mvjxxrw3',name:'xA/90',formula:'xa * 90 / minutes',decimals:2});
 old.columns.season.Portería=['calc_mvjxvg1a','calc_mvjxxrw3','calc_goals_prevented'];
 const config=sanitizeConfig(old);
 assert.deepEqual(config.columns.season.Portería.filter(id=>['savesper90','xaper90'].includes(id)),[]);
 const league={season:'2025/2026',competition:'Liga MX Clausura',minutes:null,appearances:22,metrics:[{name:'Saves',value:94,per90:94/22},{name:'xA',value:0.05,per90:0.002165059516714378}]};
 const apertura={season:'2025/2026',competition:'Liga MX Apertura',minutes:null,appearances:15,metrics:[{name:'Saves',value:45,per90:3},{name:'xA',value:0.01,per90:0.0006570186465978623}]};
 const summary={records:[league,apertura]};
 assert.ok(Math.abs(columnValue(summary,'season','calc_mvjxvg1a',config)-139/37)<1e-9);
 assert.ok(Math.abs(columnValue(summary,'season','calc_mvjxxrw3',config)-(0.002165059516714378*22+0.0006570186465978623*15)/37)<1e-9);
 assert.equal(columnValue(league,'competition','calc_mvjxvg1a',config),94/22);
 assert.equal(columnValue(league,'competition','calc_mvjxxrw3',config),0.002165059516714378);
});
test('Keylor Navas: las columnas antiguas G received/90 y G Evited/90 se calculan con las tasas de FotMob',()=>{
 const config=initialConfig();
 config.computed.push({id:'calc_mvjxvmyr',name:'G recived /90',formula:'goalsconcededwhileonpitch * 90 / minutes',decimals:2});
 const rows=[
  {season:'2025/2026',competition:'Liga MX Clausura',minutes:null,appearances:22,metrics:[{name:'Goals conceded',value:24,per90:24/22},{name:'Goals prevented',value:7.62,per90:0.3463636419989846}]},
  {season:'2025/2026',competition:'Liga MX Apertura',minutes:null,appearances:15,metrics:[{name:'Goals conceded',value:19,per90:19/15},{name:'Goals prevented',value:2.19,per90:0.14600000381469727}]}
 ];
 const summary={records:rows};
 assert.ok(Math.abs(columnValue(summary,'season','calc_mvjxvmyr',config)-43/37)<1e-8);
 assert.ok(Math.abs(columnValue(summary,'season','calc_goals_prevented_p90',config)-(0.3463636419989846*22+0.14600000381469727*15)/37)<1e-8);
 assert.ok(Math.abs(columnValue(rows[0],'competition','calc_mvjxvmyr',config)-24/22)<1e-8);
 assert.equal(columnValue(rows[0],'competition','calc_goals_prevented_p90',config),0.3463636419989846);
});
test('Portería mantiene SV/90, oculta xA/90 antiguo y conserva columna xA en otras categorías',()=>{
 const config=initialConfig();config.version=3;
 config.computed.push({id:'calc_oldxa',name:'xA/90',formula:'xa * 90 / minutes',decimals:2});
 config.columns.season.Portería=['saves','calc_oldxa','calc_goals_prevented'];
 config.columns.competition.Portería=['saves','xaper90'];
 config.columns.season.Creación=['xaper90'];
 const clean=sanitizeConfig(config);
 assert.ok(clean.columns.season.Portería.includes('savesper90'));
 assert.ok(!clean.columns.season.Portería.includes('calc_oldxa'));
 assert.ok(!clean.columns.competition.Portería.includes('xaper90'));
 assert.ok(clean.columns.season.Creación.includes('xaper90'));
});

test("Porteros FotMob: Goals conceded y Conceded representan el mismo total, sin duplicar",()=>{
 const config=initialConfig();
 const bundesliga={player_id:"kobel",season:"2020/2021",competition:"Bundesliga",appearances:33,minutes:2970,metrics:[
  {name:"Saves",value:106,per90:3.21},
  {name:"Goals conceded",value:54,per90:1.63636},
  {name:"Conceded",value:54,per90:1.63636}
 ]};
 const champions={...bundesliga,competition:"Champions League",appearances:6,minutes:540,metrics:[
  {name:"Goals conceded",value:11,per90:1.8333},
  {name:"Conceded",value:11,per90:1.8333}
 ]};
 assert.equal(columnValue(bundesliga,"competition","goalsconcededwhileonpitch",config),54);
 const season=buildSeasonSummaries([bundesliga,champions],[])[0];
 assert.equal(columnValue(season,"season","goalsconcededwhileonpitch",config),65);
 assert.equal(columnValue({...bundesliga,metrics:[]},"competition","goalsconcededwhileonpitch",config),null);
});
test("El alias Conceded y la traducción Goles en contra se reconocen sin inventar ceros",()=>{
 const config=initialConfig();
 for(const label of ["Conceded","Goles en contra","Goals against"]){
  const record={player_id:"gk",season:"2025/2026",competition:"LaLiga",metrics:[{name:label,value:18}]};
  assert.equal(columnValue(record,"competition","goalsconcededwhileonpitch",config),18);
 }
 const zero={player_id:"gk",season:"2025/2026",competition:"Copa",metrics:[{name:"Goals conceded",value:0}]};
 assert.equal(columnValue(zero,"competition","goalsconcededwhileonpitch",config),0);
});

test("La categoría Ataque incluye regates completados y veces desposeído en ambas vistas",()=>{
 const config=initialConfig();
 assert.equal(config.version,5);
 for(const mode of ["season","competition"]){
  assert.ok(config.columns[mode].Ataque.includes("dribbles"));
  assert.ok(config.columns[mode].Ataque.includes("dispossessed"));
 }
 assert.equal(getColumn(config,"dribbles").name,"Regates exitosos");
 assert.equal(getColumn(config,"dispossessed").name,"Veces desposeído");
});
test("Las preferencias v4 incorporan una sola vez las dos columnas sin perder otras personalizaciones",()=>{
 const old=initialConfig();
 old.version=4;
 old.columns.competition.Ataque=["xg","shots"];
 old.columns.season.Ataque=["xg","calc_groundduelspct"];
 const migrated=sanitizeConfig(old);
 assert.equal(migrated.version,5);
 assert.deepEqual(migrated.columns.competition.Ataque,["xg","shots","dribbles","dispossessed"]);
 assert.deepEqual(migrated.columns.season.Ataque,["xg","calc_groundduelspct","dribbles","dispossessed"]);
 // If the user later manually hides them, don't force them back.
 migrated.columns.competition.Ataque=["xg","shots"];
 const later=sanitizeConfig(migrated);
 assert.deepEqual(later.columns.competition.Ataque,["xg","shots"]);
});
test("Regates y desposesiones leen datos FotMob, variantes y ceros reales por competición",()=>{
 const config=initialConfig();
 const row={player_id:"wing",season:"2023/2024",competition:"Premier League",minutes:2895,metrics:[
  {name:"Successful dribbles",value:65},{name:"Times dispossessed",value:66}
 ]};
 assert.equal(columnValue(row,"competition","dribbles",config),65);
 assert.equal(columnValue(row,"competition","dispossessed",config),66);
 assert.equal(columnValue({...row,metrics:[]},"competition","dribbles",config),null);
 const zero={...row,metrics:[{name:"Dribbles",value:0},{name:"Dispossessed",value:0}]};
 assert.equal(columnValue(zero,"competition","dribbles",config),0);
 assert.equal(columnValue(zero,"competition","dispossessed",config),0);
});
test("La vista por temporada agrega ambas columnas sin convertir a cero las competiciones sin datos",()=>{
 const cfg=initialConfig();
 const rowA={player_id:"wing",season:"2023/2024",competition:"Premier League",minutes:2895,metrics:[
  {name:"Dribbles",value:65},{name:"Dispossessed",value:66}]};
 const rowB={...rowA,competition:"Champions League",metrics:[{name:"Dribbles",value:8}]};
 const summary=buildSeasonSummaries([rowA,rowB],[])[0];
 assert.equal(columnValue(summary,"season","dribbles",cfg),73);
 assert.equal(columnValue(summary,"season","dispossessed",cfg),66);
 assert.equal(summary.totals.dispossessed.partial,true);
});
test("El editor de la ficha conserva los nombres reales de FotMob y puede añadir la métrica faltante",()=>{
 const fs=readFileSync(new URL("../src/pages/Stats.jsx",import.meta.url),"utf8");
 assert.match(fs,/dribbles:"Dribbles",dispossessed:"Dispossessed"/);
 assert.match(fs,/id==="dribbles"\?\["Dribbles","Successful dribbles"/);
 assert.match(fs,/id==="dispossessed"\?\["Dispossessed","Times dispossessed"\]/);
});
