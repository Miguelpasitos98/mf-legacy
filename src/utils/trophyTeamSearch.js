import {normaliseSearch} from "./trophyCatalog.js";

// Every Team remains searchable; only the rendered results list is capped.
export function filterTrophyTeams(teams,search){
 const q=normaliseSearch(search);
 const list=(teams||[]).filter(team=>team?.id&&team?.name);
 const matching=q?list.filter(team=>normaliseSearch([
  team.name,team.short_name,team.shortName,team.country,team.city
 ].filter(Boolean).join(" ")).includes(q)):list;
 return matching.sort((a,b)=>{
  if(q){
   const aStarts=normaliseSearch(a.name).startsWith(q),bStarts=normaliseSearch(b.name).startsWith(q);
   if(aStarts!==bStarts)return aStarts?-1:1;
  }
  return String(a.name).localeCompare(String(b.name),"es",{sensitivity:"base"});
 });
}
