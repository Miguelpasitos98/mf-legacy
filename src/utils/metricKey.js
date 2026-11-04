// Only label normalization is cached. Numeric values and rows are always read
// afresh, so edits cannot leave a stale statistic in the cache.
const keys=new Map();
const aliases={
  regatesexitos:"dribbles",
  regatescompletados:"dribbles",
  perdidasdebalon:"dispossessed",
  regateado:"dribbledpast",
  accionesdefensivas:"defensiveactions",
  defensivecontributions:"defensiveactions",
  deduelosaereosganadospercent:"aerialswonpercent",
  duelosaereosganadospercent:"aerialswonpercent",
};
export function normalizedMetricKey(value){
  const text=String(value??"");
  const cached=keys.get(text);
  if(cached!==undefined)return cached;
  const normalized=text.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()
    .replace(/%/g,"percent").replace(/[^a-z0-9]/g,"");
  const rate=normalized.endsWith("90");
  const label=rate?normalized.slice(0,-2):normalized;
  const key=Object.hasOwn(aliases,label)?aliases[label]+(rate?"90":""):normalized;
  if(keys.size>=4096)keys.clear();
  keys.set(text,key);
  return key;
}
