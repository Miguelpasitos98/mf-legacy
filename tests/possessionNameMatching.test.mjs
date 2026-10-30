import test from "node:test";
import assert from "node:assert/strict";
import {clubIdentityTokens,rankPossessionTeamCandidates,recommendPossessionTeam} from "../src/utils/possessionNameMatching.js";
import {suggestPossessionTeam,planPossessionAssociation,buildPossessionAudit} from "../src/utils/possessionAssociations.js";

const catalog=[
 {id:"monaco",name:"AS Monaco FC",fotmob_id:"9829"},
 {id:"city",name:"Manchester City FC"},
 {id:"united",name:"Manchester United"},
 {id:"barca",name:"FC Barcelona"},
 {id:"barcasc",name:"Barcelona SC"},
 {id:"monaco-b",name:"AS Monaco FC B"},
 {id:"nice",name:"OGC Nice"},
 {id:"marseille",name:"Olympique de Marseille"}
];
const group=(name,overrides={})=>({
 key:name.toLowerCase(),name,names:new Set([name]),fotmobIds:new Set(),
 linkedIds:new Set(),conflict:false,...overrides
});
test("Monaco se autovincula a AS Monaco FC con alta confianza, no a la filial",()=>{
 const matches=rankPossessionTeamCandidates(group("Monaco"),catalog);
 assert.equal(matches[0].team.id,"monaco");
 assert.equal(matches[0].confidence,"high");
 assert.equal(recommendPossessionTeam(group("Monaco"),catalog).team.id,"monaco");
 assert.equal(suggestPossessionTeam(group("Monaco"),catalog).id,"monaco");
 assert.equal(clubIdentityTokens("AS Monaco FC").normal,"monaco");
});
test("Reconoce siglas de clubes oficiales sin eliminar palabras distintivas",()=>{
 assert.equal(suggestPossessionTeam(group("Nice"),catalog).id,"nice");
 assert.equal(suggestPossessionTeam(group("Manchester City"),catalog).id,"city");
 assert.equal(suggestPossessionTeam(group("Manchester United"),catalog).id,"united");
 assert.equal(suggestPossessionTeam(group("FC Barcelona"),catalog).id,"barca");
});
test("Filiales y clubes diferentes no se vinculan por substrings",()=>{
 assert.equal(recommendPossessionTeam(group("AS Monaco FC B"),catalog).team.id,"monaco-b");
 assert.equal(recommendPossessionTeam(group("Barcelona SC"),catalog).team.id,"barcasc");
 assert.equal(rankPossessionTeamCandidates(group("Barcelona SC"),[catalog[3]]).length,0);
 assert.equal(rankPossessionTeamCandidates(group("Monaco B"),[catalog[0]]).length,0);
 assert.equal(rankPossessionTeamCandidates(group("Manchester City"),[catalog[2]]).length,0);
});
test("Una coincidencia parcial solo se propone para revisión manual",()=>{
 const match=recommendPossessionTeam(group("Marseille"),catalog);
 assert.equal(match?.team.id,"marseille");
 assert.equal(match?.confidence,"review");
 assert.equal(suggestPossessionTeam(group("Marseille"),catalog),null);
});
test("El empate entre clubes plausibles bloquea la autovinculación",()=>{
 const duplicate=[...catalog,{id:"monaco-2",name:"AS Monaco"}];
 assert.equal(recommendPossessionTeam(group("Monaco"),duplicate),null);
 assert.equal(suggestPossessionTeam(group("Monaco"),duplicate),null);
});
test("Un ID FotMob verificado tiene prioridad, pero uno contradictorio nunca se propone",()=>{
 const withId=group("Monaco",{fotmobIds:new Set(["9829"])});
 assert.equal(recommendPossessionTeam(withId,catalog).score,100);
 assert.equal(recommendPossessionTeam(group("Monaco",{fotmobIds:new Set(["99999"])}),catalog),null);
});
test("La tolerancia no permite sobrescribir posesiones de otra identidad",()=>{
 const rows=[
 {id:"one",team_id:"",team_name:"Monaco",season:"2023/2024",competition:"Ligue 1",team_possession_pct:54},
 {id:"two",team_id:"",team_name:"Monaco",season:"2024/2025",competition:"Ligue 1",team_possession_pct:55}
 ];
 const audit=buildPossessionAudit(rows,catalog);
 const matching=suggestPossessionTeam(audit.groups[0],catalog);
 assert.equal(matching.id,"monaco");
 const plan=planPossessionAssociation(rows,catalog,audit.groups[0].key,matching.id);
 assert.equal(plan.updates.length,2);
 assert.deepEqual(plan.conflicts,[]);
 const occupied=[...rows,{id:"other",team_id:"monaco",team_name:"AS Monaco FC",season:"2024/2025",competition:"Ligue 1",team_possession_pct:60}];
 assert.ok(planPossessionAssociation(occupied,catalog,"Monaco","monaco").conflicts.length);
});
