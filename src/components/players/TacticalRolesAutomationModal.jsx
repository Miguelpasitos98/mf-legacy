import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCheck, Loader2, ShieldCheck, Sparkles, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { PLAYER_DESCRIPTIONS } from "@/components/players/playerFormShared";
import { evaluateTacticalRoles, hasTacticalRole, needsTacticalRoles, TACTICAL_AUTO_VERSION } from "@/utils/tacticalRoleAutoAssign.mjs";
import { preferredFmAttributeEdition, fm27VisibleAttributes } from "@/utils/fmEditionAttributes.mjs";

const rows = value => Array.isArray(value) ? value : value?.data || value?.items || value?.entities || [];
const chunk = (list, size) => Array.from({length:Math.ceil(list.length/size)}, (_,i)=>list.slice(i*size,(i+1)*size));
const fm27ReplacementCandidate = player => hasTacticalRole(player) && preferredFmAttributeEdition(player)==="FM27" && !!fm27VisibleAttributes(player);
const midfieldReviewCandidate = player => hasTacticalRole(player) && ["CM","CDM"].includes(String(player?.position||"").toUpperCase());
const roleCandidate = player => needsTacticalRoles(player) || fm27ReplacementCandidate(player) || midfieldReviewCandidate(player);
const rolesSnapshot = player => JSON.stringify({roles:player?.tactical_roles||[],description:player?.description||""});

