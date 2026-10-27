import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source=readFileSync(new URL("../base44/functions/import-review/entry.js",import.meta.url),"utf8")
  .replace('import {createClientFromRequest} from "npm:@base44/sdk";',"const createClientFromRequest=()=>globalThis.__reviewClient;");
const {default:review,metricPlan,seasonPlan}=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));
const pid="bbbbbbbbbbbbbbbbbbbbbbbb",jid="aaaaaaaaaaaaaaaaaaaaaaaa",cid="cccccccccccccccccccccccc";
const item={id:cid,job_id:jid,player_id:pid,fotmob_player_id:"309328",kind:"metric",source:"fotmob",
  season:"2024/2025",competition:"Ligue 1",fotmob_team_id:"9847",team_name:"Paris Saint-Germain",
  fotmob_tournament_id:"53",is_national_team:false,metric_name:"Goals",metric_unit:"total",value:0,
  verification_status:"verified",review_status:"pending",evidence_url:"https://www.fotmob.com/players/309328"};
const player={id:pid,name:"Milan Škriniar"};
test("first import builds a compatible STATS record for the existing player",()=>{
  const plan=metricPlan(item,player,[]);
  assert.equal(plan.operation,"create");
  assert.equal(plan.record.player_id,pid);
  assert.equal(plan.record.external_record_id,"fotmob:309328:9847:2024-2025:ligue-1");
  assert.equal(plan.record.metrics[0].value,0);
  const schema=JSON.parse(readFileSync(new URL("../base44/entities/PlayerSeasonStats.jsonc",import.meta.url)));
  for(const required of schema.required)assert.ok(plan.record[required]);
});
test("same candidate across jobs reuses a different preexisting record key",()=>{
  const old={...metricPlan(item,player,[]).record,id:"row",external_record_id:"studio-previous-import"};
  assert.equal(metricPlan({...item,job_id:"new-job"},player,[old]).operation,"unchanged");
});
test("fill only an empty per90 slot; preserve manual values and metadata",()=>{
  const old={...metricPlan(item,player,[]).record,id:"row",manual_metric_history:[{changed_at:"yesterday"}],
    metrics:[{name:"Goals",value:0,source:"manual",verification_status:"manual"}]};
  const plan=metricPlan({...item,metric_unit:"per90",value:0},player,[old]);
  assert.equal(plan.operation,"update");
  assert.deepEqual(plan.record.metrics,[{name:"Goals",value:0,per90:0,source:"manual",verification_status:"manual"}]);
  assert.equal(old.metrics[0].per90,undefined);
  assert.deepEqual(Object.keys(plan.record),["metrics"]);
  assert.throws(()=>metricPlan({...item,value:2},player,[old]),/No se sobrescribe/);
});
test("summary Matches/Minutes/Rating populate native STATS columns",()=>{
  for(const [name,field,value] of [["Matches","appearances",5],["Minutes","minutes",381],["Rating","rating",7.1]]) {
    const plan=metricPlan({...item,metric_name:name,value},player,[]);
    assert.equal(plan.record[field],value);
    assert.throws(()=>metricPlan({...item,metric_name:name,value},player,[{...plan.record,id:"row",[field]:99}]),/resumen distinto/);
  }
});
test("ambiguous duplicate rows and conflicting IDs cannot be applied",()=>{
  const old={...metricPlan(item,player,[]).record,id:"row"};
  assert.throws(()=>metricPlan(item,player,[old,{...old,id:"other"}]),/varias filas/);
  assert.throws(()=>metricPlan(item,player,[{...old,fotmob_team_id:"8695"}]),/ID de equipo/);
  assert.throws(()=>metricPlan(item,player,[{...old,fotmob_tournament_id:"99"}]),/Homónimas|homónimas/);
  assert.throws(()=>metricPlan(item,player,[{...old,fotmob_team_id:"",team_name:"Unresolved translated name"}]),/equipo sin ID/);
});
test("per90, percentages and per-match keep distinct representations",()=>{
  assert.equal(metricPlan({...item,metric_unit:"per90",value:1.5},player,[]).record.metrics[0].per90,1.5);
  const percent=metricPlan({...item,metric_name:"Pass accuracy",metric_unit:"percentage",value:89.4},player,[]).record.metrics[0];
  assert.deepEqual(percent,{name:"Pass accuracy",value:89.4,unit:"percentage",source:"fotmob",verification_status:"verified"});
  assert.equal(metricPlan({...item,metric_unit:"per_match",value:1.2},player,[]).record.metrics[0].per_match,1.2);
});
test("duel counts and percentages do not collapse to the same metric",()=>{
  const first=metricPlan({...item,metric_name:"Duels won",value:30},player,[]).record;
  const second=metricPlan({...item,metric_name:"Duels won %",metric_unit:"percentage",value:61.2},player,[{...first,id:"row"}]);
  assert.equal(second.record.metrics.length,2);
  assert.equal(second.record.metrics[0].value,30);
  assert.equal(second.record.metrics[1].value,61.2);
});
test("negative goals prevented and separate percentiles are retained",()=>{
  const c={...item,metric_name:"Goals prevented",value:-.39,percentile:24};
  const first=metricPlan(c,player,[]).record;
  assert.equal(first.metrics[0].value,-.39);assert.equal(first.metrics[0].percentile,24);
  const next=metricPlan({...c,metric_unit:"per90",value:-.13,percentile:31},player,[{...first,id:"row"}]);
  assert.equal(next.record.metrics[0].per90,-.13);assert.equal(next.record.metrics[0].percentile_per90,31);
  assert.throws(()=>metricPlan({...c,metric_name:"Goals"},player,[]),/Valor no válido/);
});
test("national rows link NationalTeam without a club team_id",()=>{
  const plan=metricPlan({...item,is_national_team:true,fotmob_team_id:"8497",team_name:"Slovakia",competition:"EURO",fotmob_tournament_id:"50"},player,[],{national_team_id:"national",national_country_id:"country"});
  assert.equal(plan.record.national_team_id,"national");assert.equal(plan.record.team_id,undefined);
});

