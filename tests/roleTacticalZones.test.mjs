import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 tacticalRoleFamily,tacticalPositionSide,tacticalZoneForRole,
 ROLE_ZONE_SIGNATURES,
} from "../src/utils/roleTacticalZones.js";

const role="🌀 Complete Full-Back";
test("Hakimi RB maps Complete Full-Back to the right flank, not the midfield",()=>{
 const zone=tacticalZoneForRole(role,"RB",{left:11,right:20});
 assert.equal(zone.family,"FB");
 assert.equal(zone.roleName,"Complete Full-Back");
 assert.equal(zone.cx,78);
 assert.equal(zone.cy,69);
 assert.ok(zone.cx>70);
});
test("FM right-defender strings preserve a true right flank",()=>{
 for(const position of ["DR","D (R)","D(R), WB(R)","WB (R)","defensa_derecho","carrilero_derecho"]){
  assert.equal(tacticalRoleFamily(position),"FB",position);
  assert.equal(tacticalPositionSide(position),"right",position);
  assert.equal(tacticalZoneForRole(role,position)?.cx,78,position);
 }
});
test("Left fullbacks mirror to the left; left and right feet do not reverse their positional side",()=>{
 for(const position of ["LB","D (L)","WB (L)","defensa_izquierdo","carrilero_izquierdo"]){
  assert.equal(tacticalPositionSide(position),"left");
  assert.equal(tacticalZoneForRole(role,position,{left:1,right:20})?.cx,22);
 }
});
test("Ambiguous/missing flank is shown centrally only when actual position has no known side",()=>{
 for(const position of ["FB","D (RL)","D (L), WB (R)"]){
  assert.equal(tacticalPositionSide(position),null);
  assert.equal(tacticalZoneForRole(role,position)?.cx,50);
 }
});
test("Central positions and individual role signatures are preserved",()=>{
 assert.equal(tacticalZoneForRole("🧠 Ball-Playing Defender","CB").cx,50);
 assert.equal(tacticalZoneForRole("🎯 Clinical Finisher","ST").cy,40);
 assert.equal(tacticalZoneForRole("🌀 Complete Full-Back","LW").cx,22);
 assert.equal(Object.keys(ROLE_ZONE_SIGNATURES).length,72);
});
test("The player page sends the same normalized position to both the jersey and tactics",()=>{
 const page=readFileSync(new URL("../src/pages/PlayerDetail.jsx",import.meta.url),"utf8");
 assert.match(page,/<AdjustableRoles[^>]*position=\{jerseyPosition\|\|editablePlayer\?\.position/);
});
