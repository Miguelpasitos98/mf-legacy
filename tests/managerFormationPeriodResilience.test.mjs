import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {normalizeFormationDescription,normalizeManagerFormation} from "../src/components/managers/managerFormationNormalization.mjs";
import {normalizeExplicitSeason,resolveExplicitManagerPeriod} from "../src/components/managers/managerSeasonNormalization.mjs";
import {inferManagerProfileContext,parseManagerTacticalResponse,previewManagerTacticalDraft,effectiveProfileContext} from "../src/components/managers/managerTacticalAI.mjs";
import {parseManagerCareerResponse,CAREER_FORMAT} from "../src/components/managers/managerCareerDNA.mjs";
import {cleanProfile,PROFILE_BLANK} from "../src/components/managers/managerModel.mjs";
import {formationSlots} from "../src/components/managers/managerFormationPlanner.mjs";

const roles={GK:"Portero",CB:"Central",FB:"Lateral",DM:"Pivote",AM:"Mediapunta",WG:"Extremo",ST:"Delantero"};
const base={
 identifiable:true,confidence:"medium",profile_scope:"period",reference_club:"AC Milan",
 period_start:"2001/02",period_end:"2008/09",season:"",
 suggested_name:"Milan del rombo",formation:"4-4-2 (rombo)",
 possession:67,pressing:54,tempo:66,defensive_line:60,attacking_width:48,risk_taking:64,
 build_up:"mixed",transition:"balanced",defensive_block:"medium",
 player_role_priorities:roles,profile_notes:"Los mediocampistas ocupan un rombo con organizador retrasado, interiores de apoyo y un mediapunta por detrás de dos atacantes.",
 source_urls:[]
};
test("real 4-4-2 diamond is accepted AND its structure remains distinct from a flat 4-4-2",()=>{
 assert.equal(normalizeManagerFormation("4-4-2 (rombo)"),"4-1-2-1-2");
 assert.equal(normalizeManagerFormation("4-4-2 diamante"),"4-1-2-1-2");
 assert.equal(normalizeManagerFormation("4-4-2 diamond"),"4-1-2-1-2");
 assert.equal(normalizeManagerFormation("4-4-2 (plano)"),"4-4-2");
 assert.notEqual(normalizeManagerFormation("4-4-2 (rombo)"),normalizeManagerFormation("4-4-2"));
 const parsed=parseManagerTacticalResponse(base);
 assert.equal(parsed.values.formation,"4-1-2-1-2");
 assert.equal(parsed.context.scope,"period");
 assert.equal(parsed.context.period_start,"2001/2002");
 assert.equal(parsed.context.period_end,"2008/2009");
 assert.ok(parsed.warnings.some(w=>w.field==="formation"&&w.original==="4-4-2 (rombo)"));
 const draft=previewManagerTacticalDraft(PROFILE_BLANK,parsed);
 assert.equal(draft.formation,"4-1-2-1-2");
 assert.match(draft.profile_notes,/4-4-2 \\(rombo\\)/);
 assert.equal(cleanProfile(draft,"coach",parsed.roleText).formation,"4-1-2-1-2");
});
test("manual profile editor accepts formation variants and preserves original description",()=>{
 const saved=cleanProfile({...PROFILE_BLANK,name:"Milán rombo",formation:"4-4-2 (rombo)",profile_notes:"Formación documentada."},"coach",roles);
 assert.equal(saved.formation,"4-1-2-1-2");
 assert.match(saved.profile_notes,/4-4-2 \\(rombo\\)/);
 assert.match(saved.profile_notes,/Formación documentada/);
 const flat=cleanProfile({...PROFILE_BLANK,name:"Clásico",formation:"4-4-2"},"coach",roles);
 assert.equal(flat.formation,"4-4-2");
 assert.doesNotMatch(flat.profile_notes,/rombo/i);
});
test("all structural ten-outfielder shapes work without a whitelist",()=>{
 for(const shape of ["2-3-5","3-2-5","3-2-4-1","3-2-2-3","4-6-0","4-2-4","5-4-1","4-3-3 (falso nueve)","4-4-2 (rombo)"]){
  const normalized=normalizeManagerFormation(shape);
  const plan=formationSlots(shape);
  assert.equal(plan.valid,true,shape+" "+plan.reason);
  assert.equal(plan.formation,normalized);
  assert.equal(plan.slots.length,11,shape);
  assert.equal(new Set(plan.slots.map(s=>s.id)).size,11,shape);
 }
 assert.equal(normalizeManagerFormation("4–4–2 (rombo)"),"4-1-2-1-2");
 assert.equal(normalizeManagerFormation("Sistema 4 1 2 1 2"),"4-1-2-1-2");
 assert.equal(normalizeFormationDescription("4-3-3 (falso nueve)").variant,"falso nueve");
});
test("invalid arithmetic still rejects shapes, without broad-list limitations",()=>{
 for(const shape of ["8-2","4-4-4","3-4-3-1","4-3-0-3","4-3-3-2"]){
  assert.throws(()=>normalizeManagerFormation(shape),/formación no es válida/i,shape);
 }
 assert.throws(()=>normalizeManagerFormation(""),/ausente/);
});
test("explicit abbreviated seasons and ranges normalize without changing the start and end campaign",()=>{
 assert.equal(normalizeExplicitSeason("2001/02"),"2001/2002");
 assert.equal(normalizeExplicitSeason("1999/00"),"1999/2000");
 assert.equal(normalizeExplicitSeason("2008-2009"),"2008/2009");
 assert.equal(normalizeExplicitSeason("2015"),"");
 assert.equal(normalizeExplicitSeason("2014-2016"),"");
 const context=resolveExplicitManagerPeriod({period_start:"2018/19",period_end:"2020/21"},"period");
 assert.deepEqual([context.scope,context.period_start,context.period_end],["period","2018/2019","2020/2021"]);
 const single=resolveExplicitManagerPeriod({period_start:"2018/19",period_end:"2018/19"},"period");
 assert.equal(single.scope,"season");
 assert.equal(single.season,"2018/2019");
 const merged=resolveExplicitManagerPeriod({period_start:"2018/19 – 2020/21",period_end:""},"period");
 assert.equal(merged.period_start,"2018/2019");
 assert.equal(merged.period_end,"2020/2021");
});
test("AI with same-season period is repairable as a season, never a hard error",()=>{
 const output=parseManagerTacticalResponse({...base,period_start:"2018/19",period_end:"2018/19"});
 assert.equal(output.context.scope,"season");
 assert.equal(output.context.season,"2018/2019");
 assert.ok(output.warnings.some(x=>x.field==="profile_scope"));
});
test("AI with unknown calendar-only dates retains explicit original in warnings, never invents seasons",()=>{
 for(const input of [
  {period_start:"2014",period_end:"2016"},
  {period_start:"2023/24",period_end:"2018/19"},
  {period_start:"2018/19",period_end:""},
  {period_start:"2014-2016",period_end:""}
 ]){
  const result=parseManagerTacticalResponse({...base,...input});
  assert.equal(result.context.scope,"general");
  assert.equal(result.context.origin,"invalid_dates");
  assert.ok(result.warnings.some(w=>w.field==="periodo"));
  const draft=previewManagerTacticalDraft(PROFILE_BLANK,result);
  assert.equal(draft.profile_scope,"general");
  assert.ok(draft.profile_notes.includes(input.period_start));
 }
});
test("preserve an existing complete period when AI supplies incompatible date fields",()=>{
 const existing={...PROFILE_BLANK,name:"Etapa guardada",profile_scope:"period",reference_club:"Club",
   period_start:"2014/2015",period_end:"2016/2017"};
 const parsed=parseManagerTacticalResponse({...base,period_start:"2014",period_end:"2016"});
 const effective=effectiveProfileContext(existing,parsed);
 assert.equal(effective.scope,"period");
 assert.equal(effective.period_start,"2014/2015");
 assert.equal(effective.period_end,"2016/2017");
 const draft=previewManagerTacticalDraft(existing,parsed);
 assert.equal(draft.period_start,existing.period_start);
 assert.equal(draft.period_end,existing.period_end);
 assert.match(draft.profile_notes,/2014/);
});
test("career research skips only unresolvable historical periods and keeps valid stages and synthesis",()=>{
 const era={...base,model_id:"milan_2001_2009",success_tier:"unknown",
  results_summary:"No se ha cuantificado el resultado deportivo con evidencia suficiente para valorar esta etapa.",
  main_changes:"Desarrollo del rombo",source_urls:[]};
 const invalid={...era,model_id:"milan_years_only",suggested_name:"Periodo impreciso",
  period_start:"2014",period_end:"2016"};
 const bundle={format:CAREER_FORMAT,identifiable:true,confidence:"medium",
  models:[era,invalid],best_supported_model_id:invalid.model_id,
  comparative_reason:"Las etapas representan formas distintas de construir el equipo y se deben analizar con la evidencia disponible.",
  general_philosophy:{...base,profile_scope:"general",reference_club:"",period_start:"",period_end:"",
   suggested_name:"Filosofía general",formation:"4-3-3 (falso nueve)"}};
 const parsed=parseManagerCareerResponse(bundle);
 assert.equal(parsed.models.length,1);
 assert.equal(parsed.models[0].profile.formation,"4-1-2-1-2");
 assert.equal(parsed.pendingModels.length,1);
 assert.equal(parsed.pendingModels[0].id,invalid.model_id);
 assert.equal(parsed.bestId,null);
 assert.equal(parsed.general.profile.formation,"4-3-3");
 assert.match(parsed.general.profile.profile_notes,/falso nueve/);
 assert.ok(parsed.warnings.some(x=>x.modelId===invalid.model_id&&x.field==="periodo"));
 const onlyBad=parseManagerCareerResponse({...bundle,models:[invalid]});
 assert.equal(onlyBad.models.length,0);
 assert.equal(onlyBad.pendingModels.length,1);
 assert.equal(onlyBad.general.profile.profile_scope,"general");
});
test("career and individual UI allow review of repaired formations, dates and pending periods",()=>{
 const managers=fs.readFileSync("src/pages/Managers.jsx","utf8");
 const prompt=fs.readFileSync("src/components/managers/managerTacticalAI.mjs","utf8");
 assert.match(managers,/4-4-2 \\(rombo\\)/);
 assert.match(managers,/careerDraft\\.pendingModels/);
 assert.match(managers,/tacticalWarnings\\.map/);
 assert.match(prompt,/La formación NO está limitada a una lista cerrada/);
 assert.match(prompt,/no años calendario sueltos/);
});
