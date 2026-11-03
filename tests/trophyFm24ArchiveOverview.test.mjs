import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fm24PalmaresOverview} from "../src/utils/trophyFm24Overview.js";

const teams=[{id:"real",name:"Real Madrid CF",reputation:"8800",short_name:"RMA"},{id:"barca",name:"FC Barcelona",reputation:"9100"}];
const catalog=[{source_id:"ucl",name:"UEFA Champions League"},{source_id:"carr",name:"Trofeo Ramón de Carranza"}];
const entries=[
 {entry_key:"1",team_id:"real",team_name:"Real Madrid CF",trophy_source_id:"ucl",rank:"winner",calendar_year:2014,match_status:"manual_linked"},
 {entry_key:"2",team_id:"real",team_name:"Real Madrid CF",trophy_source_id:"ucl",rank:"runner_up",calendar_year:1981,match_status:"auto_linked"},
 {entry_key:"3",team_id:"real",team_name:"Real Madrid CF",trophy_source_id:"carr",rank:"winner",calendar_year:1966,match_status:"auto_linked",source_note:"Friendly hosted in Cádiz"},
 {entry_key:"4",team_id:"real",team_name:"Real Madrid CF",trophy_source_id:"carr",rank:"third",calendar_year:1964,match_status:"manual_linked"},
 {entry_key:"5",team_id:"real",team_name:"Real Madrid CF",trophy_source_id:"",rank:"winner",calendar_year:2001,match_status:"needs_review"},
 {entry_key:"6",team_id:"real",team_name:"Real Madrid CF",trophy_source_id:"ucl",rank:"winner",calendar_year:2002,match_status:"ignored"},
 {entry_key:"7",team_id:"barca",team_name:"FC Barcelona",trophy_source_id:"ucl",rank:"winner",calendar_year:2015,match_status:"auto_linked"},
 {entry_key:"7",team_id:"barca",team_name:"FC Barcelona",trophy_source_id:"ucl",rank:"winner",calendar_year:2015,match_status:"auto_linked"}
];
test("FM24 palmares shows winner, runner-up and third in separate counters and preserves all linked teams",()=>{
 const result=fm24PalmaresOverview(entries,catalog,teams);
 assert.deepEqual(result.totals,{teams:2,competitions:3,winner:3,runner_up:1,third:1});
 assert.deepEqual(result.source,{entries:7,linked:5,pending:1,ignored:1});
 assert.equal(result.teams[0].team.name,"FC Barcelona");
 const madrid=result.teams.find(g=>g.team_id==="real");
 const carranza=madrid.competitions.find(c=>c.source_id==="carr");
 assert.deepEqual(carranza.winner,[1966]);
 assert.deepEqual(carranza.third,[1964]);
 assert.equal(carranza.description,"Friendly hosted in Cádiz");
});
test("Filters by club, trophy, year and rank without creating artificial titles",()=>{
 assert.equal(fm24PalmaresOverview(entries,catalog,teams,{query:"carranza"}).totals.winner,1);
 assert.equal(fm24PalmaresOverview(entries,catalog,teams,{query:"RMA"}).totals.teams,1);
 assert.equal(fm24PalmaresOverview(entries,catalog,teams,{rank:"runner_up"}).totals.runner_up,1);
 assert.equal(fm24PalmaresOverview(entries,catalog,teams,{rank:"runner_up"}).totals.winner,0);
 assert.equal(fm24PalmaresOverview(entries,catalog,teams,{season:"1964"}).totals.third,1);
});
test("Palmares top-level source control reads FM24 independently from verified TrophyHonour",()=>{
 const overview=readFileSync(new URL("../src/components/trophies/TrophyArchiveOverview.jsx",import.meta.url),"utf8");
 const archive=readFileSync(new URL("../src/components/trophies/TrophyFm24PalmaresArchive.jsx",import.meta.url),"utf8");
 assert.match(overview,/Palmarés histórico FM24/);
 assert.match(overview,/Palmarés verificado/);
 assert.match(archive,/base44\.entities\.TrophyPalmaresEntry/);
 assert.match(archive,/fm24PalmaresOverview/);
 assert.doesNotMatch(archive,/TrophyHonour\.(create|update|bulkCreate)/);
});
