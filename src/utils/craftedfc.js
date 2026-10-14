// Utilidades para leer snapshots de CraftedFC (ExternalFootballSnapshot) vinculados
// a jugadores de Base44. Usa base44_entity_id confirmado; nunca asocia por nombre.
import { base44 } from "@/api/base44Client";

export const CFC_ARCHETYPES = ["GK", "CB", "FB", "WB", "CM", "CAM", "W", "ST"];

// Columnas opcionales de CraftedFC para las tablas de STATS.
// Son datos globales de la captura, no históricos por temporada.
export const CFC_COLUMNS = [
  { id: "cfc_rating", name: "CFC Rating", decimals: 1 },
  { id: "cfc_rank", name: "CFC World Rank", decimals: 0 },
  { id: "cfc_archetype", name: "Archetype", decimals: null },
  { id: "cfc_team_strength", name: "Team Strength", decimals: 1 },
  { id: "cfc_league_strength", name: "League Strength", decimals: 1 },
  { id: "cfc_raw_score", name: "Raw Score", decimals: 2 },
  { id: "cfc_source", name: "Fuente", decimals: null },
  { id: "cfc_snapshot_date", name: "Fecha snapshot", decimals: null },
];

// Caché en memoria por playerId -> snapshot|null. Evita consultas repetidas al
// abrir y cerrar el mismo modal o cambiar de pestaña dentro de STATS.
const cache = new Map();

const unpack = (r) => (Array.isArray(r) ? r : r?.items || r?.data || []);

// Devuelve el snapshot más reciente de CraftedFC para un jugador de Base44.
export const fetchCraftedfcSnapshot = async (playerId, { force = false } = {}) => {
  const key = String(playerId || "");
  if (!key) return null;
  if (!force && cache.has(key)) return cache.get(key);
  try {
    const r = await base44.entities.ExternalFootballSnapshot.filter(
      { base44_entity_id: key, kind: "player", source: "CraftedFC" },
      { sort: "-snapshot_date", limit: 1 }
    );
    const snap = unpack(r)[0] || null;
    cache.set(key, snap);
    return snap;
  } catch {
    cache.set(key, null);
    return null;
  }
};

// Limpia la caché de un jugador (o toda si no se pasa id).
export const clearCraftedfcCache = (playerId) => {
  if (playerId) cache.delete(String(playerId));
  else cache.clear();
};

// Acceso seguro a campos anidados del payload.
export const payloadField = (snapshot, ...path) => {
  let v = snapshot?.payload;
  for (const p of path) {
    if (v && typeof v === "object" && p in v) v = v[p];
    else return undefined;
  }
  return v;
};

// Carga masiva paginada de snapshots para pobrar la caché de la tabla principal.
// Devuelve un Map playerId -> snapshot. Solo consulta los IDs no cacheados.
export const fetchCraftedfcBatch = async (playerIds, { force = false } = {}) => {
  const result = new Map();
  const ids = [...new Set((playerIds || []).map(String).filter(Boolean))];
  if (!ids.length) return result;
  for (const id of ids) result.set(id, cache.get(id) ?? null);
  const missing = force ? ids : ids.filter((id) => !cache.has(id));
  if (!missing.length) return result;
  try {
    const r = await base44.entities.ExternalFootballSnapshot.filter(
      { base44_entity_id: { $in: missing }, kind: "player", source: "CraftedFC" },
      { sort: "-snapshot_date", limit: 500 }
    );
    for (const snap of unpack(r)) {
      const pid = String(snap.base44_entity_id || "");
      if (pid && !result.has(pid)) {
        cache.set(pid, snap);
        result.set(pid, snap);
      }
    }
    for (const id of missing) {
      if (!result.has(id)) {
        cache.set(id, null);
        result.set(id, null);
      }
    }
  } catch {
    // Cachea null para no reintentar en cada render.
    for (const id of missing) {
      cache.set(id, null);
      result.set(id, null);
    }
  }
  return result;
};

// Valor de una columna CFC_* para un snapshot dado.
export const cfcColumnValue = (snapshot, columnId) => {
  if (!snapshot) return null;
  switch (columnId) {
    case "cfc_rating":
      return snapshot.rating ?? null;
    case "cfc_rank":
      return snapshot.rank ?? null;
    case "cfc_archetype":
      return snapshot.archetype || payloadField(snapshot, "primary_archetype") || null;
    case "cfc_team_strength":
      return snapshot.team_strength ?? null;
    case "cfc_league_strength":
      return snapshot.league_strength ?? null;
    case "cfc_raw_score":
      return snapshot.raw_score ?? payloadField(snapshot, "score") ?? null;
    case "cfc_source":
      return snapshot.source || "CraftedFC";
    case "cfc_snapshot_date":
      return snapshot.snapshot_date || null;
    default:
      return null;
  }
};