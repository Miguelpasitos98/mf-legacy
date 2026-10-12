/**
 * MF LEGACY
 * Shared helper functions for player cards and player list.
 * Extracted from Players.jsx to enable memoization and reduce bundle parse cost.
 */
import React from "react";

const CAREER_STATUS_LOGOS = {
  free_agent: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#243F71"/><stop offset="1" stop-color="#07182F"/></linearGradient></defs><path d="M48 5 85 20v30c0 19-15 32-37 41C26 82 11 69 11 50V20z" fill="url(#g)" stroke="#9EB7E4" stroke-width="3"/><rect x="27" y="36" width="42" height="32" rx="5" fill="none" stroke="#D9E9FF" stroke-width="5"/><path d="M39 36v-7c0-5 4-8 9-8s9 3 9 8v7M27 48h42M44 46v6h8v-6" fill="none" stroke="#D9E9FF" stroke-width="5" stroke-linecap="round"/></svg>`)}`,
  retired: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#725A29"/><stop offset="1" stop-color="#251A0B"/></linearGradient></defs><path d="M48 5 85 20v30c0 19-15 32-37 41C26 82 11 69 11 50V20z" fill="url(#g)" stroke="#E9C77B" stroke-width="3"/><path d="M32 28h32v13c0 12-6 20-16 20S32 53 32 41V28zm0 6H23v5c0 9 6 13 14 13m27-18h9v5c0 9-6 13-14 13M48 61v9m-12 5h24" fill="none" stroke="#FFE3A5" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`)}`,
};

export const careerStatusLogo = (status) => CAREER_STATUS_LOGOS[status] || "";

export const normalizeImageUrl = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (/^(https?:|data:|blob:)/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

export function calculateAge(value) {
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

export function ageCircleColor(age) {
  if (age == null) return "bg-slate-300";
  if (age <= 18) return "bg-purple-500";
  if (age <= 21) return "bg-blue-500";
  if (age <= 25) return "bg-green-500";
  if (age <= 29) return "bg-yellow-500";
  if (age <= 33) return "bg-orange-500";
  return "bg-red-500";
}

export const POSITION_LABELS = {
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

export const PLAYER_CARD_POSITION_THRESHOLD = 16;

const _primaryPositionCache = new WeakMap();

export const getPrimaryPosition = (player) => {
  if (!player) return "";
  const cached = _primaryPositionCache.get(player);
  if (cached !== undefined) return cached;
  const ratings = player?.positionRatings || player?.position_ratings || {};
  const result = Object.entries(ratings)
    .map(([key, value]) => ({ key, rating: Number(value) }))
    .filter(({ rating }) => Number.isFinite(rating) && rating > 0)
    .sort((a, b) => b.rating - a.rating || a.key.localeCompare(b.key))[0]?.key || "";
  _primaryPositionCache.set(player, result);
  return result;
};

export const getPlayerCardPositions = (player) => {
  const ratings = player?.positionRatings || player?.position_ratings || {};
  return Object.entries(ratings)
    .map(([key, value]) => ({ key, rating: Number(value), label: POSITION_LABELS[key] || key }))
    .filter(({ rating }) => Number.isFinite(rating) && rating >= PLAYER_CARD_POSITION_THRESHOLD)
    .sort((a, b) => b.rating - a.rating || a.key.localeCompare(b.key));
};

export const computePlayerDescription = (player) => player?.description || "";

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

export function computeLegacyTitle(player) {
  const name = String(player?.name || "").trim();
  if (SPECIAL_LEGACY_TITLES[name]) return SPECIAL_LEGACY_TITLES[name];

  const ca = Number(player?.ca);
  const cp = Number(player?.cp);
  const age = Number(player?.age);
  if (!Number.isFinite(ca) || !Number.isFinite(cp) || !Number.isFinite(age)) {
    return "⚠️ Perfil indefinido";
  }

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