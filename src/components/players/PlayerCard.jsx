import React, { useState } from "react";
import { Users, Building2 } from "lucide-react";

// ============================================================
// Helpers extraídos de Players.jsx para mantener PlayerCard
// como componente independiente y enfocado.
// ============================================================

const CAREER_STATUS_LOGOS = {
  free_agent: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#243F71"/><stop offset="1" stop-color="#07182F"/></linearGradient></defs><path d="M48 5 85 20v30c0 19-15 32-37 41C26 82 11 69 11 50V20z" fill="url(#g)" stroke="#9EB7E4" stroke-width="3"/><rect x="27" y="36" width="42" height="32" rx="5" fill="none" stroke="#D9E9FF" stroke-width="5"/><path d="M39 36v-7c0-5 4-8 9-8s9 3 9 8v7M27 48h42M44 46v6h8v-6" fill="none" stroke="#D9E9FF" stroke-width="5" stroke-linecap="round"/></svg>`)}`,
  retired: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#725A29"/><stop offset="1" stop-color="#251A0B"/></linearGradient></defs><path d="M48 5 85 20v30c0 19-15 32-37 41C26 82 11 69 11 50V20z" fill="url(#g)" stroke="#E9C77B" stroke-width="3"/><path d="M32 28h32v13c0 12-6 20-16 20S32 53 32 41V28zm0 6H23v5c0 9 6 13 14 13m27-18h9v5c0 9-6 13-14 13M48 61v9m-12 5h24" fill="none" stroke="#FFE3A5" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`)}`,
};
const careerStatusLogo = (status) => CAREER_STATUS_LOGOS[status] || "";

const normalizeImageUrl = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (/^(https?:|data:|blob:)/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

function calculateAge(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  let birthDate = null;
  const ddmmyyyy = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    birthDate = new Date(Number(year), Number(month) - 1, Number(day));
  } else {
    const parsedDate = new Date(trimmed);
    if (!Number.isNaN(parsedDate.getTime())) birthDate = parsedDate;
  }
  if (!birthDate || Number.isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const hasHadBirthday =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());
  if (!hasHadBirthday) age -= 1;
  return age >= 0 && age < 120 ? age : null;
}

function ageCircleColor(age) {
  if (age == null) return "bg-slate-300";
  if (age <= 18) return "bg-purple-500";
  if (age <= 21) return "bg-blue-500";
  if (age <= 25) return "bg-green-500";
  if (age <= 29) return "bg-yellow-500";
  if (age <= 33) return "bg-orange-500";
  return "bg-red-500";
}

const POSITION_LABELS = {
  portero: "POR",
  defensa_izquierdo: "DF (I)",
  defensa_central: "DF (C)",
  defensa_derecho: "DF (D)",
  mediocentro: "MCD",
  carrilero_izquierdo: "CR (I)",
  carrilero_derecho: "CR (D)",
  centrocampista_izquierdo: "MC (I)",
  centrocampista: "MC",
  centrocampista_derecho: "MC (D)",
  mediapunta_por_la_izquierda: "EI",
  mediapunta_central: "MP (C)",
  mediapunta_por_la_derecha: "ED",
  delantero: "DL (C)",
};

const PLAYER_CARD_POSITION_THRESHOLD = 16;
const getPlayerCardPositions = (player) => {
  const ratings = player?.positionRatings || player?.position_ratings || {};
  return Object.entries(ratings)
    .map(([key, value]) => ({ key, rating: Number(value), label: POSITION_LABELS[key] || key }))
    .filter(({ rating }) => Number.isFinite(rating) && rating >= PLAYER_CARD_POSITION_THRESHOLD)
    .sort((a, b) => b.rating - a.rating || a.key.localeCompare(b.key));
};

const computePlayerDescription = (player) => player?.description || "";

