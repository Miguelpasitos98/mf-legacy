export const STATS_VIEW_STATE_KEY="mf-legacy.stats.view.v1";
// STATS conserva sus filtros y su posición en localStorage: en móvil el
// navegador descarta sessionStorage al cambiar de aplicación o recargar.
export function readStatsViewState(storage){
  try{
    const primary=storage??globalThis.localStorage;
    const raw=primary?.getItem(STATS_VIEW_STATE_KEY)??globalThis.sessionStorage?.getItem(STATS_VIEW_STATE_KEY);
    const data=JSON.parse(raw||"{}");
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
  try{(storage??globalThis.localStorage)?.setItem(STATS_VIEW_STATE_KEY,JSON.stringify(data));}catch{/* Private-mode storage is optional. */}
}