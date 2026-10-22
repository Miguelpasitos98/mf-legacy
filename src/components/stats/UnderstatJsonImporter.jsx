import React,{useState} from "react";
import {base44} from "@/api/base44Client";

// Understat is a team-season source. Never require a FotMob competition row.
const txt=v=>String(v??"").trim();
const norm=v=>txt(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,"");
const unpack=v=>Array.isArray(v)?v:v?.items||v?.data||v?.results||[];
const number=v=>{
 if(v===undefined||v===null||v==="")return null;
 const n=Number(String(v).replace(",","."));
 return Number.isFinite(n)&&n>=0&&n<=10000?n:NaN;
};
const isBlank=v=>v===null||v===undefined||v==="";
const FIELDS=["xg_chain_p90","xg_buildup_p90","xg_total","xa_total"];

export default function UnderstatJsonImporter({player,fotmobPlayerId,stats=[],onSaved,onBusyChange}){
 const [raw,setRaw]=useState("");
 const [rows,setRows]=useState([]);
 const [chosen,setChosen]=useState(new Set());
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");
 const playerId=txt(player?.id||stats.find(r=>r.player_id)?.player_id);

 async function analyze(){
  setRows([]);setChosen(new Set());setError("");setMessage("");
  setBusy(true);onBusyChange?.(true);
  try{
   const data=JSON.parse(raw);
   if(data.schema!=="mf_legacy_understat_per90_import_v1")throw Error("Schema Understat /90 incorrecto.");
   if(!playerId)throw Error("Falta el identificador interno del jugador.");
   const expected=txt(fotmobPlayerId),given=txt(data.player?.fotmob_id);
   if(!expected)throw Error("El jugador abierto no tiene un ID FotMob vinculado.");
   if(given&&given!==expected)throw Error("El ID FotMob del JSON no coincide con el jugador abierto.");
   if(!given&&norm(data.player?.name)!==norm(player?.name||stats.find(r=>r.player_name)?.player_name))throw Error("El nombre del jugador no coincide.");
   if(!Array.isArray(data.records)||!data.records.length||data.records.length>500)throw Error("Se necesitan entre 1 y 500 filas.");
   // Existing provider records are loaded independently of league/cup FotMob rows.
   const existing=unpack(await base44.entities.UnderstatSeasonRate.filter({player_id:playerId},{limit:1000}));
   const seen=new Set();
   const result=data.records.map((r,i)=>{
    const season=txt(r.season),team=txt(r.team),teamKey=norm(team);
    const issues=[],id=season+"|"+teamKey;
    if(!/^\d{4}\/\d{4}$/.test(season)||Number(season.slice(5))!==Number(season.slice(0,4))+1)issues.push("Temporada inválida.");
    if(!teamKey)issues.push("Equipo obligatorio.");
    if(seen.has(id))issues.push("Equipo y temporada duplicados.");seen.add(id);
    const incoming={xg_chain_p90:number(r.xg_chain_p90),xg_buildup_p90:number(r.xg_buildup_p90),xg_total:number(r.xg_total??r.xg),xa_total:number(r.xa_total??r.xa)};
    if(FIELDS.some(f=>Number.isNaN(incoming[f])))issues.push("Valores numéricos inválidos.");
    if(FIELDS.every(f=>incoming[f]===null))issues.push("Fila sin métricas.");
    if(incoming.xg_chain_p90!==null&&incoming.xg_buildup_p90!==null&&incoming.xg_buildup_p90>incoming.xg_chain_p90)issues.push("Buildup supera Chain.");
    const matches=existing.filter(e=>txt(e.season)===season&&norm(e.team_key||e.team)===teamKey);
    if(matches.length>1)issues.push("Hay varios registros Understat para este equipo y temporada; revisa los duplicados.");
    const old=matches[0]||null;
    const changes=FIELDS.filter(f=>incoming[f]!==null&&isBlank(old?.[f]));
    const status=issues.length?"error":changes.length?(old?"update":"new"):"same";
    return {id:i,season,team,teamKey,incoming,old,changes,issues,status};
   });
   setRows(result);setChosen(new Set(result.filter(r=>r.status==="new"||r.status==="update").map(r=>r.id)));
   setMessage("Datos Understat asociados a jugador, temporada y equipo. No se exige ni crea una liga.");
  }catch(e){setError(e.message||"No se pudo analizar el JSON.");}
  finally{setBusy(false);onBusyChange?.(false);}
 }
 async function save(){
  const selected=rows.filter(r=>chosen.has(r.id)&&["new","update"].includes(r.status));
  if(!selected.length||busy)return;
  setBusy(true);onBusyChange?.(true);setError("");setMessage("");
  let saved=0;
  try{
   for(const row of selected){
    const current=unpack(await base44.entities.UnderstatSeasonRate.filter({player_id:playerId,season:row.season},{limit:1000})).filter(e=>norm(e.team_key||e.team)===row.teamKey);
    if(current.length>1)throw Error("Duplicados existentes: "+row.season+" "+row.team);
    const existing=current[0];
    const updates=Object.fromEntries(FIELDS.filter(f=>row.incoming[f]!==null&&isBlank(existing?.[f])).map(f=>[f,row.incoming[f]]));
    if(!Object.keys(updates).length)continue;
    if(existing){
     await base44.entities.UnderstatSeasonRate.update(existing.id,updates);
    }else{
     await base44.entities.UnderstatSeasonRate.create({player_id:playerId,fotmob_player_id:txt(fotmobPlayerId),season:row.season,team:row.team,team_key:row.teamKey,source:"Understat",source_scope:"Understat table; not all competitions",...updates});
    }
    saved++;
   }
   setMessage(saved+" registros guardados en UnderstatSeasonRate. No se han alterado competiciones ni métricas FotMob.");
   setRows([]);setChosen(new Set());onSaved?.({refresh:true});
  }catch(e){setError("Guardados "+saved+" registros antes del error: "+(e.message||"Error")+". Vuelve a analizar antes de repetir.");setRows([]);setChosen(new Set());if(saved)onSaved?.({refresh:true});}
  finally{setBusy(false);onBusyChange?.(false);}
 }
 const selectable=rows.filter(r=>r.status==="new"||r.status==="update");
 return <div className="space-y-3">
  <p className="rounded-lg bg-blue-50 p-3 text-xs text-blue-900">Importación Understat independiente por jugador, temporada y equipo. No necesita que exista LaLiga en FotMob, no reparte métricas por competición y nunca sobrescribe datos existentes.</p>
  <label className="block text-xs font-bold">Pegar JSON Understat
   <textarea value={raw} disabled={busy} onChange={e=>{setRaw(e.target.value);setRows([]);setChosen(new Set());setError("");setMessage("");}} className="mt-2 h-44 w-full rounded border p-3 font-mono text-xs" spellCheck={false}/>
  </label>
  <div className="flex gap-2"><button disabled={busy||!raw.trim()} onClick={analyze} className="rounded-lg bg-[#003399] px-4 py-2 text-xs font-bold text-white disabled:opacity-40">Analizar JSON</button><button disabled={busy} onClick={()=>{setRaw("");setRows([]);setChosen(new Set());setError("");setMessage("");}} className="rounded border px-3 py-2 text-xs">Limpiar</button></div>
  {error&&<p role="alert" className="rounded bg-red-50 p-3 text-xs text-red-800">{error}</p>}
  {message&&<p role="status" className="rounded bg-blue-50 p-3 text-xs text-blue-800">{message}</p>}
  {!!rows.length&&<>
   <p className="text-xs text-slate-600">{rows.length} filas · {rows.filter(r=>r.status==="error").length} errores · {selectable.length} disponibles</p>
   <div className="flex gap-2"><button disabled={busy||!selectable.length} onClick={()=>setChosen(new Set(selectable.map(r=>r.id)))} className="rounded border px-3 py-2 text-xs disabled:opacity-40">Seleccionar todos</button><button disabled={busy||!chosen.size} onClick={()=>setChosen(new Set())} className="rounded border px-3 py-2 text-xs disabled:opacity-40">Deseleccionar todos</button></div>
   <div className="max-h-72 overflow-auto rounded border">{rows.map(r=><label key={r.id} className="flex gap-2 border-b p-3 text-xs"><input type="checkbox" disabled={busy||!["new","update"].includes(r.status)} checked={chosen.has(r.id)} onChange={e=>setChosen(prev=>{const copy=new Set(prev);if(e.target.checked)copy.add(r.id);else copy.delete(r.id);return copy;})}/><span><strong>{r.season} · {r.team}</strong> · {r.status==="new"?"Nuevo":r.status==="update"?"Completar":r.status==="same"?"Sin cambios":"Error"}<span className="block">Chain /90: {r.incoming.xg_chain_p90??"—"} · Buildup /90: {r.incoming.xg_buildup_p90??"—"} · {r.changes.length} campos nuevos</span>{r.issues.map((i,n)=><span key={n} className="block text-red-700">{i}</span>)}</span></label>)}</div>
   <button disabled={busy||!chosen.size} onClick={save} className="rounded-lg bg-[#003399] px-4 py-2 text-xs font-bold text-white disabled:opacity-40">Guardar {chosen.size} registros</button>
  </>}
 </div>;
}
