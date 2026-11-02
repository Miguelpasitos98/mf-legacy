import {AXES,analyzeTeamBalance} from "./managerTeamBalance.mjs";
import {roleCompatibility} from "./managerFit.mjs";
import {managerFitAttributes} from "./managerFitAttributes.mjs";
import {evaluateTacticalFunctions} from "./managerAdvancedRoles.mjs";
import {applyLineupOverrides} from "./managerLineupSandbox.mjs";

export const OPTIMIZER_GOALS={
 pressure:"Presión",buildup:"Construcción",creation:"Creatividad",
 width:"Amplitud",protection:"Cobertura defensiva",finishing:"Finalización"
};
export const MAX_OPTIMIZER_CHANGES=3;
const MAX_SHORTLIST=12;
const MAX_OTHER_AXIS_DROP=12;
const MAX_INDIVIDUAL_FIT_DROP=15;

const axisValue=(balance,key)=>balance.axes.find(x=>x.key===key)?.score??null;
const completeOverrides=draft=>Object.fromEntries((draft.assignments||[]).map(slot=>[slot.id,String(slot.primary?.player?.id||"")]));
const safeCandidate=member=>member?.membership?.squad_role!=="loan"&&
 !["injured","suspended","unavailable"].includes(member?.membership?.status);
const objectiveCapability=(member,role,profile,goal)=>{
 const f=evaluateTacticalFunctions(member.player,profile,role).options
  .filter(x=>AXES[goal]?.includes(x.id)&&x.score!==null);
 return f.length?Math.max(...f.map(x=>x.score)):null;
};
function candidateOptions(slot,roster,profile,goal,used){
 const choices=[];
 for(const member of roster){
  const id=String(member?.player?.id||"");
  if(!id||used.has(id)||!safeCandidate(member))continue;
  const position=roleCompatibility(member.player,slot.role);
  if(position.fit===null||position.fit<65)continue;
  const capability=objectiveCapability(member,slot.role,profile,goal);
  if(capability===null)continue;
  const totalFit=managerFitAttributes(member.player,slot.role,profile).score;
  if(slot.primary?.estimatedFit!==null&&slot.primary?.estimatedFit!==undefined&&
     (totalFit===null||totalFit<slot.primary.estimatedFit-MAX_INDIVIDUAL_FIT_DROP))continue;
  choices.push({member,positionFit:position.fit,totalFit,capability});
 }
 return choices.sort((a,b)=>b.capability-a.capability||
  (b.totalFit??-1)-(a.totalFit??-1)||b.positionFit-a.positionFit||
  String(a.member.player.name||"").localeCompare(String(b.member.player.name||""))).slice(0,MAX_SHORTLIST);
}
/**
 * Bounded greedy improvement, not global optimization or predictions.
 * Only recommends a measured improvement in an already-evaluable target axis,
 * preserving all previously evaluable other dimensions within guardrails.
 */
export function optimizeTacticalXI({draft,roster=[],profile,goal="pressure",maxChanges=2}={}){
 const empty={status:"insufficient",reason:"",goal,changes:[],overrides:{},before:null,after:null,
  evaluations:0,method:"Búsqueda local acotada; resultado heurístico y revisable."};
 if(!draft?.valid||!profile||!Array.isArray(draft.assignments)||draft.assignments.length!==11){
  return {...empty,reason:"Se necesita un once válido de once plazas y un ADN táctico asignado."};
 }
 if(!Object.hasOwn(OPTIMIZER_GOALS,goal)){
  return {...empty,reason:"Objetivo táctico no reconocido."};
 }
 const starting=analyzeTeamBalance(draft);
 const original=axisValue(starting,goal);
 if(original===null){
  return {...empty,before:starting,after:starting,reason:"El objetivo seleccionado no dispone de dos contribuciones evaluables; no es posible acreditar una mejora."};
 }
 const limit=Math.max(1,Math.min(MAX_OPTIMIZER_CHANGES,Math.floor(Number(maxChanges)||1)));
 let current=draft;
 let currentBalance=starting;
 let overrides=completeOverrides(draft);
 const changes=[];
 let evaluations=0;
 for(let step=0;step<limit;step++){
  let best=null;
  const used=new Set(current.assignments.filter(s=>s.primary).map(s=>String(s.primary.player.id)));
  for(const slot of current.assignments){
   // Only actual substitutions into occupied positions, not invented signings.
   if(!slot.primary)continue;
   for(const candidate of candidateOptions(slot,roster,profile,goal,used)){
    const proposed={...overrides,[slot.id]:String(candidate.member.player.id)};
    const projected=applyLineupOverrides(draft,roster,profile,proposed);
    if(projected.assignments.some(s=>s.invalidOverride)||projected.filled!==draft.filled)continue;
    const balance=analyzeTeamBalance(projected);
    evaluations++;
    const prev=axisValue(currentBalance,goal),next=axisValue(balance,goal);
    if(prev===null||next===null||next<=prev)continue;
    // No other measurable axis may disappear or drop drastically.
    if(currentBalance.axes.some(axis=>{
      if(axis.key===goal||axis.score===null)return false;
      const after=axisValue(balance,axis.key);
      return after===null||after<axis.score-MAX_OTHER_AXIS_DROP;
    }))continue;
    const gained=next-prev;
    if(!best||gained>best.gain||(gained===best.gain&&
      String(candidate.member.player.name).localeCompare(String(best.incomingName))<0)){
      best={slotId:slot.id,role:slot.role,oldName:slot.primary.player.name,
        outgoingId:String(slot.primary.player.id),incomingId:String(candidate.member.player.id),
        incomingName:candidate.member.player.name,individualBefore:slot.primary.estimatedFit??null,
        individualAfter:candidate.totalFit,goalBefore:prev,goalAfter:next,gain:gained,
        nextDraft:projected,nextBalance:balance,overrides:proposed};
    }
   }
  }
  if(!best)break;
  overrides=best.overrides;
  current=best.nextDraft;
  currentBalance=best.nextBalance;
  changes.push({slotId:best.slotId,role:best.role,outgoing:best.oldName,incoming:best.incomingName,
    outgoingId:best.outgoingId,incomingId:best.incomingId,
    goalBefore:best.goalBefore,goalAfter:best.goalAfter,delta:best.gain,
    individualBefore:best.individualBefore,individualAfter:best.individualAfter,
    rationale:`Sustitución en ${best.role}: ${OPTIMIZER_GOALS[goal]} sube ${best.gain} puntos de estimación funcional FM26; no se supera la caída máxima de ${MAX_OTHER_AXIS_DROP} puntos en otros ejes evaluables.`});
 }
 if(!changes.length){
  return {...empty,status:"no_improvement",before:starting,after:starting,
   overrides:completeOverrides(draft),evaluations,
   reason:"No se encontró una sustitución con mejora cuantificable que respete adecuación posicional, datos disponibles y límites de equilibrio."};
 }
 return {status:"suggested",goal,changes,overrides,before:starting,after:currentBalance,
  proposedDraft:current,evaluations,method:empty.method,
  reason:"Propuesta provisional sobre futbolistas de la plantilla registrada; no predice rendimiento real."};
}
