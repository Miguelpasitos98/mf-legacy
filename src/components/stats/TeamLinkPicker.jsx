import React,{useMemo,useState} from "react";
import {createPortal} from "react-dom";
import {Check,Search,Shield,X,AlertTriangle} from "lucide-react";
import {nationalCompetition,resolveTeam,norm} from "@/utils/statsViews";

export default function TeamLinkPicker({season,records=[],teams=[],initialRecord=null,onClose,onApply}){
 const eligible=useMemo(()=>records.filter(r=>r.id&&r.season===season&&!nationalCompetition(r.competition)),[records,season]);
 const [selected,setSelected]=useState(()=>{
  if(initialRecord?.id)return [String(initialRecord.id)];
  return eligible.filter(r=>!r.team_id&&!r.team_name&&!r.fotmob_team_id).map(r=>String(r.id));
 });
 const [search,setSearch]=useState("");
 const [teamId,setTeamId]=useState("");
 const [working,setWorking]=useState(false),[error,setError]=useState(""),[status,setStatus]=useState("");
 const candidates=useMemo(()=>teams.filter(t=>norm(t.name).includes(norm(search))||norm(t.short_name).includes(norm(search))).sort((a,b)=>a.name.localeCompare(b.name,"es")).slice(0,75),[teams,search]);
 const selectedTeam=teams.find(t=>String(t.id)===teamId);
 const conflict=eligible.filter(r=>selected.includes(String(r.id)) && (r.team_id&&String(r.team_id)!==teamId || (r.team_name&&norm(r.team_name)!==norm(selectedTeam?.name)&&norm(r.team_name)!==norm(selectedTeam?.name?.replace(/^FC /,"")))));
 const toggle=id=>setSelected(current=>current.includes(id)?current.filter(x=>x!==id):[...current,id]);
 const confirm=async()=>{
  if(!selectedTeam||!selected.length)return;
  if(conflict.length&&!window.confirm("Hay "+conflict.length+" registro(s) con otro club ya asignado o identificado. ¿Confirmas sobrescribir exclusivamente el vínculo de los registros marcados?"))return;
  if(!window.confirm("Vincular "+selected.length+" registro(s) de "+season+" con "+selectedTeam.name+". Se excluyen selecciones y no se modifica el club actual del jugador. ¿Continuar?"))return;
  setError("");setStatus("");setWorking(true);
  try{
   const result=await onApply(selected,teamId);
   const fails=result?.failed||[];
   if(fails.length){setError("Se actualizaron "+(result.updated||0)+" registros. "+fails.length+" fallaron: "+fails.slice(0,4).map(x=>x.label).join("; "));setSelected(fails.map(x=>String(x.id)));}else{
    setStatus("Vínculos guardados: "+(result.updated||0));
    onClose();
   }
  }catch(e){setError(e.message||"No se pudieron guardar los vínculos.");}finally{setWorking(false);}
 };
 return createPortal(<div className="fixed inset-0 z-[10040] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Asignar clubes a estadísticas históricas">
  <div className="flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
   <header className="flex items-center justify-between bg-[#0d2843] px-5 py-4 text-white">
    <div><p className="text-[10px] font-bold tracking-widest text-blue-200">MY LEGACY · EQUIPOS HISTÓRICOS</p><h2 className="text-lg font-black">{initialRecord?"Vincular club de competición":"Asignar club a toda la temporada"} · {season}</h2></div>
    <button disabled={working} onClick={onClose} aria-label="Cerrar"><X size={20}/></button>
   </header>
   <div className="flex-1 space-y-4 overflow-y-auto p-5">
    <div><h3 className="mb-2 text-sm font-bold text-slate-800">1. Buscar club de MY LEGACY</h3>
     <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3"><Search size={16} className="text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por nombre o abreviatura…" className="w-full py-2.5 text-sm outline-none"/></label>
     <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-slate-200">
      {candidates.map(t=><button key={t.id} onClick={()=>setTeamId(String(t.id))} className={"flex w-full items-center gap-3 border-b border-slate-100 px-3 py-2 text-left text-xs hover:bg-blue-50 "+(teamId===String(t.id)?"bg-blue-50 font-bold text-[#003399]":"text-slate-700")}>
       {t.logo?<img src={t.logo} alt="" className="h-6 w-6 object-contain"/>:<Shield size={17} className="text-slate-400"/>}<span className="flex-1">{t.name}</span>{teamId===String(t.id)&&<Check size={17}/>}</button>)}
      {!candidates.length&&<p className="p-3 text-xs text-slate-500">No hay clubes coincidentes.</p>}
     </div>
    </div>
    <div><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-bold text-slate-800">2. Seleccionar competiciones</h3><div className="flex flex-wrap gap-2"><button onClick={()=>setSelected(eligible.filter(r=>!r.team_id&&!r.team_name&&!r.fotmob_team_id).map(r=>String(r.id)))} className="rounded-lg border border-blue-200 px-2 py-1 text-[11px] font-bold text-[#003399]">Solo sin identificar</button><button onClick={()=>setSelected(eligible.map(r=>String(r.id)))} className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-bold">Toda la temporada</button><button onClick={()=>setSelected([])} className="rounded-lg border border-slate-200 px-2 py-1 text-[11px]">Limpiar</button></div></div>
     <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200">
      {eligible.map(r=>{const info=resolveTeam(r,teams,eligible);return <label key={r.id} className="flex cursor-pointer items-start gap-3 border-b border-slate-100 px-3 py-3 text-xs hover:bg-slate-50"><input type="checkbox" checked={selected.includes(String(r.id))} onChange={()=>toggle(String(r.id))} className="mt-0.5 accent-[#003399]"/><span className="min-w-0 flex-1"><strong>{r.competition}</strong><span className="ml-2 text-slate-500">{r.season}</span><span className="mt-0.5 block text-slate-500">{r.team_name||info.status==="confirmed"?info.team?.name||r.team_name:"Sin equipo confirmado"}</span></span>{r.team_id&&<span className="text-[10px] text-amber-700">Ya vinculado</span>}</label>;})}
      {!eligible.length&&<p className="p-4 text-xs text-slate-500">No hay registros de clubes en esta temporada.</p>}
     </div>
    </div>
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><AlertTriangle size={16} className="mt-0.5 shrink-0"/><p>La asignación solo actualiza los registros marcados de esta temporada. No se tocan selecciones, estadísticas, otras temporadas ni el equipo actual del jugador. Si hubo un traspaso, selecciona únicamente las competiciones correctas.</p></div>
    {selectedTeam&&<p className="text-sm font-bold text-[#0d315b]">Equipo elegido: {selectedTeam.name} · Registros seleccionados: {selected.length}</p>}
    {conflict.length>0&&<p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">{conflict.length} registro(s) muestran otro equipo; se pedirá una confirmación adicional antes de sustituir ese vínculo.</p>}
    {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</p>}
    {status&&<p role="status" className="text-xs text-green-700">{status}</p>}
   </div>
   <footer className="flex items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4"><span className="text-xs text-slate-500">{selected.length} de {eligible.length} registros</span><div className="flex gap-2"><button disabled={working} onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold">Cancelar</button><button disabled={working||!selectedTeam||!selected.length} onClick={confirm} className="rounded-lg bg-[#003399] px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{working?"Guardando…":"Guardar vínculos"}</button></div></footer>
  </div>
 </div>,document.body);
}
