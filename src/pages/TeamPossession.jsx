import React,{useEffect,useMemo,useState} from "react";
import {Link} from "react-router-dom";
import {useQueryClient} from "@tanstack/react-query";
import {base44} from "@/api/base44Client";
import {useTeamsQuery} from "@/hooks/useSharedData";
import {HISTORICAL_PEER_KEY} from "@/utils/historicalPeerCache";
import {canonicalHistoricalCompetition,canonicalHistoricalClub} from "@/utils/historicalJson";
import {validatePossessionRow,parsePossessionBatch,matchingPossessionRecord,possessionImportDecision} from "@/utils/teamPossession";
import {Database,Upload,Save,Search,ChevronLeft,RefreshCw,FileJson} from "lucide-react";

const unpack=r=>Array.isArray(r)?r:r?.items||r?.data||r?.results||[];
const blank={team_id:"",team_name:"",season:"2024/2025",competition:"Premier League",team_possession_pct:"",source:"Manual",source_url:"",matches_covered:"",notes:""};
const inputClass="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500";
const labelClass="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-600";
const buttonClass="inline-flex items-center justify-center gap-2 rounded-lg bg-[#003399] px-4 py-2 text-sm font-semibold text-white disabled:opacity-45";
const statusText=e=>String(e?.message||e||"Error de conexión.");
const normalize=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const sample=[{team_name:"Manchester City",season:"2018/2019",competition:"Premier League",team_possession_pct:67.9,source:"FBref",source_url:""}];

