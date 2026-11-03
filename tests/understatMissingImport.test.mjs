import test from "node:test";
import assert from "node:assert/strict";
import {readArchive} from "../base44/functions/understat-auto/core.mjs";
import {planHistoricalMissing,missingMetrics,archiveMetrics,externalArchiveId} from "../base44/functions/understat-auto/missingPlan.mjs";
const names="id,player_name,season,team_title,league,time,xGChain,xGBuildup,goals,assists,xG,xA,npxG,shots,key_passes,npg,yellow_cards,red_cards,games";
const lines=[
 "44,Example Player,2016/17,Arsenal,EPL,2400,21,12,15,7,18,6,14,105,50,13,2,0,30",
 "44,Example Player,2017/18,Arsenal,EPL,2600,24,15,18,9,19,8,15,100,45,16,3,0,35",
 "44,Example Player,2018/19,Arsenal,EPL,2300,19,13,14,5,17,7,13,95,37,12,1,0,29",
 "44,Example Player,2025/26,Arsenal,EPL,300,2,1,2,1,2,1,1,10,3,2,0,0,4"
];
const dataset=readArchive([names,...lines].join("\n"),"Example Player");
const known=[
 {id:"a",player_id:"user",season:"2016/2017",team_name:"Arsenal",competition:"Premier League",metrics:[{name:"Goals",value:16,source:"fotmob"}]},
 {id:"b",player_id:"user",season:"2017/2018",team_name:"Arsenal",competition:"Premier League",metrics:[{name:"xG",value:19,source:"fotmob"},{name:"xGOT",value:25,source:"fotmob"}]}
];
test("verified historical identity creates absent season but never current partial season",()=>{
 const p=planHistoricalMissing(dataset,known);
 assert.equal(p.status,"verified");
 assert.equal(p.understat_id,"44");
 assert.equal(p.proposals.find(x=>x.season==="2018/2019").action,"create");
 assert.ok(p.skipped.find(x=>x.season==="2025/2026"));
 assert.equal(p.proposals.find(x=>x.season==="2017/2018").action,"complete");
});
test("existing goals, xG and xGOT are never replaced, including value 0",()=>{
 const p=planHistoricalMissing(dataset,known);
 const a=p.proposals.find(x=>x.season==="2016/2017");
 assert.equal(a.additions.find(m=>m.name==="Understat Goals"),undefined);
 const b=p.proposals.find(x=>x.season==="2017/2018");
 assert.equal(b.additions.find(m=>m.name==="Understat xG"),undefined);
 assert.equal(b.additions.find(m=>m.name==="xGOT"),undefined);
 assert.equal(missingMetrics([{name:"xG",value:0}],[{name:"Understat xG",value:1}]).length,0);
});
test("missing entire history requires explicit identity confirmation",()=>{
 const p=planHistoricalMissing(dataset,[]);
 assert.equal(p.status,"needs_identity_confirmation");
 assert.equal(p.proposals.length,0);
 const confirmation=planHistoricalMissing(dataset,[],{understat_id:"44",confirm_identity:true});
 assert.equal(confirmation.status,"manually_confirmed");
 assert.ok(confirmation.proposals.some(x=>x.action==="create"));
});
test("duplicates and same-league different clubs are not silently created",()=>{
 const duplicate=readArchive([names,...lines,lines[2]].join("\n"),"Example Player");
 const result=planHistoricalMissing(duplicate,known);
 assert.equal(result.proposals.find(p=>p.season==="2018/2019"),undefined);
 assert.ok(result.skipped.some(x=>x.reason.includes("repetidas")));
 const conflicted=[...known,{id:"x",season:"2018/2019",team_name:"Tottenham",competition:"Premier League"}];
 assert.equal(planHistoricalMissing(dataset,conflicted).proposals.find(p=>p.season==="2018/2019"),undefined);
});
test("all real metrics of the archived CSV are available with native Understat denominators",()=>{
 const row=dataset.get("44")[0],metrics=archiveMetrics(row,"44");
 for(const name of ["Understat Goals","Understat Assists","Understat xG","Understat xA","Understat npxG","Understat Shots",
 "Understat Key passes","Understat Non-penalty goals","Understat Yellow cards","Understat Red cards",
 "Understat Matches","xG Chain","xG Buildup","Understat minutes"])
  assert.ok(metrics.some(m=>m.name===name),name);
 assert.equal(metrics.find(m=>m.name==="Understat Key passes").per90,50*90/2400);
 assert.equal(metrics.find(m=>m.name==="xG Chain").value,21);
 assert.ok(externalArchiveId("44",{season:"2016/2017",league_key:"epl",team:"Arsenal"}).startsWith("understat:44:"));
});
test("source-only created row is not itself independent confirmation of identity",()=>{
 const one=known.slice(0,1);
 const sourceOnly={id:"understat-new",season:"2017/2018",team_name:"Arsenal",competition:"Premier League",
  external_record_id:"understat:44:2017-2018:epl:arsenal",source:"understat"};
 const p=planHistoricalMissing(dataset,[...one,sourceOnly]);
 assert.equal(p.status,"needs_identity_confirmation");
});
