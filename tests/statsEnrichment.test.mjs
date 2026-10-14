import {test} from "node:test";
import assert from "node:assert/strict";
import {assessHistoricalEnrichment} from "../src/utils/statsEnrichment.js";

const old={
  id:"record-1",player_id:"linked-player",fotmob_player_id:"737066",
  fotmob_team_id:"8456",season:"2025/2026",competition:"Premier League",
  appearances:35,minutes:2958,rating:7.68,metrics:[]
};
const incoming={
  player_fotmob_id:"737066",fotmob_team_id:"8456",
  season:"2025/2026",competition:"Premier League",
  appearances:35,minutes:2958,rating:7.68,
  metrics:[{name:"Goals",value:27,per90:0.82,percentile:97},
    {name:"Assists",value:8,per90:0.24,percentile:95},
    {name:"xG",value:25.78,per90:0.78,percentile:99}]
};
test("FotMob: enriquece una temporada importada sin alterar la nota ni sus minutos",()=>{
 const result=assessHistoricalEnrichment(old,incoming,"linked-player");
 assert.equal(result.ok,true);
 assert.equal(result.added,3);
 assert.deepEqual(result.metrics.map(x=>x.value),[27,8,25.78]);
 assert.equal(old.rating,7.68);assert.equal(old.minutes,2958);
});
test("segundo intento es idempotente",()=>{
 const first=assessHistoricalEnrichment(old,incoming,"linked-player");
 const second=assessHistoricalEnrichment({...old,metrics:first.metrics},incoming,"linked-player");
 assert.equal(second.ok,true); assert.equal(second.added,0);
});
test("nunca sobrescribe las ediciones manuales; registra discrepancias",()=>{
 const current={...old,metrics:[{name:"Goals",value:26,per90:null,percentile:null}]};
 const result=assessHistoricalEnrichment(current,incoming,"linked-player");
 assert.equal(result.ok,true);assert.equal(result.metrics[0].value,26);
 assert.equal(result.added,2);assert.deepEqual(result.conflicts,["Goals"]);
});
test("no mezcla temporadas, clubes, jugadores ni minutos diferentes",()=>{
 for(const altered of [
  {...incoming,season:"2024/2025"},
  {...incoming,fotmob_team_id:"9789"},
  {...incoming,minutes:2957},
  {...incoming,player_fotmob_id:"846033"}
 ])assert.equal(assessHistoricalEnrichment(old,altered,"linked-player").ok,false);
 assert.equal(assessHistoricalEnrichment(old,incoming,"different-base44-player").ok,false);
});
test("los valores 0 son estadísticas reales; null se ignora",()=>{
 const value=assessHistoricalEnrichment(old,{...incoming,metrics:[{name:"Goals",value:0},{name:"xG",value:null}]},"linked-player");
 assert.equal(value.ok,true);assert.equal(value.added,1);assert.equal(value.metrics[0].value,0);
});
