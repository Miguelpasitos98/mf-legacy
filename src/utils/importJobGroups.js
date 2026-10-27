const dateOf=job=>Date.parse(job.requested_at||job.created_date||"")||0;
const isActive=job=>["running","queued"].includes(job.status);
export function groupImportJobs(jobs=[]){
 const groups=new Map();
 for(const job of jobs){
  // Una persona representa una sola entrada, aunque tenga varios lotes,
  // reintentos o importaciones independientes.
  const key=String(job.player_id||job.fotmob_player_id||job.player_name||job.id);
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(job);
 }
 return [...groups.entries()].map(([playerId,items])=>{
  items.sort((a,b)=>dateOf(b)-dateOf(a)||String(b.id).localeCompare(String(a.id)));
  const active=items.find(isActive);
  const latest=items[0];
  const main=active||latest;
  const sources=[...new Set(items.flatMap(j=>j.sources||[]))];
  const received=items.reduce((n,j)=>n+Math.max(0,Number(j.received_candidates)||0),0);
  const errors=items.filter(j=>j.status==="failed").length;
  const reviews=items.filter(j=>j.status==="review").length;
  const final=active?active.status:reviews?"review":latest.status;
  return {id:playerId,playerId,playerName:latest.player_name||latest.player_id||"Jugador",
    items,latest,main,sources,received,errors,reviews,status:final,active:Boolean(active),
    timestamp:dateOf(latest)};
 }).sort((a,b)=>Number(b.active)-Number(a.active)||b.timestamp-a.timestamp);
}
export function visibleImportGroups(groups,showHistory=false,limit=8){
 return showHistory?groups:groups.filter((g,index)=>g.active||index<limit);
}
