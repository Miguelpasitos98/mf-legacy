import React,{useMemo,useState} from "react";
import {AlertTriangle,ChevronDown,ImageOff,Images,Search} from "lucide-react";
import {statusOf} from "@/utils/trophyImages";
import {trophyImageUrl} from "@/utils/trophyCatalog";

const names={wrong:"Incorrecta",missing:"Sin imagen",provisional:"Provisional",verified:"Verificada",auto:"Automática"};
export default function TrophyImageReviewQueue({catalog=[],manifest,onOpen}){
 const [expanded,setExpanded]=useState(false);
 const [status,setStatus]=useState("pending");
 const [query,setQuery]=useState("");
 const flagged=useMemo(()=>catalog.filter(t=>["wrong","missing","provisional","verified"].includes(statusOf(t))),[catalog]);
 const visible=useMemo(()=>{
  const q=query.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
  return flagged.filter(t=>(status==="all"||(status==="pending"?statusOf(t)!=="verified":statusOf(t)===status))
    &&(!q||(String(t.name)+" "+t.source_id).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().includes(q)))
    .sort((a,b)=>a.name.localeCompare(b.name,"es",{numeric:true}));
 },[flagged,status,query]);
 const count=flagged.filter(t=>statusOf(t)!=="verified").length;
 return <section className="mb-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
  <button type="button" aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)} className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
   <span className="grid h-9 w-9 place-items-center rounded-lg bg-amber-50 text-amber-700"><Images size={19}/></span>
   <span className="min-w-0 flex-1"><strong className="block text-sm font-black text-slate-800">Revisión de imágenes</strong><span className="text-[11px] text-slate-500">Incorrectas, ausentes y provisionales · {count} por revisar</span></span>
   <ChevronDown size={16} className={"shrink-0 text-slate-500 transition "+(expanded?"rotate-180":"")}/>
  </button>
  {expanded&&<div className="border-t border-slate-200 p-4">
   <div className="mb-3 flex flex-wrap items-center gap-2">
    <label className="relative min-w-[160px] flex-1"><Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/><input aria-label="Buscar imagen de trofeo por revisar" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar trofeo o ID…" className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs"/></label>
    <select aria-label="Filtrar estado de imagen" value={status} onChange={e=>setStatus(e.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs">
     <option value="pending">Por revisar</option><option value="wrong">Incorrectas</option><option value="missing">Ausentes</option><option value="provisional">Provisionales</option><option value="verified">Verificadas</option><option value="all">Todas las revisadas</option>
    </select>
   </div>
   {visible.length===0?<p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">No hay imágenes con este estado. Marca una imagen como incorrecta desde la ficha para añadirla aquí.</p>:
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
     {visible.map(t=><button key={t.source_id} type="button" onClick={()=>onOpen(t)} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2 text-left hover:border-blue-200 hover:bg-blue-50">
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-slate-50">
       {trophyImageUrl(t,manifest)?<img src={trophyImageUrl(t,manifest)} loading="lazy" alt="" className="h-12 w-12 object-contain"/>:<ImageOff size={21} className="text-slate-300"/>}
      </span>
      <span className="min-w-0 flex-1"><strong className="block truncate text-xs text-slate-800">{t.name}</strong><span className="mt-1 block text-[10px] text-slate-500">ID {t.source_id}</span><span className={"mt-1 inline-flex items-center gap-1 text-[10px] font-semibold "+(statusOf(t)==="wrong"?"text-amber-700":"text-blue-700")}>{statusOf(t)==="wrong"&&<AlertTriangle size={12}/>} {names[statusOf(t)]}</span></span>
     </button>)}
    </div>}
  </div>}
 </section>;
}
