import { useState, useEffect, useCallback, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { canonicalHistoricalCompetition } from "@/utils/historicalJson";

// Carga los PJ Equipo almacenados en TeamSeasonMatches para los equipos
// presentes en las estadisticas del jugador. Devuelve { getTeamMatches, loading, refresh }.
// getTeamMatches(record) devuelve el registro TeamSeasonMatches coincidente o null.
export function useTeamMatchesLookup(stats) {
  const [lookup, setLookup] = useState(new Map());
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const teamIds = useMemo(
    () => [...new Set((stats || []).map((r) => String(r.team_id || "")).filter(Boolean))],
    [stats]
  );
  const fotmobTeamIds = useMemo(
    () => [...new Set((stats || []).map((r) => String(r.fotmob_team_id || "")).filter(Boolean))],
    [stats]
  );

  useEffect(() => {
    if (!teamIds.length && !fotmobTeamIds.length) {
      setLookup(new Map());
      return;
    }
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const all = [];
        for (let i = 0; i < teamIds.length; i += 100) {
          const chunk = teamIds.slice(i, i + 100);
          const r = await base44.entities.TeamSeasonMatches.filter(
            { team_id: { $in: chunk } },
            { limit: 500 }
          );
          all.push(...(Array.isArray(r) ? r : r?.items || []));
        }
        for (let i = 0; i < fotmobTeamIds.length; i += 100) {
          const chunk = fotmobTeamIds.slice(i, i + 100);
          const r = await base44.entities.TeamSeasonMatches.filter(
            { fotmob_team_id: { $in: chunk } },
            { limit: 500 }
          );
          all.push(...(Array.isArray(r) ? r : r?.items || []));
        }
        if (!active) return;
        const map = new Map();
        const add = (key, value) => {
          const previous = map.get(key);
          // Two different stored records for the same club, season and competition
          // are a conflict, not a reason to silently select one of them.
          if (map.has(key) && previous?.id !== value?.id) {
            map.set(key, null);
          } else if (!map.has(key)) {
            map.set(key, value);
          }
        };
        for (const m of all) {
          const competition = canonicalHistoricalCompetition(m.competition);
          if (m.team_id)
            add(`${m.team_id}|${m.season}|${competition}`, m);
          if (m.fotmob_team_id)
            add(`${m.fotmob_team_id}|${m.season}|${competition}`, m);
        }
        setLookup(map);
      } catch {
        if (active) setLookup(new Map());
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [teamIds, fotmobTeamIds, refreshKey]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const getTeamMatches = useCallback(
    (record) => {
      if (!record) return null;
      const keys = [
        record.team_id
          ? `${record.team_id}|${record.season}|${canonicalHistoricalCompetition(record.competition)}`
          : null,
        record.fotmob_team_id
          ? `${record.fotmob_team_id}|${record.season}|${canonicalHistoricalCompetition(record.competition)}`
          : null,
      ].filter(Boolean);
      for (const key of keys) {
        if (lookup.has(key)) return lookup.get(key);
      }
      return null;
    },
    [lookup]
  );

  return { getTeamMatches, loading, refresh };
}