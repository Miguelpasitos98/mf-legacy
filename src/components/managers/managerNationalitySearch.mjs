/** Accent-insensitive country lookup using only Countries records. */
export const normalizeCountryLookup=value=>String(value??"").normalize("NFD")
 .replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("es").trim();

export function findManagerNationality(countries,query="",limit=250){
 const terms=normalizeCountryLookup(query).split(/\s+/).filter(Boolean);
 return (Array.isArray(countries)?countries:[])
  .filter(country=>country?.id&&country?.name&&terms.every(term=>
   normalizeCountryLookup([country.name,country.code].filter(Boolean).join(" ")).includes(term)))
  .sort((a,b)=>String(a.name).localeCompare(String(b.name),"es",{sensitivity:"base"}))
  .slice(0,limit);
}
