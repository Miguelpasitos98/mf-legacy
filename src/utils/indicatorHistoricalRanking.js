import {comparisonGroupRole} from "./compositeEngine.js";
// Same player-season population, role grouping and competition ranking as
// compareHistoricalObservation. Read-only and no global percentiles.
export function indicatorHistoricalRanking(observations=[],role,key,penalty=false){
 const group=comparisonGroupRole(role);
 const population=(observations||[]).filter(o=>comparisonGroupRole(o.role)===group&&
   o.values?.[key]!==null&&o.values?.[key]!==undefined&&
   o.values?.[key]!==""&&Number.isFinite(Number(o.values[key])));
 const sorted=population.map(o=>({...o,value:Number(o.values[key])}))
  .sort((a,b)=>(penalty?a.value-b.value:b.value-a.value)||
    String(a.playerName).localeCompare(String(b.playerName))||
    String(b.season).localeCompare(String(a.season)));
 return sorted.map((o,index)=>{
  const rank=index>0&&o.value===sorted[index-1].value?null:index+1;
  const position=rank??(index>0?sorted.slice(0,index).filter(x=>(penalty?x.value<o.value:x.value>o.value)).length+1:1);
  const n=sorted.length;
  const lower=sorted.filter(x=>x.value<o.value).length;
  const ties=sorted.filter(x=>x.value===o.value).length;
  const percentile=n>=2&&new Set(sorted.map(x=>x.playerId)).size>=2
   ?Math.round(10000*(lower+(ties-1)/2)/(n-1))/100:null;
  return {...o,rank:position,n,percentile};
 });
}
