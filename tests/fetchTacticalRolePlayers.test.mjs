import test from "node:test";
import assert from "node:assert/strict";
import { fetchTacticalRolePlayers } from "../src/utils/fetchTacticalRolePlayers.mjs";

test("consultas solamente por IDs solicitados en lotes pequeños", async () => {
  const calls = [];
  const entity = {
    async filter(query, order, limit) {
      calls.push({ query, order, limit });
      return query.fm26_uid.$in.map(fm26_uid => ({ id: "base44-" + fm26_uid, fm26_uid }));
    },
  };
  const entries = ["1","2","3","4","5"].map(id => ({ id }));
  const rows = await fetchTacticalRolePlayers(entity, entries, { batchSize: 2 });
  assert.equal(rows.length, 5);
  assert.equal(calls.length, 3);
  assert.deepEqual(calls[0].query, { fm26_uid: { $in: ["1", "2"] } });
  assert.equal(calls[0].limit, 200);
});

test("conserva duplicados reales de la base para que el plan los bloquee", async () => {
  const entity = { async filter() { return [
    { id: "db1", fm26_uid: "123" },
    { id: "db2", fm26_uid: "123" },
  ]; } };
  const rows = await fetchTacticalRolePlayers(entity, [{ id: "123" }]);
  assert.equal(rows.length, 2);
});

test("rechaza una consulta ignorada, un resultado incompleto o una respuesta no tabular", async () => {
  const wrong = { async filter() { return [{ id: "x", fm26_uid: "otro" }]; } };
  const truncated = { async filter() { return { items: [], has_more: true }; } };
  const empty = { async filter() { return {}; } };
  await assert.rejects(fetchTacticalRolePlayers(wrong,[{id:"1"}]), /no respetó el filtro/);
  await assert.rejects(fetchTacticalRolePlayers(truncated,[{id:"1"}]), /lote incompleto/);
  await assert.rejects(fetchTacticalRolePlayers(empty,[{id:"1"}]), /respuesta inválida/);
});

test("ignora registros sin UID para evitar coincidencias por nombres", async () => {
  let called = false;
  const entity = { async filter() { called = true; return []; } };
  const players = await fetchTacticalRolePlayers(entity, [{ id: "" },{ id: "no-id" }]);
  assert.deepEqual(players, []);
  assert.equal(called, false);
});

test("consulta perfiles históricos por ID de Base44 sin hacer búsquedas por nombres", async () => {
  const id="6af30b6f584b3537cdf15e5b";
  const calls=[];
  const entity={async get(got){calls.push(got);return {id:got,name:"Eden Hazard",fm26_uid:null}}};
  const rows=await fetchTacticalRolePlayers(entity,[{id,matchingKey:"base44_player_id"}]);
  assert.equal(rows.length,1);
  assert.deepEqual(calls,[id]);
  assert.equal(rows[0].name,"Eden Hazard");
});

test("aborta la lectura si Base44 devuelve un ID distinto", async () => {
  const id="6af30b6f584b3537cdf15e5b";
  const entity={async get(){return {id:"6af31204bd003a0d9988b414",name:"Gareth Bale"}}};
  await assert.rejects(fetchTacticalRolePlayers(entity,[{id,matchingKey:"base44_player_id"}]),/detenida por seguridad/);
});
