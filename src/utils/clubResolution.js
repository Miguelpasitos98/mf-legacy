// Resolución masiva de clubes para el importador de historiales MF LEGACY.
// Agrupa clubes por club_qid de Wikidata (o por nombre normalizado si no hay qid)
// y los clasifica para vinculación/creación masiva sin generar duplicados.
//
// Estrategia:
//  1. ClubLink existente (QID) -> reutilizada automáticamente.
//  2. Coincidencia exacta de núcleo normalizado (un solo candidato) -> fiable.
//  3. Varios candidatos -> ambiguo (revisión, sin selección automática).
//  4. Sin coincidencia y con QID -> creable.
//  5. Sin QID ni coincidencia -> sin identificar.
// Los equipos filiales/juveniles se tratan como entidades distintas: si el club
// importado y un candidato tienen distinto "estatus filial", no se vinculan.

import { normalizeClubName } from "./careerImport";

// Clave estable para un club: prioriza club_qid; si no, nombre normalizado.
export const clubKeyFor = (record) => {
  const qid = String(record?.club_qid || "").trim();
  if (qid) return `qid:${qid}`;
  return `name:${normalizeClubName(record?.club_name)}`;
};

// Tokeniza sin eliminar genéricos (para detectar filiales/juveniles).
const tokenizeClub = (name) =>
  String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.\-_/\\'`´·,;:&()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const RESERVE_WORDS = [
  "castilla",
  "filial",
  "juvenil",
  "juveniles",
  "reserves",
  "reserve",
  "u19",
  "u21",
  "u23",
  "u17",
  "u16",
  "u15",
  "amateur",
  "promesas",
  "aficionados",
  "subsidiary",
];

// ¿El nombre tokenizado indica un equipo filial/juvenil?
const hasReserveToken = (tokenized) => {
  if (!tokenized) return false;
  if (/\b(b|bb|ii|iii|iv)\b/.test(tokenized)) return true;
  return RESERVE_WORDS.some((w) => tokenized.includes(w));
};

// Detecta grupos de clubes únicos a partir de las entradas parseadas.
// Devuelve: [{ key, club_qid, club_name, normalized, tokenized, isReserve, stageIds, sampleNames }]
export const detectClubs = (entries) => {
  if (!Array.isArray(entries)) return [];
  const map = new Map();
  for (const entry of entries) {
    const r = entry?.record;
    if (!r) continue;
    const key = clubKeyFor(r);
    if (!map.has(key)) {
      const tokenized = tokenizeClub(r.club_name);
      map.set(key, {
        key,
        club_qid: String(r.club_qid || "").trim(),
        club_name: String(r.club_name || "").trim(),
        normalized: normalizeClubName(r.club_name),
        tokenized,
        isReserve: hasReserveToken(tokenized),
        stageIds: [],
        sampleNames: new Set(),
      });
    }
    const g = map.get(key);
    g.stageIds.push(r.external_stage_id);
    const name = String(r.club_name || "").trim();
    if (name) g.sampleNames.add(name);
  }
  return Array.from(map.values()).map((g) => ({
    ...g,
    sampleNames: Array.from(g.sampleNames).slice(0, 3),
  }));
};

// Resuelve un grupo de club a un estado de vinculación.
// status: "linked" | "matched" | "creatable" | "ambiguous" | "unidentified"
export const resolveClubGroup = (group, { clubLinks, teams }) => {
  // 1. Asociación existente en ClubLink (reutilizar automáticamente).
  if (group.club_qid && clubLinks && clubLinks[group.club_qid]) {
    const team = teams.find(
      (t) => String(t.id) === String(clubLinks[group.club_qid])
    );
    if (team) return { status: "linked", team, candidates: [] };
  }

  const importCore = group.normalized || normalizeClubName(group.club_name);
  if (!importCore) {
    // Sin nombre aprovechable: no se puede asociar por nombre.
    return group.club_qid
      ? { status: "creatable", team: null, candidates: [] }
      : { status: "unidentified", team: null, candidates: [] };
  }
  const importReserve = group.isReserve ?? hasReserveToken(group.tokenized || tokenizeClub(group.club_name));

  const candidates = [];
  for (const t of teams) {
    const tCore = normalizeClubName(t.name);
    const tTok = tokenizeClub(t.name);
    const tReserve = hasReserveToken(tTok);

    // Distinto estatus filial -> clubes diferentes, no se vinculan.
    if (tReserve !== importReserve) continue;

    let score = 0;
    if (tCore && tCore === importCore) {
      score = 1;
    } else if (tCore && importCore.length >= 5 && (tCore.includes(importCore) || importCore.includes(tCore))) {
      score = 0.85;
    } else {
      const sCore = normalizeClubName(t.short_name || t.shortName || "");
      if (sCore && sCore === importCore && importCore.length >= 3) score = 0.9;
    }
    if (score > 0) candidates.push({ team: t, score });
  }
  candidates.sort((a, b) => b.score - a.score);

  // Coincidencia inequívoca: un único candidato.
  if (candidates.length === 1) {
    return { status: "matched", team: candidates[0].team, candidates };
  }
  // Varios candidatos: revisión manual, sin selección automática.
  if (candidates.length > 1) {
    return { status: "ambiguous", team: null, candidates: candidates.slice(0, 5) };
  }

  // Sin coincidencia: creable si tiene QID (evita duplicados al reutilizar).
  return group.club_qid
    ? { status: "creatable", team: null, candidates: [] }
    : { status: "unidentified", team: null, candidates: [] };
};

export const CLUB_STATUS_LABELS = {
  linked: "Vinculados",
  matched: "Coincidencias fiables",
  creatable: "Nuevos",
  ambiguous: "Ambiguos",
  unidentified: "Sin identificar",
  resolved: "Resueltos",
};