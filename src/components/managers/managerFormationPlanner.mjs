import {evaluateTacticalFunctions} from "./managerAdvancedRoles.mjs";
import {roleCompatibility} from "./managerFit.mjs";
import {managerFitAttributes} from "./managerFitAttributes.mjs";
const ROLE_BY_LINE={
  0:{1:["ST"],2:["ST","ST"],3:["WG","ST","WG"],4:["WG","ST","ST","WG"]},
  1:{1:["DM"],2:["DM","DM"],3:["DM","DM","DM"],4:["WG","DM","DM","WG"],5:["WG","DM","DM","DM","WG"]},
  2:{1:["AM"],2:["AM","AM"],3:["WG","AM","WG"],4:["WG","AM","AM","WG"],5:["WG","AM","AM","AM","WG"]},
  3:{1:["AM"],2:["AM","AM"],3:["WG","AM","WG"],4:["WG","AM","AM","WG"],5:["WG","AM","AM","AM","WG"]}
};
export function formationSlots(formation){
 const parts=String(formation||"").split("-").map(Number);
 if(parts.length<2||parts.length>5||parts.some(n=>!Number.isInteger(n)||n<1||n>5)||parts.reduce((a,b)=>a+b,0)!==10||![3,4,5].includes(parts[0]))return {valid:false,reason:"Formación sin distribución reconocible de diez jugadores."};
 const slots=[{id:"GK",role:"GK",line:0,index:0,label:"Portero"}];
 let idx=0;
 const defenders=parts[0]===3?["CB","CB","CB"]:parts[0]===4?["FB","CB","CB","FB"]:["FB","CB","CB","CB","FB"];
 for(const role of defenders)slots.push({id:"D"+idx++,role,line:1,index:idx,label:role==="FB"?"Lateral":"Central"});
 const rest=parts.slice(1);
 rest.forEach((count,i)=>{
  const isLast=i===rest.length-1;
  let roles;
  if(isLast)roles=ROLE_BY_LINE[0][count]||Array.from({length:count},()=> "ST");
  else if(i===0)roles=ROLE_BY_LINE[1][count]||Array.from({length:count},()=> "DM");
  else roles=ROLE_BY_LINE[2][count]||Array.from({length:count},()=> "AM");
  roles.forEach((role,j)=>slots.push({id:"L"+i+"-"+j,role,line:i+2,index:j,label:role}));
 });
 return {valid:true,formation,slots,lines:parts.length+1};
}
export function suggestFormationXI(plan,formation,availableRoster){
 const shape=formationSlots(formation);
 if(!shape.valid||!plan?.valid)return {...shape,assignments:[]};
 const assigned=new Set();
 const members=Array.isArray(availableRoster)?availableRoster:plan.roleSummary.flatMap(x=>x.roster);
 const output=shape.slots.map(slot=>{
  const ranked=members.filter(x=>!assigned.has(String(x.player.id))).map(x=>{
   const position=roleCompatibility(x.player,slot.role);
   const model=plan.profile?managerFitAttributes(x.player,slot.role,plan.profile):null;
   return {...x,positionFit:position.fit,estimatedFit:model?.score??null,
    confidence:model?.confidence||"insufficient"};
  }).filter(x=>x.positionFit!==null).sort((a,b)=>(b.estimatedFit??-1)-(a.estimatedFit??-1)||(b.positionFit??-1)-(a.positionFit??-1));
  const primary=ranked[0]||null;
  if(primary)assigned.add(String(primary.player.id));
  return {...slot,primary,advanced:primary&&plan.profile?evaluateTacticalFunctions(primary.player,plan.profile,slot.role):null};
 });
 const backups=output.map(slot=>{
  const others=members.filter(x=>!assigned.has(String(x.player.id)))
   .map(x=>({...x,positionFit:roleCompatibility(x.player,slot.role).fit}))
   .filter(x=>x.positionFit!==null)
   .sort((a,b)=>(b.positionFit??-1)-(a.positionFit??-1)).slice(0,2);
  return {...slot,alternatives:others};
 });
 return {...shape,assignments:backups,filled:backups.filter(s=>s.primary).length,
  vacancies:backups.filter(s=>!s.primary).length,
  isProvisional:true};
}
