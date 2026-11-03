import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {normalizeManagerBirthDate,displayManagerBirthDate} from "../src/components/managers/managerBirthDate.mjs";
import {cleanManager} from "../src/components/managers/managerModel.mjs";
const draft={name:"Entrenador de prueba",manager_kind:"real",source_status:"manual"};
test("direct Spanish date copy/paste is converted to ISO for Base44",()=>{
 assert.equal(normalizeManagerBirthDate("02/02/1970"),"1970-02-02");
 assert.equal(normalizeManagerBirthDate(" 2/2/1970 "),"1970-02-02");
 assert.equal(cleanManager({...draft,date_of_birth:"02/02/1970"}).date_of_birth,"1970-02-02");
});
test("existing ISO birth dates display as DD/MM/YYYY and round trip without changes",()=>{
 assert.equal(displayManagerBirthDate("1970-02-02"),"02/02/1970");
 assert.equal(normalizeManagerBirthDate(displayManagerBirthDate("1970-02-02")),"1970-02-02");
 assert.equal(cleanManager({...draft,date_of_birth:"1970-02-02"}).date_of_birth,"1970-02-02");
 assert.equal(normalizeManagerBirthDate(""),"");
});
test("accepts clearly Spanish alternative separators and leap dates",()=>{
 assert.equal(normalizeManagerBirthDate("29/02/2000"),"2000-02-29");
 assert.equal(normalizeManagerBirthDate("02-02-1970"),"1970-02-02");
 assert.equal(normalizeManagerBirthDate("02.02.1970"),"1970-02-02");
});
test("invalid birthdays are rejected rather than silently mutated",()=>{
 for(const value of ["31/02/1970","29/02/1970","12/13/1970","30/02/2020",
 "02/02/70","1970/02/02","abc","00/02/1970","02/00/1970","01/01/1800"]){
  assert.throws(()=>cleanManager({...draft,date_of_birth:value}),/fecha/i,value);
 }
});
test("MANAGERS has a paste-friendly text field while data model remains ISO",()=>{
 const ui=fs.readFileSync("src/pages/Managers.jsx","utf8");
 const entity=fs.readFileSync("base44/entities/Manager.jsonc","utf8");
 assert.match(ui,/id="manager-birth-date" type="text"/);
 assert.match(ui,/placeholder="DD\/MM\/AAAA/);
 assert.match(ui,/normalizeManagerBirthDate\(raw\)/);
 assert.match(ui,/displayManagerBirthDate\(managerDraft\.date_of_birth\)/);
 assert.match(entity,/Fecha opcional ISO YYYY-MM-DD/);
});
