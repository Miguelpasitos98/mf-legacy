import React,{useEffect,useState} from "react";
import {AlertTriangle,CheckCircle2,ImageOff,ImagePlus,Link2,RefreshCcw,Save,Upload,ExternalLink} from "lucide-react";
import {base44} from "@/api/base44Client";
import {trophyImageUrl} from "@/utils/trophyCatalog";
import {statusOf,isImageUrl,trophyImageSummary,prepareTrophyImageUpdate} from "@/utils/trophyImages";

const label="mb-1 block text-[10px] font-bold uppercase tracking-[.08em] text-slate-500";
const field="min-h-9 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-400";
const stateName={auto:"Automática",provisional:"Provisional",verified:"Verificada",wrong:"Incorrecta",missing:"Sin imagen"};
export default function TrophyImageManager({trophy,manifest,onSave,disabled=false}){
 const [values,setValues]=useState({});
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState("");
 const [failure,setFailure]=useState("");
 const [broken,setBroken]=useState(false);
 const sourceId=String(trophy?.source_id||"");
 useEffect(()=>{setValues({
  image_override_url:trophy?.image_override_url||"",
  image_status:statusOf(trophy),
  image_source_type:trophy?.image_source_type||"catalog",
  image_source_reference:trophy?.image_source_reference||"",
  image_notes:trophy?.image_notes||""
 });setBroken(false);setFailure("");setNotice("");},[sourceId,trophy?.image_override_url,trophy?.image_status,trophy?.image_source_type,trophy?.image_source_reference,trophy?.image_notes]);
 const draft={...trophy,...values},active=trophyImageUrl(draft,manifest);
 const automatic=trophyImageUrl({...trophy,image_override_url:"",image_status:"auto"},manifest);
 const imageState=trophyImageSummary(draft);
 const update=(field,value)=>{setValues(x=>({...x,[field]:value}));setNotice("");setFailure("");setBroken(false);};
 const setStatus=status=>update("image_status",status);
 const restore=()=>{setValues(old=>({...old,image_override_url:"",image_status:"auto",image_source_type:"catalog",image_source_reference:""}));setBroken(false);setNotice("");setFailure("");};
 const upload=async event=>{
  const file=event.target.files?.[0];event.target.value="";if(!file)return;
  if(!["image/png","image/jpeg","image/webp"].includes(file.type)){setFailure("Usa PNG, JPG o WEBP.");return;}
  if(file.size>8*1024*1024){setFailure("La imagen supera 8 MB.");return;}
  setBusy(true);setFailure("");setNotice("");
  try{
   const result=await base44.integrations.Core.UploadFile({file});
   const url=result?.file_url||result?.url||result?.data?.file_url;
   if(!url||!isImageUrl(url))throw Error("La subida no devolvió una URL válida.");
   setValues(old=>({...old,image_override_url:url,image_status:"provisional",image_source_type:"manual_upload",image_source_reference:old.image_source_reference||file.name}));
   setBroken(false);setNotice("Imagen subida a Base44. Pulsa «Guardar imagen» para activarla en el catálogo.");
  }catch(err){setFailure("No se pudo subir: "+(err?.message||err));}finally{setBusy(false);}
 };
 const commit=async()=>{
  if(busy||disabled||!sourceId)return;
  setBusy(true);setFailure("");setNotice("");
  try{
   const data=prepareTrophyImageUpdate(values);
   await onSave(data);
   setNotice("Imagen guardada. Se actualizará en el catálogo y en las fichas.");
  }catch(err){setFailure(err?.message||String(err));}finally{setBusy(false);}
 };
 return <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-3.5" aria-label="Gestión de la imagen del trofeo">
  <div className="flex flex-wrap items-center justify-between gap-2">
   <div><h3 className="text-xs font-black text-slate-900">Gestión de imagen</h3><p className="mt-0.5 text-[10px] text-slate-500">La imagen manual tiene prioridad. No modifica los datos históricos.</p></div>
   <span className={"rounded-md px-2 py-1 text-[10px] font-bold "+(imageState.needsReview?"bg-amber-50 text-amber-700":"bg-blue-50 text-blue-800")}>{stateName[imageState.status]}</span>
  </div>
  <div className="grid grid-cols-2 gap-2">
   <div className="rounded-xl border border-slate-200 bg-[#f7f8fb] p-2">
    <span className="mb-2 block text-[10px] font-semibold text-slate-500">Imagen activa</span>
    <div className="flex h-32 items-center justify-center rounded-lg bg-white">
     {active&&!broken?<img key={active} src={active} alt={"Vista previa de "+(trophy?.name||"trofeo")} className="max-h-[122px] max-w-full object-contain" onError={()=>setBroken(true)}/>:<ImageOff size={28} className="text-slate-300"/>}
    </div>
   </div>
   <div className="rounded-xl border border-slate-200 bg-[#f7f8fb] p-2">
    <span className="mb-2 block text-[10px] font-semibold text-slate-500">Imagen automática original</span>
    <div className="flex h-32 items-center justify-center rounded-lg bg-white">
     {automatic?<img src={automatic} key={automatic} alt="Imagen original del catálogo" className="max-h-[122px] max-w-full object-contain" onError={e=>{e.currentTarget.style.display="none";}}/>:<ImageOff size={28} className="text-slate-300"/>}
    </div>
   </div>
  </div>
  <div className="flex flex-wrap gap-2">
   <label className={"inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] font-bold text-[#003399] hover:bg-blue-100 "+(busy?"pointer-events-none opacity-50":"")}><Upload size={14}/> Subir PNG / JPG / WEBP<input type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" onChange={upload} className="sr-only" disabled={busy||disabled}/></label>
   <button type="button" onClick={restore} disabled={busy||disabled} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"><RefreshCcw size={13}/> Restaurar automática</button>
  </div>
  <div><label className={label} htmlFor={"trophy-override-"+sourceId}>URL manual de sustitución</label><input id={"trophy-override-"+sourceId} className={field} type="text" value={values.image_override_url||""} onChange={e=>{update("image_override_url",e.target.value);setValues(old=>({...old,image_source_type:"url",image_status:e.target.value?"provisional":"auto"}));}} placeholder="https://… / URL de imagen en Base44"/></div>
  <div className="grid grid-cols-2 gap-2">
   <div><label className={label} htmlFor={"trophy-img-status-"+sourceId}>Estado</label><select className={field} id={"trophy-img-status-"+sourceId} value={values.image_status||"auto"} onChange={e=>setStatus(e.target.value)}><option value="auto">Automática</option><option value="provisional">Provisional</option><option value="verified">Verificada</option><option value="wrong">Incorrecta</option><option value="missing">Sin imagen</option></select></div>
   <div><label className={label} htmlFor={"trophy-img-source-"+sourceId}>Procedencia</label><select className={field} id={"trophy-img-source-"+sourceId} value={values.image_source_type||"catalog"} onChange={e=>update("image_source_type",e.target.value)}><option value="catalog">Catálogo</option><option value="fm24">Rob / FM24</option><option value="github">GitHub</option><option value="manual_upload">Subida manual</option><option value="url">URL externa</option></select></div>
  </div>
  <div><label className={label} htmlFor={"trophy-img-ref-"+sourceId}>Fuente / referencia</label><input id={"trophy-img-ref-"+sourceId} className={field} value={values.image_source_reference||""} onChange={e=>update("image_source_reference",e.target.value)} placeholder="Enlace al fabricante, federación, licencia…"/></div>
  <div><label className={label} htmlFor={"trophy-img-note-"+sourceId}>Nota de revisión</label><textarea id={"trophy-img-note-"+sourceId} className={field+" min-h-[64px]"} value={values.image_notes||""} onChange={e=>update("image_notes",e.target.value)} placeholder="Por qué es incorrecta o qué versión del trofeo representa"/></div>
  <div className="flex flex-wrap items-center justify-between gap-2">
   <button type="button" onClick={()=>{setValues(old=>({...old,image_status:"wrong",image_override_url:"",image_source_type:"catalog"}));setBroken(false);}} className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 hover:underline" disabled={busy||disabled}><AlertTriangle size={13}/> Marcar automática incorrecta</button>
   <button type="button" onClick={commit} disabled={busy||disabled||!sourceId} className="inline-flex items-center gap-1.5 rounded-lg bg-[#003399] px-3 py-2 text-[11px] font-bold text-white disabled:opacity-50"><Save size={13}/>{busy?"Procesando…":"Guardar imagen"}</button>
  </div>
  {failure&&<p role="alert" className="rounded-lg bg-red-50 p-2.5 text-[11px] text-red-700">{failure}</p>}
  {notice&&<p role="status" className="flex items-center gap-1.5 rounded-lg bg-emerald-50 p-2.5 text-[11px] text-emerald-700"><CheckCircle2 size={13}/>{notice}</p>}
  {imageState.status==="wrong"&&!imageState.override&&<p className="text-[10px] leading-4 text-amber-700">La imagen incorrecta se ocultará tras guardar. Podrás añadir una alternativa después.</p>}
 </section>;
