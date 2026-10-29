import React, {useEffect, useMemo, useState} from "react";
import {base44} from "@/api/base44Client";

const METRICS=[
  {value:"xGOT",label:"xGOT (tiros a puerta)"},
  {value:"Goals Prevented",label:"Goles evitados (PSxG - GA)"},
  {value:"xG",label:"xG"},
  {value:"xA",label:"xA"},
];
const rows=value=>Array.isArray(value)?value:value?.items||value?.data||value?.entities||[];
const fmt=x=>[x.season,x.team_name||"Equipo sin confirmar",x.competition].join(" · ");
const safeNumber=s=>{
  const v=String(s||"").trim().replace(/\s/g,"").replace(",",".");
  return /^[+-]?\d+(?:\.\d+)?$/.test(v)?Number(v):null;
};
/** Only an explicitly named figure can be extracted. Never treat xG as xGOT. */
export function publishedFigure(text,metric,unit){
  const raw=String(text||"").slice(0,12000);
  const pattern=metric==="xGOT"?"xGOT":metric==="Goals Prevented"?"(?:goals? prevented|goles? evitados|PSxG\\s*[-−]\\s*GA)":metric==="xG"?"xG(?!OT)": "xA";
  const rate=unit==="per90"?"(?:\\s*(?:per|por|/)\\s*90(?:\\s*(?:min|minutes))?|\\s*\\/\\s*90)":"";
  const number="([+-]?(?:\\d+(?:[.,]\\d+)?))";
  const searches=[
    new RegExp("\\b"+pattern+"\\b\\s*"+rate+"\\s*[:=–-]?\\s*"+number,"ig"),
    new RegExp(number+"\\s*"+pattern+"\\b"+rate,"ig")
  ];
  const found=[];
  for(const re of searches){
    for(const match of raw.matchAll(re)){
      const context=raw.slice(Math.max(0,match.index-32),Math.min(raw.length,match.index+match[0].length+32));
      const normalized=context.toLowerCase();
      if(unit==="per90"&&!/(?:\/|per |por )\s*90/.test(normalized))continue;
      if(unit==="total"&&/(?:\/|per |por )\s*90/.test(match[0].toLowerCase()))continue;
      const value=safeNumber(match[1]);if(value!==null&&Number.isFinite(value))found.push(value);
    }
  }
  const unique=[...new Set(found)];
  return unique.length===1?{value:unique[0]}:unique.length>1?{error:"Se han encontrado varias cifras diferentes: indica manualmente cuál corresponde al registro."}:{error:"No se detecta una cifra inequívoca; introdúcela manualmente después de revisarla."};
}

