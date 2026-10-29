import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {archiveOverview,searchArchiveRows} from "../src/utils/trophyArchiveOverview.js";
import {trophyEditionRows} from "../src/utils/trophyDetailData.js";

const trophies=[
 {source_id:"67",name:"LaLiga"},
 {source_id:"68",name:"Copa del Rey"},
 {source_id:"69",name:"Supercopa de España"}
];
const honours=[
 {id:"a",trophy_source_id:"67",recipient_type:"Team",recipient_id:"barca",recipient_name:"FC Barcelona",season:"2024/2025",verified:true},
 {id:"b",trophy_source_id:"68",recipient_type:"Team",recipient_id:"barca",recipient_name:"FC Barcelona",season:"2024/2025",verified:true},
 {id:"c",trophy_source_id:"69",recipient_type:"Team",recipient_id:"madrid",recipient_name:"Real Madrid",season:"2024/2025",verified:false},
 {id:"d",trophy_source_id:"67",recipient_type:"Team",recipient_id:"madrid",recipient_name:"Real Madrid",season:"2023/2024",verified:true},
 {id:"e",trophy_source_id:"69",recipient_type:"Team",recipient_id:"barca",recipient_name:"FC Barcelona",season:"2024/2025",verified:true},
 {id:"award",trophy_source_id:"700",recipient_type:"Player",recipient_id:"p2",recipient_name:"Jugador 2",season:"2024",verified:true}
];
test("Two independent trophies from same club and same season remain two titles",()=>{
 assert.equal(trophyEditionRows(honours).length,6);
 const result=archiveOverview(honours,[],trophies);
 assert.equal(result.verifiedCount,5);
 assert.equal(result.clubs.find(x=>x.id==="barca").total,3);
 assert.equal(result.clubs.find(x=>x.id==="barca").distinct,3);
 assert.equal(result.competitions.find(x=>x.source_id==="67").count,2);
 assert.equal(result.competitions.find(x=>x.source_id==="69").count,1);
 assert.equal(result.competitions.find(x=>x.source_id==="68").count,1);
});
test("Pending club titles never count as championships or winners",()=>{
 const result=archiveOverview(honours,[],trophies);
 assert.equal(result.clubs.find(x=>x.id==="madrid").total,1);
 assert.equal(result.competitions.find(x=>x.source_id==="69").winnerCount,1);
});
test("A verified credit needs the right team, edition, player and winner status",()=>{
 const credits=[
 {trophy_honour_id:"a",player_id:"p1",team_id:"barca",season:"2024/2025",verified:true,status:"confirmed"},
 {trophy_honour_id:"a",player_id:"p1",team_id:"barca",season:"2024/2025",verified:true,status:"confirmed"},
 {trophy_honour_id:"b",player_id:"p1",team_id:"barca",season:"2024/2025",verified:false,status:"candidate"},
 {trophy_honour_id:"c",player_id:"p1",team_id:"madrid",season:"2024/2025",verified:true,status:"confirmed"},
 {trophy_honour_id:"b",player_id:"p1",team_id:"madrid",season:"2024/2025",verified:true,status:"confirmed"},
 {trophy_honour_id:"b",player_id:"p1",team_id:"barca",season:"2024/2025",verified:true,status:"confirmed"}
 ];
 const result=archiveOverview(honours,credits,trophies,[{id:"p1",name:"Jugador 1"},{id:"p2",name:"Jugador 2"}]);
 const p1=result.players.find(x=>x.id==="p1"),p2=result.players.find(x=>x.id==="p2");
 assert.equal(p1.total,2);
 assert.equal(p1.collective,2);
 assert.equal(p1.individual,0);
 assert.equal(p2.individual,1);
 assert.equal(p2.collective,0);
});
test("Archive search matches accents and season but not missing records",()=>{
 const result=archiveOverview(honours,[],trophies);
 assert.equal(searchArchiveRows(result.competitions,"la liga").length,0);
 assert.equal(searchArchiveRows(result.competitions,"laliga").length,1);
 assert.equal(searchArchiveRows(result.competitions,"Supercopa de Espana").length,1);
 assert.deepEqual(searchArchiveRows(result.clubs,"NoExiste"),[]);
});
test("Trophies has three primary sections with original editor and one dedicated sync view",()=>{
 const page=readFileSync(new URL("../src/pages/Trophies.jsx",import.meta.url),"utf8");
 const workbench=readFileSync(new URL("../src/components/trophies/TrophySyncWorkbench.jsx",import.meta.url),"utf8");
 assert.match(page,/\["catalog","Catálogo"\],\["palmares","Palmarés"\],\["sync","Sincronizar"\]/);
 assert.match(page,/section==="catalog"/);
 assert.match(page,/section==="palmares"/);
 assert.match(page,/section==="sync"/);
 assert.match(page,/<TrophyArchiveOverview/);
 assert.match(page,/<TrophySyncWorkbench standalone/);
 assert.match(workbench,/useState\(standalone\)/);
 assert.match(page,/detailTab==="Editar"/);
});
