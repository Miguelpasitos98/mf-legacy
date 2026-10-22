// MF LEGACY — provider-safe translation of imported Understat table totals.
// No player identity is inferred: the provider file must have a FotMob player
// ID that belongs to the exact PlayerSeasonStats record.
// The provider's Understat player ID may be unverified; provenance stays visible.
const txt=v=>String(v??"").trim();
const norm=v=>txt(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
const n=v=>v===null||v===undefined||v===""?null:Number.isFinite(Number(v))?Number(v):null;
const leagueCode=v=>{
 const x=norm(v);
 if(["epl","premierleague","englishpremierleague"].includes(x))return "epl";
 if(["laliga","laligasantander","laligaeasports","spanishlaliga","primeradivision"].includes(x))return "laliga";
 if(["bundesliga","germanbundesliga"].includes(x))return "bundesliga";
 if(["seriea","italianseriea"].includes(x))return "seriea";
 if(["ligue1","frenchligue1"].includes(x))return "ligue1";
 if(["rfpl","russianpremierleague","premierligarussia"].includes(x))return "rfpl";
 return "";
};
const clubCode=v=>{
 const x=norm(v);
 if(["rasenballsportleipzig","rbleipzig","leipzig"].includes(x))return "rbleipzig";
 if(["atleticomadrid","atleticodemadrid","atletimadrid"].includes(x))return "atleticomadrid";
 if(["psg","parissaintgermain"].includes(x))return "parissaintgermain";
 return x;
};
const asRows=r=>Array.isArray(r)?r:r?.items||r?.data||r?.results||r?.entities||[];
const metricNames={
 assists:"Assists",goals:"Goals",npg:"Non-penalty goals",
 npxG:"Non-penalty xG",xA:"xA",xG:"xG",xGBuildup:"xG Buildup",xGChain:"xG Chain",
 red_cards:"Red cards",yellow_cards:"Yellow cards"
};
const archiveMark="Understat · exportación manual, identidad Understat no verificada";
export function providerMetricBridge(row){
 if(row?.record_kind!=="understat_summary"||!leagueCode(row.competition))return null;
 const mins=n(row.minutes);
 if(mins===null||mins<30)return null; // ignore 1-minute anomalous season
 if(!txt(row.fotmob_player_id)||(!txt(row.fotmob_team_id)&&!txt(row.team_name)))return null;
 if(!Array.isArray(row.metrics)||!row.metrics.length)return null;
 const sourceMetrics=row.metrics.filter(m=>Object.hasOwn(metricNames,m.name)&&n(m.value)!==null);
 const metrics=sourceMetrics.map(m=>({name:metricNames[m.name],value:n(m.value),
  per90:n(m.per90)??n(m.value)*90/mins,percentile:null,
  source:"Understat",provider_minutes:mins,verification_status:txt(row.status)||"identity_unverified"}));
 metrics.push({name:"Understat minutes",value:mins,
  source:"Understat",provider_minutes:mins,verification_status:txt(row.status)||"identity_unverified"});
 return {...row,metrics};
}
export function eligibleUnderstatSeason(provider,season){
 if(!provider||!season||!leagueCode(provider.competition))return false;
 return txt(provider.fotmob_player_id)===txt(season.fotmob_player_id)&&
  txt(provider.season)===txt(season.season)&&
  (txt(provider.fotmob_team_id)&&txt(season.fotmob_team_id)?
    txt(provider.fotmob_team_id)===txt(season.fotmob_team_id):
    Boolean(txt(provider.team_name)&&txt(season.team_name)&&clubCode(provider.team_name)===clubCode(season.team_name)))&&
  leagueCode(season.competition)===leagueCode(provider.competition)&&
  n(season.minutes)>0;
}
export function enrichUnderstatSeason(season,provider){
 const translated=providerMetricBridge(provider);
 if(!translated||!eligibleUnderstatSeason(translated,season))return {changed:false,row:season,added:0};
 const metrics=Array.isArray(season.metrics)?season.metrics:[];
 const have=new Set(metrics.filter(m=>m?.name).map(m=>norm(m.name)));
 const added=translated.metrics.filter(m=>!have.has(norm(m.name)));
 if(!added.length)return {changed:false,row:season,added:0};
 // Preserve all FotMob/manual metrics. Provider-only fields are labeled.
 // Never overwrite the season's FotMob minutes, games, rating, or club.
 return {changed:true,added:added.length,row:{...season,metrics:[...metrics,...added]}};
}
export async function enrichImportedUnderstat(base44,playerId,fotmobId,onProgress){
 const source=asRows(await base44.entities.PlayerProviderRecord.filter(
  {fotmob_player_id:String(fotmobId),record_kind:"understat_summary"},{limit:100}));
 if(source.length>=100)throw Error("Demasiadas filas Understat, requiere paginación antes de consolidar.");
 const seasons=asRows(await base44.entities.PlayerSeasonStats.filter({player_id:String(playerId)},{limit:350}));
 if(seasons.length>=350)throw Error("Demasiadas temporadas históricas para vincular con seguridad.");
 let updated=0,metricsAdded=0,ambiguous=0,unmatched=0;
 for(const [i,r] of source.entries()){
  const t=providerMetricBridge(r);
  if(!t){unmatched++;continue;}
  const candidates=seasons.filter(s=>eligibleUnderstatSeason(t,s));
  if(candidates.length!==1){if(candidates.length>1)ambiguous++;else unmatched++;continue;}
  const existing=candidates[0];
  const next=enrichUnderstatSeason(existing,t);
  if(!next.changed)continue;
  // Server-side explicit original ID: no creating duplicate season entities.
  await base44.entities.PlayerSeasonStats.update(existing.id,{metrics:next.row.metrics});
  existing.metrics=next.row.metrics;
  updated++;metricsAdded+=next.added;
  onProgress?.("Enlazando estadísticas Understat",i+1,source.length);
 }
 return {seasons:source.length,updated,metricsAdded,ambiguous,unmatched,source:"Understat · dataset local"};
}
