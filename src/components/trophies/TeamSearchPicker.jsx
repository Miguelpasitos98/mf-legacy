import React,{useEffect,useMemo,useRef,useState} from "react";
import {Search,ChevronDown,X,Check,Shield} from "lucide-react";
import {normalizeImageUrl} from "@/components/teams/teamUtils";
import {normaliseSearch} from "@/utils/trophyCatalog";

const MAX_VISIBLE=60;
export function filterTrophyTeams(teams,search){
 const q=normaliseSearch(search);
 const list=(teams||[]).filter(team=>team?.id&&team?.name);
 const matching=q?list.filter(team=>normaliseSearch([
  team.name,team.short_name,team.shortName,team.country,team.city
 ].filter(Boolean).join(" ")).includes(q)):list;
 return matching.sort((a,b)=>{
  if(q){
   const aStarts=normaliseSearch(a.name).startsWith(q),bStarts=normaliseSearch(b.name).startsWith(q);
   if(aStarts!==bStarts)return aStarts?-1:1;
  }
  return String(a.name).localeCompare(String(b.name),"es",{sensitivity:"base"});
 });
}

export default function TeamSearchPicker({teams=[],value="",onChange,loading=false,error=false}){
 const root=useRef(null),field=useRef(null),[isOpen,setIsOpen]=useState(false);
 const [search,setSearch]=useState(""),[active,setActive]=useState(0);
 const selected=teams.find(team=>String(team.id)===String(value));
 const matched=useMemo(()=>filterTrophyTeams(teams,search),[teams,search]);
 const visible=matched.slice(0,MAX_VISIBLE);
 useEffect(()=>{
  if(!isOpen)setSearch(selected?.name||"");
 },[isOpen,selected?.name]);
 useEffect(()=>{
  if(!isOpen)return;
  const outside=event=>{if(!root.current?.contains(event.target))setIsOpen(false);};
  document.addEventListener("pointerdown",outside);
  return ()=>document.removeEventListener("pointerdown",outside);
 },[isOpen]);
 const choose=team=>{
  onChange?.(String(team.id));
  setSearch(team.name);
  setActive(0);
  setIsOpen(false);
 };
 const updateQuery=text=>{
  setSearch(text);setActive(0);setIsOpen(true);
  // A newly typed search cannot silently retain a previous team.
  if(value)onChange?.("");
 };
 const handleKeys=event=>{
  if(event.key==="Escape"){
   event.preventDefault();setIsOpen(false);setSearch(selected?.name||"");return;
  }
  if(event.key==="ArrowDown"||event.key==="ArrowUp"){
   event.preventDefault();setIsOpen(true);
   setActive(index=>Math.max(0,Math.min(visible.length-1,index+(event.key==="ArrowDown"?1:-1))));
  }
  if(event.key==="Enter"&&isOpen&&visible.length){
   event.preventDefault();choose(visible[active]||visible[0]);
  }
 };
 return <div className="relative min-w-0" ref={root} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setIsOpen(false);}}>
  <label htmlFor="trophy-team-search" className="sr-only">Buscar equipo para investigar</label>
  <div className={"flex h-10 min-w-0 items-center gap-2 rounded-lg border bg-white px-2.5 transition focus-within:border-[#003399] focus-within:ring-2 focus-within:ring-[#003399]/10 "+(isOpen?"border-[#003399]":"border-slate-200")}>
   <Search size={15} className="shrink-0 text-slate-400"/>
   <input id="trophy-team-search" ref={field} role="combobox" type="text" autoComplete="off"
    aria-label="Buscar equipo para investigar" aria-controls="trophy-team-results" aria-expanded={isOpen}
    aria-autocomplete="list" aria-activedescendant={isOpen&&visible[active]?"trophy-team-option-"+active:undefined}
    placeholder={loading?"Cargando todos los equipos…":"Escribe para buscar un equipo…"}
    disabled={loading||error} value={search} onFocus={event=>{setIsOpen(true);event.target.select();setActive(0);}}
    onChange={event=>updateQuery(event.target.value)} onKeyDown={handleKeys}
    className="h-full min-w-0 flex-1 bg-transparent text-xs text-slate-800 outline-none placeholder:text-slate-400 disabled:opacity-50"/>
   {search&&<button type="button" aria-label="Limpiar equipo seleccionado" onClick={()=>{
    setSearch("");onChange?.("");setActive(0);setIsOpen(true);field.current?.focus();
   }} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={13}/></button>}
   <button type="button" aria-label={isOpen?"Cerrar lista de equipos":"Mostrar lista de equipos"}
    disabled={loading||error} className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100"
    onClick={()=>{if(!isOpen){setIsOpen(true);field.current?.focus();}else setIsOpen(false);}}>
    <ChevronDown size={15} className={isOpen?"rotate-180 transition":"transition"}/>
   </button>
  </div>
  {isOpen&&!loading&&!error&&<div id="trophy-team-results" role="listbox"
    aria-label="Equipos de MF Legacy" className="absolute left-0 right-0 top-[calc(100%+5px)] z-[90] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_16px_38px_rgba(15,23,42,.16)]">
   <div className="flex justify-between gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2 text-[10px] text-slate-500">
    <span>{matched.length.toLocaleString("es-ES")} {matched.length===1?"equipo encontrado":"equipos encontrados"}</span>
    {matched.length>MAX_VISIBLE&&<span>Mostrando {MAX_VISIBLE} · escribe para afinar</span>}
   </div>
   <div className="max-h-64 overflow-y-auto overscroll-contain py-1">
    {!matched.length&&<div className="px-3 py-5 text-center text-xs text-slate-500">No se encontraron equipos con ese nombre.</div>}
    {visible.map((team,index)=>{
     const logo=normalizeImageUrl(team.logo||team.logo_url||team.logoUrl);
     const chosen=String(value)===String(team.id);
     return <button type="button" role="option" id={"trophy-team-option-"+index} key={team.id}
      aria-selected={chosen} onMouseEnter={()=>setActive(index)} onMouseDown={e=>e.preventDefault()} onClick={()=>choose(team)}
      className={"flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition "+(active===index?"bg-blue-50 text-[#003399]":"hover:bg-slate-50 text-slate-700")}>
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-50">
       {logo?<img src={logo} alt="" loading="lazy" className="h-6 w-6 object-contain"
         onError={event=>{event.currentTarget.style.display="none";}}/>:<Shield size={14} className="text-slate-300"/>}
      </div>
      <span className="min-w-0 flex-1 truncate font-semibold">{team.name}</span>
      {team.country&&<span className="max-w-28 truncate text-[10px] text-slate-400">{team.country}</span>}
      {chosen&&<Check size={14} className="shrink-0 text-emerald-600"/>}
     </button>;
    })}
   </div>
  </div>}
 </div>;
}
