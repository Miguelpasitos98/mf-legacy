// Las partidas FM se guardan como fragmentos privados de Base44. No se guardan
// datos binarios en entidades ni se publica ninguna URL permanente.
export const FM_SAVE_CHUNK_BYTES = 8 * 1024 * 1024;
export const FM_SAVE_MAX_BYTES = 1024 * 1024 * 1024;

const rows = value => Array.isArray(value) ? value : value?.items || value?.data || value?.entities || value?.results || [];
const validGame = game => game === "FM26" || game === "FM27";

export function fmSaveRecordKey(file, game) {
  if (!validGame(game) || !file || !/\.fm$/i.test(file.name || "")) throw new Error("Solo se admiten partidas FM26 o FM27 con extensión .fm.");
  return [game, file.name.toLowerCase(), file.size, Number(file.lastModified || 0)].join("|");
}

export function validateFmCloudParts(entry) {
  const count = Math.ceil(Number(entry?.size_bytes) / FM_SAVE_CHUNK_BYTES);
  if (!validGame(entry?.game) || !/\.fm$/i.test(entry?.filename || "") || !Number.isFinite(entry?.size_bytes)
    || entry.size_bytes <= 0 || entry.size_bytes > FM_SAVE_MAX_BYTES || !Array.isArray(entry.parts)
    || count !== entry.part_count || count > Math.ceil(FM_SAVE_MAX_BYTES / FM_SAVE_CHUNK_BYTES)) {
    throw new Error("El registro de la partida no es válido o supera el límite de 1 GB.");
  }
  for (let i = 0; i < entry.parts.length; i++) {
    const part = entry.parts[i];
    const expected = Math.min(FM_SAVE_CHUNK_BYTES, entry.size_bytes - i * FM_SAVE_CHUNK_BYTES);
    if (part?.index !== i || typeof part.file_uri !== "string" || !part.file_uri.startsWith("private/")
      || part.size_bytes !== expected) {
      throw new Error("Los fragmentos de la partida no coinciden con su registro. No se abrirá un archivo incompleto.");
    }
  }
  if (entry.parts.length > count) throw new Error("La partida contiene fragmentos adicionales no esperados.");
  return count;
}

export async function listFmCloudSaves(base44, user) {
  if (!user?.id || user.role !== "admin") return [];
  return rows(await base44.entities.FmSaveCloudArchive.filter({ owner_user_id: String(user.id) }))
    .filter(entry => entry?.owner_user_id === String(user.id))
    .sort((a, b) => String(b.uploaded_at || b.created_date || "").localeCompare(String(a.uploaded_at || a.created_date || "")));
}

export async function archiveFmCloudSave(base44, file, meta, user, onProgress = () => {}) {
  if (!user?.id || user.role !== "admin") throw new Error("Solo los administradores pueden almacenar partidas privadas.");
  const key = fmSaveRecordKey(file, meta?.game);
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > FM_SAVE_MAX_BYTES) throw new Error("La partida está vacía o supera 1 GB; no se ha subido.");
  const entity = base44.entities.FmSaveCloudArchive;
  const existing = rows(await entity.filter({ record_key: key, owner_user_id: String(user.id) }));
  if (existing.length > 1) throw new Error("Se encontraron registros duplicados. Revisa la biblioteca antes de guardar.");
  const total = Math.ceil(file.size / FM_SAVE_CHUNK_BYTES);
  let entry = existing[0];
  if (entry?.status === "ready") {
    if (validateFmCloudParts(entry) !== entry.parts.length) throw new Error("La partida guardada está incompleta.");
    onProgress("La partida ya estaba guardada", total, total);
    return { entry, alreadySaved: true };
  }
  if (!entry) {
    entry = await entity.create({
      record_key: key, filename: file.name, size_bytes: file.size,
      last_modified: Number(file.lastModified || 0), game: meta.game,
      build: String(meta.build || ""), in_game_date: String(meta.date || ""),
      fmsave_version: String(meta.fmsave || ""), players_count: Number(meta.players_count || 0),
      parts: [], part_count: total, status: "uploading",
      owner_user_id: String(user.id), uploaded_at: new Date().toISOString()
    });
  }
  validateFmCloudParts(entry);
  let parts = [...entry.parts];
  onProgress("Guardando en la nube", parts.length, total);
  for (let i = parts.length; i < total; i++) {
    const start = i * FM_SAVE_CHUNK_BYTES;
    const end = Math.min(start + FM_SAVE_CHUNK_BYTES, file.size);
    const chunk = new File([file.slice(start, end)], `${file.name}.part-${String(i + 1).padStart(4, "0")}.bin`, {
      type: "application/octet-stream"
    });
    const uploaded = await base44.integrations.Core.UploadPrivateFile({ file: chunk });
    if (!uploaded?.file_uri?.startsWith("private/")) throw new Error(`No se pudo guardar el fragmento ${i + 1}. Puedes reintentar sin perder los fragmentos anteriores.`);
    parts.push({ index: i, file_uri: uploaded.file_uri, size_bytes: end - start });
    // Confirmar cada fragmento permite retomar una subida interrumpida sin duplicar el resto.
    entry = await entity.update(entry.id, { parts });
    onProgress("Guardando en la nube", i + 1, total);
  }
  entry = await entity.update(entry.id, { status: "ready", uploaded_at: new Date().toISOString() });
  onProgress("Partida guardada", total, total);
  return { entry, alreadySaved: false };
}

export async function openFmCloudSave(base44, entry, onProgress = () => {}) {
  const total = validateFmCloudParts(entry);
  if (entry.status !== "ready" || entry.parts.length !== total) throw new Error("Esta partida aún no ha terminado de subirse.");
  const blobs = [];
  let received = 0;
  for (let i = 0; i < total; i++) {
    const part = entry.parts[i];
    const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: part.file_uri, expires_in: 300 });
    if (!signed_url) throw new Error(`No se pudo autorizar el acceso privado al fragmento ${i + 1}.`);
    const response = await fetch(signed_url);
    if (!response.ok) throw new Error(`Error al descargar el fragmento ${i + 1} (HTTP ${response.status}).`);
    const blob = await response.blob();
    if (blob.size !== part.size_bytes) throw new Error(`El fragmento ${i + 1} tiene un tamaño inesperado. No se abrirá la partida.`);
    received += blob.size;
    blobs.push(blob);
    onProgress("Recuperando partida de la nube", i + 1, total);
  }
  if (received !== entry.size_bytes) throw new Error("La descarga está incompleta.");
  return new File(blobs, entry.filename, { type: "application/octet-stream", lastModified: Number(entry.last_modified || Date.now()) });
}
