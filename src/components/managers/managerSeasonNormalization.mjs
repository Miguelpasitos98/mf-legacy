// Kept independent of managerModel so the manual editor and AI parser can
// reuse this without circular module imports.
const validSeason=s=>/^(?:19|20)\d{2}\/(?:19|20)\d{2}$/.test(s)&&
 Number(s.slice(5))===Number(s.slice(0,4))+1;

const text=v=>typeof v==="string"?v.trim():"";
export function normalizeExplicitSeason(value){
 const raw=text(value);
 if(!raw)return "";
 // Only normalize EXPLICIT season pairs. Standalone calendar years are
 // ambiguous (appointment year vs season) and must never be guessed.
 const match=raw.match(/^(?:temporada|campa(?:n|ñ)a)\s*:?[\s]*([\d\s/.-]+)$/i);
 const clean=(match?match[1]:raw).trim().replace(/[‐‑‒–—−]/g,"-");
 const m=clean.match(/^((?:19|20)\d{2})\s*[/.\-]\s*((?:19|20)\d{2}|\d{2})$/);
 if(!m)return "";
 const start=Number(m[1]);
 const shortEnd=Math.floor(start/100)*100+Number(m[2]);
 const end=m[2].length===2?(shortEnd<start?shortEnd+100:shortEnd):Number(m[2]);
 const season=m[1]+"/"+end;
 return validSeason(season)?season:"";
}
function periodRange(value){
 const raw=text(value);
 if(!raw)return null;
 const pattern=/(?:19|20)\d{2}\s*[\/.-]\s*(?:(?:19|20)\d{2}|\d{2})/g;
 const tokens=raw.match(pattern)||[];
 if(tokens.length!==2)return null;
 const [start,end]=tokens.map(normalizeExplicitSeason);
 // Strictly require the remaining characters to be range separators or
 // simple connecting words, not descriptions from which dates are guessed.
 const remainder=raw.replace(pattern,"").replace(/[\s‐‑‒–—−,:;]+/g,"").replace(/^(?:a|al|hasta|to|through|y)$/i,"");
 if(start&&end&&!remainder)return {start,end};
 return null;
}
export function resolveExplicitManagerPeriod(data={},scope){
 const rawStart=text(data.period_start),rawEnd=text(data.period_end),rawSeason=text(data.season);
 const season=normalizeExplicitSeason(rawSeason);
 let start=normalizeExplicitSeason(rawStart),end=normalizeExplicitSeason(rawEnd);
 if(!start&&!end){
  const range=periodRange(rawStart)||periodRange(rawEnd)||periodRange(rawSeason);
  if(range){start=range.start;end=range.end}
 }
 if(scope==="general")return {scope:"general",origin:"structured",season:"",period_start:"",period_end:""};
 if(scope==="season"){
  const current=season||(start&&start===end?start:"");
  if(current)return {scope:"season",origin:"structured",season:current,period_start:"",period_end:""};
 }
 if(scope==="period"||scope==="season"){
  if(start&&end&&start<end)return {scope:"period",origin:"structured",season:"",period_start:start,period_end:end};
  if(start&&end&&start===end)return {scope:"season",origin:"corrected",season:start,period_start:"",period_end:""};
  // Some generated JSON incorrectly labels a single documented season as
  // a period. A real season value is enough to preserve it as a season.
  if(season&&(!start&&!end))return {scope:"season",origin:"corrected",season,period_start:"",period_end:""};
  if(scope==="season"&&(start||end)&&!(start&&end))return {scope:"season",origin:"corrected",season:start||end,period_start:"",period_end:""};
 }
 return {scope:"general",origin:"invalid_dates",season:"",period_start:"",period_end:"",
  raw:{scope,season:rawSeason,period_start:rawStart,period_end:rawEnd}};
}
