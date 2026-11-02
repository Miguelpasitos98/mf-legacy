import React,{useMemo,useState} from "react";
import {Check,ChevronsUpDown,Globe2} from "lucide-react";
import {Popover,PopoverTrigger,PopoverContent} from "@/components/ui/popover";
import {Command,CommandInput,CommandList,CommandGroup,CommandItem,CommandEmpty} from "@/components/ui/command";
import {findManagerNationality} from "./managerNationalitySearch.mjs";

export default function ManagerNationalityPicker({countries=[],country=null,onChange,disabled=false}){
 const [open,setOpen]=useState(false),[query,setQuery]=useState("");
 const matching=useMemo(()=>findManagerNationality(countries,query),[countries,query]);
 const close=next=>{setOpen(next);if(!next)setQuery("")};
 const choose=value=>{onChange?.(value);close(false)};
 return <Popover open={open&&!disabled} onOpenChange={close}>
  <PopoverTrigger asChild>
   <button type="button" disabled={disabled} role="combobox"
    aria-label="País de nacionalidad" aria-expanded={open&&!disabled}
    className="flex min-h-10 w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-900 outline-none transition hover:border-blue-300 focus-visible:ring-2 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-50">
    {country?.flag?<img src={country.flag} alt="" className="h-5 w-7 shrink-0 rounded object-contain" onError={event=>{event.currentTarget.style.display="none"}}/>:<Globe2 aria-hidden="true" size={17} className="shrink-0 text-slate-400"/>}
    <span className={`min-w-0 flex-1 truncate ${country?"font-medium":"text-slate-500"}`}>
     {country?.name||"Seleccionar nacionalidad…"}
    </span>
    {country?.code&&<span className="shrink-0 text-xs text-slate-500">{country.code}</span>}
    <ChevronsUpDown aria-hidden="true" size={16} className="shrink-0 text-slate-400"/>
   </button>
  </PopoverTrigger>
  <PopoverContent align="start" sideOffset={4} className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg p-0 shadow-xl">
   <Command shouldFilter={false}>
    <CommandInput autoFocus aria-label="Buscar nacionalidad" placeholder="Escribe un país o código…" value={query} onValueChange={setQuery}/>
    <CommandList className="max-h-64">
     <CommandEmpty>País no encontrado.</CommandEmpty>
     <CommandGroup heading="Países de Countries">
      {matching.map(item=><CommandItem key={item.id} value={String(item.id)} onSelect={()=>choose(String(item.id))}
       className="cursor-pointer gap-3 py-2">
       {item.flag?<img src={item.flag} alt="" loading="lazy" className="h-5 w-7 shrink-0 rounded object-contain" onError={e=>{e.currentTarget.style.display="none"}}/>:<Globe2 size={16} aria-hidden="true" className="shrink-0 text-slate-400"/>}
       <span className="min-w-0 flex-1 truncate">{item.name}</span>
       {item.code&&<span className="text-xs text-slate-500">{item.code}</span>}
       {String(item.id)===String(country?.id)&&<Check size={16} className="text-blue-700"/>}
      </CommandItem>)}
     </CommandGroup>
    </CommandList>
   </Command>
  </PopoverContent>
 </Popover>;
}
