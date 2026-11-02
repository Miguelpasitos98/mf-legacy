export const MAX_COMPARE=4;
export function toggleCandidate(ids,id){
 const key=String(id);
 if(ids.includes(key))return ids.filter(v=>v!==key);
 return ids.length>=MAX_COMPARE?ids:[...ids,key];
}
export function compareCandidates(rows,ids){
 const byId=new Map(rows.map(r=>[String(r.player.id),r]));
 return ids.map(id=>byId.get(String(id))).filter(Boolean);
}
export function candidateOverview(rows,budgetM=null){
 const known=rows.filter(r=>r.valuation?.eur!=null&&Number.isFinite(Number(r.valuation.eur)));
 const total=known.reduce((sum,r)=>sum+Number(r.valuation.eur),0);
 const budget=budgetM===null||budgetM===""?null:Number(budgetM)*1e6;
 return {selected:rows.length,priced:known.length,missing:rows.length-known.length,totalKnownEur:total,
  budgetEur:budget,withinBudget:budget!==null&&known.length===rows.length?total<=budget:null};
}
