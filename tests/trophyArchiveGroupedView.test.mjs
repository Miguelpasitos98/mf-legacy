import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {archiveOverview} from "../src/utils/trophyArchiveOverview.js";

const overviewCode=readFileSync(new URL("../src/components/trophies/TrophyArchiveOverview.jsx",import.meta.url),"utf8");
const clubCard=readFileSync(new URL("../src/components/trophies/ClubHonoursGroupCard.jsx",import.meta.url),"utf8");

test("The Palmarés overview opens Teams first and removes the oversized blue hero",()=>{
 assert.match(overviewCode,/useState\("equipos"\)/);
 assert.match(overviewCode,/const MODES=\[\["equipos"/);
 assert.match(overviewCode,/Resumen del palmarés/);
 assert.doesNotMatch(overviewCode,/MF LEGACY · HISTORICAL HONOURS/);
 assert.doesNotMatch(overviewCode,/<h2 className="text-3xl font-black tracking-tight md:text-4xl">Palmarés/);
 assert.match(overviewCode,/Palmarés agrupado por equipos/);
 assert.match(overviewCode,/<ClubHonoursGroupCard/);
});

test("Each team group exposes crest, trophy images and names, ×N counts, archive and profile links",()=>{
 assert.match(clubCard,/function Crest/);
 assert.match(clubCard,/normalizeImageUrl/);
 assert.match(clubCard,/SmallTrophy/);
 assert.match(clubCard,/trophy\.name/);
 assert.match(clubCard,/×\{count\}/);
 assert.match(clubCard,/item\.total/);
 assert.match(clubCard,/onOpenTrophy/);
 assert.match(clubCard,/onOpenArchive/);
 assert.match(clubCard,/onOpenProfile/);
});

test("Club trophy multiplicities count actual verified editions, exclude pending titles, never merge other teams",()=>{
 const catalog=[{source_id:"67",name:"LaLiga"},{source_id:"68",name:"Copa del Rey"},{source_id:"69",name:"Supercopa de España"}];
 const honours=[];
 for(let year=2015;year<=2020;year++)honours.push({id:"l"+year,recipient_type:"Team",recipient_id:"barca",recipient_name:"FC Barcelona",trophy_source_id:"67",season:year+"/"+(year+1),verified:true});
 for(let year=2018;year<=2022;year++)honours.push({id:"c"+year,recipient_type:"Team",recipient_id:"barca",recipient_name:"FC Barcelona",trophy_source_id:"68",season:year+"/"+(year+1),verified:true});
 for(let year=2019;year<=2023;year++)honours.push({id:"s"+year,recipient_type:"Team",recipient_id:"barca",recipient_name:"FC Barcelona",trophy_source_id:"69",season:year+"/"+(year+1),verified:true});
 honours.push({id:"unverified",recipient_type:"Team",recipient_id:"barca",recipient_name:"FC Barcelona",trophy_source_id:"69",season:"2025/2026",verified:false});
 honours.push({id:"otherteam",recipient_type:"Team",recipient_id:"madrid",recipient_name:"Real Madrid",trophy_source_id:"67",season:"2024/2025",verified:true});
 const result=archiveOverview(honours,[],catalog);
 const barca=result.clubs.find(x=>x.id==="barca");
 assert.equal(barca.total,16);
 assert.equal(barca.distinct,3);
 assert.deepEqual([...barca.trophyCounts.entries()].sort(),[["67",6],["68",5],["69",5]]);
 assert.equal(result.clubs.find(x=>x.id==="madrid").total,1);
 assert.equal(result.verifiedCount,17);
 const filtered=archiveOverview(honours.filter(h=>h.season==="2019/2020"),[],catalog);
 assert.equal(filtered.clubs.find(x=>x.id==="barca").total,3);
});
