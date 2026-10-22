import React,{useMemo,useState} from "react";
import {base44} from "@/api/base44Client";
import {applyManualStatChanges} from "@/utils/manualStats";
import {metricName} from "@/utils/compositeEngine";

const txt=v=>String(v??"").trim();
const key=v=>txt(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,"");
const valueOf=(row,name)=>(row.metrics||[]).find(m=>metricName(m.name)===metricName(name))?.value;
const rate=v=>{
 if(v===null||v===undefined||v==="")return null;
 const n=Number(String(v).replace(",","."));
 if(!Number.isFinite(n)||n<0||n>100)return NaN;
 return n;
};
const unpack=v=>Array.isArray(v)?v:v?.items||v?.data||[];
export default function UnderstatJsonImporter({player,fotmobPlayerId,stats=[],onSaved,onBusyChange}){
 const [raw,setRaw]=useState("");
 const [rows,setRows]=useState([]);
 const [chosen,setChosen]=useState(new Set());
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");
 const [busy,setBusy]=useState(false);
 const playerId=txt(player?.id||stats.find(r=>r.player_id)?.player_id);
 const matching=useMemo(()=>stats.filter(r=>r.id&&txt(r.player_id)===playerId),[stats,playerId]);
 const analyze=()=>{
  setRows([]);setChosen(new Set());setError("");setMessage("");
  try{
   const data=JSON.parse(raw);
   if(data.schema!=="mf_legacy_understat_per90_import_v1")throw Error("Esquema no compatible con Understat /90.");
   const given=txt(data.player?.fotmob_id),expected=txt(fotmobPlayerId);
   if(!expected)throw Error("La ficha del jugador no tiene ID FotMob verificado. Vincúlalo antes de importar.");
   if(given&&given!==expected)throw Error("El ID FotMob del JSON no coincide con el jugador abierto.");
   if(!given&&key(data.player?.name)!==key(player?.name||stats.find(r=>r.player_name)?.player_name))throw Error("Sin ID FotMob en el JSON, el nombre debe coincidir con el jugador abierto.");
   if(!playerId)throw Error("El jugador no tiene ID de Base44.");
   if(!Array.isArray(data.records)||!data.records.length||data.records.length>500)throw Error("El JSON debe contener entre 1 y 500 registros.");
   const seen=new Set();
   const out=data.records.map((item,i)=>{
    const season=txt(item.season),team=txt(item.team);
    const id=key(season)+"|"+key(team);
    const issues=[];
    if(!/^\d{4}\/\d{4}$/.test(season)||Number(season.slice(5))!==Number(season.slice(0,4))+1)issues.push("Temporada inválida.");
    if(!team)issues.push("Falta equipo.");
    if(seen.has(id))issues.push("Equipo y temporada duplicados en el JSON.");
    seen.add(id);
    const chain=rate(item.xg_chain_p90),buildup=rate(item.xg_buildup_p90);
    if(Number.isNaN(chain)||Number.isNaN(buildup)||(chain===null&&buildup===null))issues.push("Se requiere al menos una tasa /90 válida.");
    if(chain!==null&&buildup!==null&&buildup>chain)issues.push("xG Buildup /90 supera xG Chain /90.");
    const candidates=matching.filter(r=>r.season===season&&key(r.team_name)===key(team));
    const groups=new Map();
    candidates.forEach(r=>groups.set(txt(r.team_id||r.fotmob_team_id||r.team_name),1));
    if(!candidates.length)issues.push("No existe una competición del equipo y temporada en MF Legacy.");
    if(groups.size>1)issues.push("Identidad de equipo ambigua; corrige la vinculación.");

    const anchor=[...candidates].sort((a,b)=>String(a.competition).localeCompare(String(b.competition)))[0]||null;
    const metrics=[["xG Chain",chain],["xG Buildup",buildup]].filter(([,v])=>v!==null&&!Number.isNaN(v)).map(([name,v])=>({name:name+" season /90",value:v,sourceNote:"Understat · JSON /90 · "+team+" · "+season}));
    const diffs=metrics.filter(m=>Number(valueOf(anchor||{},m.name))!==m.value||valueOf(anchor||{},m.name)==null);
    const same=diffs.length===0;
    return {id:i,season,team,anchor,metrics,diffs,issues,status:issues.length?"error":same?"same":metrics.length===diffs.length?"new":"update"};
   });
   setRows(out);setChosen(new Set(out.filter(r=>r.status==="new").map(r=>r.id)));
   setMessage("Vista previa generada. Solo los datos nuevos están seleccionados; marca las actualizaciones explícitamente.");
  }catch(err){setError(err.message||"JSON inválido.");}
 };
 const save=async()=>{
  const targets=rows.filter(r=>chosen.has(r.id)&&["new","update"].includes(r.status));
  if(!targets.length||busy)return;
  setBusy(true);onBusyChange?.(true);setError("");setMessage("");
  let count=0;
  try{
   for(const r of targets){
    // Fetch and validate a fresh, exact snapshot before modifying any data.
    const fetched=unpack(await base44.entities.PlayerSeasonStats.filter({player_id:playerId,season:r.season,competition:r.anchor.competition},{limit:25}));
    const exact=fetched.find(x=>txt(x.id)===txt(r.anchor.id));
    if(!exact||txt(exact.player_id)!==playerId||txt(exact.season)!==r.season||txt(exact.team_name)!==txt(r.anchor.team_name))
     throw Error("El registro "+r.season+" · "+r.team+" cambió o no se encontró. Vuelve a analizar.");
    for(const m of r.metrics){
     if(String(valueOf(exact,m.name)??"")!==String(valueOf(r.anchor,m.name)??""))
      throw Error("Un valor cambió desde la vista previa. Vuelve a analizar.");
    }
    const updates=r.metrics.filter(m=>Number(valueOf(exact,m.name))!==m.value||valueOf(exact,m.name)==null);
    if(updates.length){
     const {update}=applyManualStatChanges(exact,updates);
     await base44.entities.PlayerSeasonStats.update(exact.id,update);
     count++;
    }
   }
   setMessage(count+" registros guardados. Vuelve a analizar para comprobar valores actuales.");
   setRows([]);setChosen(new Set());onSaved?.({refresh:true});
  }catch(err){setError("Se guardaron "+count+" registros antes de detenerse. "+(err.message||"Error")+". Vuelve a analizar antes de reintentar.");setRows([]);setChosen(new Set());if(count)onSaved?.({refresh:true});}
  finally{setBusy(false);onBusyChange?.(false);}
 };
 return <div className="space-y-4">
  <p className="rounded-lg bg-blue-50 p-3 text-xs text-blue-900">Importa xG Chain /90 y xG Buildup /90 por temporada y equipo desde Understat. No requiere minutos y no modifica otras estadísticas. Las tasas de un equipo no se copian a cada competición.</p>
  <label className="block text-xs font-bold text-slate-700">Pegar JSON Understat
   <textarea value={raw} onChange={e=>{setRaw(e.target.value);setRows([]);setChosen(new Set());setError("");}} spellCheck={false} disabled={busy} placeholder={'{"schema":"mf_legacy_understat_per90_import_v1","player":{"fotmob_id":"701154"},"records":[{"season":"2023/2024","team":"Paris Saint-Germain","xg_chain_p90":1.15,"xg_buildup_p90":0.40}]}'}
    className="mt-2 h-52 w-full rounded-xl border border-slate-300 bg-slate-50 p-3 font-mono text-xs text-slate-800"/>
  </label>
  <div className="flex gap-2"><button type="button" disabled={!raw.trim()||busy} onClick={analyze} className="rounded-lg bg-[#003399] px-4 py-2 text-xs font-bold text-white disabled:opacity-40">Analizar JSON</button><button type="button" disabled={busy} onClick={()=>{setRaw("");setRows([]);setChosen(new Set());setError("");setMessage("");}} className="rounded-lg border px-4 py-2 text-xs">Limpiar</button></div>
  {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-800">{error}</p>}
  {message&&<p role="status" className="rounded-lg bg-blue-50 p-3 text-xs text-blue-800">{message}</p>}
  {!!rows.length&&<><p className="text-xs text-slate-600">{rows.length} filas · {rows.filter(r=>r.status==="error").length} errores. Los existentes no se modifican sin marcarlos.</p>
   <div className="max-h-72 overflow-auto rounded-lg border">{rows.map(r=><label key={r.id} className="flex items-start gap-2 border-b p-3 text-xs last:border-0">
    <input type="checkbox" disabled={busy||!["new","update"].includes(r.status)} checked={chosen.has(r.id)} onChange={e=>setChosen(prev=>{const s=new Set(prev);if(e.target.checked)s.add(r.id);else s.delete(r.id);return s;})}/>
    <span className="flex-1"><strong>{r.season} · {r.team}</strong><span className="ml-2 text-slate-500">{r.status==="new"?"Nuevo":r.status==="update"?"Actualizar":r.status==="same"?"Sin cambios":"Error"}</span>
    <span className="block text-slate-600">Chain /90: {r.metrics.find(m=>m.name.startsWith("xG Chain"))?.value??"—"} · Buildup /90: {r.metrics.find(m=>m.name.startsWith("xG Buildup"))?.value??"—"}</span>
    {r.issues.map((t,i)=><span key={i} className="block text-red-700">{t}</span>)}</span>
   </label>)}</div>
   <button type="button" disabled={busy||!chosen.size} onClick={save} className="rounded-lg bg-[#003399] px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{busy?"Guardando…":"Guardar "+chosen.size+" registros"}</button>
  </>}
 </div>;
}
