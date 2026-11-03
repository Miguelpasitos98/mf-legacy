import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
 DEEP_FIT_PRESETS,FUNCTION_FM_ATTRIBUTES,assessCoachFunctionsFM26,
 evaluateDeepFit,normalizeDeepWeights
} from "../src/components/managers/managerFitDeep.mjs";
import {TACTICAL_REQUIREMENT_RULES} from "../src/components/managers/managerRoleRules.mjs";
import {managerFitTemporalScope} from "../src/components/managers/managerFitTemporalScope.mjs";
import {visibleManagerFitCandidates,managerFitScore} from "../src/components/managers/managerFitVisibility.mjs";

const profile={
 name:"ADN de centrales con salida",profile_scope:"period",
 period_start:"2015/2016",period_end:"2019/2020",
 player_role_priorities:JSON.stringify({CB:"Salida limpia y dominantes en el aire"}),
 pressing:76,possession:70,tempo:68,defensive_line:74
};
const player={
 id:"p001",name:"Central ejemplo",ca:199,position:"DFC",manager_fit_candidate:true,
 position_ratings:{defensa_central:20},
 stats:{
  technical:{pases:17,tecnica:15,cabeceo:14},
  physical:{fuerza:14,alcance_de_salto:15},
  mental:{decisiones:16,vision:14}
 }
};
const roleFit={
 score:78,confidence:"medium",coverage:80,minimumPeers:27,
 requirementBreakdown:[{id:"ball_playing_defender",label:"Construcción",score:78},
 {id:"aerial_presence",label:"Presencia aérea",score:66}]
};
const advanced={score:80,attributes:78,style:74,position:100,
 styleDimensions:["pressing","possession","defensive_line"],coverage:90};
const calc=(override={})=>evaluateDeepFit({player,role:"CB",profile,roleFit,advanced,
 weights:DEEP_FIT_PRESETS.balanced,season:"2025/2026",...override});
