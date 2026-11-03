import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {trophyHistoricalSummary} from "../src/utils/trophyHistoricalSummary.js";
import {trophyDetailSummary,trophyClubRanking} from "../src/utils/trophyDetailData.js";

const finals=JSON.parse(fs.readFileSync(new URL("../scripts/rob_ucl_1955_2023_finals.json",import.meta.url),"utf8"));
const events=JSON.parse(fs.readFileSync(new URL("../scripts/rob_ucl_historical_events.json",import.meta.url),"utf8"));

test("Champions archive is shown as 68 final editions and 29 historical events",()=>{
 const summary=trophyHistoricalSummary(finals,events);
 assert.equal(summary.editionCount,68);
 assert.equal(summary.clubCount,23);
 assert.equal(summary.eventCount,29);
 assert.equal(summary.earliest,"1955/56");
 assert.equal(summary.newest,"2022/23");
 assert.deepEqual(summary.recentFinals.map(row=>row.season),["2022/23","2021/22","2020/21","2019/20"]);
 assert.equal(summary.ranking.find(row=>row.name==="Real Madrid")?.count,14);
 assert.equal(summary.ranking.find(row=>row.name==="AC Milan")?.count,7);
 assert.equal(summary.ranking.find(row=>row.name==="FC Barcelona")?.count,5);
});

test("Duplicate rows must not double count historical winners",()=>{
 const summary=trophyHistoricalSummary([...finals,finals[0],finals[0]], [...events,events[0]]);
 assert.equal(summary.editionCount,68);
 assert.equal(summary.eventCount,29);
 assert.equal(summary.ranking.reduce((sum,row)=>sum+row.count,0),68);
});

test("Historical data does not create verified TrophyHonour claims",()=>{
 assert.equal(trophyDetailSummary([]).verifiedCount,0);
 assert.equal(trophyClubRanking([]).length,0);
 const projected=trophyHistoricalSummary(finals,events);
 assert.equal(projected.editionCount,68);
 const ui=fs.readFileSync(new URL("../src/components/trophies/TrophyDetailVisual.jsx",import.meta.url),"utf8");
 assert.match(ui,/Finales documentadas/);
 assert.match(ui,/Clubes campeones · Rob/);
 assert.match(ui,/Palmarés contrastado de MF LEGACY/);
 assert.match(ui,/Finales extraídas de Rob/);
 assert.match(ui,/Clasificación provisional según Rob/);
 assert.match(ui,/Los datos procedentes de Rob/);
});
