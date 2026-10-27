// Complete snapshots only: a failed/truncated page must never replace cached data.
export const entityRows = result => Array.isArray(result) ? result
  : result?.items || result?.data || result?.results || null;
const abort = signal => { if (signal?.aborted) throw new DOMException("Lectura cancelada", "AbortError"); };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export function createReadScheduler({concurrency=2, now=Date.now, wait=sleep}={}) {
  let active=0, blockedUntil=0;
  const queue=[];
  const drain=()=>{
    while(active<concurrency&&queue.length){
      const task=queue.shift();active++;
      (async()=>{
        abort(task.signal);
        const delay=blockedUntil-now();
        if(delay>0)await wait(delay);
        abort(task.signal);
        return task.run();
      })().then(task.resolve,task.reject).finally(()=>{active--;drain();});
    }
  };
  return {
    run:(run,signal)=>new Promise((resolve,reject)=>{queue.push({run,signal,resolve,reject});drain();}),
    pause:ms=>{blockedUntil=Math.max(blockedUntil,now()+ms);}
  };
}
const scheduler=createReadScheduler();
export function retryDelay(error, attempt=0) {
  const status=error?.status||error?.response?.status;
  const message=String(error?.message||error||"");
  const limited=status===429||/rate limit|too many requests|\b429\b/i.test(message);
  const timedOut=status===504||/query timed out|timeout|timed out|gateway timeout/i.test(message);
  if(!limited&&!timedOut)return null;
  const header=error?.response?.headers;
  const raw=typeof header?.get==="function"?header.get("retry-after"):header?.["retry-after"];
  const match=message.match(/retry\s+after\s+(\d+(?:\.\d+)?)\s*s/i);
  const seconds=Number(match?.[1]||raw);
  return limited?Math.max(Number.isFinite(seconds)&&seconds>0?seconds*1000:0,8000*(attempt+1)):600*(attempt+1);
}
export async function readCompleteRecords(entity,{signal=null,pageSize=500,maxRecords=20000,gate=scheduler,wait=sleep}={}) {
  const result=[],ids=new Set(),cursors=new Set();
  let cursor=null;
  for(let index=0;index<Math.ceil(maxRecords/pageSize);index++){
    abort(signal);
    let response;
    for(let attempt=0;attempt<3;attempt++){
      try{
        response=await gate.run(()=>entity.list(cursor?{cursor,limit:pageSize}:{sort:"-created_date",limit:pageSize}),signal);
        break;
      }catch(error){
        const delay=retryDelay(error,attempt);
        if(delay===null||attempt===2||signal?.aborted)throw error;
        gate.pause(delay);await wait(delay);abort(signal);
      }
    }
    abort(signal);
    const page=entityRows(response);
    if(!Array.isArray(page))throw Error("Respuesta de registros inválida.");
    for(const row of page){
      if(!row?.id||ids.has(String(row.id)))throw Error("Paginación con registros repetidos o sin ID; se conserva la instantánea anterior.");
      ids.add(String(row.id));result.push(row);
    }
    if(result.length>maxRecords)throw Error("Se superó el límite de lectura completa.");
    const next=response?.next_cursor||response?.nextCursor||null;
    if(!next){
      if(response?.has_more===true||(page.length===pageSize&&response?.has_more!==false))
        throw Error("No se puede confirmar la última página; se conserva la instantánea anterior.");
      return result;
    }
    if(response?.has_more===false||!page.length||next===cursor||cursors.has(next))
      throw Error("Cursor de paginación inconsistente; se conserva la instantánea anterior.");
    cursors.add(next);cursor=next;
  }
  throw Error("La base supera el límite de lectura completa; no se publican datos parciales.");
}
export function completeRecordQueryOptions(entity,queryKey,options={}){
  return {queryKey,staleTime:30*60*1000,gcTime:3*60*60*1000,
    refetchOnWindowFocus:false,refetchOnReconnect:false,retry:false,...options,
    queryFn:async({signal})=>{
      const rows=await readCompleteRecords(entity,{signal});
      return rows;
    }};
}
export function completeStatsQueryOptions(entity,queryKey,options={}){
  const base=completeRecordQueryOptions(entity,queryKey,options);
  return {...base,queryFn:async context=>({pages:[{rows:await base.queryFn(context),nextCursor:null,done:true}],pageParams:[null]})};
}
