import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {normalizeFormationDescription,normalizeManagerFormation} from "../src/components/managers/managerFormationNormalization.mjs";
import {parseManagerTacticalResponse,previewManagerTacticalDraft} from "../src/components/managers/managerTacticalAI.mjs";
import {cleanProfile,PROFILE_BLANK} from "../src/components/managers/managerModel.mjs";
import {formationSlots} from "../src/components/managers/managerFormationPlanner.mjs";
const priorities={GK:"Portero",CB:"Central",FB:"Lateral",DM:"Pivote",AM:"Mediapunta",WG:"Extremo",ST:"Delantero"};
const raw={identifiable:true,confidence:"medium",profile_scope:"season",season:"2023/2024",
 formation:"4-3-3 / 4-4-2 (rombo)",possession:55,pressing:65,tempo:60,defensive_line:58,attacking_width:50,risk_taking:45,
 build_up:"mixed",transition:"balanced",defensive_block:"medium",player_role_priorities:priorities,
 profile_notes:"Dos sistemas habituales documentados en esta etapa: variaba del tres arriba a la estructura en rombo según los rivales y los jugadores disponibles.",
 source_urls:[]};
test("the user's exact failing input becomes one valid primary and a documented diamond alternative",()=>{
 const parsed=normalizeFormationDescription("4-3-3 / 4-4-2 (rombo)");
 assert.equal(parsed.formation,"4-3-3");
 assert.equal(parsed.alternatives.length,1);
 assert.deepEqual(parsed.alternatives[0],{original:"4-4-2 (rombo)",formation:"4-1-2-1-2",variant:"rombo"});
 assert.match(parsed.warning.reason,/ambos|alternativa|Alternativa/);
 const output=parseManagerTacticalResponse(raw);
 assert.equal(output.values.formation,"4-3-3");
 assert.ok(output.warnings.some(w=>w.field==="formation"));
 const draft=previewManagerTacticalDraft(PROFILE_BLANK,output);
 assert.match(draft.profile_notes,/4-3-3 \/ 4-4-2 \(rombo\)/);
 assert.match(draft.profile_notes,/4-1-2-1-2/);
 assert.equal(cleanProfile(draft,"coach",output.roleText).formation,"4-3-3");
});
test("manual editor keeps both formations in notes and planner uses the primary only",()=>{
 const saved=cleanProfile({...PROFILE_BLANK,name:"Modelo 2 sistemas",formation:raw.formation,profile_notes:raw.profile_notes},"coach",priorities);
 assert.equal(saved.formation,"4-3-3");
 assert.match(saved.profile_notes,/4-4-2 \(rombo\)/);
 assert.match(saved.profile_notes,/4-1-2-1-2/);
 const layout=formationSlots(raw.formation);
 assert.equal(layout.valid,true);
 assert.equal(layout.slots.length,11);
 assert.equal(layout.formation,"4-3-3");
});
test("recognizes variants in slash, pipe, semicolon, or and arrow-separated lists",()=>{
 for(const raw of ["4-3-3 / 4-4-2 (rombo)","4-3-3 | 4-4-2 (rombo)","4-3-3; 4-4-2 (rombo)",
 "4-3-3 o 4-4-2 (rombo)","4-3-3 → 4-4-2 (rombo)","4-3-3, 4-4-2 (rombo)"]){
  const normalized=normalizeFormationDescription(raw);
  assert.equal(normalized.formation,"4-3-3",raw);
  assert.equal(normalized.alternatives?.[0]?.formation,"4-1-2-1-2",raw);
 }
 assert.equal(normalizeManagerFormation("4/3/3"),"4-3-3");
 assert.equal(normalizeManagerFormation("4-4-2 (rombo)"),"4-1-2-1-2");
});
test("invalid alternative never discards the valid primary and remains visible for review",()=>{
 const parsed=normalizeFormationDescription("4-3-3 / 4-4-4");
 assert.equal(parsed.formation,"4-3-3");
 assert.equal(parsed.invalidAlternatives.length,1);
 assert.match(parsed.warning.reason,/4-4-4/);
 assert.throws(()=>normalizeManagerFormation("4-4-4 / 8-2"),/no es válida/);
});
test("prompt tells AI to emit primary formation and put alternatives in notes",()=>{
 const individual=fs.readFileSync("src/components/managers/managerTacticalAI.mjs","utf8");
 const career=fs.readFileSync("src/components/managers/managerCareerDNA.mjs","utf8");
 assert.match(individual,/formation debe contener UNA SOLA formación PRINCIPAL/);
 assert.match(career,/En formation escribe UNA formación principal/);
});
