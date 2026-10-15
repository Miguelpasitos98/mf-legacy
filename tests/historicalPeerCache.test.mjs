import test from "node:test";
import assert from "node:assert/strict";
import {createHistoricalPeerDataset,patchedHistoricalPeerDataset,patchHistoricalPeerCache,HISTORICAL_PEER_KEY} from "../src/utils/historicalPeerCache.js";
import {compareHistoricalObservation} from "../src/utils/historicalPeers.js";
const stats=(id,player_id,season,value)=>({
  id,player_id,season,competition:"Premier League",team_id:"club",minutes:900,appearances:10,
  rating:7,metrics:[{name:"xA",value}]
});
const records={
 Player:[{id:"h",name:"Haaland",position:"DC"},{id:"k",name:"Kane",position:"DC"}],
 PlayerSeasonStats:[stats("s1","h","2021/2022",5),stats("s2","k","2021/2022",3)],
 PlayerHistoricalValuation:[
  {id:"v1",player_id:"h",season:"2021/2022",fifa_fc_overall:88},
  {id:"v2",player_id:"k",season:"2021/2022",fifa_fc_overall:90},
 ],
 TeamSeasonMatches:[{id:"t1",team_id:"club",season:"2021/2022",competition:"Premier League",team_matches:38}]
};
test("A one-season edit recalculates the selected observation and ALL peer percentiles locally",()=>{
 const old=createHistoricalPeerDataset(records,"2026-10-15");
 const before=compareHistoricalObservation(old.observations.find(x=>x.playerId==="h"),old.observations);
 assert.equal(before.rows.find(x=>x.key==="xa_p90").percentile,100);
 const updated=patchedHistoricalPeerDataset(old,"PlayerSeasonStats","s1",{metrics:[{name:"xA",value:1}]});
 const h=updated.observations.find(x=>x.playerId==="h");
 const after=compareHistoricalObservation(h,updated.observations);
 assert.equal(after.rows.find(x=>x.key==="xa_p90").percentile,0);
 assert.equal(after.rows.find(x=>x.key==="xa_p90").nPlayers,2);
 assert.equal(old.observations.find(x=>x.playerId==="h").values.xa_p90,.5);
 assert.equal(updated.loadedCounts.PlayerSeasonStats,2);
 assert.equal(updated.loadedCounts.Player,2);
 assert.notEqual(old.records.PlayerSeasonStats,updated.records.PlayerSeasonStats);
 assert.equal(old.records.PlayerSeasonStats[0].metrics[0].value,5);
});
test("FC historical position and Overall changes are reflected without reloading players and seasons",()=>{
 const old=createHistoricalPeerDataset(records);
 const revised=patchedHistoricalPeerDataset(old,"PlayerHistoricalValuation","v1",{fifa_fc_position:"CAM",fifa_fc_overall:84});
 const h=revised.observations.find(x=>x.playerId==="h");
 assert.equal(h.role,"CAM");assert.equal(h.values.fc27_ovr,84);
 assert.equal(old.observations.find(x=>x.playerId==="h").role,"ST");
 assert.equal(old.records.PlayerHistoricalValuation[0].fifa_fc_overall,88);
});
test("Global Play Share changes when cached PJ Equipo changes, without changing original",()=>{
 const old=createHistoricalPeerDataset(records);
 const updated=patchedHistoricalPeerDataset(old,"TeamSeasonMatches","t1",{team_matches:20});
 assert.ok(updated.observations[0].values.play_share>old.observations[0].values.play_share);
 assert.equal(old.records.TeamSeasonMatches[0].team_matches,38);
});
test("Unknown IDs, unavailable cache or unrecognized entities never create phantom comparison data",()=>{
 const old=createHistoricalPeerDataset(records);
 assert.equal(patchedHistoricalPeerDataset(old,"PlayerSeasonStats","missing",{minutes:10000}),old);
 assert.equal(patchedHistoricalPeerDataset(old,"OtherEntity","s1",{minutes:10000}),old);
 assert.equal(patchedHistoricalPeerDataset(null,"PlayerSeasonStats","s1",{minutes:10000}),null);
 const fake={value:old,getQueryData(){return this.value;},setQueryData(key,callback){
   assert.deepEqual(key,HISTORICAL_PEER_KEY);
   this.value=callback(this.value);
 }};
 assert.equal(patchHistoricalPeerCache(fake,"PlayerSeasonStats","s2",{rating:9}),true);
 assert.equal(fake.value.records.PlayerSeasonStats[1].rating,9);
 assert.equal(patchHistoricalPeerCache(fake,"PlayerSeasonStats","none",{rating:9}),false);
});
test("Local change does not trigger any Base44 read or network call",()=>{
 const old=createHistoricalPeerDataset(records);
 let networkQueries=0;
 const client={setQueryData(key,fn){fn(old);},getQueryData(){networkQueries++;throw Error("Forbidden");}};
 patchHistoricalPeerCache(client,"PlayerSeasonStats","s1",{minutes:1200});
 assert.equal(networkQueries,0);
});
