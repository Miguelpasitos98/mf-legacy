// Remember references to local .fm files, never their large contents.
// FileSystemFileHandle is structured-cloneable into IndexedDB in supporting browsers.
const DATABASE = "mf-legacy-fm-local-saves";
const STORE = "file-handles";
const VERSION = 1;

export const sortRememberedFmSaves = entries => [...entries].sort((a, b) =>
  (Number(b.lastOpened) || 0) - (Number(a.lastOpened) || 0));

function openDatabase() {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("Este navegador no admite IndexedDB."));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("No se pudo abrir el historial local."));
  });
}

async function transaction(mode, execute) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    let result;
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    try {
      execute(store, value => { result = value; });
    } catch (error) {
      db.close(); reject(error); return;
    }
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onerror = () => { db.close(); reject(tx.error || new Error("No se pudo guardar la partida.")); };
    tx.onabort = () => { db.close(); reject(tx.error || new Error("Se canceló el guardado local.")); };
  });
}

export async function listRememberedFmSaves() {
  const rows = await transaction("readonly", (store, finish) => {
    const request = store.getAll();
    request.onsuccess = () => finish(request.result || []);
  });
  return sortRememberedFmSaves(rows);
}

export async function rememberFmSaveHandle(handle) {
  if (!handle || handle.kind !== "file" || !/\.fm$/i.test(handle.name)) throw new Error("Solo puedes recordar archivos .fm.");
  const previous = await listRememberedFmSaves();
  let existing = null;
  for (const saved of previous) {
    if (typeof handle.isSameEntry === "function" && await handle.isSameEntry(saved.handle)) {
      existing = saved;
      break;
    }
  }
  const now = Date.now();
  const id = existing?.id || globalThis.crypto?.randomUUID?.() || `fm-${now}-${Math.random().toString(36).slice(2)}`;
  await transaction("readwrite", store => store.put({
    id, name: handle.name, handle, lastOpened: now, addedAt: existing?.addedAt || now
  }));
  return id;
}

export async function touchRememberedFmSave(id) {
  await transaction("readwrite", store => {
    const request = store.get(id);
    request.onsuccess = () => {
      if (request.result) store.put({ ...request.result, lastOpened: Date.now() });
    };
  });
}

export async function forgetRememberedFmSave(id) {
  await transaction("readwrite", store => store.delete(id));
}

export async function getRememberedFmFile(entry, { interactive = false } = {}) {
  const handle = entry?.handle;
  if (!handle || typeof handle.getFile !== "function") throw new Error("El acceso recordado ya no está disponible. Selecciona de nuevo la partida.");
  let permission = typeof handle.queryPermission === "function"
    ? await handle.queryPermission({ mode: "read" }) : "prompt";
  if (permission !== "granted" && interactive && typeof handle.requestPermission === "function") {
    permission = await handle.requestPermission({ mode: "read" });
  }
  if (permission !== "granted") {
    const error = new Error("Chrome necesita permiso para volver a leer esta partida. Pulsa «Abrir» junto a su nombre.");
    error.code = "FM_PERMISSION_REQUIRED";
    throw error;
  }
  const file = await handle.getFile();
  if (!/\.fm$/i.test(file.name)) throw new Error("El archivo recordado ya no es una partida .fm.");
  return file;
}
