import test from "node:test";
import assert from "node:assert/strict";
import { planHistoricalActions } from "../src/utils/historicalBatch.js";

test("53 PJ Equipo nuevos se agrupan en seis peticiones, no 53", () => {
  const queue = Array.from({ length: 53 }, (_, i) => ({ id: `t${i}`, type: "team", status: "new" }));
  const actions = planHistoricalActions(queue);
  assert.equal(actions.length, 6);
  assert.deepEqual(actions.map(a => a.items.length), [10, 10, 10, 10, 10, 3]);
  assert.ok(actions.every(a => a.action === "create" && a.type === "team"));
});

test("altas de valoraciones y PJ Equipo nunca se mezclan en una llamada", () => {
  const queue = [
    ...Array.from({ length: 12 }, (_, i) => ({ id: `v${i}`, type: "valuation", status: "new" })),
    ...Array.from({ length: 3 }, (_, i) => ({ id: `t${i}`, type: "team", status: "new" })),
  ];
  const actions = planHistoricalActions(queue);
  assert.deepEqual(actions.map(a => [a.type, a.items.length]), [["valuation", 10], ["valuation", 2], ["team", 3]]);
});

test("ediciones de registros existentes se guardan individualmente", () => {
  const queue = [
    { type: "team", status: "new" },
    { type: "team", status: "update" },
    { type: "valuation", status: "update" },
  ];
  const actions = planHistoricalActions(queue);
  assert.deepEqual(actions.map(a => a.action), ["create", "update", "update"]);
  assert.ok(actions.slice(1).every(a => a.items.length === 1));
});
