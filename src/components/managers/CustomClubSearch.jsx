import React,{useEffect,useId,useMemo,useRef,useState} from "react";
import {Check,ChevronsUpDown,Search,Shield} from "lucide-react";
import {normalizeImageUrl} from "@/components/teams/teamUtils";
import {searchCustomClubs} from "./customClubSearch.mjs";

function ClubLogo({team,size="md"}){
 const [broken,setBroken]=useState(false);
 const url=normalizeImageUrl(team?.logo||"");
 useEffect(()=>{setBroken(false)},[url]);
 return <span className={`flex shrink-0 items-center justify-center rounded-lg border border-slate-100 bg-slate-50 ${size==="lg"?"h-10 w-10":"h-9 w-9"}`}>
  {url&&!broken?<img src={url} alt="" loading="lazy" onError={()=>setBroken(true)} className="h-full w-full object-contain p-1"/>:
   <Shield aria-hidden="true" className="h-5 w-5 text-slate-400"/>}
 </span>;
}
/**
 * Fixed-width anchored listbox. Unlike floating-ui/Radix Popover and cmdk,
 * it does not observe the popover size while filtering rows. This avoids the
 * resize feedback loop emitted by the browser/Base44 error overlay on search.
 * Choosing a club changes only the selection passed to the parent.
 */
export default function CustomClubSearch({teams=[],selectedId="",disabled=false,onSelect}){
 const [open,setOpen]=useState(false);
 const [query,setQuery]=useState("");
 const [activeIndex,setActiveIndex]=useState(0);
 const containerRef=useRef(null);
 const inputRef=useRef(null);
 const listRef=useRef(null);
 const id=useId();
 const listId=id+"-clubs";
 const selected=teams.find(t=>String(t.id)===String(selectedId))||null;
 const candidates=useMemo(()=>searchCustomClubs(teams,query),[teams,query]);
 const close=()=>{setOpen(false);setQuery("");setActiveIndex(0)};
 const choose=id=>{
  close();
  if(String(id)!==String(selectedId))onSelect?.(String(id));
 };
 useEffect(()=>{
  if(disabled&&open)close();
 },[disabled,open]);
 useEffect(()=>{
  if(!open)return;
  inputRef.current?.focus();
  const handleOutside=event=>{
   if(containerRef.current&&!containerRef.current.contains(event.target))close();
  };
  const handleEscape=event=>{
   if(event.key==="Escape"){event.preventDefault();close();}
  };
  document.addEventListener("pointerdown",handleOutside);
  document.addEventListener("keydown",handleEscape);
  return ()=>{
   document.removeEventListener("pointerdown",handleOutside);
   document.removeEventListener("keydown",handleEscape);
  };
 },[open]);
 useEffect(()=>{
  if(!open)return;
  const active=listRef.current?.querySelector('[data-active="true"]');
  active?.scrollIntoView?.({block:"nearest"});
 },[activeIndex,query,open]);
 const handleKeyDown=event=>{
  if(event.key==="ArrowDown"){
   event.preventDefault();setActiveIndex(i=>Math.min(i+1,Math.max(0,candidates.length-1)));
  }else if(event.key==="ArrowUp"){
   event.preventDefault();setActiveIndex(i=>Math.max(0,i-1));
  }else if(event.key==="Enter"&&candidates.length){
   event.preventDefault();choose(candidates[Math.min(activeIndex,candidates.length-1)].id);
  }
 };
 return <div ref={containerRef} className="relative min-w-0">
  <label id={id+"-label"} className="block text-xs font-bold text-slate-800">Club personalizado</label>
  <button type="button" role="combobox" aria-controls={open?listId:undefined}
   aria-labelledby={id+"-label"} aria-label="Buscar club personalizado"
   aria-expanded={open&&!disabled} aria-haspopup="listbox" disabled={disabled}
   onClick={()=>open?close():(setQuery(""),setActiveIndex(0),setOpen(true))}
   className="mt-1 flex h-[52px] w-full min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white px-2.5 text-left shadow-sm transition hover:border-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-50">
   <ClubLogo team={selected} size="lg"/>
   <span className="min-w-0 flex-1">
    <span className="block truncate text-sm font-semibold text-slate-900">{selected?.name||"Buscar y seleccionar un club…"}</span>
    <span className="block text-[11px] text-slate-500">{selected?.short_name||"Escribe su nombre para encontrarlo"}</span>
   </span>
   <ChevronsUpDown aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400"/>
  </button>
  {open&&!disabled&&<div className="absolute left-0 top-full z-50 mt-1 w-full min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
   <div className="flex h-11 items-center gap-2 border-b border-slate-100 px-3">
    <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400"/>
    <input ref={inputRef} type="search" aria-label="Escribir nombre del club"
     aria-controls={listId} aria-activedescendant={candidates.length?listId+"-"+activeIndex:undefined}
     value={query} onChange={e=>{setQuery(e.target.value);setActiveIndex(0)}}
     onKeyDown={handleKeyDown} placeholder="Escribe el nombre o las siglas…"
     className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-slate-400"/>
   </div>
   <div className="px-3 py-2 text-[11px] font-medium text-slate-500">
    {candidates.length} {candidates.length===1?"club":"clubes"} {query?"encontrados":"disponibles"}
   </div>
   <div id={listId} ref={listRef} role="listbox" aria-label="Resultados de clubes"
    className="max-h-[280px] overflow-y-auto overscroll-contain p-1">
    {!candidates.length&&<p className="p-3 text-center text-sm text-slate-500">No se han encontrado clubes personalizados.</p>}
    {candidates.map((team,index)=><button type="button" role="option" id={listId+"-"+index}
     key={team.id} aria-selected={String(team.id)===String(selectedId)}
     data-active={index===activeIndex}
     onPointerMove={()=>{if(activeIndex!==index)setActiveIndex(index)}}
     onClick={()=>choose(team.id)}
     className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-left ${index===activeIndex?"bg-blue-50":"hover:bg-slate-50"}`}>
     <ClubLogo team={team}/>
     <span className="min-w-0 flex-1">
      <span className="block truncate text-sm font-semibold text-slate-900">{team.name}</span>
      {team.short_name&&<span className="text-[11px] text-slate-500">{team.short_name}</span>}
     </span>
     {String(team.id)===String(selectedId)&&<Check aria-label="Club seleccionado" className="h-4 w-4 shrink-0 text-blue-700"/>}
    </button>)}
   </div>
  </div>}
 </div>;
}
