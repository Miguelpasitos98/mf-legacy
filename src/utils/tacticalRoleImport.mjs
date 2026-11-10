// MF LEGACY — importador seguro de roles por ID FM26 o ID interno Base44.
// Solo prepara cambios en tactical_roles y description; nunca crea jugadores.
export const ROLE_IMPORT_FORMAT = "mf_legacy_tactical_roles_review_v1";
export const ROLE_BASE44_REVIEW_FORMAT = "mf_legacy_tactical_roles_base44_review_v1";

const asText = value => typeof value === "string" ? value.trim() : "";
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export const roleWithoutIcon = value => asText(value).replace(/^[^\p{L}\p{N}]+/u, "").trim().toLocaleLowerCase("es");
const uid = value => {
  if (typeof value === "number" && !Number.isSafeInteger(value)) return "";
  const result = String(value ?? "").trim();
  return /^\d{1,20}$/.test(result) ? result : "";
};
const base44Id = value => {
  const result = asText(value).toLowerCase();
  return /^[0-9a-f]{24}$/.test(result) ? result : "";
};

export function parseTacticalRoleImport(document, allowedRoles) {
  const isBase44Review = document?.format === ROLE_BASE44_REVIEW_FORMAT;
  if (!document || typeof document !== "object" || Array.isArray(document) || ![ROLE_IMPORT_FORMAT, ROLE_BASE44_REVIEW_FORMAT].includes(document.format)) {
    throw Error("Formato no compatible. Se requiere un JSON mf_legacy_tactical_roles_review_v1 o mf_legacy_tactical_roles_base44_review_v1.");
  }
  if (document.matching_key && !["fm26_uid", "base44_player_id"].includes(document.matching_key)) {
    throw Error("matching_key no reconocido. Solo se admite fm26_uid o base44_player_id.");
  }
  if (isBase44Review && document.matching_key && document.matching_key !== "base44_player_id") {
    throw Error("El formato de revisión Base44 requiere matching_key: base44_player_id.");
  }
  const matchingKey = isBase44Review || document.matching_key === "base44_player_id" ? "base44_player_id" : "fm26_uid";
  if (!Array.isArray(document.players) || !document.players.length || document.players.length > 10000) {
    throw Error("El JSON debe contener entre 1 y 10.000 jugadores dentro de players.");
  }
  const exact = new Set(allowedRoles);
  const canonical = new Map();
  for (const original of allowedRoles) {
    const key = roleWithoutIcon(original);
    canonical.set(key, [...(canonical.get(key) || []), original]);
  }
  const entries = document.players.map((row, index) => {
    const id = matchingKey === "base44_player_id" ? base44Id(row?.base44_player_id) : uid(row?.fm26_uid);
    const name = asText(row?.name);
    const rawRoles = row?.tactical_roles;
    const errors = [];
    if (!id) errors.push(matchingKey === "base44_player_id" ? "ID interno Base44 ausente o incorrecto (24 caracteres hexadecimales)" : "ID FM26 ausente o incorrecto");
    if (!name) errors.push("Nombre ausente");
    if (!Array.isArray(rawRoles) || rawRoles.length !== 2) errors.push("Se requieren exactamente dos roles");
    const roles = Array.isArray(rawRoles) ? rawRoles.slice(0, 2).map((role, i) => {
      const supplied = asText(role?.name);
      const alternatives = canonical.get(roleWithoutIcon(supplied)) || [];
      const matched = exact.has(supplied) ? supplied : alternatives.length === 1 ? alternatives[0] : "";
      if (!matched) errors.push("Rol " + (i + 1) + " desconocido o ambiguo: " + supplied);
      if (typeof role?.description !== "string") errors.push("Descripción " + (i + 1) + " inválida");
      return { name: matched || "", description: asText(role?.description) };
    }) : [];
    if (roles.length === 2 && roles[0].name && roles[0].name === roles[1].name) errors.push("Los dos roles deben ser diferentes");
    return { id, matchingKey, name: name || "(sin nombre)", index, roles, errors, confidence: asText(row?.confidence), evidence: asText(row?.support_fm26 || row?.support_mf_legacy) };
  });
  const counts = new Map();
  for (const row of entries) if (row.id) counts.set(row.id, (counts.get(row.id) || 0) + 1);
  for (const row of entries) if (row.id && counts.get(row.id) > 1) row.errors.push(matchingKey === "base44_player_id" ? "ID Base44 repetido en el archivo" : "ID FM26 repetido en el archivo");
  return {
    filenameTeam: asText(document.team_name),
    matchingKey,
    format: document.format,
    entries,
    warnings: Number.isInteger(document.players_count) && document.players_count !== entries.length
      ? ["El contador players_count difiere del número de jugadores reales del archivo."] : [],
  };
}

