import {readFileSync,writeFileSync} from "node:fs";
import {prepareReview} from "./prepare_stats_review.mjs";
const read=path=>JSON.parse(readFileSync(path,"utf8"));
const reports=[];
for(const pid of process.argv.slice(2)) {
 const input=read(`worker/review/${pid}-extraction.json`),context=read(`worker/review/${pid}-context.json`);
 const baseline=JSON.stringify(context.existing_stats),groups=new Map();
 for(const c of input.candidates) {
  const key=[c.source,c.season,c.competition,c.fotmob_team_id].join("|");
  if(!groups.has(key))groups.set(key,[]);groups.get(key).push(c);
 }
 const results=[];
 for(const [key,candidates] of groups) {
  try {
   const plan=prepareReview({...input,candidates},context).proposals[0];
   results.push({key,status:plan.operation,metrics:plan.record.metrics?.length||0,
    observations:candidates.length,signed:candidates.filter(c=>c.value<0).length,
    national:!!candidates[0].is_national_team});
  } catch(e) {results.push({key,status:"blocked_preserving_existing",reason:e.message});}
 }
 if(JSON.stringify(context.existing_stats)!==baseline)throw Error("Baseline mutated: "+pid);
 const report={pid,player:context.player.name,existing_rows:context.existing_stats.length,
  observations:input.candidates.length,writes:0,baseline_unchanged:true,
  national_groups:results.filter(r=>r.national).length,signed_metrics:input.candidates.filter(c=>c.value<0).length,
  counts:Object.fromEntries([...new Set(results.map(r=>r.status))].map(s=>[s,results.filter(r=>r.status===s).length])),results};
 reports.push(report);
 console.log(JSON.stringify({...report,results:undefined}));
}
writeFileSync("worker/review/additional-player-validation.json",JSON.stringify(reports,null,2));
