import test from "node:test";
import assert from "node:assert/strict";
import {parseTrophyResearch,previewTrophyHonours,trophyResearchPrompt,previewPlayerTrophyCredits,canonicalTrophyCompetition} from "../src/utils/trophySync.js";

const teams=[{id:"b1",name:"FC Barcelona"},{id:"m1",name:"Manchester City"}];
const catalog=[{source_id:"1301394",name:"UEFA Champions League",trophy_type:""},{source_id:"100",name:"LaLiga",trophy_type:"Team Trophy"},{source_id:"200",name:"Balón de Oro",trophy_type:"Individual Trophy"}];
const row={trophy_source_id:"1301394",trophy_name:"UEFA Champions League",team_id:"b1",season:"2024/2025",verified:true,source_url:"https://www.uefa.com/official"};
test("Research prompt includes exact internal Team ID, official evidence and schema",()=>{
 const p=trophyResearchPrompt(teams[0],{from:"2018/2019",to:"2024/2025"});
 assert.match(p,/b1/);
 assert.match(p,/fuente oficial/i);
 assert.match(p,/mf_legacy_trophy_honours_v1/);
 assert.match(p,/2018\/2019/);
});
test("Import parses only the expected schema with finite batch length",()=>{
 assert.deepEqual(parseTrophyResearch(JSON.stringify({format:"mf_legacy_trophy_honours_v1",honours:[row]})),[row]);
 assert.throws(()=>parseTrophyResearch('{"honours":[]}'),/Formato incorrecto/);
 assert.throws(()=>parseTrophyResearch(JSON.stringify({format:"mf_legacy_trophy_honours_v1",honours:Array(251).fill(row)})),/250/);
});
test("Champion matching respects trophy ID and team ID, and refuses dupes or awards",()=>{
 const history=[{trophy_source_id:"1301394",season:"2023/2024",recipient_id:"m1",recipient_type:"Team"}];
 const result=previewTrophyHonours([row,{...row}, {...row,team_id:"missing"},{...row,trophy_source_id:"200"}, {...row,source_url:""}],{catalog,teams,honours:history});
 assert.deepEqual(result.map(x=>x.status),["new","duplicate","review","review","duplicate"]);
 assert.equal(result[0].trophy.source_id,"1301394");
 assert.equal(result[0].team.id,"b1");
 const other=previewTrophyHonours([{...row,season:"2023/2024",team_id:"m1"}],{catalog,teams,honours:history});
 assert.equal(other[0].status,"existing");
});
test("Names only match when unique and exact; missing sources remain pending",()=>{
 const result=previewTrophyHonours([{...row,trophy_source_id:"",trophy_name:"  Uefa Champions League "}],{catalog,teams});
 assert.equal(result[0].status,"new");
 const ambiguous=previewTrophyHonours([{...row,trophy_source_id:"",trophy_name:"LaLiga"}],{catalog:[...catalog,{source_id:"101",name:"LaLiga"}],teams});
 assert.equal(ambiguous[0].status,"review");
 const noProof=previewTrophyHonours([{...row,source_url:""}],{catalog,teams});
 assert.equal(noProof[0].status,"review");
});
test("Stats sync only proposes same team + season + competition + appearances; never auto-confirms",()=>{
 const honour={id:"h1",recipient_type:"Team",recipient_id:"b1",season:"2024/2025",verified:true};
 const players=[{id:"p1",name:"Jugador A"},{id:"p2",name:"Jugador B"},{id:"p3",name:"Jugador C"}];
 const stats=[
  {player_id:"p1",team_id:"b1",season:"2024/2025",competition:"Champions League",appearances:8},
  {player_id:"p1",team_id:"b1",season:"2024/2025",competition:"LaLiga",appearances:34},
  {player_id:"p2",team_id:"b1",season:"2024/2025",competition:"LaLiga",appearances:4},
  {player_id:"p3",team_id:"m1",season:"2024/2025",competition:"Champions League",appearances:11}
 ];
 const found=previewPlayerTrophyCredits(honour,{stats,players,trophy:catalog[0]});
 assert.equal(found.length,2);
 assert.equal(found[0].player_id,"p1");
 assert.equal(found[0].matches,8);
 assert.equal(found[0].status,"candidate");
 assert.equal(found[0].verified,false);
 assert.equal(found[1].status,"review");
 assert.deepEqual(previewPlayerTrophyCredits({...honour,verified:false},{stats,players,trophy:catalog[0]}),[]);
});
test("Competition aliases include FIFA/UEFA names without treating all tournaments as equivalent",()=>{
 assert.equal(canonicalTrophyCompetition("UEFA Champions League"),canonicalTrophyCompetition("Champions League"));
 assert.notEqual(canonicalTrophyCompetition("Europa League"),canonicalTrophyCompetition("UEFA Champions League"));
});

test("A verified career stage only appears as a review lead, never a confirmed trophy",()=>{
 const honour={id:"h1",recipient_type:"Team",recipient_id:"b1",season:"2024/2025",verified:true};
 const players=[{id:"p2",name:"Jugador B"}];
 const careers=[
  {player_id:"p2",team_id:"b1",start_date:"2023-07",end_date:"2025-06",review_status:"approved",is_reserve:false},
  {player_id:"p2",team_id:"b1",start_date:"2023-07",end_date:"2025-06",review_status:"pending",is_reserve:false}
 ];
 const lead=previewPlayerTrophyCredits(honour,{stats:[],players,careers,trophy:catalog[0]});
 assert.equal(lead.length,1);
 assert.equal(lead[0].status,"review");
 assert.equal(lead[0].fromCareer,true);
 assert.equal(lead[0].verified,false);
 const none=previewPlayerTrophyCredits(honour,{stats:[],players,careers:[careers[1]],trophy:catalog[0]});
 assert.deepEqual(none,[]);
});
