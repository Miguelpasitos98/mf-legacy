// Experimental interpretation of the public CraftedFC "Ball security" tooltip.
// NOT verified as CraftedFC's exact private formula.
// Use paired totals: do not mix seasons/competitions with missing denominators.
export const BALL_SECURITY_RESEARCH_STATUS="experimental-tooltip-derived";
const numeric=value=>value!==null&&value!==undefined&&value!==""&&Number.isFinite(Number(value))?Number(value):null;
export function ballSecurityFromTotals(completed,attempted,dispossessed){
 const c=numeric(completed),a=numeric(attempted),d=numeric(dispossessed);
 if([c,a,d].some(v=>v===null)||c<0||a<0||d<0||c>a||a+d<=0)return null;
 return Math.round((c/(a+d))*10000)/100; // percentage, two decimals
}
// Recover the unique integer attempt count consistent with FotMob's rounded
// success percentage. The source can show one decimal (55.0) while preserving
// a longer unrounded rate (54.9618). Accept either only when unique.
export function inferDribbleAttempts(completed,successRate){
 const c=numeric(completed),rate=numeric(successRate);
 if(c===null||rate===null||!Number.isInteger(c)||c<0||rate<=0||rate>100)return null;
 const center=100*c/rate;
 if(!Number.isFinite(center)||center>1000000)return null;
 const candidates=[];
 const radius=Math.max(2,Math.ceil(center*.003));
 for(let a=Math.max(c,Math.floor(center-radius));a<=Math.ceil(center+radius);a++){
  if(a<=0)continue;
  const calculated=100*c/a;
  // A percentile-like 0-100 success rate is only accepted if it rounds
  // to the reported precision (one decimal) or is numerically more exact.
  if(Math.abs(calculated-rate)<=.0500001)candidates.push(a);
 }
 return candidates.length===1?candidates[0]:null;
}
export function ballSecurityFromRecords(records=[],metricTotal){
 if(typeof metricTotal!=="function")throw Error("Falta extractor de totales alineados.");
 const completedNames=["Successful dribbles","Dribbles completed","Dribbles won","Dribbles"];
 const attemptedNames=["Dribbles attempted","Attempted dribbles","Dribble attempts","Total dribbles","Dribbles contested"];
 const dispossessedNames=["Dispossessed","Times dispossessed"];
 let completed=0,attempted=0,dispossessed=0,paired=0,excluded=0;
 for(const row of records){
  const c=metricTotal(row,completedNames);
  let a=metricTotal(row,attemptedNames);
  if(a===null){
    const rate=metricTotal(row,["Dribbles success rate","Dribble success rate","Successful dribbles %","Dribbles won %"]);
    a=inferDribbleAttempts(c,rate);
  }
  const d=metricTotal(row,dispossessedNames);
  if([c,a,d].some(v=>v===null)){excluded++;continue;}
  if(c<0||a<0||d<0||c>a){excluded++;continue;}
  completed+=c;attempted+=a;dispossessed+=d;paired++;
 }
 return {value:paired?ballSecurityFromTotals(completed,attempted,dispossessed):null,
  paired,excluded,partial:excluded>0,inputs:paired?{completed,attempted,dispossessed}:null,
  method:BALL_SECURITY_RESEARCH_STATUS};
}
