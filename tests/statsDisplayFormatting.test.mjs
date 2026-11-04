import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {initialConfig,sanitizeConfig} from "../src/utils/statsColumns.js";
import {formatStatsTableValue,statsDisplayDigits,isStatsGoalkeeper} from "../src/utils/statsDisplayFormatting.js";

const config=initialConfig();
const view=(id,value,options={},cfg=config)=>formatStatsTableValue(value,id,cfg,options);
test("zero counts and decimal expected-goals columns use one fixed locale format",()=>{
 for(const key of ["goals","assists","ga","shots","appearances","minutes","tackles","interceptions","recoveries","numberofsprints","penaltygoals"]){
  assert.equal(view(key,0).text,"0",key);
  assert.equal(statsDisplayDigits(key,config),0,key);
 }
 for(const key of ["xg","xa","xgot","xga","xgper90","xaper90","xgaper90",
 "gaper90","goalsper90","assistsper90","savesper90","calc_goals_prevented","calc_goals_prevented_p90",
 "xgchain","xgbuildup","calc_xgchainper90","calc_xgbuildupper90"]){
  assert.equal(view(key,0).text,"0,00",key);
  assert.equal(statsDisplayDigits(key,config),2,key);
 }
});
test("true zero is distinct from goalkeeper's absent value displayed as a zero with dagger",()=>{
 const real=view("xg",0,{goalkeeper:true});
 const absent=view("xg",null,{goalkeeper:true});
 const zeroGoals=view("goals",null,{goalkeeper:true});
 const rate=view("xaper90",null,{goalkeeper:true});
 assert.deepEqual([real.text,real.suffix,real.visualZero],["0,00","",false]);
 assert.deepEqual([absent.text,absent.suffix,absent.visualZero],["0,00","†",true]);
 assert.deepEqual([zeroGoals.text,zeroGoals.suffix],["0","†"]);
 assert.deepEqual([rate.text,rate.suffix],["0,00","†"]);
 assert.match(absent.title,/No se guarda como cero/);
 assert.equal(view("xg",null).text,"—","unknown outfield xG is not a zero");
});
test("G+A and penalties visual zero respects counts and never mutates missing data",()=>{
 const value=null;
 assert.equal(view("ga",value).text,"0");
 assert.equal(view("ga",value).suffix,"†");
 assert.equal(view("penaltygoals",value).text,"0");
 assert.equal(view("penaltygoals",value).suffix,"†");
 assert.equal(value,null);
 const custom={...config,computed:[...config.computed,{
  id:"calc_custom_ga",name:"G + A",formula:"(goals + assists)",decimals:0}]};
 const result=view("calc_custom_ga",null,{},custom);
 assert.equal(result.text,"0");
 assert.equal(result.suffix,"†");
});
test("percentages and player ratings are consistently formatted in Spanish",()=>{
 assert.equal(view("playpct",96.43).text,"96,4");
 assert.equal(view("playpct",96.43).unit,"%");
 assert.equal(view("passaccuracy",80.123).text,"80,1");
 assert.equal(view("passaccuracy",80.123).unit,"%");
 assert.equal(view("calc_groundduelspct",56.234).text,"56,23");
 assert.equal(view("calc_groundduelspct",56.234).unit,"%");
 assert.equal(view("rating",7.5).text,"7,50");
 assert.equal(view("topspeed",31.18).text,"31,2");
});
test("partial subtotal keeps its star and the actual value rather than fabricating 0",()=>{
 const partial=view("xa",0,{partial:true});
 assert.equal(partial.text,"0,00");
 assert.equal(partial.suffix,"*");
 assert.equal(partial.visualZero,false);
 assert.equal(partial.partial,true);
 assert.equal(view("xa",null,{partial:true}).text,"—");
 assert.equal(view("xa",null,{partial:true}).suffix,"");
});
test("small positive observed rates show a threshold, not a false exact zero",()=>{
 const x=view("xaper90",0.001,{partial:true});
 assert.equal(x.text,"<0,01");
 assert.equal(x.suffix,"*");
 assert.match(x.title,/Dato real no nulo/);
 assert.equal(view("xa",0.005).text,"0,01");
 assert.equal(view("xg",0).text,"0,00");
 assert.equal(view("xgper90",-0.001).text,">−0,01");
});
test("unknown source values stay missing except explicit presentation-only keeper/count rules",()=>{
 for(const missing of [null,undefined,"",NaN,Infinity]){
  assert.equal(view("xa",missing).text,"—");
  assert.equal(view("shotsontarget",missing).text,"—");
  assert.equal(view("tackles",missing).text,"—");
 }
 assert.equal(view("xa",null,{goalkeeper:true}).suffix,"†");
 assert.equal(view("tackles",null,{goalkeeper:true}).text,"—");
});
test("saved preference overrides for standard rate columns do not generate inconsistent decimals",()=>{
 const dirty=initialConfig();
 dirty.computed.find(x=>x.id==="xaper90").decimals=0;
 dirty.computed.find(x=>x.id==="gaper90").decimals=4;
 dirty.computed.find(x=>x.id==="playpct").decimals=3;
 const cfg=sanitizeConfig(dirty);
 assert.equal(view("xaper90",0.05,{},cfg).text,"0,05");
 assert.equal(view("gaper90",0,{},cfg).text,"0,00");
 assert.equal(view("playpct",0,{},cfg).text,"0,0");
});
test("user-defined formulas preserve user-selected decimal precision",()=>{
 const cfg=initialConfig();
 cfg.computed.push({id:"calc_my_rate",name:"Índice propio",formula:"xg*90/minutes",decimals:4});
 assert.equal(view("calc_my_rate",0,{},cfg).text,"0,0000");
 assert.equal(view("calc_my_rate",0.123456,{},cfg).text,"0,1235");
 assert.equal(view("calc_my_rate",null,{},cfg).text,"—");
});
test("large values use Spanish grouping and sources are not modified",()=>{
 const value=12345.6789;
 const cfg=structuredClone(config);
 assert.equal(view("xg",value,{},cfg).text,"12.345,68");
 assert.equal(view("goals",1200,{},cfg).text,"1.200");
 assert.deepEqual(cfg,config);
});
test("goalkeepers are recognized only by a registered goalkeeper position",()=>{
 assert.equal(isStatsGoalkeeper({position:"GK"}),true);
 assert.equal(isStatsGoalkeeper({position_raw:"POR"}),true);
 assert.equal(isStatsGoalkeeper({position:"DFC"}),false);
 assert.equal(isStatsGoalkeeper(null),false);
});
test("both STATS tables render via the same shared policy and preserve visual-zero markers",()=>{
 const season=fs.readFileSync("src/components/stats/SeasonStatsTable.jsx","utf8");
 const competition=fs.readFileSync("src/pages/Stats.jsx","utf8");
 for(const source of [season,competition]){
  assert.match(source,/formatStatsTableValue\(/);
  assert.match(source,/isStatsGoalkeeper\(/);
  assert.match(source,/display\.suffix==="†"/);
  assert.match(source,/display\.text/);
 }
 assert.match(season,/display\.suffix==="\\*"/);
 assert.match(season,/Subtotal parcial/);
 assert.match(competition,/cero solo visual por dato ausente/);
});
