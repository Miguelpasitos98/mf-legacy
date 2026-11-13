import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

// Al recargarse la app (vista previa del editor, móvil que descarta la página)
// se vuelve a la última página visitada en lugar de reiniciar en el inicio.
const LAST_ROUTE_KEY = "mf-legacy:last-route:v2";
const NAME_PREFIX = "mf-legacy-route:";
const AUTH_PATHS = ["/login", "/register", "/mfa", "/forgot-password", "/reset-password", "/oauth-consent"];

const stores = () => {
  const list = [];
  try { if (window.localStorage) list.push(window.localStorage); } catch { /* opcional */ }
  try { if (window.sessionStorage) list.push(window.sessionStorage); } catch { /* opcional */ }
  return list;
};

const readFromName = () => {
  try {
    const value = String(window.name || "");
    if (!value.startsWith(NAME_PREFIX)) return null;
    return JSON.parse(value.slice(NAME_PREFIX.length));
  } catch {
    return null;
  }
};

const readStored = () => {
  let newest = readFromName();
  for (const storage of stores()) {
    try {
      const raw = storage.getItem(LAST_ROUTE_KEY);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (typeof parsed?.path !== "string") continue;
      if (!newest || (parsed.at || 0) > (newest.at || 0)) newest = parsed;
    } catch {
      /* almacenamiento opcional */
    }
  }
  return newest;
};

const writeStored = (path) => {
  const payload = JSON.stringify({ path, at: Date.now() });
  for (const storage of stores()) {
    try { storage.setItem(LAST_ROUTE_KEY, payload); } catch { /* opcional */ }
  }
  try { window.name = NAME_PREFIX + payload; } catch { /* opcional */ }
};

export default function RouteMemory() {
  const location = useLocation();
  const navigate = useNavigate();
  const started = useRef(false);
  const skipPersist = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    // La vista previa siempre arranca en la raíz, pero puede añadir parámetros.
    if (location.pathname !== "/") return;
    const target = readStored()?.path || "";
    if (!target.startsWith("/") || target.startsWith("//") || target === "/") return;
    if (AUTH_PATHS.some((path) => target.startsWith(path))) return;
    skipPersist.current = true;
    navigate(target, { replace: true });
  }, []);

  useEffect(() => {
    // No sobrescribir con "/" la ruta que se acaba de restaurar.
    if (skipPersist.current) {
      skipPersist.current = false;
      return;
    }
    const isAuth = AUTH_PATHS.some((path) => location.pathname.startsWith(path));
    if (isAuth) return;
    writeStored(location.pathname + location.search);
  }, [location.pathname, location.search]);

  return null;
}