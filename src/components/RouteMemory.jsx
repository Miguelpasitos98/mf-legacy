import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

// Al abrir la app desde la raíz, devuelve al usuario a la última página en la
// que estaba, para que el móvil no lo reinicie siempre en el inicio.
const LAST_ROUTE_KEY = "mf-legacy:last-route:v1";
const AUTH_PATHS = ["/login", "/register", "/mfa", "/forgot-password", "/reset-password", "/oauth-consent"];

export default function RouteMemory() {
  const location = useLocation();
  const navigate = useNavigate();
  const restored = useRef(false);

  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    if (location.pathname !== "/" || location.search || location.hash) return;
    let target = "";
    try {
      target = window.localStorage.getItem(LAST_ROUTE_KEY) || "";
    } catch {
      return;
    }
    if (!target.startsWith("/") || target === "/") return;
    if (AUTH_PATHS.some((path) => target.startsWith(path))) return;
    navigate(target, { replace: true });
  }, [location, navigate]);

  useEffect(() => {
    try {
      const ignored = location.pathname === "/" || AUTH_PATHS.some((path) => location.pathname.startsWith(path));
      if (ignored) window.localStorage.removeItem(LAST_ROUTE_KEY);
      else window.localStorage.setItem(LAST_ROUTE_KEY, location.pathname + location.search);
    } catch {
      /* almacenamiento opcional */
    }
  }, [location.pathname, location.search]);

  return null;
}