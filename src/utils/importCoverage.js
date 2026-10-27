// Identidad de temporada+competición sobre la que FotMob publica playerStats.
// La presencia de métricas en STATS se mide por separado (ImportCandidate review).
const retryable=new Set(["cache_absent","cache_mismatch","candidate_limit","query_failed","provider_paused"]);
const blocked=new Set(["team_unidentified","pending_reconciliation","competition_unidentified","incompatible_response","duplicate_option","access_denied","rate_limited"]);
const unavailable=new Set(["no_statistics","provider_unavailable"]);
const terminal=new Set(["pending_review",...unavailable]);
export function summarizeImportCoverage(jobs,selected){
 if(!selected)return null;
 const root=selected.root_job_id||selected.id;
 const chain=(jobs||[]).filter(j=>j.id===root||j.root_job_id===root)
  .sort((a,b)=>String(a.requested_at||"").localeCompare(String(b.requested_at||"")));
 // Los diagnósticos posteriores reemplazan a los anteriores por la MISMA
 // competición; así nunca contamos la misma temporada dos veces.
 const scopes=new Map();
 for(const job of chain){
  for(const d of job.source_results?.fotmob?.diagnostics||[]){
   if(!d.season||!d.competition||!d.tournament_id)continue;
   const key=[d.season,d.tournament_id,d.competition].join("|");
   if(d.status==="duplicate_option"&&scopes.has(key))continue;
   scopes.set(key,{...d,job_id:job.id});
  }
 }
 const entries=[...scopes.values()];
 const received=entries.filter(d=>d.status==="pending_review").length;
 const missing=entries.filter(d=>retryable.has(d.status)).length;
 const withheld=entries.filter(d=>blocked.has(d.status)).length;
 const noData=entries.filter(d=>unavailable.has(d.status)).length;
 const checked=entries.filter(d=>terminal.has(d.status)).length;
 const running=chain.some(j=>["queued","running"].includes(j.status));
 const stale=chain.some(j=>j.source_results?.fotmob?.coverage?.profile_stale);
 return {root,jobCount:chain.length,total:entries.length,received,missing,
   withheld,noData,checked,running,stale,entries,
   complete:entries.length>0&&!running&&!missing&&!withheld&&!stale,
   limited:entries.some(d=>["rate_limited","access_denied"].includes(d.status))};
}

// Un bloque tiene su propio progreso (0-100), mientras la cobertura de la
// cadena es acumulativa y nunca se reinicia al crear otro trabajo.
export function importProgressSummary(jobs,selected){
 if(!selected)return null;
 const coverage=summarizeImportCoverage(jobs,selected);
 const chain=(jobs||[]).filter(j=>j.id===coverage.root||j.root_job_id===coverage.root)
  .sort((a,b)=>String(a.requested_at||"").localeCompare(String(b.requested_at||"")));
 const current=chain.findLast(j=>["running","queued"].includes(j.status))||chain.at(-1)||selected;
 const progress=Math.max(0,Math.min(100,Number(current.progress)||0));
 const count=coverage.received+coverage.noData;
 const pct=coverage.total?Math.round(100*count/coverage.total):0;
 return {coverage,block:current,blockIndex:chain.findIndex(j=>j.id===current.id)+1,
  blockPercent:progress,coveragePercent:pct,covered:count,total:coverage.total};
}
