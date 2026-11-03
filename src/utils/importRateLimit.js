// Base44 entity request budgets are shared with STATS, imports and the worker.
// Preserve Retry-After rather than treating a temporary throttle as missing data.
export function rateLimitDetails(error){
 const message=String(error?.response?.data?.error||error?.data?.error||error?.message||error||"");
 const detected=error?.response?.status===429||
   /rate limit exceeded|entity_list allows|too many requests|retry after/i.test(message);
 if(!detected)return null;
 const seconds=Number(message.match(/retry\s*after\s*(\d+)\s*s?/i)?.[1]||
   error?.response?.data?.retry_after_seconds||60);
 return {seconds:Math.min(600,Math.max(30,Number.isFinite(seconds)?seconds+4:60)),
  message:"Base44 ha limitado temporalmente las consultas. El diagnóstico volverá a intentarse cuando se libere el cupo; las estadísticas guardadas no cambian."};
}
