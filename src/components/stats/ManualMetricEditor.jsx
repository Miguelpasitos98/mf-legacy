import React,{useState,useEffect} from "react";
export default function ManualMetricEditor({target,onClose,onSave}){
const [value,setValue]=useState(""),[note,setNote]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);
useEffect(()=>{setValue(target?.current==null?"":String(target.current));setNote("");setError("");},[target]);
if(!target)return null;
async function submit(e){e.preventDefault();setBusy(true);setError("");try{await onSave(target.record,{name:target.metric,field:target.field||null,value:value.replace(",","."),sourceNote:note});onClose();}catch(err){setError(err.message||"No se pudo guardar.");}finally{setBusy(false);}}
return <div className="absolute inset-0 z-[7] flex items-center justify-center bg-slate-950/70 p-4" role="dialog" aria-modal="true"><form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-xl bg-white p-5">
<h3 className="font-black">Editar estadística histórica</h3><p className="text-xs text-slate-500">{target.record.season} · {target.record.competition}</p>
<p className="text-sm font-bold">{target.metric}</p>
<label className="block text-xs">Valor<input autoFocus inputMode="decimal" required value={value} onChange={e=>setValue(e.target.value)} className="mt-1 block w-full rounded border p-3"/></label>
<label className="block text-xs">Fuente o referencia<input required maxLength={500} value={note} onChange={e=>setNote(e.target.value)} placeholder="FotMob, Understat, enlace…" className="mt-1 block w-full rounded border p-3"/></label>
<p className="text-xs text-slate-500">Se conservará el valor anterior y la fuente en el historial de cambios.</p>
{error&&<p role="alert" className="text-xs text-red-700">{error}</p>}
<div className="flex justify-end gap-2"><button type="button" onClick={onClose} disabled={busy} className="rounded border p-2">Cancelar</button><button type="submit" disabled={busy||!note.trim()} className="rounded bg-blue-900 px-3 py-2 font-bold text-white">Guardar</button></div>
</form></div>;}
