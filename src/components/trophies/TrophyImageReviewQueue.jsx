import React,{useMemo,useState} from "react";
import {AlertTriangle,ChevronDown,ImageOff,Images,Search,Upload,FileDown} from "lucide-react";
import {statusOf,parseTrophyImageCsv} from "@/utils/trophyImages";
import {trophyImageUrl} from "@/utils/trophyCatalog";

const names={wrong:"Incorrecta",missing:"Sin imagen",provisional:"Provisional",verified:"Verificada",auto:"Automática"};
export default function TrophyImageReviewQueue({catalog=[],manifest,onOpen,onImport}){
 const [importing,setImporting]=useState(false);
 const [importFeedback,setImportFeedback]=useState("");
 const [importError,setImportError]=useState("");
 const uploadCsv=async event=>{
  const file=event.target.files?.[0];event.target.value="";if(!file)return;
  setImportError("");setImportFeedback("");
  try{
   const records=parseTrophyImageCsv(await file.text());
   const ids=new Set(catalog.map(t=>String(t.source_id)));
   const unknown=records.filter(t=>!ids.has(t.source_id));
   if(unknown.length)throw Error("IDs no presentes en el catálogo: "+unknown.slice(0,10).map(x=>x.source_id).join(", "));
   if(!window.confirm("¿Aplicar "+records.length+" cambios de imagen? Los datos de las competiciones no se modificarán."))return;
   setImporting(true);
   const count=await onImport(records);
   setImportFeedback("Imágenes actualizadas: "+count+". Comprueba sus estados en la cola.");
  }catch(error){setImportError("Importación cancelada o fallida: "+(error?.message||error));}finally{setImporting(false);}
 };
 const downloadTemplate=()=>{
  const content="source_id;image_override_url;image_status;image_source_type;image_source_reference;image_notes\n13109924;https://ejemplo.org/trofeo.png;provisional;url;URL de procedencia;Revisar imagen antes de verificar\n";
  const url=URL.createObjectURL(new Blob(["\uFEFF"+content],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="MF_LEGACY_trophy_image_template.csv";a.click();URL.revokeObjectURL(url);
 };
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
   <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
    <p className="text-[11px] leading-4 text-slate-500">Gestiona correcciones de imágenes sin tocar el ID original ni los historiales de los trofeos.</p>
    <div className="flex flex-wrap items-center gap-1.5">
     <button type="button" onClick={downloadTemplate} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-50"><FileDown size={12}/> Plantilla CSV</button>
     <label className={"inline-flex cursor-pointer items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[10px] font-semibold text-[#003399] "+(importing?"opacity-50":"")}><Upload size={12}/> Importar imágenes CSV<input type="file" accept=".csv,text/csv" className="sr-only" disabled={importing} onChange={uploadCsv}/></label>
    </div>
   </div>
   {importError&&<p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-[11px] text-red-700">{importError}</p>}
   {importFeedback&&<p role="status" className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700">{importFeedback}</p>}
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