const SPECIAL_LEGACY_TITLES = {
  "Kylian Mbappé": "🐢 La Tortuga",
  "Neymar Jr": "🪄 O Magico",
  "Cristiano Ronaldo": "🐞 El Bicho",
  "Erling Haaland": "🤖 The Cyborg",
  "Luis Suárez": "🔫 El Pistolero",
  "Pedri": "🪄 El Mago",
  "Antoine Griezman": "👑 El Principito",
  "Lionel Messi": "🛐 D10S",
  "Thibaut Courtois": "🧱 The Belgian Wall",
  "Frenkie de Jong": "🎩 El Filósofo",
  "Paulo Dybala": "💎 La Joya",
  "José Morales": "🪖 Comandante Morales",
  "Ferran Torres": "🦈 El Tiburón",
  "Franco Vázquez": "😶 Mudo Vázquez",
  "Julián Álvarez": "🕷️ La Araña",
  "Cole Palmer": "🧊 Cold Palmer",
  "Claude Beacons": "🔥 Torch",
  "Jordan Greenway": "🟩 Janus",
  "Ousmane Dembélé": "🦟 Mosquito",
};

function computeLegacyTitle(player) {
  const name = String(player?.name || "").trim();
  if (SPECIAL_LEGACY_TITLES[name]) return SPECIAL_LEGACY_TITLES[name];
  const ca = Number(player?.ca);
  const cp = Number(player?.cp);
  const age = Number(player?.age);
  if (!Number.isFinite(ca) || !Number.isFinite(cp) || !Number.isFinite(age)) return "⚠️ Perfil indefinido";
  if (cp >= 195) {
    if (age <= 21) return "🪄 Heredero al trono";
    if (cp >= 192) {
      if (ca <= 191) return "🔱 Trono Dorado";
      if (ca > 191) return "👑 Rey absoluto";
    }
  }
  if (cp > 180) {
    if (age <= 21) {
      if (ca >= 160) return "🌠 Talento Generacional";
      if (ca < 160) return "⭐ Future Star";
    }
    if (age <= 25) {
      if (ca >= 175) return "🛰️ Élite Consolidada";
      if (ca < 180) return "🧬 Generación Alfa";
    }
    if (age < 30) {
      if (ca > 188) return "👑 Referente Mundial Absoluto";
      if (ca >= 185) return "📅 Marcador de Época";
      if (ca > 180) return "⚔️ Aspirante al Trono";
      if (ca <= 175) return "🕯️ Vestigio de grandeza";
      if (ca < 185) return "🏛️ Herencia de una generación";
      if (ca <= 188) return "🥋 Fenómeno Generacional";
    }
    if (age >= 30) return "🧠 Leyenda en Activo";
    return "❌ Sin margen competitivo";
  }
  if (cp > 170) {
    if (age <= 21) {
      if (ca >= 150) return "💫 Promesa Élite";
      if (ca < 150) return "🔮 Potencial Especial";
    }
    if (age <= 25) {
      if (ca >= 165) return "💥 Prodigio Generacional";
      if (ca < 170) return "🪙 Generación Beta";
    }
    if (age < 30) {
      if (ca >= 180) return "🎯 Titular de Élite";
      if (ca > 175) return "🗿 Estatura de élite";
      if (ca >= 170) return "🧿 Alta cuna futbolística";
      if (ca < 170) return "🦉 Maestro del Juego";
      if (ca < 175) return "⚙️ Pilar de Élite";
      if (ca <= 180) return "🧩 Elemento Crucial";
    }
    if (age >= 30) return "🧓 Estrella Veterana";
    return "❌ Sin margen competitivo";
  }
  if (cp >= 165) {
    if (age <= 21) {
      if (ca >= 140) return "🌟 Promesa Diferencial";
      if (ca < 140) return "⚡ Proyección de Estrella";
    }
    if (age <= 25) {
      if (ca >= 160) return "🦅 Referencia Generacional";
      if (ca < 160) return "🔥 Forjador del futuro";
    }
    if (age < 30) {
      if (ca >= 160) return "📏 Estándar de Élite";
      if (ca < 160) return "🥷 Élite Silenciosa";
    }
    if (age >= 30) return "🦅 Último emperador";
    return "❌ Sin margen competitivo";
  }
  if (cp < 165) {
    if (age <= 21) {
      if (ca >= 130) return "🌱 Promesa Proyectable";
      if (ca < 130) return "🎯 Jugador a Observar";
    }
    if (age <= 25) {
      if (ca >= 150) return "🧃 Talento a Seguir";
      if (ca < 150) return "🔬 Potencial Real";
    }
    if (age < 30) {
      if (ca >= 150) return "🧱 Perfil Competitivo";
      if (ca < 150) return "🧩 Jugador de Buen Nivel";
    }
    if (age >= 30) return "🧓 Veterano Competitivo";
    return "❌ Sin margen competitivo";
  }
  return "⚠️ Perfil indefinido";
}

