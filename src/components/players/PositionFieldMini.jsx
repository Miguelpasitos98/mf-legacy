import React from "react";
import {compactPositionValue} from "@/utils/compactPositionRatings";

// Exactly the same persisted position keys as PlayerDetail's editor.
export const POSITION_FIELD_POINTS=[
 ["delantero","DL(C)",140,18],
 ["mediapunta_por_la_izquierda","EI",65,45],
 ["mediapunta_central","MP(C)",140,47],
 ["mediapunta_por_la_derecha","ED",215,45],
 ["mc_left","MC",94,70],
 ["mc_right","MC",186,70],
 ["carrilero_izquierdo","CR(I)",56,98],
 ["mediocentro","MCD",140,102],
 ["carrilero_derecho","CR(D)",224,98],
 ["defensa_central","DFC(I)",112,127],
 ["defensa_central","DFC(D)",168,127],
 ["portero","POR",140,150]
];
export default function PositionFieldMini({ratings={}}){
 const displayValue=key=>compactPositionValue(ratings,key);
 const color=n=>n>=16?"#159c5c":n>=12?"#49aa67":n>=7?"#df7d18":n>=2?"#dd6236":"#cf4052";
 return <div className="flex h-full w-full min-w-0 flex-col overflow-hidden" aria-label="Familiaridad por posición, escala de cero a veinte">
   <svg className="h-full w-full min-h-0 scale-[1.20]" viewBox="-5 -7 290 186" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Campo original de fútbol en perspectiva con posiciones y familiaridad">
    <image href="https://media.base44.com/images/public/6a88359fd43f2af862874b12/7e722efeb_Diagrama_minimalista_de_campo_de_ftbol__1_.png" x="0" y="5" width="280" height="154" preserveAspectRatio="xMidYMid meet" />
    {POSITION_FIELD_POINTS.map(([key,label,x,y])=>{
     const n=displayValue(key);
     return <g key={key}>
      <rect x={x-12} y={y-7} width="24" height="15" rx="4" fill={color(n)} opacity={n?1:.65}/>
      <text x={x} y={y+4} fill="white" fontSize="10" fontWeight="800" textAnchor="middle">{n||"–"}</text>
      <text x={x} y={y+16} fill="#FFFFFF" fontSize="7.5" fontWeight="800" textAnchor="middle">{label}</text>
     </g>;
    })}
   </svg>
 </div>;
}
