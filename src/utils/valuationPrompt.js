// Prompt histórico completo para TODAS las temporadas registradas de un jugador.
// Salida exclusiva JSON aceptada por el importador mf_legacy_historical_import_v1.
export function buildValuationPrompt({ playerName, seasons = [], fm26Uid = "", fotmobPlayerId = "" } = {}) {
  const name = String(playerName || "").trim() || "Jugador";
  const unique = [...new Set(seasons.map(s => String(s || "").trim()).filter(Boolean))];
  const sample = {
    schema: "mf_legacy_historical_import_v1",
    player: { name, fotmob_id: String(fotmobPlayerId || "") },
    valuations: unique.map(season => ({
      season, fifa_edition: null, fifa_fc_overall: null,
      fifa_fc_position: null, transfermarkt_value_eur: null
    })),
    team_matches: []
  };
  return [
    "MF LEGACY — INVESTIGACIÓN HISTÓRICA DE TODAS LAS TEMPORADAS",
    "Investiga TODAS las temporadas indicadas del mismo jugador en una sola respuesta.",
    "Jugador: " + name,
    fotmobPlayerId ? "ID FotMob: " + fotmobPlayerId : "",
    fm26Uid ? "ID FM26 (referencia): " + fm26Uid : "",
    "Temporadas registradas (" + unique.length + "): " + unique.join(", "),
    "",
    "Para CADA temporada investiga: edición FIFA/EA SPORTS FC; Overall de la carta base (entero 1–99); posición principal EXACTA de la carta base de esa edición (ST, CF, CAM, CM, etc.); valor de mercado histórico de Transfermarkt en euros enteros, nunca precio de traspaso.",
    "Investiga también los partidos OFICIALES del equipo, por club, competición y temporada, solo cuando puedas identificarlos de manera fiable. Son los PJ del equipo, NO las apariciones del futbolista. En team_matches utiliza season, competition, team_name y team_matches; si conoces IDs exactos puedes incluirlos. No inventes partidos ni competiciones.",
    "Usa la temporada indicada: no sustituyas una posición FIFA histórica por la posición actual ni por la de otra carta o edición. Para campañas finalizadas, prioriza el último valor de mercado disponible al cierre; si conoces la fecha exacta puedes incluir market_value_as_of (AAAA-MM-DD).",
    "No inventes datos. No conviertas ausencias en cero. Escribe null si falta un Overall, una posición FIFA o un valor de mercado; omite de valuations las temporadas sin Overall NI valor de mercado, porque el importador actual no admite filas compuestas solo por la posición.",
    "No incluyas fuentes, enlaces, explicaciones, tablas ni CSV. Devuelve SOLO UN bloque de código JSON válido con schema exacto mf_legacy_historical_import_v1. Conserva el fotmob_id proporcionado; no lo inventes.",
    "Para todas las temporadas con valores disponibles, usa EXACTAMENTE las claves de este ejemplo. Sustituye los null con resultados investigados y conserva las temporadas correctas:",
    JSON.stringify(sample,null,2)
  ].filter(Boolean).join("\n");
}
