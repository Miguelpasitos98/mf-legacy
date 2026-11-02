/**
 * Split eligibility from evidence. Missing historical scores must not hide
 * positionally compatible players when NO historical score can be computed.
 * The fallback never turns position fit into a tactical performance score.
 */
export const managerFitScore=(row,scoreMode)=>{
 if(scoreMode==="role")return row?.roleFit?.score??null;
 if(scoreMode==="historical")return row?.historical?.score??null;
 if(scoreMode==="attributes")return row?.advanced?.score??null;
 return row?.fit??null;
};
export function visibleManagerFitCandidates(rows=[],{scoreMode="role",showUnknown=false,minPositionFit=60,limit=100}={}){
 const compatible=rows.filter(row=>row?.fit!==null&&row?.fit!==undefined&&
   Number.isFinite(row.fit)&&row.fit>=minPositionFit);
 const scored=compatible.filter(row=>managerFitScore(row,scoreMode)!==null);
 const fallback=!showUnknown&&scored.length===0&&compatible.length>0&&scoreMode!=="position";
 const display=showUnknown||fallback?compatible:scored;
 const sorted=[...display].sort((a,b)=>{
  const left=managerFitScore(a,scoreMode),right=managerFitScore(b,scoreMode);
  if(!fallback&&left!==null&&right!==null&&right!==left)return right-left;
  if(!fallback&&left===null&&right!==null)return 1;
  if(!fallback&&right===null&&left!==null)return -1;
  return (b.fit??-1)-(a.fit??-1)||(b.quality??-1)-(a.quality??-1)||
   String(a.player?.name||"").localeCompare(String(b.player?.name||""),"es");
 });
 return {rows:sorted.slice(0,limit),fallback,compatibleCount:compatible.length,
  scoredCount:scored.length,unscoredCount:compatible.length-scored.length,shownCount:Math.min(limit,sorted.length)};
}