export default function PublicReferenceImport({player,linked,onSubmitted,disabled=false}){
  const [stats,setStats]=useState([]),[loading,setLoading]=useState(false);
  const [seasonId,setSeasonId]=useState("");
  const [url,setUrl]=useState("");
  const [metric,setMetric]=useState("xGOT");
  const [unit,setUnit]=useState("total");
  const [snippet,setSnippet]=useState("");
  const [value,setValue]=useState("");
  const [confirmed,setConfirmed]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  useEffect(()=>{
    let active=true;
    setStats([]);setSeasonId("");setMessage("");setError("");setConfirmed(false);
    if(!player?.id)return;
    setLoading(true);
    base44.entities.PlayerSeasonStats.filter({player_id:player.id},"-season",200)
      .then(result=>{if(active)setStats(rows(result));})
      .catch(()=>{if(active)setError("No se pudieron cargar las temporadas existentes.");})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[player?.id]);
  const selected=useMemo(()=>stats.find(row=>row.id===seasonId),[stats,seasonId]);
  const linkOK=useMemo(()=>{try{
    const u=new URL(url);const host=u.hostname.toLowerCase();
    return u.protocol==="https:"&&["theanalyst.com","statsperform.com","premierleague.com","uefa.com"].some(domain=>host===domain||host.endsWith("."+domain));
  }catch{return false;}},[url]);
  const valueNumber=safeNumber(value);
  const valid=!!(player?.id&&linked&&selected?.fotmob_team_id&&selected?.fotmob_tournament_id&&
    linkOK&&valueNumber!==null&&Number.isFinite(valueNumber)&&(valueNumber>=0||metric==="Goals Prevented")&&
    (unit!=="percentage"||valueNumber<=100)&&snippet.trim().length>=8&&confirmed);
  const analyze=()=>{
    setError("");setMessage("");
    const detected=publishedFigure(snippet,metric,unit);
    if(detected.error)setMessage(detected.error);
    else {setValue(String(detected.value));setMessage("Cifra detectada en el fragmento. Comprueba su alcance antes de enviarla.");}
    setConfirmed(false);
  };
  const submit=async e=>{
    e.preventDefault();if(!valid||busy||disabled)return;
    setBusy(true);setError("");setMessage("");
    try{
      const response=await base44.functions.invoke("import-control",{
        action:"stage-public",player_id:player.id,season_stats_id:selected.id,
        evidence_url:url.trim(),metric_name:metric,metric_unit:unit,
        value:valueNumber,source_excerpt:snippet.trim().slice(0,1200),
        confirmed:true,
      });
      if(!response.data?.ok)throw Error(response.data?.error||"Error al crear candidato");
      setMessage("Referencia añadida a la cola de revisión. No se han modificado las estadísticas.");
      setConfirmed(false);setSnippet("");setValue("");
      await onSubmitted?.(response.data?.job?.id);
    }catch(err){setError(err?.response?.data?.error||err.message||"Error al registrar referencia.");}
    finally{setBusy(false);}
  };
  return <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4 md:p-5" aria-label="Importación de fuentes publicadas">
    <h2 className="text-lg font-bold text-[#0d315b]">Fuentes publicadas · Opta Analyst / informes</h2>
    <p className="mt-1 text-sm text-slate-600">Complementa una temporada ya importada mediante una cifra explícita de una página pública. Pega el fragmento visible y su enlace; el analizador reconoce xGOT, goles evitados, xG o xA. No descarga ni rastrea páginas protegidas, y nunca calcula xGOT a partir de goles o xG.</p>
    {!player?<p className="mt-3 text-sm text-slate-500">Selecciona primero un jugador arriba.</p>:
    !linked?<p className="mt-3 text-sm text-amber-800">Confirma primero la vinculación FotMob del jugador.</p>:
    <form onSubmit={submit} className="mt-4 grid gap-3 max-w-3xl">
      <label className="text-sm font-medium">Temporada / club / competición
        <select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={seasonId} onChange={e=>{setSeasonId(e.target.value);setConfirmed(false);}} required>
          <option value="">Seleccionar registro existente...</option>
          {stats.map(row=><option key={row.id} value={row.id} disabled={!row.fotmob_team_id||!row.fotmob_tournament_id}>{fmt(row)}{!row.fotmob_team_id||!row.fotmob_tournament_id?" · ID pendiente":""}</option>)}
        </select>
      </label>
      {loading&&<p className="text-xs text-slate-500">Cargando temporadas...</p>}
      <label className="text-sm font-medium">URL del dato publicado
        <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="url" value={url} onChange={e=>{setUrl(e.target.value);setConfirmed(false);}} placeholder="https://theanalyst.com/players/..." required/>
      </label>
      {!linkOK&&url&&<p className="text-xs text-amber-700">Por seguridad se admiten enlaces HTTPS de Opta Analyst, Stats Perform, Premier League y UEFA.</p>}
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm font-medium">Indicador
          <select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={metric} onChange={e=>{setMetric(e.target.value);setValue("");setConfirmed(false);}}>
            {METRICS.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium">Unidad
          <select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={unit} onChange={e=>{setUnit(e.target.value);setValue("");setConfirmed(false);}}>
            <option value="total">Total</option><option value="per90">Por 90 minutos</option>
          </select>
        </label>
      </div>
      <label className="text-sm font-medium">Fragmento publicado (copia solo la frase o celda necesaria)
        <textarea className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" rows={2} maxLength={1200} value={snippet} onChange={e=>{setSnippet(e.target.value);setConfirmed(false);}} placeholder="Ejemplo: xGOT/90: 0.95" required />
      </label>
      <div className="flex flex-wrap gap-3 items-end">
        <button type="button" onClick={analyze} disabled={!snippet.trim()} className="rounded-lg border border-[#003399] text-[#003399] px-3 py-2 text-sm font-medium disabled:opacity-40">Leer cifra del fragmento</button>
        <label className="text-sm font-medium">Valor contrastado
          <input className="block w-36 mt-1 rounded-lg border border-slate-300 px-3 py-2" inputMode="decimal" value={value} onChange={e=>{setValue(e.target.value);setConfirmed(false);}} placeholder="0.95" required />
        </label>
      </div>
      <label className="text-xs flex items-start gap-2"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} />
        He comprobado que la cifra corresponde a este jugador, club, temporada, competición e indicador, y que el enlace permite contrastarla.</label>
      <button className="w-fit rounded-lg bg-[#003399] text-white px-4 py-2 text-sm font-semibold disabled:opacity-40" type="submit" disabled={disabled||busy||!valid}>{busy?"Guardando...":"Añadir candidato a revisión"}</button>
      {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
      {message&&<p role="status" className="text-sm text-blue-800">{message}</p>}
      <p className="text-xs text-slate-500">Solo se crean propuestas de revisión. No se sobreescriben valores existentes ni se confunden estadísticas totales con tasas por 90. Los informes pueden ofrecer cobertura parcial.</p>
    </form>}
  </section>;
}
