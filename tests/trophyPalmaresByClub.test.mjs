import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {trophyPalmaresClubRows} from "../src/utils/trophyPalmaresClubRows.js";
test("Championship, finalist and third-place history stays separate, duplicate years collapse",()=>{
 const entries=[
  {team_id:"real",team_name:"Real Madrid",rank:"winner",calendar_year:2014,match_status:"auto_linked"},
  {team_id:"real",team_name:"Real Madrid",rank:"winner",calendar_year:2014,match_status:"auto_linked"},
  {team_id:"real",team_name:"Real Madrid",rank:"runner_up",calendar_year:1981,match_status:"manual_linked"},
  {team_id:"real",team_name:"Real Madrid",rank:"third",calendar_year:1964,match_status:"auto_linked"},
  {team_id:"real",team_name:"Real Madrid",rank:"winner",calendar_year:2019,match_status:"needs_review"},
  {team_id:"barca",team_name:"FC Barcelona",rank:"winner",calendar_year:2015,match_status:"auto_linked"}
 ];
 const groups=trophyPalmaresClubRows(entries);
 assert.equal(groups.length,2);
 const real=groups.find(x=>x.team_id==="real");
 assert.deepEqual(real.winner,[2014]);assert.deepEqual(real.runner_up,[1981]);assert.deepEqual(real.third,[1964]);
 assert.equal(real.winner.includes(2019),false);
});
test("Trophy detail reads imported per-club awards but does not mark them as official TrophyHonour",()=>{
 const visual=readFileSync(new URL("../src/components/trophies/TrophyDetailVisual.jsx",import.meta.url),"utf8");
 const component=readFileSync(new URL("../src/components/trophies/TrophyPalmaresByClub.jsx",import.meta.url),"utf8");
 assert.match(visual,/TrophyPalmaresEntry\.filter/);
 assert.match(visual,/TrophyPalmaresByClub entries=\{palmaresRows\}/);
 assert.match(component,/Ganador/);
 assert.match(component,/Subcampeón/);
 assert.match(component,/Tercer puesto/);
 assert.match(component,/Sin contrastar oficialmente/);
});
