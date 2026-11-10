import test from "node:test";
import assert from "node:assert/strict";
import {evaluatePlayerSeasonHybrid} from "../src/components/managers/managerPlayerSeasonHybrid.mjs";

const player={stats:{
 mental:{decisiones:16},goalkeeping:{reflejos:17,uno_contra_uno:15,saques_de_puerta:19,saque_con_la_mano:17}
}};
const coach={player_role_priorities:JSON.stringify({GK:"Portero-líbero"})};
const advanced={attributes:80,coverage:100};
const history={bestScore:79,bestSeason:"2022/2023",coverage:100,basis:"adn",confidence:"medium",seasonCount:4};

test("main scouting rating is 70% measured FM26 role stats and 30% best historical season",()=>{
 const r=evaluatePlayerSeasonHybrid({player,role:"GK",profile:coach,advanced,career:history});
 const coachFunctions=Math.round((19+17+16)/3/20*100);
 const fm=Math.round(80*.4+coachFunctions*.6);
 assert.equal(r.fmScore,fm);
 assert.equal(r.seasonScore,79);
 assert.equal(r.season,"2022/2023");
 assert.equal(r.score,Math.round(fm*.7+79*.3));
 assert.equal(r.coverage,100);
 assert.equal(r.seasonBasis,"adn");
});

test("no historical season means no made-up combined score, with FM26 still visible",()=>{
 const r=evaluatePlayerSeasonHybrid({player,role:"GK",profile:coach,advanced,career:null});
 assert.equal(r.score,null);
 assert.ok(r.fmScore>0);
 assert.equal(r.seasonScore,null);
 assert.match(r.missing.join(" "),/temporada histórica evaluable/);
});

test("no role attribute evidence means no combined score even with historical season",()=>{
 const r=evaluatePlayerSeasonHybrid({player:{stats:{}},role:"GK",profile:coach,
  advanced:{attributes:null,coverage:0},career:history});
 assert.equal(r.score,null);
 assert.equal(r.fmScore,null);
 assert.equal(r.seasonScore,79);
});

test("unmeasurable coach description may use observed FM26 role attributes, but not invent tactical score",()=>{
 const r=evaluatePlayerSeasonHybrid({player,role:"GK",
  profile:{player_role_priorities:JSON.stringify({GK:"Líder"})},advanced,career:{...history,basis:"position"}});
 assert.equal(r.fmScore,80);
 assert.equal(r.functions.measured,0);
 assert.equal(r.seasonBasis,"position");
 assert.equal(r.score,Math.round(80*.7+79*.3));
});
