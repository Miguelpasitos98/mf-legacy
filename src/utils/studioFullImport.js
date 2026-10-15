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
