// MF Legacy approximation of the public CraftedFC Ball Security tooltip.
// The screenshot describes successful dribbles / (successful dribbles + times
// dispossessed), with low-volume values pulled toward the population midpoint.
// CraftedFC's private smoothing constant is UNKNOWN; this is our own transparent
// symmetric Beta(5,5) regularisation, NOT a reproduction of its internal formula.
export const BALL_SECURITY_RESEARCH_STATUS="mf_legacy_tooltip_approximation_v2";
export const BALL_SECURITY_PRIOR_ACTIONS=10;
const numeric=value=>value!==null&&value!==undefined&&value!==""&&Number.isFinite(Number(value))?Number(value):null;

export function ballSecurityFromTotals(dribbles,dispossessed,{priorActions=BALL_SECURITY_PRIOR_ACTIONS}={}){
 const d=numeric(dribbles),lost=numeric(dispossessed),prior=numeric(priorActions);
 if(d===null||lost===null||prior===null||d<0||lost<0||prior<0||d+lost<=0)return null;
 // 5 notional retained involvements and 5 notional lost involvements.
 // The prior is applied ONCE to the season totals, never per competition.
 return Math.round(((d+prior/2)/(d+lost+prior))*10000)/100;
}

// Use each competition that has BOTH source counts. Missing competitions
// remain excluded, never interpreted as zero. A partial figure is observed
// coverage, not an extrapolated full-season total.
export function ballSecurityFromRecords(records=[],metricTotal){
 if(typeof metricTotal!=="function")throw Error("Falta extractor de totales alineados.");
 // FotMob's Dribbles is successful take-ons, not total dribble attempts.
 // Do not use the success-rate field to fabricate missing counts.
 const dribblesNames=["Successful dribbles","Dribbles completed","Dribbles won","Dribbles","Successful take-ons"];
 const dispossessedNames=["Dispossessed","Times dispossessed"];
 let dribbles=0,dispossessed=0,paired=0,excluded=0,allMinutes=0,coveredMinutes=0;
 let minutesReliable=true;
 const missing=[];
 for(const row of records){
  const totalMinutes=numeric(row.minutes);
  // Partial-coverage acceptance is never inferred from appearance estimates.
  // If the provider has not given ALL actual minutes, coverage is unknown.
  if(totalMinutes===null||totalMinutes<0)minutesReliable=false;
  else allMinutes+=totalMinutes;
  const d=numeric(metricTotal(row,dribblesNames));
  const lost=numeric(metricTotal(row,dispossessedNames));
  const hasDribbles=d!==null&&d>=0,hasDispossessed=lost!==null&&lost>=0;
  if(!hasDribbles||!hasDispossessed){
   excluded++;
   missing.push({
    competition:String(row.competition||"Competición sin identificar"),
    season:String(row.season||""),
    missing:[...(!hasDribbles?["Dribbles"]:[]),...(!hasDispossessed?["Dispossessed"]:[])],
    minutes:totalMinutes
   });
   continue;
  }
  dribbles+=d;dispossessed+=lost;paired++;
  if(totalMinutes!==null&&totalMinutes>=0)coveredMinutes+=totalMinutes;
 }
 const actionCount=dribbles+dispossessed;
 const coveragePct=minutesReliable&&allMinutes>0?Math.round(coveredMinutes/allMinutes*10000)/100:null;
 const partial=excluded>0;
 // Availability is determined by this indicator's own source data,
 // independently of other metrics and without an arbitrary coverage cutoff.
 // Excluded competitions are documented but do not block valid paired rows.
 const provisional=partial&&paired>0&&actionCount>0;
 const eligible=paired>0&&actionCount>0;
 return {
  value:paired&&actionCount>0?ballSecurityFromTotals(dribbles,dispossessed):null,
  rawValue:paired&&actionCount>0?Math.round(dribbles/actionCount*10000)/100:null,
  paired,excluded,partial,eligible,provisional,missing,
  coveragePct,coveredMinutes:minutesReliable?coveredMinutes:null,
  allMinutes:minutesReliable?allMinutes:null,
  coverageReliable:minutesReliable,
  inputs:paired?{dribbles,dispossessed,actions:actionCount}:null,
  smoothing:{priorActions:BALL_SECURITY_PRIOR_ACTIONS,centerPct:50},
  method:BALL_SECURITY_RESEARCH_STATUS
 };
}