test("functions are explained with real FM26 role attributes; do not use CA",()=>{
 const scored=assessCoachFunctionsFM26(player,"CB",profile);
 assert.equal(scored.families.length,2);
 assert.equal(scored.validFunctions,2);
 assert.equal(scored.coverage,100);
 assert.notEqual(scored.score,null);
 assert.ok(scored.families.some(f=>f.id==="ball_playing_defender"&&f.evidence.some(a=>a.key==="technical.pases"&&a.raw===17)));
 assert.ok(scored.families.some(f=>f.id==="aerial_presence"&&f.evidence.some(a=>a.key==="physical.alcance_de_salto"&&a.raw===15)));
 const changedCA=calc({player:{...player,ca:1}});
 assert.equal(changedCA.score,calc().score,"CA must remain excluded from tactical fit");
 assert.equal(calc({player:{...player,market_value_eur:10000000}}).score,calc().score);
});
test("all explicitly scored V4 functional rules have independent FM26 skill mappings",()=>{
 for(const rule of TACTICAL_REQUIREMENT_RULES){
  const fields=FUNCTION_FM_ATTRIBUTES[rule.id];
  assert.ok(Array.isArray(fields)&&fields.length>=2,"Missing mapping: "+rule.id);
  for(const field of fields){
   assert.match(field,/^(technical|mental|physical|goalkeeping)\.[a-z_]+$/,"Invalid attribute: "+field);
  }
 }
});
test("deep scorer returns an auditable separate 4-axis model and stable defaults",()=>{
 const result=calc();
 assert.notEqual(result.score,null);
 assert.deepEqual(result.sharedFunctions,["ball_playing_defender","aerial_presence"]);
 assert.deepEqual(result.components.map(x=>x.key),["historical","functions","style","position"]);
 assert.equal(result.components[0].score,78);
 assert.equal(result.components[3].score,100);
 assert.equal(result.components.reduce((sum,x)=>sum+x.effectiveWeight,0),100);
 assert.equal(result.missing.length,0);
 assert.ok(result.score<=100&&result.score>=0);
 assert.equal(result.sensitivityRange.min,Math.min(...Object.values(result.sensitivity)));
 assert.equal(result.sensitivityRange.max,Math.max(...Object.values(result.sensitivity)));
 assert.match(result.explanation,/No es una predicción/);
});
test("deep cannot silently replace missing V4 with FM26 attributes or make up an average",()=>{
 const result=calc({roleFit:{...roleFit,score:null,confidence:"insufficient",
  requirementBreakdown:[{id:"ball_playing_defender",score:null}]}});
 assert.equal(result.score,null);
 assert.equal(result.confidence,"insufficient");
 assert.equal(result.sensitivityRange,null);
 assert.ok(result.missing.some(x=>/histórico V4/i.test(x)));
});
test("deep needs real overlapping evidence for the same ADN function",()=>{
 const onlyBall=calc({roleFit:{...roleFit,requirementBreakdown:[{id:"aDifferentRule",score:90}]}});
 assert.equal(onlyBall.score,null);
 assert.match(onlyBall.missing.join(" "),/función táctica evaluable/i);
 const noAttributes=calc({player:{...player,stats:{technical:{pases:18}}}});
 assert.equal(noAttributes.score,null);
 assert.ok(noAttributes.missing.some(x=>/FM26 suficientes/.test(x)));
});
test("unspecified or inconsistent player stats cannot inflate incomplete tactical scores",()=>{
 const missing=calc({player:{...player,stats:{}}});
 assert.equal(missing.score,null);
 assert.equal(missing.functions.validFunctions,0);
 const bogus=calc({player:{...player,stats:{technical:{pases:1000},physical:{fuerza:"0"}}}});
 assert.equal(bogus.score,null);
});
test("the source blend is responsive to presets but does not overwrite evidence",()=>{
 const balanced=calc();
 const oldProfile=JSON.stringify(profile);
 const history=calc({weights:DEEP_FIT_PRESETS.historical});
 const tactical=calc({weights:DEEP_FIT_PRESETS.tactical});
 assert.notEqual(history.score,tactical.score);
 assert.equal(balanced.components[0].score,history.components[0].score);
 assert.equal(JSON.stringify(profile),oldProfile);
 assert.deepEqual(Object.keys(balanced.sensitivity),Object.keys(DEEP_FIT_PRESETS));
});
test("missing optional style redistributes its weight among sources without pretending to observe it",()=>{
 const result=calc({advanced:{...advanced,style:null,styleDimensions:[]}});
 assert.notEqual(result.score,null);
 assert.equal(result.components.find(x=>x.key==="style").effectiveWeight,0);
 assert.equal(result.components.reduce((sum,x)=>sum+x.effectiveWeight,0),100);
 assert.ok(result.caution.some(x=>x.includes("Sin factor de estilo")));
});
test("invalid weight selection doesn't invent a result and never uses only one source",()=>{
 assert.equal(normalizeDeepWeights({historical:0,functions:0,position:0,style:0}),null);
 assert.equal(calc({weights:{historical:0,functions:75,position:25,style:0}}).score,null);
 assert.equal(calc({weights:{historical:75,functions:0,position:25,style:0}}).score,null);
 const all=calc({weights:{historical:0,functions:0,position:0,style:0}});
 assert.equal(all.score,null);
});
test("contradiction between historical and FM26 skill evidence is surfaced, not hidden",()=>{
 const result=calc({roleFit:{...roleFit,score:20}});
 assert.ok(result.disagreement>25);
 assert.ok(result.caution.some(x=>x.includes("difieren más de 25")));
 assert.equal(result.confidence,"low");
});
test("role/position/missing coaching instructions are not treated as a negative match",()=>{
 const empty=calc({profile:{...profile,player_role_priorities:"{}"}});
 assert.equal(empty.score,null);
 assert.equal(empty.functions.families.length,0);
 const wrongPosition=calc({advanced:{...advanced,position:35}});
 assert.equal(wrongPosition.score,null);
 assert.ok(wrongPosition.missing.some(x=>/Posición FM26 incompatible/.test(x)));
});
test("deep score integrates with visibility without including unmarked players",()=>{
 const rows=[
 {player:{id:"yes",name:"Marcado",manager_fit_candidate:true},fit:90,quality:160,deep:calc()},
 {player:{id:"noScore",name:"Sin medir",manager_fit_candidate:true},fit:85,quality:140,deep:calc({roleFit:{...roleFit,score:null}})}
 ];
 const selected=visibleManagerFitCandidates(rows,{scoreMode:"deep"});
 assert.equal(selected.scoredCount,1);
 assert.deepEqual(selected.rows.map(x=>x.player.id),["yes"]);
 assert.equal(managerFitScore(rows[1],"deep"),null);
 assert.equal(visibleManagerFitCandidates(rows,{scoreMode:"deep",showUnknown:true}).rows.length,2);
});
test("manager era is distinguished from the player historical season",()=>{
 const previous=managerFitTemporalScope(profile,"2018/2019");
 assert.equal(previous.status,"aligned");
 const current=managerFitTemporalScope(profile,"2025/2026");
 assert.equal(current.status,"counterfactual");
 assert.match(current.warning,/hipotétic|contrafactual/);
 assert.equal(managerFitTemporalScope({...profile,profile_scope:"general"},"2025/2026").status,"general");
 assert.equal(managerFitTemporalScope({...profile,profile_scope:"season",season:"2025/2026"},"2025/2026").status,"aligned");
 assert.equal(managerFitTemporalScope({...profile,profile_scope:"season",season:"2010/2011"},"2025/2026").status,"counterfactual");
});
test("UI offers presets, sources, scenario sensitivity, compare and report with candidates only",()=>{
 const page=fs.readFileSync("src/pages/ManagerFit.jsx","utf8");
 const card=fs.readFileSync("src/components/managers/ManagerScoutingVisual.jsx","utf8");
 assert.match(page,/Deep Fit · Cruce real \+ FM26/);
 assert.match(page,/Laboratorio Deep Fit/);
 assert.match(page,/DEEP_FIT_PRESETS/);
 assert.match(page,/setDeepPreset/);
 assert.match(page,/evaluateDeepFit\(\{player:item\.player/);
 assert.match(page,/scoutingDeep\.sensitivityRange/);
 assert.match(page,/temporalContext\.warning/);
 assert.match(card,/item\.deep\.sharedFunctions/);
 assert.match(card,/Deep Fit \(experimental\)/);
});

test("FM26-only traits can preselect players when real stats cannot measure coach demands",()=>{
 const physicalProfile={player_role_priorities:JSON.stringify({CB:"Physical presence"})};
 const physicallyStrong={...player,stats:{physical:{fuerza:17,alcance_de_salto:16},
  mental:{valentia:15}}};
 const result=evaluateDeepFit({player:physicallyStrong,role:"CB",profile:physicalProfile,
  roleFit:{score:null,confidence:"insufficient",requirementBreakdown:[]},
  advanced:{position:100},season:"2025/2026"});
 assert.equal(result.score,null,"FM-only traits must NEVER become a combined Deep score");
 assert.equal(result.functions.score,null);
 assert.ok(result.fmOnlyTraits.score>=70);
 assert.equal(result.preliminaryScore,result.fmOnlyTraits.score);
 assert.equal(result.sharedFunctions.length,0);
});
test("FM-only functional preselection ranks players by skill evidence, not by fame, CA or position when unscored",()=>{
 const p={player_role_priorities:JSON.stringify({CB:"Physical presence"})};
 const make=(id,strength)=>({
  player:{id,name:id},fit:100,quality:id==="elite"?200:100,
  deep:evaluateDeepFit({
   player:{stats:{physical:{fuerza:strength,alcance_de_salto:strength},mental:{valentia:strength}}},
   role:"CB",profile:p,roleFit:{score:null,requirementBreakdown:[]},advanced:{position:100}
  })
 });
 const rows=[make("elite",9),make("selectedSmallerLeague",17)];
 const result=visibleManagerFitCandidates(rows,{scoreMode:"deep",showUnknown:false});
 assert.equal(result.fallback,true);
 assert.equal(result.scoredCount,0);
 assert.deepEqual(result.rows.map(x=>x.player.id),["selectedSmallerLeague","elite"]);
 assert.ok(result.rows.every(x=>x.deep.score===null));
});
test("recognizable speed/leadership/game movement is measured only as FM26, never smuggled into historical V4",()=>{
 const speedProfile={player_role_priorities:JSON.stringify({CB:"Central rápido"})};
 const racer={...player,stats:{physical:{velocidad:16,aceleracion:17}}};
 const result=evaluateDeepFit({player:racer,role:"CB",profile:speedProfile,
  roleFit:{score:null},advanced:{position:100}});
 assert.equal(result.score,null);
 assert.equal(result.fmOnlyTraits.validTraits,1);
 assert.ok(result.preliminaryScore>70);
});
