import {ARCHIVE_SHA256,ARCHIVE_URL,LAST_COMPLETE_SEASON_START,deriveRates,teamKey,leagueKey} from "./core.mjs";

const val=x=>x===null||x===undefined||x===""?null:Number.isFinite(Number(x))?Number(x):null;
const txt=x=>String(x??"").trim();
const norm=x=>txt(x).normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
export const FULL_LEAGUE_NAME={
 epl:"Premier League",laliga:"LaLiga EA Sports",bundesliga:"Bundesliga",
 seriea:"Serie A",ligue1:"Ligue 1",rfpl:"Russian Premier League"
};
const definition=[
 ["goals","Understat Goals",true],["assists","Understat Assists",true],
 ["xG","Understat xG",false],["xA","Understat xA",false],
 ["npxG","Understat npxG",false],["shots","Understat Shots",true],
 ["key_passes","Understat Key passes",true],["npg","Understat Non-penalty goals",true],
 ["yellow_cards","Understat Yellow cards",true],["red_cards","Understat Red cards",true],
 ["games","Understat Matches",true]
];
const collisionAliases={
 understatgoals:["goals","goles"],
 understatassists:["assists","asistencias"],
 understatxg:["xg","expectedgoals"],
 understatxa:["xa","expectedassists"],
 understatnpxg:["xgexclpenalty","nonpenaltyxg","npxg"],
 understatshots:["shots","tiros"],
 understatkeypasses:["keypasses","keypass"],
 understatyellowcards:["yellowcards"],
 understatredcards:["redcards"],
 understatmatches:["matches","appearances"]
};
export function archiveMetrics(source,id){
 const mins=val(source?.minutes);
 if(!(mins>0))return [];
 const provenance={provider:"understat_archive",player_id:id,
  archive_url:ARCHIVE_URL,sha256:ARCHIVE_SHA256,scope:"league_team_season",provider_minutes:mins};
 const meta={unit:"total",source:"understat",provider_minutes:mins,source_url:ARCHIVE_URL,
  verification_status:"verified",provenance};
 const metrics=[];
 for(const [field,name,integer] of definition){
  const n=val(source.stats?.[field]);
  if(n===null||n<0||integer&&!Number.isInteger(n))continue;
  metrics.push({...meta,name,value:n,per90:n*90/mins});
 }
 if(val(source.chain)!==null&&val(source.chain)>=0)
  metrics.push({...meta,name:"xG Chain",value:Number(source.chain),per90:Number(source.chain)*90/mins});
 if(val(source.buildup)!==null&&val(source.buildup)>=0)
  metrics.push({...meta,name:"xG Buildup",value:Number(source.buildup),per90:Number(source.buildup)*90/mins});
 metrics.push({...meta,name:"Understat minutes",value:mins,per90:null});
 return metrics;
}
export function missingMetrics(existing,incoming){
 const old=Array.isArray(existing)?existing:[];
 const indexed=new Map(old.filter(x=>x?.name).map(x=>[norm(x.name),x]));
 return (incoming||[]).filter(m=>{
  const key=norm(m.name),prior=indexed.get(key);
  // Existing values, including genuine zero, always take precedence.
  if(prior&&val(prior.value)!==null)return false;
  if((collisionAliases[key]||[]).some(alias=>val(indexed.get(alias)?.value)!==null))return false;
  if(key==="xgchain"||key==="xgbuildup"){
   if(val(indexed.get(key)?.value)!==null)return false;
  }
  return true;
 });
}
const rowKey=r=>[r.season,r.league,teamKey(r.team)].join("|");
const anyPartialTeam=name=>name.includes(",")||name.includes(";")||name.includes("|");

