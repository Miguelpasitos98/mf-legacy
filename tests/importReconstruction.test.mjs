import test from "node:test";
import assert from "node:assert/strict";
import {compatibleSeasonPlan,completionPatch,applyVerifiedHistoricals,persistImportPlan} from "../base44/shared/importReview.js";
import {buildHistoricalObservations} from "../src/utils/historicalPeers.js";
import {metricMinutes} from "../src/utils/metricSources.js";
const player={id:"p",name:"Player"};
const base={player_id:"p",fotmob_player_id:"169200",season:"2017/2018",competition:"Premier League",fotmob_team_id:"8456",team_name:"Manchester City",fotmob_tournament_id:"47",is_national_team:false,source:"fotmob",metric_name:"Goals",metric_unit:"total",value:8};
const row={...base,id:"s",minutes:3000,metrics:[{name:"Goals",value:8,source:"manual"}]};

test("70 compatible values survive one conflicting metric; repeat is idempotent",()=>{
  const items=[{...base,id:"conflict",value:9},...Array.from({length:70},(_,i)=>({...base,id:String(i),metric_name:"Metric "+i,value:i}))];
  const frozen=JSON.stringify(row),plan=compatibleSeasonPlan(items,player,[row]);
  assert.equal(plan.candidates,70);assert.equal(plan.added_values,70);assert.equal(plan.conflicts.length,1);
  assert.equal(JSON.stringify(row),frozen);
  const second=compatibleSeasonPlan(items,player,[{...row,...plan.record}]);
  assert.equal(second.operation,"unchanged");assert.equal(second.added_values,0);assert.equal(second.unchanged_values,70);
});
test("contradictory source candidates are all withheld, regardless of ordering",()=>{
  const items=[{...base,id:"a",value:9},{...base,id:"b",value:10},{...base,id:"c",metric_name:"Assists",value:16}];
  for(const group of [items,items.toReversed()]){
    const plan=compatibleSeasonPlan(group,player,[]);
    assert.equal(plan.candidates,1);assert.equal(plan.conflicts.length,2);
    assert.equal(plan.record.metrics[0].name,"Assists");
  }
});
test("two historical clubs never collapse into one destination",()=>{
  assert.throws(()=>compatibleSeasonPlan([base,{...base,fotmob_team_id:"9827"}],player,[]),/mezcla/);
  const a=compatibleSeasonPlan([{...base,id:"a"}],player,[]);
  const b=compatibleSeasonPlan([{...base,id:"b",fotmob_team_id:"9827",team_name:"Bordeaux"}],player,[{...a.record,id:"a"}]);
  assert.equal(b.operation,"create");assert.notEqual(a.record.external_record_id,b.record.external_record_id);
});
test("provider clocks include nested provenance and preserve negative goalkeeper rates",()=>{
  const metric={name:"Understat xA",value:12,source:"understat",provenance:{provider_minutes:2700}};
  assert.equal(metricMinutes({minutes:3000},metric),2700);
  const players=[{id:"p",position:"CAM"},{id:"g",position:"GK"}];
  const stats=[{...row,appearances:30,metrics:[metric,{name:"Shots on target",per90:1.2,source:"fotmob"}]},
    {...row,id:"g",player_id:"g",metrics:[{name:"Goals prevented",per90:-0.15,source:"fotmob"},{name:"Save percentage",value:72}]}];
  const obs=buildHistoricalObservations({players,stats});
  assert.equal(obs.find(o=>o.playerId==="p").values.xa_p90,0.4);
  assert.equal(obs.find(o=>o.playerId==="p").values.shots_on_target_p90,1.2);
  assert.equal(obs.find(o=>o.playerId==="g").values.goals_prevented_p90,-0.15);
});
test("a manual metric remains preferred over native and provider fallback entries",()=>{
  const obs=buildHistoricalObservations({players:[{id:"p",position:"CAM"}],stats:[{...row,metrics:[{name:"xA",value:10,source:"manual"},{name:"Understat xA",value:50,source:"understat",provider_minutes:2000}]}]})[0];
  assert.equal(obs.values.xa_p90,0.3);
});
test("an empty extraction block cannot report success with outstanding source scopes",()=>{
  assert.equal(completionPatch({source_results:{fotmob:{status:"partial",coverage:{complete:false}}}},0).status,"review");
  assert.equal(completionPatch({source_results:{fotmob:{status:"complete"}}},2).status,"review");
  assert.equal(completionPatch({source_results:{fotmob:{status:"complete"}}},0).status,"completed");
});
test("persistence rechecks the result; lost or concurrently changed writes are not acknowledged",async()=>{
  const entity={updateMany:async()=>{},get:async()=>({...row,updated_date:"new"})};
  await assert.rejects(()=>persistImportPlan(entity,{operation:"update",target_id:"s",record:{minutes:2900}},{...row,updated_date:"old"}),/escritura/);
});
test("simulation cannot call sporting mutations even for a newly imported player",async()=>{
  const candidate={...base,id:"c",job_id:"j",kind:"metric",review_status:"pending",verification_status:"unverified",evidence_url:"https://www.fotmob.com/players/169200",source_record_id:"2017/2018:47:8456:goals:total"};
  const db={Player:{get:async()=>player},PlayerFotmobLink:{filter:async()=>[{player_id:"p",fotmob_player_id:"169200",verification:"manual"}]},
    ImportCandidate:{filter:async()=>[candidate]},PlayerSeasonStats:{filter:async()=>[],create:async()=>assert.fail("simulation writes")},Team:{filter:async()=>[]},PlayerHistoricalValuation:{filter:async()=>[]}};
  const report=await applyVerifiedHistoricals(db,{id:"j",player_id:"p",fotmob_player_id:"169200",status:"review"},{dryRun:true});
  assert.equal(report.created_stats,1);assert.equal(report.applied,1);assert.equal(candidate.review_status,"pending");
});
