// Option A: faithful base-only, non-recursive, signed fallback reconstructed
// in Codex's 2026-10-15 public-breakdown report. Experimental in MF LEGACY.
// Do NOT replace the existing official MF score or infer missing raw values.
import {WEIGHTS_BY_ROLE,METRIC_NAMES} from "./compositeEngine.js";

const COMMON={
 npxg_p90:{xg_p90:1},
 finishing_xgot_minus_npxg:{npxg_p90:.5,xgot_p90:.5},
 def_actions_poss_adj_p90:{def_actions_p90:1},
 xg_chain_p90:{npxg_p90:.3,xa_p90:.3,goals_p90:.1,xg_plus_xa_p90:.3},
 xg_buildup_p90:{xa_p90:.6,accurate_long_balls_p90:.15,accurate_passes_p90:.15,successful_dribbles_p90:.1},
 aerial_duels_won_pct:{_drop:true},ground_duels_won_pct:{_drop:true},
 dispossessed_p90:{_drop:true},dribbled_past_p90:{_drop:true},
 ball_security:{_drop:true},fc27_ovr:{_drop:true}
};
const OVERRIDES={
 ST:{
  npxg_p90:{xg_p90:.8,goals_p90:.2},
  xg_chain_p90:{xa_p90:.5,xg_p90:.5},
  xg_buildup_p90:{xa_p90:.6,accurate_long_balls_p90:.15,accurate_passes_p90:.15,successful_dribbles_p90:.1}
 },
 GK:{xg_buildup_p90:{accurate_passes_p90:.4,accurate_long_balls_p90:.6}},
 CB:{
  xg_chain_p90:{def_actions_poss_adj_p90:.15,accurate_passes_p90:.45,accurate_long_balls_p90:.4},
  xg_buildup_p90:{def_actions_poss_adj_p90:.15,accurate_passes_p90:.45,accurate_long_balls_p90:.4}
 }
};
export const FALLBACK_RESEARCH_VERSION="codex-2026-10-15-base-only";
export function calculateExperimentalFallback(role,percentiles={}){
 const base=WEIGHTS_BY_ROLE[role];
 if(!base)return {score:null,status:"unknown_role",trace:[],rows:[]};
 const rating=100-Object.values(base).reduce((sum,w)=>sum+w,0);
 const weights={...base,rating};
 const usable=key=>typeof percentiles[key]==="number"&&Number.isFinite(percentiles[key])&&percentiles[key]>=0&&percentiles[key]<=100;
 const effective={},trace=[];
 for(const [key,w] of Object.entries(weights))if(usable(key))effective[key]=w;
 for(const [source,w] of Object.entries(weights)){
  if(usable(source))continue;
  const rule=(OVERRIDES[role]||{})[source]||COMMON[source];
  if(!rule||rule._drop){
   trace.push({source,target:null,weight:w,action:rule?"explicit-drop":"default-renormalize"});
   continue;
  }
  const parts=Object.entries(rule).filter(([key])=>!key.startsWith("_"));
  if(parts.some(([,share])=>!Number.isFinite(share)||share<0)||Math.abs(parts.reduce((s,[,share])=>s+share,0)-1)>.001)
   throw Error("Invalid fallback share for "+role+"/"+source);
  for(const [target,share] of parts){
   const transferred=w*share;
   const action=!(target in weights)?"target-not-in-base":!usable(target)?"target-percentile-missing":"retained";
   if(action==="retained")effective[target]=(effective[target]||0)+transferred;
   trace.push({source,target,weight:transferred,share,action});
  }
 }
 const denominator=Object.values(effective).reduce((sum,w)=>sum+w,0);
 const numerator=Object.entries(effective).reduce((sum,[key,w])=>sum+w*percentiles[key],0);
 const raw=denominator>1e-10?numerator/denominator:null;
 const absBase=Object.values(weights).reduce((sum,w)=>sum+Math.abs(w),0);
 const absPresent=Object.entries(weights).filter(([key])=>usable(key)).reduce((sum,[,w])=>sum+Math.abs(w),0);
 const rows=Object.entries(weights).map(([key,baseWeight])=>({
   key,name:METRIC_NAMES[key]||key,baseWeight,
   effectiveWeight:effective[key]||0,
   percentile:usable(key)?percentiles[key]:null,
   contribution:usable(key)&&raw!==null?(effective[key]||0)*percentiles[key]/denominator:null
 }));
 return {
  role,method:FALLBACK_RESEARCH_VERSION,score:raw===null?null:Math.max(0,Math.min(100,Math.round(raw*100)/100)),
  rawScore:raw,clipped:raw!==null&&(raw<0||raw>100),
  denominator,numerator,baseCoverage:absBase?absPresent/absBase*100:0,
  status:raw===null?"insufficient":"experimental",trace,rows,
  retainedCount:trace.filter(t=>t.action==="retained").length,
  droppedCount:trace.filter(t=>t.action!=="retained").length,
  warning:"Comparación experimental MF LEGACY; fallback observado de CraftedFC, con percentiles propios de nuestra base."
 };
}
