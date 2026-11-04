import {fifaEditionForSeason} from "./historicalValuation.js";

const text=v=>String(v??"").trim();
const validSeason=s=>/^(?:19|20)\d{2}\/(?:19|20)\d{2}$/.test(s)&&
  Number(s.slice(5))===Number(s.slice(0,4))+1;

/**
 * FIFA/FC recovery is deliberately separate from Transfermarkt and team
 * matches. Existing historic source values must never be overwritten with null
 * or copied from neighboring videogame editions.
 */
export function missingFifaSeasons(seasons=[],valuations=[]){
 const bySeason=new Map(valuations.filter(v=>v?.season).map(v=>[text(v.season),v]));
 return [...new Set((seasons||[]).map(text).filter(validSeason))]
  .filter(season=>{
   const record=bySeason.get(season);
   return !(record&&Number.isInteger(Number(record.fifa_fc_overall))&&
     Number(record.fifa_fc_overall)>=1&&Number(record.fifa_fc_overall)<=99);
  }).sort().reverse();
}
export function buildMissingFifaPrompt({playerName="",fotmobId="",fm26Uid="",seasons=[],valuations=[]}={}){
 const missing=missingFifaSeasons(seasons,valuations);
 const schema={
  schema:"mf_legacy_historical_import_v1",
  player:{name:text(playerName),fotmob_id:text(fotmobId)},
  valuations:missing.map(season=>({
   season,fifa_edition:fifaEditionForSeason(season),fifa_fc_overall:null,
   fifa_fc_position:null,fifa_source_url:null
  })),team_matches:[]
 };
 return [
  "MF LEGACY — RECUPERACIÓN DE OVERALL BASE FIFA / EA FC AUSENTES",
  "Investiga EXCLUSIVAMENTE las temporadas sin Overall que siguen. No repitas las campañas que ya tienen Overall.",
  "Jugador: "+text(playerName),
  fotmobId?"ID FotMob: "+text(fotmobId):"",
  fm26Uid?"UID FM26 (solo referencia de identidad): "+text(fm26Uid):"",
  "Temporadas pendientes: "+(missing.join(", ")||"Ninguna"),
  "Correspondencia OBLIGATORIA por campaña: "+missing.map(s=>s+" = "+fifaEditionForSeason(s)).join("; "),
  "ATENCIÓN ESPECIAL A 2024/2025 = EA SPORTS FC 25. NO uses FC 24 ni FC 26 ni interpolaciones.",
  "Para CADA campaña busca la ficha BASE ORIGINAL del lanzamiento de esa edición (Rare Gold, Common/Silver/Bronze estándar, o carta inicial sin promoción). No aceptes TOTW, TOTS, TOTY, FUTTIES, Evolution, ICON, ratings de mitad de temporada ni cartas promocionales para un jugador activo.",
  "Contrasta el nombre real y, cuando exista, fecha de nacimiento, club y ID EA/FIFA. Homónimos como Vitinha (PSG) y Vitinha (Genoa) SON jugadores distintos. Si hay duda, deja null.",
  "Fuentes orientativas: fichas de base FUT.GG por edición (ruta /25-<ID EA>/ para FC 25), WeFUT y archivos de lanzamiento de FIFA/FC; comprueba el enlace al registro individual exacto, no a la página de búsqueda.",
  "Devuelve Overall entero 1–99, posición principal exacta de la carta base (GK, CB, RB, LB, CDM, CM, CAM, RW, LW, RM, LM, ST, CF, etc.), fifa_edition y fifa_source_url real verificable.",
  "Si solo existe evidencia de Overall y no de posición, deja la posición null. Si no puedes verificar la ficha base, deja el Overall null y OMITE esa fila del resultado. No inventes números ni copies temporadas vecinas.",
  "NO investigues ni devuelvas valores Transfermarkt, market_value_as_of, PJ equipo, lesiones, estadísticas ni atributos FM26. Al importar SOLO se completarán campos FIFA/FC vacíos: el mercado, la fecha y su fuente existentes deben conservarse.",
  "La respuesta debe ser UN ÚNICO objeto JSON válido; sin texto explicativo. Usa schema mf_legacy_historical_import_v1 y mantén el fotmob_id exacto.",
  "Plantilla para las temporadas pendientes (elimina las filas sin Overall verificable):",
  JSON.stringify(schema,null,2)
 ].filter(Boolean).join("\n");
}
