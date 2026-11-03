// Independent historical edition and event editor for the Trophy archive.
// TrophyHonour is deliberately not edited or created here.
export const normalizeHistoricalSeason=value=>{
 const raw=String(value||"").trim();
 const match=raw.match(/^(\d{4})\/(\d{2}|\d{4})$/);
 if(!match)return null;
 const start=Number(match[1]);
 const end=Number(match[2].length===4?match[2]:String(start).slice(0,2)+match[2]);
 if(end!==start+1)return null;
 return String(start)+"/"+String(end).slice(-2);
};
export const proposedHistoricalEditionKey=(sourceId,season)=>"mflegacy_"+String(sourceId).replace(/[^A-Za-z0-9_-]/g,"")+"_"+season.replace("/","_");
export const findHistoricalDuplicate=(records,season,excludeId="")=>(records||[]).find(row=>normalizeHistoricalSeason(row.season)===season&&String(row.id)!==String(excludeId))||null;
export function buildHistoricalEditionPayload({draft,trophy,teams=[],countries=[]}){
 const season=normalizeHistoricalSeason(draft.season);
 if(!season)throw Error("Introduce una temporada válida, por ejemplo 2023/24 o 2023/2024.");
 const champion=String(draft.champion_name||"").trim();
 const runner=String(draft.runner_up_name||"").trim();
 if(!champion||!runner)throw Error("Debes indicar el campeón y el subcampeón.");
 if(champion.toLocaleLowerCase("es")===runner.toLocaleLowerCase("es"))throw Error("Campeón y subcampeón deben ser equipos distintos.");
 const teamId=(id,name)=>teams.some(t=>String(t.id)===String(id)&&String(t.name)===String(name))?String(id):"";
 const country=countries.find(c=>String(c.name).toLocaleLowerCase("es")===String(draft.country||"").trim().toLocaleLowerCase("es"));
 const data={
  trophy_id:String(trophy.id),trophy_source_id:String(trophy.source_id),
  edition_key:String(draft.edition_key||proposedHistoricalEditionKey(trophy.source_id,season)),
  season,edition_year:Number(season.slice(0,4))+1,
  competition_name_at_time:String(draft.competition_name_at_time||trophy.name).trim(),
  champion_name:champion,champion_raw:String(draft.champion_raw||champion).trim(),
  champion_team_id:teamId(draft.champion_team_id,champion),
  runner_up_name:runner,runner_up_raw:String(draft.runner_up_raw||runner).trim(),
  runner_up_team_id:teamId(draft.runner_up_team_id,runner),
  stadium_name:String(draft.stadium_name||"").trim(),stadium_id:String(draft.stadium_id||"").trim(),
  city:String(draft.city||"").trim(),country:String(draft.country||"").trim(),country_id:country?.id||"",
  final_score:String(draft.final_score||"").trim(),
  source_dataset:draft.source_dataset||"MF LEGACY · edición manual",
  evidence_type:draft.evidence_type||"manual",
  evidence_note:String(draft.evidence_note||"").trim(),
  verification_status:draft.verification_status||"needs_review",
  is_officially_verified:draft.is_officially_verified===true,
  notes:String(draft.notes||"").trim()
 };
 // New entries never self-attest official verification.
 if(!draft.id){data.verification_status="needs_review";data.is_officially_verified=false;}
 return data;
}
export const historicalEventDefaults=trophy=>({
 season:"",event_type:"historical_context",description_es:"",original_text:"",
 notes:"",source_dataset:"MF LEGACY · edición manual",verification_status:"needs_review",
 trophy_id:String(trophy.id||""),trophy_source_id:String(trophy.source_id||""),is_cancellation:false
});
export function buildHistoricalEventPayload({draft,trophy}){
 const season=normalizeHistoricalSeason(draft.season);
 if(!season)throw Error("Indica una temporada válida para el acontecimiento.");
 const description_es=String(draft.description_es||"").trim();
 if(!description_es)throw Error("Añade una descripción histórica en español.");
 return {
  event_key:draft.event_key||"mflegacy_event_"+String(trophy.source_id)+"_"+Date.now().toString(36),
  trophy_id:String(trophy.id),trophy_source_id:String(trophy.source_id),
  season,event_type:String(draft.event_type||"historical_context"),
  description_es,original_text:String(draft.original_text||"").trim(),
  source_dataset:draft.source_dataset||"MF LEGACY · edición manual",
  evidence_type:draft.evidence_type||"manual",
  verification_status:draft.verification_status||"needs_review",
  is_cancellation:draft.is_cancellation===true,
  notes:String(draft.notes||"").trim()
 };
}
