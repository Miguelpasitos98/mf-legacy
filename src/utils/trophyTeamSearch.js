import {normaliseSearch} from "./trophyCatalog.js";

// Every Team remains searchable; only the rendered results list is capped.
export function filterTrophyTeams(teams,search){
 const q=normaliseSearch(search);
 const list=(teams||[]).filter(team=>team?.id&&team?.name);
 const matching=q?list.filter(team=>normaliseSearch([
  team.name,team.short_name,team.shortName,team.country,team.city
 ].filter(Boolean).join(" ")).includes(q)):list;
 const relevance=team=>{
  if(!q)return 9;
  const name=normaliseSearch(team.name),short=normaliseSearch(team.short_name||team.shortName);
  if(name===q||short===q)return 0;
  if(name.startsWith(q))return 1;
  if(short.startsWith(q))return 2;
  if(name.split(/\\s+/).some(part=>part.startsWith(q)))return 3;
  return 4;
 };
 return matching.sort((a,b)=>
  relevance(a)-relevance(b)||String(a.name).localeCompare(String(b.name),"es",{sensitivity:"base"})
 );
}
