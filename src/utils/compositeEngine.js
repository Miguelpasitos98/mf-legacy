import {normalizedMetricKey} from "./metricKey.js";
// MF LEGACY Composite v1 — independent estimate, NOT CraftedFC's published Composite.
// Weights transcribed from eight supplied CraftedFC Rating Breakdown screenshots
// (2026-10-14). Only one example per archetype: never claim universal official weights.
// "Rating" is the unshown remaining weight inferred from 100 - sum(shown weights).
export const WEIGHTS_BY_ROLE = {
  ST:{npxg_p90:13,xg_chain_p90:10,fc27_ovr:8,xa_p90:8,xgot_p90:8,market_value:6,finishing_xgot_minus_npxg:5,play_share:5,xg_buildup_p90:5,shots_on_target_p90:4,big_chances_created_p90:3,possession_won_final_3rd_p90:3,aerial_duels_won_pct:2,accurate_long_balls_p90:1,ground_duels_won_pct:1,successful_dribbles_p90:1,dispossessed_p90:-1,dribbled_past_p90:-1},
  W:{xa_p90:15,npxg_p90:10,xg_chain_p90:10,fc27_ovr:8,market_value:6,play_share:5,xg_buildup_p90:5,possession_won_final_3rd_p90:4,xgot_p90:4,ball_security:3,big_chances_created_p90:3,finishing_xgot_minus_npxg:3,ground_duels_won_pct:2,successful_dribbles_p90:2,accurate_long_balls_p90:1,aerial_duels_won_pct:1,dribbled_past_p90:-1},
  CM:{xg_buildup_p90:15,def_actions_poss_adj_p90:10,xa_p90:10,fc27_ovr:8,ground_duels_won_pct:7,xg_chain_p90:7,market_value:6,npxg_p90:5,play_share:5,possession_won_final_3rd_p90:5,aerial_duels_won_pct:4,accurate_long_balls_p90:2,successful_dribbles_p90:2,dispossessed_p90:-2,dribbled_past_p90:-2},
  CAM:{xa_p90:15,xg_chain_p90:12,xg_buildup_p90:9,fc27_ovr:8,npxg_p90:5,play_share:5,market_value:5,possession_won_final_3rd_p90:4,xgot_p90:4,ball_security:3,finishing_xgot_minus_npxg:3,def_actions_poss_adj_p90:2,successful_dribbles_p90:2,accurate_long_balls_p90:1,aerial_duels_won_pct:1,ground_duels_won_pct:1,dribbled_past_p90:-1},
  GK:{goals_prevented_p90:45,fc27_ovr:8,xg_buildup_p90:8,accurate_long_balls_p90:6,market_value:6,play_share:4,save_pct:2,accurate_passes_p90:1},
  CB:{xg_buildup_p90:18,aerial_duels_won_pct:10,def_actions_poss_adj_p90:8,fc27_ovr:8,ground_duels_won_pct:6,market_value:6,npxg_p90:5,play_share:5,xg_chain_p90:5,xa_p90:3,accurate_long_balls_p90:2,dispossessed_p90:-2,dribbled_past_p90:-2},
  FB:{xa_p90:14,xg_buildup_p90:10,xg_chain_p90:9,ground_duels_won_pct:8,fc27_ovr:8,def_actions_poss_adj_p90:6,market_value:6,npxg_p90:5,play_share:5,aerial_duels_won_pct:3,ball_security:3,successful_dribbles_p90:2,dribbled_past_p90:-2},
  // Legacy WB reference retained for historical traceability; all new
  // fullback/wingback comparisons now use the shared FB weights.
  WB:{xa_p90:14,xg_chain_p90:11,ground_duels_won_pct:8,fc27_ovr:8,xg_buildup_p90:7,npxg_p90:6,def_actions_poss_adj_p90:6,market_value:6,play_share:5,aerial_duels_won_pct:3,ball_security:3,successful_dribbles_p90:2,dribbled_past_p90:-2}
};
const POSITION_TO_ROLE={
  ST:"ST",CF:"ST",RW:"W",LW:"W",W:"W",RM:"W",LM:"W",
  MC:"CM",CM:"CM",CAM:"CAM",AM:"CAM",AMC:"CAM",
  GK:"GK",CB:"CB",DC:"CB",
  RB:"FB",LB:"FB",DR:"FB",DL:"FB",LD:"FB",LI:"FB",FB:"FB",
  // Keep a wingback's historical position (e.g. RWB/LWB/CRD/CRI)
  // but compare and score it in the same archetype as RB/LB.
  RWB:"FB",LWB:"FB",WBR:"FB",WBL:"FB",WB:"FB",
  CRD:"FB",CRI:"FB",CAD:"FB",CAI:"FB"
};
// WB remains a legacy weight reference, not a separate active peer group.
export const COMPOSITE_ROLES=Object.keys(WEIGHTS_BY_ROLE).filter(role=>role!=="WB");
export const normalizeRole=position=>{
  const v=String(position??"").trim().toUpperCase().replace(/[^A-Z0-9]/g,"");
  return POSITION_TO_ROLE[v]||null; // Do not silently map DM or unknown positions to CM.
};
// In-memory snapshots generated before this change may still contain WB.
// Fold those peers into FB without rewriting stored player positions.
export const comparisonGroupRole=role=>normalizeRole(role)||String(role??"").trim().toUpperCase()||null;
export const metricName=normalizedMetricKey;
const METRIC_LABELS={
 npxg_p90:["xG excl. penalty","Non-penalty xG","np xG","npxG"],
 xa_p90:["xA","Expected assists"],xgot_p90:["xGOT"],shots_on_target_p90:["Shots on target"],
 big_chances_created_p90:["Big chances created"],possession_won_final_3rd_p90:["Possession won final 3rd"],
 aerial_duels_won_pct:["Aerials won %","Aerial duels won %"],
 accurate_long_balls_p90:["Accurate long balls"],
 successful_dribbles_p90:["Dribbles","Successful dribbles"],
 dispossessed_p90:["Dispossessed"],dribbled_past_p90:["Dribbled past"],
 accurate_passes_p90:["Accurate passes"],
 save_pct:["Save percentage","Save %","Saves %"],
 goals_prevented_p90:["Goals prevented"], // only when FotMob really gives a comparable percentile
};
export const METRIC_NAMES={
 rating:"Nota FotMob (percentil)",npxg_p90:"xG sin penaltis /90",xg_chain_p90:"xG Chain /90", fc27_ovr:"FC Overall",xa_p90:"xA /90",xgot_p90:"xGOT /90",market_value:"Valor de mercado",finishing_xgot_minus_npxg:"Finalización (xGOT - npxG)",play_share:"Participación de minutos",xg_buildup_p90:"xG Buildup /90",shots_on_target_p90:"Tiros a puerta /90",big_chances_created_p90:"Ocasiones claras creadas /90",possession_won_final_3rd_p90:"Recuperaciones en último tercio /90",aerial_duels_won_pct:"Duelos aéreos ganados (%)",accurate_long_balls_p90:"Pases largos precisos /90",ground_duels_won_pct:"Duelos terrestres ganados (%)",successful_dribbles_p90:"Regates completados /90",dispossessed_p90:"Pérdidas de balón /90",dribbled_past_p90:"Regateado /90",ball_security:"Seguridad de balón",def_actions_poss_adj_p90:"Acciones defensivas ajustadas /90",goals_prevented_p90:"Goles evitados /90",save_pct:"Paradas (%)",accurate_passes_p90:"Pases precisos /90"};
