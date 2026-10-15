// Full-fidelity Studio ingestion; source-only data stays distinct from FM26.
const str=v=>v==null?"":String(v).trim();
const num=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))?Number(v):null;
export const STUDIO_FULL_IMPORT_VERSION="v1";
export const STUDIO_LIST_SECTIONS=[
 ["fotmob_market_value_history","market_point"],
 ["historical_valuations","historical_valuation"],
 ["all_season_records","fotmob_season"],
 ["pending_team_review","pending_team"],
 ["source_observations","understat_observation"],
 ["understat_season_summaries","understat_summary"],
 ["transfermarkt_history","transfermarkt_source"],
 ["fifa_fc_history","fifa_source"],
 ["historical_identity_links","identity_evidence"],
 ["historical_source_receipts","source_receipt"],
 ["historical_calendar_receipts","calendar_receipt"],
 ["historical_calendar_conflicts","calendar_conflict"],
 ["existing_base44_historical_valuations","existing_base44_valuation"],
 ["existing_export_historical_valuations","existing_export_valuation"],
 ["historical_conflicts","historical_conflict"],
 ["historical_rejected_rows","historical_rejected"],
 ["historical_unresolved_season_labels","unresolved_season"]
];
export function studioPlayerId(input){
 const snapshot=input?.records?.find(r=>r?.kind==="player");
 return str(input?.summary?.fotmob_id||snapshot?.fotmob_id||
 snapshot?.data?.ids?.fotmob_player_id||input?.fotmob_market_value_receipt?.fotmob_player_id);
}
export function studioSections(input){
 return [...STUDIO_LIST_SECTIONS,...Object.entries(input).filter(([k,v])=>
  Array.isArray(v)&&k!=="records"&&!STUDIO_LIST_SECTIONS.some(([s])=>s===k)).map(([name])=>[name,"extra_source"])];
}
export function studioUnderstatMetrics(summary){
 const totals=summary?.totals||{};
 return Object.entries(totals).filter(([name,v])=>name!=="games"&&name!=="time"&&num(v)!==null)
  .map(([name,v])=>{
   const p=summary?.per90?.[name],published=summary?.published_per90?.[name];
   const rate=num(p?.value)??num(published?.value);
   return {name,value:num(v),...(rate!==null?{per90:rate}:{}),
    provider:"Understat",verification_status:"manual_identity_unverified"};
  });
}
export function studioImportManifest(input,{playerId="",fileHash=""}={}){
 const pid=studioPlayerId(input);
 if(!pid||!/^[0-9]+$/.test(pid))throw Error("Studio JSON sin ID FotMob único.");
 if(input?.schema!=="mf_legacy_external_batch_v1"||!Array.isArray(input.records))
  throw Error("No es un JSON de MF LEGACY Studio.");
 const records=[],kinds={};
 for(const [name,kind] of studioSections(input)){
  if(input[name]!==undefined&&!Array.isArray(input[name]))throw Error("La sección "+name+" no es una lista.");
  const rows=input[name]||[];kinds[name]=rows.length;
  for(let i=0;i<rows.length;i++){
   const x=rows[i]||{};
   const date=str(x.date||x.market_value_as_of||x.fotmob_scisports_as_of);
   const season=str(x.season),comp=typeof x.competition==="string"?x.competition:
    str(x.competition?.understat_league||x.competition?.fotmob_tournament_id);
   const tname=str(x.team_name||x.team?.names?.[0]);
   const sourceRecordId=str(x.record_id||x.observation_id||x.external_record_id||
     x.profile_season_id||[season,comp,i].join(":"));
   const identifier=sourceRecordId.replace(/[^a-zA-Z0-9:_./-]/g,"_").slice(0,220)||String(i);
   const status=kind==="market_point"?"model_estimate":
    kind.startsWith("understat")?"manual_identity_unverified":
    kind==="pending_team"?"pending_review":str(x.verification_status||"source_preserved");
   records.push({record_key:"studio:"+pid+":"+name+":"+identifier,
    player_id:str(playerId),fotmob_player_id:pid,record_kind:kind,
    season,competition:comp,team_name:tname,
    fotmob_team_id:str(x.fotmob_team_id||x.team?.fotmob_team_id),
    provider:kind==="market_point"?"FotMob/SciSports":
      kind.startsWith("understat")?"Understat (manual)":str(x.source||"MF Legacy Studio"),
    source_record_id:sourceRecordId,record_date:date,
    ...(kind==="market_point"&&num(x.value_eur)!==null?{market_value_eur:num(x.value_eur)}:{}),
    ...(kind==="market_point"&&num(x.lower_bound)!==null?{market_lower_eur:num(x.lower_bound)}:{}),
    ...(kind==="market_point"&&num(x.upper_bound)!==null?{market_upper_eur:num(x.upper_bound)}:{}),
    ...(kind==="market_point"?{currency:str(x.currency||"EUR")}:{}),
    ...(kind==="historical_valuation"&&num(x.fifa_fc_overall)!==null?{fifa_fc_overall:num(x.fifa_fc_overall)}:{}),
    ...(kind==="historical_valuation"&&str(x.fifa_fc_position)?{fifa_fc_position:str(x.fifa_fc_position)}:{}),
    ...(kind==="historical_valuation"&&num(x.transfermarkt_value_eur)!==null?{transfermarkt_value_eur:num(x.transfermarkt_value_eur)}:{}),
    ...(kind==="historical_valuation"&&x.market_value_as_of?{transfermarkt_date:str(x.market_value_as_of)}:{}),
    ...(kind==="historical_valuation"&&num(x.fotmob_scisports_value_eur)!==null?{scisports_model_value_eur:num(x.fotmob_scisports_value_eur)}:{}),
    ...(["fotmob_season","understat_summary"].includes(kind)&&num(x.minutes??x.totals?.time)!==null?
     {minutes:num(x.minutes??x.totals?.time)}:{}),
    ...(["fotmob_season","understat_summary"].includes(kind)&&num(x.matches??x.totals?.games)!==null?
     {appearances:num(x.matches??x.totals?.games)}:{}),
    ...(kind==="fotmob_season"&&Array.isArray(x.metrics)?{metrics:x.metrics}:{}),
    ...(kind==="understat_summary"?{metrics:studioUnderstatMetrics(x)}:{}),
    source_verified:!["market_point","understat_observation","understat_summary","pending_team","historical_valuation"].includes(kind)
      &&/^(verified|confirmada)$/i.test(str(x.verification_status)),
    status,payload_json:JSON.stringify(x),source_file_hash:fileHash,snapshot_date:str(input.snapshot_date)});
  }
 }
 return {pid,records,kinds};
}
export function splitStudioArchive(input,{playerId="",fileHash="",sourceFile="",maxChunk=38000}={}){
 if(!/^[a-f0-9]{64}$/.test(fileHash))throw Error("Hash SHA-256 requerido.");
 const pid=studioPlayerId(input);
 if(!pid)throw Error("Falta identidad FotMob.");
 const original=JSON.stringify(input);
 const chunks=[];
 for(let i=0;i<original.length;i+=maxChunk)chunks.push(original.slice(i,i+maxChunk));
 return chunks.map((part,i)=>({record_key:"studio:archive:"+pid+":"+fileHash+":"+i,
  player_id:str(playerId),fotmob_player_id:pid,file_hash:fileHash,source_file:str(sourceFile),
  batch:str(input.batch),chunk_index:i,chunk_total:chunks.length,payload_json:part,
  payload_length:part.length,snapshot_date:str(input.snapshot_date),
  schema_version:str(input.schema),archive_status:"original_full_json"}));
}
export function recoverStudioArchive(rows){
 if(!rows.length)throw Error("No hay fragmentos del archivo.");
 const sorted=[...rows].sort((a,b)=>a.chunk_index-b.chunk_index);
 if(sorted.length!==sorted[0].chunk_total||
    sorted.some((r,i)=>r.chunk_index!==i||r.chunk_total!==sorted.length||
      r.file_hash!==sorted[0].file_hash))throw Error("Archivo incompleto o mezclado.");
 return JSON.parse(sorted.map(r=>r.payload_json).join(""));
}
export function selectStudioWrites(targetRows,existingRows=[]){
 const existing=new Map(existingRows.filter(x=>x.record_key).map(x=>[x.record_key,x]));
 const create=[],update=[],unchanged=[];
 for(const row of targetRows){
  const old=existing.get(row.record_key);
  if(!old)create.push(row);
  else if(old.payload_json===row.payload_json && (!row.player_id||old.player_id===row.player_id))
   unchanged.push(row);
  else update.push({id:old.id,row});
 }
 return {create,update,unchanged};
}
