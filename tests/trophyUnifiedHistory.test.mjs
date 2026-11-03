import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {honourEndYear,historicalFinalYear,unifiedTrophyClubHistory} from "../src/utils/trophyUnifiedHistory.js";

const teams=[
 {id:"madrid",name:"Real Madrid CF",logo:"https://example.test/rma.png"},
 {id:"barca",name:"FC Barcelona",logo:"https://example.test/fcb.png"}
];
const honours=[
 {id:"honour-a",recipient_type:"Team",recipient_id:"madrid",recipient_name:"Real Madrid CF",season:"2021/2022",verified:true,source_url:"https://www.uefa.com/a"},
 {id:"honour-b",recipient_type:"Team",recipient_id:"barca",recipient_name:"FC Barcelona",season:"2023/2024",verified:true},
 {id:"honour-unverified",recipient_type:"Team",recipient_id:"madrid",recipient_name:"Real Madrid CF",season:"2023/2024",verified:false},
 {id:"individual",recipient_type:"Player",recipient_id:"player1",season:"2021/2022",verified:true}
];
const palmares=[
 {entry_key:"real-ucl-2022",team_id:"madrid",team_name:"Real Madrid CF",rank:"winner",calendar_year:2022,match_status:"auto_linked"},
 {entry_key:"real-ucl-2018",team_id:"madrid",team_name:"Real Madrid CF",rank:"winner",calendar_year:2018,match_status:"auto_linked"},
 {entry_key:"real-ucl-1981",team_id:"madrid",team_name:"Real Madrid CF",rank:"runner_up",calendar_year:1981,match_status:"manual_linked"},
 {entry_key:"real-ucl-2014",team_id:"madrid",team_name:"Real Madrid CF",rank:"third",calendar_year:2014,match_status:"auto_linked"},
 {entry_key:"bad-madrid",team_id:"madrid",rank:"winner",calendar_year:1999,match_status:"needs_review"}
];
const editions=[
 {edition_key:"ucl-2021-22",champion_team_id:"madrid",champion_name:"Real Madrid CF",runner_up_team_id:"",season:"2021/22",edition_year:2022},
 {edition_key:"ucl-2017-18",champion_team_id:"madrid",champion_name:"Real Madrid CF",season:"2017/18"},
 {edition_key:"ucl-2020-21",champion_team_id:"",champion_name:"Chelsea",season:"2020/21"}
];
test("Season to year normalization uses season end with 1900/2000 and no invented invalid years",()=>{
 assert.equal(honourEndYear("2021/22"),2022);
 assert.equal(honourEndYear("2021/2022"),2022);
 assert.equal(honourEndYear("1999/00"),2000);
 assert.equal(honourEndYear("2025/26"),2026);
 assert.equal(honourEndYear("2020/22"),null);
 assert.equal(honourEndYear("missing"),null);
 assert.equal(historicalFinalYear(editions[0]),2022);
});
test("A verified year merged with FM24 and Rob is ONE champion year with multiple source labels",()=>{
 const result=unifiedTrophyClubHistory({honours,palmares,editions,teams});
 const madrid=result.clubs.find(c=>c.team_id==="madrid");
 assert.deepEqual(madrid.winner.map(x=>x.year),[2022,2018]);
 const year=madrid.winner.find(x=>x.year===2022);
 assert.equal(year.verified,true);
 assert.deepEqual(year.sources.sort(),["fm24","official","rob_final"]);
 assert.deepEqual(year.verifiedSeasons,["2021/2022"]);
 assert.equal(madrid.verifiedWins,1);
 assert.equal(madrid.provisionalWins,1);
 assert.equal(result.totals.winner,3);
 assert.equal(result.totals.verified,2);
});
test("Runners-up and third places remain distinct, pending and individual awards never count",()=>{
 const result=unifiedTrophyClubHistory({honours,palmares,editions,teams});
 const madrid=result.clubs.find(c=>c.team_id==="madrid");
 assert.deepEqual(madrid.runner_up.map(r=>r.year),[1981]);
 assert.deepEqual(madrid.third.map(r=>r.year),[2014]);
 assert.equal(madrid.records.some(r=>r.year===1999),false);
 assert.equal(madrid.records.some(r=>r.year===2024),false);
});
test("Trophy detail uses the same unified component for Resume, Editions, Clubs; no duplicated official rankings",()=>{
 const page=readFileSync(new URL("../src/components/trophies/TrophyDetailVisual.jsx",import.meta.url),"utf8");
 const widget=readFileSync(new URL("../src/components/trophies/TrophyUnifiedClubHistory.jsx",import.meta.url),"utf8");
 assert.equal((page.match(/TrophyUnifiedClubHistory honours=\{honours\}/g)||[]).length,3);
 assert.doesNotMatch(page,/historicalSummary\.ranking\.map/);
 assert.doesNotMatch(page,/TrophyPalmaresByClub entries=/);
 assert.match(widget,/Campeonatos/);
 assert.match(widget,/Subcampeonatos/);
 assert.match(widget,/Terceros puestos/);
 assert.match(widget,/Contrastados/);
 assert.match(widget,/Archivo/);
 assert.match(widget,/YearBadge/);
});
