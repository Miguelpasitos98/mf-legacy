import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {validatePalmaresBatch,matchPalmaresTrophy,previewPalmaresBatch,materializePalmaresEntries,palmaresImportPlan,PALMARES_FORMAT} from "../src/utils/trophyPalmaresImport.js";
import {groupTrophiesByTeamReputation} from "../src/utils/trophyTeamGroups.js";

const batch=JSON.parse(readFileSync(new URL("../research/fm24_palmares/real_madrid_screenshots_2026-11-03.json",import.meta.url),"utf8"));
const team={id:"6abfe24fa22b69c2bc1bccad",name:"Real Madrid CF",reputation:"8800"};
const catalog=[
 {id:"t-ucl",source_id:"1301394",name:"UEFA Champions League",identification_status:"Verified"},
 {id:"t-liga",source_id:"67",name:"LaLiga",identification_status:"Verified"},
 {id:"t-copa",source_id:"1301422",name:"Copa del Rey",identification_status:"Verified"},
 {id:"t-carr",source_id:"2000335178",name:"Trofeo Ramón de Carranza",identification_status:"Verified"},
 {id:"t-world",source_id:"121092",name:"Mundial de Clubes FIFA",identification_status:"Verified"},
 {id:"t-challenge",source_id:"2000335151",name:"World Football Challenge (2009-2011)",identification_status:"Verified"}
];
test("Real Madrid screenshot batch has 44 competitions and 332 year/placement records",()=>{
 assert.equal(batch.format,PALMARES_FORMAT);
 assert.deepEqual(validatePalmaresBatch(batch),{competitions:44,entries:332});
 assert.equal(batch.team.id,team.id);
 assert.equal(batch.source_files.length,3);
 assert.ok(batch.competitions.some(g=>g.raw_name==="Trofeo Ramón de Carranza"));
});
test("Historic alias for LaLiga links to existing source ID while Copa Intercontinental remains separate",()=>{
 assert.equal(matchPalmaresTrophy("LaLiga EA Sports",catalog).trophy.source_id,"67");
 assert.equal(matchPalmaresTrophy("UEFA Champions League",catalog).status,"auto_linked");
 assert.equal(matchPalmaresTrophy("Copa Intercontinental",catalog).status,"unmatched");
 assert.equal(matchPalmaresTrophy("Mundialito de clubes",catalog).status,"needs_review");
});
test("Year-range mismatches cannot auto-approve World Football Challenge 2012",()=>{
 const result=matchPalmaresTrophy("World Football Challenge",catalog,[2011,2012]);
 assert.equal(result.status,"needs_review");
 assert.match(result.reason,/fuera del rango/);
 assert.equal(result.trophy.source_id,"2000335151");
});
test("Capture conversion preserves third place, source text, and raw years rather than fabricating seasons",()=>{
 const preview=previewPalmaresBatch(batch,catalog,[team]);
 const all=materializePalmaresEntries(batch,preview.groups);
 assert.equal(all.length,332);
 assert.ok(all.every(x=>x.team_id===team.id&&!x.officially_verified));
 assert.equal(all.filter(x=>x.rank==="third"&&x.trophy_name_raw==="Trofeo Ramón de Carranza").length,4);
 assert.equal(all.filter(x=>x.rank==="runner_up"&&x.trophy_name_raw==="Trofeo Ramón de Carranza").length,4);
 assert.equal(all.filter(x=>x.rank==="winner"&&x.trophy_name_raw==="Trofeo Ramón de Carranza").length,6);
 assert.ok(all.some(x=>x.original_year_text.includes("como Madrid CF")));
 assert.ok(all.every(x=>/^\d{4}$/.test(x.edition_label)));
 assert.equal(all.find(x=>x.trophy_name_raw==="Copa Intercontinental").trophy_source_id,"");
});
test("Only unambiguous links write Trophy.source_id; user can manually select a pending one",()=>{
 const preview=previewPalmaresBatch(batch,catalog,[team]);
 const entries=materializePalmaresEntries(batch,preview.groups);
 const world=entries.filter(x=>x.trophy_name_raw==="Mundialito de clubes");
 assert.equal(world.length,5);
 assert.ok(world.every(x=>x.match_status==="needs_review"&&x.trophy_source_id===""));
 const selected=preview.groups.map(g=>g.raw_name==="Mundialito de clubes"?{...g,status:"manual_linked",trophy:catalog.find(t=>t.source_id==="121092"),confidence:100}:g);
 const after=materializePalmaresEntries(batch,selected);
 assert.equal(after.filter(x=>x.trophy_name_raw==="Mundialito de clubes"&&x.trophy_source_id==="121092").length,5);
 assert.ok(after.every(x=>!x.officially_verified));
});
test("Repeated JSON imports are idempotent; partial previous imports skip existing entries",()=>{
 const preview=previewPalmaresBatch(batch,catalog,[team]),entries=materializePalmaresEntries(batch,preview.groups);
 assert.deepEqual(palmaresImportPlan(entries,entries),{pending:[],skipped:332,total:332});
 const partial=palmaresImportPlan(entries,entries.slice(0,100));
 assert.equal(partial.pending.length,232);
 assert.equal(partial.skipped,100);
});
test("Unknown or contradictory screenshot values are rejected",()=>{
 const bad=structuredClone(batch);
 bad.competitions[0].placements[0].years.push(1998);
 assert.throws(()=>validatePalmaresBatch(bad),/repetido/);
 const invalid=structuredClone(batch);
 invalid.competitions[0].placements[0].years[0]=1700;
 assert.throws(()=>validatePalmaresBatch(invalid),/Año inválido/);
});
test("Club view deduplicates Champions years across both Rob finals and FM24, displays second/third separately",()=>{
 const preview=previewPalmaresBatch(batch,catalog,[team]),all=materializePalmaresEntries(batch,preview.groups);
 const editions=[{edition_key:"ucl_2013_14",champion_team_id:team.id,trophy_source_id:"1301394",season:"2013/14",edition_year:2014}];
 const groups=groupTrophiesByTeamReputation({teams:[team],catalog,editions,palmares:all});
 const madrid=groups[0];
 const ucl=madrid.items.find(x=>x.trophy.source_id==="1301394");
 assert.equal(ucl.historicalCount,14);
 const carr=madrid.items.find(x=>x.trophy.source_id==="2000335178");
 assert.deepEqual([carr.historicalCount,carr.runnerUpCount,carr.thirdCount],[6,4,4]);
 assert.equal(groups[0].verifiedCount,0);
});
test("UI exposes full JSON import and preview but never auto-creates TrophyHonour",()=>{
 const file=readFileSync(new URL("../src/components/trophies/TrophyPalmaresImportWorkbench.jsx",import.meta.url),"utf8");
 const page=readFileSync(new URL("../src/pages/Trophies.jsx",import.meta.url),"utf8");
 assert.match(page,/Palmarés FM24 · capturas/);
 assert.match(file,/Importar palmarés FM24 por equipo/);
 assert.match(file,/materializePalmaresEntries/);
 assert.match(file,/bulkCreate/);
 assert.match(file,/relinkSaved/);
 assert.doesNotMatch(file,/TrophyHonour\.(create|update|bulkCreate)/);
});
