import React from "react";
import {compactPositionValue} from "@/utils/compactPositionRatings";

// Prototipo de disposición usando la imagen facilitada por el usuario.
// Solo los números son dinámicos; la ilustración original permanece intacta.
const IMAGE="https://media.base44.com/images/public/6a88359fd43f2af862874b12/9e1ed5c44_ChatGPT_Image_21_ago_2026__12_30_18_2_.png";
// Posiciones del campo anterior: únicamente cambia la capa de indicadores.
const NUMBERS=[
 ["delantero","DL(C)",50,41.5],
 ["mediapunta_por_la_izquierda","EI",24,50.3],
 ["mediapunta_central","MP(C)",50,50.3],
 ["mediapunta_por_la_derecha","ED",76,50.3],
 ["mc_left","MC",39,59.3],
 ["mc_right","MC",61,59.3],
 ["carrilero_izquierdo","CR(I)",18,69.5],
 ["mediocentro","MCD",50,69.5],
 ["carrilero_derecho","CR(D)",82,69.5],
 ["defensa_central","DFC(I)",39,77],
 ["defensa_central","DFC(D)",61,77],
 ["portero","POR",50,85.1],
];
export default function RoleFieldConcept({ratings={}}){
 return <div className="relative w-full" style={{aspectRatio:"3 / 2"}} aria-label="Vista de prueba de roles y posiciones">
  <img className="absolute inset-0 h-full w-full object-contain" src={IMAGE} alt="Roles y campo de fútbol en perspectiva"/>
  {NUMBERS.map(([key,label,x,y],i)=>{
    const n=compactPositionValue(ratings,key);
    const tone=n>=16?"#079a56":n>=12?"#30a666":n>=7?"#ed8615":n>=2?"#ea6135":"#d74755";
    return <div key={i} className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center" style={{left:`${x}%`,top:`${y}%`}}>
      <span className="flex items-center justify-center rounded-[5px] px-2 font-black leading-tight text-white shadow-sm" style={{background:tone,fontSize:"clamp(9px,1.1vw,14px)",minWidth:"clamp(21px,2.3vw,30px)",height:"clamp(15px,1.6vw,20px)"}}>{n||"–"}</span>
      <span className="rounded-b-md bg-white px-1.5 text-center font-black leading-tight text-slate-900 shadow-sm" style={{fontSize:"clamp(7px,.73vw,10px)"}}>{label}</span>
    </div>;
  })}
 </div>;
}
