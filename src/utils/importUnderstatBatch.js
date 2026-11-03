import {understatQueueState} from "./importUnderstatQueue.js";
export function eligibleUnderstatBatchJobs(groups,audits={}){
 const seen=new Set(),out=[];
 for(const group of groups||[]){
  if(!group?.sources?.includes("understat")||group.active)continue;
  const job=group.latest;
  if(!job?.id||seen.has(group.playerId))continue;
  if(!["review","completed"].includes(job.status))continue;
  const kind=understatQueueState(group,audits).kind;
  if(["no_gaps","not_covered"].includes(kind))continue;
  seen.add(group.playerId);
  out.push({job_id:job.id,player_id:group.playerId,player_name:group.playerName||"Jugador"});
 }
 return out;
}
export function initialBulkRun(jobs){
 return {jobs,position:0,active:"",status:"ready",players_reviewed:0,
  seasons_created:0,seasons_completed:0,metrics_added:0,manual_review:0,errors:[],done:[],retries:0};
}
export function afterBulkResult(previous,result,job){
 const s={...previous,done:[...previous.done],errors:[...previous.errors]};
 if(result?.created)s.seasons_created+=Number(result.created)||0;
 if(result?.completed)s.seasons_completed+=Number(result.completed)||0;
 if(result?.metrics_added)s.metrics_added+=Number(result.metrics_added)||0;
 if(result?.status==="manual_review"||result?.status==="identity_required")
  s.manual_review++;
 if(result?.status==="busy"||result?.status==="waiting")
  s.errors.push({name:job.player_name,reason:result.reason||"Trabajo pendiente"});
 if(result?.errors?.length)
  s.errors.push(...result.errors.map(e=>({name:job.player_name,
   reason:e.reason||"Revisión manual requerida"})));
 return s;
}
