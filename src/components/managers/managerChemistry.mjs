/**
 * V11 heuristic complementarities of adjacent tactical jobs.
 * This is not observed match chemistry and never computes a score if player
 * function attributes are missing.
 */
const PAIR_RULES=[
 {type:"Centrales",roles:["CB","CB"],complements:[["ball_playing","cover"]]},
 {type:"Doble pivote",roles:["DM","DM"],complements:[["playmaker","ball_winner"]]},
 {type:"Lateral y extremo",roles:["FB","WG"],complements:[["attacking","inside"],["inverted","wide"]]},
 {type:"Mediocentro y mediapunta",roles:["DM","AM"],complements:[["ball_winner","creator"],["playmaker","runner"]]}
];
const rolePair=(a,b,one,two)=>a.role===one&&b.role===two?[a,b]:a.role===two&&b.role===one?[b,a]:null;
export function analyzeTacticalPartnerships(formationPlan){
 const slots=formationPlan?.assignments||[];
 if(!formationPlan?.valid)return {pairs:[],evaluated:0,unavailable:0};
 const pairs=[];
 for(const rule of PAIR_RULES){
  const candidates=[];
  for(let i=0;i<slots.length;i++)for(let j=i+1;j<slots.length;j++){
   const pair=rolePair(slots[i],slots[j],...rule.roles);
   if(!pair)continue;
   // On wide channels, pair the nearest fullback and winger by left/right
   // layout. For other relations, keep combinations on adjacent lines.
   const [left,right]=pair;
   if(rule.type==="Lateral y extremo"){
    const leftSlots=slots.filter(s=>s.line===left.line);
    const rightSlots=slots.filter(s=>s.line===right.line);
    const side=s=>s.index/(Math.max(1,slots.filter(x=>x.line===s.line).length-1));
    if(Math.abs(side(left)-side(right))>0.45)continue;
   }else if(Math.abs(left.line-right.line)>2)continue;
   candidates.push(pair);
  }
  // At most two representative pairs per tactical category.
  for(const [first,second] of candidates.slice(0,2)){
   const optionsA=first.advanced?.options||[], optionsB=second.advanced?.options||[];
   const combinations=rule.complements.map(([idA,idB])=>{
    const a=optionsA.find(o=>o.id===idA),b=optionsB.find(o=>o.id===idB);
    return a?.score!==null&&a?.score!==undefined&&b?.score!==null&&b?.score!==undefined?
      {score:Math.round((a.score+b.score)/2),a,b}:null;
   }).filter(Boolean).sort((x,y)=>y.score-x.score);
   const preferred=combinations[0]||null;
   pairs.push({type:rule.type,ids:[first.id,second.id],players:[first.primary?.player.name||"Vacante",second.primary?.player.name||"Vacante"],
    score:first.primary&&second.primary?preferred?.score??null:null,
    functions:preferred?[preferred.a.name,preferred.b.name]:[],
    coverage:preferred?Math.min(preferred.a.coverage,preferred.b.coverage):0,
    limitation:"Complementariedad hipotética entre funciones FM26; no demuestra conexiones o automatismos observados en partidos."});
  }
 }
 return {pairs,evaluated:pairs.filter(p=>p.score!==null).length,unavailable:pairs.filter(p=>p.score===null).length};
}
