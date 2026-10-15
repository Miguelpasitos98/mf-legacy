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
export function ballSecurityFromRecords(records=[],metricTotal){
 if(typeof metricTotal!=="function")throw Error("Falta extractor de totales alineados.");
 const completedNames=["Successful dribbles","Dribbles completed","Dribbles won","Dribbles"];
 const attemptedNames=["Dribbles attempted","Attempted dribbles","Dribble attempts","Total dribbles","Dribbles contested"];
 const dispossessedNames=["Dispossessed","Times dispossessed"];
 let completed=0,attempted=0,dispossessed=0,paired=0,excluded=0;
 for(const row of records){
  const c=metricTotal(row,completedNames);
  const a=metricTotal(row,attemptedNames);
  const d=metricTotal(row,dispossessedNames);
  if([c,a,d].some(v=>v===null)){excluded++;continue;}
  if(c<0||a<0||d<0||c>a){excluded++;continue;}
  completed+=c;attempted+=a;dispossessed+=d;paired++;
 }
 return {value:paired?ballSecurityFromTotals(completed,attempted,dispossessed):null,
  paired,excluded,partial:excluded>0,inputs:paired?{completed,attempted,dispossessed}:null,
  method:BALL_SECURITY_RESEARCH_STATUS};
}
