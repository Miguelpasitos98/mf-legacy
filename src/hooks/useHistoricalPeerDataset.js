import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { buildHistoricalObservations } from "@/utils/historicalPeers";

const unpack = response => Array.isArray(response) ? response : response?.items || response?.data || response?.results || [];
const sleep = ms => new Promise(resolve => setTimeout(resolve,ms));
const limited = err => /rate limit|too many requests|429/i.test(String(err?.message||err)) ||
  err?.status === 429 || err?.response?.status === 429;
async function readPage(query){
  for(let i=0;i<4;i++){
    try{return await query();}
    catch(error){
      if(!limited(error)||i===3)throw error;
      await sleep([3000,6000,12000][i]);
    }
  }
}
// Do not publish percentiles based on an unknown/truncated population.
async function allRecords(entityName, maxRecords=20000){
  const result=[];
  let cursor=null;
  const cursors=new Set();
  for(let index=0;index<Math.ceil(maxRecords/500);index++){
    const options={limit:500,...(cursor?{cursor}:{})};
    const response=await readPage(()=>base44.entities[entityName].list(options));
    const page=unpack(response);
    result.push(...page);
    const next=response?.next_cursor||response?.nextCursor||null;
    if(next){
      if(next===cursor||cursors.has(next))throw Error("Paginación inconsistente en "+entityName);
      cursors.add(next);cursor=next;
    }else{
      if(page.length===500 && response?.has_more!==false)throw Error("No se puede confirmar que se hayan leído todos los registros de "+entityName+". No se calcularán percentiles incompletos.");
      return result;
    }
    if(page.length===0)throw Error("Página vacía con más registros pendientes en "+entityName);
    if(index%3===2)await sleep(700);else await sleep(300);
  }
  throw Error("La base de "+entityName+" supera el límite de lectura segura. Es necesario paginar desde el servidor antes de calcular percentiles globales.");
}
const DATASETS=["Player","PlayerSeasonStats","PlayerHistoricalValuation","TeamSeasonMatches"];
export function useHistoricalPeerDataset() {
  const query=useQuery({
    queryKey:["mf-legacy","historical-peer-dataset","v1"],
    queryFn:async()=>{
      const loaded={};
      // Sequential loading avoids saturating Base44 and keeps each source complete.
      for(const name of DATASETS)loaded[name]=await allRecords(name);
      const observations=buildHistoricalObservations({
        players:loaded.Player,stats:loaded.PlayerSeasonStats,
        valuations:loaded.PlayerHistoricalValuation,teamMatches:loaded.TeamSeasonMatches,
      });
      return {observations,loadedCounts:Object.fromEntries(DATASETS.map(name=>[name,loaded[name].length])),
        loadedAt:new Date().toISOString()};
    },
    enabled:false,staleTime:10*60*1000,refetchOnWindowFocus:false,retry:false,
  });
  return query;
}
