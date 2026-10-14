import { useEffect, useState } from "react";
import { fetchCraftedfcSnapshot } from "@/utils/craftedfc";

// Carga el snapshot de CraftedFC para un jugador (por base44_entity_id confirmado).
// status: "idle" | "loading" | "ready" | "error"
export function useCraftedfcSnapshot(playerId) {
  const [snapshot, setSnapshot] = useState(null);
  const [status, setStatus] = useState("idle");

  useEffect(() => {
    const key = String(playerId || "");
    if (!key) {
      setSnapshot(null);
      setStatus("idle");
      return;
    }
    let active = true;
    setStatus("loading");
    fetchCraftedfcSnapshot(key)
      .then((snap) => {
        if (!active) return;
        setSnapshot(snap);
        setStatus("ready");
      })
      .catch(() => {
        if (!active) return;
        setSnapshot(null);
        setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [playerId]);

  return { snapshot, status };
}