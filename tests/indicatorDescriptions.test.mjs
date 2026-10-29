import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {INDICATOR_EXPLANATIONS,indicatorExplanation} from "../src/utils/indicatorDescriptions.js";
import {WEIGHTS_BY_ROLE,METRIC_NAMES} from "../src/utils/compositeEngine.js";

test("Every Composite metric and rating has a short definition and truthful formula",()=>{
 const keys=new Set([...Object.values(WEIGHTS_BY_ROLE).flatMap(role=>Object.keys(role)),"rating"]);
 for(const key of keys){
  assert.ok(METRIC_NAMES[key],key+" is not labeled");
  const detail=indicatorExplanation(key);
  assert.ok(detail,key+" does not have a definition");
  assert.ok(typeof detail.description==="string"&&detail.description.length>15,key+" lacks description");
  assert.ok(typeof detail.formula==="string"&&detail.formula.length>15,key+" lacks calculation");
  assert.ok(detail.description.length<145,key+" description too long");
  assert.ok(detail.formula.length<155,key+" formula too long");
 }
 assert.deepEqual([...keys].filter(key=>!INDICATOR_EXPLANATIONS[key]),[]);
});
test("Ball Security describes MF Legacy smoothing, not unadjusted ratio or other-provider internals",()=>{
 const info=indicatorExplanation("ball_security");
 assert.match(info.formula,/\+ 5/);
 assert.match(info.formula,/\+ 10/);
 assert.match(info.formula,/× 100/);
 assert.doesNotMatch(info.description+/ /+info.formula,/CraftedFC|provisional|Cobertura/i);
});
test("A missing metric has no invented formula",()=>{
 assert.equal(indicatorExplanation("unknown_metric"),null);
});
test("The short explanations are shown only when opening indicator modal",()=>{
 const modal=readFileSync(new URL("../src/components/stats/IndicatorHistoricalRankingModal.jsx",import.meta.url),"utf8");
 const preview=readFileSync(new URL("../src/components/stats/HistoricalPeerPreview.jsx",import.meta.url),"utf8");
 const compare=readFileSync(new URL("../src/components/stats/CompareAnalysisTable.jsx",import.meta.url),"utf8");
 assert.match(modal,/indicatorExplanation\(indicator\.key\)/);
 assert.match(modal,/Qué mide:/);
 assert.match(modal,/Cálculo:/);
 assert.doesNotMatch(preview,/indicatorDescription\(/);
 assert.doesNotMatch(compare,/indicatorDescription\(/);
});
