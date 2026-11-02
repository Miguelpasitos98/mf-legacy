import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {countryTrophyIdsFromSections,verifiedTeamTrophyIds} from "../src/utils/trophyCatalogFilters.js";
import {classifyTrophy} from "../src/utils/trophyGrouping.js";

const sections=[
 {kind:"country",key:"country:espana",items:[{source_id:"67"},{source_id:"1301422"}]},
 {kind:"country",key:"country:alemania",items:[{source_id:"22"}]},
 {kind:"world",key:"fifa",items:[{source_id:"121092"}]},
 {kind:"confederation",key:"confed:UEFA",items:[{source_id:"1301394"}]},
 {kind:"unclassified",key:"unclassified",items:[{source_id:"3"}]}
];
test("Country classification handles explicit new names, while continental and unknown trophies remain separate",()=>{
 assert.equal(classifyTrophy({name:"Copa de Turquía"}).title,"Turquía");
 assert.equal(classifyTrophy({name:"Brazilian U20 Bahia State Championship"}).title,"Brasil");
 assert.equal(classifyTrophy({name:"Supercopa de Croacia"}).title,"Croacia");
 assert.equal(classifyTrophy({name:"UEFA Champions League"}).kind,"confederation");
 assert.equal(classifyTrophy({name:"Trofeo sin identificar · 3"}).kind,"unclassified");
});
test("Country filtering is by competition group, not the nationality of its winning club",()=>{
 assert.equal(countryTrophyIdsFromSections(sections,"all"),null);
 assert.deepEqual([...countryTrophyIdsFromSections(sections,"country:espana")],["67","1301422"]);
 assert.deepEqual([...countryTrophyIdsFromSections(sections,"international")],["121092","1301394"]);
 assert.deepEqual([...countryTrophyIdsFromSections(sections,"unclassified")],["3"]);
 assert.equal(countryTrophyIdsFromSections(sections,"country:desconocido").size,0);
});
test("Team filtering requires exact verified champion ID and never imports individual/player or pending trophies",()=>{
 const honours=[
  {recipient_type:"Team",verified:true,recipient_id:"barca",trophy_source_id:"67"},
  {recipient_type:"Team",verified:true,recipient_id:"barca",trophy_source_id:"67"},
  {recipient_type:"Team",verified:false,recipient_id:"barca",trophy_source_id:"22"},
  {recipient_type:"Team",verified:true,recipient_id:"real",trophy_source_id:"1301394"},
  {recipient_type:"Player",verified:true,recipient_id:"barca",trophy_source_id:"111"}
 ];
 assert.deepEqual([...verifiedTeamTrophyIds(honours,"barca")],["67"]);
 assert.deepEqual([...verifiedTeamTrophyIds(honours,"real")],["1301394"]);
 assert.deepEqual([...verifiedTeamTrophyIds(honours,"unknown")],[]);
 assert.deepEqual([...verifiedTeamTrophyIds(honours,"")],[]);
});
test("Trophies UI exposes both filters, an unclassified option and a full reset",()=>{
 const source=readFileSync(new URL("../src/pages/Trophies.jsx",import.meta.url),"utf8");
 assert.match(source,/País de la competición/);
 assert.match(source,/TeamSearchPicker teams=\{rows\(teamsQuery.data\)\}/);
 assert.match(source,/countryTrophyIdsFromSections/);
 assert.match(source,/verifiedTeamTrophyIds/);
 assert.match(source,/setCountryFilter\("all"\);setTeamFilter\(""\)/);
 assert.match(source,/Sin país confirmado/);
});
