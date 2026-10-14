import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";

// Carga las valoraciones historicas de un jugador desde PlayerHistoricalValuation.
// Devuelve { valuations, loading, refresh }.
export function useHistoricalValuations(playerId) {
  const [valuations, setValuations] = useState([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    const id = String(playerId || "");
    if (!id) {
      setValuations([]);
      return;
    }
    setLoading(true);
    try {
      const r = await base44.entities.PlayerHistoricalValuation.filter(
        { player_id: id },
        { sort: "-season", limit: 100 }
      );
      const items = Array.isArray(r) ? r : r?.items || [];
      setValuations(
        items.sort((a, b) =>
          String(b.season || "").localeCompare(String(a.season || ""))
        )
      );
    } catch {
      setValuations([]);
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { valuations, loading, refresh };
}