import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  fm27Payload,fm27Delta,fm27ReviewSummary,fm27FilterPlayer,isFm27Reviewed
} from "../src/components/players/fm27Review.mjs";
import {changedPlayerFields,applyPlayerEditPatch} from "../src/utils/playerEditPatch.js";

test("FM27 stores separate CA/CP and never changes FM26 values",()=>{
 const original={id:"m",ca:165,cp:185,fm27_reviewed:false};
 const initial={fm27Ca:"",fm27Cp:"",fm27Reviewed:false,fm27ReviewNotes:""};
 const edited={...initial,fm27Ca:"170",fm27Cp:"190",fm27Reviewed:true};
 const payload={...fm27Payload(edited,original,new Date("2026-11-11T10:00:00.000Z")),ca:original.ca,cp:original.cp};
 const patch=changedPlayerFields(edited,initial,payload);
 assert.deepEqual(patch,{fm27_ca:170,fm27_cp:190,fm27_reviewed:true,fm27_reviewed_at:"2026-11-11"});
 const updated=applyPlayerEditPatch(original,patch);
 assert.equal(updated.ca,165);
 assert.equal(updated.cp,185);
 assert.equal(updated.fm27_ca,170);
 assert.equal(updated.fm27_cp,190);
});
test("checkmark and date can be undone without deleting FM27 values or the baseline",()=>{
 const player={ca:160,cp:185,fm27_ca:167,fm27_cp:181,fm27_reviewed:true,fm27_reviewed_at:"2026-11-10"};
 const payload=fm27Payload({fm27Ca:167,fm27Cp:181,fm27Reviewed:false,fm27ReviewNotes:""},player);
 assert.equal(payload.fm27_reviewed,false);
 assert.equal(payload.fm27_reviewed_at,"");
 assert.equal(payload.fm27_ca,167);
 assert.equal(payload.fm27_cp,181);
 assert.equal(fm27Delta(player.ca,payload.fm27_ca),7);
 assert.equal(fm27Delta(player.cp,payload.fm27_cp),-4);
});
test("re-saving a reviewed player does not reset the review date",()=>{
 const player={fm27_reviewed:true,fm27_reviewed_at:"2026-10-02"};
 const output=fm27Payload({fm27Ca:"",fm27Cp:"",fm27Reviewed:true,fm27ReviewNotes:"ok"},player,new Date("2026-11-11T10:00:00Z"));
 assert.equal(output.fm27_reviewed_at,"2026-10-02");
});
test("unknown FM27 ratings remain absent; invalid values are rejected",()=>{
 const original={fm27_reviewed:false};
 const empty=fm27Payload({fm27Ca:"",fm27Cp:"",fm27Reviewed:true,fm27ReviewNotes:""},original);
 assert.equal(empty.fm27_ca,null);
 assert.equal(empty.fm27_cp,null);
 for(const wrong of ["201","-1","19.5","not-a-number"]){
  assert.throws(()=>fm27Payload({fm27Ca:wrong,fm27Cp:"",fm27Reviewed:false},original),/CA de FM27/);
 }
});
test("filters and progress count only manually confirmed players",()=>{
 const records=[{fm27_reviewed:true},{fm27_reviewed:false,fm27_ca:180},{}, {fm27_reviewed:true}];
 assert.deepEqual(fm27ReviewSummary(records),{reviewed:2,total:4,pending:2});
 assert.equal(records.filter(p=>fm27FilterPlayer(p,"reviewed")).length,2);
 assert.equal(records.filter(p=>fm27FilterPlayer(p,"pending")).length,2);
 assert.equal(records.filter(p=>fm27FilterPlayer(p,"all")).length,4);
 assert.equal(isFm27Reviewed(records[1]),false);
});
test("Player schema and UI expose FM27 fields and old FM26 CA/CP remain editable",()=>{
 const schema=JSON.parse(readFileSync("base44/entities/Player.jsonc","utf8"));
 for(const key of ["fm27_ca","fm27_cp","fm27_reviewed","fm27_reviewed_at","fm27_review_notes"])assert.ok(schema.properties[key],key);
 const editor=readFileSync("src/pages/PlayerDetail.jsx","utf8");
 const catalog=readFileSync("src/pages/Players.jsx","utf8");
 assert.match(editor,/FM27 · Revisión/);
 assert.match(editor,/Marcar jugador como revisado FM27/);
 assert.match(editor,/CA.*FM27/);
 assert.match(editor,/CP.*FM27/);
 assert.match(editor,/ca: numericCA/);
 assert.match(editor,/cp: numericCP/);
 assert.match(catalog,/fm27FilterPlayer\(player,fm27StatusFilter\)/);
 assert.match(catalog,/fm27Progress.reviewed/);
});
