import React, { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { normalizeImageUrl } from "./teamUtils";

/**
 * Escudo de equipo reutilizable para todos los selectores de MF LEGACY.
 *
 * - Resuelve la imagen desde logo / logo_url / logoUrl.
 * - Normaliza la URL y conserva rutas válidas de GitHub, FotMob u otras fuentes.
 * - Muestra el escudo original cuando existe.
 * - Si la imagen falla o no existe, muestra un icono de equipo visible
 *   (Building2) para evitar huecos vacíos.
 * - No modifica la URL almacenada del equipo.
 */
export default function TeamLogo({
  src,
  alt = "",
  imgClassName = "h-6 w-6 object-contain",
  iconSize = 15,
  iconClassName = "text-slate-300",
}) {
  const normalized = normalizeImageUrl(src);
  const [failed, setFailed] = useState(false);

  // Reinicia el estado de error cuando cambia la URL.
  useEffect(() => {
    setFailed(false);
  }, [normalized]);

  if (!normalized || failed) {
    return <Building2 size={iconSize} className={iconClassName} />;
  }

  return (
    <img
      src={normalized}
      alt={alt}
      className={imgClassName}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}