export default function TacticalRolesAutomationModal({ open, players=[], onClose }) {
  const queryClient = useQueryClient();
  const [seasonData,setSeasonData] = useState([]);
  const [loading,setLoading] = useState(false);
  const [saving,setSaving] = useState(false);
  const [selected,setSelected] = useState([]);
  const [progress,setProgress] = useState({done:0,total:0});
  const [notice,setNotice] = useState("");
  const [error,setError] = useState("");
  const [search,setSearch] = useState("");
  const candidates=useMemo(()=>players.filter(roleCandidate),[players]);
  const candidatesById=useMemo(()=>new Map(candidates.map(player=>[String(player.id),player])),[candidates]);
  const replacements=useMemo(()=>candidates.filter(fm27ReplacementCandidate),[candidates]);
  const byPlayer=useMemo(()=>{
    const map=new Map();
    for(const record of seasonData){
      if(!map.has(record.player_id))map.set(record.player_id,[]);
      map.get(record.player_id).push(record);
    }
    return map;
  },[seasonData]);
  const proposals=useMemo(()=>candidates.map(player=>evaluateTacticalRoles(player,byPlayer.get(player.id)||[],PLAYER_DESCRIPTIONS)),[candidates,byPlayer]);
  const eligible=useMemo(()=>proposals.filter(p=>p.status==="ready"),[proposals]);
  const listed=useMemo(()=>proposals.filter(p=>!search.trim()||String(p.name||"").toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es"))),[proposals,search]);

  useEffect(()=>{
    if(!open)return;
    let active=true;
    setError("");setNotice("");setSeasonData([]);setSearch("");setProgress({done:0,total:0});
    setLoading(true);
    (async()=>{
      // La base puede contener miles de jugadores. No bloqueamos toda la ventana
      // con una petición por cada 10 candidatos: los roles FM son evaluables al instante.
      // Enriquecemos con FotMob una muestra acotada en paralelo; el resto usa sus
      // atributos FM sin inventar estadísticas, y puede revisarse manualmente.
      const target=players.filter(roleCandidate).slice(0,100);
      const batches=chunk(target,25);
      const results=await Promise.allSettled(batches.map(batch=>
        Promise.race([
          base44.entities.PlayerSeasonStats.filter({player_id:{$in:batch.map(p=>p.id)}},"-minutes",200),
          new Promise((_,reject)=>setTimeout(()=>reject(new Error("Tiempo de espera FotMob agotado")),8000))
        ])
      ));
      if(active)setSeasonData(results.flatMap(result=>result.status==="fulfilled"?rows(result.value):[]));
    })().catch(caught=>{if(active){setError(caught.message);}})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[open]);

  useEffect(()=>{
    if(!open || loading)return;
    // Existing roles require explicit opt-in; empty roles remain selected by default.
    setSelected(eligible.filter(p=>!hasTacticalRole(candidatesById.get(String(p.player_id)))).map(p=>p.player_id));
  },[open,loading,eligible,candidatesById]);

  const toggle=(id)=>setSelected(current=>current.includes(id)?current.filter(x=>x!==id):[...current,id]);
  const apply=async()=>{
    if(saving||loading)return;
    const chosen=eligible.filter(p=>selected.includes(p.player_id));
    if(!chosen.length)return;
    setSaving(true);setError("");setNotice("");setProgress({done:0,total:chosen.length});
    const batchId="auto-roles-"+new Date().toISOString().replace(/[^0-9]/g,"").slice(0,14);
    let updated=0,protectedCount=0,failed=0;
    try{
      for(const [index,proposal] of chosen.entries()){
        try{
          const live=await base44.entities.Player.get(proposal.player_id);
          const original=candidatesById.get(String(proposal.player_id));
          const replacing=original && (fm27ReplacementCandidate(original) || midfieldReviewCandidate(original));
          if(!live || !original || String(live.name||"")!==proposal.name ||
            rolesSnapshot(live)!==rolesSnapshot(original) ||
            (replacing && !(midfieldReviewCandidate(live) || (fm27ReplacementCandidate(live) && proposal.edition==="FM27"))) ||
            (!replacing && hasTacticalRole(live))){
            protectedCount++;continue;
          }
          // Historial anterior a la modificación para poder revisar cada decisión.
          const audit=await base44.entities.TacticalRoleAutoAudit.create({
            batch_id:batchId,player_id:proposal.player_id,player_name:proposal.name,
            model_version:TACTICAL_AUTO_VERSION,source_position:proposal.position,
            confidence:proposal.confidence,original_roles:live.tactical_roles||[],
            original_description:live.description||"",proposed_roles:proposal.roles,
            evidence:{edition:proposal.edition,replaces_existing_roles:!!replacing,season:proposal.season,scores:proposal.scores.map(s=>({name:s.name,score:s.score,attributes:s.details.slice(0,5)}))},
            status:"proposed",created_at:new Date().toISOString()
          });
          await base44.entities.Player.update(proposal.player_id,{
            tactical_roles:proposal.roles,description:proposal.roles[0].name
          });
          const verified=await base44.entities.Player.get(proposal.player_id);
          if(JSON.stringify(verified?.tactical_roles)!==JSON.stringify(proposal.roles))throw Error("La verificación posterior no coincide");
          await base44.entities.TacticalRoleAutoAudit.update(audit.id,{status:"applied"});
          updated++;
        }catch(caught){
          failed++;setError(current=>current||"Algunos jugadores no pudieron guardarse: "+caught.message);
        }finally{setProgress({done:index+1,total:chosen.length});}
      }
      await queryClient.invalidateQueries({queryKey:["mf-legacy","Player"]});
      setNotice(updated+" jugadores adjudicados y verificados · "+protectedCount+" protegidos · "+failed+" errores. La base FM26/FM27 y las estadísticas FotMob no se han modificado.");
    }finally{setSaving(false);}
  };

  if(!open||typeof document==="undefined")return null;
  const selectedCount=eligible.filter(p=>selected.includes(p.player_id)).length;
  return createPortal(<div className="fixed inset-0 z-[230] flex items-center justify-center bg-slate-950/60 p-3 md:p-6" onMouseDown={event=>{if(event.target===event.currentTarget&&!saving)onClose();}}>
    <section role="dialog" aria-modal="true" aria-label="Asignación automática de roles tácticos" className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
      <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-black text-[#0d315b]"><Sparkles size={20}/> Adjudicación automática de roles</h2>
          <p className="mt-1 text-xs text-slate-600">Las propuestas se basan en atributos FM y, cuando estén disponibles, estadísticas FotMob. Los roles anteriores requieren selección expresa y quedan en auditoría.</p>
        </div>
        <button type="button" aria-label="Cerrar" onClick={onClose} disabled={saving} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-40"><X size={19}/></button>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-lg bg-blue-50 px-3 py-2 font-bold text-[#003399]">{candidates.filter(p=>!hasTacticalRole(p)).length} sin roles</span>
          <span className="rounded-lg bg-amber-50 px-3 py-2 font-bold text-amber-800">{candidates.filter(p=>hasTacticalRole(p)).length} con roles anteriores para revisar (MC/MCD y FM27)</span>
          <span className="rounded-lg bg-emerald-50 px-3 py-2 font-bold text-emerald-700">{eligible.length} evaluables</span>
          <span className="rounded-lg bg-amber-50 px-3 py-2 font-bold text-amber-800">{proposals.length-eligible.length} sin suficientes datos</span>
          {loading&&<span className="flex items-center gap-1 text-slate-500"><Loader2 size={13} className="animate-spin"/> Comprobando FotMob (máx. 100 candidatos)…</span>}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Buscar jugador…" aria-label="Filtrar jugadores sin rol"
            className="min-w-[190px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#003399]"/>
          <button type="button" disabled={saving} onClick={()=>setSelected(eligible.map(p=>p.player_id))} className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-[#003399]">Seleccionar todos (incluye reemplazos)</button>
          <button type="button" disabled={saving} onClick={()=>setSelected([])} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-500">Deseleccionar</button>
        </div>
        {!proposals.length&&<p className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">No hay jugadores pendientes de evaluar ni perfiles FM27 con roles anteriores.</p>}
        {candidates.some(p=>hasTacticalRole(p))&&<p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Los perfiles con roles existentes permanecen desmarcados. Revisa cada propuesta antes de reemplazar los roles; se guardará una copia anterior en la auditoría.</p>}
        <div className="max-h-[52vh] overflow-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[740px] text-left text-xs">
            <thead className="sticky top-0 bg-slate-50 font-bold text-slate-600"><tr>
              <th className="px-3 py-3">Elegir</th><th className="px-3 py-3">Jugador</th><th className="px-3 py-3">Rol 1 · principal</th><th className="px-3 py-3">Rol 2 · complementario</th><th className="px-3 py-3">Fundamento</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">{listed.map(row=><tr key={row.player_id||row.name} className="align-top">
              <td className="px-3 py-3"><input type="checkbox" aria-label={"Seleccionar "+(row.name||"jugador")} checked={selected.includes(row.player_id)} disabled={saving||row.status!=="ready"} onChange={()=>toggle(row.player_id)}/></td>
              <td className="px-3 py-3"><strong>{row.name||"Ficha sin evaluar"}</strong><p className="mt-1 text-[11px] text-slate-500">{row.position||"—"} · {row.edition||"FM"} · {row.confidence?("Confianza "+row.confidence):"Revisión manual"}</p>{hasTacticalRole(candidatesById.get(String(row.player_id)))&&<p className="mt-1 text-[11px] font-semibold text-amber-700">Sustituir roles actuales: {(candidatesById.get(String(row.player_id))?.tactical_roles||[]).map(r=>r.name).filter(Boolean).join(" / ")||candidatesById.get(String(row.player_id))?.description}</p>}</td>
              <td className="px-3 py-3"><strong>{row.roles?.[0]?.name||"—"}</strong><p className="mt-1 max-w-xs text-[11px] leading-4 text-slate-500">{row.roles?.[0]?.description||""}</p></td>
              <td className="px-3 py-3"><strong>{row.roles?.[1]?.name||"—"}</strong><p className="mt-1 max-w-xs text-[11px] leading-4 text-slate-500">{row.roles?.[1]?.description||""}</p></td>
              <td className="px-3 py-3 text-[11px] text-slate-600">{row.season?"FM + FotMob "+row.season.season+" ("+row.season.minutes+" min)":"Atributos FM"}{row.reason&&<p className="text-amber-700">{row.reason}</p>}</td>
            </tr>)}</tbody>
          </table>
        </div>
        {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-800">{error}</p>}
        {notice&&<p role="status" className="rounded-lg bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">{notice}</p>}
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4">
        <p className="flex items-center gap-2 text-xs text-slate-500"><ShieldCheck size={15}/> {saving?progress.done+" / "+progress.total:"Solo roles y descripción principal"} · Registro auditable</p>
        <div className="flex gap-2">
          <button type="button" disabled={saving} onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold">Cerrar</button>
          <button type="button" onClick={apply} disabled={loading||saving||selectedCount===0}
            className="flex items-center gap-2 rounded-lg bg-[#003399] px-4 py-2 text-xs font-extrabold text-white disabled:opacity-40">
            {saving?<Loader2 size={15} className="animate-spin"/>:<CheckCheck size={15}/>}
            {saving?"Aplicando "+progress.done+"/"+progress.total:"Adjudicar "+selectedCount+" jugadores"}
          </button>
        </div>
      </footer>
    </section>
  </div>,document.body);
}
