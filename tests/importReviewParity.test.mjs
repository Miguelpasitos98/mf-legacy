import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('Los dos endpoints de importación usan el mismo revisor y aplican recuperaciones históricas idénticas',()=>{
 const worker=readFileSync(new URL('../base44/functions/import-worker/reviewAuto.js',import.meta.url),'utf8');
 const manual=readFileSync(new URL('../base44/functions/import-review/reviewAuto.js',import.meta.url),'utf8');
 assert.equal(manual,worker);
 assert.match(worker,/FotMob minutes/);
 assert.match(worker,/x\.review_status==="pending"/);
});