export function planHistoricalMissing(archiveMap,records,options={}){
 const candidates=[...archiveMap.entries()].map(([understat_id,rows])=>({
  understat_id,club_samples:[...new Set(rows.map(r=>r.team).filter(Boolean))].slice(0,5),
  season_count:[...new Set(rows.map(r=>r.season))].length
 }));
 const inferred=deriveRates(archiveMap,records);
 let id=inferred.status==="verified"?inferred.understat_id:"";
 const manualId=txt(options.understat_id);
 const manual=options.confirm_identity===true&&manualId&&archiveMap.has(manualId);
 if(!id&&manual)id=manualId;
 if(id&&manualId&&id!==manualId)
  return {status:"ambiguous_identity",reason:"El ID Understat confirmado no coincide con el verificado por historial",candidates,proposals:[],skipped:[]};
 if(!id)
  return {status:"needs_identity_confirmation",reason:"Comprueba los clubes y confirma el ID Understat antes de crear temporadas nuevas. El nombre por sí solo no valida la identidad.",candidates,proposals:[],skipped:[]};
 const selected=archiveMap.get(id)||[],counts=new Map();
 for(const s of selected){const key=rowKey(s);counts.set(key,(counts.get(key)||0)+1);}
 const skipped=[],proposals=[];
 for(const source of selected){
  const key=rowKey(source),year=Number(source.season.slice(0,4));
  const skip=reason=>skipped.push({season:source.season,team:source.team,league:source.league,reason});
  if(!FULL_LEAGUE_NAME[source.league]){skip("Competición fuera de las ligas cubiertas");continue}
  if(year>LAST_COMPLETE_SEASON_START){skip("Temporada parcial o posterior a la última campaña completa del archivo");continue}
  if(counts.get(key)!==1){skip("Filas repetidas del mismo club y liga; revisar");continue}
  if(!source.team||anyPartialTeam(source.team)){skip("Temporada agregada de varios clubes; no se asigna a un club inventado");continue}
  if(!(val(source.minutes)>0)){skip("Sin minutos válidos");continue}
  if(val(source.chain)!==null&&val(source.buildup)!==null&&(source.buildup>source.chain||source.chain<0||source.buildup<0)){
    skip("xGChain/xGBuildup incoherentes");continue;
  }
  const matches=records.filter(r=>r?.is_national_team!==true&&
    txt(r.season)===source.season&&leagueKey(r.competition)===source.league&&teamKey(r.team_name)===teamKey(source.team));
  const sameLeague=records.filter(r=>r?.is_national_team!==true&&
    txt(r.season)===source.season&&leagueKey(r.competition)===source.league);
  if(matches.length>1){skip("Coinciden varias fichas STATS; requiere revisión manual");continue}
  if(!matches.length&&sameLeague.length){skip("Ya hay otra ficha del mismo año y liga; no crear posibles duplicados");continue}
  const existing=matches[0]||null;
  const metrics=archiveMetrics(source,id);
  const additions=missingMetrics(existing?.metrics||[],metrics);
  if(!additions.length){skip("Sin nuevas estadísticas: la temporada ya está completa");continue}
  proposals.push({key,season:source.season,team:source.team,league:FULL_LEAGUE_NAME[source.league],
    league_key:source.league,action:existing?"complete":"create",existing_id:existing?.id||null,
    minutes:source.minutes,additions: additions.map(m=>({name:m.name,value:m.value,per90:m.per90})),
    source_metrics:metrics.length,missing_metrics:additions.length});
 }
 proposals.sort((a,b)=>b.season.localeCompare(a.season)||a.team.localeCompare(b.team));
 return {status:manual?"manually_confirmed":"verified",understat_id:id,identity_auto:!manual,
  candidates,proposals,skipped,source_revision:ARCHIVE_SHA256,
  last_full_season:(LAST_COMPLETE_SEASON_START)+"/"+(LAST_COMPLETE_SEASON_START+1)};
}
export function checkedImportCandidate(plan,key){
 if(!plan||!["verified","manually_confirmed"].includes(plan.status))return null;
 return (plan.proposals||[]).find(p=>p.key===key)||null;
}
export function externalArchiveId(understatId,proposal){
 return ["understat",understatId,proposal.season.replace("/","-"),proposal.league_key,
  norm(proposal.team)].join(":");
}
