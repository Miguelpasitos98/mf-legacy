import React,{useEffect,useId,useMemo,useRef,useState} from 'react';
import {Check,ChevronDown,Flag,Globe2,Search,X} from 'lucide-react';
import {normalizeTrophyName} from '@/utils/trophyResearch';

function CountryFlag({country}){
 const [error,setError]=useState(false);
 useEffect(()=>setError(false),[country?.flag]);
 return country?.flag&&!error
  ? <img src={country.flag} alt={'Bandera de '+country.name} loading="lazy" onError={()=>setError(true)} className="h-4 w-6 shrink-0 rounded-sm border border-slate-100 object-cover"/>
  : <Flag size={16} className="shrink-0 text-slate-300" aria-hidden="true"/>;
}
/** A controlled Country.id selector, with keyboard filtering and an explicit international state. */
export default function TrophyCountryPicker({countries=[],value='',scope='pending',onChange,disabled=false}){
 const root=useRef(null),field=useRef(null),id=useId();
 const [open,setOpen]=useState(false),[search,setSearch]=useState(''),[active,setActive]=useState(0);
 const selected=countries.find(c=>String(c.id)===String(value))||null;
 const choices=useMemo(()=>[...countries].filter(c=>c?.id&&c?.name).sort((a,b)=>a.name.localeCompare(b.name,'es')), [countries]);
 const filtered=useMemo(()=>choices.filter(c=>normalizeTrophyName(c.name+' '+(c.code||'')).includes(normalizeTrophyName(search))).slice(0,100),[choices,search]);
 useEffect(()=>{if(!open)setSearch(selected?.name||'');},[open,selected?.name]);
 useEffect(()=>{
  if(!open)return;
  const outside=e=>{if(root.current&&!root.current.contains(e.target))setOpen(false);};
  document.addEventListener('pointerdown',outside);
  return()=>document.removeEventListener('pointerdown',outside);
 },[open]);
 const choose=(country,mode)=>{
  onChange?.(country||null,mode||'manual');setOpen(false);setActive(0);
  setSearch(country?.name||'');
 };
 const onKeyDown=e=>{
  if(e.key==='Escape'){e.preventDefault();setOpen(false);setSearch(selected?.name||'');}
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){
   e.preventDefault();setOpen(true);setActive(i=>Math.max(0,Math.min(filtered.length-1,i+(e.key==='ArrowDown'?1:-1))));
  }
  if(e.key==='Enter'&&open){e.preventDefault();if(filtered[active])choose(filtered[active]);}
 };
 return <div ref={root} className="relative min-w-0" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setOpen(false);}}>
  <div className={'flex h-10 w-full items-center gap-2 rounded-lg border bg-white px-2.5 focus-within:border-[#003399] focus-within:ring-2 focus-within:ring-blue-100 '+(open?'border-[#003399]':'border-slate-200')}>
   {selected?<CountryFlag country={selected}/>:scope==='international'?<Globe2 size={17} className="shrink-0 text-blue-500"/>:<Search size={16} className="shrink-0 text-slate-400"/>}
   <input id={id} ref={field} role="combobox" type="text" autoComplete="off" aria-label="Buscar y vincular país de la competición" aria-autocomplete="list" aria-expanded={open} aria-controls={id+'-options'}
    disabled={disabled} value={open?search:(selected?.name|| (scope==='international'?'Internacional · sin país único':search))}
    onFocus={()=>{setOpen(true);setSearch('');setActive(0);}}
    onClick={()=>setOpen(true)} onChange={e=>{setSearch(e.target.value);setOpen(true);setActive(0);}} onKeyDown={onKeyDown}
    placeholder="Escribe el nombre o código del país…" className="min-w-0 flex-1 bg-transparent text-xs text-slate-800 outline-none placeholder:text-slate-400" />
   {selected&&<button type="button" title="Quitar país" className="shrink-0 p-1 text-slate-400 hover:text-slate-800" onMouseDown={e=>e.preventDefault()} onClick={()=>choose(null,'pending')}><X size={14}/></button>}
   <button type="button" title="Mostrar países" aria-label="Abrir selector de países" disabled={disabled} onMouseDown={e=>e.preventDefault()} onClick={()=>{setOpen(!open);field.current?.focus();}} className="shrink-0 p-1 text-slate-400"><ChevronDown size={15}/></button>
  </div>
  {open&&<div id={id+'-options'} role="listbox" className="absolute inset-x-0 top-[calc(100%+4px)] z-[400] max-h-72 overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-[0_16px_40px_rgba(15,23,42,.17)]">
   <div className="sticky top-0 z-10 mb-1 border-b border-slate-100 bg-white px-2 py-2 text-[10px] text-slate-500">{filtered.length} países encontrados · ↑ ↓ y Enter para elegir</div>
   <button type="button" role="option" aria-selected={!selected&&scope==='international'} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-blue-700 hover:bg-blue-50" onMouseDown={e=>e.preventDefault()} onClick={()=>choose(null,'international')}><Globe2 size={15}/> Internacional / varias federaciones (sin Country)</button>
   <button type="button" role="option" aria-selected={!selected&&scope!=='international'} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-slate-500 hover:bg-slate-50" onMouseDown={e=>e.preventDefault()} onClick={()=>choose(null,'pending')}><X size={14}/> Sin país confirmado · pendiente</button>
   {filtered.map((c,i)=><button role="option" aria-selected={selected?.id===c.id} type="button" key={c.id} onMouseDown={e=>e.preventDefault()} onMouseEnter={()=>setActive(i)} onClick={()=>choose(c)} className={'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-blue-50 '+(i===active?'bg-blue-50':'')}>
    <CountryFlag country={c}/><span className="min-w-0 flex-1 truncate font-semibold text-slate-800">{c.name}</span><span className="text-[10px] text-slate-400">{c.code||''}</span>{selected?.id===c.id&&<Check size={14} className="text-emerald-600"/>}
   </button>)}
   {!filtered.length&&<p className="p-3 text-xs text-slate-500">No aparece en Country. Debes crear primero ese país en el catálogo Countries.</p>}
  </div>}
 </div>;
}