const pct=v=>v===null||v===undefined||v===""?null:Number.isFinite(Number(v))&&Number(v)>=0&&Number(v)<=100?Number(v):null;
const round=v=>Math.round(v*100)/100;
export function metricPercentiles(row) {
  const indexed=new Map((row?.metrics||[]).filter(m=>m?.name).map(m=>[metricName(m.name),m]));
  const result={};
  const get=(names)=>{for(const name of names){const p=pct(indexed.get(metricName(name))?.percentile);if(p!==null)return p;}return null;};
  for(const [key,labels] of Object.entries(METRIC_LABELS)){result[key]=get(labels);}
  // A generic duels-won rate mixes aerial and ground duels; do not map it to ground duels.
  // Date-specific FC27 overall / current market value / xG Chain cannot be inferred from historic FotMob.
  result.rating=get(["Rating","FotMob Rating"]);
  return result;
}
// Derived source values; their percentiles require a comparable peer population.
export function derivedCompositeValues(row){
  const map=new Map((row?.metrics||[]).filter(m=>m?.name).map(m=>[metricName(m.name),m]));
  const per90=names=>{
    for(const n of names){
      const value=map.get(metricName(n))?.per90;
      if(value!==null&&value!==undefined&&value!==""&&Number.isFinite(Number(value)))return Number(value);
    }
    return null;
  };
  const value=names=>{
    for(const n of names){
      const v=map.get(metricName(n))?.value;
      if(v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v)))return Number(v);
    }
    return null;
  };
  const xgot=per90(["xGOT"]),npxg=per90(["xG excl. penalty","Non-penalty xG","npxG"]);
  const finishing=xgot===null||npxg===null?null:xgot-npxg;
  const minutes=row?.minutes,teamMatches=row?.team_matches;
  const playShare=Number.isFinite(Number(minutes))&&minutes!==null&&minutes!==""&&Number(teamMatches)>0
    ?Number(minutes)/(Number(teamMatches)*90)*100:null;
  return {
    npxg_p90:npxg,
    xa_p90:per90(["xA","Expected assists"]),
    xgot_p90:xgot,
    shots_on_target_p90:per90(["Shots on target"]),
    big_chances_created_p90:per90(["Big chances created"]),
    possession_won_final_3rd_p90:per90(["Possession won final 3rd"]),
    aerial_duels_won_pct:value(["Aerials won %","Aerial duels won %"]),
    accurate_long_balls_p90:per90(["Accurate long balls"]),
    successful_dribbles_p90:per90(["Dribbles","Successful dribbles"]),
    dispossessed_p90:per90(["Dispossessed"]),
    dribbled_past_p90:per90(["Dribbled past"]),
    accurate_passes_p90:per90(["Accurate passes"]),
    save_pct:value(["Save percentage","Save %","Saves %"]),
    goals_prevented_p90:per90(["Goals prevented"]),
    finishing_xgot_minus_npxg:finishing,
    play_share:playShare
  };
}
export function calculateCompositeMF(row,positionOrRole,percentilesOverride=null,historicalValues=null){
  const role=normalizeRole(positionOrRole)|| (COMPOSITE_ROLES.includes(positionOrRole)?positionOrRole:null);
  if(!role) return {role:null,score:null,coverage:0,status:"unknown_role",rows:[],missing:[]};
  const observed=WEIGHTS_BY_ROLE[role];
  const missingRating=100-Object.values(observed).reduce((a,b)=>a+b,0);
  const weights={...observed,rating:missingRating};
  const input=percentilesOverride||metricPercentiles(row);
  const derived=derivedCompositeValues(row);
  // Connect fc27_ovr and market_value to historical FIFA/FC + Transfermarkt values.
  // These display their real value but receive NO percentile (no invented comparisons).
  if(historicalValues&&historicalValues.fifa_fc_overall!=null)derived.fc27_ovr=historicalValues.fifa_fc_overall;
  if(historicalValues&&historicalValues.transfermarkt_value_eur!=null)derived.market_value=historicalValues.transfermarkt_value_eur;
  // GK: when xG Buildup /90 is unavailable, reallocate its 8 points
  // 60% to accurate long balls /90 and 40% to accurate passes /90.
  // Never transfer weight to a metric without a comparable percentile.
  // Preserve the base weights for traceability in the breakdown.
  const baseWeights={...weights};
  const transferred={};
  if(role==="GK"&&pct(input.xg_buildup_p90)===null){
    const missingWeight=weights.xg_buildup_p90;
    weights.xg_buildup_p90=0;
    for(const [key,fraction] of [["accurate_long_balls_p90",0.6],["accurate_passes_p90",0.4]]){
      if(pct(input[key])!==null){
        weights[key]+=missingWeight*fraction;
        transferred[key]=missingWeight*fraction;
      }
    }
  }
  // CB: redistribute each missing xG participation metric independently.
  // CraftedFC reference: 45% accurate passes, 40% accurate long balls,
  // 15% possession-adjusted defensive actions.
  if(role==="CB"){
    weights.accurate_passes_p90=0;
    baseWeights.accurate_passes_p90=0;
    for(const missing of ["xg_buildup_p90","xg_chain_p90"]){
      if(pct(input[missing])!==null)continue;
      const missingWeight=weights[missing];
      weights[missing]=0;
      for(const [key,fraction] of [["accurate_passes_p90",0.45],["accurate_long_balls_p90",0.40],["def_actions_poss_adj_p90",0.15]]){
        if(pct(input[key])===null)continue;
        const amount=missingWeight*fraction;
        weights[key]+=amount;
        transferred[key]=(transferred[key]||0)+amount;
      }
    }
  }
  const entries=Object.entries(weights);
  const absTotal=entries.reduce((n,[,w])=>n+Math.abs(w),0);
  let presentAbs=0,availableWeight=0,scoreSum=0;
  const rows=entries.map(([key,weight])=>{
    const percentile=pct(input[key]);
    const derivedValue=derived[key]??null;
    if(percentile===null)return {key,name:METRIC_NAMES[key]||key,weight,baseWeight:baseWeights[key],transferred:transferred[key]||0,percentile:null,contribution:null,derivedValue};
    presentAbs+=Math.abs(weight);availableWeight+=weight;
    const contribution=percentile*weight/100;
    scoreSum+=contribution;
    return {key,name:METRIC_NAMES[key]||key,weight,baseWeight:baseWeights[key],transferred:transferred[key]||0,percentile,contribution:round(contribution),derivedValue};
  });
  const coverage=absTotal?presentAbs/absTotal:0;
  // Historical rows have many missing metrics: normalize ONLY observed weights,
  // never pretend this is an official CraftedFC Composite.
  const score=availableWeight>0?Math.min(100,Math.max(0,round(scoreSum*100/availableWeight))):null;
  const count=rows.filter(r=>r.percentile!==null).length;
  return {role,score,coverage:round(coverage*100),count,total:rows.length,observedAdds:round(scoreSum),availableWeight,missing:rows.filter(r=>r.percentile===null).map(r=>r.key),rows,status:count===0?"no_data":coverage===1?"calculated":"partial",method:"MF Legacy: media ponderada de percentiles FotMob disponibles usando baremos observados; pesos negativos conservados."};
}
/**
 * Diagnostic only: remove one observed metric and renormalize with the same
 * composite engine. Does not change the stored score or claim a new rank.
 */
export function analyzeCompositeSensitivity(calculation){
 if(!calculation?.role||calculation.score===null)return [];
 const percentiles=Object.fromEntries(calculation.rows.map(r=>[r.key,r.percentile]));
 return calculation.rows
  .filter(r=>r.percentile!==null&&r.contribution!==null)
  .map(r=>{
   const without=calculateCompositeMF({metrics:[]},calculation.role,{...percentiles,[r.key]:null});
   return {key:r.key,name:r.name,weight:r.weight,adds:r.contribution,
    original:calculation.score,without:without.score,
    delta:without.score===null?null:Math.round((without.score-calculation.score)*100)/100};
  })
  .filter(r=>r.without!==null)
  .sort((a,b)=>Math.abs(b.adds)-Math.abs(a.adds));
}
