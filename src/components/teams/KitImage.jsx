import React, { useEffect, useState } from "react";

/**
 * Imagen de camiseta para TeamDetail.
 *
 * - Precarga la imagen (new Image()) para calentar la caché del navegador
 *   y detectar la carga antes de pintar.
 * - Muestra un placeholder discreto mientras carga y un fade-in suave
 *   para evitar que la camiseta aparezca de golpe después de las demás.
 * - Carga eager (sin lazy) con decoding="async"; fetchpriority="high"
 *   cuando priority (camiseta central / First Kit).
 * - Reutiliza la caché del navegador: el navegador deduplica solicitudes
 *   idénticas, así que no se generan peticiones duplicadas.
 * - No modifica la URL original ni el registro del equipo.
 */
export default function KitImage({ src, alt, className = "", priority = false, placeholderMinHeight = 360 }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
    if (!src) return;
    const preloader = new Image();
    preloader.decoding = "async";
    preloader.onload = () => setLoaded(true);
    preloader.onerror = () => setFailed(true);
    preloader.src = src;
    return () => {
      preloader.onload = null;
      preloader.onerror = null;
    };
  }, [src]);

  if (!src || failed) return null;

  return (
    <>
      {!loaded && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <div className="h-24 w-24 animate-pulse rounded-full bg-white/10 sm:h-28 sm:w-28" />
        </div>
      )}
      <img
        src={src}
        alt={alt}
        loading="eager"
        decoding="async"
        {...(priority ? { fetchpriority: "high" } : {})}
        onLoad={() => setLoaded(true)}
        style={loaded ? undefined : { minHeight: placeholderMinHeight }}
        className={`${className} ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </>
  );
}