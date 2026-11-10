import {normalizeManagerFormation} from "../managers/managerFormationNormalization.mjs";

// Keep the five hand-positioned pitch shapes as editorial presets; generate
// only missing numeric shapes, and preserve their exact line structure.
export const BASE_FORMATIONS={
 "4-3-3":[[50,91,"GK"],[13,73,"LB"],[37,76,"CB1"],[63,76,"CB2"],[87,73,"RB"],[28,50,"CM1"],[50,55,"DM"],[72,50,"CM2"],[16,25,"LW"],[50,19,"ST"],[84,25,"RW"]],
 "4-4-2":[[50,91,"GK"],[13,73,"LB"],[37,76,"CB1"],[63,76,"CB2"],[87,73,"RB"],[13,49,"LM"],[38,53,"CM1"],[62,53,"CM2"],[87,49,"RM"],[36,24,"ST1"],[64,24,"ST2"]],
 "3-5-2":[[50,91,"GK"],[25,73,"CB1"],[50,77,"CB2"],[75,73,"CB3"],[9,51,"LWB"],[33,55,"CM1"],[50,47,"CAM"],[67,55,"CM2"],[91,51,"RWB"],[36,24,"ST1"],[64,24,"ST2"]],
 "4-2-3-1":[[50,91,"GK"],[13,73,"LB"],[37,76,"CB1"],[63,76,"CB2"],[87,73,"RB"],[35,57,"DM1"],[65,57,"DM2"],[15,37,"LW"],[50,37,"CAM"],[85,37,"RW"],[50,17,"ST"]],
 "4-3-1-2":[[50,91,"GK"],[13,73,"LB"],[37,76,"CB1"],[63,76,"CB2"],[87,73,"RB"],[22,54,"CM1"],[50,58,"DM"],[78,54,"CM2"],[50,38,"CAM"],[35,20,"ST1"],[65,20,"ST2"]]
};
const across=(n,low=12,high=88)=>Array.from({length:n},(_,i)=>n===1?50:low+(high-low)*i/(n-1));
export function generateFormation(raw){
 const formation=normalizeManagerFormation(raw);
 if(BASE_FORMATIONS[formation])return BASE_FORMATIONS[formation].map(x=>[...x]);
 const parts=formation.split("-").map(Number);
 const shape=[[50,91,"GK"]];
 const totalLines=parts.length;
 const codes=new Set(["GK"]);
 for(let i=0;i<totalLines;i++){
  const count=parts[i],defense=i===0,attack=i===totalLines-1;
  const y=defense?74:attack?20:74-54*i/(totalLines-1);
  const xValues=across(count,count>=5?9:14,count>=5?91:86);
  xValues.forEach((x,j)=>{
   let code;
   if(defense){
    if(count===4)code=["LB","CB1","CB2","RB"][j];
    else if(count===3)code="CB"+(j+1);
    else if(count===5)code=["LWB","CB1","CB2","CB3","RWB"][j];
    else code="CB"+(j+1);
   }else if(attack){
    if(count===1)code="ST";
    else if(count===2)code="ST"+(j+1);
    else if(count===3)code=["LW","ST","RW"][j];
    else code="ST"+(j+1);
   }else{
    const prefix=i===1?(count===1?"DM":"CM"):"AM";
    code=prefix+(count===1?"":j+1);
    if(count===1)code=prefix;
   }
   if(codes.has(code))code=code+"_L"+i;
   codes.add(code);shape.push([Math.round(x*10)/10,Math.round(y*10)/10,code]);
  });
 }
 if(shape.length!==11||new Set(shape.map(a=>a[2])).size!==11)throw Error("La formación no genera once posiciones únicas");
 return shape;
}
export function assignmentShape(assignment,profiles,managers){
 if(!assignment)return null;
 const profile=profiles.find(p=>String(p.id)===String(assignment.tactical_profile_id)&&String(p.manager_id)===String(assignment.manager_id))||
  profiles.find(p=>String(p.manager_id)===String(assignment.manager_id)&&p.is_default)||
  profiles.find(p=>String(p.manager_id)===String(assignment.manager_id));
 const manager=managers.find(m=>String(m.id)===String(assignment.manager_id));
 if(!profile?.formation)return null;
 try{
  const formation=normalizeManagerFormation(profile.formation);
  generateFormation(formation);
  return {formation,profile,manager,assignment};
 }catch{return null}
}
export function templateName(manager,formation){
 return `Once táctico · ${manager?.display_name||manager?.name||"Entrenador"} · ${formation}`;
}
