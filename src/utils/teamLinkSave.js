// Timeout-safe, idempotent single-record team link save.
// A timed-out write may already have committed; always read before retrying.
// Never assume a failed network acknowledgement implies the database is unchanged.
export const transientTeamLinkError=err=>/timed out|timeout|connecttimeout|econnreset|network|502|503|504|429|rate limit/i.test(String(err?.message||err||""));
export const teamLinkDelay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function saveTeamLinkSafely({id,teamId,read,update,wait=teamLinkDelay,retries=2}){
 const desired=String(teamId),key=String(id);
 if(!key||!desired)throw Error("Identificadores del registro o equipo ausentes.");
 let lastError=null;
 for(let attempt=0;attempt<=retries;attempt++){
   if(attempt)await wait(600*attempt);
   // The read verifies any previous attempted write and avoids redundant updates.
   try{
     const existing=await read(key);
     if(existing && String(existing.team_id||"")===desired)return {id:key,status:attempt?"confirmed_after_timeout":"already_saved"};
   }catch(error){
     // If we cannot read after a timed-out write, do not blindly retry it:
     // that can overwrite a concurrent edit or misreport the saved state.
     if(attempt>0)throw Error("No se ha podido verificar el resultado anterior. Reintenta cuando Base44 vuelva a responder.");
     if(!transientTeamLinkError(error))throw error;
   }
   try{
     await update(key,{team_id:desired});
     return {id:key,status:"updated"};
   }catch(error){
     lastError=error;
     if(!transientTeamLinkError(error))throw error;
     // First check whether the write was committed despite losing the reply.
     try{
       const confirmed=await read(key);
       if(confirmed && String(confirmed.team_id||"")===desired)return {id:key,status:"confirmed_after_timeout"};
     }catch{}
     if(attempt===retries)break;
   }
 }
 throw Error("Base44 no confirma el guardado. "+String(lastError?.message||"Tiempo de espera agotado"));
}
