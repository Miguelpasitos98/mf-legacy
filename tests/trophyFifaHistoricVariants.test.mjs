import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {trophyImageUrl} from "../src/utils/trophyCatalog.js";
import {FIFA_CWC_SOURCE_ID,CLASSIC_CWC_VARIANT,MODERN_CWC_VARIANT,CLASSIC_CWC_URL,
 FIFA_CWC_VISUAL_VARIANTS,expandTrophyVisualCards,fifaCwcVariantForSeason,isFifaClubWorldCup} from "../src/utils/trophyVisualVariants.js";
import {archiveOverview} from "../src/utils/trophyArchiveOverview.js";

const modern="https://raw.githubusercontent.com/Miguelpasitos98/My-Legacy/main/Trofeos%20identificados/Pendientes%20de%20identificar/121092.png";
const canonical={id:"db123",source_id:FIFA_CWC_SOURCE_ID,name:"Mundial de Clubes FIFA",image_url:modern,
 identification_status:"Verified",trophy_type:"Team Trophy",organizer:"FIFA"};
test("Both physical FIFA designs have separate internal variant IDs but one unchanged FM competition ID",()=>{
 assert.equal(FIFA_CWC_VISUAL_VARIANTS.length,2);
 assert.equal(new Set(FIFA_CWC_VISUAL_VARIANTS.map(x=>x.id)).size,2);
 assert.deepEqual([...new Set(FIFA_CWC_VISUAL_VARIANTS.map(x=>x.source_id))],[FIFA_CWC_SOURCE_ID]);
 const all=[{source_id:"67",name:"LaLiga"},canonical];
 const display=expandTrophyVisualCards(all);
 assert.equal(all.length,2);
 assert.equal(display.length,3);
 assert.equal(display.filter(isFifaClubWorldCup).length,2);
 assert.equal(display.find(x=>x.visual_variant_id===CLASSIC_CWC_VARIANT).id,canonical.id);
 assert.equal(display.find(x=>x.visual_variant_id===MODERN_CWC_VARIANT).id,canonical.id);
 assert.equal(display[0],all[0]);
});
test("Image selection is based on edition year and preserves the modern canonical URL",()=>{
 assert.equal(trophyImageUrl(canonical,null,"2015/2016"),CLASSIC_CWC_URL);
 assert.equal(trophyImageUrl(canonical,null,"2023"),CLASSIC_CWC_URL);
 assert.equal(trophyImageUrl(canonical,null,2025),modern);
 assert.equal(trophyImageUrl(canonical,null,"2025/2026"),modern);
 assert.equal(trophyImageUrl(canonical),modern);
 assert.equal(trophyImageUrl({...canonical,visual_variant_id:CLASSIC_CWC_VARIANT}),CLASSIC_CWC_URL);
 assert.equal(trophyImageUrl({...canonical,visual_variant_id:MODERN_CWC_VARIANT}),modern);
 assert.equal(fifaCwcVariantForSeason("2000"),null);
 assert.equal(fifaCwcVariantForSeason("2024"),null);
 assert.equal(trophyImageUrl({source_id:"67",image_url:"https://example.org/laliga.png"},null,"2015"),"https://example.org/laliga.png");
});
test("No new titles or award history are created by two visual variants",()=>{
 const honours=[{id:"a",trophy_source_id:FIFA_CWC_SOURCE_ID,recipient_type:"Team",recipient_id:"barca",recipient_name:"FC Barcelona",season:"2015",verified:true},
 {id:"b",trophy_source_id:FIFA_CWC_SOURCE_ID,recipient_type:"Team",recipient_id:"chelsea",recipient_name:"Chelsea",season:"2025",verified:true}];
 const output=archiveOverview(honours,[],[canonical]);
 assert.equal(output.verifiedCount,2);
 assert.equal(output.competitions.length,1);
 assert.equal(output.competitions[0].source_id,FIFA_CWC_SOURCE_ID);
 assert.equal(output.competitions[0].count,2);
 assert.equal(output.clubs.find(x=>x.id==="barca").trophyLatestSeason.get(FIFA_CWC_SOURCE_ID),"2015");
 assert.equal(output.clubs.find(x=>x.id==="chelsea").trophyLatestSeason.get(FIFA_CWC_SOURCE_ID),"2025");
 const clubCard=readFileSync("src/components/trophies/ClubHonoursGroupCard.jsx","utf8");
 assert.match(clubCard,/season=\{item.trophyLatestSeason\?\.get\(sourceId\)\}/);
});
test("The classic design is visible as its own FIFA catalog card; editions use year-aware trophies",()=>{
 const catalog=readFileSync("src/pages/Trophies.jsx","utf8");
 const detail=readFileSync("src/components/trophies/TrophyDetailVisual.jsx","utf8");
 assert.match(catalog,/expandTrophyVisualCards\(all\)/);
 assert.match(catalog,/key=\{t.visual_variant_id\|\|t.source_id\}/);
 assert.match(catalog,/canonical=all.find/);
 assert.match(detail,/Dos trofeos FIFA, una misma competición/);
 assert.match(detail,/CLASSIC_CWC_CREDIT/);
 for(const file of ["TrophyEditionDetail.jsx","ClubTrophyHistory.jsx","PalmaresButton.jsx"]){
  const code=readFileSync("src/components/trophies/"+file,"utf8");
  assert.match(code,/trophyImageUrl\([^\n]+,(?:edition|h)\.season\)/,file);
 }
});
