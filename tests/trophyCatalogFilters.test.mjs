import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {countryTrophyIdsFromSections,verifiedTeamTrophyIds,filterCountryOptions} from "../src/utils/trophyCatalogFilters.js";
import {classifyTrophy} from "../src/utils/trophyGrouping.js";

const sections=[
 {kind:"country",key:"country:espana",items:[{source_id:"67"},{source_id:"1301422"}]},
 {kind:"country",key:"country:alemania",items:[{source_id:"22"}]},
 {kind:"world",key:"fifa",items:[{source_id:"121092"}]},
 {kind:"confederation",key:"confed:UEFA",items:[{source_id:"1301394"}]},
 {kind:"unclassified",key:"unclassified",items:[{source_id:"3"}]}
];
test("Regression: country filter never treats foreign league cups as Spanish",()=>{
 const cases=[
 [
  "Copa de la Liga Argentina",
  "Argentina"
 ],
 [
  "Copa de la Liga de Escocia",
  "Escocia"
 ],
 [
  "Copa de la Liga de Francia",
  "Francia"
 ],
 [
  "Copa de la Liga de Japón",
  "Japón"
 ],
 [
  "Copa de la Liga de Segunda Categoría de Gales",
  "Gales"
 ],
 [
  "Copa de la Liga Femenina de Inglaterra",
  "Inglaterra"
 ],
 [
  "Copa del Rey",
  "España"
 ],
 [
  "LaLiga",
  "España"
 ],
 [
  "LaLiga 2",
  "España"
 ],
 [
  "Supercopa de España",
  "España"
 ],
 [
  "La Liga Mayor",
  "Sin federación o país confirmado"
 ],
 [
  "Serie A de Ecuador",
  "Ecuador"
 ],
 [
  "Serie B de Ecuador",
  "Ecuador"
 ],
 [
  "Serie A",
  "Italia"
 ],
 [
  "Campeonato de Portugal Série A",
  "Portugal"
 ],
 [
  "Brasileirão Série C",
  "Brasil"
 ],
 [
  "3. Liga",
  "Alemania"
 ],
 [
  "3. Liga - grupa I",
  "Sin federación o país confirmado"
 ],
 [
  "Ligue 1 McDonald's",
  "Francia"
 ],
 [
  "Ligue 1 Orange Mali",
  "Malí"
 ],
 [
  "Ligue 1 StarTimes",
  "Sin federación o país confirmado"
 ],
 [
  "Algerian Ligue 2",
  "Argelia"
 ],
 [
  "Beninese Ligue 1",
  "Benín"
 ],
 [
  "Fijian FA Cup Tournament",
  "Fiyi"
 ],
 [
  "Singaporean Community Shield",
  "Singapur"
 ],
 [
  "Thai FA Cup",
  "Tailandia"
 ]
];
 for(const [name,country] of cases)assert.equal(classifyTrophy({name}).title,country,name);
});
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
test("Country search handles accents, substrings and unclassified/international categories",()=>{
 const options=[{value:"all",label:"Todos los países"},{value:"es",label:"España",count:12},
  {value:"mx",label:"México",count:19},{value:"sc",label:"Escocia",count:9},
  {value:"international",label:"Internacionales · FIFA y confederaciones"},
  {value:"unclassified",label:"Sin país confirmado"}];
 assert.deepEqual(filterCountryOptions(options,"espana").map(x=>x.value),["es"]);
 assert.deepEqual(filterCountryOptions(options,"MEXICO").map(x=>x.value),["mx"]);
 assert.deepEqual(filterCountryOptions(options,"esc").map(x=>x.value),["sc"]);
 assert.deepEqual(filterCountryOptions(options,"internac").map(x=>x.value),["international"]);
 assert.deepEqual(filterCountryOptions(options,"sin pais").map(x=>x.value),["unclassified"]);
 assert.equal(filterCountryOptions(options,"no-existe").length,0);
 assert.equal(filterCountryOptions(options,"").length,options.length);
});
test("The country picker is a searchable keyboard accessible combobox",()=>{
 const picker=readFileSync(new URL("../src/components/trophies/CountrySearchPicker.jsx",import.meta.url),"utf8");
 assert.match(picker,/role="combobox"/);
 assert.match(picker,/onChange=\{e=>type\(e.target.value\)\}/);
 assert.match(picker,/event.key==="Enter"/);
 assert.match(picker,/event.key==="ArrowDown"/);
 assert.match(picker,/event.key==="Escape"/);
 assert.match(picker,/filterCountryOptions\(options,search\)/);
});
test("Compact Trophies toolbar keeps search visible and offers expandable country/team filters and reset",()=>{
 const source=readFileSync(new URL("../src/pages/Trophies.jsx",import.meta.url),"utf8");
 assert.match(source,/Buscar trofeo, país o ID/);
 assert.match(source,/aria-expanded=\{showFilters\}/);
 assert.match(source,/showFilters&&<div id="trophy-advanced-filters"/);
 assert.match(source,/CountrySearchPicker/);
 assert.match(source,/TeamSearchPicker teams=\{rows\(teamsQuery.data\)\}/);
 assert.match(source,/countryTrophyIdsFromSections/);
 assert.match(source,/verifiedTeamTrophyIds/);
 assert.match(source,/setCountryFilter\("all"\);setTeamFilter\(""\)/);
 assert.match(source,/Sin país confirmado/);
});
