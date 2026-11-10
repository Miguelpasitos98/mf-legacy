import test from "node:test";
import assert from "node:assert/strict";
import {careerPositionFitIndex,historicalObservationMetrics} from "../src/components/managers/managerCareerPositionFit.mjs";

const profile={player_role_priorities:JSON.stringify({GK:"Sweeper-keeper"})};
const obs=(playerId,season,role="GK",minutes=1800)=>({playerId,season,role,minutes,positionMixed:false});
const stats=(player_id,season,passing,longPassing)=>({
 player_id,season,competition:"LaLiga",minutes:1800,
 metrics:[{name:"Accurate passes",per90:passing,value:passing*20},{name:"Accurate long balls",per90:longPassing,value:longPassing*20}]
});
const reference=()=>{
 const observations=Array.from({length:12},(_,i)=>obs("peer"+i,"2022/2023"));
 const rows=Array.from({length:12},(_,i)=>stats("peer"+i,"2022/2023",24+i,3+i/2));
 return {observations,rows};
};
test("historical position mode blends best season and career with independent peers",()=>{
 const {observations,rows}=reference();
 observations.push(obs("target","2022/2023"),obs("target","2023/2024"));
 rows.push(stats("target","2022/2023",51,13),stats("target","2023/2024",15,1));
 const dataset={observations,records:{PlayerSeasonStats:rows,UnderstatSeasonRate:[]}};
 const players=observations.map(x=>({id:x.playerId}));
 const result=careerPositionFitIndex({dataset,players,role:"GK",profile}).get("target");
 assert.ok(result,"expected score with 12 independent historical comparison players");
 assert.equal(result.bestSeason,"2022/2023");
 assert.equal(result.seasonCount,2);
 assert.ok(result.bestScore>result.careerScore);
 assert.equal(result.score,Math.round(.7*result.bestScore+.3*result.careerScore));
});
test("different historical positions and cameos cannot inflate a career",()=>{
 const {observations,rows}=reference();
 observations.push(obs("target","2022/2023"),obs("target","2023/2024","CB"),obs("target","2024/2025","GK",100));
 rows.push(stats("target","2022/2023",48,12),stats("target","2023/2024",99,99),stats("target","2024/2025",99,99));
 const dataset={observations,records:{PlayerSeasonStats:rows}};
 const result=careerPositionFitIndex({dataset,players:observations.map(x=>({id:x.playerId})),role:"GK",profile}).get("target");
 assert.ok(result);
 assert.equal(result.seasonCount,1);
 assert.equal(result.careerScore,null);
 assert.equal(result.score,result.bestScore);
});

test("STATS composite observations feed Manager Fit without raw metric duplicates",()=>{
 const {observations}=reference();
 for(let i=0;i<observations.length;i++)observations[i].values={accurate_passes_p90:20+i,accurate_long_balls_p90:3+i*.2};
 observations.push({...obs("target","2022/2023"),values:{accurate_passes_p90:49,accurate_long_balls_p90:11}});
 const dataset={observations,records:{PlayerSeasonStats:[],UnderstatSeasonRate:[]}};
 const result=careerPositionFitIndex({dataset,players:observations.map(o=>({id:o.playerId})),role:"GK",profile}).get("target");
 assert.ok(result&&result.score>=0,"must score existing historical STATS data");
 assert.equal(result.bestSeason,"2022/2023");
 assert.equal(result.coverage,100);
 assert.equal(historicalObservationMetrics(observations.at(-1)).passing.value,49);
});
test("DM searches include historically classified CM campaigns",()=>{
 const observations=Array.from({length:12},(_,i)=>({...obs("peer"+i,"2022/2023","CM"),values:{accurate_passes_p90:25+i,accurate_long_balls_p90:3+i*.3,xg_buildup_p90:.4+i*.01}}));
 observations.push({...obs("target","2022/2023","CM"),values:{accurate_passes_p90:42,accurate_long_balls_p90:9,xg_buildup_p90:.8}});
 const manager={player_role_priorities:JSON.stringify({DM:"Pivote organizador"})};
 const dataset={observations,records:{PlayerSeasonStats:[]}};
 const result=careerPositionFitIndex({dataset,players:observations.map(o=>({id:o.playerId})),role:"DM",profile:manager}).get("target");
 assert.ok(result&&result.score!==null);
});

test("an unmeasurable coach description falls back to observed position evidence, not fabricated tactical fit",()=>{
 const {observations}=reference();
 for(let i=0;i<observations.length;i++)observations[i].values={accurate_passes_p90:20+i,accurate_long_balls_p90:3+i*.2};
 observations.push({...obs("target","2022/2023"),values:{accurate_passes_p90:44,accurate_long_balls_p90:9}});
 const dataset={observations,records:{PlayerSeasonStats:[]}};
 const general={player_role_priorities:JSON.stringify({GK:"Líder"})};
 const result=careerPositionFitIndex({dataset,players:observations.map(o=>({id:o.playerId})),role:"GK",profile:general});
 assert.ok(result.get("target")?.score!==null);
 assert.equal(result.get("target").basis,"position");
 assert.match(result.get("target").method,/ADN sin evidencia suficiente/);
 assert.equal(result.diagnostics.tacticalSeasons,0);
 assert.ok(result.diagnostics.positionalSeasons>0);
});
test("a measurable GK coach brief uses tactical evidence rather than positional fallback",()=>{
 const {observations}=reference();
 for(let i=0;i<observations.length;i++)observations[i].values={accurate_passes_p90:20+i,accurate_long_balls_p90:3+i*.2};
 observations.push({...obs("target","2022/2023"),values:{accurate_passes_p90:44,accurate_long_balls_p90:9}});
 const result=careerPositionFitIndex({dataset:{observations,records:{}},players:observations.map(o=>({id:o.playerId})),role:"GK",profile});
 assert.equal(result.get("target")?.basis,"adn");
 assert.ok(result.diagnostics.tacticalSeasons>0);
});
