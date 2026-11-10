import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {PLAYER_ATTRIBUTE_GROUPS} from "../src/components/players/playerAttributeGroups.mjs";
const schema=JSON.parse(readFileSync("base44/entities/Player.jsonc","utf8"));
test("manual form uses exactly the attributes accepted by Player schema",()=>{
 let count=0;
 for(const [family,fields] of Object.entries(PLAYER_ATTRIBUTE_GROUPS)){
  const allowed=schema.properties.stats.properties[family]?.properties||{};
  for(const [key] of fields){
   assert.ok(allowed[key],family+"."+key+" is absent from Player");
   count++;
  }
 }
 assert.ok(count>=50);
});
test("player schema supports the additional fields of the current editor",()=>{
 for(const key of ["position","secondary_position","secondary_country_id","height","right_foot","left_foot","shirt_number","stats","tactical_roles","career_status","last_team_id","retirement_year","manager_fit_candidate"]){
  assert.ok(schema.properties[key],key+" is missing");
 }
});
test("manual-only changes do not touch FM26 source identifiers",()=>{
 const modal=readFileSync("src/components/players/PlayerFormModal.jsx","utf8");
 assert.ok(!/fm26_uid|fm26_source_record|fm26_source:/.test(modal));
 assert.match(modal,/managerFitCandidate/);
});