function setup(verified=true) {
  const candidates=new Map([[cid,{...item,verification_status:verified?"verified":"unverified"}]]),stats=[];
  let creates=0;let linked=true;
  const links=()=>linked?[{player_id:pid,fotmob_player_id:"309328",verification:"manual"}]:[];
  const db={
    Player:{async get(){return player;},async create(){throw Error("Must never create a player");}},
    PlayerFotmobLink:{async filter(){return links();}},
    ImportJob:{async get(){return {id:jid,player_id:pid,fotmob_player_id:"309328",status:"review"};},async update(){}},
    ImportCandidate:{async get(id){return candidates.get(id);},async update(id,p){Object.assign(candidates.get(id),p);},async updateMany(q,data){for(const c of candidates.values())if(q.id.$in.includes(c.id)&&c.review_status===q.review_status)Object.assign(c,data.$set);},async filter(){return [...candidates.values()];}},
    PlayerSeasonStats:{async filter(q,sort,limit,skip=0){return stats.slice(skip,skip+limit);},async create(row){stats.push({...row,id:"row"});creates++;},async update(id,patch){Object.assign(stats.find(x=>x.id===id),patch);}},
    Team:{async filter(){return [{id:"psg",fotmob_id:"9847"}];}},NationalTeam:{async filter(){return [];}}
  };
  globalThis.__reviewClient={auth:{async me(){return {role:"admin"};}},asServiceRole:{entities:db}};
  return {stats,candidates,get creates(){return creates;},unlink(){linked=false;}};
}
async function post(action,extra={}){const r=await review(new Request("https://test/review",{method:"POST",body:JSON.stringify({action,candidate_id:cid,...extra})}));return {status:r.status,body:await r.json()};}
test("review preview is read-only and approval requires verification",async()=>{
  const ctx=setup(false);
  assert.equal((await post("preview")).body.plan.operation,"create");assert.equal(ctx.stats.length,0);
  assert.equal((await post("approve")).status,409);assert.equal(ctx.creates,0);
  assert.equal((await post("verify")).status,200);
  assert.equal((await post("approve")).status,200);assert.equal(ctx.stats.length,1);
  assert.equal((await post("approve")).body.unchanged,true);assert.equal(ctx.creates,1);
});
test("approval rechecks the FotMob link before any mutation",async()=>{
  const ctx=setup();ctx.unlink();assert.equal((await post("approve")).status,409);assert.equal(ctx.creates,0);
});
test("whole season is built before writing and a late conflict prevents any plan",()=>{
  const group=[item,{...item,metric_name:"Minutes",value:381},{...item,metric_name:"Duels won %",metric_unit:"percentage",value:50}];
  const plan=seasonPlan(group,player,[]);
  assert.equal(plan.operation,"create");assert.equal(plan.record.minutes,381);assert.equal(plan.record.metrics.length,3);
  const old={...plan.record,id:"row"};
  assert.equal(seasonPlan(group,player,[old]).operation,"unchanged");
  assert.throws(()=>seasonPlan([...group,{...item,metric_name:"Minutes",value:400}],player,[old]),/No se sobrescribe/);
});
test("full-season preview, verification and approval create exactly one row",async()=>{
  const ctx=setup(false);
  const id2="dddddddddddddddddddddddd";
  ctx.candidates.set(id2,{...item,id:id2,verification_status:"unverified",metric_name:"Minutes",value:381});
  assert.equal((await post("preview-season")).body.plan.record.minutes,381);
  assert.equal(ctx.creates,0);assert.equal((await post("approve-season")).status,409);
  assert.equal((await post("verify-season")).status,200);
  assert.equal((await post("approve-season",{confirm_source_reviewed:true})).status,200);
  assert.equal(ctx.creates,1);assert.equal(ctx.stats[0].metrics.length,2);
});
