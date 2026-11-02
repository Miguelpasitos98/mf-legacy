/** Provisional FM26 function coverage, not measured on-pitch team performance. */
export const AXES={
 pressure:["pressing","ball_winner"],
 buildup:["ball_playing","inverted","playmaker","sweeper","false_nine"],
 creation:["creator","wide","false_nine","playmaker"],
 width:["wide","attacking"],
 protection:["cover","ball_winner","keeper"],
 finishing:["finisher","inside","runner"]
};
export function analyzeTeamBalance(plan){
 const slots=plan?.valid?plan.assignments||[]:[];
 const axes=Object.entries(AXES).map(([key,functions])=>{
  const evidence=new Map();
  for(const slot of slots){
   if(!slot.primary)continue;
   for(const f of slot.advanced?.options||[]){
    if(!functions.includes(f.id)||f.score===null||f.score===undefined)continue;
    const id=String(slot.primary.player.id);
    if(!evidence.has(id)||evidence.get(id).score<f.score)evidence.set(id,{score:f.score,player:slot.primary.player.name,function:f.name});
   }
  }
  const contributors=[...evidence.values()].sort((a,b)=>b.score-a.score);
  return {key,contributors,score:contributors.length>=2?Math.round(contributors.slice(0,3).reduce((n,x)=>n+x.score,0)/Math.min(3,contributors.length)):null};
 });
 return {axes,assessed:axes.filter(x=>x.score!==null).length,filled:slots.filter(x=>x.primary).length,missing:11-slots.filter(x=>x.primary).length};
}
export function compareTeamBalance(a,b){
 return a.axes.map((axis,i)=>({key:axis.key,first:axis.score,second:b.axes[i]?.score??null,
 delta:axis.score!==null&&b.axes[i]?.score!=null?b.axes[i].score-axis.score:null}));
}
