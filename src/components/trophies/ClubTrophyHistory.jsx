import React,{useMemo,useState} from "react";
import {useNavigate} from "react-router-dom";
import {useQuery} from "@tanstack/react-query";
import {ArrowLeft,ArrowRight,ArrowUpRight,CalendarDays,CheckCircle2,ChevronDown,ChevronUp,ExternalLink,Medal,Shield,ShieldCheck,Trophy,Users} from "lucide-react";
import {base44} from "@/api/base44Client";
import {completeRecordQueryOptions} from "@/utils/entityRecords";
import {trophyImageUrl} from "@/utils/trophyCatalog";
import {normalizeImageUrl} from "@/components/teams/teamUtils";
import {buildClubTrophyHistory} from "@/utils/trophyClubHistory";
import TrophyEditionDetail from "@/components/trophies/TrophyEditionDetail";

const options=[["overview","Resumen"],["timeline","Cronología"],["players","Jugadores"]];
const low="text-[10px] font-black uppercase tracking-[.13em] text-slate-400";
const linkOk=url=>/^https:\/\/[^\s]+$/i.test(String(url||""));

function Picture({src,kind="trophy",size="h-20 w-20"}){
 const [error,setError]=useState(false);
 const Icon=kind==="team"?Shield:kind==="player"?Users:Trophy;
 const img=kind==="trophy"?src:normalizeImageUrl(src);
 return <div className={"flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white "+size}>
  {img&&!error?<img src={img} loading="lazy" alt="" onError={()=>setError(true)}
   className={"h-full w-full "+(kind==="player"?"object-contain object-bottom":"object-contain p-2")}/>:
   <Icon size={31} strokeWidth={1.25} className="text-slate-300"/>}
 </div>;
}
function Snapshot({icon:Icon,label,value}){
 return <div className="rounded-xl border border-slate-200 bg-white p-3">
  <div className="flex justify-between gap-2"><span className={low}>{label}</span><Icon size={15} className="text-slate-300"/></div>
  <p className="mt-2 text-2xl font-black tabular-nums text-[#12325c]">{value}</p>
 </div>;
}
function Empty({title,description}){
 return <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
  <Trophy size={30} className="mx-auto mb-3 text-slate-300" strokeWidth={1.3}/>
  <h3 className="text-sm font-bold text-slate-700">{title}</h3>
  <p className="mt-1 text-[11px] leading-5 text-slate-500">{description}</p>
 </div>;
}
export default function ClubTrophyHistory({teamId,team,honours=[],catalog=[],manifest,onBack,onOpenTrophy,onSync}){
 const navigate=useNavigate();
 const [tab,setTab]=useState("overview");
 const [competition,setCompetition]=useState("all");
 const [expanded,setExpanded]=useState(null);
 const [selectedEditionKey,setSelectedEditionKey]=useState("");
 // These tables are only fetched while the club archive is open.
 const creditsQuery=useQuery({...completeRecordQueryOptions(base44.entities.PlayerTrophyCredit,["mf-legacy","trophies","credits"]),retry:false});
 const playersQuery=useQuery({...completeRecordQueryOptions(base44.entities.Player,["mf-legacy","players"]),retry:false});
 const history=useMemo(()=>buildClubTrophyHistory(teamId,{
  honours,credits:creditsQuery.data||[],catalog,players:playersQuery.data||[]
 }),[teamId,honours,creditsQuery.data,catalog,playersQuery.data]);
 const clubName=team?.name||honours.find(h=>h.recipient_type==="Team"&&String(h.recipient_id)===String(teamId))?.recipient_name||"Club";
 const logo=team?.logo||team?.logo_url||team?.logoUrl;
 const clubUrl="/teams?stats_team="+encodeURIComponent(teamId);
 const openTrophy=sourceId=>{
  const trophy=catalog.find(t=>String(t.source_id)===String(sourceId));
  if(trophy)onOpenTrophy?.(trophy);
 };
 const showChronology=(sourceId="all")=>{setCompetition(String(sourceId));setTab("timeline");setExpanded(null);};
 const filtered=competition==="all"?history.timeline:history.timeline.map(group=>({
  ...group,editions:group.editions.filter(h=>String(h.trophy_source_id)===competition)
 })).filter(group=>group.editions.length);
 const expandYear=year=>setExpanded(current=>current===year?null:year);
 const creditsLoading=creditsQuery.isLoading||playersQuery.isLoading;
 const editionKey=h=>[String(h.trophy_source_id),String(h.season)].join("|");
 const showEdition=h=>{setSelectedEditionKey(editionKey(h));};
 const chosenEdition=history.editions.find(h=>editionKey(h)===selectedEditionKey);
 if(chosenEdition)return <TrophyEditionDetail
  key={selectedEditionKey} edition={chosenEdition} team={team} teamId={teamId}
  manifest={manifest} onBack={()=>setSelectedEditionKey("")}
  onOpenTrophy={onOpenTrophy} onSync={()=>onSync?.("players")}
  creditsLoading={creditsLoading} creditsError={creditsQuery.isError||playersQuery.isError}
 />;
 return <section className="space-y-4 pb-7">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <button type="button" onClick={onBack} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-600 hover:border-blue-300 hover:text-[#003399]">
    <ArrowLeft size={14}/> Volver al ranking
   </button>
   <button type="button" onClick={()=>navigate(clubUrl)}
    className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-[11px] font-semibold text-[#003399] hover:bg-blue-50">
    Abrir ficha del equipo <ArrowUpRight size={13}/>
   </button>
  </div>
  <header className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0d2c52] via-[#123a6d] to-[#365d88] px-5 py-6 text-white md:px-7 md:py-7">
   <div className="pointer-events-none absolute -right-16 -top-28 h-72 w-72 rounded-full border border-white/10"/>
   <div className="relative flex flex-wrap items-center gap-5">
    <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/95 shadow-lg">
     <Picture src={logo} kind="team" size="h-[106px] w-[106px]"/>
    </div>
    <div className="min-w-0 flex-1">
     <p className="text-[10px] font-black uppercase tracking-[.19em] text-[#bed6f4]">MF LEGACY · ARCHIVO HISTÓRICO DEL CLUB</p>
     <h2 className="mt-2 text-2xl font-black tracking-tight md:text-4xl">{clubName}</h2>
     <p className="mt-2 text-[11px] text-white/70">Palmarés por competición, ediciones y jugadores con adjudicación confirmada</p>
     <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-semibold text-white/85">
      <ShieldCheck size={13}/> Solo títulos verificados
     </div>
    </div>
    <div className="shrink-0 text-center md:px-4">
     <p className="text-5xl font-black tabular-nums">{history.total}</p>
     <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-white/75">{history.total===1?"título":"títulos"}</p>
    </div>
   </div>
  </header>
  <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
   <Snapshot icon={Medal} label="Títulos oficiales" value={history.total}/>
   <Snapshot icon={Trophy} label="Trofeos diferentes" value={history.distinct}/>
   <Snapshot icon={CalendarDays} label="Última conquista" value={history.latest||"—"}/>
   <Snapshot icon={Users} label="Jugadores acreditados" value={creditsLoading?"…":history.confirmedPlayerCount}/>
  </div>
  <nav aria-label="Secciones del palmarés del club" className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1.5">
   {options.map(([key,label])=><button key={key} type="button" aria-current={tab===key?"page":undefined}
    onClick={()=>setTab(key)}
    className={"rounded-lg px-4 py-2 text-[11px] font-bold transition "+(tab===key?"bg-[#003399] text-white":"text-slate-500 hover:bg-slate-100")}>{label}</button>)}
  </nav>
  {(creditsQuery.isError||playersQuery.isError)&&<p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">No se ha podido consultar el registro completo de jugadores. Las adjudicaciones permanecen sin cambios; vuelve a cargar para comprobarlas.</p>}
  {tab==="overview"&&<div className="space-y-5">
   <div className="flex items-end justify-between gap-3">
    <div><h3 className="text-base font-black text-slate-900">Colección de títulos</h3>
     <p className="mt-1 text-[11px] text-slate-500">Agrupados por trofeo. Pulsa uno para consultar todas sus conquistas.</p></div>
    {history.total>0&&<button type="button" onClick={()=>showChronology()} className="inline-flex items-center gap-1 text-[11px] font-bold text-[#003399] hover:underline">Ver cronología <ArrowRight size={13}/></button>}
   </div>
   {history.competitions.length?<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
    {history.competitions.map(entry=><button key={entry.source_id} type="button" onClick={()=>showChronology(entry.source_id)}
     className="group flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:border-blue-300 hover:shadow-md">
     <Picture src={trophyImageUrl(entry.trophy,manifest)} size="h-24 w-24"/>
     <div className="min-w-0 flex-1">
      <p className={low}>Competición</p>
      <p className="mt-1 line-clamp-2 text-[12px] font-black leading-5 text-slate-800">{entry.name}</p>
      <p className="mt-2 text-[11px] text-slate-500">Última: {entry.latest}</p>
     </div>
     <div className="shrink-0 rounded-xl bg-[#edf3fb] px-3 py-2 text-center">
      <p className="text-2xl font-black tabular-nums text-[#003399]">{entry.count}</p>
      <p className="text-[9px] text-slate-500">veces</p>
     </div>
    </button>)}
   </div>:<Empty title="Sin campeonatos verificados" description="Importa los títulos oficiales desde Sincronizar y verifica las fuentes. Este archivo se actualizará con los registros confirmados."/>}
   {history.timeline.length>0&&<div>
    <div className="mb-3 flex items-end justify-between gap-2"><h3 className="text-base font-black text-slate-900">Últimas temporadas campeonas</h3>
     <button type="button" onClick={()=>showChronology()} className="text-[11px] font-bold text-[#003399] hover:underline">Ver todas</button></div>
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">{history.timeline.slice(0,3).map(group=>
     <button type="button" key={group.season} onClick={()=>{showChronology();setExpanded(group.season);}}
      className="rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-blue-300">
      <p className="text-lg font-black tabular-nums text-[#12325c]">{group.season}</p>
      <p className="mt-1 text-[11px] text-slate-500">{group.count} {group.count===1?"título":"títulos"}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">{group.editions.slice(0,5).map(h=>
       <div key={h.id||h.trophy_source_id} title={h.trophy.name} className="rounded-lg border border-slate-100 bg-slate-50 p-1">
        <Picture src={trophyImageUrl(h.trophy,manifest)} size="h-12 w-12"/>
       </div>)}</div>
     </button>)}</div>
   </div>}
  </div>}
  {tab==="timeline"&&<div className="space-y-4">
   <div className="flex flex-wrap items-center justify-between gap-3">
    <div><h3 className="text-base font-black text-slate-900">Cronología de conquistas</h3><p className="mt-1 text-[11px] text-slate-500">Cada tarjeta representa un título oficial verificado, no una participación.</p></div>
    <select value={competition} aria-label="Filtrar cronología por competición"
     onChange={e=>{setCompetition(e.target.value);setExpanded(null);}}
     className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700">
     <option value="all">Todas las competiciones</option>
     {history.competitions.map(t=><option key={t.source_id} value={t.source_id}>{t.name}</option>)}
    </select>
   </div>
   {filtered.length?<div className="space-y-3">{filtered.map(group=>
    <section key={group.season} className="rounded-2xl border border-slate-200 bg-white">
     <button type="button" onClick={()=>expandYear(group.season)} aria-expanded={expanded===group.season}
      className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-slate-50">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#edf3fb] text-[#003399]"><CalendarDays size={18}/></span>
      <span className="min-w-0 flex-1">
       <strong className="text-sm tabular-nums text-slate-900">{group.season}</strong>
       <span className="ml-3 text-[11px] text-slate-500">{group.editions.length} {group.editions.length===1?"título":"títulos"}</span>
      </span>
      <span className="flex items-center gap-1.5">{group.editions.slice(0,4).map(h=>
       <Picture key={h.id||h.trophy_source_id} src={trophyImageUrl(h.trophy,manifest)} size="h-9 w-9"/>)}</span>
      {expanded===group.season?<ChevronUp size={16} className="text-slate-400"/>:<ChevronDown size={16} className="text-slate-400"/>}
     </button>
     {expanded===group.season&&<div className="grid gap-3 border-t border-slate-100 bg-[#f8fafd] p-3 md:grid-cols-2 xl:grid-cols-3">
      {group.editions.map(h=><div key={h.id||h.trophy_source_id} className="min-w-0 rounded-xl border border-slate-200 bg-white p-3">
       <button type="button" onClick={()=>showEdition(h)} aria-label={"Abrir edición "+h.trophy.name+" "+h.season}
        className="flex w-full gap-3 rounded-lg p-1 text-left transition hover:bg-blue-50">
        <Picture src={trophyImageUrl(h.trophy,manifest)} size="h-[76px] w-[76px]"/>
        <span className="min-w-0 flex-1">
         <span className="line-clamp-2 text-xs font-black leading-5 text-slate-900">{h.trophy.name}</span>
         <span className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-emerald-700"><CheckCircle2 size={12}/> Campeón verificado</span>
         <span className="mt-1 block text-[10px] text-slate-500">{creditsLoading?"Consultando jugadores…":h.confirmedPlayerCount+" jugadores acreditados"}</span>
        </span>
       </button>
       {h.confirmedPlayers.length>0&&<div className="mt-3 border-t border-slate-100 pt-2">
        <p className={low}>Jugadores confirmados</p>
        <div className="mt-2 flex flex-wrap gap-1.5">{h.confirmedPlayers.slice(0,6).map(p=><button key={p.id} type="button"
         onClick={()=>navigate("/players?stats_player="+encodeURIComponent(p.id))}
         className="rounded-md bg-[#f0f4fa] px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-blue-100">{p.name}</button>)}
        </div>
        {h.confirmedPlayerCount>6&&<p className="mt-2 text-[10px] text-slate-500">+{h.confirmedPlayerCount-6} jugadores · consulta la pestaña Jugadores</p>}
       </div>}
       {!creditsLoading&&h.confirmedPlayers.length===0&&<p className="mt-3 text-[10px] text-slate-400">Sin jugadores confirmados todavía. No implica ausencia de participantes.</p>}
       <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
        <div className="flex flex-wrap items-center gap-3">
         <button type="button" onClick={()=>showEdition(h)}
          className="inline-flex items-center gap-1 rounded-lg bg-[#003399] px-2.5 py-1.5 text-[10px] font-bold text-white hover:bg-[#002b7a]">
          Ver edición <ArrowUpRight size={12}/>
         </button>
         <button type="button" onClick={()=>openTrophy(h.trophy_source_id)} className="text-[10px] font-bold text-[#003399] hover:underline">Ficha del trofeo</button>
        </div>
        {linkOk(h.source_url)&&<a target="_blank" rel="noreferrer" href={h.source_url} className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-[#003399]">Fuente oficial <ExternalLink size={11}/></a>}
       </div>
      </div>)}
     </div>}
    </section>
   )}</div>:<Empty title="Sin títulos en este filtro" description="Selecciona otra competición para consultar las ediciones verificadas."/>}
  </div>}
  {tab==="players"&&<div className="space-y-4">
   <div><h3 className="text-base font-black text-slate-900">Jugadores vinculados a los títulos</h3>
    <p className="mt-1 text-[11px] text-slate-500">Solo adjudicaciones individuales confirmadas con un campeón y una edición verificados.</p></div>
   {creditsLoading&&<p className="text-xs text-slate-500">Cargando relaciones de jugadores…</p>}
   {!creditsLoading&&history.players.length>0&&<div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
    {history.players.map((p,index)=><article key={p.id} className="rounded-xl border border-slate-200 bg-white p-3.5">
     <div className="flex items-center gap-3">
      <span className="w-5 text-[11px] font-black text-slate-400">{index+1}</span>
      <Picture kind="player" size="h-16 w-16" src={p.player?.photo_url||p.player?.photoUrl||p.player?.image_url||p.player?.card_photo_url}/>
      <div className="min-w-0 flex-1">
       <p className="truncate text-xs font-black text-slate-900">{p.name}</p>
       <p className="mt-1 text-[10px] text-slate-500">{p.distinct} {p.distinct===1?"competición":"competiciones"}</p>
       <button type="button" className="mt-1 text-[10px] font-semibold text-[#003399] hover:underline" onClick={()=>navigate("/players?stats_player="+encodeURIComponent(p.id))}>Ver jugador <ArrowUpRight size={11} className="inline"/></button>
      </div>
      <p className="text-2xl font-black text-[#003399]">{p.count}</p>
     </div>
     <div className="mt-3 flex gap-1.5 overflow-x-auto border-t border-slate-100 pt-2">
      {p.editions.map(h=><button key={h.id||h.trophy_source_id} type="button" onClick={()=>openTrophy(h.trophy_source_id)} title={h.trophy.name+" · "+h.season}
       className="shrink-0 rounded-lg bg-[#f7f9fc]"><Picture src={trophyImageUrl(h.trophy,manifest)} size="h-12 w-12"/></button>)}
     </div>
    </article>)}
   </div>}
   {!creditsLoading&&!history.players.length&&<Empty title="No hay jugadores confirmados en este palmarés" description="El club sí puede tener títulos oficiales; las adjudicaciones a jugadores se gestionan por separado en Sincronizar. Los candidatos todavía no cuentan."/>}
  </div>}
 </section>;
}