export function buildTacticalRoleImportPlan(entries, players, { overwrite = false } = {}) {
  const byUid = new Map();
  const byBase44Id = new Map();
  for (const player of players || []) {
    const key = uid(player?.fm26_uid);
    if (key) {
      if (!byUid.has(key)) byUid.set(key, []);
      byUid.get(key).push(player);
    }
    const internalId = base44Id(player?.id || player?._id);
    if (internalId) {
      if (!byBase44Id.has(internalId)) byBase44Id.set(internalId, []);
      byBase44Id.get(internalId).push(player);
    }
  }
  return entries.map(entry => {
    const internalMatch = entry.matchingKey === "base44_player_id";
    const matches = (internalMatch ? byBase44Id : byUid).get(entry.id) || [];
    const player = matches.length === 1 ? matches[0] : null;
    if (entry.errors.length) return { ...entry, status: "invalid", reason: entry.errors.join("; "), player: null };
    if (!matches.length) return { ...entry, status: "unmatched", reason: internalMatch ? "No hay jugador con ese ID interno Base44" : "No hay jugador con ese FM26 UID", player: null };
    if (matches.length > 1) return { ...entry, status: "ambiguous", reason: internalMatch ? "ID interno Base44 duplicado en la consulta" : "Hay varios jugadores con el mismo FM26 UID", player: null };
    if (!player.id && !player._id) return { ...entry, status: "invalid", reason: "Registro sin ID Base44", player: null };
    // En el modo de ID interno no se permiten nombres cambiados: impide aplicar un archivo a otra ficha.
    if (internalMatch && asText(player.name) !== entry.name) {
      return { ...entry, status: "invalid", reason: "El nombre no coincide con la ficha Base44. Revisa la identidad antes de importar.", player: null };
    }
    const existing = Array.isArray(player.tactical_roles) ? player.tactical_roles : [];
    const current = [0, 1].map(i => ({
      name: asText(existing[i]?.name) || (i === 0 ? asText(player.description) : ""),
      description: asText(existing[i]?.description),
    }));
    const identical = same(current, entry.roles) && asText(player.description) === entry.roles[0].name;
    const occupied = current.some(item => item.name || item.description);
    const reason = !internalMatch && asText(player.name) !== entry.name ? "Nombre distinto: comprobar identidad por FM26 UID" : "";
    if (identical) return { ...entry, status: "unchanged", player, reason: "Ya están aplicados los dos roles" };
    if (occupied && !overwrite) return { ...entry, status: "protected", player, reason: "Ya tiene roles asignados; activa sobrescribir para cambiarlos" };
    return { ...entry, status: "ready", player, reason };
  });
}

export function tacticalRolePatch(item) {
  if (item.status !== "ready" || !item.player?.id && !item.player?._id) throw Error("Fila no autorizada para importar");
  return {
    tactical_roles: item.roles.map(x => ({ name: x.name, description: x.description })),
    description: item.roles[0].name,
  };
}


/**
 * Only close the dialog after the entire attempted import succeeded AND
 * every JSON row was independently re-read as applied in Base44.
 * Unmatched, protected, invalid and ambiguous rows need manual review.
 */
export function canAutoCloseTacticalRoleImport({done=0,failed=0,pending=0,verifiedRows=null}={}){
  return Number.isInteger(done) && done>0 && done===pending &&
    failed===0 && Array.isArray(verifiedRows) && verifiedRows.length>0 &&
    verifiedRows.every(row=>row.status==="unchanged");
}
