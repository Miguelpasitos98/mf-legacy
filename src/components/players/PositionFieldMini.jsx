import React from "react";

const POINTS=[
 ["extremo_izquierdo","EI",44,49],["mediapunta_central","MP",140,44],["extremo_derecho","ED",236,49],
 ["centrocampista_izquierdo","MC(I)",89,77],["centrocampista","MC",140,84],["centrocampista_derecho","MC(D)",191,77],
 ["carrilero_izquierdo","CR(I)",35,108],["mediocentro","MCD",140,108],["carrilero_derecho","CR(D)",245,108],
 ["defensa_izquierdo","DF(I)",47,137],["defensa_central","DF(C)",140,145],["defensa_derecho","DF(D)",233,137],
 ["portero","POR",140,165]
];
export default function PositionFieldMini({ratings={}}){
 const value=k=>{
  const n=Number(ratings?.[k]);
  return Number.isFinite(n)&&n>0?Math.min(20,Math.max(0,n)):0;
 };
 const color=n=>n>=16?"#159c5c":n>=12?"#49aa67":n>=7?"#df7d18":n>=2?"#dd6236":"#cf4052";
 return <div className="flex h-full w-full min-w-0 flex-col overflow-hidden" aria-label="Familiaridad por posición, escala de cero a veinte">
   <div className="flex items-center justify-between gap-1">
    <span className="text-[10px] font-black uppercase tracking-[.12em] text-slate-900">POSICIONES</span>
    <span className="text-[9px] font-semibold text-slate-600">/20</span>
   </div>
   <svg className="min-h-0 w-full flex-1" viewBox="0 0 280 182" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Campo de juego en perspectiva con las posiciones y sus valoraciones">
    <path d="M65 10 H215 L275 178 H5 Z" fill="none" stroke="#FFFFFF" strokeOpacity=".95" strokeWidth="1.8"/>
    <path d="M44 88 H236 M110 10 L105 40 H175 L170 10 M128 10 V22 H152 V10 M92 178 L100 153 H180 L188 178 M123 178 V166 H157 V178" fill="none" stroke="#FFFFFF" strokeOpacity=".8" strokeWidth="1.2"/>
    <ellipse cx="140" cy="88" rx="28" ry="13" fill="none" stroke="#FFFFFF" strokeOpacity=".8" strokeWidth="1.2"/>
    {POINTS.map(([key,label,x,y])=>{
     const n=value(key);
     return <g key={key}>
      <rect x={x-15} y={y-9} width="30" height="18" rx="5" fill={color(n)} opacity={n?1:.65}/>
      <text x={x} y={y+4} fill="white" fontSize="12" fontWeight="800" textAnchor="middle">{n||"–"}</text>
      <text x={x} y={y+19} fill="#18243b" fontSize="8.3" fontWeight="800" textAnchor="middle">{label}</text>
     </g>;
    })}
   </svg>
 </div>;
}