export default function TeamPossession(){
 const cache=useQueryClient(),teamsQuery=useTeamsQuery();
 const teams=useMemo(()=>(teamsQuery.data||[]).filter(t=>t?.id).sort((a,b)=>a.name.localeCompare(b.name)),[teamsQuery.data]);
 const [admin,setAdmin]=useState(null),[rows,setRows]=useState([]),[loading,setLoading]=useState(true);
 const [form,setForm]=useState(blank),[editId,setEditId]=useState(""),[search,setSearch]=useState(""),[listFilter,setListFilter]=useState("");
 const [notice,setNotice]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const [json,setJson]=useState(""),[preview,setPreview]=useState(null),[importing,setImporting]=useState(false),[progress,setProgress]=useState("");
 const [fileName,setFileName]=useState("");
 const update=(key,value)=>{setForm(prev=>({...prev,[key]:value}));setNotice("");setError("");};
 const refresh=async()=>{
  setLoading(true);
  try{
   const response=await base44.entities.TeamSeasonPossession.list({limit:500,sort:"-updated_date"});
   setRows(unpack(response));
   setError("");
  }catch(e){setError("No se pudo cargar la base de posesión: "+statusText(e));}
  finally{setLoading(false);}
 };
 useEffect(()=>{let live=true; (async()=>{
  try{const me=await base44.auth.me();if(!live)return;setAdmin(me?.role==="admin");if(me?.role==="admin")await refresh();}
  catch(e){if(live){setAdmin(false);setError(statusText(e));}}
  finally{if(live)setLoading(false);}
 })();return()=>{live=false;};},[]);
 const displayed=useMemo(()=>rows.filter(r=>{
  const club=teams.find(t=>String(t.id)===String(r.team_id));
  return normalize([club?.name||r.team_name,r.season,r.competition].join(" ")).includes(normalize(listFilter));
 }).sort((a,b)=>String(b.season).localeCompare(String(a.season))||String(a.team_name).localeCompare(String(b.team_name))).slice(0,200),[rows,teams,listFilter]);
 const filteredTeams=useMemo(()=>teams.filter(t=>normalize(t.name).includes(normalize(search))).slice(0,100),[teams,search]);
 const setForEdit=row=>{
  setForm({team_id:row.team_id||"",team_name:row.team_name||"",season:row.season||"",competition:row.competition||"",
   team_possession_pct:String(row.team_possession_pct??"").replace(".",","),source:row.source||"Manual",source_url:row.source_url||"",
   matches_covered:row.matches_covered==null?"":String(row.matches_covered),notes:row.notes||""});
  setEditId(row.id);setSearch("");setError("");setNotice("Editando registro existente: al guardar se actualizará, sin duplicarlo.");
 };
 const reset=()=>{setForm(blank);setEditId("");setNotice("");setError("");};
 async function findExisting(row){
  // Never query team_id:"": that value is shared by EVERY unlinked club.
  // Search the season, then compare the exact Base44 identity or an
  // unambiguous canonical name, including existing pending records.
  const results=unpack(await base44.entities.TeamSeasonPossession.filter({season:row.season},{limit:500}));
  if(results.length===500)throw Error("Demasiados registros en esta temporada para deduplicar de forma segura.");
  return matchingPossessionRecord(results,row);
 }
 const refreshComposite=()=>cache.invalidateQueries({queryKey:HISTORICAL_PEER_KEY});
 async function saveOne(event){
  event.preventDefault();if(busy||admin!==true)return;
  setBusy(true);setError("");setNotice("");
  try{
   const team=teams.find(t=>String(t.id)===String(form.team_id));
   const row=validatePossessionRow({...form,team_name:team?.name||form.team_name},teams,{allowUnlinked:Boolean(editId)});
   const existing=await findExisting(row);
   if(editId&&existing&&existing.id!==editId)throw Error("El destino ya tiene un registro distinto. No se sobrescribió.");
   const target=existing||rows.find(r=>r.id===editId);
   if(target){
    if((target.team_id&&target.team_id!==row.team_id)||canonicalHistoricalClub(target.team_name)!==canonicalHistoricalClub(row.team_name)||target.season!==row.season||canonicalHistoricalCompetition(target.competition)!==canonicalHistoricalCompetition(row.competition))
      throw Error("No se permite cambiar la identidad de un registro. Crea otro nuevo.");
    await base44.entities.TeamSeasonPossession.update(target.id,row);
    setNotice("Posesión media actualizada. El Composite se recalculará con la nueva información.");
   }else{
    await base44.entities.TeamSeasonPossession.create(row);
    setNotice("Posesión media guardada. Disponible para los jugadores del club en esa competición y temporada.");
   }
   setEditId("");setForm({...blank,team_id:form.team_id,season:form.season,competition:form.competition});
   refreshComposite();await refresh();
  }catch(e){setError(statusText(e));}
  finally{setBusy(false);}
 }
 const loadJSON=text=>{setJson(text);setPreview(null);setProgress("");};
 const analyze=()=>{
  setError("");setNotice("");setProgress("");
  try{const p=parsePossessionBatch(json,teams);setPreview(p);if(p.errors.length)setError(p.errors.slice(0,8).join(" | ")+(p.errors.length>8?" · y más errores":""));}
  catch(e){setPreview(null);setError(statusText(e));}
 };
 async function importBatch(){
  if(!preview?.rows?.length||preview.errors.length||importing||admin!==true)return;
  setImporting(true);setError("");setNotice("");
  const result={new:0,updated:0,unchanged:0,pending:0,failed:[]};
  for(let i=0;i<preview.rows.length;i++){
   const row=preview.rows[i];if(!row.team_id)result.pending++;setProgress((i+1)+" de "+preview.rows.length+" · "+row.team_name+" · "+row.season);
   try{
    const existing=await findExisting(row);
    const action=possessionImportDecision(existing,row);
    if(action==="unchanged"){result.unchanged++;continue;}
    if(action==="update"){await base44.entities.TeamSeasonPossession.update(existing.id,row);result.updated++;}
    else{await base44.entities.TeamSeasonPossession.create(row);result.new++;}
   }catch(e){result.failed.push(row.team_name+" "+row.season+" "+row.competition+": "+statusText(e));}
  }
  setProgress("");setImporting(false);refreshComposite();await refresh();
  setNotice("Importación: "+result.new+" nuevos, "+result.updated+" actualizados, "+result.unchanged+" ya iguales, "+result.failed.length+" errores. "+result.pending+" clubes sin vincular (posesión conservada; PAdj pendiente hasta asociarlos).");
  if(result.failed.length)setError(result.failed.slice(0,8).join(" | "));
  else{setPreview(null);setJson("");setFileName("");}
 }
 const readFile=async event=>{const file=event.target.files?.[0];if(!file)return;setFileName(file.name);try{loadJSON(await file.text());}catch(e){setError(statusText(e));}};
 return <div className="h-full overflow-y-auto bg-[#f5f7fb] px-4 py-5 sm:px-7">
  <div className="mx-auto max-w-6xl space-y-5">
   <header className="flex flex-wrap items-center justify-between gap-3">
    <div>
     <div className="flex items-center gap-2"><Database className="h-6 w-6 text-[#003399]"/><h1 className="text-xl font-black text-[#162d56]">Posesión histórica · equipos</h1></div>
     <p className="mt-1 text-sm text-slate-600">Una posesión media por club, temporada y competición. Sirve para todos sus jugadores al calcular PAdj /90.</p>
    </div>
    <Link to="/stats" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"><ChevronLeft size={16}/> Volver a STATS</Link>
   </header>
   {admin===null?<div className="rounded-xl bg-white p-6 text-sm">Comprobando permisos…</div>
   :admin===false?<div className="rounded-xl border border-amber-200 bg-white p-6 text-sm text-amber-700">Solo administradores pueden introducir posesión histórica.</div>:
   <>
    <section className="rounded-2xl border border-blue-200 bg-[#edf3ff] p-4 text-sm text-slate-700">
     <p className="font-extrabold text-[#003399]">¿Qué porcentaje tienes que introducir?</p>
     <p className="mt-1">El porcentaje <strong>medio de posesión del equipo durante toda la competición en esa temporada</strong>. Ejemplo: «Manchester City · 2018/2019 · Premier League · 67,9 %». No es la posesión de un futbolista ni de un partido aislado. Liga, Champions y copas se guardan por separado.</p>
     <p className="mt-2 text-xs text-slate-600">Si no está verificado, déjalo sin introducir. PAdj usa la normalización experimental al 50 % de posesión y exige acciones defensivas, minutos y posesión para cada competición del jugador.</p>
    </section>
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
     <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between"><h2 className="text-base font-extrabold text-slate-900">Introducir posesión media</h2>{editId&&<button type="button" className="text-xs font-bold text-[#003399]" onClick={reset}>Cancelar edición</button>}</div>
      <form onSubmit={saveOne} className="space-y-3">
       <div><label className={labelClass}>Club de Base44</label><div className="relative mb-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/><input className={inputClass+" pl-9"} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar equipo…" aria-label="Buscar equipo"/></div>
        <select className={inputClass} value={form.team_id} onChange={e=>update("team_id",e.target.value)} required={!editId} disabled={Boolean(editId)}>
         <option value="">Selecciona el club</option>
         {teams.filter(t=>t.id===form.team_id||filteredTeams.includes(t)).map(t=><option value={t.id} key={t.id}>{t.name}</option>)}
        </select>{editId&&!form.team_id&&<p className="mt-1 text-xs font-semibold text-amber-700">Club pendiente de vincular: {form.team_name}. Puedes editar su posesión; para vincularlo, crea el club en TEAMS y vuelve a importar el JSON.</p>}
       </div>
       <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div><label className={labelClass}>Temporada</label><input className={inputClass} value={form.season} onChange={e=>update("season",e.target.value)} placeholder="2018/2019" required disabled={Boolean(editId)}/></div>
        <div><label className={labelClass}>Competición</label><input className={inputClass} value={form.competition} onChange={e=>update("competition",e.target.value)} placeholder="Premier League" required disabled={Boolean(editId)}/></div>
       </div>
       <div><label className={labelClass}>Posesión media del EQUIPO (%)</label>
        <div className="relative"><input className={inputClass+" pr-9 text-lg font-bold"} type="text" inputMode="decimal" value={form.team_possession_pct} onChange={e=>update("team_possession_pct",e.target.value)} placeholder="Ejemplo: 67,9" required/><span className="absolute right-3 top-2.5 font-bold text-slate-500">%</span></div>
        <p className="mt-1 text-xs text-slate-500">Escribe 67,9 o 67.9, sin el símbolo %. Media de toda la temporada en esa competición.</p>
       </div>
       <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div><label className={labelClass}>Fuente</label><input className={inputClass} value={form.source} onChange={e=>update("source",e.target.value)} placeholder="FBref, FotMob, UEFA…" /></div>
        <div><label className={labelClass}>Partidos cubiertos (opcional)</label><input className={inputClass} value={form.matches_covered} onChange={e=>update("matches_covered",e.target.value)} placeholder="38" inputMode="numeric"/></div>
       </div>
       <div><label className={labelClass}>Enlace de la fuente (recomendado)</label><input className={inputClass} value={form.source_url} onChange={e=>update("source_url",e.target.value)} placeholder="https://..." /></div>
       <div><label className={labelClass}>Notas (opcional)</label><input className={inputClass} value={form.notes} onChange={e=>update("notes",e.target.value)} placeholder="Diferencias de fuentes, alcance, etc." /></div>
       <button className={buttonClass+" w-full"} type="submit" disabled={busy||(!form.team_id&&!editId)||!form.team_possession_pct}>{busy?"Guardando…":<><Save size={16}/>{editId?"Actualizar posesión":"Guardar posesión media"}</>}</button>
      </form>
     </section>
     <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2"><FileJson className="h-5 w-5 text-[#003399]"/><h2 className="text-base font-extrabold text-slate-900">Importar varias temporadas · JSON</h2></div>
      <p className="mb-3 text-xs text-slate-600">Acepta un array o un objeto con <code>records</code>. Los equipos conocidos se vinculan automáticamente; los demás se guardan como pendientes, sin perder su posesión ni crear clubes falsos.</p>
      <div className="mb-2 flex flex-wrap items-center gap-2"><label className="cursor-pointer rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700"><Upload size={14} className="mr-1 inline"/> Elegir archivo JSON<input type="file" accept=".json,application/json" className="hidden" onChange={readFile}/></label><button className="text-xs font-bold text-[#003399]" onClick={()=>loadJSON(JSON.stringify(sample,null,2))}>Ver ejemplo</button>{fileName&&<span className="text-xs text-slate-500">{fileName}</span>}</div>
      <textarea className={inputClass+" h-56 resize-y font-mono text-xs"} spellCheck={false} value={json} onChange={e=>loadJSON(e.target.value)} placeholder={'[{"team_name":"Manchester City","season":"2018/2019","competition":"Premier League","team_possession_pct":67.9}]'}/>
      <button type="button" onClick={analyze} disabled={!json.trim()||importing||!teams.length} className="mt-2 w-full rounded-lg border border-[#003399] px-4 py-2 text-sm font-bold text-[#003399] disabled:opacity-50">Validar JSON</button>
      {preview&&<div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm"><p><strong>{preview.rows.length}</strong> registros válidos · <strong>{preview.errors.length}</strong> errores</p><p className="mt-1 text-xs text-slate-600"><strong>{preview.rows.filter(r=>r.team_id).length}</strong> clubes vinculados · <strong>{preview.rows.filter(r=>!r.team_id).length}</strong> clubes pendientes. Los pendientes se conservan pero no intervienen en PAdj hasta vincularse.</p><p className="mt-1 text-xs text-slate-500">Ningún dato se escribirá hasta pulsar «Importar».</p>{preview.errors.length===0&&preview.rows.length>0&&<button type="button" className={buttonClass+" mt-3 w-full"} disabled={importing} onClick={importBatch}>{importing?"Importando…":"Importar "+preview.rows.length+" registros"}</button>}</div>}
      {progress&&<p className="mt-2 text-xs font-semibold text-[#003399]">{progress}</p>}
     </section>
    </div>
    {(notice||error)&&<div role="status" className={"rounded-xl border bg-white p-3 text-sm "+(error?"border-red-200 text-red-700":"border-green-200 text-slate-700")}>{error||notice}</div>}
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
     <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-extrabold text-slate-900">Registros guardados ({rows.length}{rows.length===500?"+":""}) · pendientes: {rows.filter(r=>!r.team_id).length}</h2><button className="inline-flex items-center gap-2 text-xs font-bold text-[#003399]" onClick={refresh} disabled={loading}><RefreshCw size={15}/> {loading?"Cargando…":"Actualizar"}</button></div>
     <input className={inputClass+" mb-3"} value={listFilter} onChange={e=>setListFilter(e.target.value)} placeholder="Filtrar por equipo, temporada o competición…" />
     <div className="overflow-x-auto"><table className="w-full min-w-[580px] border-collapse text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr><th className="border-b p-2">Equipo</th><th className="border-b p-2">Temporada</th><th className="border-b p-2">Competición</th><th className="border-b p-2 text-right">Posesión</th><th className="border-b p-2">Fuente</th><th className="border-b p-2">Vinculación</th><th className="border-b p-2"></th></tr></thead><tbody>{displayed.map(row=><tr key={row.id} className="border-b border-slate-100"><td className="p-2 font-medium">{teams.find(t=>String(t.id)===String(row.team_id))?.name||row.team_name}</td><td className="p-2">{row.season}</td><td className="p-2">{row.competition}</td><td className="p-2 text-right font-extrabold tabular-nums">{Number(row.team_possession_pct).toLocaleString("es-ES",{maximumFractionDigits:2})} %</td><td className="p-2 text-xs">{row.source_url?<a href={row.source_url} target="_blank" rel="noopener noreferrer" className="text-[#003399] underline">{row.source||"Fuente"}</a>:row.source||"Manual"}</td><td className="p-2 text-xs">{row.team_id?<span className="font-bold text-emerald-700">Vinculado</span>:<span className="font-bold text-amber-700">Pendiente</span>}</td><td className="p-2 text-right"><button type="button" className="font-semibold text-[#003399]" onClick={()=>setForEdit(row)}>Editar</button></td></tr>)}</tbody></table>{!displayed.length&&<p className="py-6 text-center text-sm text-slate-500">{loading?"Cargando registros…":"Sin registros para este filtro."}</p>}</div>
    </section>
   </>}
  </div>
 </div>;
}
