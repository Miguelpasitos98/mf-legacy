import React, {useEffect,useState} from "react";
import {compactPositionValue} from "@/utils/compactPositionRatings";

// Prototipo de disposición usando la imagen facilitada por el usuario.
// Solo los números son dinámicos; la ilustración original permanece intacta.
const IMAGE="https://media.base44.com/images/public/6a88359fd43f2af862874b12/6d8135465_ChatGPT_Image_21_ago_2026__12_30_18_4_.png";
// Posiciones del campo anterior: únicamente cambia la capa de indicadores.
const NUMBERS=[
 ["delantero","DL(C)",50,47.5],
 ["mediapunta_por_la_izquierda","EI",24,57.5],
 ["mediapunta_central","MP(C)",50,57.5],
 ["mediapunta_por_la_derecha","ED",76,57.5],
 ["mc_left","MC",39,66.1],
 ["mc_right","MC",61,66.1],
 ["carrilero_izquierdo","CR(I)",18,75.4],
 ["mediocentro","MCD",50,75.4],
 ["carrilero_derecho","CR(D)",82,75.4],
 ["defensa_central","DFC(I)",39,82.2],
 ["defensa_central","DFC(D)",61,82.2],
 ["portero","POR",50,89.1],
];
const ROLE_RANGES=[
 {min:17,max:20,label:"Élite",color:"#08A66C"},
 {min:13,max:16,label:"Muy buena",color:"#7BC74B"},
 {min:9,max:12,label:"Media",color:"#E9C64A"},
 {min:5,max:8,label:"Baja",color:"#F28A38"},
 {min:1,max:4,label:"Muy baja",color:"#DF4554"},
];
const roleColor=(value)=>ROLE_RANGES.find(({min,max})=>value>=min&&value<=max)?.color||"#94A3B8";


const ROLE_SETS={
 CB:[["Ball-Playing Defender","Central que construye con pases y conducción.","build"],["Aggressive Defender","Central que anticipa y presiona.","press"]],
 ST:[["False 9","Delantero que baja a combinar.","drop"],["Poacher","Rematador que ocupa el área.","attack"]],
 W:[["Winger","Extremo que da amplitud.","attack"],["Inverted Winger","Extremo que entra hacia dentro.","drop"]],
 FB:[["Full-Back","Lateral de apoyo por banda.","build"],["Inverted Full-Back","Lateral que ocupa posiciones interiores.","drop"]],
 CM:[["Deep-Lying Playmaker","Organiza la salida del balón.","build"],["Box-to-Box","Recorre ambas áreas.","press"]],
 CAM:[["Advanced Playmaker","Crea juego entre líneas.","drop"],["Shadow Striker","Ataca los espacios de remate.","attack"]],
 GK:[["Traditional Goalkeeper","Protege el área.","defend"],["Sweeper Keeper","Cubre la espalda de la defensa.","build"]]
};
const roleGroup=position=>{
 const v=String(position||"").toUpperCase().trim();
 if(["GK","POR"].includes(v))return "GK";
 if(["CB","DFC","DCB","DCL","DCR"].includes(v))return "CB";
 if(["ST","DC","CF"].includes(v))return "ST";
 if(["RB","LB","LD","LI","RWB","LWB"].includes(v))return "FB";
 if(["LW","RW","EI","ED","LM","RM"].includes(v))return "W";
 if(["CAM","MPC","MP","AMC"].includes(v))return "CAM";
 return "CM";
};
const ZONES={defend:[36,78,64,78,62,87,38,87],build:[35,69,65,69,59,83,41,83],press:[34,62,66,62,60,78,40,78],drop:[35,56,65,56,59,73,41,73],attack:[35,46,65,46,59,62,41,62]};
export default function RoleFieldConcept({ratings={},playerId,position,foot}){
 const roles=ROLE_SETS[roleGroup(position)];
 const key="mf-legacy-role-preview-v1:"+String(playerId||"preview");
 const [active,setActive]=useState(0);
 useEffect(()=>{try{setActive(window.localStorage.getItem(key)==="1"?1:0);}catch{setActive(0);}},[key]);
 const selectRole=i=>{setActive(i);try{window.localStorage.setItem(key,String(i));}catch{}};
 const selected=roles[active];
 const coords=ZONES[selected[2]];
 const left=Number(foot?.left)||0,right=Number(foot?.right)||0;
 const isWide=["W","FB"].includes(roleGroup(position));
 const flip=active===1;
 const shift=isWide&&left!==right?(left>right?!flip:flip?-1:1):0;
 const polygon=coords.map((v,i)=>i%2===0?v+(shift===true?-12:shift===-1?12:0):v).join(" ");

 return <div className="relative w-full" style={{aspectRatio:"3 / 2"}} aria-label="Vista de prueba de roles y posiciones">
  <img className="absolute inset-0 h-full w-full object-contain" src={IMAGE} alt="Roles y campo de fútbol en perspectiva"/>
  <svg className="pointer-events-none absolute inset-0 z-[1] h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    <polygon points={polygon} fill="#05E17B" fillOpacity=".3"/>
  </svg>
  {roles.map((role,i)=><button key={role[0]} type="button" onClick={()=>selectRole(i)} title={role[1]}
    aria-pressed={active===i} className="absolute z-20 flex items-center justify-between rounded-md px-2 text-left font-bold shadow-sm"
    style={{left:"26%",top:i===0?"23.5%":"32%",width:"48%",height:"7.2%",fontSize:"clamp(9px,.85vw,12px)",background:active===i?"#A2F2C9":"#FFFFFF",color:"#10253B"}}>
      <span className="truncate">{role[0]}</span><span className="ml-1 text-[#00A861]">{active===i?"✓":"+"}</span>
    </button>)}
  <span className="pointer-events-none absolute left-[26%] top-[40.5%] z-10 w-[48%] truncate text-center text-[9px] text-slate-600" title={selected[1]}>{selected[1]}</span>
  {NUMBERS.map(([key,label,x,y],i)=>{
    const n=compactPositionValue(ratings,key);
    const tone=roleColor(n);
    return <div key={i} className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center" style={{left:`${x}%`,top:`${y}%`}}>
      <span className="flex items-center justify-center rounded-[5px] px-2 font-black leading-tight text-white shadow-sm" style={{background:tone,fontSize:"clamp(9px,1.1vw,14px)",minWidth:"clamp(21px,2.3vw,30px)",height:"clamp(15px,1.6vw,20px)"}}>{n||"–"}</span>
      <span className="rounded-b-md bg-white px-1.5 text-center font-black leading-tight text-slate-900 shadow-sm" style={{fontSize:"clamp(7px,.73vw,10px)"}}>{label}</span>
    </div>;
  })}

 </div>;
}
