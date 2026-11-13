import test from "node:test";
import assert from "node:assert/strict";
import { archiveFmCloudSave, fmSaveRecordKey, listFmCloudSaves, openFmCloudSave, validateFmCloudParts, FM_SAVE_CHUNK_BYTES } from "../src/utils/fmCloudSaves.mjs";

const admin = { id: "user-1", role: "admin" };
const other = { id: "user-2", role: "admin" };

function mockBase44() {
  const saves = [];
  const blobs = new Map();
  let uploads = 0;
  let updates = 0;
  const sdk = {
    entities: {
      FmSaveCloudArchive: {
        filter: async criteria => saves.filter(row => Object.entries(criteria).every(([k, v]) => row[k] === v)),
        create: async row => { const saved = { ...row, id: String(saves.length + 1) }; saves.push(saved); return { ...saved }; },
        update: async (id, values) => {
          updates++;
          const row = saves.find(item => item.id === id);
          Object.assign(row, values);
          return { ...row };
        }
      }
    },
    integrations: {
      Core: {
        UploadPrivateFile: async ({ file }) => {
          const file_uri = "private/user-1/chunk-" + ++uploads;
          blobs.set(file_uri, file);
          return { file_uri };
        },
        CreateFileSignedUrl: async ({ file_uri }) => ({ signed_url: "https://blob.example/" + file_uri })
      }
    }
  };
  return { sdk, saves, blobs, get uploads() { return uploads; }, get updates() { return updates; } };
}

test("FM26 y FM27 tienen claves separadas y no admiten archivos ajenos", () => {
  const file = new File(["abc"], "Miguel Núñez.fm", { lastModified: 123 });
  assert.notEqual(fmSaveRecordKey(file, "FM26"), fmSaveRecordKey(file, "FM27"));
  assert.throws(() => fmSaveRecordKey(new File(["x"], "save.zip"), "FM26"));
});

test("rechaza fragmentos alterados y evita abrir archivos incompletos", () => {
  const archive = { game: "FM27", filename: "a.fm", size_bytes: 2, part_count: 1, parts: [] };
  assert.equal(validateFmCloudParts(archive), 1);
  archive.parts = [{ index: 0, file_uri: "public/exposed", size_bytes: 2 }];
  assert.throws(() => validateFmCloudParts(archive), /fragmentos/);
});

test("sube a storage privado, reanuda y reconstruye exactamente la partida", async () => {
  const mock = mockBase44();
  const payload = new Uint8Array(FM_SAVE_CHUNK_BYTES + 19);
  payload.fill(97);
  payload[FM_SAVE_CHUNK_BYTES] = 42;
  const file = new File([payload], "Miguel Núñez.fm", { lastModified: 456 });
  const meta = { game: "FM27", build: "27.0.1", players_count: 128886 };
  const saved = await archiveFmCloudSave(mock.sdk, file, meta, admin);
  assert.equal(saved.entry.status, "ready");
  assert.equal(saved.entry.parts.length, 2);
  assert.equal(mock.uploads, 2);
  assert.equal(mock.saves[0].owner_user_id, admin.id);
  const again = await archiveFmCloudSave(mock.sdk, file, meta, admin);
  assert.equal(again.alreadySaved, true);
  assert.equal(mock.uploads, 2);

  const previousFetch = global.fetch;
  global.fetch = async url => {
    const key = decodeURI(new URL(url).pathname.slice(1));
    const stored = mock.blobs.get(key);
    return { ok: Boolean(stored), status: stored ? 200 : 404, blob: async () => stored };
  };
  try {
    const restored = await openFmCloudSave(mock.sdk, saved.entry);
    assert.equal(restored.name, file.name);
    assert.deepEqual(new Uint8Array(await restored.arrayBuffer()), payload);
  } finally {
    global.fetch = previousFetch;
  }

  assert.equal((await listFmCloudSaves(mock.sdk, admin)).length, 1);
  assert.equal((await listFmCloudSaves(mock.sdk, other)).length, 0);
  assert.equal((await listFmCloudSaves(mock.sdk, { id: "guest", role: "user" })).length, 0);
});

test("reanuda los fragmentos confirmados tras una interrupción sin sobrescribir datos", async () => {
  const mock = mockBase44();
  const file = new File([new Uint8Array(FM_SAVE_CHUNK_BYTES + 1)], "test.fm", { lastModified: 789 });
  let calls = 0;
  const original = mock.sdk.integrations.Core.UploadPrivateFile;
  mock.sdk.integrations.Core.UploadPrivateFile = async params => {
    calls++;
    if (calls === 2) throw new Error("Interrupción simulada");
    return original(params);
  };
  await assert.rejects(archiveFmCloudSave(mock.sdk, file, { game: "FM26" }, admin), /Interrupción/);
  assert.equal(mock.saves[0].status, "uploading");
  assert.equal(mock.saves[0].parts.length, 1);
  mock.sdk.integrations.Core.UploadPrivateFile = original;
  const resumed = await archiveFmCloudSave(mock.sdk, file, { game: "FM26" }, admin);
  assert.equal(resumed.entry.status, "ready");
  assert.equal(mock.uploads, 2);
  assert.equal(mock.saves.length, 1);
});
