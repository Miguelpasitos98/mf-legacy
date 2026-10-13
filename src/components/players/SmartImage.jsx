import React, { useEffect, useRef, useState } from "react";

/**
 * SmartImage — imagen con gestión robusta de carga para fotografías externas.
 *
 * - Estados por imagen: loading / loaded / error.
 * - Skeleton discreto mientras carga (no aparece el placeholder prematuramente).
 * - Reintentos automáticos (máximo 3) con espera progresiva para errores
 *   temporales (429, 5xx, red, CORS). Conserva la URL original para no romper
 *   la caché del navegador: las fotos ya cargadas se reutilizan al filtrar,
 *   ordenar o volver a Players.
 * - Distingue errores permanentes (400/403/404/410) de temporales mediante una
 *   sonda HEAD best-effort. Una URL inválida no se reintenta indefinidamente.
 * - `loading="lazy"` por defecto; `eager` para priorizar la primera fila.
 * - Cancela reintentos al desmontar o al cambiar la URL (sin condiciones de carrera).
 */

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [600, 1200, 2400];

const isPermanentStatus = (status) =>
  status === 400 ||
  status === 403 ||
  status === 404 ||
  status === 410 ||
  status === 451;

const probeUrl = (url, timeoutMs = 4000) =>
  new Promise((resolve) => {
    if (typeof AbortController === "undefined" || typeof fetch === "undefined") {
      resolve({ status: null, probed: false });
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    fetch(url, {
      method: "HEAD",
      mode: "cors",
      cache: "no-cache",
      signal: controller.signal,
    })
      .then((res) => {
        clearTimeout(timer);
        resolve({ status: res.status, probed: true });
      })
      .catch(() => {
        clearTimeout(timer);
        resolve({ status: null, probed: false });
      });
  });

export default function SmartImage({
  src,
  alt = "",
  imgClassName = "",
  fallback = null,
  eager = false,
}) {
  const [status, setStatus] = useState(() => (src ? "loading" : "error"));
  const [reloadKey, setReloadKey] = useState(0);
  const attemptRef = useRef(0);
  const timerRef = useRef(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    attemptRef.current = 0;
    setStatus(src ? "loading" : "error");
    setReloadKey((k) => k + 1);
    return () => {
      cancelledRef.current = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [src]);

  const handleLoaded = () => {
    if (cancelledRef.current) return;
    setStatus("loaded");
  };

  const scheduleRetry = () => {
    if (cancelledRef.current) return;
    if (attemptRef.current >= MAX_ATTEMPTS) {
      setStatus("error");
      return;
    }
    const delay = BACKOFF_MS[attemptRef.current] ?? 2400;
    timerRef.current = setTimeout(() => {
      if (cancelledRef.current) return;
      attemptRef.current += 1;
      setReloadKey((k) => k + 1);
      setStatus("loading");
    }, delay);
  };

  const handleError = () => {
    if (cancelledRef.current) return;
    // Solo se sondan URLs http(s). data:/blob:/otros se reintentan sin sonda.
    if (!/^https?:\/\//i.test(src)) {
      scheduleRetry();
      return;
    }
    probeUrl(src).then((result) => {
      if (cancelledRef.current) return;
      if (result.probed && result.status !== null && isPermanentStatus(result.status)) {
        setStatus("error");
        return;
      }
      scheduleRetry();
    });
  };

  if (!src || status === "error") {
    return fallback;
  }

  return (
    <>
      {status === "loading" && (
        <div
          className="absolute inset-0 animate-pulse bg-slate-100/80"
          aria-hidden="true"
        />
      )}
      <img
        key={reloadKey}
        src={src}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        onLoad={handleLoaded}
        onError={handleError}
        className={status === "loaded" ? imgClassName : `${imgClassName} opacity-0`}
      />
    </>
  );
}