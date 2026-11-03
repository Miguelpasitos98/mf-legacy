import test from 'node:test';
import assert from 'node:assert/strict';
import {applyVerifiedHistoricals as worker} from '../base44/functions/import-worker/reviewAuto.js';
import {applyVerifiedHistoricals as manual} from '../base44/functions/import-review/reviewAuto.js';
test('Los dos endpoints ejecutan el mismo revisor compartido',()=>assert.equal(worker,manual));
