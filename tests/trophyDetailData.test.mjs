import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {trophyEditionRows,trophyDetailSummary,trophyClubRanking,trophyPlayerRanking} from "../src/utils/trophyDetailData.js";

const years=[
 {id:"h1",trophy_source_id:"67",season:"2025/2026",recipient_type:"Team",recipient_id:"barca",recipient_name:"FC Barcelona",verified:true},
 {id:"h2",trophy_source_id:"67",season:"2024/2025",recipient_type:"Team",recipient_id:"barca",recipient_name:"FC Barcelona",verified:true},
 {id:"h3",trophy_source_id:"67",season:"2023/2024",recipient_type:"Team",recipient_id:"madrid",recipient_name:"Real Madrid CF",verified:false},
 {id:"h4",trophy_source_id:"67",season:"2022/2023",recipient_type:"Team",recipient_id:"barca",recipient_name:"FC Barcelona",verified:true}
];
test("Summary counts only verified editions and distinct clubs; pending editions stay visible",()=>{
 const rows=trophyEditionRows([...years,{...years[0],id:"duplicate"}]);
 assert.equal(rows.length,4);
 assert.deepEqual(rows.map(h=>h.season),["2025/2026","2024/2025","2023/2024","2022/2023"]);
 const info=trophyDetailSummary([...years,{...years[0],id:"duplicate"}]);
 assert.equal(info.verifiedCount,3);
 assert.equal(info.pendingCount,1);
 assert.equal(info.clubCount,1);
 assert.equal(info.newest,"2025/2026");
 assert.equal(info.earliest,"2022/2023");
});
test("Club rankings use verified champions exclusively, not pending editions",()=>{
 const summary=trophyClubRanking([...years,{...years[0],id:"duplicate"}]);
 assert.equal(summary.length,1);
 assert.equal(summary[0].team_id,"barca");
 assert.equal(summary[0].count,3);
});
test("Player honors require both a verified winner and an individually confirmed credit",()=>{
 const credits=[
  {trophy_honour_id:"h1",player_id:"p1",team_id:"barca",season:"2025/2026",status:"confirmed",verified:true},
  {trophy_honour_id:"h2",player_id:"p1",team_id:"barca",season:"2024/2025",status:"candidate",verified:false},
  {trophy_honour_id:"h3",player_id:"p1",team_id:"madrid",season:"2023/2024",status:"confirmed",verified:true},
  {trophy_honour_id:"h4",player_id:"p2",team_id:"madrid",season:"2022/2023",status:"confirmed",verified:true},
  {trophy_honour_id:"h1",player_id:"p1",team_id:"barca",season:"2025/2026",status:"confirmed",verified:true}
 ];
 const people=[{id:"p1",name:"Jugador 1"},{id:"p2",name:"Jugador 2"}];
 const result=trophyPlayerRanking(years,credits,people);
 assert.equal(result.length,1);
 assert.equal(result[0].player_id,"p1");
 assert.equal(result[0].count,1);
 assert.equal(result[0].collective,1);
});
test("Verified individual awards are ranked without unrelated team credits",()=>{
 const awards=[...years,{id:"personal",trophy_source_id:"67",recipient_type:"Player",recipient_id:"p1",season:"2021",verified:true}];
 const result=trophyPlayerRanking(awards,[],[{id:"p1",name:"Jugador de Oro"}]);
 assert.equal(result.length,1);
 assert.equal(result[0].count,1);
 assert.equal(result[0].individual,1);
});
test("Visual tabs are integrated, with legacy editing still accessible and default Summary",()=>{
 const page=readFileSync(new URL("../src/pages/Trophies.jsx",import.meta.url),"utf8");
 const view=readFileSync(new URL("../src/components/trophies/TrophyDetailVisual.jsx",import.meta.url),"utf8");
 assert.match(page,/setDetailTab\("Resumen"\)/);
 assert.match(page,/newRecord\?\["Editar"\]:\["Resumen","Ediciones","Clubes","Jugadores","Editar"\]/);
 assert.match(page,/detailTab==="Editar"\?<div className="grid/);
 assert.match(page,/<TrophyDetailVisual/);
 for(const tab of ["Resumen","Ediciones","Clubes","Jugadores"])
  assert.ok(view.includes('tab==="'+tab+'"'));
 assert.match(view,/trophyPlayerRanking\(honours,creditsQuery\.data\|\|\[\],playersQuery\.data\|\|\[\]\)/);
});
