import test from "node:test";
import assert from "node:assert/strict";
import {rateLimitDetails} from "../src/utils/importRateLimit.js";
import {readFileSync} from "node:fs";
test("Base44 Retry-After is extracted and gives quota margin",()=>{
 const details=rateLimitDetails(new Error("Rate limit exceeded: entity_list allows 140 requests per 60s for each caller. Retry after 27s."));
 assert.ok(details);assert.equal(details.seconds,31);
 assert.match(details.message,/Base44/);
});
test("HTTP 429 without explicit delay defaults to safe 64s cooldown",()=>{
 const details=rateLimitDetails({response:{status:429}});
 assert.equal(details.seconds,64);
});
test("ordinary provider failure is not treated as rate limiting",()=>{
 assert.equal(rateLimitDetails(new Error("No se pudo consultar Understat")),null);
});
test("Understat appears only in right column after player selection",()=>{
 const file=readFileSync(new URL("../src/pages/ImportCenter.jsx",import.meta.url),"utf8");
 const marker=file.indexOf('data-understat-right-panel');
 const firstClose=file.indexOf('</section>',file.indexOf('id="import-player-selector"'));
 assert.ok(marker>firstClose,"Historical Understat panel must follow the player selection column");
 assert.ok(!file.includes("Protección de las estadísticas"));
 assert.equal((file.match(/<UnderstatMissingImport/g)||[]).length,1);
});
