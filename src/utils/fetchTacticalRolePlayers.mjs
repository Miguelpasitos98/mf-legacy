// Busca únicamente los jugadores citados en el JSON. Evita cargar toda la base
// de MF LEGACY (fotos, historial, estadísticas y cientos de fichas innecesarias).
const normalizeUid = input => String(input ?? "").trim();
const rowsFromResponse = response => Array.isArray(response) ? response
  : response?.items || response?.data || response?.entities || response?.results || null;
const chunk = (list, size) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size));

export async function fetchTacticalRolePlayers(entity, entries, { batchSize = 25 } = {}) {
  const ids = [...new Set((entries || []).map(e => normalizeUid(e?.id)).filter(x => /^\d{1,20}$/.test(x)))];
  if (!ids.length) return [];
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
  return records;
}
