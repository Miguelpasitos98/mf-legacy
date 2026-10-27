import test from "node:test";
import assert from "node:assert/strict";
import {applyVerifiedHistoricals} from "../base44/functions/import-worker/reviewAuto.js";

function fixture({duplicateTeam=false,conflict=false}={}) {
 const pid="player-1",jid="job-1",saved=[],candidates=[];
 const provenance={provider:"understat_archive",player_id:"understat-1",
  archive_url:"https://example.org/archive.csv",sha256:"abcdef",scope:"league_team_season"};
 const base={job_id:jid,player_id:pid,fotmob_player_id:"921253",source:"understat",kind:"metric",
  season:"2023/2024",competition:"LaLiga",fotmob_team_id:"8634",team_name:"Barcelona",
  fotmob_tournament_id:"87",is_national_team:false,verification_status:"verified",
  review_status:"pending",evidence_url:"https://understat.com/player/12",provenance};
 candidates.push({...base,id:"one",metric_name:"xG Chain",metric_unit:"total",value:10});
 candidates.push({...base,id:"two",metric_name:"xG Chain",metric_unit:"per90",value:0.3});
 candidates.push({...base,id:"three",source:"fotmob",verification_status:"unverified",metric_name:"Goals",metric_unit:"total",value:5});
 const team={id:"team-b",name:"FC Barcelona",fotmob_id:null};
 const filter=(arr,q)=>arr.filter(x=>Object.entries(q||{}).every(([k,v])=>x[k]===v));
 const db={
  Player:{get:async()=>({id:pid,name:"Ronald Araujo",team_id:"team-liverpool"})},
  PlayerFotmobLink:{filter:async q=>q.player_id?[{player_id:pid,fotmob_player_id:"921253",verification:"manual"}]:[{player_id:pid,fotmob_player_id:"921253"}]},
  ImportCandidate:{filter:async(q,_s,limit=100,skip=0)=>filter(candidates,q).slice(skip,skip+limit),
   updateMany:async(query,patch)=>{for(const c of candidates){if(query.id.$in.includes(c.id))Object.assign(c,patch.$set);}},
   update:async(id,patch)=>Object.assign(candidates.find(x=>x.id===id),patch)},
  Team:{filter:async()=>duplicateTeam?[team,{...team,id:"team-2"}]:[team]},
  PlayerSeasonStats:{filter:async q=>filter(saved,q),create:async record=>{saved.push({...record,id:"new-row"});return {id:"new-row"};},
   update:async(id,patch)=>{Object.assign(saved.find(x=>x.id===id),patch)}},
  PlayerHistoricalValuation:{filter:async()=>[],create:async()=>{},update:async()=>{}}
 };
 if(conflict)saved.push({id:"old",player_id:pid,season:"2023/2024",competition:"LaLiga",
  fotmob_team_id:"8634",team_name:"Barcelona",fotmob_tournament_id:"87",
  metrics:[{name:"xG Chain",value:25,source:"manual"}]});
 return {db,saved,candidates,job:{id:jid,player_id:pid,fotmob_player_id:"921253",status:"review"}};
}
test("understat verified creates historical STATS only for unique historic team; leaves FotMob pending",async()=>{
 const f=fixture();
 const result=await applyVerifiedHistoricals(f.db,f.job);
 assert.equal(result.created_stats,1);
 assert.equal(result.applied,2);
 assert.equal(f.saved[0].team_id,"team-b");
 assert.equal(f.saved[0].metrics[0].value,10);
 assert.equal(f.saved[0].metrics[0].per90,0.3);
 assert.equal(f.candidates[2].review_status,"pending");
});
test("ambiguous historic teams never create a season",async()=>{
 const f=fixture({duplicateTeam:true});
 const result=await applyVerifiedHistoricals(f.db,f.job);
 assert.equal(result.created_stats,0);
 assert.equal(f.saved.length,0);
});
test("existing manual numbers are not overwritten",async()=>{
 const f=fixture({conflict:true});
 const result=await applyVerifiedHistoricals(f.db,f.job);
 assert.equal(result.applied,0);
 assert.equal(f.saved[0].metrics[0].value,25);
 assert.equal(f.candidates[0].review_status,"pending");
});
test("una discrepancia de minutos no bloquea entradas, goles y despejes de FotMob",async()=>{
 const f=fixture();
 const base={...f.candidates[2],season:"2024/2025",competition:"LaLiga",
   source_record_id:"2024/2025:87:8634:minutes:total",
   evidence_url:"https://www.fotmob.com/players/921253"};
 f.candidates.splice(0,f.candidates.length,
   {...base,id:"minutes",metric_name:"Minutes",metric_unit:"total",value:1028},
   {...base,id:"tackles",source_record_id:"2024/2025:87:8634:tackles:total",metric_name:"Tackles",value:22},
   {...base,id:"clearances",source_record_id:"2024/2025:87:8634:clearances:total",metric_name:"Clearances",value:48});
 f.saved.push({id:"historic",player_id:f.job.player_id,season:"2024/2025",competition:"LaLiga",
   fotmob_team_id:"8634",team_name:"Barcelona",fotmob_tournament_id:"87",
   minutes:1018,appearances:28,metrics:[{name:"Minutes",value:1018,unit:"total",source:"understat"}]});
 const result=await applyVerifiedHistoricals(f.db,f.job);
 assert.equal(result.applied,2);
 assert.equal(f.saved[0].minutes,1018);
 assert.equal(f.saved[0].metrics.find(m=>m.name==="Tackles")?.value,22);
 assert.equal(f.saved[0].metrics.find(m=>m.name==="Clearances")?.value,48);
 assert.equal(f.candidates[0].review_status,"pending");
 assert.equal(f.candidates[1].review_status,"applied");
});

