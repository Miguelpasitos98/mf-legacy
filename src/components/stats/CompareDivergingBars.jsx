import React from "react";

// Color estable por temporada seleccionada: identifica a cada jugador en las
// barras, en las columnas de cifras y en la leyenda.
export const SEASON_BAR_COLORS = ["#1d4ed8","#059669","#d97706","#7c3aed","#db2777","#0891b2","#65a30d","#e11d48"];
export const seasonColor = index => SEASON_BAR_COLORS[index % SEASON_BAR_COLORS.length];

const fmt=(value,decimals=1)=>value===null||value===undefined||!Number.isFinite(Number(value))?"—":Number(value).toLocaleString("es-ES",{minimumFractionDigits:decimals,maximumFractionDigits:decimals});

// Barras divergentes: el eje central es el percentil 50 del arquetipo.
// Hacia la derecha el jugador supera la media de su puesto; hacia la izquierda
// queda por debajo. Cuanto más larga la barra, mayor la diferencia.
export default function CompareDivergingBars({cells=[],nameOf=()=>"",labelOf=()=>""}){
 const rows=cells.filter(cell=>cell.strength!==null&&cell.row?.percentile!==null);
 if(!rows.length)return <span className="text-slate-400">—</span>;
 return <div className="w-full min-w-[170px] space-y-1">
  {rows.map(cell=>{
   const percentile=Number(cell.row.percentile);
   const length=Math.max(1.5,Math.min(50,Math.abs(percentile-50)));
   const ahead=percentile>=50;
   const color=seasonColor(cell.index);
   const hint=nameOf(cell.index)+" · "+labelOf(cell.index)+" · percentil "+fmt(percentile,1)+" de 100 · "+(ahead?"por encima":"por debajo")+" del punto medio de su arquetipo";
   return <div key={cell.index} className="flex items-center gap-2" title={hint}>
    <div className="relative h-2.5 flex-1 overflow-hidden rounded-sm bg-slate-100 ring-1 ring-inset ring-slate-200">
     <div className="absolute inset-y-0 left-1/2 w-px bg-slate-300"/>
     <div className={"absolute inset-y-0 "+(ahead?"left-1/2 rounded-r-sm":"right-1/2 rounded-l-sm")} style={{width:length+"%",background:color}}/>
    </div>
    <span className="w-9 shrink-0 text-right text-[10px] font-black tabular-nums" style={{color}}>{fmt(percentile,1)}</span>
   </div>;
  })}
 </div>;
}