import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {createHistoricalPeerDataset,HISTORICAL_PEER_KEY,PEER_ENTITIES} from "@/utils/historicalPeerCache";

const unpack = response => Array.isArray(response) ? response : response?.items || response?.data || response?.results || [];
const sleep = ms => new Promise(resolve => setTimeout(resolve,ms));
const FIELDS={
  Player:["id","name","position","position_raw"],
  PlayerSeasonStats:["id","player_id","fotmob_player_id","season","competition","team_id","fotmob_team_id","team_name","minutes","appearances","rating","team_matches","metrics"],
  PlayerHistoricalValuation:["id","player_id","season","fifa_fc_overall","transfermarkt_value_eur","fifa_fc_position","historical_position_override","competition_positions"],
  TeamSeasonMatches:["id","team_id","fotmob_team_id","season","competition","team_matches"],
  Team:["id","name","fotmob_id"],
  TeamSeasonPossession:["id","team_id","fotmob_team_id","season","competition","team_possession_pct"],
};
const limited = err => /rate limit|too many requests|429/i.test(String(err?.message||err)) ||
  err?.status === 429 || err?.response?.status === 429;
const timeout = err => /query timed out|timeout|timed out|504|gateway timeout/i.test(String(err?.message||err)) || err?.status===504;
const PAGE_SIZE={Player:300,PlayerSeasonStats:120,PlayerHistoricalValuation:250,TeamSeasonMatches:250,Team:200,TeamSeasonPossession:250};
async function readPage(query){
  // Retry ONLY the unsuccessful page. Never restart the entire population
  // or silently return a truncated dataset after a temporary timeout.
  for(let i=0;i<3;i++){
    try{return await query();}
    catch(error){
      if((!limited(error)&&!timeout(error))||i===2)throw error;
      await sleep(limited(error)?[2500,6000][i]:[500,1500][i]);
    }
  }
}
// Do not publish percentiles based on an unknown/truncated population.
async function allRecords(entityName, maxRecords=20000){
  const result=[];
  let cursor=null;
  const cursors=new Set();
  const pageSize=PAGE_SIZE[entityName]||120;
  for(let index=0;index<Math.ceil(maxRecords/pageSize);index++){
    const options={limit:pageSize,fields:FIELDS[entityName],...(cursor?{cursor}:{})};
    const response=await readPage(()=>base44.entities[entityName].list(options));
    const page=unpack(response);
    result.push(...page);
    const next=response?.next_cursor||response?.nextCursor||null;
    if(next){
      if(next===cursor||cursors.has(next))throw Error("Paginación inconsistente en "+entityName);
      cursors.add(next);cursor=next;
    }else{
      if(response?.has_more===true || (page.length===pageSize && response?.has_more!==false))throw Error("No se puede confirmar que se hayan leído todos los registros de "+entityName+". No se calcularán percentiles incompletos.");
      return result;
    }
    if(page.length===0)throw Error("Página vacía con más registros pendientes en "+entityName);
    // Cursor controls pacing; no artificial sleep after each successful
    // page. 429s are handled with targeted backoff in readPage().
  }
  throw Error("La base de "+entityName+" supera el límite de lectura segura. Es necesario paginar desde el servidor antes de calcular percentiles globales.");
}
export function useHistoricalPeerDataset(enabled = false) {
  return useQuery({
    queryKey:HISTORICAL_PEER_KEY,
    queryFn:async()=>{
      // Two parallel reads at a time: faster than four sequential entities,
      // without the 4+ simultaneous queries that caused 429s.
      const loaded={};
      for(let i=0;i<PEER_ENTITIES.length;i+=2){
        const pair=PEER_ENTITIES.slice(i,i+2);
        const pages=await Promise.all(pair.map(name=>allRecords(name)));
        pair.forEach((name,index)=>{loaded[name]=pages[index];});
      }
      return createHistoricalPeerDataset(loaded);
    },
    enabled,staleTime:30*60*1000,gcTime:60*60*1000,
    refetchOnWindowFocus:false,refetchOnReconnect:false,retry:false,
  });
}