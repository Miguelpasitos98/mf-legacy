import React,{useEffect,useMemo,useState} from "react";
import {Check,ChevronsUpDown,Shield} from "lucide-react";
import {Popover,PopoverContent,PopoverTrigger} from "@/components/ui/popover";
import {Command,CommandEmpty,CommandGroup,CommandInput,CommandItem,CommandList} from "@/components/ui/command";
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
/** Accessible popover combobox. The caller owns selection and route navigation. */
export default function CustomClubSearch({teams=[],selectedId="",disabled=false,onSelect}){
 const [open,setOpen]=useState(false);
 const [query,setQuery]=useState("");
 const selected=teams.find(t=>String(t.id)===String(selectedId))||null;
 const candidates=useMemo(()=>searchCustomClubs(teams,query),[teams,query]);
 const choose=id=>{
  setOpen(false);setQuery("");
  if(String(id)!==String(selectedId))onSelect?.(String(id));
 };
 return <div className="min-w-0">
  <label id="custom-club-search-label" className="block text-xs font-bold text-slate-800">Club personalizado</label>
  <Popover open={open&&!disabled} onOpenChange={next=>{setOpen(next);if(!next)setQuery("")}}>
   <PopoverTrigger asChild>
    <button type="button" role="combobox" aria-controls={open?"custom-club-search-results":undefined}
     aria-labelledby="custom-club-search-label" aria-label="Buscar club personalizado"
     aria-expanded={open&&!disabled} disabled={disabled}
     className="mt-1 flex h-[52px] w-full min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white px-2.5 text-left shadow-sm transition hover:border-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-50">
     <ClubLogo team={selected} size="lg"/>
     <span className="min-w-0 flex-1">
      <span className="block truncate text-sm font-semibold text-slate-900">{selected?.name||"Buscar y seleccionar un club…"}</span>
      <span className="block text-[11px] text-slate-500">{selected?.short_name||"Escribe su nombre para encontrarlo"}</span>
     </span>
     <ChevronsUpDown aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400"/>
    </button>
   </PopoverTrigger>
   <PopoverContent align="start" sideOffset={5} className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border p-0 shadow-xl">
    <Command shouldFilter={false}>
     <CommandInput autoFocus aria-label="Escribir nombre del club" placeholder="Escribe el nombre o las siglas…" value={query} onValueChange={setQuery}/>
     <CommandList id="custom-club-search-results" className="max-h-[320px]">
      <CommandEmpty>No se han encontrado clubes personalizados.</CommandEmpty>
      <CommandGroup heading={`${candidates.length} ${candidates.length===1?"club":"clubes"} ${query?"encontrados":"disponibles"}`}>
       {candidates.map(team=><CommandItem key={team.id} value={String(team.id)} onSelect={()=>choose(team.id)}
        className="cursor-pointer gap-3 rounded-lg px-2 py-2 data-[selected=true]:bg-blue-50">
        <ClubLogo team={team}/>
        <span className="min-w-0 flex-1">
         <span className="block truncate text-sm font-semibold">{team.name}</span>
         {team.short_name&&<span className="text-[11px] text-slate-500">{team.short_name}</span>}
        </span>
        {String(team.id)===String(selectedId)&&<Check aria-label="Club seleccionado" className="h-4 w-4 shrink-0 text-blue-700"/>}
       </CommandItem>)}
      </CommandGroup>
     </CommandList>
    </Command>
   </PopoverContent>
  </Popover>
 </div>;
}
