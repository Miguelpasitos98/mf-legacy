import React, { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, Save, Trash2, Download, Palette } from "lucide-react";
import html2canvas from "html2canvas";
import { base44 } from "@/api/base44Client";
import PlayerPortrait from "./PlayerPortrait";
import { BalancePanel, PlayerPicker } from "./LineupSidePanel";
import { analyzeLineup } from "./lineupAnalysis.mjs";

export const FORMATIONS = {
  "4-3-3": [[50,91,"GK"],[13,73,"LB"],[37,76,"CB1"],[63,76,"CB2"],[87,73,"RB"],[28,50,"CM1"],[50,55,"DM"],[72,50,"CM2"],[16,25,"LW"],[50,19,"ST"],[84,25,"RW"]],
  "4-4-2": [[50,91,"GK"],[13,73,"LB"],[37,76,"CB1"],[63,76,"CB2"],[87,73,"RB"],[13,49,"LM"],[38,53,"CM1"],[62,53,"CM2"],[87,49,"RM"],[36,24,"ST1"],[64,24,"ST2"]],
  "3-5-2": [[50,91,"GK"],[25,73,"CB1"],[50,77,"CB2"],[75,73,"CB3"],[9,51,"LWB"],[33,55,"CM1"],[50,47,"CAM"],[67,55,"CM2"],[91,51,"RWB"],[36,24,"ST1"],[64,24,"ST2"]],
  "4-2-3-1": [[50,91,"GK"],[13,73,"LB"],[37,76,"CB1"],[63,76,"CB2"],[87,73,"RB"],[35,57,"DM1"],[65,57,"DM2"],[15,37,"LW"],[50,37,"CAM"],[85,37,"RW"],[50,17,"ST"]],
  "4-3-1-2": [[50,91,"GK"],[13,73,"LB"],[37,76,"CB1"],[63,76,"CB2"],[87,73,"RB"],[22,54,"CM1"],[50,58,"DM"],[78,54,"CM2"],[50,38,"CAM"],[35,20,"ST1"],[65,20,"ST2"]]
};
export function assignSlot(slots, target, playerId) {
  const next = {...slots};
  const old = Object.keys(next).find(k => next[k] === playerId);
  const displaced = next[target];
  if (old && old !== target) next[old] = displaced || undefined;
  next[target] = playerId;
  if (!playerId) delete next[target];
  return next;
}
export default function TacticalBuilder({ team, season, roster, allPlayers = [], comparison = [], balanceComparison = [], onEnsurePlayer, onDirtyChange }) {
  const [formation,setFormation] = useState("4-3-3");
  const [slots,setSlots] = useState({});
  const [slotPositions,setSlotPositions]=useState({});
  const pitchRef=useRef(null);
  const pointerRef=useRef(null);
  const ignoreClickRef=useRef(false);
  const [selected,setSelected] = useState(null);
  const [notice,setNotice] = useState("");
  const [bench,setBench] = useState([]);
  const [lineups,setLineups] = useState([]);
  const [activeId,setActiveId] = useState("");
  const [lineupName,setLineupName] = useState("Once ideal");
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [loadingSaved,setLoadingSaved] = useState(false);
  const [revision,setRevision] = useState(0);
  const [dirty,setDirty] = useState(false);
  useEffect(()=>{onDirtyChange?.(dirty)},[dirty,onDirtyChange]);
  const exportRef=useRef(null);
  const [logoError,setLogoError]=useState(false);
  useEffect(()=>setLogoError(false),[team.id,team.logo]);
  const [exporting,setExporting]=useState(false);
  const [pitchStyle,setPitchStyle]=useState("striped");
  const [pitchColor,setPitchColor]=useState("#164b35");
  const [showPhotos,setShowPhotos]=useState(true);
  const [showNumbers,setShowNumbers]=useState(true);
  const [showBenchExport,setShowBenchExport]=useState(true);
  const [exportError,setExportError]=useState("");
  const safeFilename = value => String(value||"once").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9-_]+/g,"-").replace(/^-|-$/g,"").slice(0,70) || "once";
  const exportPNG=async()=>{
    if(!exportRef.current||exporting)return;
    setExporting(true);setExportError("");
    try{
      const canvas=await html2canvas(exportRef.current,{backgroundColor:"#071c17",scale:Math.max(2,Math.min(3,window.devicePixelRatio||2)),useCORS:true,allowTaint:false,logging:false,imageTimeout:5000});
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/png"));
      if(!blob)throw new Error("El navegador no pudo generar el archivo.");
      const url=URL.createObjectURL(blob);
      const a=document.createElement("a");
      a.href=url;a.download=`${safeFilename(team.name)}-${safeFilename(season)}-${safeFilename(lineupName)}.png`;
      document.body.appendChild(a);a.click();a.remove();
      window.setTimeout(()=>URL.revokeObjectURL(url),1500);
    }catch(e){setExportError("No se pudo exportar el PNG. Comprueba si alguna foto externa bloquea la captura. "+(e.message||""))}
    finally{setExporting(false)}
  };
  const listRecords = async (entity, filter) => {
    const all = [];
    for(let skip=0;skip<=100000;skip+=200) {
      const page = await entity.filter(filter, undefined, 200, skip);
      const rows = Array.isArray(page) ? page : page?.data || [];
      all.push(...rows);
      if(rows.length<200) break;
    }
    return all;
  };
  useEffect(()=>{
    let live=true;
    setLoadingSaved(true);setError("");
    listRecords(base44.entities.TeamLineup,{team_type:"club",team_id:String(team.id),season}).then(rows=>{if(live)setLineups(rows)})
      .catch(e=>{if(live)setError(e.message || "No se pudieron cargar los onces")})
      .finally(()=>{if(live)setLoadingSaved(false)});
    return ()=>{live=false};
  },[team.id,season,revision]);
  const availableIds = new Set(roster.map(r=>String(r.player_id)));
  const markDirty = () => setDirty(true);
  const loadLineup = async id => {
    if(busy)return;
    if(dirty && !window.confirm("Hay cambios sin guardar. ¿Descartarlos?")) return;
    if(!id){setSlots({});setSlotPositions({});setBench([]);setActiveId("");setLineupName("Nuevo once");setDirty(false);return;}
    setBusy(true);setError("");
    try {
      const [savedSlots,savedBench] = await Promise.all([
        listRecords(base44.entities.TeamLineupSlot,{lineup_id:id}),
        listRecords(base44.entities.TeamLineupBench,{lineup_id:id})
      ]);
      const chosen=lineups.find(l=>l.id===id && l.season===season && String(l.team_id)===String(team.id));
      if(!chosen) throw new Error("No se encontró el once seleccionado");
      const newSlots={};
      const newPositions={};
      const validCodes=new Set((FORMATIONS[chosen.formation]||FORMATIONS["4-3-3"]).map(s=>s[2]));
      const assignedIds=new Set();
      for(const s of savedSlots.sort((a,b)=>String(a.created_date||"").localeCompare(String(b.created_date||"")))){
        const pid=String(s.player_id);
        if(validCodes.has(s.slot_code)&&availableIds.has(pid)&&!assignedIds.has(pid)){
          newSlots[s.slot_code]=pid;assignedIds.add(pid);
          if(Number.isFinite(Number(s.x_position))&&Number.isFinite(Number(s.y_position)))newPositions[s.slot_code]={x:Number(s.x_position),y:Number(s.y_position)};
        }
      }
      const occupied=new Set(Object.values(newSlots));
      const newBench=savedBench.sort((a,b)=>(a.bench_order??0)-(b.bench_order??0))
        .map(b=>String(b.player_id)).filter(pid=>availableIds.has(pid)&&!occupied.has(pid));
      setFormation(FORMATIONS[chosen.formation]?chosen.formation:"4-3-3");
      setSlots(newSlots);setSlotPositions(newPositions);setBench([...new Set(newBench)]);setActiveId(id);setLineupName(chosen.name);setDirty(false);setSelected(null);
      setNotice("Alineación recuperada.");
    }catch(e){setError(e.message||"No se pudo cargar el once")}
    finally{setBusy(false)}
  };
  const saveLineup = async () => {
    if(busy || loadingSaved)return;
    const name=lineupName.trim();
    if(!name){setError("Escribe un nombre para el once.");return;}
    if(!season.trim()){setError("La temporada es obligatoria.");return;}
    const slotRows=FORMATIONS[formation].filter(([,,code])=>slots[code]).map(([x,y,code],index)=>({
      player_id:slots[code],slot_code:code,x_position:slotPositions[code]?.x??x,y_position:slotPositions[code]?.y??y,display_order:index
    }));
    const ids=[...slotRows.map(s=>s.player_id),...bench];
    if(new Set(ids).size!==ids.length || ids.some(pid=>!availableIds.has(String(pid)))){
      setError("Hay jugadores duplicados o que ya no pertenecen a la plantilla.");return;
    }
    if(slotRows.length<11&&!window.confirm(`El once tiene ${slotRows.length}/11 titulares. ¿Guardarlo incompleto?`))return;
    if(activeId&&!window.confirm("¿Actualizar el once guardado con los cambios actuales?"))return;
    setBusy(true);setError("");
    let id=activeId;let created=false;
    try{
      if(!id){
        const entity=await base44.entities.TeamLineup.create({team_type:"club",team_id:String(team.id),season,name,formation,type:season==="2026/2027"?"custom":"historical",is_default:false});
        id=entity.id;created=true;
      }
      const oldSlots=created?[]:await listRecords(base44.entities.TeamLineupSlot,{lineup_id:id});
      const oldBench=created?[]:await listRecords(base44.entities.TeamLineupBench,{lineup_id:id});
      const inserted=[];
      try{
        for(const row of slotRows) inserted.push({type:"slot",record:await base44.entities.TeamLineupSlot.create({lineup_id:id,...row})});
        for(let i=0;i<bench.length;i++) inserted.push({type:"bench",record:await base44.entities.TeamLineupBench.create({lineup_id:id,player_id:bench[i],bench_order:i})});
      }catch(e){
        await Promise.allSettled(inserted.map(x=>x.type==="slot"?base44.entities.TeamLineupSlot.delete(x.record.id):base44.entities.TeamLineupBench.delete(x.record.id)));
        throw e;
      }
      // Reconcile only after all new children exist; leave a recoverable error if cleanup fails.
      // A partial write must never be reported as a successful save.
      await base44.entities.TeamLineup.update(id,{name,formation});
      const cleanup=await Promise.allSettled([
        ...oldSlots.map(r=>base44.entities.TeamLineupSlot.delete(r.id)),
        ...oldBench.map(r=>base44.entities.TeamLineupBench.delete(r.id))
      ]);
      if(cleanup.some(r=>r.status==="rejected"))throw new Error("La nueva versión se escribió, pero no se pudieron limpiar todos los registros anteriores. No vuelvas a guardar hasta revisar duplicados.");
      setActiveId(id);setDirty(false);setRevision(r=>r+1);setNotice("Once guardado correctamente.");
    }catch(e){
      setError("No se pudo completar el guardado: "+(e.message||"Error desconocido")+". Revisa el once antes de reintentarlo.");
    }finally{setBusy(false)}
  };
  const deleteLineup = async () => {
    if(busy)return;
    if(!activeId||!window.confirm("¿Eliminar definitivamente este once guardado? La plantilla y los jugadores no se borrarán."))return;
    setBusy(true);setError("");
    try{
      const [s,b]=await Promise.all([listRecords(base44.entities.TeamLineupSlot,{lineup_id:activeId}),listRecords(base44.entities.TeamLineupBench,{lineup_id:activeId})]);
      for(const r of s) await base44.entities.TeamLineupSlot.delete(r.id);
      for(const r of b) await base44.entities.TeamLineupBench.delete(r.id);
      await base44.entities.TeamLineup.delete(activeId);
      setActiveId("");setSlots({});setSlotPositions({});setBench([]);setLineupName("Nuevo once");setDirty(false);setRevision(r=>r+1);setNotice("Once eliminado.");
    }catch(e){setError(e.message||"No se pudo eliminar el once")}
    finally{setBusy(false)}
  };
  const toggleBench = id => {
    if(!id || busy || Object.values(slots).includes(String(id)))return;
    const pid=String(id);
    setBench(b=>b.includes(pid)?b.filter(v=>v!==pid):[...b,pid]);
    setDirty(true);
  };
  useEffect(() => { setSlots({}); setSlotPositions({});setBench([]); setActiveId(""); setDirty(false); setSelected(null); setNotice(""); },[team?.id,season]);
  const activeSlots = FORMATIONS[formation];
  const placed = useMemo(()=>activeSlots.filter(([,,code])=>slots[code]).map(([x,y,code])=>({
    player_id:slots[code],x:slotPositions[code]?.x??x,y:slotPositions[code]?.y??y,code
  })),[activeSlots,slots,slotPositions]);
  const assessment = useMemo(()=>analyzeLineup(placed,roster),[placed,roster]);
  const initialPosition=code=>{
    const entry=activeSlots.find(row=>row[2]===code);
    return slotPositions[code]||{x:entry?.[0]??50,y:entry?.[1]??50};
  };
  const pointerDown=(event,code)=>{
    if(busy || event.button!==0 || !pitchRef.current)return;
    const start=initialPosition(code);
    pointerRef.current={code,startX:event.clientX,startY:event.clientY,position:start,moved:false};
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const pointerMove=(event,code)=>{
    const drag=pointerRef.current;
    if(!drag || drag.code!==code || !pitchRef.current)return;
    const dx=event.clientX-drag.startX,dy=event.clientY-drag.startY;
    if(!drag.moved && Math.hypot(dx,dy)<7)return;
    drag.moved=true;
    const rect=pitchRef.current.getBoundingClientRect();
    const x=Math.max(8,Math.min(92,drag.position.x+dx/rect.width*100));
    const y=Math.max(10,Math.min(90,drag.position.y+dy/rect.height*100));
    setSlotPositions(prev=>({...prev,[code]:{x:Math.round(x*10)/10,y:Math.round(y*10)/10}}));
  };
  const pointerUp=(event,code)=>{
    const drag=pointerRef.current;
    if(!drag || drag.code!==code)return;
    if(drag.moved){markDirty();ignoreClickRef.current=true;}
    pointerRef.current=null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };
  const selectPosition=code=>{
    if(ignoreClickRef.current){ignoreClickRef.current=false;return;}
    setSelected(code);
  };
  const pickPlayer=async player=>{
    if(!selected||!player?.id)return;
    const alreadyInRoster=roster.some(r=>String(r.player_id)===String(player.id));
    if(!alreadyInRoster)await onEnsurePlayer(player);
    place(selected,String(player.id),!alreadyInRoster);
  };
  const restoreShape=()=>{setSlotPositions({});markDirty();setNotice("Posiciones originales restauradas. Los jugadores se mantienen.");};
  const place = (target,playerId,allowPending=false) => {
    if (busy || !target || !playerId || (!allowPending && !availableIds.has(String(playerId)))) return;
    const displaced = slots[target];
    setSlots(s => assignSlot(s,target,String(playerId)));
    setBench(b=>b.filter(id=>id!==String(playerId) && id!==String(displaced)));
    markDirty();
    setSelected(null);
    setNotice("");
  };
  const changeFormation = f => {
    const old = FORMATIONS[formation];
    const next = FORMATIONS[f];
    const players = old.map(s => slots[s[2]]).filter(Boolean);
    setSlots(Object.fromEntries(next.slice(0,players.length).map((s,i)=>[s[2],players[i]])));
    setFormation(f);setSlotPositions({});setSelected(null);markDirty();
    setNotice("Formación cambiada. Revisa las posiciones de los jugadores.");
  };
  return <section className="rounded-2xl border border-slate-200 bg-white p-2 sm:p-3 mt-1" aria-label="Constructor táctico">
    <div className="flex flex-wrap justify-between items-center gap-2 mb-2"><div><p className="text-xs font-bold tracking-wider text-blue-700">CONSTRUCTOR TÁCTICO</p><h3 className="text-xl font-extrabold">Arma tu once · {team.name}</h3><p className="text-xs text-slate-500">{dirty?"Cambios sin guardar":activeId?"Once guardado":"Nuevo once"}</p></div><button type="button" className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm" onClick={()=>{setSlots({});setSlotPositions({});setBench([]);setSelected(null);setNotice("");markDirty();}}><RotateCcw size={15}/> Vaciar campo</button></div>
    {exportError&&<p role="alert" className="mb-3 text-sm text-red-700">{exportError}</p>}
    {error&&<p role="alert" className="mb-3 text-sm text-red-700">{error}</p>}
    {notice&&<p role="status" className="mb-3 text-xs text-amber-700">{notice}</p>}
    <div className="flex flex-wrap items-center gap-2 mb-2"><span className="font-bold text-sm">Formación</span>{Object.keys(FORMATIONS).map(f=><button type="button" key={f} aria-pressed={f===formation} onClick={()=>changeFormation(f)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${formation===f?"bg-lime-400 text-slate-900":"bg-slate-100 hover:bg-slate-200"}`}>{f}</button>)}
      <button type="button" onClick={restoreShape} className="text-xs rounded-lg border px-2 py-1.5" title="Restaurar posiciones sin quitar jugadores">Restaurar forma</button>
      <button type="button" disabled={busy||loadingSaved} onClick={saveLineup} className="ml-auto flex items-center gap-1 rounded-lg bg-blue-700 px-3 py-1.5 text-sm font-semibold text-white"><Save size={15}/> Guardar once</button>
    </div>
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_270px] gap-3 min-h-0">
      <div className="min-w-0">
        <div ref={exportRef} className="rounded-2xl overflow-hidden bg-[#071c17] p-2 sm:p-3 text-white min-w-0">
          <div className="mb-2 flex items-center gap-2 px-2 pt-1 min-w-0">
            {team.logo&&!logoError?<img src={team.logo} alt={team.name} onError={()=>setLogoError(true)} className="w-9 h-9 sm:w-11 sm:h-11 object-contain flex-none"/>:<div className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg bg-white/10 flex items-center justify-center text-xs font-bold text-white">{team.short_name||team.name?.slice(0,3).toUpperCase()}</div>}
            <div className="min-w-0 flex-1"><p className="uppercase text-[10px] tracking-[.24em] text-lime-300 font-bold">MF LEGACY · TACTICAL XI</p><h4 className="font-black text-lg sm:text-2xl truncate">{team.name}</h4><p className="text-xs text-white/60">{lineupName} · {formation} · {season}</p></div>
            <span className="text-xs font-black text-lime-300 whitespace-nowrap">{Object.values(slots).filter(Boolean).length}/11</span>
          </div>
        <div ref={pitchRef} className="relative w-full overflow-hidden rounded-xl border-2 border-white/20 h-[min(53dvh,520px)] sm:h-[min(60dvh,600px)] xl:h-[min(60dvh,610px)]" style={{backgroundColor:pitchColor,backgroundImage:pitchStyle==="striped"?"repeating-linear-gradient(0deg,transparent 0%,transparent 10%,rgba(255,255,255,.055) 10%,rgba(255,255,255,.055) 20%)":pitchStyle==="diagonal"?"repeating-linear-gradient(135deg,transparent 0px,transparent 54px,rgba(255,255,255,.04) 54px,rgba(255,255,255,.04) 108px)":"none"}} aria-label="Campo de fútbol">
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none" fill="none" stroke="#ffffff" strokeOpacity=".23" strokeWidth=".65"><rect x="4" y="3" width="92" height="94" rx="2"/><path d="M4 50H96"/><ellipse cx="50" cy="50" rx="12" ry="9"/><path d="M31 3V18H69V3M40 3V9H60V3M31 97V82H69V97M40 97V91H60V97"/></svg>
          {activeSlots.map(([x,y,code])=>{const id=slots[code];const entry=roster.find(r=>String(r.player_id)===id);return <button type="button" key={code} aria-label={`${code}: ${entry?.player?.name||"vacío"}`} aria-pressed={selected===code} onPointerDown={e=>pointerDown(e,code)} onPointerMove={e=>pointerMove(e,code)} onPointerUp={e=>pointerUp(e,code)} onPointerCancel={()=>{pointerRef.current=null}} onClick={()=>selectPosition(code)} className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center w-[21%] sm:w-[18%] max-w-[125px] rounded-xl py-0.5 transition-all touch-none select-none cursor-grab active:cursor-grabbing ${selected===code?"bg-white/25 ring-2 ring-lime-400":"hover:bg-white/10"}`} style={{left:(slotPositions[code]?.x??x)+"%",top:(slotPositions[code]?.y??y)+"%"}}>
            <span className="relative flex w-12 h-12 sm:w-16 sm:h-16 xl:w-[72px] xl:h-[72px] rounded-full items-center justify-center border-[2.5px] border-lime-300 shadow-[0_5px_14px_rgba(0,0,0,.45)] bg-[#112c26] text-white font-bold text-sm overflow-hidden shrink-0">{showPhotos&&id?<PlayerPortrait player={entry?.player} className="w-full h-full object-cover" fallback={showNumbers?(entry?.shirt_number??"?"):"●"}/>:showNumbers?(entry?.shirt_number??"+"):(id?"●":"+ ")}</span>
            <span className="mt-0.5 text-[10px] sm:text-xs font-extrabold text-white text-center leading-tight w-full truncate drop-shadow-md bg-black/40 rounded px-1">{entry?.player?.name?.split(" ").slice(-1)[0] || code}</span>
          </button>})}
        </div>
          {showBenchExport&&bench.length>0&&<div className="pt-3 px-2 pb-2"><p className="text-[10px] uppercase tracking-widest text-lime-300 mb-2 font-bold">Banquillo · {bench.length}</p><div className="flex flex-wrap gap-2">{bench.map(pid=>{const m=roster.find(r=>String(r.player_id)===pid);return <span key={pid} className="rounded-full border border-white/20 bg-white/10 px-2 py-1 text-xs font-semibold">{showNumbers&&m?.shirt_number!=null?`${m.shirt_number} · `:""}{m?.player?.name||"Jugador"}</span>})}</div></div>}
        </div>
        <p className="mt-2 text-xs text-slate-500">Pulsa una posición para elegir jugador. Arrastra cualquier ficha con el dedo o ratón para moverla libremente.</p>
      </div>
      <aside className="hidden xl:block border rounded-xl p-3 min-w-0 h-[min(69dvh,670px)] overflow-y-auto">
        {selected?<PlayerPicker key={selected} selected={selected} roster={roster} allPlayers={allPlayers} onPick={pickPlayer} onClose={()=>setSelected(null)} busy={busy}/>:<BalancePanel assessment={assessment} comparison={comparison} balanceComparison={balanceComparison} season={season}/>}
      </aside>
    </div>
    {selected&&<div className="xl:hidden fixed inset-0 z-[100] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={()=>setSelected(null)}>
      <div role="dialog" aria-modal="true" aria-label="Seleccionar jugador" onClick={e=>e.stopPropagation()} className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl bg-white p-4 h-[min(79dvh,640px)] flex flex-col overflow-hidden shadow-xl">
        <PlayerPicker key={selected} selected={selected} roster={roster} allPlayers={allPlayers} onPick={pickPlayer} onClose={()=>setSelected(null)} busy={busy}/>
      </div>
    </div>}
    <div className="xl:hidden mt-2 rounded-xl border p-3"><BalancePanel assessment={assessment} comparison={comparison} balanceComparison={balanceComparison} season={season}/></div>
    <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3"><summary className="cursor-pointer text-sm font-bold">Opciones del once · Onces guardados, apariencia y exportación</summary><div className="mt-3">    <div className="flex flex-wrap gap-2 items-end mb-4">
      <label className="text-xs font-semibold flex-1 min-w-[160px]">Nombre del once<input value={lineupName} onChange={e=>{setLineupName(e.target.value);markDirty()}} maxLength={100} className="block w-full border rounded-lg px-3 py-2 text-sm mt-1"/></label>
      <label className="text-xs font-semibold flex-1 min-w-[160px]">Onces guardados<select aria-label="Seleccionar once guardado" value={activeId} disabled={busy||loadingSaved} onChange={e=>loadLineup(e.target.value)} className="block w-full border rounded-lg px-3 py-2 text-sm mt-1"><option value="">Nuevo once</option>{lineups.map(l=><option value={l.id} key={l.id}>{l.name} · {l.formation}</option>)}</select></label>
      {activeId&&<button type="button" disabled={busy} onClick={deleteLineup} className="flex items-center gap-2 border border-red-200 text-red-700 rounded-lg px-3 py-2 disabled:opacity-50"><Trash2 size={16}/> Eliminar</button>}
    </div>
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 mb-4 flex flex-wrap items-end gap-3" aria-label="Personalización del campo">
      <span className="flex items-center gap-2 font-semibold text-sm"><Palette size={17}/> Apariencia</span>
      <label className="text-xs font-medium">Césped<select value={pitchStyle} onChange={e=>setPitchStyle(e.target.value)} className="block mt-1 border rounded-md bg-white p-2"><option value="striped">Franjas</option><option value="solid">Liso</option><option value="diagonal">Diagonal</option></select></label>
      <label className="text-xs font-medium">Color<input type="color" aria-label="Color del césped" value={pitchColor} onChange={e=>setPitchColor(e.target.value)} className="block h-9 w-14 mt-1 rounded border cursor-pointer"/></label>
      <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={showPhotos} onChange={e=>setShowPhotos(e.target.checked)}/> Fotos</label>
      <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={showNumbers} onChange={e=>setShowNumbers(e.target.checked)}/> Dorsales</label>
      <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={showBenchExport} onChange={e=>setShowBenchExport(e.target.checked)}/> Suplentes en PNG</label>
      <button type="button" onClick={exportPNG} disabled={exporting} className="ml-auto flex items-center gap-2 bg-slate-900 text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"><Download size={16}/>{exporting?"Generando...":"Exportar PNG HD"}</button>
    </div>
    </div></details>
    <details className="mt-3 border-t pt-3"><summary className="cursor-pointer text-sm font-bold">Banquillo · {bench.length} suplentes</summary><div className="mt-2">
      <div className="flex justify-between items-center gap-2 mb-3"><h4 className="font-bold">Banquillo · {bench.length} suplentes</h4><span className="text-xs text-slate-500">Pulsa un jugador para añadirlo o retirarlo</span></div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {roster.filter(m=>!Object.values(slots).includes(String(m.player_id))).map(m=>{
          const isBench=bench.includes(String(m.player_id));
          return <button type="button" key={m.id} aria-pressed={isBench} onClick={()=>toggleBench(m.player_id)} className={`flex items-center gap-2 p-2 border rounded-lg text-left text-xs ${isBench?"border-lime-500 bg-lime-50":"hover:bg-slate-50"}`}>
            <PlayerPortrait player={m.player} className="w-8 h-8 object-cover rounded-full" />
            <span className="min-w-0 truncate font-semibold">{m.player?.name||"Jugador"} {isBench?"✓":""}</span>
          </button>;
        })}
      </div>
    </div></details>
  </section>;
}
