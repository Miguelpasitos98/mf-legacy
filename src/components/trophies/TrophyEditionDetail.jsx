import React,{useEffect,useRef,useState} from "react";
import {useNavigate} from "react-router-dom";
import {ArrowLeft,ArrowUpRight,BookOpen,CheckCircle2,ExternalLink,Search,Shield,ShieldCheck,Trophy,Users,UserRoundCheck,Clock3,Info} from "lucide-react";
import {trophyImageUrl} from "@/utils/trophyCatalog";
import {normalizeImageUrl} from "@/components/teams/teamUtils";

const isWebLink=url=>/^https:\/\/[^\s/]+(?:\.[^\s/]+)?(?:\/[^\s]*)?$/i.test(String(url||"").trim());
const top="text-[10px] font-bold uppercase tracking-[.13em] text-slate-400";

function Photo({src,type="player",size="h-16 w-16"}){
 const [failed,setFailed]=useState(false);
 const Icon=type==="team"?Shield:type==="player"?Users:Trophy;
 const url=type==="trophy"?src:normalizeImageUrl(src);
 return <span className={"flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#f3f6fb] "+size}>
  {url&&!failed?<img alt="" loading="lazy" src={url} onError={()=>setFailed(true)} className={"h-full w-full "+(type==="player"?"object-contain object-bottom":"object-contain p-2")}/>:
   <Icon size={30} strokeWidth={1.4} className="text-slate-300"/>}
 </span>;
}
function PlayerCard({person,navigate,candidate=false}){
 const p=person.player;
 const photo=p?.photo_url||p?.photoUrl||p?.image_url||p?.card_photo_url;
 return <div className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
  <Photo src={photo}/>
  <div className="min-w-0 flex-1">
   <p className="truncate text-[12px] font-black text-slate-800" title={person.name}>{person.name}</p>
   <p className={"mt-1 flex items-center gap-1 text-[10px] "+(candidate?"text-amber-700":"text-emerald-700")}>
    {candidate?<Clock3 size={12}/>:<CheckCircle2 size={12}/>}
    {candidate?"Pendiente de revisión":"Título confirmado"}
   </p>
   <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
    <button type="button" onClick={()=>navigate("/players?stats_player="+encodeURIComponent(person.id))}
     className="inline-flex items-center gap-1 text-[10px] font-bold text-[#003399] hover:underline">
     Ver jugador <ArrowUpRight size={12}/>
    </button>
    {!candidate&&isWebLink(person.evidence_url)&&<a href={person.evidence_url} target="_blank" rel="noopener noreferrer"
     className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-[#003399]">Evidencia <ExternalLink size={11}/></a>}
   </div>
  </div>
 </div>;
}
export default function TrophyEditionDetail({edition,team,teamId,manifest,onBack,onOpenTrophy,onSync,creditsLoading=false,creditsError=false}){
 const navigate=useNavigate();
 const backRef=useRef(null);
 const [search,setSearch]=useState("");
 const [showCandidates,setShowCandidates]=useState(false);
 const trophy=edition.trophy;
 const sourceId=edition.trophy_source_id;
 const name=team?.name||edition.recipient_name||"Equipo";
 const logo=team?.logo||team?.logo_url||team?.logoUrl;
 const confirmed=(edition.confirmedPlayers||[]).filter(p=>p.status==="confirmed");
 const pending=(edition.candidatePlayers||[]).filter(p=>p.status==="candidate");
 const normalized=search.trim().normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
 const matching=items=>normalized?items.filter(item=>item.name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().includes(normalized)):items;
 const confirmedResults=matching(confirmed),candidateResults=matching(pending);
 useEffect(()=>{backRef.current?.focus();},[]);
 return <section aria-label={"Edición "+trophy.name+" "+edition.season} className="space-y-4 pb-8">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <button type="button" ref={backRef} onClick={onBack} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-700 hover:border-blue-200 hover:text-[#003399]">
    <ArrowLeft size={15}/> Volver a la cronología
   </button>
   <button type="button" onClick={()=>onOpenTrophy?.(trophy)} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-100 bg-white px-3 py-2 text-[11px] font-bold text-[#003399] hover:bg-blue-50">
    Ficha del trofeo <ArrowUpRight size={13}/>
   </button>
  </div>
  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#102c51] via-[#133c6b] to-[#45688e] px-5 py-6 text-white md:px-8 md:py-8">
   <div className="pointer-events-none absolute -right-12 -top-24 h-64 w-64 rounded-full border border-white/15"/>
   <div className="relative flex flex-wrap items-center gap-5">
    <div className="flex h-44 w-36 shrink-0 items-center justify-center rounded-2xl bg-white/95 p-3 shadow-xl md:h-52 md:w-44">
     <Photo src={trophyImageUrl(trophy,manifest)} type="trophy" size="h-full w-full"/>
    </div>
    <div className="min-w-0 flex-1">
     <p className="text-[10px] font-bold uppercase tracking-[.18em] text-blue-200">MF LEGACY · EDICIÓN HISTÓRICA</p>
     <h2 className="mt-2 text-2xl font-black leading-tight tracking-tight md:text-4xl">{trophy.name}</h2>
     <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-bold tabular-nums">{edition.season}</span>
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-1.5 text-[10px] font-bold text-emerald-100">
       <CheckCircle2 size={13}/> Campeón verificado
      </span>
     </div>
     {edition.edition_label&&<p className="mt-3 text-[11px] text-white/75">{edition.edition_label}</p>}
     <div className="mt-5 flex items-center gap-3 border-t border-white/15 pt-4">
      <Photo src={logo} type="team" size="h-14 w-14"/>
      <div className="min-w-0"><p className="text-[10px] uppercase tracking-wider text-blue-200">Club campeón</p>
       <p className="mt-1 truncate text-base font-black">{name}</p></div>
      <button type="button" aria-label="Abrir ficha del club" onClick={()=>navigate("/teams?stats_team="+encodeURIComponent(teamId))}
       className="ml-auto rounded-lg border border-white/20 px-3 py-2 text-[11px] font-semibold hover:bg-white/10">Ver club</button>
     </div>
    </div>
   </div>
  </div>
  <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
   <div className="rounded-xl border border-slate-200 bg-white p-3">
    <p className={top}>Temporada</p><p className="mt-1 text-lg font-black tabular-nums text-[#14345b]">{edition.season}</p>
   </div>
   <div className="rounded-xl border border-slate-200 bg-white p-3">
    <p className={top}>Jugadores acreditados</p><p className="mt-1 text-2xl font-black tabular-nums text-[#14345b]">{creditsLoading?"—":confirmed.length}</p>
   </div>
   <div className="col-span-2 rounded-xl border border-slate-200 bg-white p-3 md:col-span-1">
    <p className={top}>Candidatos pendientes</p><p className="mt-1 text-2xl font-black tabular-nums text-amber-700">{creditsLoading?"—":pending.length}</p>
   </div>
  </div>
  <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_300px]">
   <div className="space-y-4">
    <div className="rounded-xl border border-slate-200 bg-white p-4">
     <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="flex items-center gap-2 text-sm font-black text-slate-900"><UserRoundCheck size={17} className="text-[#003399]"/> Futbolistas acreditados</h3>
       <p className="mt-1 text-[11px] text-slate-500">Ganadores confirmados para esta edición concreta.</p></div>
      <div className="relative"><Search size={14} className="absolute left-2.5 top-2.5 text-slate-400"/>
       <input aria-label="Buscar jugador de esta edición" value={search} onChange={e=>setSearch(e.target.value)}
        placeholder="Buscar jugador…" className="h-9 min-w-[190px] rounded-lg border border-slate-200 pl-8 pr-3 text-xs outline-none focus:border-[#003399]"/></div>
     </div>
     {creditsLoading&&<p role="status" className="mt-4 text-xs text-slate-500">Consultando adjudicaciones de jugadores…</p>}
     {creditsError&&<p role="alert" className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">No se han podido comprobar las adjudicaciones. No se muestran ganadores sin verificar.</p>}
     {!creditsLoading&&!creditsError&&confirmedResults.length>0&&<div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
      {confirmedResults.map(p=><PlayerCard key={p.id} person={p} navigate={navigate}/>)}
     </div>}
     {!creditsLoading&&!creditsError&&!confirmedResults.length&&<div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">
      <Users size={26} className="mx-auto text-slate-300"/>
      <p className="mt-2 text-xs font-bold text-slate-600">{search?"No hay coincidencias":"Todavía no hay jugadores acreditados"}</p>
      <p className="mt-1 text-[11px] text-slate-500">Esto no implica que ningún futbolista participara; solo indica que no existen adjudicaciones confirmadas en MF Legacy.</p>
     </div>}
    </div>
    {!creditsLoading&&!creditsError&&pending.length>0&&<div className="rounded-xl border border-amber-200 bg-white p-4">
     <button type="button" aria-expanded={showCandidates} onClick={()=>setShowCandidates(x=>!x)}
      className="flex w-full items-center justify-between gap-2 text-left">
      <span><span className="flex items-center gap-2 text-sm font-black text-slate-900"><Clock3 size={17} className="text-amber-600"/> Candidatos pendientes</span>
       <span className="mt-1 block text-[11px] text-slate-500">{pending.length} jugadores por revisar. No cuentan como ganadores.</span></span>
      <span className="text-[11px] font-bold text-amber-700">{showCandidates?"Ocultar":"Ver candidatos"}</span>
     </button>
     {showCandidates&&<div className="mt-4 space-y-3 border-t border-amber-100 pt-3">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">{candidateResults.map(p=><PlayerCard key={p.id} person={p} navigate={navigate} candidate/>)}</div>
      {candidateResults.length===0&&<p className="text-xs text-slate-500">No hay candidatos con ese nombre.</p>}
      <button type="button" onClick={onSync} className="rounded-lg bg-[#003399] px-3 py-2 text-[11px] font-bold text-white">Revisar en Sincronizar</button>
     </div>}
    </div>}
   </div>
   <aside className="space-y-3">
    <div className="rounded-xl border border-slate-200 bg-white p-4">
     <h3 className="flex items-center gap-2 text-sm font-black text-slate-900"><BookOpen size={17} className="text-[#003399]"/> Fuentes y verificación</h3>
     <p className="mt-3 flex items-center gap-1.5 text-[11px] font-bold text-emerald-700"><ShieldCheck size={14}/> Título del club verificado</p>
     <p className="mt-2 text-[11px] leading-5 text-slate-500">La fuente del campeón y las evidencias de cada futbolista se conservan por separado.</p>
     {isWebLink(edition.source_url)?<a href={edition.source_url} target="_blank" rel="noopener noreferrer"
      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-[11px] font-bold text-[#003399] hover:bg-blue-100">
      Consultar fuente del título <ExternalLink size={13}/></a>:
      <p className="mt-4 rounded-lg bg-amber-50 p-3 text-[11px] text-amber-700">No hay URL de fuente registrada para esta edición.</p>}
     <div className="mt-4 border-t border-slate-100 pt-3">
      <p className={top}>Referencia interna</p>
      <p className="mt-1 break-all font-mono text-[10px] text-slate-500">Trofeo: {sourceId}</p>
      <p className="mt-1 break-all font-mono text-[10px] text-slate-500">Equipo: {teamId}</p>
     </div>
    </div>
    <div className="rounded-xl border border-slate-200 bg-white p-4">
     <p className="flex items-center gap-2 text-[11px] font-black text-slate-800"><Info size={15} className="text-slate-400"/> Criterio de adjudicación</p>
     <p className="mt-2 text-[11px] leading-5 text-slate-500">Solo se muestra como ganador a un futbolista cuando el título colectivo del club y su crédito individual están verificados. La pertenencia al equipo o los partidos disputados no bastan por sí solos.</p>
    </div>
   </aside>
  </div>
 </section>;
}
