/** Search a private custom-club catalogue without changing its original order. */
export const normalizeClubSearch=value=>String(value??"")
 .normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("es").trim();
export function searchCustomClubs(teams,query="",maxResults=100){
 const tokens=normalizeClubSearch(query).split(/\s+/).filter(Boolean);
 return (Array.isArray(teams)?teams:[])
  .filter(team=>team?.id&&team?.name&&tokens.every(token=>
   normalizeClubSearch([team.name,team.short_name].filter(Boolean).join(" ")).includes(token)))
  .slice()
  .sort((a,b)=>String(a.name).localeCompare(String(b.name),"es",{sensitivity:"base"}))
  .slice(0,maxResults);
}
