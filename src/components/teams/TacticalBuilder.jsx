import React, { useEffect, useState } from "react";
import { RotateCcw, X, Save, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

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
export default function TacticalBuilder({ team, season, roster }) {
  const [formation,setFormation] = useState("4-3-3");
  const [slots,setSlots] = useState({});
  const [selected,setSelected] = useState(null);
  const [search,setSearch] = useState("");
  const [dragged,setDragged] = useState(null);
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
  const listRecords = async (entity, filter) => {
    const all = [];
    for(let skip=0;skip<=10000;skip+=200) {
      const page = await entity.filter(filter, undefined, 200, skip);
      const rows = Array.isArray(page) ? page : page?.data || [];
      all.push(...rows);
      if(rows.length<200) break;
    }
    return all;
  };
  useEffect(()=>{
    let live=true;
    setLoadingSaved(true);setError("");setActiveId("");setLineups([]);
    listRecords(base44.entities.TeamLineup,{team_type:"club",team_id:String(team.id),season}).then(rows=>{if(live)setLineups(rows)})
      .catch(e=>{if(live)setError(e.message || "No se pudieron cargar los onces")})
      .finally(()=>{if(live)setLoadingSaved(false)});
    return ()=>{live=false};
  },[team.id,season,revision]);
  const availableIds = new Set(roster.map(r=>String(r.player_id)));
  const markDirty = () => setDirty(true);
  const loadLineup = async id => {
    if(dirty && !window.confirm("Hay cambios sin guardar. ¿Descartarlos?")) return;
    if(!id){setSlots({});setBench([]);setActiveId("");setLineupName("Nuevo once");setDirty(false);return;}
    setBusy(true);setError("");
    try {
      const [savedSlots,savedBench] = await Promise.all([
        listRecords(base44.entities.TeamLineupSlot,{lineup_id:id}),
        listRecords(base44.entities.TeamLineupBench,{lineup_id:id})
      ]);
      const chosen=lineups.find(l=>l.id===id);
      if(!chosen) throw new Error("No se encontró el once seleccionado");
      const newSlots={};
      for(const s of savedSlots) if(availableIds.has(String(s.player_id))) newSlots[s.slot_code]=String(s.player_id);
      const occupied=new Set(Object.values(newSlots));
      const newBench=savedBench.sort((a,b)=>(a.bench_order??0)-(b.bench_order??0))
        .map(b=>String(b.player_id)).filter(pid=>availableIds.has(pid)&&!occupied.has(pid));
      setFormation(FORMATIONS[chosen.formation]?chosen.formation:"4-3-3");
      setSlots(newSlots);setBench([...new Set(newBench)]);setActiveId(id);setLineupName(chosen.name);setDirty(false);setSelected(null);
      setNotice("Alineación recuperada.");
    }catch(e){setError(e.message||"No se pudo cargar el once")}
    finally{setBusy(false)}
  };
  const saveLineup = async () => {
    const name=lineupName.trim();
    if(!name){setError("Escribe un nombre para el once.");return;}
    if(!season.trim()){setError("La temporada es obligatoria.");return;}
    const slotRows=FORMATIONS[formation].filter(([,,code])=>slots[code]).map(([x,y,code],index)=>({
      player_id:slots[code],slot_code:code,x_position:x,y_position:y,display_order:index
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
        const entity=await base44.entities.TeamLineup.create({team_type:"club",team_id:String(team.id),season,name,formation,type:"custom",is_default:false});
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
      for(const r of oldSlots) await base44.entities.TeamLineupSlot.delete(r.id);
      for(const r of oldBench) await base44.entities.TeamLineupBench.delete(r.id);
      await base44.entities.TeamLineup.update(id,{name,formation});
      setActiveId(id);setDirty(false);setRevision(r=>r+1);setNotice("Once guardado correctamente.");
    }catch(e){
      setError("No se pudo completar el guardado: "+(e.message||"Error desconocido")+". Revisa el once antes de reintentarlo.");
    }finally{setBusy(false)}
  };
  const deleteLineup = async () => {
    if(!activeId||!window.confirm("¿Eliminar definitivamente este once guardado? La plantilla y los jugadores no se borrarán."))return;
    setBusy(true);setError("");
    try{
      const [s,b]=await Promise.all([listRecords(base44.entities.TeamLineupSlot,{lineup_id:activeId}),listRecords(base44.entities.TeamLineupBench,{lineup_id:activeId})]);
      for(const r of s) await base44.entities.TeamLineupSlot.delete(r.id);
      for(const r of b) await base44.entities.TeamLineupBench.delete(r.id);
      await base44.entities.TeamLineup.delete(activeId);
      setActiveId("");setSlots({});setBench([]);setLineupName("Nuevo once");setDirty(false);setRevision(r=>r+1);setNotice("Once eliminado.");
    }catch(e){setError(e.message||"No se pudo eliminar el once")}
    finally{setBusy(false)}
  };
  const toggleBench = id => {
    if(!id)return;
    const pid=String(id);
    setBench(b=>b.includes(pid)?b.filter(v=>v!==pid):[...b,pid]);
    setDirty(true);
  };
  useEffect(() => { setSlots({}); setBench([]); setActiveId(""); setDirty(false); setSelected(null); setNotice(""); },[team?.id,season]);
  const activeSlots = FORMATIONS[formation];
  const used = new Set([...Object.values(slots).filter(Boolean),...bench]);
  const available = roster.filter(r => !used.has(String(r.player_id)) && r.player?.name?.toLowerCase().includes(search.toLowerCase()));
  const place = (target,playerId) => {
    if (!target || !playerId) return;
    setSlots(s => assignSlot(s,target,String(playerId)));
    setBench(b=>b.filter(id=>id!==String(playerId)));
    markDirty();
    setSelected(null);
    setNotice("");
  };
  const changeFormation = f => {
    const old = FORMATIONS[formation];
    const next = FORMATIONS[f];
    const players = old.map(s => slots[s[2]]).filter(Boolean);
    setSlots(Object.fromEntries(next.slice(0,players.length).map((s,i)=>[s[2],players[i]])));
    setFormation(f);setSelected(null);markDirty();
    setNotice("Formación cambiada. Revisa las posiciones de los jugadores.");
  };
  return <section className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-5 mt-6" aria-label="Constructor táctico">
    <div className="flex flex-wrap justify-between items-center gap-3 mb-4"><div><p className="text-xs font-bold tracking-wider text-blue-700">CONSTRUCTOR TÁCTICO</p><h3 className="text-xl font-extrabold">Arma tu once · {team.name}</h3><p className="text-xs text-slate-500">{dirty?"Cambios sin guardar":activeId?"Once guardado":"Nuevo once"}</p></div><button type="button" className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm" onClick={()=>{setSlots({});setBench([]);setSelected(null);setNotice("");markDirty();}}><RotateCcw size={15}/> Vaciar campo</button></div>
    <div className="flex gap-2 flex-wrap mb-4" aria-label="Elegir formación">{Object.keys(FORMATIONS).map(f=><button type="button" key={f} aria-pressed={f===formation} onClick={()=>changeFormation(f)} className={`rounded-full px-4 py-2 text-sm font-semibold ${f===formation?"bg-lime-400 text-slate-900":"bg-slate-100 hover:bg-slate-200"}`}>{f}</button>)}</div>
    <div className="flex flex-wrap gap-2 items-end mb-4">
      <label className="text-xs font-semibold flex-1 min-w-[160px]">Nombre del once<input value={lineupName} onChange={e=>{setLineupName(e.target.value);markDirty()}} maxLength={100} className="block w-full border rounded-lg px-3 py-2 text-sm mt-1"/></label>
      <label className="text-xs font-semibold flex-1 min-w-[160px]">Onces guardados<select aria-label="Seleccionar once guardado" value={activeId} disabled={busy||loadingSaved} onChange={e=>loadLineup(e.target.value)} className="block w-full border rounded-lg px-3 py-2 text-sm mt-1"><option value="">Nuevo once</option>{lineups.map(l=><option value={l.id} key={l.id}>{l.name} · {l.formation}</option>)}</select></label>
      <button type="button" disabled={busy} onClick={saveLineup} className="flex items-center gap-2 bg-blue-700 text-white rounded-lg px-4 py-2 disabled:opacity-50"><Save size={16}/> Guardar</button>
      {activeId&&<button type="button" disabled={busy} onClick={deleteLineup} className="flex items-center gap-2 border border-red-200 text-red-700 rounded-lg px-3 py-2 disabled:opacity-50"><Trash2 size={16}/> Eliminar</button>}
    </div>
    {error&&<p role="alert" className="mb-3 text-sm text-red-700">{error}</p>}
    {notice&&<p role="status" className="mb-3 text-xs text-amber-700">{notice}</p>}
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_250px] gap-4">
      <div className="min-w-0">
        <div className="relative w-full overflow-hidden rounded-2xl border-4 border-emerald-900 bg-[#174c36] aspect-[.78] sm:aspect-[1.15] lg:aspect-[1.3]" aria-label="Campo de fútbol">
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none" fill="none" stroke="#ffffff" strokeOpacity=".23" strokeWidth=".65"><rect x="4" y="3" width="92" height="94" rx="2"/><path d="M4 50H96"/><ellipse cx="50" cy="50" rx="12" ry="9"/><path d="M31 3V18H69V3M40 3V9H60V3M31 97V82H69V97M40 97V91H60V97"/></svg>
          {activeSlots.map(([x,y,code])=>{const id=slots[code];const entry=roster.find(r=>String(r.player_id)===id);return <button type="button" key={code} aria-label={`${code}: ${entry?.player?.name||"vacío"}`} aria-pressed={selected===code} draggable={Boolean(id)} onDragStart={e=>{if(!id){e.preventDefault();return;}setDragged(id);e.dataTransfer.setData("text/plain",id);}} onDragEnd={()=>setDragged(null)} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();place(code,e.dataTransfer.getData("text/plain")||dragged);setDragged(null)}} onClick={()=>setSelected(code)} className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center w-[19%] sm:w-[17%] max-w-[96px] rounded-xl py-1 transition-all ${selected===code?"bg-white/25 ring-2 ring-lime-400":"hover:bg-white/10"}`} style={{left:x+"%",top:y+"%"}}>
            <span className="relative flex w-9 h-9 sm:w-12 sm:h-12 rounded-full items-center justify-center border-2 border-lime-400 bg-[#112c26] text-white font-bold text-xs overflow-hidden">{entry?.player?.card_photo_url||entry?.player?.photo_url?<img src={entry.player.card_photo_url||entry.player.photo_url} alt="" className="w-full h-full object-cover"/>:entry?.shirt_number??"+"}</span>
            <span className="text-[10px] sm:text-xs font-extrabold text-white text-center leading-tight w-full truncate drop-shadow-md">{entry?.player?.name?.split(" ").slice(-1)[0] || code}</span>
          </button>})}
        </div>
        <p className="mt-2 text-xs text-slate-500">Toca una posición y después un jugador. En ordenador también puedes arrastrar futbolistas entre posiciones.</p>
      </div>
      <aside className="border rounded-xl p-3 min-w-0"><div className="flex items-center justify-between gap-2"><h4 className="font-bold">Seleccionar jugador</h4><span className="text-xs font-bold text-blue-700">{used.size}/11</span></div><p className="text-xs text-slate-500 mt-1 mb-3">{selected?`Posición elegida: ${selected}`:"Selecciona una posición en el campo"}</p>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Filtrar plantilla..." aria-label="Buscar en la plantilla" className="w-full rounded-lg border px-3 py-2 text-sm mb-3"/>
        {selected&&slots[selected]&&<button type="button" onClick={()=>{setSlots(s=>{const n={...s};delete n[selected];return n});setSelected(null);markDirty()}} className="w-full flex items-center gap-2 p-2 text-sm text-red-600 border rounded-lg mb-2"><X size={14}/> Quitar de la posición</button>}
        <div className="space-y-1 max-h-[470px] overflow-auto">{available.map(m=><button type="button" disabled={!selected} draggable onDragStart={e=>{setDragged(String(m.player_id));e.dataTransfer.setData("text/plain",String(m.player_id))}} onDragEnd={()=>setDragged(null)} onClick={()=>place(selected,m.player_id)} key={m.id} className="flex gap-2 items-center w-full text-left rounded-lg p-2 hover:bg-blue-50 disabled:opacity-60"><span className="w-9 h-9 flex-shrink-0 rounded-full overflow-hidden bg-slate-200">{m.player?.photo_url&&<img src={m.player.card_photo_url||m.player.photo_url} alt="" className="w-full h-full object-cover"/>}</span><span className="min-w-0"><span className="block text-sm font-semibold truncate">{m.player?.name||"Jugador"}</span><span className="block text-xs text-slate-500">{m.primary_position||m.player?.position||"—"}</span></span></button>)}{!available.length&&<p className="text-sm text-slate-500 p-3">No hay jugadores disponibles.</p>}</div>
      </aside>
    </div>
    <div className="mt-5 border-t pt-4">
      <div className="flex justify-between items-center gap-2 mb-3"><h4 className="font-bold">Banquillo · {bench.length} suplentes</h4><span className="text-xs text-slate-500">Pulsa un jugador para añadirlo o retirarlo</span></div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {roster.filter(m=>!Object.values(slots).includes(String(m.player_id))).map(m=>{
          const isBench=bench.includes(String(m.player_id));
          return <button type="button" key={m.id} aria-pressed={isBench} onClick={()=>toggleBench(m.player_id)} className={`flex items-center gap-2 p-2 border rounded-lg text-left text-xs ${isBench?"border-lime-500 bg-lime-50":"hover:bg-slate-50"}`}>
            {m.player?.photo_url||m.player?.card_photo_url?<img src={m.player.card_photo_url||m.player.photo_url} alt="" className="w-8 h-8 object-cover rounded-full"/>:<span className="w-8 h-8 rounded-full bg-slate-200"/>}
            <span className="min-w-0 truncate font-semibold">{m.player?.name||"Jugador"} {isBench?"✓":""}</span>
          </button>;
        })}
      </div>
    </div>
  </section>;
}
