import test from "node:test";
import assert from "node:assert/strict";
import {collectPlayerSeasonMetrics,seasonPercentiles,historicalRoleCandidates} from "../src/components/managers/managerFitHistorical.mjs";
test("records link by exact player id and season, with aligned minutes",()=>{
 const rows=[
 {player_id:"p1",season:"2025/2026",minutes:900,competition:"LaLiga",metrics:[{name:"xA",value:2}]},
 {player_id:"p1",season:"2025/2026",minutes:1800,competition:"Champions League",metrics:[{name:"xA",value:3}]},
 {player_id:"p1",season:"2024/2025",minutes:900,competition:"LaLiga",metrics:[{name:"xA",value:30}]},
 {player_id:"p2",season:"2025/2026",minutes:900,competition:"LaLiga",metrics:[{name:"xA",value:100}]},
 {player_id:"p1",season:"2025/2026",minutes:90,is_national_team:true,metrics:[{name:"xA",value:100}]}
 ];
 const result=collectPlayerSeasonMetrics(rows,[],"2025/2026","p1");
 assert.equal(result.xa.source,"FotMob");
 assert.equal(Math.round(result.xa.value*1000)/1000,Math.round((5*90/2700)*1000)/1000);
});
test("Understat per90 used when only one aligned record exists",()=>{
 const u=[{player_id:"p1",season:"2025/2026",xg_chain_p90:.44,xg_buildup_p90:.22}];
 const result=collectPlayerSeasonMetrics([],u,"2025/2026","p1");
 assert.equal(result.chain.value,.44);
 assert.equal(result.buildup.value,.22);
 const conflicting=collectPlayerSeasonMetrics([],u.concat({...u[0],team:"other",xg_chain_p90:.3}),"2025/2026","p1");
 assert.equal(conflicting.chain,undefined);
});
test("historical percentiles need 10 comparable peers and at least two indicators",()=>{
 const peers=Array.from({length:12},(_,i)=>({xa:{value:i*.1},buildup:{value:i*.02}}));
 const player={xa:{value:.9,source:"FotMob"},buildup:{value:.18,source:"Understat"}};
 const v=seasonPercentiles(player,peers,"FB",{possession:88});
 assert.ok(v.score>=0&&v.score<=100);
 assert.equal(v.breakdown.length,2);
 assert.equal(v.confidence,"low");
 assert.equal(seasonPercentiles(player,peers.slice(0,5),"FB",{}).score,null);
 assert.equal(seasonPercentiles({xa:player.xa},peers,"FB",{}).score,null);
});
test("role peer selection never mixes forwards with fullbacks",()=>{
 const players=[{id:"a",position:"LD"},{id:"b",position:"DC"},{id:"c",position:"LI"}];
 assert.deepEqual(historicalRoleCandidates(players,"FB").map(p=>p.id),["a","c"]);
});
