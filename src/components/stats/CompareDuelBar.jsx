import React from "react";

// Color estable por jugador seleccionado: identifica a cada temporada en la
// barra, en las columnas de cifras y en la leyenda.
export const SEASON_BAR_COLORS = ["#1d4ed8","#059669","#d97706","#7c3aed","#db2777","#0891b2","#65a30d","#e11d48"];
export const seasonColor = index => SEASON_BAR_COLORS[index % SEASON_BAR_COLORS.length];

const fmt=(value,decimals=1)=>value===null||value===undefined||!Number.isFinite(Number(value))?"—":Number(value).toLocaleString("es-ES",{minimumFractionDigits:decimals,maximumFractionDigits:decimals});

// Una única barra por indicador: el centro es el empate. La barra se extiende
// hacia el jugador que gana, pintada con SU color, y su longitud mide la
// diferencia en puntos de percentil. Si empatan, no se mueve del centro.
export default function CompareDuelBar({best=null,second=null,seasons=[],nameOf=()=>""}){
 if(!best)return <span className="text-slate-400">—</span>;
 if(!second)return <span className="text-[10px] font-semibold text-slate-400">sin segunda cifra</span>;
 const gap=best.strength-second.strength;
 const leaderOnLeft=best.index<second.index;
 const leftSeason=seasons[leaderOnLeft?best.index:second.index];
 const rightSeason=seasons[leaderOnLeft?second.index:best.index];
 const color=seasonColor(best.index);
 if(Math.abs(gap)<0.05)return <div className="flex items-center gap-2">
  <div className="relative h-3 flex-1 overflow-hidden rounded-sm bg-slate-100 ring-1 ring-inset ring-slate-200">
   <div className="absolute inset-y-0 left-1/2 w-px bg-slate-300"/>
  </div>
  <span className="w-16 shrink-0 text-right text-[10px] font-bold text-slate-400">iguales</span>
 </div>;
 const width=Math.min(50,Math.max(2,Math.abs(gap)*1.25));
 return <div className="flex items-center gap-2" title={nameOf(best.index)+" saca "+fmt(gap,1)+" puntos de percentil a "+nameOf(second.index)+" · barra hacia "+(leaderOnLeft?"la izquierda":"la derecha")}>
  <div className="relative h-3 flex-1 overflow-hidden rounded-sm ring-1 ring-inset ring-slate-200"
    style={{background:"linear-gradient(to right,"+seasonColor(leftSeason?.index??0)+"1f 0 50%,"+seasonColor(rightSeason?.index??1)+"1f 50% 100%)"}}>
   <div className="absolute inset-y-0 left-1/2 w-px bg-slate-300"/>
   <div className={"absolute inset-y-0 "+(leaderOnLeft?"right-1/2 rounded-l-sm":"left-1/2 rounded-r-sm")} style={{width:width+"%",background:color}}/>
  </div>
  <span className="w-14 shrink-0 text-right text-[11px] font-black tabular-nums" style={{color}}>+{fmt(gap,1)}</span>
 </div>;
}