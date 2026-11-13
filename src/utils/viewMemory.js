// Memoria local de las vistas (localStorage). Guarda solo elecciones de
// presentación —filtros, pestañas y orden— para que la app no vuelva a su
// estado inicial cada vez que se entra, se recarga o el móvil descarta la página.
const PREFIX = "mf-legacy:view:v1:";

export function readViewMemory(key) {
  try {
    const raw = globalThis.localStorage?.getItem(PREFIX + key);
    const value = raw ? JSON.parse(raw) : null;
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

export function writeViewMemory(key, value) {
  try {
    globalThis.localStorage?.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* almacenamiento opcional */
  }
}

// Devuelve un texto recordado solo si sigue siendo una opción válida.
export function memoryText(memory, field, allowed, fallback = "") {
  const value = memory?.[field];
  if (typeof value !== "string") return fallback;
  if (Array.isArray(allowed) && !allowed.includes(value)) return fallback;
  return value.slice(0, 250);
}