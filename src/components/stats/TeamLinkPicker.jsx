import React,{useMemo,useState} from "react";
import {createPortal} from "react-dom";
import {AlertTriangle,Check,ChevronDown,ChevronRight,Search,Shield,X} from "lucide-react";
import {clubKey,nationalCompetition,norm,resolveTeam} from "@/utils/statsViews";

export const eligibleClubRecords=records=>(records||[]).filter(r=>r?.id&&r?.season&&!nationalCompetition(r.competition));
export const groupClubRecords=records=>{
 const groups=new Map();
 for(const row of eligibleClubRecords(records)){
  if(!groups.has(row.season))groups.set(row.season,[]);
  groups.get(row.season).push(row);
 }
 return [...groups].sort(([a],[b])=>b.localeCompare(a)).map(([year,items])=>({year,items:items.sort((a,b)=>String(a.competition).localeCompare(String(b.competition),"es"))}));
};
export const toggleSeasonSelection=(selected,items)=> {
 const ids=items.map(r=>String(r.id));
 const all=ids.every(id=>selected.includes(id));
 return all?selected.filter(id=>!ids.includes(id)):[...new Set([...selected,...ids])];
};
export default function TeamLinkPicker({season,records=[],teams=[],initialRecord=null,onClose,onApply}){
 const groups=useMemo(()=>groupClubRecords(records),[records]);
 const all=useMemo(()=>groups.flatMap(g=>g.items),[groups]);
 const [selected,setSelected]=useState(()=>{
  if(initialRecord?.id)return [String(initialRecord.id)];
  return all.filter(r=>(season==="Todas"||r.season===season)&&!r.team_id&&!r.team_name&&!r.fotmob_team_id).map(r=>String(r.id));
 });
 const [openYears,setOpenYears]=useState(()=>new Set([initialRecord?.season||season==="Todas"?season:season].filter(x=>x!=="Todas")));
 const [search,setSearch]=useState(""),[teamId,setTeamId]=useState("");
 const [working,setWorking]=useState(false),[error,setError]=useState("");
 const candidates=useMemo(()=>teams.filter(t=>norm(t.name).includes(norm(search))||norm(t.short_name).includes(norm(search))).sort((a,b)=>String(a.name).localeCompare(String(b.name),"es")).slice(0,75),[teams,search]);
 const selectedTeam=teams.find(t=>String(t.id)===teamId);
 const selectedRows=all.filter(r=>selected.includes(String(r.id)));
 const conflicts=selectedTeam?selectedRows.filter(r=>{
  const known=resolveTeam(r,teams,all);
  if(r.team_id&&String(r.team_id)!==teamId)return true;
  if(known.status==="confirmed"&&known.team&&String(known.team.id)!==teamId)return true;
  if(r.team_name&&clubKey(r.team_name)!==clubKey(selectedTeam.name))return true;
  return false;
 }):[];
 const groupSummary=groups.filter(g=>g.items.some(r=>selected.includes(String(r.id)))).map(g=>g.year+" ("+g.items.filter(r=>selected.includes(String(r.id))).length+")");
 const toggle=id=>setSelected(current=>current.includes(id)?current.filter(x=>x!==id):[...current,id]);
 const selectPending=()=>setSelected(all.filter(r=>!r.team_id&&!r.team_name&&!r.fotmob_team_id).map(r=>String(r.id)));
 const expand=year=>setOpenYears(current=>{const s=new Set(current);if(s.has(year))s.delete(year);else s.add(year);return s;});
 const selectYear=group=>{setSelected(current=>toggleSeasonSelection(current,group.items));setOpenYears(current=>new Set([...current,group.year]));};
 const confirm=async()=>{
  if(!selectedTeam||!selected.length)return;
  if(conflicts.length&&!window.confirm("ATENCIÓN: "+conflicts.length+" registro(s) ya tienen otro club identificado. ¿Quieres corregir también esos vínculos?"))return;
  if(!window.confirm("Asignar "+selectedTeam.name+" a "+selected.length+" registro(s) de: "+groupSummary.join(", ")+". Se excluyen selecciones y no se modifica el club actual del jugador. ¿Confirmar?"))return;
  setError("");setWorking(true);
  try{
   const result=await onApply(selected,teamId);
   if(result?.failed?.length){
    setError("Guardados: "+(result.updated||0)+". Fallaron: "+result.failed.length+". "+result.failed.slice(0,3).map(e=>e.label).join("; "));
    setSelected(result.failed.map(e=>String(e.id)));
   }else onClose();
  }catch(e){setError(e.message||"No se pudieron guardar los vínculos.");}finally{setWorking(false);}
 };
 return createPortal(<div className="fixed inset-0 z-[10040] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Gestionar clubes por temporada">
  <div className="flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
   <header className="flex items-center justify-between bg-[#003399] px-5 py-4 text-white">
    <div><p className="text-[10px] font-bold tracking-widest text-blue-100">MY LEGACY · EQUIPOS HISTÓRICOS</p><h2 className="text-lg font-black">Asignar clubes por temporada</h2><p className="text-xs text-blue-100">Marca un año entero o solo algunas competiciones</p></div>
    <button disabled={working} onClick={onClose} aria-label="Cerrar"><X size={20}/></button>
   </header>
   <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
    <section>
     <h3 className="mb-2 text-xs font-extrabold text-slate-700">1. ELIGE EL CLUB</h3>
     <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3"><Search size={16} className="text-slate-400"/><input autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar Barcelona, Leeds, Rennes…" className="w-full py-2.5 text-sm outline-none"/></label>
     <div className="mt-2 max-h-36 overflow-y-auto rounded-lg border border-slate-200">
      {candidates.map(t=><button key={t.id} type="button" onClick={()=>setTeamId(String(t.id))} className={"flex w-full items-center gap-3 border-b border-slate-100 px-3 py-2 text-left text-xs hover:bg-blue-50 "+(teamId===String(t.id)?"bg-blue-50 font-bold text-[#003399]":"text-slate-700")}>
       {t.logo?<img src={t.logo} alt="" className="h-6 w-6 object-contain" onError={e=>{e.currentTarget.style.display="none";}}/>:<Shield size={17} className="text-slate-400"/>}<span className="flex-1">{t.name}</span>{teamId===String(t.id)&&<Check size={17}/>}</button>)}
      {!candidates.length&&<p className="p-3 text-xs text-slate-500">No hay clubes coincidentes.</p>}
     </div>
    </section>
    <section>
     <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-xs font-extrabold text-slate-700">2. SELECCIONA TEMPORADAS Y COMPETICIONES</h3>
      <div className="flex gap-2"><button onClick={selectPending} className="rounded-lg border border-blue-200 px-2 py-1 text-[11px] font-bold text-[#003399]">Sin identificar</button><button onClick={()=>setSelected([])} className="rounded-lg border border-slate-200 px-2 py-1 text-[11px]">Limpiar</button></div>
     </div>
     <div className="max-h-[34dvh] space-y-1.5 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
      {groups.map(group=>{
       const count=group.items.filter(r=>selected.includes(String(r.id))).length;
       const expanded=openYears.has(group.year);
       return <section key={group.year} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center gap-2 px-3 py-2">
         <input type="checkbox" aria-label={"Seleccionar todas las competiciones de "+group.year} checked={count===group.items.length} ref={el=>{if(el)el.indeterminate=count>0&&count<group.items.length;}} onChange={()=>selectYear(group)} className="h-4 w-4 accent-[#003399]"/>
         <button type="button" onClick={()=>expand(group.year)} className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm font-bold text-[#0e3155]">
          {expanded?<ChevronDown size={15}/>:<ChevronRight size={15}/>}
          {group.year}
          <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-[#003399]">{count}/{group.items.length} seleccionadas</span>
         </button>
         <button type="button" onClick={()=>selectYear(group)} className="shrink-0 rounded-md border border-blue-200 px-2 py-1 text-[11px] font-bold text-[#003399]">{count===group.items.length?"Quitar año":"Seleccionar año"}</button>
        </div>
        {expanded&&<div className="border-t border-slate-100">
         {group.items.map(row=>{
          const known=resolveTeam(row,teams,all);
          const label=known.status==="confirmed"&&known.team?known.team.name:row.team_name||(known.status==="suggested"?"Club sugerido (sin confirmar)":"Sin club identificado");
          return <label key={row.id} className="flex cursor-pointer items-center gap-3 border-b border-slate-50 px-4 py-2 text-xs hover:bg-blue-50/40">
           <input type="checkbox" checked={selected.includes(String(row.id))} onChange={()=>toggle(String(row.id))} className="accent-[#003399]"/>
           <span className="min-w-0 flex-1"><strong className="text-slate-800">{row.competition}</strong><span className={"ml-2 text-[10px] "+(known.status==="confirmed"?"text-emerald-700":"text-amber-700")}>{label}</span></span>
           {row.team_id&&<span className="shrink-0 text-[10px] text-slate-500">Vinculado</span>}
          </label>;
         })}
        </div>}
       </section>;
      })}
      {!groups.length&&<p className="p-4 text-xs text-slate-500">No hay estadísticas de clubes asignables.</p>}
     </div>
    </section>
    <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-900">
     <strong>{selected.length} registros seleccionados</strong>{groupSummary.length?" · "+groupSummary.join(" · "):""}
     {selectedTeam&&<span className="mt-1 block">Club elegido: <strong>{selectedTeam.name}</strong></span>}
    </div>
    {conflicts.length>0&&<p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"><AlertTriangle size={16} className="shrink-0"/> Hay {conflicts.length} registro(s) con otro club identificado. Se solicitará confirmación expresa para reemplazar esos vínculos.</p>}
    {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</p>}
   </div>
   <footer className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3">
    <p className="max-w-sm text-[11px] text-slate-500">Solo cambia el vínculo de los registros marcados. Nunca el equipo actual ni las estadísticas.</p>
    <div className="flex gap-2"><button disabled={working} onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold">Cancelar</button><button disabled={working||!selectedTeam||!selected.length} onClick={confirm} className="rounded-lg bg-[#003399] px-3 py-2 text-xs font-bold text-white disabled:opacity-40">{working?"Guardando…":"Asignar "+selected.length+" registros"}</button></div>
   </footer>
  </div>
 </div>,document.body);
}
