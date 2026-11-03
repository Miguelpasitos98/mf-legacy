/**
 * Split eligibility from evidence. Missing historical scores must not hide
 * positionally compatible players when NO historical score can be computed.
 * The fallback never turns position fit into a tactical performance score.
 */
export const managerFitScore=(row,scoreMode)=>{
 if(scoreMode==="deep")return row?.deep?.score??null;
 if(scoreMode==="role")return row?.roleFit?.score??null;
 if(scoreMode==="historical")return row?.historical?.score??null;
 if(scoreMode==="attributes")return row?.advanced?.score??null;
 return row?.fit??null;
};
export function visibleManagerFitCandidates(rows=[],{
 scoreMode="role",showUnknown=false,minPositionFit=60,limit=100,sortMode="score"
}={}){
 const compatible=rows.filter(row=>row?.fit!==null&&row?.fit!==undefined&&
   Number.isFinite(row.fit)&&row.fit>=minPositionFit);
 const scored=compatible.filter(row=>managerFitScore(row,scoreMode)!==null);
 const fallback=!showUnknown&&scored.length===0&&compatible.length>0&&scoreMode!=="position";
 const display=showUnknown||fallback?compatible:scored;
 const confidenceOrder={medium:3,low:2,insufficient:1};
 const sorted=[...display].sort((a,b)=>{
  const left=managerFitScore(a,scoreMode),right=managerFitScore(b,scoreMode);
  // Unscored players are always after scored candidates in non-fallback
  // modes, regardless of the sorting preference.
  if(!fallback&&left===null&&right!==null)return 1;
  if(!fallback&&right===null&&left!==null)return -1;
  if(!fallback&&sortMode==="coverage"&&(scoreMode==="role"||scoreMode==="deep")){
   if(scoreMode==="deep"){
    const coverageDelta=(b.deep?.functions?.coverage??0)-(a.deep?.functions?.coverage??0);
    if(coverageDelta)return coverageDelta;
   }
   const coverageDelta=(b.roleFit?.coverage??0)-(a.roleFit?.coverage??0);
   if(coverageDelta)return coverageDelta;
   const confidenceDelta=(confidenceOrder[b.roleFit?.confidence]||0)-(confidenceOrder[a.roleFit?.confidence]||0);
   if(confidenceDelta)return confidenceDelta;
  }
  if(sortMode==="position"||fallback){
   const positionDelta=(b.fit??-1)-(a.fit??-1);
   if(positionDelta)return positionDelta;
  }
  if(!fallback&&left!==null&&right!==null&&right!==left)return right-left;
  return (b.fit??-1)-(a.fit??-1)||(b.quality??-1)-(a.quality??-1)||
   String(a.player?.name||"").localeCompare(String(b.player?.name||""),"es");
 });
 return {rows:sorted.slice(0,limit),fallback,compatibleCount:compatible.length,
  scoredCount:scored.length,unscoredCount:compatible.length-scored.length,
  displayCount:sorted.length,shownCount:Math.min(limit,sorted.length)};
}
