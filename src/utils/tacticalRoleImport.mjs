// MF LEGACY — importador seguro de los dos roles tácticos por ID FM26.
// Solo prepara cambios en tactical_roles y description; nunca crea jugadores.
export const ROLE_IMPORT_FORMAT = "mf_legacy_tactical_roles_review_v1";

const asText = value => typeof value === "string" ? value.trim() : "";
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export const roleWithoutIcon = value => asText(value).replace(/^[^\p{L}\p{N}]+/u, "").trim().toLocaleLowerCase("es");
const uid = value => {
  if (typeof value === "number" && !Number.isSafeInteger(value)) return "";
  const result = String(value ?? "").trim();
  return /^\d{1,20}$/.test(result) ? result : "";
};

export function parseTacticalRoleImport(document, allowedRoles) {
  if (!document || typeof document !== "object" || Array.isArray(document) || document.format !== ROLE_IMPORT_FORMAT) {
    throw Error("Formato no compatible. Se requiere un JSON mf_legacy_tactical_roles_review_v1.");
  }
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
    const id = uid(row?.fm26_uid);
    const name = asText(row?.name);
    const rawRoles = row?.tactical_roles;
    const errors = [];
    if (!id) errors.push("ID FM26 ausente o incorrecto");
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
    return { id, name: name || "(sin nombre)", index, roles, errors, confidence: asText(row?.confidence), evidence: asText(row?.support_fm26) };
  });
  const counts = new Map();
  for (const row of entries) if (row.id) counts.set(row.id, (counts.get(row.id) || 0) + 1);
  for (const row of entries) if (row.id && counts.get(row.id) > 1) row.errors.push("ID FM26 repetido en el archivo");
  return {
    filenameTeam: asText(document.team_name),
    format: document.format,
    entries,
    warnings: Number.isInteger(document.players_count) && document.players_count !== entries.length
      ? ["El contador players_count difiere del número de jugadores reales del archivo."] : [],
  };
}

export function buildTacticalRoleImportPlan(entries, players, { overwrite = false } = {}) {
  const byUid = new Map();
  for (const player of players || []) {
    const key = uid(player?.fm26_uid);
    if (!key) continue;
    if (!byUid.has(key)) byUid.set(key, []);
    byUid.get(key).push(player);
  }
  return entries.map(entry => {
    const matches = byUid.get(entry.id) || [];
    const player = matches.length === 1 ? matches[0] : null;
    if (entry.errors.length) return { ...entry, status: "invalid", reason: entry.errors.join("; "), player: null };
    if (!matches.length) return { ...entry, status: "unmatched", reason: "No hay jugador con ese FM26 UID", player: null };
    if (matches.length > 1) return { ...entry, status: "ambiguous", reason: "Hay varios jugadores con el mismo FM26 UID", player: null };
    if (!player.id && !player._id) return { ...entry, status: "invalid", reason: "Registro sin ID Base44", player: null };
    const existing = Array.isArray(player.tactical_roles) ? player.tactical_roles : [];
    const current = [0, 1].map(i => ({
      name: asText(existing[i]?.name) || (i === 0 ? asText(player.description) : ""),
      description: asText(existing[i]?.description),
    }));
    const identical = same(current, entry.roles) && asText(player.description) === entry.roles[0].name;
    const occupied = current.some(item => item.name || item.description);
    const reason = asText(player.name) !== entry.name ? "Nombre distinto: comprobar identidad por FM26 UID" : "";
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
