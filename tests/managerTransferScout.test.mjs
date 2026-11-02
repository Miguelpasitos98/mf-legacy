import test from "node:test";
import assert from "node:assert/strict";
import {ageOnSeason,valuationForSeason,filterScoutingCandidates,seasonReferenceDate,formatTransferValue} from "../src/components/managers/managerTransferScout.mjs";
test("historical age uses season end and validates birthdays",()=>{
 assert.equal(ageOnSeason({date_of_birth:"16/06/1967"},"2025/2026"),59);
 assert.equal(ageOnSeason({date_of_birth:"01/07/2002"},"2025/2026"),23);
 assert.equal(ageOnSeason({date_of_birth:"31/02/2000"},"2025/2026"),null);
 assert.equal(ageOnSeason({},"2025/2026"),null);
 assert.equal(seasonReferenceDate("invalid"),null);
});
test("Transfermarkt values never carry across seasons, missing is never zero",()=>{
 const records=[{player_id:"1",season:"2024/2025",transfermarkt_value_eur:90000000},
 {player_id:"1",season:"2025/2026",transfermarkt_value_eur:25000000,market_value_as_of:"2025-12-20"},
 {player_id:"1",season:"2025/2026",transfermarkt_value_eur:33000000,market_value_as_of:"2026-05-05"}];
 assert.equal(valuationForSeason(records,"1","2025/2026").eur,33000000);
 assert.equal(valuationForSeason(records,"1","2023/2024"),null);
 assert.equal(valuationForSeason([{player_id:"1",season:"2025/2026",transfermarkt_value_eur:null}],"1","2025/2026"),null);
 assert.equal(formatTransferValue(null),"Sin valoración");
});
test("scouting constraints reject missing values instead of treating them as free",()=>{
 const items=[{player:{date_of_birth:"01/01/2000"},valuation:{eur:9000000},roleFit:{coverage:75}},
 {player:{},valuation:null,roleFit:{coverage:0}}];
 assert.equal(filterScoutingCandidates(items,{season:"2025/2026",maxAge:30,maxValueM:10,minimumCoverage:50}).length,1);
 assert.equal(filterScoutingCandidates(items,{season:"2025/2026",maxValueM:5}).length,0);
 assert.equal(filterScoutingCandidates(items,{season:"2025/2026"}).length,2);
});
