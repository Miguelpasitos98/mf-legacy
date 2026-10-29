import React,{useMemo,useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {Search,Trophy,Shield,Users,Medal,ArrowUpRight,CheckCircle2,CalendarDays,Info} from "lucide-react";
import {base44} from "@/api/base44Client";
import {completeRecordQueryOptions} from "@/utils/entityRecords";
import {trophyImageUrl} from "@/utils/trophyCatalog";
import {archiveOverview,searchArchiveRows} from "@/utils/trophyArchiveOverview";

const MODES=[["competiciones","Competiciones",Trophy],["equipos","Equipos",Shield],["jugadores","Jugadores",Users]];
const small="text-[10px] font-bold uppercase tracking-[.13em] text-slate-400";
function Emblem({url,fallback:Icon=Shield,size=40}){
 const [failed,setFailed]=useState(false);
 return <span className="flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-slate-50" style={{width:size,height:size}}>
  {url&&!failed?<img src={url} loading="lazy" alt="" className="h-[85%] w-[85%] object-contain" onError={()=>setFailed(true)}/>:<Icon size={Math.round(size*.45)} strokeWidth={1.3} className="text-slate-300"/>}
 </span>;
}
function TrophyPhoto({trophy,manifest,size="large"}){
 const [broken,setBroken]=useState(false);
 return <span className={"flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white "+(size==="large"?"h-24 w-24":"h-14 w-14")}>
  {!broken?<img src={trophyImageUrl(trophy,manifest)} alt="" loading="lazy" onError={()=>setBroken(true)} className="h-full w-full object-contain p-1.5 drop-shadow-sm"/>:<Trophy size={30} className="text-slate-300"/>}
 </span>;
}
function Stat({label,value,icon:Icon}){
 return <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3">
  <div className="flex justify-between gap-2"><span className={small}>{label}</span><Icon size={14} className="text-slate-300"/></div>
  <p className="mt-1.5 text-2xl font-black tabular-nums text-slate-900">{value.toLocaleString("es-ES")}</p>
 </div>;
}
export default function TrophyArchiveOverview({honours=[],catalog=[],imageManifest,onOpenTrophy,onSync}){
 const [mode,setMode]=useState("competiciones"),[search,setSearch]=useState(""),[visible,setVisible]=useState(24);
 const [verifiedOnly]=useState(true);
 const teamQuery=useQuery({...completeRecordQueryOptions(base44.entities.Team,["mf-legacy","teams"]),enabled:mode==="equipos",retry:false});
 const playerQuery=useQuery({...completeRecordQueryOptions(base44.entities.Player,["mf-legacy","players"]),enabled:mode==="jugadores",retry:false});
 const creditQuery=useQuery({...completeRecordQueryOptions(base44.entities.PlayerTrophyCredit,["mf-legacy","trophies","credits"]),enabled:mode==="jugadores",retry:false});
 const summary=useMemo(()=>archiveOverview(honours,mode==="jugadores"?creditQuery.data||[]:[],catalog,mode==="jugadores"?playerQuery.data||[]:[]),[honours,creditQuery.data,playerQuery.data,mode,catalog]);
 const teamMap=useMemo(()=>new Map((teamQuery.data||[]).map(t=>[String(t.id),t])),[teamQuery.data]);
 const playerMap=useMemo(()=>new Map((playerQuery.data||[]).map(p=>[String(p.id),p])),[playerQuery.data]);
 const trophiesById=useMemo(()=>new Map(catalog.map(t=>[String(t.source_id),t])),[catalog]);
 const raw=mode==="competiciones"?summary.competitions:mode==="equipos"?summary.clubs:summary.players;
 const results=useMemo(()=>searchArchiveRows(raw,search),[raw,search]);
 const rendered=results.slice(0,visible);
 const pending=honours.filter(h=>h.verified!==true).length;
 const isLoading=mode==="equipos"?teamQuery.isLoading:mode==="jugadores"?playerQuery.isLoading||creditQuery.isLoading:false;
 const isError=mode==="equipos"?teamQuery.isError:mode==="jugadores"?playerQuery.isError||creditQuery.isError:false;
 const changeMode=v=>{setMode(v);setSearch("");setVisible(24);};
 const openCompetition=sourceId=>{const trophy=trophiesById.get(String(sourceId));if(trophy)onOpenTrophy?.(trophy);};
 return <section className="space-y-4 pb-6">
  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0d2b52] via-[#123a67] to-[#456887] p-5 text-white md:p-7">
   <div className="pointer-events-none absolute -right-12 -top-20 h-72 w-72 rounded-full border border-white/10"/>
   <div className="relative flex flex-wrap items-end justify-between gap-5">
    <div className="max-w-[690px] space-y-2">
     <p className="text-[10px] font-extrabold uppercase tracking-[.22em] text-[#bcd2ee]">MF LEGACY · HISTORICAL HONOURS</p>
     <h2 className="text-3xl font-black tracking-tight md:text-4xl">Palmarés</h2>
     <p className="text-xs leading-5 text-white/75">Competiciones, clubes y futbolistas conectados mediante sus títulos oficiales verificados. Una única historia, distintas formas de explorarla.</p>
    </div>
    <Trophy strokeWidth={1} size={72} className="hidden text-white/35 md:block"/>
   </div>
  </div>
  <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
   <Stat label="Títulos verificados" value={summary.verifiedCount} icon={Medal}/>
   <Stat label="Competiciones" value={summary.competitions.length} icon={Trophy}/>
   <Stat label="Clubes campeones" value={summary.clubs.length} icon={Shield}/>
   <Stat label="Pendientes de validar" value={pending} icon={CalendarDays}/>
  </div>
  <div className="rounded-2xl border border-slate-200 bg-white p-3 md:p-4">
   <div className="flex flex-wrap items-center justify-between gap-3">
    <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
     {MODES.map(([key,label,Icon])=><button type="button" key={key}
       onClick={()=>changeMode(key)} aria-pressed={mode===key}
       className={"flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-bold transition "+(mode===key?"bg-white text-[#003399] shadow-sm":"text-slate-500 hover:text-slate-800")}>
       <Icon size={14}/>{label}
      </button>)}
    </div>
    <div className="relative min-w-[220px] flex-1 sm:max-w-[350px]">
     <Search size={15} className="pointer-events-none absolute left-3 top-[11px] text-slate-400"/>
     <input type="search" value={search} onChange={e=>{setSearch(e.target.value);setVisible(24);}} placeholder={"Buscar "+(mode==="competiciones"?"trofeo o competición":mode==="equipos"?"club":"jugador")+"…"}
      aria-label="Buscar en el palmarés" className="h-9 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-xs outline-none focus:border-[#003399]"/>
    </div>
   </div>
   <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
    <p className="text-[11px] font-semibold text-slate-500">{isLoading?"Cargando registros…":results.length.toLocaleString("es-ES")+" resultados"}</p>
    <p className="inline-flex items-center gap-1 text-[10px] text-emerald-700"><CheckCircle2 size={12}/>{verifiedOnly?"Solo títulos verificados":""}</p>
   </div>
  </div>
  {isError&&<div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">No se han podido cargar completamente los equipos o los jugadores. Actualiza la vista para consultar sus títulos.</div>}
  {!isLoading&&!isError&&results.length===0&&<div className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center">
   <Trophy size={28} strokeWidth={1.3} className="mx-auto mb-3 text-slate-300"/>
   <p className="text-sm font-bold text-slate-700">{search?"Sin coincidencias":"Aún no hay títulos confirmados"}</p>
   <p className="mt-1 text-[11px] leading-5 text-slate-400">{search?"Prueba con otro nombre o competición.":"Investiga los campeones y verifica sus fuentes desde Sincronizar para empezar a construir el palmarés."}</p>
   {!search&&<button type="button" onClick={onSync} className="mt-4 rounded-lg bg-[#003399] px-3 py-2 text-[11px] font-bold text-white">Ir a Sincronizar</button>}
  </div>}
  {!isError&&!isLoading&&mode==="competiciones"&&rendered.length>0&&<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
   {rendered.map(item=><button type="button" key={item.source_id} onClick={()=>openCompetition(item.source_id)}
    className="group flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
    <TrophyPhoto trophy={item.trophy||{source_id:item.source_id,name:item.name}} manifest={imageManifest}/>
    <div className="min-w-0 flex-1">
     <p className={small}>Competiciones · {item.latest||"Sin fecha"}</p>
     <h3 className="mt-1 line-clamp-2 text-[13px] font-black text-slate-900">{item.name}</h3>
     <p className="mt-1 text-[11px] text-slate-500">{item.count} títulos verificados · {item.winnerCount} ganadores</p>
    </div>
    <ArrowUpRight size={16} className="shrink-0 text-slate-300 group-hover:text-[#003399]"/>
   </button>)}
  </div>}
  {!isError&&!isLoading&&mode==="equipos"&&rendered.length>0&&<div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
   {rendered.map((row,i)=>{
    const team=teamMap.get(row.id),logo=team?.logo||team?.logo_url||team?.logoUrl;
    return <div key={row.id} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4">
     <div className="flex items-center gap-3">
      <span className="w-5 shrink-0 text-center text-xs font-black text-slate-300">{i+1}</span>
      <Emblem url={logo} size={48}/>
      <div className="min-w-0 flex-1"><h3 className="truncate text-xs font-black text-slate-900">{team?.name||row.name}</h3><p className="mt-1 text-[10px] text-slate-400">{row.distinct} trofeos diferentes</p></div>
      <div className="text-right"><p className="text-2xl font-black text-[#003399]">{row.total}</p><p className="text-[9px] text-slate-400">títulos</p></div>
     </div>
     <div className="mt-3 flex gap-1.5 overflow-x-auto border-t border-slate-100 pt-3">
      {[...row.trophies].map(sourceId=>{
       const t=trophiesById.get(sourceId)||{source_id:sourceId,name:sourceId};
       return <button key={sourceId} type="button" title={t.name} onClick={()=>openCompetition(sourceId)}
        className="shrink-0 rounded-lg border border-slate-100 transition hover:border-blue-200"><TrophyPhoto trophy={t} manifest={imageManifest} size="small"/></button>;
      })}
     </div>
     <p className="mt-2 truncate text-[10px] text-slate-400">{row.seasons.slice(0,6).join(" · ")}</p>
    </div>;
   })}
  </div>}
  {!isError&&!isLoading&&mode==="jugadores"&&rendered.length>0&&<div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
   {rendered.map((row,i)=>{
    const p=playerMap.get(row.id),picture=p?.photo_url||p?.photoUrl||p?.image_url||p?.image;
    return <div key={row.id} className="rounded-2xl border border-slate-200 bg-white p-4">
     <div className="flex items-center gap-3">
      <span className="w-5 text-center text-xs font-black text-slate-300">{i+1}</span><Emblem url={picture} size={48} fallback={Users}/>
      <div className="min-w-0 flex-1"><h3 className="truncate text-xs font-black text-slate-900">{p?.name||row.name}</h3>
       <p className="mt-1 text-[10px] text-slate-400">{row.collective} colectivos · {row.individual} individuales</p>
      </div>
      <div className="text-right"><p className="text-2xl font-black text-[#003399]">{row.total}</p><p className="text-[9px] text-slate-400">títulos</p></div>
     </div>
     <div className="mt-3 flex gap-1.5 overflow-x-auto border-t border-slate-100 pt-3">{[...row.trophies].map(sourceId=>{
      const t=trophiesById.get(sourceId)||{source_id:sourceId,name:sourceId};
      return <button key={sourceId} type="button" title={t.name} onClick={()=>openCompetition(sourceId)} className="rounded-lg border border-slate-100 transition hover:border-blue-200">
       <TrophyPhoto trophy={t} manifest={imageManifest} size="small"/>
      </button>;
     })}</div>
     <p className="mt-2 truncate text-[10px] text-slate-400">{row.seasons.slice(0,6).join(" · ")}</p>
    </div>;
   })}
  </div>}
  {!isLoading&&results.length>visible&&<div className="flex justify-center">
   <button type="button" className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-[#003399] hover:bg-blue-50" onClick={()=>setVisible(v=>v+24)}>
    Mostrar más ({results.length-visible} pendientes)
   </button>
  </div>}
  <p className="flex items-center gap-1.5 text-[10px] text-slate-400"><Info size={12}/> Los totales reflejan únicamente títulos guardados y verificados en MF Legacy. Un club puede ganar varios títulos en la misma temporada. Los créditos de jugadores requieren confirmación individual.</p>
 </section>;
}
