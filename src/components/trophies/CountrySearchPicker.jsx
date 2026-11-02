import React,{useEffect,useId,useMemo,useRef,useState} from "react";
import {Check,ChevronDown,Search,X} from "lucide-react";
import {normaliseSearch} from "@/utils/trophyCatalog";

// Filter by normalized country names, so "espana" finds "España" and "mexico" finds "México".
export const filterCountryOptions=(options,search)=>{
 const q=normaliseSearch(search);
 if(!q)return options||[];
 return (options||[]).filter(option=>normaliseSearch(option.label).includes(q));
};

export default function CountrySearchPicker({options=[],value="all",onChange}){
 const root=useRef(null);
 const field=useRef(null);
 const listId=useId();
 const [open,setOpen]=useState(false);
 const [search,setSearch]=useState("");
 const [active,setActive]=useState(0);
 const selected=options.find(option=>option.value===value)||options[0];
 const matches=useMemo(()=>filterCountryOptions(options,search),[options,search]);
 useEffect(()=>{
  if(!open)setSearch(selected?.label||"Todos los países");
 },[open,selected?.label]);
 useEffect(()=>{
  if(!open)return;
  const outside=event=>{if(!root.current?.contains(event.target))setOpen(false);};
  document.addEventListener("pointerdown",outside);
  return ()=>document.removeEventListener("pointerdown",outside);
 },[open]);
 const choose=option=>{
  onChange?.(option.value);
  setSearch(option.label);
  setActive(0);
  setOpen(false);
 };
 const focus=()=>{
  setSearch("");
  setActive(0);
  setOpen(true);
 };
 const type=next=>{
  setSearch(next);
  setActive(0);
  setOpen(true);
  if(value!=="all")onChange?.("all");
 };
 const keys=event=>{
  if(event.key==="Escape"){
   event.preventDefault();
   setOpen(false);
   setSearch(selected?.label||"Todos los países");
  }else if(event.key==="ArrowDown"||event.key==="ArrowUp"){
   event.preventDefault();
   if(!open){focus();return;}
   if(!matches.length)return;
   setActive(i=>(i+(event.key==="ArrowDown"?1:-1)+matches.length)%matches.length);
  }else if(event.key==="Enter"&&open){
   event.preventDefault();
   const chosen=matches[Math.min(active,matches.length-1)];
   if(chosen)choose(chosen);
  }
 };
 return <div ref={root} className="relative z-50 min-w-0" onBlur={event=>{
  if(!event.currentTarget.contains(event.relatedTarget))setOpen(false);
 }}>
  <label htmlFor={listId+"-input"} className="sr-only">Buscar país de la competición</label>
  <div className={"flex h-10 w-full items-center gap-2 rounded-lg border bg-white px-2.5 transition focus-within:border-[#003399] focus-within:ring-2 focus-within:ring-[#003399]/10 "+(open?"border-[#003399]":"border-slate-200")}>
   <Search size={15} className="shrink-0 text-slate-400"/>
   <input ref={field} id={listId+"-input"} type="text" role="combobox"
    aria-label="Buscar país de la competición" aria-expanded={open}
    aria-controls={listId+"-options"} aria-autocomplete="list"
    aria-activedescendant={open&&matches[active]?listId+"-item-"+active:undefined}
    autoComplete="off" value={search} placeholder="Escribe un país…"
    onFocus={focus} onClick={()=>setOpen(true)} onChange={e=>type(e.target.value)}
    onKeyDown={keys}
    className="min-w-0 flex-1 bg-transparent text-xs text-slate-800 outline-none placeholder:text-slate-400"/>
   {search&&<button type="button" title="Limpiar país" aria-label="Mostrar todos los países"
    onMouseDown={e=>e.preventDefault()} onClick={()=>{onChange?.("all");focus();field.current?.focus();}}
    className="rounded p-1 text-slate-400 hover:bg-slate-100"><X size={13}/></button>}
   <button type="button" aria-label={open?"Cerrar países":"Abrir lista de países"}
    onMouseDown={e=>e.preventDefault()} onClick={()=>{if(open)setOpen(false);else{focus();field.current?.focus();}}}
    className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100">
    <ChevronDown size={15} className={"transition "+(open?"rotate-180":"")}/>
   </button>
  </div>
  {open&&<div id={listId+"-options"} role="listbox" aria-label="Países de las competiciones"
   className="absolute inset-x-0 top-[calc(100%+5px)] z-[100] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_16px_38px_rgba(15,23,42,.16)]">
   <p className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-[10px] text-slate-500">
    {matches.length} {matches.length===1?"opción encontrada":"opciones encontradas"} · Escribe para buscar
   </p>
   <div className="max-h-64 overflow-y-auto overscroll-contain py-1">
    {!matches.length&&<p className="px-3 py-5 text-center text-xs text-slate-500">No se encontraron países con ese nombre.</p>}
    {matches.map((option,index)=><button type="button" role="option" id={listId+"-item-"+index}
     aria-selected={option.value===value} key={option.value}
     onMouseEnter={()=>setActive(index)} onMouseDown={e=>e.preventDefault()}
     onClick={()=>choose(option)}
     className={"flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition "+(index===active?"bg-blue-50 text-[#003399]":"text-slate-700 hover:bg-slate-50")}>
     <span className="min-w-0 flex-1 truncate font-semibold">{option.label}</span>
     {Number.isFinite(option.count)&&<span className="shrink-0 text-[10px] text-slate-400">{option.count}</span>}
     {option.value===value&&<Check size={14} className="shrink-0 text-emerald-600"/>}
    </button>)}
   </div>
  </div>}
 </div>;
}
