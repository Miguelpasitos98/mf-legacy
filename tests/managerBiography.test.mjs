import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {resolveManagerCountry,buildManagerBiographyPrompt,parseBiographyResponse} from "../src/components/managers/managerBiography.mjs";
import {cleanManager} from "../src/components/managers/managerModel.mjs";
const countries=[{id:"deu-id",name:"Germany",code:"DEU",flag:"https://example.org/germany.svg"},{id:"esp-id",name:"España",code:"ESP"},{id:"fra-id",name:"France",code:"FRA"}];
test("nationalities link to Country id, not a new free-text country",()=>{
 const match=resolveManagerCountry({nationality:"Alemania"},countries);
 assert.equal(match.id,"deu-id");
 assert.equal(resolveManagerCountry({nationality:"Germany"},countries).id,"deu-id");
 assert.equal(resolveManagerCountry({country_id:"esp-id",nationality:"Germany"},countries).id,"esp-id");
 const row=cleanManager({name:"Jürgen Klopp",country_id:match.id,nationality:match.name,manager_kind:"real"});
 assert.equal(row.country_id,"deu-id");
 assert.equal(row.nationality,"Germany");
});
test("AI biography prompt uses name and Country and requires source-aware research",()=>{
 const prompt=buildManagerBiographyPrompt("Jürgen Klopp","Germany");
 assert.match(prompt,/Jürgen Klopp/);
 assert.match(prompt,/Germany/);
 assert.match(prompt,/NO inventes/);
 assert.match(prompt,/cargos ejecutivos/);
 assert.throws(()=>buildManagerBiographyPrompt(""),/nombre/);
 assert.equal(parseBiographyResponse({response:"Una biografía suficientemente extensa para la ficha de un entrenador histórico."}).startsWith("Una"),true);
 assert.throws(()=>parseBiographyResponse(""),/no devolvió/);
});
test("Manager entity schema contains canonical Country foreign key",()=>{
 const schema=JSON.parse(fs.readFileSync("base44/entities/Manager.jsonc","utf8"));
 assert.equal(schema.properties.country_id.type,"string");
});
test("Managers form offers name-driven AI drafting and countries selection",()=>{
 const page=fs.readFileSync("src/pages/Managers.jsx","utf8");
 assert.match(page,/base44\.entities\.Country/);
 assert.match(page,/base44\.functions\.invoke\("manager-ai"/);
 assert.match(page,/Copiar prompt para ChatGPT/);
 assert.match(page,/ManagerNationalityPicker/);
 const picker=fs.readFileSync("src/components/managers/ManagerNationalityPicker.jsx","utf8");
 assert.match(picker,/País de nacionalidad/);
 assert.match(page,/Selecciona la nacionalidad desde Countries/);
});
