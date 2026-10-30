import React,{useEffect,useMemo,useState} from "react";
import {RefreshCw,Search,Link2,ShieldCheck,AlertTriangle,CheckCircle2,Layers3,ChevronDown,ChevronUp} from "lucide-react";
import {base44} from "@/api/base44Client";
import {readCompleteRecords} from "@/utils/entityRecords";
import {canonicalHistoricalClub,canonicalHistoricalCompetition} from "@/utils/historicalJson";
import {normalizeSeason} from "@/utils/historicalValuation";
import {buildPossessionAudit,planPossessionAssociation} from "@/utils/possessionAssociations";
import {recommendPossessionTeam} from "@/utils/possessionNameMatching";
import TeamSearchPicker from "@/components/trophies/TeamSearchPicker";

const simplify=value=>String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
const errorText=error=>String(error?.message||error||"Error desconocido");
const tagClass="rounded-full px-2 py-1 text-[11px] font-semibold";
const groupStatus=group=>group.conflict?"Revisar conflicto":group.pending?"Pendiente":"Vinculado";

export default function PossessionAuditPanel({rows=[],teams=[],loading=false,focusSource=null,onUpdated,onRefresh}){
 const audit=useMemo(()=>buildPossessionAudit(rows,teams),[rows,teams]);
 const [query,setQuery]=useState(""),[filter,setFilter]=useState("pending");
 const [showCount,setShowCount]=useState(60),[activeKey,setActiveKey]=useState("");
 const [teamId,setTeamId]=useState(""),[bulkPreview,setBulkPreview]=useState(false);
 const [reviewSelection,setReviewSelection]=useState({});
 const [showMissing,setShowMissing]=useState(false),[missingQuery,setMissingQuery]=useState("");
 const [saving,setSaving]=useState(false),[progress,setProgress]=useState("");
 const [notice,setNotice]=useState(""),[error,setError]=useState("");
 const active=audit.groups.find(group=>group.key===activeKey)||null;
 const proposed=useMemo(()=>{
  if(!active||!teamId)return null;
  try{return planPossessionAssociation(rows,teams,active.key,teamId);}
  catch(e){return {updates:[],conflicts:[errorText(e)],total:0,seasons:[],competitions:[]};}
 },[active,teamId,rows,teams]);
 const allSuggestions=useMemo(()=>{
  const plans=audit.groups.filter(g=>g.pending&&!g.conflict).map(group=>{
   const match=recommendPossessionTeam(group,teams);
   if(!match)return null;
   try{
    const plan=planPossessionAssociation(rows,teams,group.key,match.team.id);
    return plan.conflicts.length||!plan.updates.length?null:{...plan,match,sourceName:group.name};
   }catch{return null;}
  }).filter(Boolean);
  // Duplicate destinations across proposed source groups must be resolved
  // manually, even if an individual suggestion otherwise looks convincing.
  const counts=new Map();
  for(const plan of plans)for(const record of plan.updates){
   const id=[plan.team.id,normalizeSeason(record.season),canonicalHistoricalCompetition(record.competition)].join("|");
   counts.set(id,(counts.get(id)||0)+1);
  }
  return plans.filter(plan=>plan.updates.every(record=>{
   const id=[plan.team.id,normalizeSeason(record.season),canonicalHistoricalCompetition(record.competition)].join("|");
   return counts.get(id)===1;
  }));
 },[audit.groups,rows,teams]);
 const safePlans=allSuggestions.filter(p=>p.match.confidence==="high");
 const reviewPlans=allSuggestions.filter(p=>p.match.confidence==="review");
 const selectedPlans=allSuggestions.filter(p=>p.match.confidence==="high"?
  reviewSelection[p.sourceKey]!==false:reviewSelection[p.sourceKey]===true);
 const selectedRecords=selectedPlans.reduce((count,plan)=>count+plan.updates.length,0);
 const visible=useMemo(()=>audit.groups.filter(group=>{
  const statusMatch=filter==="all"||group.status===filter;
  const text=[group.name,...group.names,...group.seasons,...group.competitions].join(" ");
  return statusMatch&&simplify(text).includes(simplify(query));
 }),[audit.groups,query,filter]);
 const chooseGroup=group=>{
  if(saving)return;
  setActiveKey(current=>current===group.key?"":group.key);
  const proposal=recommendPossessionTeam(group,teams);
  setTeamId(proposal?.team?.id||[...group.linkedIds][0]||"");
  setBulkPreview(false);setError("");setNotice("");
 };
 useEffect(()=>{
  if(!focusSource?.name)return;
  const key=canonicalHistoricalClub(focusSource.name);
  const group=audit.groups.find(g=>g.key===key);
  if(!group)return;
  setFilter("all");setQuery("");setActiveKey(group.key);
  setTeamId(recommendPossessionTeam(group,teams)?.team?.id||[...group.linkedIds][0]||"");
  setBulkPreview(false);
  document.getElementById("possession-audit")?.scrollIntoView({behavior:"smooth",block:"start"});
 },[focusSource?.token,focusSource?.name,teams,audit.groups]);
 async function applyAssociations(targets){
  if(saving||!targets.length)return;
  setSaving(true);setError("");setNotice("");setProgress("Comprobando la base completa antes de escribir…");
  let done=0;
  try{
   const existing=await readCompleteRecords(base44.entities.TeamSeasonPossession);
   const plans=targets.map(({sourceKey,targetId})=>planPossessionAssociation(existing,teams,sourceKey,targetId));
   const conflict=plans.flatMap(plan=>plan.conflicts);
   if(conflict.length)throw Error("No se han realizado cambios: "+conflict.slice(0,4).join(" | "));
   const changes=plans.flatMap(plan=>plan.updates.map(change=>({...change,targetId:plan.team.id})));
   if(!changes.length){setNotice("Todos los registros ya estaban asociados.");return;}
   const uniqueIds=new Set(),keys=new Set();
   for(const change of changes){
    if(uniqueIds.has(change.id))throw Error("Una fila se ha incluido en varias asociaciones.");
    uniqueIds.add(change.id);
    const key=[change.targetId,normalizeSeason(change.season),canonicalHistoricalCompetition(change.competition)].join("|");
    if(keys.has(key))throw Error("Dos orígenes pretenden ocupar la misma temporada y competición del mismo club.");
    keys.add(key);
   }
   for(const change of changes){
    setProgress((done+1)+" / "+changes.length+" · "+change.season+" · "+change.competition);
    await base44.entities.TeamSeasonPossession.update(change.id,change.changes);
    done++;
   }
   setNotice(done+" registros asociados correctamente a través de todas sus temporadas. Los porcentajes y fuentes no se han modificado.");
   setActiveKey("");setTeamId("");setBulkPreview(false);
  }catch(e){
   setError((done?"Se actualizaron "+done+" registros antes del error; puedes repetir la operación sin duplicar datos. ":"")+errorText(e));
  }finally{
   setProgress("");setSaving(false);
   if(done)await onUpdated?.();
  }
 }
 const linkSelected=()=>active&&teamId&&applyAssociations([{sourceKey:active.key,targetId:teamId}]);
 const linkBulk=()=>applyAssociations(selectedPlans.map(plan=>({sourceKey:plan.sourceKey,targetId:plan.team.id})));
 return <section id="possession-audit" className="scroll-mt-5 rounded-2xl border border-blue-200 bg-white p-4 shadow-sm sm:p-5">
  <div className="flex flex-wrap items-start justify-between gap-3">
   <div><div className="flex items-center gap-2 text-[#123e8a]"><ShieldCheck size={20}/><h2 className="text-lg font-black">Comprobador global de equipos</h2></div>
    <p className="mt-1 text-xs text-slate-600">Audita todos los registros guardados, detecta clubes sin asociar y enlaza el mismo nombre de origen en todas las temporadas. No modifica los porcentajes de posesión.</p></div>
   <button type="button" onClick={onRefresh} disabled={saving||loading} className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-[#003399] disabled:opacity-50"><RefreshCw size={14}/> {loading?"Comprobando…":"Volver a comprobar"}</button>
  </div>
  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
   {[[audit.records,"Registros"],[audit.linked,"Vinculados"],[audit.pending,"Sin asociar"],[audit.conflicts+audit.invalid,"Incidencias"],[audit.seasons,"Temporadas"]].map(([number,label])=>
    <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3"><div className="text-xl font-black tabular-nums text-[#162d56]">{number}</div><div className="text-xs text-slate-500">{label}</div></div>)}
  </div>
  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
   <p>{audit.groups.length} nombres de origen identificados en la base.</p>
   <button type="button" onClick={()=>setShowMissing(value=>!value)} className="font-bold text-[#003399]">{audit.teamsWithoutRecords.length} equipos del catálogo sin registros detectados {showMissing?"· Ocultar":"· Ver lista"}</button>
  </div>
  {showMissing&&<div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/40 p-3">
   <p className="text-xs font-bold text-slate-800">Equipos sin ninguna posesión identificada</p>
   <p className="mt-1 text-[11px] text-slate-600">Se compara con el catálogo TEAMS; no prueba que faltan todas sus temporadas, solo que no se encontró ninguna por ID o nombre normalizado.</p>
   <input value={missingQuery} onChange={e=>setMissingQuery(e.target.value)} placeholder="Buscar entre equipos sin registros…" className="mt-2 w-full rounded-lg border border-slate-200 bg-white p-2 text-xs outline-none focus:border-blue-500"/>
   <div className="mt-2 max-h-44 overflow-auto text-xs text-slate-800">
    {audit.teamsWithoutRecords.filter(t=>simplify(t.name).includes(simplify(missingQuery))).slice(0,150).map(t=><p key={t.id} className="border-t border-amber-100 py-1.5">{t.name}</p>)}
   </div>
   {audit.teamsWithoutRecords.length>150&&<p className="mt-2 text-[11px] text-slate-500">Mostrando un máximo de 150 coincidencias; utiliza el buscador para afinar.</p>}
  </div>}
  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/70 p-3">
   <div><p className="text-sm font-bold text-slate-800">{safePlans.length} coincidencias de alta confianza · {reviewPlans.length} sugerencias para revisar</p>
    <p className="mt-1 text-xs text-slate-600">Reconoce siglas (AS, FC, OGC…) y nombres abreviados. Las coincidencias dudosas no se seleccionan por defecto.</p></div>
   <button type="button" disabled={!allSuggestions.length||saving} onClick={()=>setBulkPreview(!bulkPreview)}
    className="inline-flex items-center gap-2 rounded-lg bg-[#003399] px-3 py-2 text-xs font-bold text-white disabled:opacity-45"><Link2 size={14}/>{bulkPreview?"Ocultar revisión":"Revisar autovinculación"}</button>
  </div>
  {bulkPreview&&<div className="mt-3 rounded-xl border border-blue-200 bg-white p-3">
   <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-bold text-slate-900">Comprobar y elegir asociaciones</p>
    <span className="text-xs font-semibold text-slate-600">{selectedPlans.length} nombres · {selectedRecords} registros seleccionados</span></div>
   <p className="mt-1 text-xs text-slate-500">Las coincidencias de alta confianza están seleccionadas; las sugeridas requieren marcar la casilla. Ningún registro cambiará hasta confirmar.</p>
   <div className="mt-3 flex flex-wrap gap-2">
    <button type="button" onClick={()=>setReviewSelection(Object.fromEntries(allSuggestions.map(p=>[p.sourceKey,p.match.confidence==="high"])))} className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-bold text-[#003399]">Solo alta confianza</button>
    <button type="button" onClick={()=>setReviewSelection(Object.fromEntries(allSuggestions.map(p=>[p.sourceKey,false])))} className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-600">Desmarcar todos</button>
   </div>
   <div className="mt-3 max-h-72 divide-y divide-slate-100 overflow-auto rounded-lg border border-slate-100">
    {allSuggestions.map(plan=><label key={plan.sourceKey} className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-blue-50/60">
     <input type="checkbox" disabled={saving} className="h-4 w-4 shrink-0 accent-[#003399]" checked={plan.match.confidence==="high"?reviewSelection[plan.sourceKey]!==false:reviewSelection[plan.sourceKey]===true}
      onChange={e=>setReviewSelection(prev=>({...prev,[plan.sourceKey]:e.target.checked}))}/>
     <div className="min-w-0 flex-1">
      <p className="text-xs text-slate-800"><strong>{plan.sourceName}</strong> <span className="text-slate-400">→</span> <strong>{plan.team.name}</strong></p>
      <p className="mt-0.5 text-[11px] text-slate-500">{plan.match.reason} · {plan.updates.length} registros · {plan.seasons.length} temporadas</p>
     </div>
     <span className={tagClass+" shrink-0 "+(plan.match.confidence==="high"?"bg-emerald-50 text-emerald-700":"bg-amber-50 text-amber-800")}>{plan.match.confidence==="high"?"Alta":"Revisar"}</span>
    </label>)}
   </div>
   <button type="button" disabled={saving||!selectedPlans.length} onClick={linkBulk}
    className="mt-3 rounded-lg bg-[#003399] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">Confirmar {selectedPlans.length} asociaciones · {selectedRecords} registros</button>
  </div>}
  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
   <div className="relative flex-1"><Search size={15} className="absolute left-3 top-3 text-slate-400"/><input value={query} onChange={e=>{setQuery(e.target.value);setShowCount(60);}}
     placeholder="Buscar nombre de equipo, temporada o competición…" className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-xs outline-none focus:border-blue-500"/></div>
   <select aria-label="Filtrar asociaciones" value={filter} onChange={e=>{setFilter(e.target.value);setShowCount(60);}} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800">
    <option value="pending">Pendientes ({audit.groups.filter(g=>g.status==="pending").length})</option>
    <option value="conflict">Con incidencias ({audit.groups.filter(g=>g.status==="conflict").length})</option>
    <option value="linked">Vinculados ({audit.groups.filter(g=>g.status==="linked").length})</option>
    <option value="all">Todos los equipos ({audit.groups.length})</option>
   </select>
  </div>
  <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
   <table className="w-full min-w-[540px] text-left text-xs">
    <thead className="bg-slate-50 text-slate-500"><tr><th className="p-3">Equipo de origen</th><th className="p-3">Cobertura</th><th className="p-3">Estado</th><th className="p-3 text-right">Asociación</th></tr></thead>
    <tbody>{visible.slice(0,showCount).map(group=><React.Fragment key={group.key}>
     <tr className="border-t border-slate-100 hover:bg-slate-50">
      <td className="p-3"><span className="font-bold text-slate-900">{group.name}</span>{group.names.size>1&&<div className="text-[10px] text-slate-500">{group.names.size} variantes de nombre</div>}
       {allSuggestions.find(p=>p.sourceKey===group.key)&&<p className="mt-1 text-[11px] text-blue-700">Sugerencia: {allSuggestions.find(p=>p.sourceKey===group.key).team.name}</p>}</td>
      <td className="p-3"><span className="font-semibold">{group.recordCount}</span> registros · {group.seasonCount} temporadas · {group.competitionCount} competiciones</td>
      <td className="p-3"><span className={tagClass+" "+(group.conflict?"bg-red-50 text-red-700":group.pending?"bg-amber-50 text-amber-800":"bg-green-50 text-emerald-700")}>{groupStatus(group)}</span>{group.pending>0&&<div className="mt-1 text-[10px] text-slate-500">{group.pending} sin asociar</div>}</td>
      <td className="p-3 text-right"><button type="button" disabled={saving} onClick={()=>chooseGroup(group)} className="inline-flex items-center gap-1 font-bold text-[#003399]">{activeKey===group.key?"Cerrar":group.status==="linked"?"Ver asociación":"Asociar equipo"}{activeKey===group.key?<ChevronUp size={13}/>:<ChevronDown size={13}/>}</button></td>
     </tr>
     {activeKey===group.key&&<tr className="border-t border-blue-100 bg-blue-50/50"><td colSpan={4} className="p-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
       <div><p className="mb-2 text-xs font-bold text-slate-800">Buscar equipo oficial de MF Legacy</p><TeamSearchPicker teams={teams} value={teamId} onChange={setTeamId} placeholder="Escribe para elegir el equipo…" ariaLabel={"Asociar "+group.name+" a un equipo de MF Legacy"}/>
        <p className="mt-2 text-[11px] text-slate-600">Origen: <strong>{group.name}</strong>. Se conservará como alias para los próximos JSON.</p>
        {recommendPossessionTeam(group,teams)&&<p className="mt-1 text-[11px] font-semibold text-blue-800">{recommendPossessionTeam(group,teams).confidence==="high"?"Alta confianza":"Sugerencia para revisar"}: {recommendPossessionTeam(group,teams).team.name} · {recommendPossessionTeam(group,teams).reason}</p>}</div>
       <div className="rounded-lg bg-white p-3 text-xs text-slate-700">
        {!teamId?<p>Selecciona un equipo para comprobar todas sus temporadas antes de guardar.</p>:
         proposed?.conflicts?.length?<div className="flex items-start gap-2 text-red-700"><AlertTriangle size={15} className="shrink-0"/><p>{proposed.conflicts.slice(0,4).join(" | ")}</p></div>:
         <><p className="flex items-center gap-2 font-bold text-emerald-700"><CheckCircle2 size={15}/> Asociación válida</p>
          <p className="mt-1">{proposed.total} registros · {proposed.seasons.length} temporadas · {proposed.competitions.length} competiciones</p>
          <p className="mt-1 break-words text-[11px] text-slate-500">{proposed.seasons.join(" · ")}</p>
          <p className="mt-1 text-slate-600">{proposed.updates.length} registros necesitan actualización; los porcentajes no cambian.</p>
          <button type="button" onClick={linkSelected} disabled={saving||!proposed.updates.length} className="mt-2 rounded-lg bg-[#003399] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{proposed.updates.length?"Confirmar asociación de todas las temporadas":"Ya sincronizado"}</button>
         </>}
       </div>
      </div>
      {group.duplicates>0&&<p className="mt-2 text-xs font-semibold text-red-700">Se detectaron {group.duplicates} registros repetidos para la misma temporada y competición. Resuélvelos antes de asociar.</p>}
      {group.inconsistent>0&&<p className="mt-2 text-xs font-semibold text-amber-800">{group.inconsistent} registros tienen un nombre guardado distinto del equipo vinculado. Revisa la identidad antes de confirmar.</p>}
     </td></tr>}
    </React.Fragment>)}</tbody>
   </table>
   {!visible.length&&<div className="p-6 text-center text-xs text-slate-500">No hay equipos para este filtro.</div>}
  </div>
  {visible.length>showCount&&<button type="button" onClick={()=>setShowCount(n=>n+60)} className="mt-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-[#003399]">Mostrar más equipos ({visible.length-showCount} restantes)</button>}
  {progress&&<p className="mt-3 flex items-center gap-2 text-xs font-bold text-[#003399]"><Layers3 size={14}/>{progress}</p>}
  {notice&&<p role="status" className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-800">{notice}</p>}
  {error&&<p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</p>}
 </section>;
}
