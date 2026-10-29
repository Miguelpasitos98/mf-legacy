import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {filterTrophyTeams} from "../src/utils/trophyTeamSearch.js";

const teams=[
 {id:"1",name:"FC Barcelona",short_name:"BAR",country:"España",city:"Barcelona"},
 {id:"2",name:"Real Madrid CF",short_name:"RMA",country:"España",city:"Madrid"},
 {id:"3",name:"Atlético de Madrid",short_name:"ATM",country:"España",city:"Madrid"},
 {id:"4",name:"Bayern München",short_name:"FCB",country:"Alemania",city:"München"},
 {id:"5",name:"Paris Saint-Germain",short_name:"PSG",country:"Francia",city:"París"}
];
test("Trophies team search matches aliases, city and accent-insensitive club names",()=>{
 assert.deepEqual(filterTrophyTeams(teams,"bar").map(t=>t.id),["1"]);
 assert.equal(filterTrophyTeams(teams,"RMA")[0].id,"2"); // exact abbreviation before other substring matches
 assert.deepEqual(filterTrophyTeams(teams,"atletico").map(t=>t.id),["3"]);
 assert.deepEqual(filterTrophyTeams(teams,"munchen").map(t=>t.id),["4"]);
 assert.deepEqual(filterTrophyTeams(teams,"PARIS").map(t=>t.id),["5"]);
 assert.deepEqual(filterTrophyTeams(teams,"Francia").map(t=>t.id),["5"]);
});
test("Search matches every Team, not just the first visible options",()=>{
 const large=Array.from({length:1000},(_,n)=>({id:String(n),name:"Equipo "+String(n).padStart(4,"0")}));
 assert.equal(filterTrophyTeams(large,"equipo 0999")[0].id,"999");
 assert.equal(filterTrophyTeams(large,"").length,1000);
 assert.deepEqual(filterTrophyTeams(large,"nothing"),[]);
 assert.deepEqual(filterTrophyTeams(large,"Equipo 0").slice(0,3).map(t=>t.id),["0","1","2"]);
});
test("Invalid Team records are not rendered as selectable entities",()=>{
 const result=filterTrophyTeams([...teams,{name:"No id"},{id:"missing"}],"");
 assert.equal(result.length,teams.length);
});
test("Searchable picker uses real Team IDs and keyboard selection",()=>{
 const component=readFileSync(new URL("../src/components/trophies/TeamSearchPicker.jsx",import.meta.url),"utf8");
 const workbench=readFileSync(new URL("../src/components/trophies/TrophySyncWorkbench.jsx",import.meta.url),"utf8");
 assert.match(component,/role="combobox"/);
 assert.match(component,/role="listbox"/);
 assert.match(component,/event\.key==="ArrowDown"/);
 assert.match(component,/event\.key==="Enter"/);
 assert.match(component,/event\.key==="Escape"/);
 assert.match(component,/onChange\?\.\(String\(team\.id\)\)/);
 assert.match(workbench,/<TeamSearchPicker teams=\{teams\} value=\{teamId\}/);
 assert.match(workbench,/setGeneratedPrompt/);
 assert.doesNotMatch(workbench,/Selecciona un equipo<\/option>/);
});
