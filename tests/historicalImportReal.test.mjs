import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildHistoricalObservations} from "../src/utils/historicalPeers.js";
import {WEIGHTS_BY_ROLE} from "../src/utils/compositeEngine.js";
import {metricsValue} from "../src/utils/statsViews.js";
const real=JSON.parse(readFileSync(new URL("./fixtures/historical-import-real.json",import.meta.url)));
const observations=buildHistoricalObservations(real);
const player=name=>real.players.find(p=>p.name===name);
const season=(name,year)=>observations.find(o=>o.playerId===player(name).id&&o.season===year);
const league=(name,year,comp)=>real.stats.find(r=>r.player_id===player(name).id&&r.season===year&&r.competition===comp);

test("real De Bruyne 2017/18 has all 15 available CAM indicators without inventing xGOT",()=>{
  const s=season("Kevin De Bruyne","2017/2018");
  const expected=[...Object.keys(WEIGHTS_BY_ROLE.CAM),"rating"].filter(k=>s.values[k]!=null);
  assert.ok(expected.length>=15,expected.join(","));
  assert.equal(s.values.xgot_p90,null);
  assert.ok(Math.abs(s.values.xa_p90-0.3800047163815843)<1e-10);
  assert.ok(Math.abs(s.values.npxg_p90-0.1566727805277618)<1e-10);
  assert.ok(Math.abs(s.values.successful_dribbles_p90-63*90/3083)<1e-10);
});
test("real De Bruyne 2019/20 retains native 13 goals and the distinct Understat 14",()=>{
  const row=league("Kevin De Bruyne","2019/2020","Premier League");
  assert.equal(metricsValue(row,"goals"),13);
  assert.equal(row.metrics.find(m=>m.name==="Understat Goals").value,14);
  assert.ok(Math.abs(season("Kevin De Bruyne","2019/2020").values.xa_p90-0.6585749326507786)<1e-10);
});
test("real Messi 2014/15 and Neymar 2015/16 recover totals from named Understat fallback",()=>{
  assert.equal(metricsValue(league("Lionel Messi","2014/2015","LaLiga"),"goals"),43);
  assert.equal(metricsValue(league("Neymar","2015/2016","LaLiga"),"assists"),12);
  assert.ok(season("Lionel Messi","2014/2015").values.xa_p90>0);
  assert.ok(season("Neymar","2015/2016").values.npxg_p90>0);
});
test("real Valverde seasons keep all five/four competitions and use their independent denominators",()=>{
  assert.equal(season("Federico Valverde","2023/2024").competitions,5);
  assert.equal(season("Federico Valverde","2025/2026").competitions,4);
  assert.equal(metricsValue(league("Federico Valverde","2023/2024","LaLiga"),"goals"),2);
  assert.equal(metricsValue(league("Federico Valverde","2025/2026","LaLiga"),"assists"),8);
});
test("real centre-back and goalkeeper retain their own archetypes and source indicators",()=>{
  const cb=season("Antonio Rüdiger","2023/2024"),gk=season("Thibaut Courtois","2025/2026");
  assert.equal(cb.role,"CB");assert.equal(gk.role,"GK");
  assert.ok(cb.values.aerial_duels_won_pct>0);
  assert.ok(gk.values.save_pct>0);
});
test("real Coutinho transfer keeps Barcelona and Liverpool, then weights the season",()=>{
  const s=season("Philippe Coutinho","2017/2018");
  const rows=real.stats.filter(r=>r.player_id===player("Philippe Coutinho").id);
  assert.equal(s.competitions,2);
  assert.deepEqual(new Set(rows.map(r=>r.team_name)),new Set(["Barcelona","Liverpool"]));
  assert.ok(Math.abs(s.values.xa_p90-(3.9710645526647568+4.951584819704294)*90/(1311+1132))<1e-10);
});
