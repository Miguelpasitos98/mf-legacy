import React, {useEffect, useState} from "react";
import {base44} from "@/api/base44Client";

const LEAGUES=[
  ["La_Liga","LaLiga"],["EPL","Premier League"],["Bundesliga","Bundesliga"],
  ["Serie_A","Serie A"],["Ligue_1","Ligue 1"],["RFPL","Liga rusa"]
];
const YEARS=Array.from({length:new Date().getFullYear()-2013},(_,i)=>2014+i).reverse();
const fmt=v=>v===null||v===undefined||!Number.isFinite(Number(v))?"—":Number(v).toLocaleString("es-ES",{maximumFractionDigits:3});
const err=e=>e?.response?.data?.error||e?.message||"No se pudo completar la consulta";

export default function UnderstatLivePanel({player,linked,fotmobId,onApplied}){
  const [league,setLeague]=useState("La_Liga");
  const [season,setSeason]=useState("2016");
  const [busy,setBusy]=useState("");
  const [leagueResult,setLeagueResult]=useState(null);
  const [playerResult,setPlayerResult]=useState(null);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  useEffect(()=>{
    setLeagueResult(null);setPlayerResult(null);setError("");setNotice("");
  },[league,season,player?.id,fotmobId]);
  const invoke=async action=>{
    if(busy)return;
    setBusy(action);setError("");setNotice("");
    try{
      const data=(await base44.functions.invoke("understat-live",{
        action,league,season,
        ...(action==="preview-league"?{}:{player_id:player?.id,fotmob_player_id:fotmobId}),
        ...(action==="apply-player"?{confirm_apply:true}:{})
      }))?.data||{};
      if(!data.ok)throw Error(data.error||"La fuente no ha respondido");
      if(action==="preview-league"){setLeagueResult(data);setPlayerResult(null);}
      if(action==="preview-player")setPlayerResult(data);
      if(action==="apply-player"){
        setPlayerResult(null);
        setNotice("Understat directo: "+(data.saved||0)+" temporadas nuevas, "+(data.updated||0)+
          " completadas y "+(data.unchanged||0)+" sin cambios. Nunca se han reemplazado métricas existentes.");
        await onApplied?.();
      }
    }catch(e){setError(err(e));}
    finally{setBusy("");}
  };
  return <section className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3" aria-label="Understat directo">
    <div>
      <h3 className="font-semibold text-sm text-[#003399]">Understat directo · beta</h3>
      <p className="text-[11px] text-slate-600 mt-1">
        Consulta Understat sin CSV ni trabajador local. Primero se muestran los datos; guardar exige una vinculación FotMob confirmada y coincidencias históricas verificables.
      </p>
    </div>
    <div className="grid grid-cols-2 gap-2">
      <label className="text-xs font-medium">Liga
        <select aria-label="Liga de Understat" value={league} disabled={!!busy} onChange={e=>setLeague(e.target.value)}
          className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm">
          {LEAGUES.map(([id,name])=><option key={id} value={id}>{name}</option>)}
        </select>
      </label>
      <label className="text-xs font-medium">Temporada
        <select aria-label="Temporada de Understat" value={season} disabled={!!busy} onChange={e=>setSeason(e.target.value)}
          className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm">
          {YEARS.map(y=><option key={y} value={y}>{y}/{y+1}</option>)}
        </select>
      </label>
    </div>
    <button type="button" disabled={!!busy} onClick={()=>invoke("preview-league")}
      className="w-full rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-semibold text-[#003399] disabled:opacity-40">
      {busy==="preview-league"?"Consultando Understat…":"Comprobar conexión y ver jugadores"}
    </button>
    {leagueResult&&<div className="rounded-lg border border-emerald-200 bg-white p-3 space-y-2">
      <p className="text-xs font-semibold text-emerald-800">Conexión correcta · {leagueResult.player_count} jugadores · {leagueResult.season}</p>
      <details className="text-xs">
        <summary className="cursor-pointer text-[#003399] font-medium">Ver una muestra de los jugadores e IDs</summary>
        <div className="mt-2 max-h-52 overflow-auto">
          <table className="min-w-full text-left text-[11px]">
            <thead><tr className="border-b"><th className="py-1">Jugador · ID</th><th>Chain /90</th><th>Buildup /90</th></tr></thead>
            <tbody>{(leagueResult.preview||[]).map(row=><tr className="border-b" key={row.understat_id}>
              <td className="py-1">{row.name}<span className="block text-slate-400">{row.understat_id} · {row.team}</span></td>
              <td>{fmt(row.xg_chain_p90)}</td><td>{fmt(row.xg_buildup_p90)}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </details>
    </div>}
    {player&&<button type="button" disabled={!!busy||!linked} onClick={()=>invoke("preview-player")}
      className="w-full rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-semibold text-[#003399] disabled:opacity-40">
      {busy==="preview-player"?"Verificando temporadas…":"Previsualizar datos para "+player.name}
    </button>}
    {player&&!linked&&<p className="text-[11px] text-amber-800">Para incorporar estadísticas a {player.name}, primero confirma su ID FotMob en PLAYERS.</p>}
    {playerResult&&<div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3 text-xs">
      <p className="font-semibold text-slate-800">{playerResult.status==="verified"?"Identidad verificada · Understat ID "+playerResult.understat_id:"Pendiente de vinculación segura"}</p>
      {playerResult.status!=="verified"&&<p className="text-amber-800">{playerResult.reason||"No se ha podido vincular este jugador con seguridad."}</p>}
      {playerResult.status==="verified"&&<>
        <p className="text-slate-600">{playerResult.matches} coincidencias históricas verificadas · {(playerResult.plan||[]).length} temporadas examinadas</p>
        <div className="max-h-52 overflow-auto">
          {(playerResult.plan||[]).map(r=><div key={r.season} className="flex items-center justify-between gap-2 border-b py-1.5">
            <span><strong>{r.season}</strong><span className="block text-slate-500">
              Chain /90 {fmt(r.xg_chain_p90)} · Buildup /90 {fmt(r.xg_buildup_p90)}
            </span></span>
            <span className="shrink-0 text-slate-600">{({create:"Nueva",complete:"Completar",review:"Revisar",unchanged:"Sin cambios"})[r.action]||r.action}</span>
          </div>)}
        </div>
        {(playerResult.skipped||[]).length>0&&<details><summary className="cursor-pointer text-amber-800">{playerResult.skipped.length} temporadas excluidas o pendientes</summary>
          {(playerResult.skipped||[]).map((r,i)=><p key={i} className="mt-1">{r.season}: {r.reason}</p>)}
        </details>}
        {playerResult.can_apply&&<button type="button" disabled={!!busy||!linked} onClick={()=>invoke("apply-player")}
          className="w-full rounded-lg bg-[#003399] px-3 py-2 font-semibold text-white disabled:opacity-40">
          {busy==="apply-player"?"Aplicando…":"Aplicar solo datos que faltan"}
        </button>}
        <a href={playerResult.source_url} target="_blank" rel="noopener noreferrer" className="inline-block text-[#003399] underline">Ficha de origen en Understat</a>
      </>}
    </div>}
    {error&&<p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs text-rose-800">{error}</p>}
    {notice&&<p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-900">{notice}</p>}
    <p className="text-[11px] text-slate-500">Si Understat no responde, el importador histórico anterior sigue disponible. Las consultas en directo cubren ligas, no todas las competiciones.</p>
  </section>;
}
