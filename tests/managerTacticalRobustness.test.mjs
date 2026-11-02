import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {parseManagerTacticalResponse,previewManagerTacticalDraft,normalizeTacticalEnum,normalizeResearchConfidence,normalizeResearchScope} from "../src/components/managers/managerTacticalAI.mjs";
import {parseManagerCareerResponse,CAREER_FORMAT} from "../src/components/managers/managerCareerDNA.mjs";
const roleText={GK:"Guardameta",CB:"Central",FB:"Lateral",DM:"Pivote",AM:"Interior",WG:"Extremo",ST:"Delantero"};
const model={
 identifiable:true,confidence:"medium",profile_scope:"period",reference_club:"Club",period_start:"2018/2019",period_end:"2020/2021",
 formation:"4-2-3-1",possession:55,pressing:70,tempo:88,defensive_line:65,attacking_width:60,risk_taking:62,
 build_up:"mixed",transition:"fast_break",defensive_block:"high",player_role_priorities:roleText,
 profile_notes:"Estilo ofensivo con transiciones rápidas. La reacción tras pérdida requiere más evidencia contrastada.",
 source_urls:["https://example.org/football"]
};
test("user-reported fast_break cannot abort a valid individual tactical research",()=>{
 const parsed=parseManagerTacticalResponse(model);
 assert.equal(parsed.values.tempo,88);
 assert.equal(parsed.values.transition,"balanced");
 assert.equal(parsed.warnings.length,1);
 assert.equal(parsed.warnings[0].original,"fast_break");
 assert.match(parsed.warnings[0].reason,/ofensiva/);
 const draft=previewManagerTacticalDraft({name:"Modelo principal"},parsed);
 assert.match(draft.profile_notes,/fast_break/);
 assert.match(draft.profile_notes,/valor provisional/);
 assert.equal(draft.formation,"4-2-3-1");
});
test("unrecognized values in all three enums never lose analysis; originals are retained for manual review",()=>{
 const parsed=parseManagerTacticalResponse({...model,build_up:"new-build-up",transition:"quick_counter_attack",defensive_block:"super_high"});
 assert.equal(parsed.values.build_up,"mixed");
 assert.equal(parsed.values.transition,"balanced");
 assert.equal(parsed.values.defensive_block,"medium");
 assert.equal(parsed.warnings.length,3);
 const note=previewManagerTacticalDraft({name:"Modelo principal"},parsed).profile_notes;
 for(const word of ["new-build-up","quick_counter_attack","super_high"])assert.ok(note.includes(word));
});
test("consistent alternatives normalize when meaning is unambiguous",()=>{
 for(const [field,variant,expected] of [
 ["transition","press after loss","counter_press"],["transition","drop back","regroup"],
 ["defensive_block","high line","high"],["build_up","direct build up","direct"],
 ["build_up","patient build up","short"]]){
  const warnings=[];
  assert.equal(normalizeTacticalEnum(field,variant,{onWarning:w=>warnings.push(w)}),expected);
  assert.equal(warnings.length,0);
 }
});
test("unrecognized confidence and scope are conservative and disclosed; numerical quantities never invented",()=>{
 const parsed=parseManagerTacticalResponse({...model,confidence:"unstoppable",profile_scope:"era",transition:"fast_break"});
 assert.equal(parsed.confidence,"low");
 assert.equal(parsed.context.scope,"period");
 assert.ok(parsed.warnings.some(w=>w.field==="confidence"));
 assert.equal(normalizeResearchConfidence("Alta"),"high");
 assert.equal(normalizeResearchScope({profile_scope:"temporada",season:"2020/2021"}),"season");
 assert.throws(()=>parseManagerTacticalResponse({...model,pressing:null}),/estimación válida/);
 assert.throws(()=>parseManagerTacticalResponse({...model,formation:"8-2"}),/formación/);
});
test("career research handles fast_break in period AND general philosophy without re-researching",()=>{
 const era={...model,model_id:"team_2018_2021",suggested_name:"Club 2018-2021",
 success_tier:"unexpected_tier",results_summary:"Se dispone de análisis descriptivo, pero no de una evaluación deportiva suficientemente contrastada.",
 verified_honours:[],main_changes:"Fútbol vertical"};
 const payload={
  format:CAREER_FORMAT,identifiable:true,confidence:"alta",models:[era],
  best_supported_model_id:era.model_id,comparative_reason:"La trayectoria exige más evidencia para evaluar resultados, pero conserva su evolución táctica.",
  general_philosophy:{...model,profile_scope:"general",reference_club:"",period_start:"",period_end:"",
   suggested_name:"Filosofía general",build_up:"strange_label",defensive_block:"other"}
 };
 const parsed=parseManagerCareerResponse(payload);
 assert.equal(parsed.models.length,1);
 assert.equal(parsed.models[0].profile.transition,"balanced");
 assert.equal(parsed.models[0].successTier,"unknown");
 assert.match(parsed.models[0].profile.profile_notes,/fast_break/);
 assert.match(parsed.models[0].profile.profile_notes,/unexpected_tier/);
 assert.match(parsed.general.profile.profile_notes,/strange_label/);
 assert.equal(parsed.bestId,null);
 assert.ok(parsed.warnings.some(w=>w.field==="best_supported_model_id"));
 assert.equal(parsed.confidence,"high");
});
test("the UI displays warnings in individual and career paths",()=>{
 const src=fs.readFileSync("src/pages/Managers.jsx","utf8");
 assert.match(src,/tacticalWarnings\.map/);
 assert.match(src,/careerDraft\.warnings/);
 assert.match(src,/valores no estándar/);
});
