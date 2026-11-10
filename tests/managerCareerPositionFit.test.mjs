import test from "node:test";
import assert from "node:assert/strict";
import {careerPositionFitIndex} from "../src/components/managers/managerCareerPositionFit.mjs";

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
