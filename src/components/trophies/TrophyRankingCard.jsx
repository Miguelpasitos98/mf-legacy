import React,{useState} from "react";
import {ArrowUpRight,Shield,Users,Trophy,Medal} from "lucide-react";
import {trophyImageUrl} from "@/utils/trophyCatalog";
import {normalizeImageUrl} from "@/components/teams/teamUtils";

function Portrait({url,kind}){
 const [bad,setBad]=useState(false);
 const Icon=kind==="player"?Users:Shield;
 const image=normalizeImageUrl(url);
 return <div className={"relative flex h-[104px] w-[100px] shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 "+(kind==="player"?"bg-gradient-to-t from-[#e1e8f4] to-[#f5f7fc]":"bg-[#f7f9fd]")}>
  {!bad&&image?<img loading="lazy" src={image} alt="" className={"h-full w-full "+(kind==="player"?"object-contain object-bottom":"p-3 object-contain")}
    onError={()=>setBad(true)}/>:<Icon size={36} strokeWidth={1.3} className="text-slate-300"/>}
 </div>;
}
function AwardImage({trophy,manifest}){
 const [bad,setBad]=useState(false);
 return <div className="flex h-[59px] w-[55px] shrink-0 items-center justify-center rounded-lg bg-white">
  {!bad?<img src={trophyImageUrl(trophy,manifest)} alt="" loading="lazy" className="h-full w-full object-contain px-1 py-1.5" onError={()=>setBad(true)}/>:<Trophy size={22} strokeWidth={1.3} className="text-slate-300"/>}
 </div>;
}
export default function TrophyRankingCard({item,rank,entity,kind="team",manifest,trophiesById,onOpenTrophy,onOpenProfile,onOpenArchive}){
 const isPlayer=kind==="player";
 const picture=isPlayer?
  entity?.photo_url||entity?.photoUrl||entity?.image_url||entity?.image||entity?.card_photo_url:
  entity?.logo||entity?.logo_url||entity?.logoUrl;
 const medals=[...(item.trophyCounts||new Map()).entries()]
  .sort((a,b)=>b[1]-a[1]||String(trophiesById.get(a[0])?.name||a[0]).localeCompare(String(trophiesById.get(b[0])?.name||b[0]),"es"));
 const primary=rank<=3;
 return <article className={"group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-white transition hover:-translate-y-0.5 hover:shadow-[0_15px_38px_rgba(20,35,65,.09)] "+(primary?"border-blue-200 hover:border-[#003399]/40":"border-slate-200 hover:border-blue-200")}>
  {primary&&<div className="h-1 bg-[#003399]"/>}
  <div className="flex min-w-0 items-start gap-3 p-4 pb-3">
   <Portrait url={picture} kind={kind}/>
   <div className="flex min-w-0 flex-1 flex-col">
    <div className="flex items-center justify-between gap-2">
     <span className="rounded-md bg-[#f1f5fb] px-2 py-1 text-[10px] font-black tabular-nums text-[#003399]">#{rank}</span>
     <span className="flex items-center gap-1 text-[10px] text-slate-400">{isPlayer?<Users size={12}/>:<Shield size={12}/>}
      {isPlayer?"Jugador":"Club"}</span>
    </div>
    <h3 className="mt-2 line-clamp-2 text-sm font-black leading-5 text-slate-900">{entity?.name||item.name}</h3>
    <p className="mt-1 text-[10px] text-slate-500">{item.distinct} {item.distinct===1?"trofeo diferente":"trofeos diferentes"}</p>
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
     {!isPlayer&&onOpenArchive&&<button type="button" onClick={()=>onOpenArchive(item.id)}
      className="inline-flex items-center gap-1 rounded-md bg-[#edf3fb] px-2 py-1.5 text-[10px] font-bold text-[#003399] hover:bg-[#dfe9f8]"
      aria-label={"Ver palmarés histórico de "+(entity?.name||item.name)}><Trophy size={12}/> Ver palmarés</button>}
     <button type="button" onClick={()=>onOpenProfile?.(item.id)}
      className="inline-flex items-center gap-1 text-[10px] font-bold text-[#003399] hover:underline"
      aria-label={"Abrir ficha de "+(entity?.name||item.name)}>Ver perfil <ArrowUpRight size={12}/></button>
    </div>
   </div>
   <div className="shrink-0 text-right">
    <p className="text-[29px] font-black leading-none tabular-nums text-[#003399]">{item.total}</p>
    <p className="mt-1 text-[9px] font-semibold uppercase tracking-wider text-slate-400">{item.total===1?"título":"títulos"}</p>
   </div>
  </div>
  {isPlayer&&<div className="mx-4 mb-3 flex flex-wrap gap-1.5 text-[10px] font-semibold text-slate-600">
   <span className="rounded-md bg-slate-100 px-2 py-1">{item.collective} colectivos</span>
   <span className="rounded-md bg-slate-100 px-2 py-1">{item.individual} individuales</span>
  </div>}
  <div className="mt-auto border-t border-slate-100 bg-[#fafbfe] px-4 py-3">
   <div className="mb-2 flex items-center justify-between gap-2">
    <p className="text-[10px] font-bold uppercase tracking-[.12em] text-slate-400">Colección de títulos</p>
    <Medal size={13} className="text-slate-300"/>
   </div>
   <div className="flex min-h-[83px] gap-2 overflow-x-auto pb-1" aria-label="Trofeos ganados por este perfil">
    {medals.map(([sourceId,count])=>{
     const trophy=trophiesById.get(String(sourceId))||{source_id:sourceId,name:"Trofeo "+sourceId};
     return <button key={sourceId} type="button" title={trophy.name+" · "+count} onClick={()=>onOpenTrophy?.(sourceId)}
      className="relative flex w-[64px] shrink-0 flex-col items-center rounded-xl border border-slate-200 bg-white p-1 transition hover:border-blue-300 hover:shadow-sm"
      aria-label={"Abrir "+trophy.name+", "+count+" títulos"}>
      <AwardImage trophy={trophy} manifest={manifest}/>
      <span className="absolute right-0 top-0 rounded-bl-md rounded-tr-lg bg-[#003399] px-1.5 py-0.5 text-[9px] font-black tabular-nums text-white">×{count}</span>
     </button>;
    })}
   </div>
   <p className="mt-2 truncate text-[10px] text-slate-400" title={(item.seasons||[]).join(" · ")}>
    {item.seasons?.length?"Temporadas: "+item.seasons.slice(0,5).join(" · "):"Sin temporadas"}
   </p>
  </div>
 </article>;
}
