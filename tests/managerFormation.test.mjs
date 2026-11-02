import test from "node:test";
import assert from "node:assert/strict";
import {normalizeManagerFormation} from "../src/components/managers/managerTacticalAI.mjs";
test("retains realistic historical formations, without mapping distinct systems",()=>{
 for(const expected of ["4-3-3","4-2-2-2","3-4-2-1","4-1-2-1-2","3-4-1-2","4-2-4"]){
  assert.equal(normalizeManagerFormation(expected),expected);
 }
 assert.notEqual(normalizeManagerFormation("4-2-2-2"),"4-2-3-1");
});
test("normalizes harmless separators and rejects impossible formations with the actual value",()=>{
 assert.equal(normalizeManagerFormation("4–2–2–2"),"4-2-2-2");
 assert.equal(normalizeManagerFormation("4 2 3 1"),"4-2-3-1");
 assert.throws(()=>normalizeManagerFormation("4-4-4"),/4-4-4/);
 assert.throws(()=>normalizeManagerFormation("3-4-3-1"),/3-4-3-1/);
 assert.throws(()=>normalizeManagerFormation(null),/ausente/);
});
