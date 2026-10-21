import React from "react";
import {seasonActive} from "@/utils/statsViews";
import {COMPARE_GROUPS,compareBest,compareDecimals,compareFormat,compareLabel,compareUnit,compareValue,shortSeason} from "@/utils/compareMetrics";

export default function CompareMetricsTable({entries=[],config}){
 const summaries=entries.map(e=>e.summary);
 return <div className="max-w-full overflow-x-auto rounded-xl border border-slate-200">
  <table className="w-full min-w-[640px] text-left text-xs">
   <thead className="sticky top-0 z-10 bg-[#003399] text-white">
    <tr>
     <th className="px-3 py-3">Indicador</th>
     {entries.map(({summary,player})=><th key={summary.id} className="min-w-[132px] px-3 py-3 text-right">
      <span className="block truncate">{player?.name||summary.player_name||"Jugador"}</span>
      <span className="block text-[10px] font-normal text-blue-100">{shortSeason(summary.season)}{seasonActive(summary.season)?" · en curso":""}</span>
     </th>)}
    </tr>
   </thead>
   <tbody>
    {COMPARE_GROUPS.map(group=><React.Fragment key={group.title}>
     <tr className="bg-[#e2eaf6]"><td colSpan={entries.length+1} className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[#173B67]">{group.title}</td></tr>
     {group.keys.map(key=>{
      const best=compareBest(summaries,key);
      return <tr key={key} className="border-t border-slate-100 odd:bg-white even:bg-[#f7f9fc]">
       <td className="px-3 py-2 font-semibold text-slate-700">{compareLabel(config,key)}</td>
       {entries.map(({summary})=>{
        const value=compareValue(summary,key);
        const numeric=value!==null&&value!==undefined&&Number.isFinite(Number(value));
        const isBest=numeric&&best!==null&&Number(value)===best;
        return <td key={summary.id} className={"px-3 py-2 text-right tabular-nums "+(isBest?"bg-emerald-50 font-black text-emerald-800":numeric?"font-semibold text-slate-800":"text-slate-400")}>
         {compareFormat(value,compareDecimals(config,key))}{numeric&&compareUnit(config,key)?" "+compareUnit(config,key):""}{isBest&&<span className="ml-1 text-[9px] font-bold text-emerald-600" title="Mejor valor de la fila">▲</span>}
        </td>;
       })}
      </tr>;
     })}
    </React.Fragment>)}
   </tbody>
  </table>
 </div>;
}