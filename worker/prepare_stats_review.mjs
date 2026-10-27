// Offline only: build exactly the payload that import-review would write after approval.
import {readFileSync,writeFileSync} from "node:fs";
import {pathToFileURL} from "node:url";

const source=readFileSync(new URL("../base44/functions/import-review/entry.js",import.meta.url),"utf8")
 .replace('import {createClientFromRequest} from "npm:@base44/sdk";',"const createClientFromRequest=()=>{throw Error('Offline only');};");
const {seasonPlan}=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));

export function prepareReview(input,context) {
 const player=context.player,links=context.links||[],pid=String(input.fotmob_player_id);
 if(!/^[a-f0-9]{24}$/i.test(player?.id||"")||!links.length||
   links.some(l=>l.player_id!==player.id||String(l.fotmob_player_id)!==pid)||
   !links.some(l=>["manual","verified","confirmed","manual_confirmada","confirmada","automatic_exact_name_unique"].includes(l.verification)))
   throw Error("La instantánea de identidad no contiene una vinculación única y verificada.");
 const groups=new Map();
 for(const c of input.candidates||[]) {
   if(c.kind!=="metric")continue;
   const key=[c.season,c.competition,c.fotmob_team_id,c.fotmob_tournament_id,c.source].join("|");
   if(!groups.has(key))groups.set(key,[]);
   groups.get(key).push({...c,player_id:player.id,fotmob_player_id:pid,job_id:"approval-required-local-preview"});
 }
 const proposals=[];
 for(const candidates of groups.values()) {
   const first=candidates[0];
   const existing=(context.existing_stats||[]).filter(r=>r.player_id===player.id&&r.season===first.season);
   const matching=(first.is_national_team?context.national_teams||[]:context.teams||[])
     .filter(t=>String(t.fotmob_id)===first.fotmob_team_id);
   if(matching.length>1)throw Error("Catálogo con ID FotMob duplicado.");
   const link=matching[0]?(first.is_national_team
     ?{national_team_id:matching[0].id,national_country_id:matching[0].country_id}:{team_id:matching[0].id}):{};
   const plan=seasonPlan(candidates,player,existing,link);
   proposals.push({...plan,season:first.season,competition:first.competition,team_name:first.team_name,
     fotmob_team_id:first.fotmob_team_id,is_national_team:first.is_national_team,
     internal_team_linked:matching.length===1});
 }
 return {approval_required:true,base44_writes:0,player,fotmob_player_id:pid,
   source_results:input.sources,proposals};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
 const [inputFile,contextFile,outputFile]=process.argv.slice(2);
 if(!outputFile)throw Error("Usage: node worker/prepare_stats_review.mjs input.json identity-context.json output.json");
 const read=path=>JSON.parse(readFileSync(path,"utf8").replace(/^\uFEFF/,""));
 const result=prepareReview(read(inputFile),read(contextFile));
 writeFileSync(outputFile,JSON.stringify(result,null,2)+"\n");
 console.log(JSON.stringify({proposed_records:result.proposals.length,observations:result.proposals.reduce((n,p)=>n+p.candidates,0),base44_writes:0}));
}
