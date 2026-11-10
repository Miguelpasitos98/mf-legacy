// Busca únicamente los jugadores citados en el JSON. Evita cargar toda la base
// de MF LEGACY (fotos, historial, estadísticas y cientos de fichas innecesarias).
const normalizeUid = input => String(input ?? "").trim();
const normalizeBase44Id = input => String(input ?? "").trim().toLowerCase();
const rowsFromResponse = response => Array.isArray(response) ? response
  : response?.items || response?.data || response?.entities || response?.results || null;
const chunk = (list, size) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size));

export async function fetchTacticalRolePlayers(entity, entries, { batchSize = 25 } = {}) {
  const ids = [...new Set((entries || []).filter(e => e?.matchingKey !== "base44_player_id").map(e => normalizeUid(e?.id)).filter(x => /^\d{1,20}$/.test(x)))];
  const base44Ids = [...new Set((entries || []).filter(e => e?.matchingKey === "base44_player_id").map(e => normalizeBase44Id(e?.id)).filter(x => /^[0-9a-f]{24}$/.test(x)))];
  if (!ids.length && !base44Ids.length) return [];
  const records = [];
  const allowed = new Set(ids);
  for (const batch of chunk(ids, batchSize)) {
    // API filter soporta $in; el parámetro limit evita los 50 resultados por defecto.
    // Lotes pequeños para que una respuesta completa quepa de forma fiable.
    const response = await entity.filter({ fm26_uid: { $in: batch } }, undefined, 200);
    const rows = rowsFromResponse(response);
    if (!Array.isArray(rows)) throw Error("La búsqueda de jugadores devolvió una respuesta inválida.");
    if (rows.length >= 200 || response?.has_more === true || response?.next_cursor) {
      throw Error("La búsqueda devolvió un lote incompleto. No se aplicarán roles sin verificar todos los IDs.");
    }
    if (rows.some(row => !allowed.has(normalizeUid(row?.fm26_uid)))) {
      throw Error("La búsqueda no respetó el filtro de FM26 UID. Importación detenida por seguridad.");
    }
    records.push(...rows);
  }
  // El ID interno se obtiene con Player.get(id): no depende de coincidencias por nombre
  // ni de filtros que puedan confundir jugadores sin fm26_uid.
  for (const id of base44Ids) {
    let record;
    try {
      record = await entity.get(id);
    } catch (error) {
      const status = error?.status || error?.response?.status || error?.response?.data?.status;
      if (status === 404) continue;
      throw error;
    }
    if (!record) continue;
    if (normalizeBase44Id(record.id || record._id) !== id) {
      throw Error("La consulta por ID interno devolvió otra ficha. Importación detenida por seguridad.");
    }
    records.push(record);
  }
  return records;
}
