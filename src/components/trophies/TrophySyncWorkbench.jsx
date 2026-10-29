import React,{useMemo,useState} from "react";
import {useQuery,useQueryClient} from "@tanstack/react-query";
import {ClipboardCopy,Upload,ShieldCheck,Users,ChevronDown,ChevronUp,AlertCircle} from "lucide-react";
import {base44} from "@/api/base44Client";
import {completeRecordQueryOptions} from "@/utils/entityRecords";
import {statsSnapshotOptions} from "@/api/recordQueries";
import {flattenStatsPages} from "@/utils/statsRowsCache";
import TeamSearchPicker from "@/components/trophies/TeamSearchPicker";
import {trophyResearchPrompt,parseTrophyResearch,previewTrophyHonours,previewPlayerTrophyCredits} from "@/utils/trophySync";

const TROPHY_KEY=["mf-legacy","trophies","definitions"];
const HONOURS_KEY=["mf-legacy","trophies","honours"];
const CREDIT_KEY=["mf-legacy","trophies","credits"];
const txt=v=>String(v??"").trim();
const button="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-700 hover:border-blue-200 hover:text-[#003399] disabled:opacity-40";
const primary="rounded-lg bg-[#003399] px-4 py-2 text-[11px] font-bold text-white hover:bg-[#002b82] disabled:opacity-40";
export default function TrophySyncWorkbench({catalog=[],trophies=[],honours=[],standalone=false,initialPhase="champions"}){
 const qc=useQueryClient();
 const [open,setOpen]=useState(standalone),[phase,setPhase]=useState(initialPhase);
 const [teamId,setTeamId]=useState(""),[from,setFrom]=useState("2015/2016"),[to,setTo]=useState("2025/2026");
 const [research,setResearch]=useState(""),[entries,setEntries]=useState([]);
 const [generatedPrompt,setGeneratedPrompt]=useState("");
 const [checked,setChecked]=useState([]),[saving,setSaving]=useState(false);
 const [sourcesReviewed,setSourcesReviewed]=useState(false);
 const [selectedHonour,setSelectedHonour]=useState(""),[candidateRows,setCandidateRows]=useState([]);
 const [creditChecked,setCreditChecked]=useState([]),[finding,setFinding]=useState(false);
 const [creditSources,setCreditSources]=useState({});
 const [message,setMessage]=useState(""),[error,setError]=useState("");
 const teamsQuery=useQuery({...completeRecordQueryOptions(base44.entities.Team,["mf-legacy","teams"]),enabled:open});
 const creditsQuery=useQuery({...completeRecordQueryOptions(base44.entities.PlayerTrophyCredit,CREDIT_KEY),enabled:open&&phase==="players",retry:false});
 const teams=teamsQuery.data||[];
 const chosenTeam=teams.find(t=>t.id===teamId);
 const preview=useMemo(()=>previewTrophyHonours(entries,{catalog,trophies,honours,teams}),[entries,catalog,trophies,honours,teams]);
 const confirmed=useMemo(()=>honours.filter(h=>h.recipient_type==="Team"&&h.verified===true)
   .sort((a,b)=>String(b.season).localeCompare(String(a.season))),[honours]);
 const currentHonour=confirmed.find(h=>h.id===selectedHonour);
 const existingCredits=(creditsQuery.data||[]).filter(c=>c.trophy_honour_id===selectedHonour);
 const selectedCount=preview.filter(r=>r.status==="new"&&checked.includes(r.index)).length;
 const clean=()=>{setError("");setMessage("");};
 const doCopy=async()=>{
  clean();
  try{
   if(!chosenTeam)throw Error("Selecciona primero un equipo.");
   const prompt=trophyResearchPrompt(chosenTeam,{from,to});
   setGeneratedPrompt(prompt);
   if(!navigator.clipboard?.writeText)throw Error("Utiliza el texto que se muestra debajo para copiarlo manualmente.");
   await navigator.clipboard.writeText(prompt);
   setMessage("Prompt de investigación copiado. Pega después el JSON resultante en la importación.");
  }catch(e){setMessage("El prompt está preparado debajo: puedes seleccionarlo y copiarlo manualmente.");}
 };
 const parse=()=>{
  clean();
  try{const list=parseTrophyResearch(research);setSourcesReviewed(false);setEntries(list);
   setChecked(list.map((_,i)=>i));setMessage(list.length+" registros analizados. Revisa las coincidencias antes de guardar.");
  }catch(e){setError(e.message);}
 };
 const save=async()=>{
  clean();if(saving||!selectedCount||!sourcesReviewed)return;setSaving(true);
  let done=0;
  const savedDefinitions=new Map(trophies.filter(t=>t.id).map(t=>[txt(t.source_id),t]));
  const seen=new Set();
  try{
   for(const row of preview.filter(r=>r.status==="new"&&checked.includes(r.index))){
    const key=[row.trophy.source_id,row.season,row.team.id].join("|");
    if(seen.has(key))continue;seen.add(key);
    let definition=savedDefinitions.get(txt(row.trophy.source_id));
    if(!definition){
      definition=await base44.entities.Trophy.create({
       source_id:txt(row.trophy.source_id),name:row.trophy.name,
       trophy_type:"Team Trophy",category:row.trophy.category||"",
       country:row.trophy.country||"",organizer:row.trophy.organizer||"",
       identification_status:row.trophy.identification_status==="Pending"?"Pending":"Verified",
       source_name:row.trophy.source_name||"",image_url:row.trophy.image_url||"",notes:""
      });
      savedDefinitions.set(txt(row.trophy.source_id),definition);
    }
    await base44.entities.TrophyHonour.create({
     trophy_id:txt(definition.id),trophy_source_id:txt(row.trophy.source_id),
     season:row.season,recipient_type:"Team",recipient_id:txt(row.team.id),
     recipient_name:row.team.name,verified:row.verified,source_url:row.source_url,
     notes:"Investigación histórica importada; fuente proporcionada por el usuario."
    });
    done++;
   }
   setMessage(done+" títulos importados. Las ediciones se vinculan por ID al equipo y al trofeo.");
   setEntries([]);setChecked([]);setResearch("");
  }catch(e){setError("Se incorporaron "+done+" títulos antes del error: "+e.message+"; recarga para evitar duplicados.");}
  finally{await Promise.all([qc.invalidateQueries({queryKey:TROPHY_KEY}),qc.invalidateQueries({queryKey:HONOURS_KEY})]);setSaving(false);}
 };
 const findPlayers=async()=>{
  clean();setCandidateRows([]);setCreditChecked([]);
  if(!currentHonour)return setError("Selecciona un título verificado.");
  setFinding(true);
  try{
   // The shared STATS snapshot is read only after pressing the button.
   const [data,players,careers]=await Promise.all([
    qc.fetchQuery(statsSnapshotOptions()),
    qc.fetchQuery(completeRecordQueryOptions(base44.entities.Player,["mf-legacy","players"])),
    qc.fetchQuery(completeRecordQueryOptions(base44.entities.PlayerCareer,["mf-legacy","trophy-sync","careers"]))
   ]);
   const trophy=trophies.find(t=>txt(t.source_id)===txt(currentHonour.trophy_source_id))||
    catalog.find(t=>txt(t.source_id)===txt(currentHonour.trophy_source_id));
   const matches=previewPlayerTrophyCredits(currentHonour,{
    stats:flattenStatsPages(data),players,careers,
    trophy,existing:creditsQuery.data||[]
   });
   setCandidateRows(matches);setCreditChecked(matches.filter(x=>x.status==="candidate").map(x=>x.player_id));
   setMessage(matches.length+" jugadores relacionados; participar no certifica el derecho a recibir el título.");
  }catch(e){setError("No se pudo completar la conciliación: "+e.message);}
  finally{setFinding(false);}
 };
 const decideCredit=async(credit,status)=>{
  clean();
  if(saving||!credit?.id)return;
  const source=txt(creditSources[credit.id]||credit.source_url);
  if(status==="confirmed"&&!/^https:\/\/[^\s/]+\.[^\s/]+/i.test(source)){
   setError("Para confirmar un título necesitas una URL HTTPS que acredite al jugador o su elegibilidad oficial.");
   return;
  }
  setSaving(true);
  try{
   await base44.entities.PlayerTrophyCredit.update(credit.id,{
     status,verified:status==="confirmed",source_url:status==="confirmed"?source:credit.source_url||"",
     evidence_type:status==="confirmed"?"official_roster":credit.evidence_type,
     evidence_note:status==="confirmed"?"Adjudicación confirmada manualmente con fuente oficial":credit.evidence_note
   });
   await qc.invalidateQueries({queryKey:CREDIT_KEY});
   setMessage(status==="confirmed"?"Jugador confirmado con fuente; ya aparece en su palmarés.":"Adjudicación excluida del palmarés.");
  }catch(e){setError("No se pudo actualizar la adjudicación: "+e.message);}
  finally{setSaving(false);}
 };
 const saveCandidates=async()=>{
  clean();if(saving)return;setSaving(true);let done=0;
  try{
   const existing=new Set((creditsQuery.data||[]).map(c=>[c.trophy_honour_id,c.player_id].join("|")));
   for(const item of candidateRows.filter(r=>r.status!=="existing"&&creditChecked.includes(r.player_id))){
    const key=[currentHonour.id,item.player_id].join("|");
    if(existing.has(key))continue;
    await base44.entities.PlayerTrophyCredit.create({
     trophy_honour_id:currentHonour.id,trophy_source_id:currentHonour.trophy_source_id,
     player_id:item.player_id,team_id:item.team_id,season:item.season,
     status:"candidate",evidence_type:item.participation?"competition_appearance":"career_stage",
     evidence_note:(item.participation?item.matches+" apariciones registradas en "+[...new Set(item.competition_names)].join(", "):"Pertenencia al club sin PJ de la competición")+"; falta confirmar elegibilidad oficial.",
     source_url:"",verified:false
    });
    done++;existing.add(key);
   }
   await qc.invalidateQueries({queryKey:CREDIT_KEY});
   setMessage(done+" candidatos creados para revisión. No se ha confirmado automáticamente ningún trofeo individual.");
   setCandidateRows([]);
  }catch(e){setError("Se registraron "+done+" candidatos antes del error: "+e.message);}
  finally{setSaving(false);}
 };
 return <section className="mb-4 rounded-2xl border border-blue-100 bg-white shadow-sm">
  <button type="button" disabled={standalone} onClick={()=>setOpen(v=>!v)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left disabled:cursor-default">
   <span className="flex items-center gap-2 text-xs font-black text-[#003399]"><ShieldCheck size={16}/> SINCRONIZACIÓN HISTÓRICA · TEAMS + PLAYERS</span>
   {!standalone&&(open?<ChevronUp size={16}/>:<ChevronDown size={16}/>)}
  </button>
  {open&&<div className="space-y-4 border-t border-slate-100 p-4">
   <div className="flex flex-wrap gap-2">
    {[["champions","1 · Campeones por temporada"],["players","2 · Jugadores elegibles"]].map(([id,name])=><button type="button" key={id} className={phase===id?primary:button} onClick={()=>{setPhase(id);clean();}}>{name}</button>)}
   </div>
   {message&&<p className="rounded-lg bg-blue-50 p-2 text-xs text-blue-900" role="status">{message}</p>}
   {error&&<p className="rounded-lg bg-rose-50 p-2 text-xs text-rose-800" role="alert">{error}</p>}
   {phase==="champions"?<>
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_130px_130px_auto]">
     <TeamSearchPicker teams={teams} value={teamId} loading={teamsQuery.isLoading}
      error={teamsQuery.isError} onChange={id=>{setTeamId(id);setGeneratedPrompt("");}}/>
     <input aria-label="Desde" value={from} onChange={e=>setFrom(e.target.value)} className="min-w-0 rounded-lg border border-slate-200 p-2 text-xs"/>
     <input aria-label="Hasta" value={to} onChange={e=>setTo(e.target.value)} className="min-w-0 rounded-lg border border-slate-200 p-2 text-xs"/>
     <button type="button" className={button} onClick={doCopy} disabled={!chosenTeam}><ClipboardCopy className="mr-1 inline" size={13}/> Copiar prompt</button>
    </div>
    {generatedPrompt&&<textarea aria-label="Prompt generado" readOnly rows={4} value={generatedPrompt} onFocus={e=>e.target.select()} className="w-full resize-y rounded-lg border border-blue-100 bg-blue-50/40 p-3 text-[11px] text-slate-700"/>}
    <p className="text-[11px] text-slate-500">Investiga los campeones en ChatGPT y pega aquí el JSON obtenido. Las coincidencias se resuelven por ID original del trofeo y del equipo, sin inventar ganadores.</p>
    <textarea aria-label="JSON de palmarés" rows={3} value={research} onChange={e=>setResearch(e.target.value)}
     className="w-full resize-y rounded-lg border border-slate-200 p-3 font-mono text-[11px]" placeholder='{"format":"mf_legacy_trophy_honours_v1","honours":[...]}'/>
    <div className="flex flex-wrap items-center justify-between gap-2">
     <button type="button" className={button} onClick={parse}><Upload className="mr-1 inline" size={13}/> Analizar JSON</button>
     {preview.length>0&&<span className="text-[11px] text-slate-500">{preview.filter(x=>x.status==="new").length} nuevos · {preview.filter(x=>x.status==="existing").length} existentes · {preview.filter(x=>x.status==="review").length} por revisar</span>}
    </div>
    {preview.length>0&&<div className="max-h-60 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
     {preview.map(r=><label key={r.index} className="flex items-center gap-2 border-b border-slate-100 py-1.5 text-xs">
      <input type="checkbox" disabled={r.status!=="new"||saving} checked={r.status==="new"&&checked.includes(r.index)}
       onChange={e=>setChecked(v=>e.target.checked?[...v,r.index]:v.filter(x=>x!==r.index))}/>
      <span className="min-w-0 flex-1 truncate">{r.trophy?.name||r.raw.trophy_name} · {r.season||r.raw.season} · {r.team?.name||r.raw.team_name}</span>
      <span className={r.status==="new"?"text-emerald-700":"text-amber-700"}>{r.status==="new"?"Nuevo"+(r.verified?" · evidencia":" · sin confirmar"):r.reason}</span>
     </label>)}
    </div>}
    {preview.length>0&&<>
      <label className="flex items-center gap-2 text-[11px] text-slate-600">
       <input type="checkbox" checked={sourcesReviewed} onChange={e=>setSourcesReviewed(e.target.checked)}/>
       He comprobado que los equipos campeones, las temporadas y las fuentes corresponden a los títulos seleccionados.
      </label>
      <button type="button" disabled={!selectedCount||saving||!sourcesReviewed} className={primary} onClick={save}>{saving?"Guardando…":"Guardar "+selectedCount+" títulos"}</button>
    </>}
   </>:<>
    <p className="text-[11px] text-slate-500">Cruce por <strong>team_id, season y competición</strong>. STATS acredita participación, no la medalla ni la elegibilidad oficial. Los candidatos quedan pendientes de revisión.</p>
    {creditsQuery.isError&&<p className="text-xs text-amber-700">No se puede leer PlayerTrophyCredit. Sincroniza primero la entidad en Base44.</p>}
    <div className="flex gap-2">
     <select className="min-w-0 flex-1 rounded-lg border border-slate-200 p-2 text-xs" value={selectedHonour} onChange={e=>{setSelectedHonour(e.target.value);setCandidateRows([]);}}>
      <option value="">Selecciona un título de equipo con evidencia</option>
      {confirmed.map(h=><option key={h.id} value={h.id}>{h.recipient_name} · {h.season} · {trophies.find(t=>txt(t.source_id)===txt(h.trophy_source_id))?.name||catalog.find(t=>txt(t.source_id)===txt(h.trophy_source_id))?.name||h.trophy_source_id}</option>)}
     </select>
     <button type="button" disabled={!selectedHonour||finding||saving} onClick={findPlayers} className={button}><Users size={14} className="mr-1 inline"/>{finding?"Consultando…":"Cruzar con STATS"}</button>
    </div>
    {candidateRows.length>0&&<div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
     {candidateRows.map(r=><label key={r.player_id} className="flex items-center gap-2 border-b border-slate-100 py-1.5 text-xs">
      <input type="checkbox" disabled={r.status==="existing"||saving} checked={r.status!=="existing"&&creditChecked.includes(r.player_id)} onChange={e=>setCreditChecked(v=>e.target.checked?[...v,r.player_id]:v.filter(id=>id!==r.player_id))}/>
      <span className="min-w-0 flex-1 truncate">{r.player.name}</span>
      <span className="text-slate-500">{r.status==="candidate"?r.matches+" PJ · Candidato":r.status==="existing"?"Ya registrado":"Por revisar"}</span>
     </label>)}
    </div>}
    {candidateRows.length>0&&<button type="button" disabled={!creditChecked.some(id=>candidateRows.some(r=>r.player_id===id&&r.status!=="existing"))||saving} className={primary} onClick={saveCandidates}>Registrar candidatos seleccionados (sin confirmar títulos)</button>}
    {existingCredits.length>0&&<div className="space-y-2 rounded-lg border border-slate-200 p-3">
      <p className="text-[11px] font-bold text-slate-700">Adjudicaciones registradas · {existingCredits.length}</p>
      {existingCredits.map(c=><div key={c.id} className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-2 text-xs">
       <span className="min-w-[120px] flex-1 truncate">{candidateRows.find(x=>x.player_id===c.player_id)?.player?.name||c.player_id}</span>
       <span className={c.status==="confirmed"?"text-emerald-700":c.status==="excluded"?"text-slate-500":"text-amber-700"}>{c.status==="confirmed"?"Confirmado":c.status==="excluded"?"Excluido":"Candidato"}</span>
       {c.status==="candidate"&&<>
        <input type="url" aria-label={"Fuente para "+c.player_id} placeholder="URL oficial de plantilla / elegibilidad" value={creditSources[c.id]||""}
         onChange={e=>setCreditSources(v=>({...v,[c.id]:e.target.value}))} className="min-w-[180px] flex-[2] rounded border border-slate-200 px-2 py-1.5 text-[11px]"/>
        <button type="button" disabled={saving} onClick={()=>decideCredit(c,"confirmed")} className="rounded border border-emerald-200 px-2 py-1.5 text-[11px] font-bold text-emerald-800">Confirmar</button>
        <button type="button" disabled={saving} onClick={()=>decideCredit(c,"excluded")} className="rounded border border-slate-200 px-2 py-1.5 text-[11px] text-slate-600">Excluir</button>
       </>}
      </div>)}
    </div>}
   </>}
   <p className="flex items-center gap-1 text-[10px] text-slate-400"><AlertCircle size={12}/> Las fichas existentes y los títulos individuales no se alteran. Los resultados sin identificación inequívoca quedan pendientes.</p>
  </div>}
 </section>;
}
