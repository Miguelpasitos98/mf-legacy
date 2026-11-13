import test from "node:test";
import assert from "node:assert/strict";
import { buildSafeFmPatch, compatibleFmTarget, suggestFmTarget } from "../src/utils/fmSaveDirectImport.mjs";

const fm26 = { game:"FM26",game_build:"26.1",reader:"fmsave",reader_version:"0.12.2",game_date:"2025-08-01" };
const fm27 = { game:"FM27",game_build:"27.0.1",reader:"fmsave",reader_version:"0.12.2" };
const arturo = { uid:75000261,name:"Arturo Vidal",birth_date:"1987-05-22",ability:{current:168,potential:176}, attributes:{passing:17} };
const target = {id:"base44-1",name:"Arturo Vidal",date_of_birth:"22/05/1987",fm26_uid:"75000261",ca:170,cp:179,stats:{mental:{vision:20}},fm27_ca:160,fm27_cp:174,fm27_reviewed:true};

test("FM26 matches its own ID without interpreting FM27 IDs",()=>{
  assert.equal(suggestFmTarget(arturo,[target],fm26.game).status,"linked");
  assert.equal(suggestFmTarget(arturo,[target],fm27.game).status,"suggested");
});
test("name and birth date mismatch or edition UID conflict blocks a target",()=>{
  assert.equal(compatibleFmTarget(arturo,{...target,date_of_birth:"21/05/1987"},fm26.game),false);
  assert.equal(compatibleFmTarget(arturo,{...target,fm27_uid:"999"},fm27.game),false);
  assert.equal(suggestFmTarget(arturo,[{...target,fm27_uid:"999"}],"FM27").status,"unmatched");
});
test("ambiguous duplicate names are never linked automatically",()=>{
  const result=suggestFmTarget({...arturo,birth_date:""},[
    {id:"x",name:"Arturo Vidal"},{id:"y",name:"Arturo Vidal"}
  ],"FM27");
  assert.equal(result.status,"ambiguous");
  assert.equal(result.match,null);
});
test("FM27 import fills only missing FM27 fields and preserves manual values",()=>{
  const patch=buildSafeFmPatch({source:fm27,record:arturo,target,now:new Date("2026-11-13T12:00:00Z")});
  assert.equal(patch.fm27_uid,"75000261");
  assert.equal(patch.fm27_ca,undefined);
  assert.equal(patch.fm27_cp,undefined);
  assert.equal(patch.fm27_reviewed,undefined);
  assert.equal(patch.ca,undefined);
  assert.equal(patch.cp,undefined);
  assert.equal(patch.stats,undefined);
  assert.deepEqual(patch.fm27_source_record,arturo);
  assert.equal(patch.fm27_import_meta.build,"27.0.1");
});
test("FM27 import fills empty values without touching FM26",()=>{
  const patch=buildSafeFmPatch({source:fm27,record:arturo,target:{id:"a",name:arturo.name,ca:100,cp:190}});
  assert.equal(patch.fm27_ca,168);
  assert.equal(patch.fm27_cp,176);
  assert.equal(patch.ca,undefined);
  assert.equal(patch.cp,undefined);
});
test("FM26 import protects existing CA/PA and stats",()=>{
  const patch=buildSafeFmPatch({source:fm26,record:arturo,target});
  assert.equal(patch.ca,undefined);
  assert.equal(patch.cp,undefined);
  assert.equal(patch.stats,undefined);
  assert.equal(patch.fm26_uid,undefined);
  assert.equal(patch.fm26_source_record.name,arturo.name);
});
test("FM26 import fills blank official CA and PA only",()=>{
  const patch=buildSafeFmPatch({source:fm26,record:arturo,target:{id:"x",name:arturo.name}});
  assert.equal(patch.ca,168);
  assert.equal(patch.cp,176);
  assert.equal(patch.fm27_ca,undefined);
});
test("existing source snapshots are not overwritten",()=>{
  const previous={uid:42,name:"Arturo Vidal"};
  const patch=buildSafeFmPatch({source:fm27,record:arturo,target:{id:"x",name:arturo.name,fm27_uid:"75000261",fm27_source_record:previous,fm27_import_meta:{game:"FM27"},fm27_ca:155,fm27_cp:165}});
  assert.equal(patch.fm27_source_record,undefined);
  assert.equal(patch.fm27_import_meta,undefined);
  assert.equal(Object.keys(patch).length,0);
});
