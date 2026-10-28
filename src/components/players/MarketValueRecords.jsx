import React, { useEffect, useMemo, useState } from "react";
import { Save, Trash2, Plus } from "lucide-react";
const storageKey = id => `mf-legacy-market-history-preview-v1:${id}`;
const normalize = s => String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\b(fc|cf|football club|futbol club)\b/g,"").replace(/[^a-z0-9]/g,"");
const iso = s => {const v=String(s||""); const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);return m?`${m[3]}-${m[2]}-${m[1]}`:v;};
const read = player => {
  try {
    const saved=window.localStorage.getItem(storageKey(player?.id));
    return saved === null ? (player?.market_value_history||[]) : JSON.parse(saved);
  }catch{return player?.market_value_history||[];}
};
export default function MarketValueRecords({player,clubs=[]}){
  const [rows,setRows]=useState([]);
  const [dirty,setDirty]=useState(false);
  const [message,setMessage]=useState("");
  const [filter,setFilter]=useState("");
  const reset=()=>{setRows((Array.isArray(read(player))?read(player):[]).map(r=>({...r,date:iso(r.date),value:String(r.value??""),team:r.team||"",club_id:r.club_id||""})).sort((a,b)=>a.date.localeCompare(b.date)));setDirty(false);};
  useEffect(()=>{reset();},[player?.id]);
  useEffect(()=>{
    const handler=e=>{if(String(e.detail?.playerId)===String(player?.id))reset();};
    window.addEventListener("mf-legacy-market-preview-updated",handler);
    return()=>window.removeEventListener("mf-legacy-market-preview-updated",handler);
  },[player?.id]);
  const candidates=useMemo(()=>clubs.filter(c=>c?.id&&c?.name).sort((a,b)=>a.name.localeCompare(b.name)),[clubs]);
  const visible=rows.map((r,i)=>({...r,index:i})).filter(r=>!filter||[r.date,r.team,candidates.find(c=>String(c.id)===String(r.club_id))?.name].some(v=>normalize(v).includes(normalize(filter))));
  const autoLink=()=>{
    let linked=0;
    setRows(old=>old.map(row=>{
      if(row.club_id)return row;
      const name=normalize(row.team);
      const token=/bayern/.test(name)?"bayern":/tottenham|spurs/.test(name)?"tottenham":/norwich/.test(name)?"norwich":"";
      const matches=candidates.filter(c=>{
        const candidate=normalize(c.name);
        return name && (candidate===name || (token==="bayern"&&candidate.includes("bayern")) ||
          (token==="tottenham"&&candidate.includes("tottenham")) || (token==="norwich"&&candidate.includes("norwich")));
      });
      if(matches.length!==1)return row;
      linked++;return {...row,club_id:matches[0].id};
    }));
    setDirty(true);setMessage(linked+` registros vinculados automáticamente. Revisa y pulsa Guardar cambios.`);
  };
  const set=(i,patch)=>{setRows(old=>old.map((r,j)=>j===i?{...r,...patch}:r));setDirty(true);setMessage("");};
  const save=()=>{
    if(!player?.id)return setMessage("Falta el ID del jugador.");
    let normalized;
    try { normalized=rows.map((r,i)=>{
      const value=Number(String(r.value).replace(",","."));
      const valid=/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&!Number.isNaN(Date.parse(r.date))&&Number.isFinite(value)&&value>=0;
      if(!valid)throw new Error(`Registro ${i+1}: fecha o importe inválido`);
      const linked=candidates.find(c=>String(c.id)===String(r.club_id));
      return {date:r.date,value,team:linked?.name||r.team||"",club_id:linked?.id||""};
    }); } catch(e){setMessage(e.message);return;}
    try{
      const dates=new Set();
      for(const r of normalized){if(dates.has(r.date))throw Error("Hay fechas duplicadas: "+r.date);dates.add(r.date);}
      normalized.sort((a,b)=>a.date.localeCompare(b.date));
      window.localStorage.setItem(storageKey(player.id),JSON.stringify(normalized));
      window.dispatchEvent(new CustomEvent("mf-legacy-market-preview-updated",{detail:{playerId:player.id}}));
      setDirty(false);setMessage(`${normalized.length} registros guardados en este navegador.`);
    }catch(e){setMessage(e.message);}
  };
  return <section className="rounded-2xl border border-slate-200 bg-white p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="text-sm font-black">Historial completo · {rows.length} valoraciones</h3>
      <p className="mt-1 text-xs text-slate-500">Revisa fecha, valor y club. Vincula cada registro a un club de MF Legacy para obtener su color y escudo. Se guarda localmente en esta prueba.</p></div>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={autoLink} className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-900">Asociar clubes automáticamente</button><button type="button" onClick={save} className="inline-flex items-center gap-2 rounded-lg bg-[#003399] px-3 py-2 text-xs font-bold text-white"><Save size={14}/> Guardar cambios{dirty?" *":""}</button></div>
    </div>
    <input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Filtrar por fecha o club" aria-label="Filtrar valoraciones" className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"/>
    <div className="mt-3 max-h-[380px] overflow-y-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[550px] text-left text-xs">
        <thead className="sticky top-0 z-10 bg-slate-100 text-slate-600"><tr><th className="p-2">Fecha</th><th className="p-2">Valor (M€)</th><th className="p-2">Club histórico</th><th className="p-2">Asociar club MF Legacy</th><th className="p-2"></th></tr></thead>
        <tbody>{visible.map(r=>{
          const selected=candidates.find(c=>String(c.id)===String(r.club_id));
          return <tr key={r.index} className="border-t border-slate-100">
            <td className="p-2"><input type="date" value={r.date} onChange={e=>set(r.index,{date:e.target.value})} className="w-[125px] rounded border px-1 py-1"/></td>
            <td className="p-2"><input type="number" min="0" step="0.01" value={r.value} onChange={e=>set(r.index,{value:e.target.value})} className="w-[85px] rounded border px-1 py-1"/></td>
            <td className="p-2 text-slate-600">{r.team||"Sin información"}</td>
            <td className="p-2"><div className="flex items-center gap-2">{selected&&(selected.logo||selected.logo_url||selected.badge_url)&&<img src={selected.logo||selected.logo_url||selected.badge_url} alt="" className="h-5 w-5 object-contain"/>}
              <select value={r.club_id} onChange={e=>{const club=candidates.find(c=>String(c.id)===e.target.value);set(r.index,{club_id:e.target.value,team:club?.name||r.team});}} className="w-full min-w-[135px] max-w-[220px] rounded border bg-white p-1">
                <option value="">Sin asociar</option>{candidates.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select></div></td>
            <td className="p-2"><button type="button" title="Eliminar registro" onClick={()=>{setRows(old=>old.filter((_,i)=>i!==r.index));setDirty(true);}} className="text-red-500"><Trash2 size={15}/></button></td>
          </tr>;
        })}</tbody>
      </table>
    </div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
      <button type="button" className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs" onClick={()=>{setRows(old=>[...old,{date:"",value:"",team:"",club_id:""}]);setDirty(true);}}><Plus size={14}/> Añadir registro</button>
      <span className="text-xs text-slate-500">{visible.length} de {rows.length} registros visibles</span>
    </div>
    {message&&<p role="status" className="mt-2 text-xs text-slate-600">{message}</p>}
  </section>;
}
