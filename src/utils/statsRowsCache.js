// Cache keys and pure updates for STATS. Queries are shared across page mounts.
export const STATS_ROWS_KEY=["mf-legacy","stats","rows","v2"];
export const STATS_DETAIL_KEY=["mf-legacy","stats","detail","v2"];
export const STATS_LAYOUT_KEY=["mf-legacy","stats","layout"];
export const STATS_ROWS_STALE_MS=30*60*1000;
export const STATS_CACHE_GC_MS=3*60*60*1000;
export const statsRowsKey=(season,competition)=>[...STATS_ROWS_KEY,season,competition];
export const statsDetailKey=(kind,id)=>[...STATS_DETAIL_KEY,kind,String(id)];
export const selectStatsRows=(rows,season,competition)=>season==="Todas"&&competition==="Todas"?rows
  :rows.filter(r=>(season==="Todas"||r.season===season)&&(competition==="Todas"||r.competition===competition));
export const flattenStatsPages=data=>{
  const ids=new Set();
  const all=[];
  for(const page of data?.pages||[]){
    for(const row of page.rows||[]){
      if(!row)continue;
      const id=String(row.id||row.external_record_id||"");
      if(id&&ids.has(id))continue;
      if(id)ids.add(id);
      all.push(row);
    }
  }
  return all;
};
export function patchStatsRowsPageData(data,id,patch){
  if(!data?.pages||!id)return data;
  let changed=false;
  const pages=data.pages.map(page=>{
    if(!page.rows?.some(row=>String(row.id)===String(id)))return page;
    changed=true;
    return {...page,rows:page.rows.map(row=>String(row.id)===String(id)?{...row,...patch}:row)};
  });
  return changed?{...data,pages}:data;
}
export function patchStatsDetailData(data,id,patch){
  if(!Array.isArray(data)||!id)return data;
  let changed=false;
  const result=data.map(row=>{
    if(String(row.id)!==String(id))return row;
    changed=true;return {...row,...patch};
  });
  return changed?result:data;
}
export function patchStatsCaches(client,id,patch){
  client.setQueriesData({queryKey:STATS_ROWS_KEY},old=>patchStatsRowsPageData(old,id,patch));
  client.setQueriesData({queryKey:STATS_DETAIL_KEY},old=>patchStatsDetailData(old,id,patch));
}
