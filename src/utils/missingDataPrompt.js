// Consulta de estadísticas históricas AUSENTES, independiente de FIFA/Transfermarkt.
// Evitar plantillas extensas precargadas con null: inducen respuestas sin investigación.
const EXCLUDE = /^(?:FC Overall|Valor de mercado|Participación de minutos|Nota FotMob \(percentil\))$/i;
export function buildMissingDataPrompt({playerName,seasons=[],season,role,missing=[]}={}) {
 const name=String(playerName||"").trim()||"Jugador";
 const entries=seasons.length?seasons:[{season,role,missing}];
 const rows=entries.map(row=>({
   season:String(row.season||"").trim(),
   role:String(row.role||"").trim(),
   competitions:[...new Set((row.competitions||[]).map(String).filter(Boolean))],
   missing:[...new Set((row.missing||[]).map(m=>typeof m==="string"?m:m?.name).filter(m=>m&&!EXCLUDE.test(m)))]
 })).filter(row=>row.season&&row.missing.length);
 const blocks=rows.map(row=>[
   "TEMPORADA "+row.season+" · "+(row.role||"posición no confirmada"),
   "Competiciones registradas: "+(row.competitions.length?row.competitions.join(", "):"no especificadas; identificar antes de aportar cifras"),
   "Métricas ausentes: "+row.missing.join("; ")
 ].join("\n")).join("\n\n");
 const format={schema:"mf_legacy_missing_stats_research_v1",player:{name},seasons:[
   {season:"TEMPORADA_REAL",stats:[{metric:"MÉTRICA_ORIGINAL",competition:"COMPETICIÓN_REAL",value:1.23}]}
 ]};
 return [
  "MF LEGACY — INVESTIGACIÓN REAL DE ESTADÍSTICAS AUSENTES",
  "Jugador: "+name,
  "Investiga las "+rows.length+" temporadas enumeradas más abajo. IMPORTANTE: no te limites a reproducir una plantilla con null; busca los datos activamente, temporada por temporada. Si tienes acceso a búsqueda web úsala para consultar fuentes históricas (FotMob, Understat, FBref, etc.). No hace falta devolver enlaces ni citar fuentes.",
  "Necesito VALORES CONCRETOS que permitan completar las estadísticas de rendimiento que faltan en la base de datos. Las temporadas, clubes y competiciones deben coincidir exactamente, sin mezclar competiciones ni inventar valores.",
  "Respeta la métrica y sus unidades: /90, total o porcentaje. No sustituyas un valor por 90 por un total. Si hay minutos y totales contrastados, puedes calcular /90 explicitando que es derivado, pero no estimes números.",
  "No busques FIFA Overall, posición FIFA, Transfermarkt ni participación de minutos: se gestionan por separado. Las métricas derivadas como finalización (xGOT − npxG) solo se calculan cuando ambos componentes existen y están alineados.",
  "",
  blocks,
  "",
  "MODO DE RESPUESTA:",
  "1. Investiga todas las temporadas que puedas cubrir de forma fiable; prioriza los resultados confirmados frente a completar una plantilla vacía.",
  "2. Devuelve SOLO entradas con valor numérico verificable; omite por completo las métricas que no hayas logrado obtener. Nunca rellenes una métrica con un número de otra temporada o competición.",
  "3. Si la investigación es demasiado extensa para una respuesta, entrégala por bloques de temporadas consecutivas, empezando por las más antiguas, e indica en un campo pending_seasons qué temporadas quedan por investigar para continuarlas en el siguiente mensaje.",
  "4. Si no logras obtener NINGÚN valor, responde con un objeto JSON que incluya error_reason explicando el bloqueo real (por ejemplo falta de acceso web o inexistencia de datos históricos). No devuelvas una lista interminable de null.",
  "5. Devuelve exclusivamente un único bloque de código JSON con el formato indicado. La estructura es para revisión e introducción manual por competición; no es el importador de FIFA/Transfermarkt.",
  "Ejemplo de ESTRUCTURA (el valor es ilustrativo y no es un dato de este jugador):",
  JSON.stringify(format,null,2)
 ].join("\n");
}
