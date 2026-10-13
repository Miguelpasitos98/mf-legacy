import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, FileJson2, Upload, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { normalizeLabel, parseStatsText } from "@/utils/statsImport";

const unpack = (result) => Array.isArray(result) ? result : result?.items || result?.data || result?.results || [];
const getId = (item) => String(item?.id || "");
const playerFM = (p) => String(p.fm26_uid || p.fm26_unique_id || "");
const playerName = (p) => String(p.name || "");
const same = (a,b) => String(a||"")===String(b||"");
const isID = (id) => Boolean(String(id||"").trim());

export default function StatsImport({ players=[], teams=[], onClose, onImported }) {
  const [rows,setRows]=useState([]);
  const [filename,setFilename]=useState("");
  const [message,setMessage]=useState("");
  const [links,setLinks]=useState([]);
  const [manual,setManual]=useState({});
  const [targetFotmob,setTargetFotmob]=useState("");
  const [playerSearch,setPlayerSearch]=useState("");
  const [working,setWorking]=useState(false);
  const [progress,setProgress]=useState({done:0,total:0,created:0,existing:0,failed:0});
  const [failedNames,setFailedNames]=useState([]);
  const fileRef=useRef(null);
  const stopRef=useRef(false);
  const uniquePlayers=useMemo(()=>[...new Map(players.filter(p=>p?.id).map(p=>[String(p.id),p])).values()], [players]);
  const byID=useMemo(()=>new Map(uniquePlayers.map(p=>[String(p.id),p])),[uniquePlayers]);
  const byTeamName=useMemo(()=>{const map=new Map();for(const t of teams){const key=normalizeLabel(t.name);if(!key)continue;if(!map.has(key))map.set(key,[]);map.get(key).push(t);}return map;},[teams]);
  const byFM=useMemo(()=>{
    const by=new Map();
    for(const p of uniquePlayers){const id=playerFM(p);if(!id)continue;if(!by.has(id))by.set(id,[]);by.get(id).push(p);}
    return by;
  },[uniquePlayers]);
  const linkMap=useMemo(()=>new Map(links.map(l=>[String(l.fotmob_player_id),l])),[links]);
  const resolve=(r)=>{
    const manualId=manual[r.fotmob_player_id];
    if(isID(manualId)&&byID.has(manualId))return {player:byID.get(manualId),mode:"Confirmado manual"};
    if(isID(r.player_id)&&byID.has(r.player_id))return {player:byID.get(r.player_id),mode:"ID Base44"};
    if(isID(r.fm26_uid) && (byFM.get(r.fm26_uid)||[]).length===1)return {player:byFM.get(r.fm26_uid)[0],mode:"UID FM26"};
    const link=linkMap.get(r.fotmob_player_id);
    if(link&&byID.has(link.player_id))return {player:byID.get(link.player_id),mode:"Vínculo confirmado"};
    return {player:null,mode:"Pendiente"};
  };
  const resolved=useMemo(()=>rows.map(r=>({...r,matching:resolve(r)})),[rows,manual,byID,byFM,linkMap]);
  const ready=useMemo(()=>resolved.filter(r=>r.matching.player),[resolved]);
  const pending=useMemo(()=>resolved.filter(r=>!r.matching.player),[resolved]);
  const distinctMissing=useMemo(()=>[...new Map(pending.map(r=>[r.fotmob_player_id,r])).values()],[pending]);
  const searchResults=useMemo(()=>{
    const q=normalizeLabel(playerSearch);
    if(q.length<2)return[];
    return uniquePlayers.filter(p=>normalizeLabel(playerName(p)).includes(q)||same(p.id,playerSearch)||playerFM(p)===playerSearch).slice(0,12);
  },[playerSearch,uniquePlayers]);
  useEffect(()=>{
    let active=true;
    base44.entities.PlayerFotmobLink.list({limit:500}).then(r=>{if(active)setLinks(unpack(r));}).catch(()=>{});
    return()=>{active=false;};
  },[]);
  const selectFile=async(e)=>{
    const file=e.target.files?.[0];if(!file)return;
    setMessage("");setRows([]);setFilename(file.name);setProgress({done:0,total:0,created:0,existing:0,failed:0});setManual({});
    if(file.size>30*1024*1024){setMessage("El archivo supera 30 MB. Exporta lotes más pequeños.");return;}
    try{
      const parsed=parseStatsText(await file.text(),file.name);
      setRows(parsed.records);
      setMessage("Archivo analizado: "+parsed.records.length.toLocaleString("es")+" registros. Los datos no se han guardado todavía.");
    }catch(error){setMessage("Error: "+error.message);}
  };
  const applyMapFile=async(event)=>{
    const file=event.target.files?.[0];
    if(!file)return;
    try{
      const text=(await file.text()).replace(/^\uFEFF/,"");
      const lines=text.trim().split(/\r?\n/);
      const delim=lines[0].includes(";")?";":",";
      const headers=lines.shift().split(delim).map(x=>x.trim().toLowerCase());
      const idCol=headers.indexOf("fotmob_player_id");
      const fmCol=headers.indexOf("fm26_uid");
      const bCol=headers.indexOf("base44_player_id");
      if(idCol<0||(fmCol<0&&bCol<0))throw Error("El CSV necesita fotmob_player_id y fm26_uid o base44_player_id.");
      const found={};let accepted=0,skipped=0;
      for(const line of lines){
        if(!line.trim())continue;
        const fields=line.split(delim).map(v=>v.trim().replace(/^"|"$/g,""));
        const pid=String(fields[idCol]||"");
        if(!pid){skipped++;continue;}
        const direct=bCol>=0?String(fields[bCol]||""):"";
        const fm=fmCol>=0?String(fields[fmCol]||""):"";
        const candidate=direct?byID.get(direct):(byFM.get(fm)||[]).length===1?byFM.get(fm)[0]:null;
        if(!candidate){skipped++;continue;}
        const existing=linkMap.get(pid);
        if(existing&&String(existing.player_id)!==String(candidate.id))throw Error("ID FotMob "+pid+" ya está vinculado a otro jugador.");
        if(found[pid]&&found[pid]!==String(candidate.id))throw Error("Mapeo contradictorio para FotMob "+pid);
        found[pid]=String(candidate.id);accepted++;
      }
      setManual(old=>({...old,...found}));
      setMessage("Equivalencias analizadas: "+accepted+" vinculadas y "+skipped+" sin correspondencia. Revisa la previsualización antes de importar.");
    }catch(error){setMessage("Error de equivalencias: "+(error.message||error));}
    event.target.value="";
  };
  const assign=()=>{
    if(!targetFotmob)return;
    const match=searchResults[0];
    if(!match){setMessage("Busca un jugador y selecciona un resultado.");return;}
    setManual(prev=>({...prev,[targetFotmob]:String(match.id)}));
    setMessage("Vinculado en la previsualización: "+match.name+". Se guardará al importar.");
    setTargetFotmob("");setPlayerSearch("");
  };
  const persistLink=async(pid,player)=>{
    const previous=linkMap.get(pid);
    if(previous && previous.player_id!==player.id)throw Error("El ID FotMob tiene otro vínculo guardado; revisar manualmente.");
    if(previous)return;
    const payload={fotmob_player_id:pid,player_id:String(player.id),fm26_uid:playerFM(player),player_name:playerName(player),verification:"manual_confirmada"};
    const created=await base44.entities.PlayerFotmobLink.create(payload);
    setLinks(all=>[...all,{...payload,id:created?.id||created?.data?.id}]);
  };
  const run=async()=>{
    if(!ready.length||working)return;
    if(!window.confirm("Importar "+ready.length+" registros vinculados en PlayerSeasonStats? Se omitirán los que ya existan. Los pendientes no se importan."))return;
    setWorking(true);stopRef.current=false;setFailedNames([]);
    let created=0,updated=0,existing=0,failed=0,done=0;
    const failures=[];
    const manualDone=new Set();
    for(const record of ready){
      if(stopRef.current)break;
      try {
        const person=record.matching.player;
        if(manual[record.fotmob_player_id] && !manualDone.has(record.fotmob_player_id)){
          await persistLink(record.fotmob_player_id,person);
          manualDone.add(record.fotmob_player_id);
        }
        const previous=await base44.entities.PlayerSeasonStats.filter({external_record_id:record.external_record_id},{limit:1});
        const found=unpack(previous)[0];
        if(found){
          if(String(found.player_id)!==String(person.id))throw Error("Conflicto: la etapa existente pertenece a otro Player.");
          const oldMetrics=Array.isArray(found.metrics)?found.metrics:[];
          const incoming=record.metrics||[];
          const byName=new Map(oldMetrics.map(m=>[normalizeLabel(m.name),m]));
          const extras=[];
          for(const m of incoming){
            const was=byName.get(normalizeLabel(m.name));
            if(!was)extras.push(m);
            else if(Number(was.value)!==Number(m.value))throw Error("Conflicto de estadística "+m.name+": revisar, no se sobrescribe.");
          }
          // Solo enriquecimiento: nunca sustituir métricas existentes ni modificar Player/Team.
          const patch={metrics:[...oldMetrics,...extras]};
          let changed=extras.length>0;
          for(const key of ["appearances","minutes","rating","market_value","market_date"]){
            if((found[key]===null||found[key]===undefined||found[key]==="") && record[key]!==null && record[key]!==undefined && record[key]!==""){
              patch[key]=record[key];changed=true;
            }
          }
          if(changed){await base44.entities.PlayerSeasonStats.update(found.id,patch);updated++;}
          else existing++;
        }else{
          const {matching,...r}=record;
          const teamMatches=byTeamName.get(normalizeLabel(r.team_name))||[];
          const confirmedTeamId=r.team_id||((teamMatches.length===1)?String(teamMatches[0].id):"");
          await base44.entities.PlayerSeasonStats.create({...r,team_id:confirmedTeamId,player_id:String(person.id),fm26_uid:r.fm26_uid||playerFM(person),player_name:r.player_name||playerName(person),review_status:"pending",import_batch:filename,updated_from_file:new Date().toISOString()});
          created++;
        }
      }catch(error){failed++;failures.push(record.player_name+" · "+record.season+" · "+record.competition+": "+(error?.message||"error"));}
      done++;
      if(done%5===0||done===ready.length)setProgress({done,total:ready.length,created,updated,existing,failed});
    }
    setProgress({done,total:ready.length,created,updated,existing,failed});
    setFailedNames(failures.slice(0,25));
    setMessage("Proceso terminado · "+created+" creados · "+updated+" enriquecidos · "+existing+" ya existentes · "+failed+" errores. "+(stopRef.current?"Interrumpido por el usuario.":""));
    setWorking(false);
    onImported?.();
  };
  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Importar estadísticas">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-[#0d243b] px-5 py-4 text-white">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-200">MF LEGACY · STATS</p><h2 className="mt-1 text-lg font-black">Importar estadísticas de FotMob Studio</h2></div>
          <button disabled={working} onClick={onClose} aria-label="Cerrar importador" className="rounded-lg p-2 hover:bg-white/10 disabled:opacity-50"><X size={20}/></button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <p className="text-sm text-slate-600">Acepta <strong>JSON, JSONC o CSV</strong> del programa: caché de temporadas, registros detallados o CSV largo (una fila por estadística). No cambia Player, Team ni los atributos de Football Manager.</p>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-blue-300 bg-blue-50 p-4 text-sm font-semibold text-blue-900 hover:bg-blue-100">
            <FileJson2 size={22}/><span>{filename || "Elegir archivo CSV, JSON o JSONC"}</span>
            <input ref={fileRef} type="file" accept=".csv,.json,.jsonc" onChange={selectFile} className="sr-only" disabled={working}/>
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-[#003399] hover:bg-blue-50"><Upload size={15}/> Cargar CSV de equivalencias de IDs <input type="file" accept=".csv" onChange={applyMapFile} className="sr-only" disabled={working}/></label>
          <p className="text-[11px] text-slate-500">Formato del mapeo: fotmob_player_id;fm26_uid;base44_player_id. Solo se aceptan IDs que coinciden con jugadores existentes.</p>
          {rows.length>0&&<>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[["Registros",rows.length],["Vinculados",ready.length],["Sin vincular",pending.length],["Jugadores",new Set(rows.map(r=>r.fotmob_player_id)).size]].map(([label,n])=><div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="text-xl font-black text-[#0c315a]">{n.toLocaleString("es")}</p></div>)}
            </div>
            {distinctMissing.length>0&&<div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="flex items-center gap-2 text-sm font-bold text-amber-900"><AlertCircle size={17}/> Vincula los jugadores que faltan (no asociamos solo por nombre)</p>
              <p className="mt-1 text-xs text-amber-800">Elige un ID de FotMob del lote y vincúlalo con su ficha existente en MY LEGACY. También puedes incluir <strong>base44_player_id</strong> o <strong>fm26_uid</strong> en el exportador.</p>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <select className="min-w-0 rounded-lg border border-amber-200 bg-white p-2 text-sm" value={targetFotmob} onChange={e=>{setTargetFotmob(e.target.value);setPlayerSearch("");}}>
                  <option value="">Seleccionar jugador pendiente…</option>
                  {distinctMissing.slice(0,600).map(r=><option key={r.fotmob_player_id} value={r.fotmob_player_id}>{r.player_name||"Sin nombre"} · FotMob {r.fotmob_player_id}</option>)}
                </select>
                <input className="rounded-lg border border-amber-200 bg-white p-2 text-sm" value={playerSearch} onChange={e=>setPlayerSearch(e.target.value)} placeholder="Buscar jugador de MY LEGACY" disabled={!targetFotmob}/>
              </div>
              {targetFotmob&&searchResults.length>0&&<div className="mt-2 max-h-32 overflow-y-auto rounded-lg border border-amber-200 bg-white">{searchResults.map(p=><button key={p.id} className="block w-full border-b border-slate-100 px-3 py-2 text-left text-xs hover:bg-blue-50" onClick={()=>{setManual(v=>({...v,[targetFotmob]:String(p.id)}));setTargetFotmob("");setPlayerSearch("");}}><strong>{p.name}</strong><span className="ml-3 text-slate-500">FM26: {playerFM(p)||"—"}</span></button>)}</div>}
              <p className="mt-2 text-[11px] text-amber-800">Pendientes únicos: {distinctMissing.length}. Se omiten hasta confirmar su identidad.</p>
            </div>}
            <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[750px] text-left text-xs"><thead className="bg-slate-100 text-slate-500"><tr>{["Jugador / ID FotMob","Equipo","Temporada","Competición","MY LEGACY","Estado"].map(h=><th key={h} className="px-3 py-2 font-bold uppercase">{h}</th>)}</tr></thead><tbody>{resolved.slice(0,35).map((r,i)=><tr key={r.external_record_id+i} className="border-t border-slate-100"><td className="px-3 py-2"><strong>{r.player_name||"Sin nombre"}</strong><div className="text-slate-400">{r.fotmob_player_id}</div></td><td className="px-3 py-2">{r.team_name||"—"}</td><td className="px-3 py-2">{r.season}</td><td className="px-3 py-2">{r.competition}</td><td className="px-3 py-2">{r.matching.player?.name||"Sin vincular"}</td><td className="px-3 py-2"><span className={r.matching.player?"text-emerald-700":"text-amber-700"}>{r.matching.mode}</span></td></tr>)}</tbody></table></div>
            {rows.length>35&&<p className="text-xs text-slate-500">Vista previa de 35 registros. Al importar se procesan todos los vinculados.</p>}
          </>}
          {message&&<p className="rounded-lg bg-slate-100 p-3 text-sm text-slate-700" role="status">{message}</p>}
          {working||progress.total>0?<div><div className="mb-1 flex justify-between text-xs text-slate-600"><span>{working?"Importando…":"Último resultado"}</span><span>{progress.done}/{progress.total}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-blue-600 transition-all" style={{width:(progress.total?progress.done/progress.total*100:0)+"%"}}/></div><p className="mt-2 text-xs text-slate-500">Nuevos: {progress.created} · Enriquecidos: {progress.updated||0} · Existentes: {progress.existing} · Errores: {progress.failed}</p></div>:null}
          {failedNames.length>0&&<div className="rounded-lg border border-rose-200 p-3 text-xs text-rose-700">{failedNames.map((s,i)=><div key={i}>{s}</div>)}</div>}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
          <span className="text-xs text-slate-500">Los registros quedan pendientes de revisión y no sobrescriben otros datos.</span>
          <div className="flex gap-2">
            {working?<button onClick={()=>{stopRef.current=true;}} className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800">Detener tras este registro</button>:<button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Cerrar</button>}
            <button disabled={working||!ready.length} onClick={run} className="inline-flex items-center gap-2 rounded-lg bg-[#003399] px-4 py-2 text-sm font-bold text-white disabled:opacity-40"><Upload size={15}/> Importar {ready.length.toLocaleString("es")} vinculados</button>
          </div>
        </div>
      </div>
    </div>
  );
}

