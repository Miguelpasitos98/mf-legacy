import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {normalizeCountryLookup,findManagerNationality} from "../src/components/managers/managerNationalitySearch.mjs";
import {resolveManagerCountry,buildManagerBiographyPrompt} from "../src/components/managers/managerBiography.mjs";
import {cleanManager} from "../src/components/managers/managerModel.mjs";

const countries=[
 {id:"es",name:"España",code:"ESP",flag:"https://example.org/es.png"},
 {id:"de",name:"Alemania",code:"DEU",flag:"https://example.org/de.png"},
 {id:"ci",name:"Côte d’Ivoire",code:"CIV",flag:"https://example.org/ci.png"},
 {id:"it",name:"Italia",code:"ITA",flag:"https://example.org/it.png"}
];
test("find nationality in one lookup with accent, case, partial name and country code",()=>{
 assert.equal(normalizeCountryLookup("  ESPAÑA "), "espana");
 assert.deepEqual(findManagerNationality(countries,"espa").map(c=>c.id),["es"]);
 assert.deepEqual(findManagerNationality(countries,"DEU").map(c=>c.id),["de"]);
 assert.deepEqual(findManagerNationality(countries,"CÔTE").map(c=>c.id),["ci"]);
 assert.deepEqual(findManagerNationality(countries,"italia").map(c=>c.id),["it"]);
});
test("only Countries records returned, retains original IDs and flags without mutation",()=>{
 const frozen=Object.freeze([...countries]);
 const found=findManagerNationality(frozen,"",30);
 assert.equal(found.length,4);
 assert.equal(found.find(c=>c.id==="es").flag,countries[0].flag);
 assert.strictEqual(found.find(c=>c.id==="es"),countries[0]);
 assert.deepEqual(findManagerNationality(frozen,"xyz"),[]);
 assert.deepEqual(findManagerNationality(null,""),[]);
 assert.equal(findManagerNationality(frozen,"",2).length,2);
});
test("selecting nationality still resolves and persists the Country ID used by the biography",()=>{
 const country=resolveManagerCountry({country_id:"it",nationality:"Italia"},countries);
 assert.equal(country.id,"it");
 const updated=cleanManager({name:"Entrenador de prueba",country_id:country.id,nationality:country.name},"mgr");
 assert.equal(updated.country_id,"it");
 assert.equal(updated.nationality,"Italia");
 assert.match(buildManagerBiographyPrompt("Entrenador de prueba",country.name),/Italia/);
});
test("Managers removes banner and independent country input and mounts accessible compact picker",()=>{
 const source=fs.readFileSync("src/pages/Managers.jsx","utf8");
 const picker=fs.readFileSync("src/components/managers/ManagerNationalityPicker.jsx","utf8");
 assert.doesNotMatch(source,/Base de datos de entrenadores/);
 assert.doesNotMatch(source,/countrySearch/);
 assert.match(source,/<ManagerNationalityPicker countries=\{countries\} country=\{chosenCountry\} onChange=\{changeCountry\}/);
 assert.match(source,/\(\{managers.length\}\)/);
 assert.match(picker,/aria-label="País de nacionalidad"/);
 assert.match(picker,/aria-label="Buscar nacionalidad"/);
 assert.match(picker,/onSelect=\{\(\)=>choose\(String\(item.id\)\)\}/);
 assert.match(picker,/shouldFilter=\{false\}/);
});
