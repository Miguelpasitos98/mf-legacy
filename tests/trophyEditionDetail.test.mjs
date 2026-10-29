import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildClubTrophyHistory} from "../src/utils/trophyClubHistory.js";

const honours=[
 {id:"base",trophy_source_id:"L",season:"2024/2025",recipient_type:"Team",recipient_id:"club",recipient_name:"FC Club",verified:true},
 {id:"better",trophy_source_id:"L",season:"2024/2025",recipient_type:"Team",recipient_id:"club",recipient_name:"FC Club",verified:true,source_url:"https://example.com/title"},
 {id:"cup",trophy_source_id:"C",season:"2024/2025",recipient_type:"Team",recipient_id:"club",recipient_name:"FC Club",verified:true},
 {id:"pending",trophy_source_id:"U",season:"2024/2025",recipient_type:"Team",recipient_id:"club",verified:false},
 {id:"other",trophy_source_id:"L",season:"2023/2024",recipient_type:"Team",recipient_id:"other",verified:true}
];
const catalog=[{source_id:"L",name:"Liga"},{source_id:"C",name:"Copa"},{source_id:"U",name:"Europa"}];
const players=[{id:"yes",name:"Jugador Confirmado"},{id:"pending",name:"Jugador Pendiente"},{id:"excluded",name:"Jugador Excluido"},{id:"wrong",name:"Jugador Equivocado"}];
const credit=(trophy_honour_id,player_id,status="confirmed",extra={})=>({
 trophy_honour_id,player_id,team_id:"club",season:"2024/2025",trophy_source_id:"L",
 status,verified:status==="confirmed",source_url:"https://example.com/player",...extra
});
test("Edition detail connects credits to both IDs of a duplicate official winner",()=>{
 const credits=[credit("base","yes"),credit("better","yes")];
 const result=buildClubTrophyHistory("club",{honours,credits,catalog,players});
 assert.equal(result.total,2);
 const edition=result.editions.find(h=>h.trophy_source_id==="L");
 assert.equal(edition.id,"better");
 assert.equal(edition.source_url,"https://example.com/title");
 assert.equal(edition.confirmedPlayerCount,1);
 assert.equal(edition.confirmedPlayers[0].name,"Jugador Confirmado");
 assert.equal(edition.candidatePlayerCount,0);
});
test("Confirmed credits outrank candidate duplicates while unrelated and excluded players stay out",()=>{
 const credits=[
  credit("better","yes","candidate",{verified:false}),
  credit("base","yes","confirmed"),
  credit("base","pending","candidate",{verified:false}),
  credit("base","excluded","excluded",{verified:false}),
  credit("pending","wrong","confirmed",{trophy_source_id:"U"}),
  credit("cup","wrong","confirmed",{trophy_source_id:"L"}),
  credit("base","wrong","confirmed",{team_id:"other"})
 ];
 const result=buildClubTrophyHistory("club",{honours,credits,catalog,players});
 const edition=result.editions.find(h=>h.trophy_source_id==="L");
 assert.equal(edition.confirmedPlayerCount,1);
 assert.equal(edition.confirmedPlayers[0].id,"yes");
 assert.equal(edition.candidatePlayerCount,1);
 assert.equal(edition.candidatePlayers[0].id,"pending");
 assert.equal(result.confirmedPlayerCount,1);
 assert.equal(result.players[0].count,1);
});
test("Unconfirmed candidate never appears as winner when there are no verified player credits",()=>{
 const result=buildClubTrophyHistory("club",{
  honours,catalog,players,credits:[credit("base","pending","candidate",{verified:false})]
 });
 const edition=result.editions.find(h=>h.trophy_source_id==="L");
 assert.equal(edition.confirmedPlayerCount,0);
 assert.equal(edition.candidatePlayerCount,1);
 assert.equal(result.players.length,0);
});
test("Edition details open from club timeline and allow returning without resetting filters",()=>{
 const history=readFileSync(new URL("../src/components/trophies/ClubTrophyHistory.jsx",import.meta.url),"utf8");
 const detail=readFileSync(new URL("../src/components/trophies/TrophyEditionDetail.jsx",import.meta.url),"utf8");
 const archive=readFileSync(new URL("../src/components/trophies/TrophyArchiveOverview.jsx",import.meta.url),"utf8");
 assert.match(history,/showEdition=h=>\{setSelectedEditionKey\(editionKey\(h\)\);\}/);
 assert.match(history,/<TrophyEditionDetail/);
 assert.ok(history.includes('onBack={()=>setSelectedEditionKey("")}'));
 assert.match(history,/Ver edición/);
 assert.match(detail,/Volver a la cronología/);
 assert.match(detail,/Jugadores acreditados/);
 assert.match(detail,/Candidatos pendientes/);
 assert.match(detail,/Revisar en Sincronizar/);
 assert.match(archive,/onOpenTrophy=\{onOpenTrophy\} onSync=\{onSync\}/);
});
