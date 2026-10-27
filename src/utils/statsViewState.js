export const STATS_VIEW_STATE_KEY="mf-legacy.stats.view.v1";
export function readStatsViewState(storage){
  try{
    storage=storage??globalThis.sessionStorage;
    const data=JSON.parse(storage?.getItem(STATS_VIEW_STATE_KEY)||"{}");
    if(!data||typeof data!=="object"||Array.isArray(data))return {};
    const safe={};
    for(const key of ["season","competition","search","viewMode","positionFilter","seasonDisplay","bestMetric","tab","category","sort","sortDirection"])
      if(typeof data[key]==="string"&&data[key].length<=250)safe[key]=data[key];
    for(const key of ["page","minMinutes","scrollTop","scrollLeft"])
      if(Number.isFinite(data[key])&&data[key]>=0)safe[key]=data[key];
    return safe;
  }catch{return {};}
}
export function writeStatsViewState(data,storage){
  try{(storage??globalThis.sessionStorage)?.setItem(STATS_VIEW_STATE_KEY,JSON.stringify(data));}catch{/* Private-mode storage is optional. */}
}
