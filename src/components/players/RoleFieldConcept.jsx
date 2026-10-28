import React from "react";
import {compactPositionValue} from "@/utils/compactPositionRatings";

// Prototipo de disposición usando la imagen facilitada por el usuario.
// Solo los números son dinámicos; la ilustración original permanece intacta.
const IMAGE="https://media.base44.com/images/public/6a88359fd43f2af862874b12/9e1ed5c44_ChatGPT_Image_21_ago_2026__12_30_18_2_.png";
const NUMBERS=[
 ["delantero",40.5,41.5],
 ["delantero",59.4,41.5],
 ["mediapunta_por_la_izquierda",26.3,52.7],
 ["mc_left",49.9,52.7],
 ["mediapunta_por_la_derecha",73.7,52.7],
 ["mediocentro",49.9,63.5],
 ["carrilero_izquierdo",21.8,71.2],
 ["defensa_central",37.8,71.2],
 ["defensa_central",61.9,71.2],
 ["carrilero_derecho",78.2,71.2],
 ["portero",49.8,80.7],
];
export default function RoleFieldConcept({ratings={}}){
 return <div className="relative w-full" style={{aspectRatio:"3 / 2"}} aria-label="Vista de prueba de roles y posiciones">
  <img className="absolute inset-0 h-full w-full object-contain" src={IMAGE} alt="Roles y campo de fútbol en perspectiva"/>
  {NUMBERS.map(([key,x,y],i)=>{
    const n=compactPositionValue(ratings,key);
    return <span key={i} className="absolute -translate-x-1/2 -translate-y-1/2 font-black text-white" style={{left:`${x}%`,top:`${y}%`,fontSize:"clamp(8px,1.05vw,13px)",textShadow:"0 1px 2px #394454"}}>
      {n||"–"}
    </span>;
  })}
 </div>;
}
