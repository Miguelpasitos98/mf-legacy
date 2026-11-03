import React,{useMemo,useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {Shield,Info,Medal,BookOpen,Search,AlertCircle} from "lucide-react";
import {base44} from "@/api/base44Client";
import {completeRecordQueryOptions} from "@/utils/entityRecords";
import TeamSearchPicker from "./TeamSearchPicker";
import {groupTrophyHonoursForClub} from "@/utils/trophyViews";

const rows=r=>Array.isArray(r)?r:(r?.items||r?.data||[]);
export default function TrophyClubCatalogView({teams=[],catalog=[],honours=[],manifest,onOpen,Card,allowedIds=null,loading=false,error=false}){
 const [teamId,setTeamId]=useState("");
 const [sourceMode,setSourceMode]=useState("all");
 const selected=teams.find(x=>String(x.id)===teamId);
 // Fetch only this club's championship history. Reading every club's seasons becomes
 // unnecessarily expensive once the historical archive contains many competitions.
 const editionQuery=useQuery({
  ...completeRecordQueryOptions({list:opts=>base44.entities.TrophyEdition.filter({champion_team_id:teamId},opts)},
   ["mf-legacy","trophies","club-championship-editions",teamId]),
  enabled:Boolean(teamId),retry:false
 });
 const history=useMemo(()=>rows(editionQuery.data).filter(e=>String(e.champion_team_id||"")===teamId),[editionQuery.data,teamId]);
 const joined=useMemo(()=>groupTrophyHonoursForClub(honours,history,teamId),[honours,history,teamId]);
 const bySource=useMemo(()=>new Map(catalog.map(t=>[String(t.source_id),t])),[catalog]);
 const results=useMemo(()=>{
  const ids=sourceMode==="verified"?joined.verifiedTrophies:sourceMode==="historical"?joined.historicalTrophies:
   [...new Set([...joined.verifiedTrophies,...joined.historicalTrophies])];
  return ids.filter(sourceId=>!allowedIds||allowedIds.has(sourceId)).map(sourceId=>{
   const trophy=bySource.get(sourceId);
   if(!trophy)return null;
   const verified=joined.verified.filter(h=>String(h.trophy_source_id)===sourceId);
   const historical=joined.historical.filter(e=>String(e.trophy_source_id)===sourceId);
   return {trophy,verifiedCount:verified.length,historicalCount:historical.length,verifiedSeasons:verified.map(h=>h.season),latest:historical.map(e=>e.season).sort().at(-1)||""};
  }).filter(Boolean).sort((a,b)=>(b.verifiedCount-a.verifiedCount)||(b.historicalCount-a.historicalCount)||a.trophy.name.localeCompare(b.trophy.name,"es"));
 },[joined,bySource,sourceMode,allowedIds]);
 const promoted=useMemo(()=>{
  const names=new Map(teams.map(t=>[String(t.id),t]));
  const count=new Map();
  for(const row of honours)if(row.verified===true&&row.recipient_type==="Team"){
   const id=String(row.recipient_id||"");if(names.has(id))count.set(id,(count.get(id)||0)+1);
  }
  return [...count].sort((a,b)=>b[1]-a[1]).slice(0,6).map(([id,count])=>({...names.get(id),count}));
 },[teams,honours]);
 return <section className="mx-auto mt-3 max-w-[1250px] space-y-4">
  <div className="rounded-xl border border-slate-200 bg-white p-3 md:p-4">
   <div className="flex flex-wrap items-center justify-between gap-2">
    <div><h2 className="flex items-center gap-2 text-sm font-black text-slate-900"><Shield size={16}/> Trofeos por club</h2>
     <p className="mt-1 max-w-[720px] text-[11px] text-slate-500">Explora los títulos confirmados y las finales históricas de Rob por separado. Una final extraída no acredita por sí sola un título oficial.</p>
    </div>
    <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500">{teams.length} clubes disponibles</span>
   </div>
   <div className="mt-3 max-w-[540px]">
    <TeamSearchPicker fieldId="trophy-catalog-club-picker" ariaLabel="Buscar club para ver sus trofeos" placeholder="Selecciona un equipo de MF LEGACY…" teams={teams} value={teamId} onChange={value=>{setTeamId(value);setSourceMode("all");}} loading={loading} error={error}/>
   </div>
   {!teamId&&promoted.length>0&&<div className="mt-3 flex flex-wrap items-center gap-2">
    <span className="text-[10px] text-slate-400">Con títulos contrastados:</span>
    {promoted.map(t=><button key={t.id} type="button" onClick={()=>setTeamId(String(t.id))} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[10px] font-semibold text-slate-700 hover:border-blue-300 hover:bg-blue-50">{t.logo&&<img src={t.logo} alt="" loading="lazy" className="h-4 w-4 object-contain"/>}{t.name}<span className="text-slate-400">{t.count}</span></button>)}
   </div>}
  </div>
  {!teamId&&<div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center">
   <Search size={24} className="mx-auto text-slate-300"/>
   <p className="mt-2 text-xs font-bold text-slate-700">Selecciona un club para explorar sus trofeos</p>
   <p className="mt-1 text-[11px] text-slate-400">Los torneos sin historial vinculado todavía no se atribuyen a ningún equipo.</p>
  </div>}
  {teamId&&<>
   <div className="flex flex-wrap items-center justify-between gap-2">
    <div className="flex items-center gap-3">
     {selected?.logo&&<img src={selected.logo} alt="" className="h-11 w-11 object-contain"/>}
     <div><h3 className="text-sm font-black text-slate-900">{selected?.name||"Club seleccionado"}</h3>
      <p className="mt-0.5 text-[11px] text-slate-500">{joined.verified.length} adjudicaciones verificadas · {joined.historical.length} finales históricas importadas</p>
     </div>
    </div>
    <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
     {[["all","Todos"],["verified","Verificados"],["historical","Archivo Rob"]].map(([key,name])=><button key={key} type="button" aria-pressed={sourceMode===key} onClick={()=>setSourceMode(key)} className={"rounded-md px-3 py-1.5 text-[11px] font-bold "+(sourceMode===key?"bg-white text-[#003399] shadow-sm":"text-slate-500")}>{name}</button>)}
    </div>
   </div>
   {editionQuery.isLoading&&<p className="rounded-lg bg-white p-4 text-xs text-slate-500">Consultando las finales históricas del club…</p>}
   {editionQuery.isError&&<p role="alert" className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800"><AlertCircle size={14}/> No se ha podido consultar TrophyEdition. Los títulos verificados siguen disponibles.</p>}
   {!editionQuery.isLoading&&results.length===0&&<p className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-xs text-slate-500">No hay trofeos vinculados a este club para la vista y los filtros actuales. Esto no implica que no tenga otros títulos.</p>}
   {results.length>0&&<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-7">{results.map(item=><div key={item.trophy.source_id} className="space-y-1.5">
    <Card trophy={item.trophy} manifest={manifest} open={()=>onOpen(item.trophy)} count={item.verifiedCount}/>
    <div className="flex flex-wrap items-center gap-1">
     {item.verifiedCount>0&&<span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-1 text-[9px] font-bold text-emerald-700"><Medal size={10}/> {item.verifiedCount} confirmados</span>}
     {item.historicalCount>0&&<span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-1 text-[9px] font-bold text-amber-700"><BookOpen size={10}/> {item.historicalCount} Rob · provisional</span>}
    </div>
   </div>)}</div>}
   <p className="flex items-start gap-2 text-[11px] leading-5 text-slate-500"><Info size={13} className="mt-0.5 shrink-0"/> Las cifras de Rob se cuentan como finales registradas por club, no como adjudicaciones acreditadas en TrophyHonour. Un mismo trofeo puede figurar en ambas fuentes sin duplicar su ficha.</p>
  </>}
 </section>;
}