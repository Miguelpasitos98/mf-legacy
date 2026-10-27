// Only label normalization is cached. Numeric values and rows are always read
// afresh, so edits cannot leave a stale statistic in the cache.
const keys=new Map();
export function normalizedMetricKey(value){
  const text=String(value??"");
  const cached=keys.get(text);
  if(cached!==undefined)return cached;
  const key=text.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()
    .replace(/%/g,"percent").replace(/[^a-z0-9]/g,"");
  if(keys.size>=4096)keys.clear();
  keys.set(text,key);
  return key;
}
