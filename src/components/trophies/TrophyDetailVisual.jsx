import React,{useMemo} from "react";
import {useQuery} from "@tanstack/react-query";
import {Trophy,Medal,Shield,ShieldCheck,CalendarDays,Users,ArrowUpRight,Plus,CheckCircle2,Clock3,Info,ChevronRight,Star} from "lucide-react";
import {base44} from "@/api/base44Client";
import {completeRecordQueryOptions} from "@/utils/entityRecords";
import {trophyImageUrl} from "@/utils/trophyCatalog";
import {trophyEditionRows,trophyDetailSummary,trophyClubRanking,trophyPlayerRanking} from "@/utils/trophyDetailData";

const sectionLabel="text-[10px] font-black uppercase tracking-[.14em] text-slate-400";
const verifiedTag="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-extrabold uppercase tracking-wide text-emerald-700";
const linkOk=value=>/^https:\/\/[^\s]+$/i.test(String(value||""));
function Avatar({entity,kind="team",size="h-11 w-11"}){
 const url=kind==="player"?
  entity?.photo_url||entity?.photoUrl||entity?.image_url||entity?.image:
  entity?.logo||entity?.logo_url||entity?.logoUrl;
 return <div className={"flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-white "+size}>
  {url?<img loading="lazy" src={url} alt="" className="h-[85%] w-[85%] object-contain" onError={e=>e.currentTarget.style.display="none"}/>:
   kind==="team"?<Shield size={21} strokeWidth={1.5} className="text-slate-300"/>:<Users size={21} strokeWidth={1.5} className="text-slate-300"/>}
 </div>;
}
function Tile({label,value,icon:Icon}){
 return <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
  <div className="flex items-center justify-between gap-2"><span className={sectionLabel}>{label}</span><Icon size={15} className="text-slate-300"/></div>
  <div className="mt-1.5 text-xl font-black tabular-nums text-slate-900">{value}</div>
 </div>;
}
function EmptyState({title,description,action,onAction}){
 return <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-5 py-9 text-center">
  <Trophy size={28} strokeWidth={1.4} className="mb-3 text-slate-300"/>
  <p className="text-sm font-bold text-slate-700">{title}</p>
  <p className="mt-1 max-w-[420px] text-[11px] leading-5 text-slate-500">{description}</p>
  {action&&<button type="button" onClick={onAction} className="mt-4 rounded-lg bg-[#003399] px-3 py-2 text-[11px] font-bold text-white">{action}</button>}
 </div>;
}
function Edition({honour,teamMap,playerMap,onVerify,busy=false}){
 const person=honour.recipient_type==="Player";
 const entity=(person?playerMap:teamMap).get(String(honour.recipient_id));
 return <article className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 transition hover:border-blue-200 hover:shadow-sm">
  <div className="flex items-center justify-between gap-2">
   <span className="text-[13px] font-black tabular-nums text-slate-900">{honour.season}</span>
   {honour.verified?<span className={verifiedTag}><CheckCircle2 size={11}/> Verificado</span>:
    <span className="rounded-full bg-amber-50 px-2 py-1 text-[9px] font-bold text-amber-700">Por verificar</span>}
  </div>
  <div className="flex min-w-0 items-center gap-2.5">
   <Avatar entity={entity} kind={person?"player":"team"}/>
   <div className="min-w-0"><p className="truncate text-xs font-bold text-slate-800">{honour.recipient_name||entity?.name||"Sin nombre guardado"}</p>
    <p className="mt-0.5 text-[10px] text-slate-400">{person?"Premio individual":"Club campeón"}{honour.award_rank?" · "+honour.award_rank+".º":""}</p>
   </div>
  </div>
  <div className="flex items-center justify-between border-t border-slate-100 pt-2">
   {linkOk(honour.source_url)?<a href={honour.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#003399] hover:underline">Fuente <ArrowUpRight size={11}/></a>:
    <span className="text-[10px] text-slate-400">Sin fuente adjunta</span>}
   {!honour.verified&&linkOk(honour.source_url)&&<button type="button" disabled={busy} onClick={()=>onVerify(honour)} className="text-[10px] font-bold text-emerald-700 hover:underline disabled:opacity-40">Verificar</button>}
  </div>
 </article>;
}
export default function TrophyDetailVisual({trophy,manifest,tab,honours=[],onEdit,onAdd,onVerify,honourSaving=false}){
 const summary=useMemo(()=>trophyDetailSummary(honours),[honours]);
 const clubs=useMemo(()=>trophyClubRanking(honours),[honours]);
 const ordered=useMemo(()=>trophyEditionRows(honours),[honours]);
 const needsTeams=["Resumen","Ediciones","Clubes"].includes(tab);
 const needsPlayers=["Ediciones","Jugadores"].includes(tab);
 const teamsQuery=useQuery({...completeRecordQueryOptions(base44.entities.Team,["mf-legacy","teams"]),enabled:needsTeams,retry:false});
 const playersQuery=useQuery({...completeRecordQueryOptions(base44.entities.Player,["mf-legacy","players"]),enabled:needsPlayers,retry:false});
 const creditsQuery=useQuery({...completeRecordQueryOptions(base44.entities.PlayerTrophyCredit,["mf-legacy","trophies","credits"]),enabled:tab==="Jugadores",retry:false});
 const teamMap=useMemo(()=>new Map((teamsQuery.data||[]).map(t=>[String(t.id),t])),[teamsQuery.data]);
 const playerMap=useMemo(()=>new Map((playersQuery.data||[]).map(p=>[String(p.id),p])),[playersQuery.data]);
 const players=useMemo(()=>trophyPlayerRanking(honours,creditsQuery.data||[],playersQuery.data||[]),[honours,creditsQuery.data,playersQuery.data]);
 const isIndividual=trophy.trophy_type==="Individual Trophy";
 const hero=<div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#102949] via-[#132f54] to-[#304e73] p-4 text-white md:p-5">
  <div className="pointer-events-none absolute -right-8 -top-20 h-64 w-64 rounded-full border border-white/10"/>
  <div className="pointer-events-none absolute -right-20 top-2 h-56 w-56 rounded-full border border-white/10"/>
  <div className="relative flex items-center gap-5">
   <div className="flex h-32 w-28 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/95 p-2 shadow-xl sm:h-40 sm:w-36">
    <img src={trophyImageUrl(trophy,manifest)} alt="" className="h-full w-full object-contain drop-shadow-lg" onError={e=>{e.currentTarget.style.display="none";e.currentTarget.nextElementSibling?.classList.remove("hidden");}}/>
    <Trophy size={56} className="hidden text-slate-300"/>
   </div>
   <div className="min-w-0 flex-1">
    <p className="mb-2 text-[10px] font-bold uppercase tracking-[.19em] text-blue-200">{trophy.country||trophy.organizer||"MF LEGACY · TROPHY ARCHIVE"}</p>
    <h3 className="break-words text-2xl font-black leading-tight tracking-tight sm:text-3xl">{trophy.name}</h3>
    <p className="mt-2 text-[11px] text-white/65">{[trophy.trophy_type,trophy.category].filter(Boolean).join(" · ")||"Trofeo en catalogación"}</p>
    <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px]">
     <span className="rounded-md border border-white/20 bg-white/10 px-2 py-1">ID {trophy.source_id}</span>
     {summary.verifiedCount>0&&<span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/20 px-2 py-1 text-emerald-100"><CheckCircle2 size={11}/>{summary.verifiedCount} ediciones verificadas</span>}
    </div>
   </div>
  </div>
 </div>;
 const heading=(title,sub)=> <div className="mb-3 flex items-end justify-between gap-2">
  <div><h3 className="text-sm font-black text-slate-900">{title}</h3>{sub&&<p className="mt-0.5 text-[11px] text-slate-400">{sub}</p>}</div>
 </div>;
 return <div className="min-h-0 flex-1 overflow-y-auto bg-[#f7f9fc]">
  {tab==="Resumen"&&<div className="space-y-5 p-4 md:p-6">
   {hero}
   <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
    <Tile icon={Medal} label="Ediciones verificadas" value={summary.verifiedCount}/>
    <Tile icon={ShieldCheck} label="Clubes campeones" value={summary.clubCount}/>
    <Tile icon={Clock3} label="Por comprobar" value={summary.pendingCount}/>
    <Tile icon={CalendarDays} label="Última edición" value={summary.newest||"—"}/>
   </div>
   {trophy.description&&<p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs leading-relaxed text-slate-600">{trophy.description}</p>}
   <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.55fr_1fr]">
    <section>
     {heading("Últimos ganadores","Ediciones registradas en MF Legacy")}
     {ordered.length?<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{ordered.slice(0,4).map(h=><Edition key={h.id} honour={h} teamMap={teamMap} playerMap={playerMap} onVerify={onVerify} busy={honourSaving}/>)}</div>:
      <EmptyState title="Aún sin campeones registrados" description="Importa ediciones desde Sincronización histórica o añade una adjudicación con fuente." action="Añadir edición" onAction={onAdd}/>}
    </section>
    <section>
     {heading(isIndividual?"Premios históricos":"Clubes más laureados",isIndividual?"Premios adjudicados":"Solo títulos verificados")}
     {isIndividual?<div className="rounded-xl border border-slate-200 bg-white px-4 py-5 text-xs text-slate-500">Este trofeo es individual. Consulta las ediciones o la pestaña Jugadores para ver los premiados.</div>:
      clubs.length?<div className="space-y-2">{clubs.slice(0,6).map((club,i)=><div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2" key={club.team_id}>
       <span className="w-4 text-center text-[10px] font-black text-slate-400">{i+1}</span>
       <Avatar entity={teamMap.get(club.team_id)} size="h-9 w-9"/>
       <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-slate-700">{club.name}</span>
       <span className="text-sm font-black tabular-nums text-[#003399]">{club.count}</span>
      </div>)}</div>:
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-400">Todavía no hay campeones verificados.</div>}
     {summary.earliest&&<p className="mt-3 text-[10px] text-slate-400">Primera edición verificada en MF Legacy: {summary.earliest}</p>}
    </section>
   </div>
  </div>}
  {tab==="Ediciones"&&<div className="space-y-4 p-4 md:p-6">
   <div className="flex flex-wrap items-center justify-between gap-2">
    <div>{heading("Ediciones y ganadores",ordered.length+" adjudicaciones registradas · "+summary.verifiedCount+" verificadas")}</div>
    <button type="button" onClick={onAdd} className="inline-flex items-center gap-1.5 rounded-lg bg-[#003399] px-3 py-2 text-[11px] font-bold text-white"><Plus size={14}/> Añadir edición</button>
   </div>
   {ordered.length?<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{ordered.map(h=><Edition key={h.id} honour={h} teamMap={teamMap} playerMap={playerMap} onVerify={onVerify} busy={honourSaving}/>)}</div>:
    <EmptyState title="Sin ediciones todavía" description="Puedes registrar la temporada, el campeón y su fuente oficial desde Editar." action="Añadir edición" onAction={onAdd}/>}
  </div>}
  {tab==="Clubes"&&<div className="space-y-4 p-4 md:p-6">
   {heading("Clasificación histórica de clubes","Una victoria por club y edición verificada")}
   {clubs.length?<div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
    {clubs.map((club,i)=><div key={club.team_id} className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0">
     <span className={"w-7 text-center text-base font-black tabular-nums "+(i<3?"text-[#003399]":"text-slate-300")}>{i+1}</span>
     <Avatar entity={teamMap.get(club.team_id)} size="h-12 w-12"/>
     <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-slate-800">{club.name}</p>
      <p className="mt-1 text-[10px] text-slate-400">{club.seasons.slice(0,5).join(" · ")}{club.seasons.length>5?" · …":""}</p>
     </div>
     <div className="text-right"><p className="text-xl font-black tabular-nums text-[#003399]">{club.count}</p><p className="text-[9px] text-slate-400">títulos</p></div>
    </div>)}
   </div>:<EmptyState title="No hay clubes campeones verificados" description="Los títulos pendientes de verificación no se utilizan en las clasificaciones."/>}
  </div>}
  {tab==="Jugadores"&&<div className="space-y-4 p-4 md:p-6">
   {heading(isIndividual?"Jugadores premiados":"Jugadores con este título","Solo títulos confirmados; las candidaturas no suman palmarés")}
   {(creditsQuery.isLoading||playersQuery.isLoading)&&<p className="text-xs text-slate-400">Consultando adjudicaciones verificadas…</p>}
   {(creditsQuery.isError||playersQuery.isError)&&<p role="alert" className="rounded-lg bg-amber-50 px-4 py-3 text-xs text-amber-800">No se pudo cargar el historial completo de jugadores.</p>}
   {players.length?<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
    {players.map((entry,i)=><div key={entry.player_id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
     <span className="w-5 text-center text-xs font-black text-slate-400">{i+1}</span>
     <Avatar entity={playerMap.get(entry.player_id)} kind="player" size="h-12 w-12"/>
     <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-slate-800">{entry.name}</p>
      <p className="mt-1 truncate text-[10px] text-slate-400">{entry.seasons.slice(0,3).join(" · ")}</p>
     </div>
     <div className="text-right"><p className="text-lg font-black text-[#003399]">{entry.count}</p><p className="text-[9px] text-slate-400">títulos</p></div>
    </div>)}
   </div>:!creditsQuery.isLoading&&!playersQuery.isLoading&&<EmptyState title="Todavía no hay jugadores confirmados" description="En Sincronización histórica puedes cruzar cada título de equipo con STATS y revisar su elegibilidad. Las apariciones no bastan para acreditar un campeonato."/>}
   <p className="flex items-center gap-1.5 text-[10px] text-slate-400"><Info size={12}/> Los premios individuales verificados se leen directamente de TrophyHonour.</p>
  </div>}
 </div>;
}
