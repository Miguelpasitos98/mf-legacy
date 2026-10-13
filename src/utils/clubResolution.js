// Resolución masiva de clubes para el importador de historiales MF LEGACY.
// Agrupa clubes por club_qid de Wikidata (o por nombre normalizado si no hay qid)
// y los clasifica para vinculación/creación masiva sin generar duplicados.

import { normalizeClubName } from "./careerImport";

// Clave estable para un club: prioriza club_qid; si no, nombre normalizado.
export const clubKeyFor = (record) => {
  const qid = String(record?.club_qid || "").trim();
  if (qid) return `qid:${qid}`;
  return `name:${normalizeClubName(record?.club_name)}`;
};

// Detecta grupos de clubes únicos a partir de las entradas parseadas.
// Devuelve: [{ key, club_qid, club_name, normalized, stageIds, sampleNames }]
export const detectClubs = (entries) => {
  if (!Array.isArray(entries)) return [];
  const map = new Map();
  for (const entry of entries) {
    const r = entry?.record;
    if (!r) continue;
    const key = clubKeyFor(r);
    if (!map.has(key)) {
      map.set(key, {
        key,
        club_qid: String(r.club_qid || "").trim(),
        club_name: String(r.club_name || "").trim(),
        normalized: normalizeClubName(r.club_name),
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

// Coincidencias exactas por nombre normalizado (nombre o short_name del Team).
// Solo estas se consideran fiables para vinculación automática.
const matchTeamExact = (normalized, teams) => {
  if (!normalized) return [];
  const matches = [];
  for (const t of teams) {
    const n = normalizeClubName(t.name);
    const s = normalizeClubName(t.short_name || t.shortName || "");
    if (n && n === normalized) matches.push({ team: t, via: "name", score: 1 });
    else if (s && s === normalized) matches.push({ team: t, via: "short_name", score: 0.98 });
  }
  return matches;
};

// Coincidencias parciales por inclusión textual (solo para señalar ambigüedad,
// nunca para vincular automáticamente).
const matchTeamPartial = (normalized, teams) => {
  if (!normalized || normalized.length < 4) return [];
  return teams
    .map((t) => {
      const n = normalizeClubName(t.name);
      const s = normalizeClubName(t.short_name || "");
      let score = 0;
      if (n && (n.includes(normalized) || normalized.includes(n))) score = 0.82;
      else if (s && (s.includes(normalized) || normalized.includes(s))) score = 0.78;
      return score > 0 ? { team: t, score } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);
};

// Resuelve un grupo de club a un estado de vinculación.
// status: "linked" | "matched" | "creatable" | "ambiguous" | "unidentified"
export const resolveClubGroup = (group, { clubLinks, teams }) => {
  // 1. Asociación existente en ClubLink.
  if (group.club_qid && clubLinks && clubLinks[group.club_qid]) {
    const team = teams.find(
      (t) => String(t.id) === String(clubLinks[group.club_qid])
    );
    if (team) return { status: "linked", team, candidates: [] };
  }

  // 2. Coincidencia exacta (fiable).
  const exact = matchTeamExact(group.normalized, teams);
  if (exact.length === 1) return { status: "matched", team: exact[0].team, candidates: exact };
  if (exact.length > 1) return { status: "ambiguous", team: null, candidates: exact };

  // 3. Sin coincidencia exacta: similitud textual → ambiguo (no se auto-vincula).
  const partial = matchTeamPartial(group.normalized, teams);
  if (partial.length) return { status: "ambiguous", team: null, candidates: partial.slice(0, 5) };

  // 4. Creable si tiene club_qid (evita duplicados al reutilizar la asociación).
  if (group.club_qid) return { status: "creatable", team: null, candidates: [] };

  return { status: "unidentified", team: null, candidates: [] };
};

export const CLUB_STATUS_LABELS = {
  linked: "Ya vinculados",
  matched: "Coincidencia fiable",
  creatable: "Creables",
  ambiguous: "Ambiguos",
  unidentified: "Sin identificar",
  resolved: "Resueltos",
};