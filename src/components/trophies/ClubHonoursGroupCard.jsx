import React,{useMemo,useState} from "react";
import {ArrowUpRight,ChevronRight,Shield,Trophy} from "lucide-react";
import {trophyImageUrl} from "@/utils/trophyCatalog";
import {normalizeImageUrl} from "@/components/teams/teamUtils";

function Crest({team}){
 const [failed,setFailed]=useState(false);
 const raw=team?.logo||team?.logo_url||team?.logoUrl;
 const url=normalizeImageUrl(raw);
 return <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-white p-1.5 sm:h-16 sm:w-16">
  {url&&!failed?<img alt="" src={url} loading="lazy" className="h-full w-full object-contain" onError={()=>setFailed(true)}/>:
  <Shield size={28} strokeWidth={1.4} className="text-slate-300"/>}
 </span>;
}
function SmallTrophy({trophy,manifest}){
 const [failed,setFailed]=useState(false);
 return <span className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-lg bg-white p-1">
  {!failed?<img src={trophyImageUrl(trophy,manifest)} alt="" loading="lazy" className="h-full w-full object-contain" onError={()=>setFailed(true)}/>:
   <Trophy size={23} strokeWidth={1.4} className="text-slate-300"/>}
 </span>;
}
export default function ClubHonoursGroupCard({item,team,manifest,trophiesById,onOpenTrophy,onOpenArchive,onOpenProfile}){
 const medals=useMemo(()=>[...(item.trophyCounts||new Map()).entries()]
  .map(([sourceId,count])=>({sourceId:String(sourceId),count,trophy:trophiesById.get(String(sourceId))||{source_id:String(sourceId),name:"Trofeo "+sourceId}}))
  .sort((a,b)=>b.count-a.count||String(a.trophy.name).localeCompare(String(b.trophy.name),"es")),
 [item.trophyCounts,trophiesById]);
 const teamName=team?.name||item.name;
 return <article className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(20,37,67,.025)] transition hover:border-blue-200 hover:shadow-sm">
  <div className="flex min-w-0 items-center gap-3 border-b border-slate-100 px-3 py-3 sm:px-4">
   <Crest team={team}/>
   <div className="min-w-0 flex-1">
    <h3 title={teamName} className="truncate text-sm font-black text-slate-900 sm:text-base">{teamName}</h3>
    <p className="mt-0.5 text-[11px] text-slate-500">{item.distinct} {item.distinct===1?"competición":"competiciones"} · Último título: {item.latest||"—"}</p>
    <button type="button" onClick={()=>onOpenArchive?.(item.id)} className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-[#003399] hover:underline">
     Ver historial <ChevronRight size={13}/>
    </button>
   </div>
   <div className="shrink-0 rounded-xl bg-[#edf3fb] px-3 py-2 text-center">
    <p className="text-2xl font-black tabular-nums leading-none text-[#003399]">{item.total}</p>
    <p className="mt-1 text-[9px] font-bold text-slate-500">{item.total===1?"título":"títulos"}</p>
   </div>
  </div>
  <div className="px-3 pb-3 pt-2.5 sm:px-4 sm:pb-4">
   <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Trofeos conseguidos</p>
   <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3" aria-label={"Títulos ganados por "+teamName}>
    {medals.map(({sourceId,count,trophy})=><button key={sourceId} type="button"
      onClick={()=>onOpenTrophy?.(sourceId)}
      aria-label={trophy.name+", ganado "+count+(count===1?" vez":" veces")}
      title={"Abrir "+trophy.name}
      className="group flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-[#f8fafc] px-2 py-1.5 text-left transition hover:border-blue-300 hover:bg-blue-50">
      <SmallTrophy trophy={trophy} manifest={manifest}/>
      <span className="min-w-0 flex-1">
       <span className="line-clamp-2 text-[11px] font-bold leading-4 text-slate-800 group-hover:text-[#003399]">{trophy.name}</span>
      </span>
      <span className="shrink-0 rounded-lg bg-white px-2 py-1 text-xs font-black tabular-nums text-[#003399]">×{count}</span>
     </button>)}
   </div>
   <div className="mt-3 flex justify-end border-t border-slate-100 pt-2">
    <button type="button" onClick={()=>onOpenProfile?.(item.id)}
      className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-[#003399]">
     Ficha del equipo <ArrowUpRight size={13}/>
    </button>
   </div>
  </div>
 </article>;
}
