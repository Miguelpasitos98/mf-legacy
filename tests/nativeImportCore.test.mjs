import test from "node:test";
import assert from "node:assert/strict";
import {readMetrics,parseNumber,validateSeason} from "../base44/functions/import-native/core.js";
const snapshot={
 provider:"fotmob",fotmob_player_id:"795179",season:"2021/2022",
 competition:"Premier League",team_name:"Arsenal",fotmob_team_id:"9825",
 source_record_id:"5-0",statistics:{statsSection:{items:[
  {display:"stats-group",items:[
   {localizedTitleId:"clearances",title:"Total clearances",statValue:"96",per90:2.89},
   {localizedTitleId:"interceptions",title:"Interceptions",statValue:0,per90:0},
   {localizedTitleId:"tackles",title:"Tackles",statValue:"18"},
  ]}
 ]},topStatCard:{items:[{localizedTitleId:"clearances",title:"Clearances",statValue:"96"}]}}
};
test("FotMob historical stats: no duplicate Clearances and keep verified zero",()=>{
 const r=validateSeason(snapshot,"aaaaaaaaaaaaaaaaaaaaaaaa","795179");
 assert.equal(r.metrics.filter(x=>x.name==="Clearances").length,1);
 assert.equal(r.metrics.find(x=>x.name==="Clearances").value,96);
 assert.equal(r.metrics.find(x=>x.name==="Interceptions").value,0);
 assert.equal(r.warnings.length,0);
});
test("inconsistent repeated source labels are not silently merged",()=>{
 const changed=structuredClone(snapshot);
 changed.statistics.topStatCard.items[0].statValue="110";
 const r=validateSeason(changed,"aaaaaaaaaaaaaaaaaaaaaaaa","795179");
 assert.equal(r.metrics.some(x=>x.name==="Clearances"),false);
 assert.match(r.warnings.join(" " ),/contradicción/);
});
test("does not convert missing or invalid stats into zero",()=>{
 assert.equal(parseNumber(null),null);assert.equal(parseNumber(""),null);
 assert.equal(parseNumber("not available"),null);
 assert.equal(parseNumber("1,200"),null); // Locale-dependent thousands/decimal ambiguity
 assert.equal(parseNumber("1,25"),1.25);
 const m=readMetrics({statsSection:{items:[{localizedTitleId:"clearances",title:"Clearances",statValue:null},{localizedTitleId:"interceptions",title:"Interceptions",statValue:"0"}]}},"fotmob");
 assert.equal(m.metrics.length,1);
 assert.equal(m.metrics[0].value,0);
});
test("rejects player mismatch and seasons not sequential",()=>{
 assert.throws(()=>validateSeason(snapshot,"aaaaaaaaaaaaaaaaaaaaaaaa","276738"),/ID FotMob/);
 assert.throws(()=>validateSeason({...snapshot,season:"2021/2025"},"aaaaaaaaaaaaaaaaaaaaaaaa","795179"),/Temporada/);
});
test("absence of team id remains explicit, not guessed",()=>{
 const r=validateSeason({...snapshot,fotmob_team_id:""},"aaaaaaaaaaaaaaaaaaaaaaaa","795179");
 assert.equal(r.fotmob_team_id,"");
 assert.match(r.warnings.join(" " ),/Falta ID/);
});
test("does not read shotmap or market values as metrics",()=>{
 const r=readMetrics({statsSection:{items:[{localizedTitleId:"goals",statValue:"2"}]},
   shotmap:[{localizedTitleId:"xg",statValue:1200}],marketValues:{items:[{localizedTitleId:"market",statValue:200000}]}}, "fotmob");
 assert.equal(r.metrics.length,1);
});
