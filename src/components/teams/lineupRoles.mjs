import { functionPreferences } from "../managers/managerAdvancedRoles.mjs";

// Rol base por zona del campo, con su emoji. Se usa cuando el entrenador no
// aclara una función concreta para esa posición.
const FAMILY_DEFAULT = {
  GK: { emoji: "🧤", label: "Portero" },
  CB: { emoji: "🛡️", label: "Central" },
  FB: { emoji: "⚡", label: "Lateral" },
  DM: { emoji: "⚓", label: "Mediocentro" },
  AM: { emoji: "🎨", label: "Mediapunta" },
  WG: { emoji: "🪄", label: "Extremo" },
  ST: { emoji: "🎯", label: "Delantero" },
};

// Funciones tácticas preferidas por el entrenador (mismas que Manager Fit),
// con su propio emoji para mostrarlas sobre el campo.
const FUNCTION_BADGES = {
  GK: {
    sweeper: { emoji: "🚀", label: "Portero-líbero" },
    keeper: { emoji: "🧤", label: "Portero clásico" },
  },
  CB: {
    ball_playing: { emoji: "🧠", label: "Central constructor" },
    cover: { emoji: "🧱", label: "Central de cobertura" },
  },
  FB: {
    attacking: { emoji: "🛞", label: "Lateral ofensivo" },
    inverted: { emoji: "🏗️", label: "Lateral invertido" },
  },
  DM: {
    playmaker: { emoji: "🧭", label: "Pivote organizador" },
    ball_winner: { emoji: "💥", label: "Pivote recuperador" },
  },
  AM: {
    creator: { emoji: "🎨", label: "Mediapunta creador" },
    runner: { emoji: "🎬", label: "Mediapunta llegador" },
  },
  WG: {
    inside: { emoji: "🧨", label: "Extremo interior" },
    wide: { emoji: "🪄", label: "Extremo abierto" },
  },
  ST: {
    pressing: { emoji: "🔋", label: "Delantero presionante" },
    false_nine: { emoji: "🧃", label: "Falso nueve" },
    finisher: { emoji: "🎯", label: "Delantero finalizador" },
  },
};

const baseCode = code => String(code || "").toUpperCase().replace(/_L\d+$/, "");

export function slotRoleFamily(code) {
  const value = baseCode(code);
  if (value.startsWith("GK")) return "GK";
  if (value.startsWith("CB")) return "CB";
  if (/^(LWB|RWB|LB|RB)/.test(value)) return "FB";
  if (value.startsWith("CAM")) return "AM";
  if (value.startsWith("CM") || value.startsWith("DM")) return "DM";
  if (/^(AM|LAM|RAM)/.test(value)) return "AM";
  if (/^(LW|RW|LM|RM)/.test(value)) return "WG";
  if (value.startsWith("ST")) return "ST";
  return "DM";
}

/**
 * Rol que el entrenador pide para esa posición, con emoji.
 * Devuelve siempre un rol: la función preferida del ADN si se puede
 * identificar en sus prioridades por posición, o el rol base de la zona.
 */
export function slotRoleBadge(code, roleText) {
  const family = slotRoleFamily(code);
  const fallback = { family, ...FAMILY_DEFAULT[family] };
  if (!roleText || typeof roleText !== "object") return fallback;
  try {
    const mentioned = functionPreferences({ player_role_priorities: roleText }, family)
      .filter(option => option.matchingTerms.length);
    const badge = mentioned.length ? FUNCTION_BADGES[family]?.[mentioned[0].id] : null;
    return badge ? { family, ...badge } : fallback;
  } catch {
    return fallback;
  }
}