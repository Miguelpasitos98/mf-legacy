import React from "react";

// Exactly the same persisted position keys as PlayerDetail's editor.
export const POSITION_FIELD_POINTS=[
 ["delantero","DL(C)",140,15],
 ["mediapunta_por_la_izquierda","EI",48,52],
 ["mediapunta_central","MP(C)",140,53],
 ["mediapunta_por_la_derecha","ED",232,52],
 ["centrocampista_izquierdo","MC(I)",91,91],
 ["centrocampista","MC",140,91],
 ["centrocampista_derecho","MC(D)",189,91],
 ["carrilero_izquierdo","CR(I)",32,126],
 ["mediocentro","MCD",140,127],
 ["carrilero_derecho","CR(D)",248,126],
 ["defensa_izquierdo","DF(I)",47,161],
 ["defensa_central","DF(C)",140,161],
 ["defensa_derecho","DF(D)",233,161],
 ["portero","POR",140,189]
];
export default function PositionFieldMini({ratings={}}){
 const value=k=>{
  const n=Number(ratings?.[k]);
  return Number.isFinite(n)&&n>0?Math.min(20,Math.max(0,n)):0;
 };
 const color=n=>n>=16?"#159c5c":n>=12?"#49aa67":n>=7?"#df7d18":n>=2?"#dd6236":"#cf4052";
 return <div className="flex h-full w-full min-w-0 flex-col overflow-hidden" aria-label="Familiaridad por posición, escala de cero a veinte">
   <div className="flex items-center justify-between gap-1">
    <span className="text-[10px] font-black uppercase tracking-[.12em] text-white">POSICIONES</span>
    <span className="text-[9px] font-semibold text-white">/20</span>
   </div>
   <svg className="min-h-0 w-full flex-1" viewBox="0 0 280 213" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Campo de juego en perspectiva con las posiciones y sus valoraciones">
    <path d="M66 8 H214 L275 205 H5 Z" fill="none" stroke="#FFFFFF" strokeOpacity=".95" strokeWidth="1.8"/>
    <path d="M42 109 H238 M110 8 L105 41 H175 L170 8 M128 8 V22 H152 V8 M92 205 L100 173 H180 L188 205 M123 205 V192 H157 V205" fill="none" stroke="#FFFFFF" strokeOpacity=".8" strokeWidth="1.2"/>
    <ellipse cx="140" cy="109" rx="28" ry="13" fill="none" stroke="#FFFFFF" strokeOpacity=".8" strokeWidth="1.2"/>
    {POSITION_FIELD_POINTS.map(([key,label,x,y])=>{
     const n=value(key);
     return <g key={key}>
      <rect x={x-15} y={y-9} width="30" height="18" rx="5" fill={color(n)} opacity={n?1:.65}/>
      <text x={x} y={y+4} fill="white" fontSize="12" fontWeight="800" textAnchor="middle">{n||"–"}</text>
      <text x={x} y={y+19} fill="#FFFFFF" fontSize="8.3" fontWeight="800" textAnchor="middle">{label}</text>
     </g>;
    })}
   </svg>
 </div>;
}
