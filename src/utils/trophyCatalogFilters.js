import {normaliseSearch} from "./trophyCatalog.js";
// Data-only filters used by the Trophies catalog. Never infer team trophies from its current league.
export function filterCountryOptions(options,search){
 const q=normaliseSearch(search);
 if(!q)return options||[];
 return (options||[]).filter(option=>normaliseSearch(option.label).includes(q));
}

export function countryTrophyIdsFromSections(sections, selectedCountry="all"){
 if(selectedCountry==="all")return null;
 const groups=(sections||[]).filter(group=>selectedCountry==="international"
  ?group.kind==="world"||group.kind==="confederation"
  :group.key===selectedCountry);
 return new Set(groups.flatMap(group=>(group.items||[]).map(trophy=>String(trophy.source_id))));
}

export function verifiedTeamTrophyIds(honours,teamId){
 if(!teamId)return new Set();
 return new Set((honours||[]).filter(honour=>
  honour.recipient_type==="Team"&&honour.verified===true&&
  String(honour.recipient_id)===String(teamId)&&honour.trophy_source_id!=null
 ).map(honour=>String(honour.trophy_source_id)));
}
