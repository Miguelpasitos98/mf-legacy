import test from "node:test";
import assert from "node:assert/strict";
import {normalizeTacticalEnum,parseManagerTacticalResponse} from "../src/components/managers/managerTacticalAI.mjs";
test("valid alternative build up labels normalize without guessing",()=>{
 for(const [input,expected] of [["Mixta","mixed"],["mixed","mixed"],["Short Passing","short"],["salida corta","short"],["Juego directo","direct"],["long balls","direct"],["hybrid","mixed"]]){
  assert.equal(normalizeTacticalEnum("build_up",input),expected);
 }
});
test("variants of transition and defensive block normalize",()=>{
 assert.equal(normalizeTacticalEnum("transition","Gegenpressing"),"counter_press");
 assert.equal(normalizeTacticalEnum("transition","Presión tras pérdida"),"counter_press");
 assert.equal(normalizeTacticalEnum("defensive_block","Bloque alto"),"high");
 assert.equal(normalizeTacticalEnum("defensive_block","mid block"),"medium");
});
test("ambiguous and missing values produce specific editable error",()=>{
 assert.throws(()=>normalizeTacticalEnum("build_up","quick and slow"),/quick and slow/);
 assert.throws(()=>normalizeTacticalEnum("build_up",null),/null/);
 assert.throws(()=>normalizeTacticalEnum("transition","attack"),/transition/);
});
test("parser consistently normalizes all three tactical enums",()=>{
 const row={identifiable:true,confidence:"high",formation:"4-3-3",possession:70,pressing:85,tempo:79,defensive_line:80,attacking_width:72,risk_taking:68,
 build_up:"Mixta",transition:"presión tras pérdida",defensive_block:"bloque alto",
 player_role_priorities:{GK:"Guardameta",CB:"Central",FB:"Lateral",DM:"Pivote",AM:"Interior",WG:"Extremo",ST:"Delantero"},
 profile_notes:"Modelo de presión tras pérdida, bloque adelantado y transiciones rápidas.",source_urls:[]};
 const parsed=parseManagerTacticalResponse(row);
 assert.equal(parsed.values.build_up,"mixed");
 assert.equal(parsed.values.transition,"counter_press");
 assert.equal(parsed.values.defensive_block,"high");
});
