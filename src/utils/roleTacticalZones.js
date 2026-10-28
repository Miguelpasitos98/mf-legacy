// Visually indicative tactical activity zones for the existing perspective pitch.
// Does not claim tracked positioning or infer a role: the user chooses the role.
const FAMILIES={
 GK:{cx:50,cy:84,rx:12,ry:6},
 CB:{cx:50,cy:77,rx:21,ry:10},
 FB:{cx:50,cy:73,rx:12,ry:13},
 CM:{cx:50,cy:66,rx:19,ry:10},
 CAM:{cx:50,cy:57,rx:17,ry:9},
 W:{cx:50,cy:57,rx:13,ry:12},
 ST:{cx:50,cy:50,rx:13,ry:7},
};
const LEFT=new Set(["LI","LB","DL","LWB","CAI","CRI","EI","LW","LM"]);
const RIGHT=new Set(["LD","RB","DR","RWB","CAD","CRD","ED","RW","RM"]);
export const tacticalRoleFamily=position=>{
 const value=String(position||"").toUpperCase().trim().replace(/\s+/g,"");
 if(["GK","POR","G"].includes(value))return "GK";
 if(["DFC","CB","DCB","DCL","DCR","DC"].includes(value))return "CB";
 if(["ST","CF","DEL","STRIKER"].includes(value))return "ST";
 if(["RB","LB","LD","LI","LWB","RWB","CAD","CAI","FB"].includes(value))return "FB";
 if(["LW","RW","EI","ED","LM","RM","W"].includes(value))return "W";
 if(["CAM","MPC","MP","AMC","MCO"].includes(value))return "CAM";
 return "CM";
};
export const dominantFoot=foot=>{
 const left=Number(foot?.left),right=Number(foot?.right);
 if(!Number.isFinite(left)||!Number.isFinite(right)||left<1||right<1)return null;
 if(Math.abs(left-right)<3)return null;
 return left>right?"left":"right";
};
const roleVariant=label=>{
 const normalized=String(label||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
 if(/aggressive|destroyer|ball.winning|pressing|front.foot/.test(normalized))return "press";
 if(/libero|box.to.box|overlapping|late runner|sweeper keeper/.test(normalized))return "forward";
 if(/poacher|finisher|goal hunter|shadow striker|space attacker/.test(normalized))return "finish";
 if(/defensive|anchorman|positional goalkeeper|traditional goalkeeper/.test(normalized))return "hold";
 return "normal";
};
export function tacticalZoneForRole(roleName,position,foot){
 if(!String(roleName||"").trim())return null;
 const family=tacticalRoleFamily(position);
 const base=FAMILIES[family];
 const variant=roleVariant(roleName);
 const preferredFoot=dominantFoot(foot);
 const rawPosition=String(position||"").toUpperCase().trim();
 let cx=base.cx;
 if(family==="FB"||family==="W"){
   const invert=/inverted|inside|cut inside/i.test(roleName);
   if(LEFT.has(rawPosition))cx=family==="FB"?22:29;
   else if(RIGHT.has(rawPosition))cx=family==="FB"?78:71;
   else if(preferredFoot)cx=(preferredFoot==="left")!==invert?(family==="FB"?22:29):(family==="FB"?78:71);
 }
 let cy=base.cy;
 if(variant==="press"||variant==="forward")cy-=family==="CB"?5:4;
 if(variant==="finish")cy-=2;
 if(variant==="hold")cy+=2;
 return {...base,cx,cy,family,variant,preferredFoot,
  // Shading follows the real stronger foot. Both-footed/unknown = uniform.
  emphasis:preferredFoot};
}