// ============================================================
// PlayerCard — tarjeta de jugador.
// Pulsar la tarjeta abre la ficha.
// Pulsar la bandera copia el nombre al portapapeles.
// En modo selección, la bandera alterna la selección.
// ============================================================

function PlayerCardInner({
  player,
  team,
  country,
  onSelect,
  selectionMode = false,
  selected = false,
  onToggleSelection,
  compact = false,
  hideTeam = false,
  useNationalCardPhoto = false,
}) {
  const preferredCardPhoto = useNationalCardPhoto
    ? player.nationalCardPhotoUrl || player.cardPhotoUrl || player.photoUrl
    : player.cardPhotoUrl || player.photoUrl;

  const photoUrl = normalizeImageUrl(preferredCardPhoto);
  const cardCareerStatus = player?.career_status || (player?.teamId || player?.team_id ? "active" : "free_agent");
  const teamLogo = cardCareerStatus !== "active" ? careerStatusLogo(cardCareerStatus) : normalizeImageUrl(team?.logo);
  const teamDisplayName = cardCareerStatus === "retired" ? "Retirado" : cardCareerStatus === "free_agent" ? "Agente libre" : (team?.name || "No club associated");

  const age = calculateAge(player.dateOfBirth);
  const legacyTitle = computeLegacyTitle({ ...player, age: age ?? undefined });
  const cardPositions = getPlayerCardPositions(player);
  const description = computePlayerDescription(player);

  const countryFlagUrl = normalizeImageUrl(country?.flag);
  const countryCode = String(country?.code || "").trim().toLowerCase();
  const fallbackFlagUrl =
    !countryFlagUrl && countryCode.length === 2 ? `https://flagcdn.com/${countryCode}.svg` : "";

  const [copied, setCopied] = useState(false);

  const handleCardAction = () => {
    if (selectionMode) onToggleSelection?.(player.id);
    else onSelect?.(player);
  };

  const handleCardKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleCardAction();
    }
  };

  const handleFlagClick = async (event) => {
    event.stopPropagation();
    if (selectionMode) {
      onToggleSelection?.(player.id);
      return;
    }
    try {
      await navigator.clipboard.writeText(player.name || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.warn("No se pudo copiar el nombre:", error);
    }
  };

  // Evita que el keydown/keyup de la bandera burbujee al contenedor
  // role="button" y abra la ficha al activarla con Enter o Espacio.
  // El navegador sintetiza un click tras estas teclas, que handleFlagClick
  // ya intercepta con stopPropagation.
  const handleFlagKeyDown = (event) => {
    event.stopPropagation();
  };

  const handleFlagKeyUp = (event) => {
    event.stopPropagation();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleCardAction}
      onKeyDown={handleCardKeyDown}
      aria-label={`Abrir ficha de ${player.name || "jugador"}`}
      className={`group w-full cursor-pointer overflow-hidden rounded-2xl border ${selected ? "border-blue-700 ring-2 ring-blue-300" : "border-slate-200"} bg-white text-left shadow-[0_2px_8px_rgba(15,23,42,0.02)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_12px_30px_rgba(15,23,42,0.07)] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${compact ? "" : ""}`}
    >
      {selectionMode && (
        <div className="flex items-center gap-2 border-b border-slate-100 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-900">
          <span className={`inline-flex h-4 w-4 items-center justify-center rounded border ${selected ? "bg-blue-700 text-white border-blue-700" : "border-slate-400 bg-white"}`}>
            {selected ? "✓" : ""}
          </span>
          {selected ? "Seleccionado" : "Seleccionar jugador"}
        </div>
      )}

      {/* PHOTO */}
      <div className={`relative w-full overflow-hidden bg-slate-50 ${compact ? "aspect-[5/4]" : "aspect-[4/3]"}`}>
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={player.name || "Player"}
            loading="lazy"
            className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.025]"
            onError={(event) => { event.currentTarget.style.display = "none"; }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Users size={56} strokeWidth={1.25} className="text-slate-200" />
          </div>
        )}
      </div>

      {/* INFO */}
      <div className={`border-t border-slate-100 ${compact ? "px-3 pb-3 pt-2.5" : "px-4 pb-4 pt-3"}`}>
        {/* NAME + FLAG */}
        <div className="flex min-w-0 items-center gap-2">
          {(countryFlagUrl || fallbackFlagUrl) && (
            <button
              type="button"
              onClick={handleFlagClick}
              onKeyDown={handleFlagKeyDown}
              onKeyUp={handleFlagKeyUp}
              title="Copiar nombre"
              aria-label={`Copiar nombre de ${player.name || "jugador"}`}
              className="relative flex h-4 w-6 shrink-0 items-center justify-center rounded-[2px] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              <img
                src={countryFlagUrl || fallbackFlagUrl}
                alt={country?.name || ""}
                className="h-4 w-6 rounded-[2px] object-cover"
                loading="lazy"
              />
              {copied && (
                <span className="absolute -top-7 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white shadow">
                  Nombre copiado
                </span>
              )}
            </button>
          )}

          <h3
            title={player.name || ""}
            style={{ lineHeight: 0.95 }}
            className={`player-display-title min-w-0 flex-1 break-words line-clamp-2 ${compact ? "min-h-[1.7rem] text-sm" : "min-h-[1.9rem] text-base"}`}
          >
            {player.name || "Unnamed player"}
          </h3>
        </div>

        {/* LEGACY TITLE + CA/CP */}
        <div className={`${compact ? "mt-1.5" : "mt-2"} flex min-w-0 items-center gap-1.5 text-xs`}>
          <span className="shrink-0 font-semibold text-slate-900">{legacyTitle}</span>
          <span className="shrink-0 text-slate-300">|</span>
          <span className="shrink-0 font-semibold text-slate-500">
            {player.ca !== "" && player.ca != null ? player.ca : "—"} / {player.cp !== "" && player.cp != null ? player.cp : "—"}
          </span>
        </div>

        {/* AGE + POSITION RATINGS */}
        <div className={`${compact ? "mt-1.5" : "mt-2"} flex min-w-0 items-start gap-1.5 text-xs`}>
          <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${ageCircleColor(age)}`} />
          <span className="shrink-0 font-semibold text-slate-700">{age ?? "—"}</span>

          {cardPositions.length > 0 && (
            <>
              <span className="shrink-0 text-slate-300">|</span>
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-slate-700">
                {cardPositions.map(({ key, label, rating }, index) => (
                  <React.Fragment key={key}>
                    {index > 0 && <span className="shrink-0 text-slate-300">·</span>}
                    <span
                      className={`shrink-0 whitespace-nowrap ${rating === 20 ? "font-extrabold text-slate-800" : "font-normal text-slate-500"}`}
                      title={`${label}: ${rating}/20`}
                    >
                      {label}
                    </span>
                  </React.Fragment>
                ))}
              </div>
            </>
          )}
        </div>

        {/* DESCRIPTION */}
        {description && (
          <div className={`${compact ? "mt-1" : "mt-1.5"} min-w-0 break-words text-xs font-medium leading-4 text-slate-500`}>
            {description}
          </div>
        )}

        {/* CLUB */}
        {!hideTeam && (
          <div className={`${compact ? "mt-2" : "mt-3"} flex min-w-0 items-center gap-2 text-xs text-slate-400`}>
            {teamLogo ? (
              <img src={teamLogo} alt="" className="h-4 w-4 shrink-0 object-contain" loading="lazy" />
            ) : (
              <Building2 size={14} strokeWidth={1.7} className="shrink-0" />
            )}
            <span className="truncate">{teamDisplayName}</span>
          </div>
        )}
      </div>
    </div>
  );
}

const PlayerCard = React.memo(PlayerCardInner);
export default PlayerCard;