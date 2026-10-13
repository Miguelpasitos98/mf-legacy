import React,{useMemo,useState} from "react";
import {createPortal} from "react-dom";
import {ArrowDown,ArrowUp,Check,Plus,RotateCcw,Search,Settings2,Trash2,X} from "lucide-react";
import {CATEGORIES,MODES,RAW_METRICS,COMPUTED_IDS,DEFAULT_COLS,getColumn,parseFormula,evalFormula,rowValues} from "@/utils/statsColumns";
const clone=c=>JSON.parse(JSON.stringify(c));
export default function StatsColumnSettings({config,mode:initialMode="season",category:initialCategory="Resumen",sample=null,onClose,onSave}){
 const [draft,setDraft]=useState(()=>clone(config));
 const [mode,setMode]=useState(initialMode),[category,setCategory]=useState(initialCategory);
 const [query,setQuery]=useState(""),[editId,setEditId]=useState(""),[draftName,setDraftName]=useState(""),[draftFormula,setDraftFormula]=useState(""),[decimals,setDecimals]=useState(2),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
 const [rawId,setRawId]=useState("");
 const [newMode,setNewMode]=useState(false);
 const selected=draft.columns[mode][category];
 const catalog=useMemo(()=>[...RAW_METRICS.map(([id])=>getColumn(draft,id)),...draft.computed.map(d=>getColumn(draft,d.id))].filter(Boolean),[draft]);
 const results=catalog.filter(d=>(d.name+" "+d.id).toLowerCase().includes(query.toLowerCase()));
 const setColumns=(fn)=>setDraft(prev=>{const next=clone(prev);next.columns[mode][category]=fn(next.columns[mode][category]);return next;});
 const move=(index,delta)=>setColumns(cols=>{const to=index+delta;if(to<0||to>=cols.length)return cols;const list=[...cols];[list[index],list[to]]=[list[to],list[index]];return list;});
 const openEditor=(def)=>{
  setEditId(def?.id||"__new");setDraftName(def?.name||"");setDraftFormula(def?.formula||"");setDecimals(def?.decimals??2);setNotice("");setRawId(def?.kind==="raw"?def.id:"");setNewMode(!def);
 };
 const availableVars=RAW_METRICS.map(([id])=>id);
 const formulaError=useMemo(()=>{if(rawId)return "";try{parseFormula(draftFormula);return "";}catch(e){return e.message;}},[draftFormula,rawId]);
 const saveDefinition=()=>{
  const name=draftName.trim();
  if(!name||name.length>60){setNotice("El nombre debe tener entre 1 y 60 caracteres.");return;}
  if(formulaError){setNotice(formulaError);return;}
  const id=editId==="__new"?"calc_"+Date.now().toString(36):editId;
  const next=clone(draft);
  if(rawId){next.labels[rawId]=name;}
  else{
   const record={id,name,formula:draftFormula.trim(),decimals:Number(decimals)};
   const index=next.computed.findIndex(d=>d.id===id);
   if(index<0)next.computed.push(record);else next.computed[index]=record;
   if(editId==="__new"&&!next.columns[mode][category].includes(id))next.columns[mode][category].push(id);
  }
  setDraft(next);setEditId("");setNotice("Indicador actualizado en el borrador. Pulsa Guardar cambios para conservarlo.");
 };
 const removeCustom=id=>{
  if(COMPUTED_IDS.has(id))return;
  const next=clone(draft);
  next.computed=next.computed.filter(x=>x.id!==id);
  for(const m of MODES)for(const cat of CATEGORIES)next.columns[m][cat]=next.columns[m][cat].filter(x=>x!==id);
  setDraft(next);setEditId("");
 };
 const save=async()=>{setBusy(true);setNotice("");try{await onSave(draft);onClose();}catch(e){setNotice("No se han guardado los cambios: "+(e.message||e));}finally{setBusy(false);}};
 const preview=editId&&!rawId&&sample&&!formulaError?(()=>{try{return evalFormula(parseFormula(draftFormula),rowValues(sample,mode));}catch{return null;}})():null;
 return createPortal(<div className="fixed inset-0 z-[10020] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Configurar columnas y fórmulas">
  <div className="flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
   <header className="flex items-center gap-3 border-b border-white/10 bg-[#0d2843] px-5 py-4 text-white">
    <Settings2 size={22}/><div className="min-w-0 flex-1"><h2 className="text-lg font-black">Configurar STATS</h2><p className="text-xs text-blue-200">Columnas, categorías, nombres y fórmulas de cálculo</p></div>
    <button onClick={onClose} disabled={busy} className="rounded-lg p-2 hover:bg-white/10" aria-label="Cerrar"><X size={20}/></button>
   </header>
   <div className="flex-1 overflow-y-auto p-5">
    <div className="mb-4 flex flex-wrap items-center gap-3">
     <label className="text-xs font-bold text-slate-500">VISTA<select className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800" value={mode} onChange={e=>setMode(e.target.value)}><option value="season">Temporadas</option><option value="competition">Competiciones</option></select></label>
     <label className="text-xs font-bold text-slate-500">CATEGORÍA<select className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800" value={category} onChange={e=>setCategory(e.target.value)}>{CATEGORIES.map(x=><option key={x}>{x}</option>)}</select></label>
     <button onClick={()=>setColumns(()=>[...DEFAULT_COLS[mode][category]])} className="ml-auto inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700"><RotateCcw size={13}/> Restablecer categoría</button>
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
     <section className="rounded-xl border border-slate-200 p-4">
      <div className="mb-3 flex justify-between"><h3 className="font-black text-[#0b3156]">Columnas visibles</h3><span className="text-xs text-slate-500">{selected.length} columnas</span></div>
      <div className="space-y-2">{selected.map((id,index)=>{const def=getColumn(draft,id);if(!def)return null;return <div key={id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-xs">
       <span className="min-w-0 flex-1 truncate font-bold text-slate-700">{def.name}<span className="ml-2 text-[10px] font-normal text-slate-400">{def.kind==="computed"?"Fórmula":"Fuente"}</span></span>
       <button aria-label={"Subir "+def.name} disabled={index===0} onClick={()=>move(index,-1)} className="rounded p-1 hover:bg-slate-200 disabled:opacity-30"><ArrowUp size={14}/></button>
       <button aria-label={"Bajar "+def.name} disabled={index===selected.length-1} onClick={()=>move(index,1)} className="rounded p-1 hover:bg-slate-200 disabled:opacity-30"><ArrowDown size={14}/></button>
       <button onClick={()=>openEditor(def)} className="rounded border border-blue-200 px-2 py-1 font-bold text-[#003399]">Editar</button>
       <button aria-label={"Ocultar "+def.name} onClick={()=>setColumns(cols=>cols.filter(x=>x!==id))} className="rounded p-1 text-red-600 hover:bg-red-50"><X size={14}/></button>
      </div>;})}
      {!selected.length&&<p className="rounded-lg bg-slate-50 p-4 text-xs text-slate-500">No hay columnas visibles en esta categoría.</p>}</div>
     </section>
     <section className="space-y-3 rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between"><h3 className="font-black text-[#0b3156]">Biblioteca de indicadores</h3><button onClick={()=>openEditor(null)} className="inline-flex items-center gap-1 rounded-lg bg-[#003399] px-3 py-2 text-xs font-bold text-white"><Plus size={14}/> Crear fórmula</button></div>
      <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3"><Search size={15} className="text-slate-400"/><input className="w-full py-2 text-xs outline-none" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar estadística o fórmula…"/></label>
      <div className="max-h-80 space-y-1 overflow-y-auto">
       {results.map(def=><div key={def.id} className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs hover:bg-slate-50">
        <div className="min-w-0 flex-1"><p className="font-bold text-slate-700">{def.name}</p><p className="truncate text-[10px] text-slate-400">{def.formula||def.id}</p></div>
        {!selected.includes(def.id)?<button onClick={()=>setColumns(cols=>[...cols,def.id])} className="rounded border border-blue-200 px-2 py-1 font-bold text-[#003399]">Añadir</button>:<Check size={15} className="text-emerald-600"/>}
        <button onClick={()=>openEditor(def)} className="rounded border px-2 py-1 text-slate-600">Editar</button>
       </div>)}
      </div>
     </section>
    </div>
    {editId&&<section className="mt-4 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
     <div className="flex items-center justify-between gap-3"><h3 className="font-black text-[#0d3156]">{newMode?"Crear indicador calculado":"Editar indicador"}</h3><button onClick={()=>setEditId("")} aria-label="Cerrar editor"><X size={17}/></button></div>
     <div className="mt-3 grid gap-3 md:grid-cols-[1fr_2fr_auto]">
      <label className="text-xs font-bold text-slate-600">Nombre visible<input value={draftName} onChange={e=>setDraftName(e.target.value)} maxLength={60} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"/></label>
      <label className="text-xs font-bold text-slate-600">Fórmula{rawId?" (dato de origen; no editable)":" · usa IDs, no nombres traducidos"}<input value={rawId?"Dato original de FotMob":draftFormula} disabled={Boolean(rawId)} onChange={e=>setDraftFormula(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm disabled:bg-slate-100" placeholder="(goals + assists) * 90 / minutes"/></label>
      <label className="text-xs font-bold text-slate-600">Decimales<select value={decimals} disabled={Boolean(rawId)} onChange={e=>setDecimals(Number(e.target.value))} className="mt-1 block rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">{[0,1,2,3,4].map(n=><option key={n}>{n}</option>)}</select></label>
     </div>
     {formulaError&&!rawId&&<p className="mt-2 text-xs font-semibold text-red-700">{formulaError}</p>}
     <p className="mt-2 text-[11px] text-slate-600">Disponibles: {availableVars.join(", ")}. Ejemplo: <code>(goals + assists) * 90 / minutes</code>. Las operaciones devuelven «—» cuando falta un dato o el divisor es cero. El histórico usa métricas consolidadas.</p>
     {editId&&!rawId&&sample&&<p className="mt-2 text-xs text-slate-500">Vista previa con el primer registro disponible: <strong>{preview??"—"}</strong></p>}
     <div className="mt-3 flex flex-wrap items-center gap-2">
      <button disabled={Boolean(formulaError)} onClick={saveDefinition} className="rounded-lg bg-[#003399] px-4 py-2 text-xs font-bold text-white disabled:opacity-40">Aplicar al borrador</button>
      {!rawId&&editId!=="__new"&&!COMPUTED_IDS.has(editId)&&<button onClick={()=>removeCustom(editId)} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700"><Trash2 size={14}/> Eliminar fórmula</button>}
     </div>
    </section>}
    {notice&&<p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs font-semibold text-amber-900" role="status">{notice}</p>}
   </div>
   <footer className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
    <p className="text-xs text-slate-500">Solo cambia la presentación y sus cálculos derivados. Nunca modifica las estadísticas originales.</p>
    <div className="flex gap-2"><button disabled={busy} onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold">Cancelar</button><button disabled={busy} onClick={save} className="rounded-lg bg-[#003399] px-4 py-2 text-xs font-bold text-white">{busy?"Guardando…":"Guardar cambios"}</button></div>
   </footer>
  </div>
 </div>,document.body);
}
