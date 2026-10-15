// Genera el prompt que se copia al portapapeles para valorar un jugador en un
// chat externo: enumera sus temporadas y exige el formato exacto de respuesta,
// incluida la posición impresa en la carta FIFA/FC de cada edición.
// No calcula ni modifica nada: solo construye el texto.

export const VALUATION_CSV_HEADER =
  "Jugador;Temporada;FIFA/FC Overall;Posicion FIFA;Transfermarkt (EUR);Edicion FIFA/FC;Fecha;Fuente";

export function buildValuationPrompt({ playerName, seasons = [], fm26Uid = "", fotmobPlayerId = "" } = {}) {
  const name = String(playerName || "").trim() || "el jugador";
  const list = seasons.map((s) => String(s || "").trim()).filter(Boolean);
  const rows = list.map((s) => name + ";" + s + ";;;;;;");

  return [
    "Actúa como documentalista de fútbol. Necesito la valoración histórica de un jugador, temporada a temporada.",
    "",
    "Jugador: " + name,
    fm26Uid ? "ID FM26: " + fm26Uid : "",
    fotmobPlayerId ? "ID FotMob: " + fotmobPlayerId : "",
    "",
    "Temporadas que necesito:",
    list.length ? list.map((s) => "- " + s).join("\n") : "- (no hay temporadas registradas)",
    "",
    "Para CADA temporada devuélveme estos cuatro datos:",
    "1. FIFA/FC Overall: la media (1-99) de la carta de esa edición.",
    "2. Posicion FIFA: la posición EXACTA impresa en esa carta, tal cual (GK, CB, RB, LB, RWB, LWB, DM, CM, RM, LM, AM, RW, LW, CF, ST). Es la posición del jugador EN ESA TEMPORADA, no la actual. Si no puedes verificarla, deja el campo vacío: no la deduzcas ni la inventes.",
    "3. Transfermarkt (EUR): el valor de mercado en euros, con su fecha. No es el precio de un traspaso.",
    "4. Edicion FIFA/FC y Fuente: la edición del juego (FIFA 23, FC 24…) y el enlace de donde lo has comprobado.",
    "",
    "Reglas:",
    "- Si un dato no existe o no lo puedes confirmar, déjalo vacío. No inventes cifras ni posiciones.",
    "- Cada fila es una temporada concreta: no mezcles ni agrupes temporadas.",
    "- Responde SOLO con la tabla, separada por punto y coma, con esta cabecera exacta y una fila por temporada:",
    "",
    VALUATION_CSV_HEADER,
    ...rows,
  ]
    .filter((line) => line !== "")
    .join("\n");
}