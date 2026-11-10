import {retryDelay} from "./entityRecords.js";

const fallbackSeasons=Array.from({length:17},(_,i)=>{
 const year=2025-i;
 return `${year}/${year+1}`;
});
const isSeason=value=>/^(19|20)\d\d\/(19|20)\d\d$/.test(String(value||""));
const rowsOf=value=>Array.isArray(value)?value:value?.items||value?.data||value?.results||null;

// A COMPLETE season is the smallest safe unit for a historical comparison:
// never expose half a competition or a half-loaded season as statistical data.
export async function loadCompleteSeason(entity,season,{pageSize=300,maxRows=9000}={}){
 const all=[],ids=new Set();
 for(let skip=0;skip<maxRows;skip+=pageSize){
  let response;
  for(let attempt=0;attempt<3;attempt++){
   try{
    response=await entity.filter({season},"-created_date",pageSize,skip);
    break;
   }catch(error){
    const delay=retryDelay(error,attempt);
    if(delay===null||attempt===2)throw error;
    await new Promise(resolve=>setTimeout(resolve,delay));
   }
  }
  const rows=rowsOf(response);
  if(!Array.isArray(rows))throw Error("Respuesta inválida para temporada "+season);
  for(const row of rows){
   const id=String(row.id||"");
   if(!id||ids.has(id)||row.season!==season)throw Error("Paginación incoherente en "+season);
   ids.add(id);all.push(row);
  }
  if(rows.length<pageSize)return all;
 }
 throw Error("Límite de filas por temporada: "+season);
}

export async function availableHistoricalSeasons(entity){
 try{
  const response=await entity.list({distinct:"season",limit:500});
  const rows=rowsOf(response);
  if(!Array.isArray(rows)||response?.has_more||rows.length>=500)throw Error("Temporadas incompletas");
  const seasons=[...new Set(rows.filter(isSeason))];
  return seasons.sort((a,b)=>b.localeCompare(a));
 }catch{
  // Fallback only when distinct is unavailable. A season is still downloaded
  // and validated independently; no numbers are estimated or fabricated.
  return fallbackSeasons;
 }
}

