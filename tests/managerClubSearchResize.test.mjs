import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {searchCustomClubs} from "../src/components/managers/customClubSearch.mjs";

const code=fs.readFileSync("src/components/managers/CustomClubSearch.jsx","utf8");

test("planner club selector avoids resize observers, cmdk, and floating-ui positioning",()=>{
 assert.doesNotMatch(code,/ResizeObserver|CommandPrimitive|@radix-ui\/react-popover|@floating-ui|<Popover|<CommandList|useSize/);
 assert.match(code,/absolute left-0 top-full z-50/);
 assert.match(code,/w-full min-w-0 overflow-hidden/);
 assert.match(code,/max-h-\[280px\] overflow-y-auto/);
});
test("club picker remains keyboard- and pointer-operable with a stable DOM listbox",()=>{
 assert.match(code,/role="combobox"/);
 assert.match(code,/role="listbox"/);
 assert.match(code,/role="option"/);
 assert.match(code,/aria-expanded=\{open&&!disabled\}/);
 assert.match(code,/aria-activedescendant=/);
 assert.match(code,/event\.key==="ArrowDown"/);
 assert.match(code,/event\.key==="ArrowUp"/);
 assert.match(code,/event\.key==="Enter"/);
 assert.match(code,/event\.key==="Escape"/);
 assert.match(code,/document\.addEventListener\("pointerdown",handleOutside\)/);
 assert.match(code,/document\.removeEventListener\("pointerdown",handleOutside\)/);
 assert.match(code,/onClick=\{\(\)=>choose\(team\.id\)\}/);
});
test("name and abbreviation search remain accent-insensitive and do not invent teams",()=>{
 const entries=[
  {id:"1",name:"Atlético de Madrid",short_name:"ATM",logo:"https://example.com/1.png"},
  {id:"2",name:"AFC Wimbledon",short_name:"WIM",logo:"https://example.com/2.png"},
  {id:"3",name:"FC Sevilla",short_name:"SEV",logo:"https://example.com/3.png"}
 ];
 assert.deepEqual(searchCustomClubs(entries,"atletico").map(r=>r.id),["1"]);
 assert.deepEqual(searchCustomClubs(entries,"wim").map(r=>r.id),["2"]);
 assert.deepEqual(searchCustomClubs(entries,"sev").map(r=>r.id),["3"]);
 assert.deepEqual(searchCustomClubs(entries,"zzz"),[]);
 assert.match(code,/normalizeImageUrl\(team\?\.logo/);
 assert.match(code,/role="option"/);
});
test("club selection preserves parent-owned team state, with no writes",()=>{
 const parent=fs.readFileSync("src/pages/ManagerSquadPlanner.jsx","utf8");
 assert.match(parent,/<CustomClubSearch teams=\{customTeams\} selectedId=\{teamId\}/);
 assert.match(parent,/onSelect=\{id=>setParams\(\{team:id,season\}\)\}/);
 assert.doesNotMatch(code,/base44\.entities|\.create\(|\.update\(/);
});
