import React,{useEffect,useRef,useState} from "react";
import {Cloud,CloudDownload,KeyRound,Loader2,RefreshCw,ShieldCheck} from "lucide-react";
import {base44} from "@/api/base44Client";
import {checkVault,downloadVault,listVault,uploadVault,vaultKey,VAULT_KEY_STORAGE} from "@/utils/fmVaultClient.mjs";

export default function FmVaultPanel({readyFile,onOpenFile,disabled=false}){
 const [draft,setDraft]=useState(()=>localStorage.getItem(VAULT_KEY_STORAGE)||"");
 const [key,setKey]=useState(()=>localStorage.getItem(VAULT_KEY_STORAGE)||"");
 const [connected,setConnected]=useState(false);
 const [items,setItems]=useState([]);
 const [loading,setLoading]=useState(Boolean(key));
 const [busy,setBusy]=useState(false);
 const [progress,setProgress]=useState({done:0,total:0,caption:""});
 const [message,setMessage]=useState("");
 const [error,setError]=useState("");
 const attemptedRef=useRef(new Set());
 const refresh=async(current=key)=>{
  const result=await listVault(base44,current);setItems(result.items||[]);
 };
 useEffect(()=>{
  if(!key){setConnected(false);setLoading(false);return;}
  let active=true;setLoading(true);
  (async()=>{
   await checkVault(base44,key);if(!active)return;
   await refresh(key);if(active){setConnected(true);setError("");}
  })().catch(e=>{if(active){setConnected(false);setError("No se pudo abrir la biblioteca: "+e.message);}})
  .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[key]);
 const connect=async e=>{
  e.preventDefault();
  const normalized=vaultKey(draft);
  if(normalized.length!==64){setError("Pega la clave privada de 64 caracteres.");return;}
  setError("");setLoading(true);
  try{
   await checkVault(base44,normalized);
   localStorage.setItem(VAULT_KEY_STORAGE,normalized);
   setKey(normalized);setConnected(true);
   await refresh(normalized);
  }catch(caught){setError(caught.message);}
  finally{setLoading(false);}
 };
 const archive=async(fileData=readyFile)=>{
  if(!fileData?.file||busy||!connected)return;
  setBusy(true);setError("");setMessage("");setProgress({done:0,total:0,caption:"Guardando en la nube"});
  try{
   const result=await uploadVault(base44,key,fileData.file,{...fileData.meta,players_count:fileData.count},(done,total)=>setProgress({done,total,caption:"Guardando en la nube"}));
   await refresh();
   setMessage(result.alreadySaved?"La partida ya estaba guardada en la nube.":"Partida guardada y disponible desde cualquier dispositivo con tu clave.");
  }catch(caught){setError("No se terminó el guardado: "+caught.message+" Puedes reintentar y continuar los fragmentos guardados.");}
  finally{setBusy(false);}
 };
 useEffect(()=>{
  if(!connected||!readyFile?.file)return;
  const identity=readyFile.generation+"|"+readyFile.file.name+"|"+readyFile.file.size;
  if(attemptedRef.current.has(identity))return;
  attemptedRef.current.add(identity);
  void archive(readyFile);
 },[connected,readyFile?.generation,key]);
 const open=async entry=>{
  if(busy||disabled)return;
  setBusy(true);setError("");setMessage("");setProgress({done:0,total:entry.part_count,caption:"Recuperando partida"});
  try{
   const file=await downloadVault(base44,key,entry,(done,total)=>setProgress({done,total,caption:"Recuperando partida"}));
   onOpenFile(file);
   setMessage("Partida recuperada desde la nube: "+file.name);
  }catch(caught){setError(caught.message);}
  finally{setBusy(false);}
 };
 return <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
  <div className="flex items-start gap-3"><div className="rounded-xl bg-emerald-50 p-3 text-emerald-700"><Cloud size={23}/></div>
   <div className="flex-1"><h2 className="font-bold text-slate-900">1. Mis partidas FM26/27 en la nube</h2>
    <p className="mt-1 text-xs text-slate-600">Biblioteca persistente de MF LEGACY, compartida entre PC y móvil mediante tu clave privada. No necesitas iniciar sesión en Base44.</p>
    <p className="mt-1 text-[11px] text-slate-500">Los archivos se almacenan por fragmentos privados. Guardar una partida no modifica los jugadores ni sus datos de FM26/FM27.</p>
   </div></div>
  {!connected&&<form onSubmit={connect} className="mt-4 rounded-xl bg-blue-50 p-4">
   <label className="mb-2 flex items-center gap-2 text-xs font-bold text-blue-950"><KeyRound size={16}/> Clave privada de tu biblioteca</label>
   <div className="flex flex-wrap gap-2">
    <input type="password" autoComplete="off" value={draft} onChange={e=>setDraft(e.target.value)}
     placeholder="Pega tu clave privada" className="min-w-0 flex-1 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm"/>
    <button type="submit" disabled={loading} className="rounded-lg bg-[#003399] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{loading?"Comprobando…":"Abrir biblioteca"}</button>
   </div>
   <p className="mt-2 text-[11px] text-slate-600">Se recuerda en este navegador. Introduce la misma clave una vez en cada dispositivo. No la compartas.</p>
  </form>}
  {connected&&<div className="mt-4 space-y-3">
   <div className="flex items-center justify-between gap-2"><p className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700"><ShieldCheck size={15}/> Biblioteca conectada</p>
    <button className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs" type="button" disabled={busy}
     onClick={()=>refresh().catch(e=>setError(e.message))}><RefreshCw size={13}/> Actualizar</button></div>
   {!items.length&&<p className="rounded-xl border border-dashed p-4 text-xs text-slate-500">Todavía no hay partidas guardadas. Abre una partida .fm abajo y se archivará automáticamente al terminar la lectura.</p>}
   {items.map(item=><div key={item.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
    <span className="rounded bg-blue-100 px-2 py-1 text-[10px] font-bold text-blue-900">{item.game}</span>
    <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold" title={item.filename}>{item.filename}</p>
     <p className="text-[11px] text-slate-500">{(item.size_bytes/1048576).toFixed(1)} MB · {item.players_count||0} jugadores · {item.parts_saved}/{item.part_count} fragmentos</p></div>
    {item.status==="ready"?<button type="button" disabled={busy||disabled} onClick={()=>open(item)} className="inline-flex items-center gap-1 rounded-lg bg-[#003399] px-3 py-2 text-xs font-bold text-white disabled:opacity-40"><CloudDownload size={15}/> Abrir</button>:
     <span className="text-xs text-amber-700">Subida pendiente · vuelve a seleccionar el archivo</span>}
   </div>)}
  </div>}
  {busy&&<p role="status" className="mt-3 flex items-center gap-2 rounded-lg bg-blue-50 p-3 text-xs text-blue-800"><Loader2 size={15} className="animate-spin"/>{progress.caption} · {progress.done}/{progress.total||"?"} fragmentos</p>}
  {error&&<p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-xs text-rose-800">{error}{connected&&readyFile?.file&&<button className="ml-2 font-bold underline" onClick={()=>archive()} disabled={busy}>Reintentar</button>}</p>}
  {message&&<p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">{message}</p>}
 </section>;
}
