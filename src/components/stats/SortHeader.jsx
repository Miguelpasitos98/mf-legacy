import React from "react";
import {ArrowDown,ArrowUp,ChevronsUpDown} from "lucide-react";
export default function SortHeader({column,label,active,direction,onSort,align="right",className=""}){
 const selected=active===column;
 return <th scope="col" aria-sort={selected?(direction==="asc"?"ascending":"descending"):"none"} className={"px-3 py-3 "+className}>
  <button type="button" onClick={()=>onSort(column)} title={"Ordenar por "+label} className={"inline-flex w-full items-center gap-1 whitespace-nowrap font-semibold hover:text-blue-200 "+(align==="right"?"justify-end text-right":"justify-start text-left")}>
   <span>{label}</span>
   {selected?(direction==="asc"?<ArrowUp size={13}/>:<ArrowDown size={13}/>):<ChevronsUpDown size={12} className="opacity-45"/>}
  </button>
 </th>;
}