test("Bordeaux histórico sin ficha TEAMS se registra con ID FotMob y equipo interno pendiente",async()=>{
 const f=fixture();
 const c={...f.candidates[2],season:"2018/2019",competition:"Ligue 1",
   team_name:"Bordeaux",fotmob_team_id:"9827",fotmob_tournament_id:"53",
   source_record_id:"2018/2019:53:9827:clearances:total",
   evidence_url:"https://www.fotmob.com/players/921253",metric_name:"Clearances",value:36};
 f.candidates.splice(0,f.candidates.length,c);
 const result=await applyVerifiedHistoricals(f.db,f.job);
 assert.equal(result.created_stats,1);
 assert.equal(result.applied,1);
 assert.equal(f.saved[0].fotmob_team_id,"9827");
 assert.equal(f.saved[0].team_name,"Bordeaux");
 assert.equal(f.saved[0].team_id,undefined);
 assert.equal(c.review_status,"applied");
});
test("ID FotMob del club ya perteneciente a otro equipo impide incorporación ambigua",async()=>{
 const f=fixture();
 const c={...f.candidates[2],season:"2018/2019",competition:"Ligue 1",
   team_name:"Bordeaux",fotmob_team_id:"9827",fotmob_tournament_id:"53",
   source_record_id:"2018/2019:53:9827:clearances:total",
   evidence_url:"https://www.fotmob.com/players/921253",metric_name:"Clearances",value:36};
 f.candidates.splice(0,f.candidates.length,c);
 f.db.Team.filter=async()=>[{id:"wrong",name:"Other Team",fotmob_id:"9827"}];
 const result=await applyVerifiedHistoricals(f.db,f.job);
 assert.equal(result.created_stats,0);
 assert.equal(c.review_status,"pending");
});
test("una competición EURO U21 no se atribuye automáticamente a Barcelona",async()=>{
 const f=fixture();
 const c={...f.candidates[2],season:"2025/2026",competition:"EURO U21",
   fotmob_tournament_id:"288",source_record_id:"2025/2026:288:8634:minutes:total",
   evidence_url:"https://www.fotmob.com/players/921253"};
 f.candidates.splice(0,f.candidates.length,c);
 const result=await applyVerifiedHistoricals(f.db,f.job);
 assert.equal(result.created_stats,0);
 assert.equal(c.review_status,"pending");
});

test("FotMob autoapplies a uniquely identified current-club season while preserving reviewed data",async()=>{
 const f=fixture();
 const c=f.candidates[2];
 Object.assign(c,{season:"2026/2027",competition:"Premier League",team_name:"Liverpool",
   fotmob_team_id:"8650",fotmob_tournament_id:"47",source_record_id:"2026/2027:47:8650:goals:total",
   evidence_url:"https://www.fotmob.com/players/921253"});
 const previous=f.db.Team.filter;
 f.db.Team.filter=async()=>[...(await previous()),{id:"team-liverpool",name:"Liverpool FC",fotmob_id:null}];
 const result=await applyVerifiedHistoricals(f.db,f.job);
 assert.equal(result.created_stats,2);
 assert.equal(f.saved.find(x=>x.season==="2026/2027")?.team_id,"team-liverpool");
 assert.equal(c.review_status,"applied");
});
