// Research-only workflow: never fills Transfermarkt from guesses or current values.
export function missingMarketSeasons(seasons=[],valuations=[]){
 const known=new Map((valuations||[]).filter(v=>v?.season).map(v=>[String(v.season),v]));
 return [...new Set((seasons||[]).map(String).filter(Boolean))].sort()
   .filter(season=>{
     const value=known.get(season)?.transfermarkt_value_eur;
     return value===null||value===undefined||value===""||!Number.isFinite(Number(value));
   });
}
export function buildMissingMarketPrompt({playerName,fotmobId="",fm26Uid="",seasons=[],valuations=[]}={}){
 const missing=missingMarketSeasons(seasons,valuations);
 const sample={schema:"mf_legacy_historical_import_v1",
  player:{name:String(playerName||"Jugador"),fotmob_id:String(fotmobId||"")},
  valuations:missing.map(season=>({
    season,transfermarkt_value_eur:null,market_value_as_of:null,transfermarkt_source_url:null
  })),team_matches:[]};
 return [
 "MF LEGACY — COMPLETAR VALORES HISTÓRICOS DE TRANSFERMARKT",
 "Jugador: "+String(playerName||"Jugador"),
 "ID FotMob: "+String(fotmobId||""),
 fm26Uid?"ID FM26: "+String(fm26Uid):"",
 "Temporadas que tienen valor AUSENTE en nuestra base: "+missing.join(", ")+".",
 "Investiga EN PROFUNDIDAD la cronología de valores de mercado de Transfermarkt de este futbolista. Consulta el historial de valoraciones por fecha, no la ficha actual. Busca año por año y por temporada. No uses nunca precios de traspaso, valores máximos, interpolaciones ni estimaciones.",
 "Para cada temporada devuelve la ÚLTIMA valoración publicada dentro de la temporada, hasta el 30 de junio (o fin oficial de su calendario), con la FECHA exacta del registro y un enlace de Transfermarkt que permita comprobar el dato. Si la fecha o cantidad no es verificable, deja los tres campos en null.",
 "No completes temporadas distintas de las solicitadas. No incluyas fifa_fc_overall, fifa_fc_position ni otros campos: esta importación debe limitarse al mercado. No uses cero para ausencia. No inventes valores.",
 "Devuelve únicamente un bloque JSON válido con schema mf_legacy_historical_import_v1 y exactamente estas claves por fila. El importador mostrará una vista previa y necesitará autorización individual para modificar registros existentes.",
 JSON.stringify(sample,null,2)
 ].filter(Boolean).join("\n");
}
