import test from "node:test";
import assert from "node:assert/strict";
import {roleCompatibility,managerFitV1,rankPlayers,validCA} from "../src/components/managers/managerFit.mjs";
test("FM positional rating is used but never confused with CA",()=>{
 const player={id:"1",position:"LD",ca:175,position_ratings:{defensa_derecho:18}};
 const score=managerFitV1(player,"FB",{player_role_priorities:JSON.stringify({FB:"Lateral invertido"})});
 assert.equal(score.fit,90);
 assert.equal(score.quality,175);
 assert.equal(score.reliability,"medium");
 assert.equal(score.requirements,"Lateral invertido");
});
test("missing positional data is unknown, not zero or an invented tactical score",()=>{
 assert.equal(roleCompatibility({position:"DC"},"GK").fit,null);
 assert.equal(roleCompatibility({},"FB").fit,null);
 assert.equal(validCA(0),null);
 assert.equal(validCA(""),null);
 assert.equal(validCA(150),150);
});
test("main and secondary positions provide explicitly low-confidence approximations",()=>{
 const main=managerFitV1({id:"1",position:"EI"},"WG",{});
 const secondary=managerFitV1({id:"2",position:"DC",secondary_position:"EI"},"WG",{});
 assert.equal(main.fit,85);
 assert.equal(secondary.fit,65);
 assert.equal(main.reliability,"low");
});
test("search, minimum CA, reliability filtering and rank are predictable",()=>{
 const players=[
  {id:"a",name:"Andrés",position:"LD",ca:140,position_ratings:{defensa_derecho:19}},
  {id:"b",name:"Antonio",position:"LD",ca:175,position_ratings:{defensa_derecho:15}},
  {id:"c",name:"Aníbal",position:"DC",ca:190}
 ];
 assert.deepEqual(rankPlayers(players,"FB",{}, {search:"an",minCA:130}).map(r=>r.player.id),["a","b"]);
 assert.equal(rankPlayers(players,"FB",{}, {showUnknown:true}).length,3);
 assert.equal(rankPlayers(players,"FB",{}, {minCA:180}).length,0);
});
