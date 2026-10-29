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

export function ballSecurityFromRecords(records=[],metricTotal){
 if(typeof metricTotal!=="function")throw Error("Falta extractor de totales alineados.");
 // FotMob's Dribbles is successful take-ons, not total dribble attempts.
 // Do not use the success-rate field to fabricate missing counts.
 const dribblesNames=["Successful dribbles","Dribbles completed","Dribbles won","Dribbles","Successful take-ons"];
 const dispossessedNames=["Dispossessed","Times dispossessed"];
 let dribbles=0,dispossessed=0,paired=0,excluded=0;
 for(const row of records){
  const d=numeric(metricTotal(row,dribblesNames));
  const lost=numeric(metricTotal(row,dispossessedNames));
  if(d===null||lost===null||d<0||lost<0){excluded++;continue;}
  dribbles+=d;dispossessed+=lost;paired++;
 }
 const actionCount=dribbles+dispossessed;
 return {
  value:paired&&actionCount>0?ballSecurityFromTotals(dribbles,dispossessed):null,
  rawValue:paired&&actionCount>0?Math.round(dribbles/actionCount*10000)/100:null,
  paired,excluded,partial:excluded>0,
  inputs:paired?{dribbles,dispossessed,actions:actionCount}:null,
  smoothing:{priorActions:BALL_SECURITY_PRIOR_ACTIONS,centerPct:50},
  method:BALL_SECURITY_RESEARCH_STATUS
 };
}
