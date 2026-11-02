import test from "node:test";
import assert from "node:assert/strict";
import {searchCustomClubs,normalizeClubSearch} from "../src/components/managers/customClubSearch.mjs";
const clubs=[
 {id:"1",name:"Atlético Dragón",short_name:"ADR",logo:"https://example.org/adr.png"},
 {id:"2",name:"Phoenix SF",short_name:"PHO",logo:"https://example.org/pho.png"},
 {id:"3",name:"Santa Catalina CF",short_name:"SNC",logo:"https://example.org/snc.png"},
 {id:"4",name:"Beeks FC",short_name:"BEK",logo:"https://example.org/bek.png"},
];
test("search ignores accents and case and matches partial words",()=>{
 assert.equal(normalizeClubSearch("  ÁTLEtICO  "),"atletico");
 assert.deepEqual(searchCustomClubs(clubs,"dragon").map(c=>c.id),["1"]);
 assert.deepEqual(searchCustomClubs(clubs,"SANTA cat").map(c=>c.id),["3"]);
 assert.deepEqual(searchCustomClubs(clubs,"pho").map(c=>c.id),["2"]);
 assert.deepEqual(searchCustomClubs(clubs,"BEK").map(c=>c.id),["4"]);
});
test("retains logo and real team ID without mutating or creating data",()=>{
 const frozen=Object.freeze([...clubs]);
 const result=searchCustomClubs(frozen,"atletico");
 assert.equal(result[0].logo,clubs[0].logo);
 assert.equal(result[0].id,"1");
 assert.equal(frozen[0],clubs[0]);
 assert.deepEqual(clubs.map(c=>c.id),["1","2","3","4"]);
});
test("empty search is alphabetic; no results and limits handled",()=>{
 assert.deepEqual(searchCustomClubs(clubs,"").map(c=>c.name),["Atlético Dragón","Beeks FC","Phoenix SF","Santa Catalina CF"]);
 assert.deepEqual(searchCustomClubs(clubs,"lo imposible"),[]);
 assert.equal(searchCustomClubs(clubs,"",2).length,2);
 assert.deepEqual(searchCustomClubs(null,""),[]);
});
