// Solicitud de investigación separada de valoraciones FIFA/Transfermarkt.
// Conserva la agrupación por temporada y los nombres originales de indicadores.
export function buildMissingDataPrompt({playerName, seasons = [], season, role, missing = []} = {}) {
  const name = String(playerName || "").trim() || "el jugador";
  const entries = seasons.length ? seasons : [{season, role, missing}];
  const filtered = entries.map(s => ({
    season: String(s.season || "").trim(),
    role: String(s.role || "").trim(),
    missing: [...new Set((s.missing || []).map(m => typeof m === "string" ? m : m.name).filter(Boolean))]
  })).filter(s => s.season && s.missing.length);
  return [
    "MF LEGACY — ESTADÍSTICAS DE RENDIMIENTO FALTANTES (NO VALORACIONES)",
    "Jugador: " + name,
    "Investiga las métricas que aparecen en blanco, separadas por temporada y competición. No busques FIFA/FC Overall, posición FIFA, Transfermarkt ni PJ Equipo: esos datos pertenecen a otro botón.",
    "",
    "Temporadas e indicadores sin dato:",
    ...filtered.map(s => "TEMPORADA " + s.season + (s.role ? " · arquetipo " + s.role : "") + "\n" + s.missing.map(m => "- " + m).join("\n")),
    "",
    "Busca únicamente cifras reales de cada temporada; no mezcles competiciones, clubes ni temporadas. Distingue total, por 90 minutos y porcentaje. No confundas valores ausentes con cero. No estimes ni inventes. No hace falta citar fuentes ni añadir URLs.",
    "Devuelve exclusivamente un bloque de código JSON válido con la siguiente estructura:",
    JSON.stringify({schema:"mf_legacy_missing_stats_research_v1",player:{name},seasons:filtered.map(s => ({season:s.season,stats:s.missing.map(metric=>({metric,competition:null,value:null}))}))},null,2),
    "Sustituye los null cuando encuentres valores fiables. Especifica competition para cada valor, sin inventarla. Este JSON de investigación NO es el formato del importador de valoraciones históricas; sus estadísticas pueden introducirse mediante el editor de métricas de la competición."
  ].join("\n");
}
