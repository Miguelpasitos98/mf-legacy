import React,{useEffect,useRef,useState} from "react";
import {Cloud,CloudDownload,Loader2,RefreshCw} from "lucide-react";
import {base44} from "@/api/base44Client";
import {checkVault,downloadVault,downloadVaultIndex,listVault,uploadVault,uploadVaultIndex} from "@/utils/fmVaultClient.mjs";

export default function FmVaultPanel({readyFile,onOpenFile,onOpenIndex,disabled=false}){
 const [connected,setConnected]=useState(false);
 const [items,setItems]=useState([]);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [progress,setProgress]=useState({done:0,total:0,caption:""});
 const [message,setMessage]=useState("");
 const [error,setError]=useState("");
 const attemptedRef=useRef(new Set());
 const refresh=async()=>{
  const result=await listVault(base44,"");setItems(result.items||[]);
 };
 useEffect(()=>{
  let active=true;
  (async()=>{await checkVault(base44,"");if(!active)return;await refresh();if(active){setConnected(true);setError("");}})()
   .catch(e=>{if(active){setConnected(false);setError("La nube no está disponible: "+e.message);}})
   .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[]);
 const archive=async(fileData=readyFile)=>{
  if(!fileData?.file||busy||!connected)return;
  setBusy(true);setError("");setMessage("");setProgress({done:0,total:0,caption:"Guardando en la nube"});
  try{
   const result=await uploadVault(base44,"",fileData.file,{...fileData.meta,players_count:fileData.count},(done,total)=>setProgress({done,total,caption:"Guardando en la nube"}));
   await refresh();
   try{
    setProgress({done:0,total:0,caption:"Preparando buscador rápido"});
    await uploadVaultIndex(base44,"",result.entry,fileData.index,(done,total)=>setProgress({done,total,caption:"Guardando índice de búsqueda"}));
    await refresh();
    setMessage("Partida e índice de búsqueda guardados. Puedes buscar desde cualquier dispositivo sin descargar todo el archivo.");
   }catch(indexError){
    setMessage("Partida .fm guardada correctamente. El índice rápido está pendiente: "+indexError.message);
   }
  }catch(caught){setError("No se terminó el guardado: "+caught.message);}
  finally{setBusy(false);}
 };
 useEffect(()=>{
  if(!connected||!readyFile?.file)return;
  const identity=readyFile.generation+"|"+readyFile.file.name+"|"+readyFile.file.size;
  if(attemptedRef.current.has(identity))return;
  attemptedRef.current.add(identity);
  void archive(readyFile);
 },[connected,readyFile?.generation]);
 const openIndex=async entry=>{
  if(busy||disabled||!onOpenIndex)return;
  setBusy(true);setError("");setMessage("");setProgress({done:0,total:entry.index_part_count,caption:"Abriendo buscador rápido"});
  try{
   const payload=await downloadVaultIndex(base44,"",entry,(done,total)=>setProgress({done,total,caption:"Abriendo buscador rápido"}));
   onOpenIndex(entry,payload);
   setMessage("Buscador listo. Para consultar atributos completos o importar, abre la partida original.");
  }catch(caught){setError(caught.message);}
  finally{setBusy(false);}
 };
 const open=async entry=>{
  if(busy||disabled)return;
  setBusy(true);setError("");setMessage("");setProgress({done:0,total:entry.part_count,caption:"Recuperando partida"});
  try{
   const file=await downloadVault(base44,"",entry,(done,total)=>setProgress({done,total,caption:"Recuperando partida"}));
   onOpenFile(file);setMessage("Partida abierta desde la nube: "+file.name);
  }catch(caught){setError(caught.message);}
  finally{setBusy(false);}
 };
 return <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
  <div className="flex items-start gap-3"><div className="rounded-xl bg-emerald-50 p-3 text-emerald-700"><Cloud size={23}/></div>
   <div className="flex-1"><h2 className="font-bold text-slate-900">1. Mis partidas FM26/27 guardadas</h2>
    <p className="mt-1 text-xs text-slate-600">Abre aquí las partidas que guardaste desde cualquier ordenador o móvil. No necesitas iniciar sesión ni introducir claves.</p>
    <p className="mt-1 text-[11px] text-slate-500">Cada partida se guarda automáticamente al cargarla por primera vez. Los datos de jugadores y de FM26/FM27 no se modifican.</p>
   </div></div>
  <div className="mt-4 space-y-3">
   <div className="flex items-center justify-between gap-2">
    <p className="text-xs font-bold text-emerald-700">{loading?"Conectando con la nube…":connected?"Biblioteca en la nube conectada":"Biblioteca no disponible"}</p>
    <button className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs" type="button" disabled={busy||loading}
      onClick={()=>refresh().then(()=>{setConnected(true);setError("");}).catch(e=>setError(e.message))}><RefreshCw size={13}/> Actualizar</button>
   </div>
   {connected&&!items.length&&<p className="rounded-xl border border-dashed p-4 text-xs text-slate-500">Todavía no hay partidas guardadas. Selecciona una partida .fm más abajo: cuando se termine de leer, empezará a guardarse automáticamente aquí.</p>}
   {items.map(item=><div key={item.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
    <span className="rounded bg-blue-100 px-2 py-1 text-[10px] font-bold text-blue-900">{item.game}</span>
    <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold" title={item.filename}>{item.filename}</p>
     <p className="text-[11px] text-slate-500">{(item.size_bytes/1048576).toFixed(1)} MB · {item.players_count||0} jugadores · {item.parts_saved}/{item.part_count} fragmentos</p></div>
    {item.status==="ready"?<div className="flex gap-2">
      {item.index_status==="ready"&&<button type="button" disabled={busy||disabled} onClick={()=>openIndex(item)} className="inline-flex items-center gap-1 rounded-lg border border-[#003399] bg-white px-3 py-2 text-xs font-bold text-[#003399] disabled:opacity-40">Buscar rápido</button>}
      <button type="button" disabled={busy||disabled} onClick={()=>open(item)} className="inline-flex items-center gap-1 rounded-lg bg-[#003399] px-3 py-2 text-xs font-bold text-white disabled:opacity-40"><CloudDownload size={15}/> Abrir completo</button>
     </div>:
     <span className="text-xs text-amber-700">Subida pendiente · vuelve a seleccionar el archivo</span>}
   </div>)}
  </div>
  {busy&&<p role="status" className="mt-3 flex items-center gap-2 rounded-lg bg-blue-50 p-3 text-xs text-blue-800"><Loader2 size={15} className="animate-spin"/>{progress.caption} · {progress.done}/{progress.total||"?"} fragmentos</p>}
  {error&&<p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-xs text-rose-800">{error}{connected&&readyFile?.file&&<button className="ml-2 font-bold underline" onClick={()=>archive()} disabled={busy}>Reintentar guardado</button>}</p>}
  {message&&<p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">{message}</p>}
 </section>;
}
