// Construye el texto de consulta para pedir en un chat externo los datos que
// faltan de una temporada concreta. Solo describe el jugador, la temporada y
// los indicadores en blanco; no calcula ni modifica nada.
export function buildMissingDataPrompt({ playerName, season, role, missing = [] }) {
  const name = String(playerName || "").trim() || "el jugador";
  const seasonText = String(season || "").trim() || "la temporada indicada";
  const list = missing.length
    ? missing.map((item) => "- " + item).join("\n")
    : "- (no se detectaron datos en blanco)";
  return [
    "Necesito completar datos históricos de fútbol. Responde solo con lo que puedas confirmar.",
    "",
    "Jugador: " + name,
    "Temporada: " + seasonText,
    "Posición / arquetipo: " + (role || "sin definir"),
    "",
    "Me faltan estos datos de esa temporada:",
    list,
    "",
    "Para cada dato indica el valor y la competición a la que corresponde. Si algún dato no existe o no lo conoces, indícalo como desconocido en lugar de inventarlo.",
  ].join("\n");
}