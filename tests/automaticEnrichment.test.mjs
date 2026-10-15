import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assessHistoricalEnrichment } from "../src/utils/statsEnrichment.js";

test("Automatic import enables enrichment for existing seasons",()=>{
  const text=readFileSync(new URL("../src/pages/ImportUnified.jsx",import.meta.url),"utf8");
  assert.match(text, /old && x\.kind==="season" && \(enrichExisting \|\| automatic\)/);
  assert.match(text, /\["crear","enriquecer"\]\.includes\(r\.action\)/);
  assert.match(text, /metrics:analysis\.metrics/);
});
test("Adds Understat and ground duels metrics without replacing original",()=>{
  const old={
    id:"season-1",player_id:"p1",fotmob_player_id:"737066",
    fotmob_team_id:"8456",season:"2022/2023",competition:"Premier League",
    appearances:35,minutes:2765,rating:7.8,
    metrics:[{name:"xG",value:25.1},{name:"Aerials won %",value:48}],
  };
  const newer={player_fotmob_id:"737066",fotmob_team_id:"8456",
    season:"2022/2023",competition:"Premier League",appearances:35,minutes:2765,
    metrics:[{name:"xG",value:100},{name:"xG Chain",value:31.2,per90:1.9},
      {name:"xG Buildup",value:6.8,per90:.42},
      {name:"Understat minutes",value:1600},
      {name:"Ground duels won",value:40},
      {name:"Ground duels contested",value:88},
      {name:"Ground duels won %",value:40/88*100}]};
  const r=assessHistoricalEnrichment(old,newer,"p1");
  assert.equal(r.ok,true);
  assert.equal(r.added,6);
  assert.deepEqual(r.conflicts,["xG"]);
  assert.equal(r.metrics.find(m=>m.name==="xG").value,25.1);
  assert.equal(old.minutes,2765);
  assert.equal(old.rating,7.8);
  assert.equal(assessHistoricalEnrichment({...old,metrics:r.metrics},newer,"p1").added,0);
});
