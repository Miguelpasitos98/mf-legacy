import {roleCompatibility} from "./managerFit.mjs";
import {managerFitAttributes} from "./managerFitAttributes.mjs";
import {evaluateTacticalFunctions} from "./managerAdvancedRoles.mjs";

/** Read-only draft changes. An explicit empty string means a deliberate vacancy. */
export function applyLineupOverrides(base,roster,profile,overrides={}){
 if(!base?.valid)return base;
 const used=new Set();
 const playerById=new Map(roster.map(x=>[String(x.player.id),x]));
 const assignments=base.assignments.map(slot=>{
  const explicit=Object.prototype.hasOwnProperty.call(overrides,slot.id);
  const playerId=explicit?String(overrides[slot.id]):String(slot.primary?.player.id||"");
  const selected=playerId?playerById.get(playerId):null;
  if(playerId&&(!selected||used.has(playerId)))return {...slot,primary:null,advanced:null,invalidOverride:true};
  if(selected)used.add(playerId);
  const fit=selected?roleCompatibility(selected.player,slot.role):null;
  const model=selected&&profile?managerFitAttributes(selected.player,slot.role,profile):null;
  return {...slot,primary:selected?{...selected,positionFit:fit?.fit??null,estimatedFit:model?.score??null,confidence:model?.confidence||"insufficient"}:null,
   advanced:selected&&profile?evaluateTacticalFunctions(selected.player,profile,slot.role):null,invalidOverride:false};
 });
 return {...base,assignments,filled:assignments.filter(x=>x.primary).length,vacancies:assignments.filter(x=>!x.primary).length,isProvisional:true};
}
export function canChooseLineupPlayer(slotId,playerId,overrides,base){
 if(!playerId)return true;
 const selected=base.assignments.map(slot=>String(Object.prototype.hasOwnProperty.call(overrides,slot.id)?overrides[slot.id]:slot.primary?.player.id||""));
 return !base.assignments.some((slot,i)=>slot.id!==slotId&&selected[i]===String(playerId));
}
