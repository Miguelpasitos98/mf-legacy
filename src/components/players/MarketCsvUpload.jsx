import {persistMarketHistory} from "@/utils/persistMarketHistory";
import React, { useState } from "react";
const key = id => `mf-legacy-market-history-preview-v1:${id}`;
const parseCSV = (text) => {
  const lines=text.replace(/^\uFEFF/,"").split(/\r?\n/).filter(Boolean);
  const split=line=>{
    const cells=[];let field="",quoted=false;
    for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(quoted&&line[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}else if(ch===','&&!quoted){cells.push(field);field="";}else field+=ch;}
    cells.push(field);return cells;
  };
  const columns=split(lines.shift()||"");
  return lines.map(line=>Object.fromEntries(split(line).map((v,i)=>[columns[i],v])));
};
export default function MarketCsvUpload({player}){
  const [players,setPlayers]=useState(null);
  const [records,setRecords]=useState(null);
  const [id,setId]=useState(String(player?.transfermarkt_id||player?.transfermarktId||""));
  const [message,setMessage]=useState("");
  const [preview,setPreview]=useState([]);
  const load=async(event,kind)=>{
    const file=event.target.files?.[0];if(!file)return;
    try{
      if(file.size>100*1024*1024)throw Error("El archivo supera los 100 MB; usa el CSV original sin comprimir.");
      setMessage("Leyendo "+file.name+"…");
      const rows=parseCSV(await file.text());
      const required=kind==="players"?["player_id","name"]:["player_id","date","market_value_in_eur"];
      if(required.some(c=>!Object.hasOwn(rows[0]||{},c)))throw Error("CSV sin las columnas necesarias: "+required.join(", "));
      if(kind==="players")setPlayers(rows);else setRecords(rows);
      setPreview([]);setMessage(`${file.name}: ${rows.length} filas cargadas localmente.`);
    }catch(e){setMessage(e.message);}
    event.target.value="";
  };
  const check=()=>{
    const match=players?.find(r=>String(r.player_id)===id);
    if(!/^\d+$/.test(id)){setMessage("Introduce un ID válido de Transfermarkt.");return;}
    if(players&&!match){setMessage("El ID no aparece en players.csv.");return;}
    const dob=String(player?.date_of_birth||player?.dateOfBirth||"").slice(0,10);
    if(match&&dob&&match.date_of_birth&&String(match.date_of_birth).slice(0,10)!==dob){setMessage("La fecha de nacimiento no coincide. Importación bloqueada.");return;}
    const values=(records||[]).filter(r=>String(r.player_id)===id).map(r=>({
      date:String(r.date||"").slice(0,10),value:Number(r.market_value_in_eur)/1e6,team:r.current_club_name||"",
    })).filter(r=>/^\d{4}-\d\d-\d\d$/.test(r.date)&&Number.isFinite(r.value)&&r.value>=0).sort((a,b)=>a.date.localeCompare(b.date));
    setPreview(values);
    setMessage(values.length?`${values.length} valoraciones de ${match?.name||id}. Verifica la identidad antes de confirmar.`:"No hay valoraciones para este ID en el CSV.");
  };
  const save=async()=>{
    if(!preview.length||!player?.id)return;
    try{
      const old=window.localStorage.getItem(key(player.id));
      const source=old===null?(player.market_value_history||[]):JSON.parse(old);
      const existing=(Array.isArray(source)?source:[]).map(r=>({...r,date:String(r.date||"").slice(0,10),value:Number(r.value)})).filter(r=>/^\d{4}-\d\d-\d\d$/.test(r.date)&&Number.isFinite(r.value));
      const dates=new Set(existing.map(r=>r.date));
      const all=[...existing,...preview.filter(r=>!dates.has(r.date))].sort((a,b)=>a.date.localeCompare(b.date));
      const saved=await persistMarketHistory(player.id,all);
      setMessage(\`\${saved.length} registros guardados y verificados en Base44.\`);
    }catch(e){setMessage("Error al guardar: "+e.message);}
  };
  const linked=players?.find(r=>String(r.player_id)===id);
  return <section className="rounded-2xl border border-slate-200 bg-white p-5">
    <h3 className="text-sm font-black">Importar dataset CSV descargado</h3>
    <p className="mt-1 text-xs text-slate-500">Alternativa cuando GitHub Actions recibe HTTP 403. Los archivos se leen exclusivamente en tu navegador; no se suben a servidores. Descarga players.csv y player_valuations.csv desde la fuente original.</p>
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <label className="text-xs font-semibold">1. players.csv (identidad)<input aria-label="Seleccionar players.csv" type="file" accept=".csv,text/csv" onChange={e=>load(e,"players")} className="mt-1 block w-full text-xs"/></label>
      <label className="text-xs font-semibold">2. player_valuations.csv<input aria-label="Seleccionar player_valuations.csv" type="file" accept=".csv,text/csv" onChange={e=>load(e,"values")} className="mt-1 block w-full text-xs"/></label>
    </div>
    <div className="mt-3 flex flex-wrap items-end gap-2">
      <label className="text-xs font-semibold">ID Transfermarkt<input value={id} onChange={e=>{setId(e.target.value);setPreview([]);}} className="mt-1 block rounded-lg border px-3 py-2 text-sm" placeholder="ID del jugador"/></label>
      <button type="button" disabled={!records||!players} onClick={check} className="rounded-lg bg-blue-800 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Previsualizar valores</button>
    </div>
    {linked&&<p className="mt-2 text-xs">Identidad CSV: <strong>{linked.name}</strong> · {linked.date_of_birth||"Sin nacimiento"}</p>}
    {message&&<p role="status" className="mt-2 text-xs text-slate-600">{message}</p>}
    {preview.length>0&&<div className="mt-3">
      <div className="max-h-36 overflow-auto rounded-lg border p-2 text-xs">{preview.slice(-12).map(r=><div key={r.date}>{r.date} · {r.value} M€ · {r.team}</div>)}</div>
      <button type="button" onClick={save} className="mt-3 rounded-lg bg-blue-800 px-3 py-2 text-xs font-bold text-white">Confirmar importación local ({preview.length})</button>
    </div>}
  </section>;
}
