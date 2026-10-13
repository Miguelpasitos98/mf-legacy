import React, { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowRight, BarChart3, Database, Search, Shield, Trophy, Upload, Users, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { usePlayersQuery, useTeamsQuery } from "@/hooks/useSharedData";
import { metricGroups, normalizeLabel, metricLabel } from "@/utils/statsImport";
import StatsImport from "@/components/stats/StatsImport";

const unpack = result => Array.isArray(result) ? result : result?.items || result?.data || result?.results || [];
const options = Array.from({length:12},(_,i)=>{const y=2027-i;return (y-1)+"/"+y;});
const num = value => value===null || value===undefined || value==="" ? null : Number.isFinite(Number(value))?Number(value):null;
const show = (value,digits=0) => value===null || value===undefined || !Number.isFinite(Number(value))?"—":Number(value).toLocaleString("es-ES",{minimumFractionDigits:digits,maximumFractionDigits:digits});
const teamLogo=t=>String(t?.logo||t?.logo_url||"");
const playerPhoto=p=>String(p?.card_photo_url||p?.cardPhotoUrl||p?.photo_url||p?.photoUrl||"");
const playerUID=p=>String(p?.fm26_uid||p?.fm26_unique_id||"");
const parseData = (item) => ({...item,metrics:Array.isArray(item.metrics)?item.metrics:[]});
const getMetric = (row,name) => {
  if(!row)return null;
  const aliases={goals:["goals","goles"],assists:["assists","asistencias"],xg:["xg","expectedgoals"],xa:["xa","expectedassists"],shots:["shots","tiros"],tackles:["tackles","entradas"],rating:["rating"],saves:["saves"],recoveries:["recoveries"]};
  if(name==="rating" && num(row.rating)!==null)return num(row.rating);
  const keys=aliases[name]||[normalizeLabel(name)];
  const m=(row.metrics||[]).find(m=>keys.includes(normalizeLabel(m.name)));
  return m?num(m.value):null;
};
const CAT_TABS=["Resumen","Ataque","Creación","Defensa","Portería","Físico"];
const useStatsRows=(season,competition,revision)=>{
  const [fetched,setFetched]=useState([]);
  const [next,setNext]=useState(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const load=async(cursor=null)=>{
    if(busy)return;
    setBusy(true);setError("");
    try{
      const filter={};
      if(season!=="Todas")filter.season=season;
      if(competition!=="Todas")filter.competition=competition;
      const args={limit:500,...(cursor?{cursor}:{})};
      const r=Object.keys(filter).length?await base44.entities.PlayerSeasonStats.filter(filter,args):await base44.entities.PlayerSeasonStats.list(args);
      const data=unpack(r).map(parseData);
      setFetched(prev=>cursor?[...prev,...data]:data);
      setNext(r?.next_cursor||r?.nextCursor||r?.cursor||null);
    }catch(e){setError(e.message||String(e));}
    finally{setBusy(false);}
  };
  useEffect(()=>{setFetched([]);setNext(null);let ignore=false;
    const fetch=async()=>{setBusy(true);setError("");
      try{const filter={};if(season!=="Todas")filter.season=season;if(competition!=="Todas")filter.competition=competition;
        const r=Object.keys(filter).length?await base44.entities.PlayerSeasonStats.filter(filter,{limit:500}):await base44.entities.PlayerSeasonStats.list({limit:500});
        if(!ignore){setFetched(unpack(r).map(parseData));setNext(r?.next_cursor||r?.nextCursor||null);}
      }catch(e){if(!ignore)setError(e.message||String(e));}
      finally{if(!ignore)setBusy(false);}
    };fetch();return()=>{ignore=true;};
  },[season,competition,revision]);
  return {rows:fetched,hasMore:Boolean(next),loadMore:()=>load(next),busy,error};
};
function Avatar({name,photo,size="md"}) {
  const [broken,setBroken]=useState(false);
  const classes=size==="lg"?"h-16 w-16":"h-9 w-9";
  return <div className={classes+" flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#e9f0f9] font-black text-[#31557b]"}>{photo&&!broken?<img src={photo} alt="" className="h-full w-full object-cover" loading="lazy" onError={()=>setBroken(true)}/>:String(name||"?").slice(0,2).toUpperCase()}</div>;
}
function TeamBadge({teamName,logo}){const [broken,setBroken]=useState(false);return <span className="inline-flex max-w-[170px] items-center gap-2">{logo&&!broken?<img src={logo} alt="" className="h-5 w-5 object-contain" onError={()=>setBroken(true)}/>:<Shield size={16} className="text-slate-300"/>}<span className="truncate">{teamName||"Sin equipo"}</span></span>;}
function StatDetail({player,stats,teams,onClose,onPlayer,onTeam}) {
  const [season,setSeason]=useState("Todas"),[competition,setCompetition]=useState("Todas"),[category,setCategory]=useState("Resumen");
  const seasons=[...new Set(stats.map(s=>s.season))].sort().reverse();
  const seasonRows=stats.filter(s=>season==="Todas"||s.season===season);
  const competitions=[...new Set(seasonRows.map(s=>s.competition))].sort();
  const rows=seasonRows.filter(s=>competition==="Todas"||s.competition===competition);
  const byTeam=new Map(teams.map(t=>[String(t.id),t]));
  const aggregated=()=>{
    const out={};for(const key of ["goals","assists","xg","xa","shots","tackles","recoveries"]){let count=0,total=0;for(const r of rows){const n=getMetric(r,key);if(n!==null){total+=n;count++;}}out[key]=count?{value:total,count}:null;}return out;
  };
  const sums=aggregated();
  const selected=metricGroups.find(x=>x[0]===category)?.[1]||[];
  return <div className="fixed inset-0 z-[450] flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Ficha estadística">
    <div className="flex max-h-[93vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
      <div className="flex items-center gap-4 bg-[#0e2844] p-5 text-white"><Avatar size="lg" name={player?.name||stats[0]?.player_name} photo={playerPhoto(player)}/>
      <div className="min-w-0 flex-1"><p className="text-[10px] uppercase tracking-[.2em] text-blue-200">MY LEGACY · INFORME DE RENDIMIENTO</p><h2 className="truncate text-2xl font-black">{player?.name||stats[0]?.player_name||"Jugador FotMob"}</h2><p className="text-xs text-blue-200">Estadísticas reales importadas · Separadas de las valoraciones FM26</p></div>
      {player&&<button onClick={()=>onPlayer(player.id)} className="hidden rounded-lg border border-blue-300 px-4 py-2 text-xs font-bold hover:bg-white/10 sm:block">Ver ficha en PLAYERS <ArrowRight size={13} className="ml-1 inline"/></button>}
      <button className="rounded-lg p-2 hover:bg-white/10" onClick={onClose} aria-label="Cerrar"><X size={21}/></button></div>
      <div className="flex-1 overflow-y-auto p-5">
        <div className="mb-5 flex flex-wrap items-end gap-3">
          <label className="text-xs font-bold text-slate-500">Temporada<select className="mt-1 block min-w-32 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800" value={season} onChange={e=>{setSeason(e.target.value);setCompetition("Todas");}}><option>Todas</option>{seasons.map(x=><option key={x}>{x}</option>)}</select></label>
          <label className="text-xs font-bold text-slate-500">Competición<select className="mt-1 block min-w-44 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800" value={competition} onChange={e=>setCompetition(e.target.value)}><option>Todas</option>{competitions.map(x=><option key={x}>{x}</option>)}</select></label>
          <span className="ml-auto rounded-full bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800">{rows.length} registros · {new Set(rows.map(r=>r.season)).size} temporadas</span>
        </div>
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
          {[["Goles",sums.goals],["Asistencias",sums.assists],["xG",sums.xg],["xA",sums.xa],["Tiros",sums.shots]].map(([label,d])=><div key={label} className="rounded-xl bg-slate-50 p-4"><div className="text-[10px] font-bold uppercase text-slate-500">{label}</div><div className="mt-1 text-2xl font-black text-[#0d315b]">{d?show(d.value,["xG","xA"].includes(label)?2:0):"—"}</div><p className="text-[10px] text-slate-400">{d?"Subtotal de "+d.count+" registros":"No disponible"}</p></div>)}
        </div>
        <p className="mb-4 text-xs text-slate-500">Los totales suman únicamente métricas acumulativas de las competiciones cargadas. No se suman porcentajes, notas, percentiles ni valores de mercado. La ausencia de una métrica no equivale a cero.</p>
        <div className="mb-3 flex flex-wrap gap-2">{CAT_TABS.map(x=><button key={x} onClick={()=>setCategory(x)} className={"rounded-lg px-3 py-2 text-xs font-bold "+(category===x?"bg-[#003399] text-white":"border border-slate-200 bg-white text-slate-700 hover:bg-slate-50")}>{x}</button>)}</div>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[620px] text-left text-xs"><thead className="bg-[#eaf0f8] text-slate-700"><tr><th className="px-4 py-3">Temporada / competición</th><th className="px-4 py-3">Club en esa temporada</th><th className="px-4 py-3">PJ</th><th className="px-4 py-3">Min</th><th className="px-4 py-3">Nota</th>{selected.map(id=><th key={id} className="whitespace-nowrap px-4 py-3">{metricLabel(id)}</th>)}</tr></thead>
          <tbody>{rows.length?rows.map(r=><tr key={r.id||r.external_record_id} className="border-t border-slate-100 hover:bg-slate-50"><td className="px-4 py-3 font-semibold">{r.season}<div className="font-normal text-slate-500">{r.competition}</div></td><td className="px-4 py-3">{r.team_id?<button onClick={()=>onTeam(r.team_id)} className="hover:underline"><TeamBadge teamName={r.team_name} logo={teamLogo(byTeam.get(String(r.team_id)))}/></button>:<TeamBadge teamName={r.team_name} logo={teamLogo(byTeam.get(String(r.team_id)))}/>}</td><td className="px-4 py-3">{show(r.appearances)}</td><td className="px-4 py-3">{show(r.minutes)}</td><td className="px-4 py-3">{show(r.rating,2)}</td>{selected.map(id=><td key={id} className="px-4 py-3 font-semibold">{show(getMetric(r,id),["xg","xa","xgot"].includes(id)?2:0)}</td>)}</tr>):<tr><td colSpan={5+selected.length} className="p-8 text-center text-slate-500">No hay registros para esta selección.</td></tr>}</tbody></table>
        </div>
        {rows.some(r=>r.metrics?.length>0)&&<section className="mt-5 rounded-xl border border-slate-200 p-4"><h3 className="mb-3 font-black text-slate-800">Todas las métricas importadas</h3>{rows.slice(0,10).map(r=><div key={r.external_record_id} className="mb-3 border-b border-slate-100 pb-3"><p className="mb-2 text-xs font-bold text-blue-900">{r.season} · {r.competition} · {r.team_name||"Club sin vincular"}</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">{r.metrics.map((m,i)=><div key={i} className="rounded-lg bg-slate-50 px-3 py-2"><p className="text-[11px] text-slate-500">{metricLabel(m.name)}</p><p className="font-extrabold">{show(m.value,Number(m.value)%1?2:0)}</p></div>)}</div></div>)}</section>}
      </div>
      <div className="flex justify-between border-t border-slate-200 bg-slate-50 px-5 py-3"><span className="text-xs text-slate-500">Fuente: archivos importados desde FotMob Studio. Revisar procedencia y autorizaciones de uso.</span><button onClick={onClose} className="rounded-lg bg-[#003399] px-5 py-2 text-xs font-bold text-white">Cerrar</button></div>
    </div>
  </div>;
}
export default function Stats(){
  const navigate=useNavigate(),queryClient=useQueryClient();
  const pq=usePlayersQuery(),tq=useTeamsQuery();
  const [season,setSeason]=useState("2025/2026"),[competition,setCompetition]=useState("Todas"),[search,setSearch]=useState("");
  const [tab,setTab]=useState("todos"),[category,setCategory]=useState("Resumen"),[sort,setSort]=useState("rating"),[importOpen,setImportOpen]=useState(false),[selected,setSelected]=useState(null),[revision,setRevision]=useState(0),[page,setPage]=useState(0);
  const {rows,hasMore,loadMore,busy,error}=useStatsRows(season,competition,revision);
  const players=pq.data||[],teams=tq.data||[];
  const byID=useMemo(()=>new Map(players.map(p=>[String(p.id),p])),[players]);
  const byTeam=useMemo(()=>new Map(teams.map(t=>[String(t.id),t])),[teams]);
  const stats=useMemo(()=>rows.filter(r=>r.player_id),[rows]);
  const competitions=useMemo(()=>[...new Set(rows.map(r=>r.competition))].filter(Boolean).sort(),[rows]);
  const visible=useMemo(()=>{
    let rs=stats.map(r=>({record:r,player:byID.get(String(r.player_id))||null}));
    if(tab==="todos"){
      const ids=new Set(stats.map(r=>String(r.player_id)));
      rs=rs.concat(players.filter(p=>!ids.has(String(p.id))).map(p=>({record:null,player:p})));
    }
    const q=normalizeLabel(search);
    if(q)rs=rs.filter(({record:r,player:p})=>[r?.player_name,p?.name,r?.team_name,byTeam.get(String(p?.team_id))?.name,r?.fotmob_player_id,playerUID(p)].some(v=>normalizeLabel(v).includes(q)));
    rs.sort((a,b)=>{const av=sort==="rating"?num(a.record?.rating):getMetric(a.record,sort);const bv=sort==="rating"?num(b.record?.rating):getMetric(b.record,sort);return (bv??-Infinity)-(av??-Infinity)||String(a.player?.name||a.record?.player_name||"").localeCompare(String(b.player?.name||b.record?.player_name||""),"es")});
    return rs;
  },[stats,players,tab,search,sort,byID,byTeam]);
  const filtered=visible.slice(page*50,(page+1)*50);
  const [detailRows,setDetailRows]=useState([]),[detailLoading,setDetailLoading]=useState(false);
  const openDetail=async(row)=>{
    setSelected(row);setDetailRows([]);setDetailLoading(true);
    try{const filter=row.player?{player_id:String(row.player.id)}:{fotmob_player_id:row.record.fotmob_player_id};
      const r=await base44.entities.PlayerSeasonStats.filter(filter,{limit:500});
      setDetailRows(unpack(r).map(parseData));
    }catch{setDetailRows(row.record?[row.record]:[]);}
    finally{setDetailLoading(false);}
  };
  const columns=metricGroups.find(group=>group[0]===category)?.[1]||[];
  const importComplete=()=>{setRevision(x=>x+1);queryClient.invalidateQueries({queryKey:["mf-legacy","stats"]});};
  return <div className="h-full w-full overflow-y-auto bg-[#f3f5f8]">
    <div className="border-b border-[#dfe6ee] bg-white px-6 pb-6 pt-6 md:px-9"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[.23em] text-[#003399]"><span className="h-px w-7 bg-[#003399]"/> THE DATA ROOM</div><h1 className="font-heading text-4xl font-black tracking-tight text-[#10253d]">Player Stats</h1><p className="mt-2 text-sm text-slate-500">Rankings y rendimiento por temporada · Jugadores conectados con MY LEGACY</p></div><button onClick={()=>setImportOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-[#003399] px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#002777]"><Upload size={17}/> Importar CSV / JSON</button></div>
    <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{[["Jugadores en MY LEGACY",players.length,Users],["Etapas estadísticas cargadas",stats.length,Database],["Jugadores con datos",new Set(stats.map(r=>r.player_id)).size,BarChart3],["Competiciones visibles",new Set(stats.map(r=>r.competition)).size,Trophy]].map(([label,val,Icon])=><div key={label} className="flex items-center gap-3 rounded-xl border border-[#e6ebf2] bg-[#f9fbfd] px-4 py-3"><Icon size={19} className="text-[#003399]"/><div><p className="text-[11px] font-semibold text-slate-500">{label}</p><p className="text-xl font-black text-[#0a2948]">{show(val)}</p></div></div>)}</div></div>
    <div className="space-y-4 px-6 py-5 md:px-9">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex flex-wrap gap-3"><label className="text-[11px] font-bold text-slate-500">TEMPORADA<select className="mt-1 block min-w-36 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-[#193a5b]" value={season} onChange={e=>{setSeason(e.target.value);setCompetition("Todas");setPage(0);}}><option>Todas</option>{options.map(x=><option key={x}>{x}</option>)}</select></label><label className="text-[11px] font-bold text-slate-500">COMPETICIÓN<select className="mt-1 block min-w-40 rounded-lg border border-slate-200 px-3 py-2 text-sm" value={competition} onChange={e=>{setCompetition(e.target.value);setPage(0);}}><option>Todas</option>{competitions.map(x=><option key={x}>{x}</option>)}</select></label><label className="min-w-[220px] flex-1 text-[11px] font-bold text-slate-500">BUSCAR JUGADOR, CLUB O ID<div className="mt-1 flex items-center gap-2 rounded-lg border border-slate-200 px-3"><Search size={16} className="text-slate-400"/><input value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}} className="w-full bg-transparent py-2 text-sm font-normal outline-none" placeholder="Buscar en MY LEGACY…"/></div></label><label className="text-[11px] font-bold text-slate-500">ORDENAR<select className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm" value={sort} onChange={e=>{setSort(e.target.value);setPage(0);}}><option value="rating">Nota FotMob</option><option value="goals">Goles</option><option value="assists">Asistencias</option><option value="xg">xG</option><option value="xa">xA</option><option value="tackles">Entradas</option></select></label></div></div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">STAT COLUMNS</p><div className="flex flex-wrap gap-2">{CAT_TABS.map(label=><button key={label} onClick={()=>{setCategory(label);setPage(0);}} className={"rounded-lg px-4 py-2 text-xs font-bold "+(category===label?"bg-[#102e23] text-white":"border border-slate-200 text-slate-700 hover:bg-slate-50")}>{label}</button>)}</div></div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3"><div className="flex items-center gap-2"><button onClick={()=>{setTab("todos");setPage(0);}} className={"rounded-lg px-3 py-2 text-xs font-bold "+(tab==="todos"?"bg-[#e7edfa] text-[#003399]":"text-slate-500")}>Todos los jugadores</button><button onClick={()=>{setTab("con");setPage(0);}} className={"rounded-lg px-3 py-2 text-xs font-bold "+(tab==="con"?"bg-[#e7edfa] text-[#003399]":"text-slate-500")}>Con estadísticas</button></div><p className="text-xs text-slate-500">{visible.length.toLocaleString("es")} filas mostradas · {rows.length} registros consultados {hasMore?"(hay más)":""}</p></div>
      {error&&<div className="border-b border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">Error al cargar estadísticas: {error}</div>}
      <div className="max-w-full overflow-x-auto"><table className="w-full min-w-[920px] text-left text-xs"><thead className="bg-[#102e23] text-white"><tr><th className="px-3 py-3">#</th><th className="min-w-[190px] px-3 py-3">JUGADOR</th><th className="px-3 py-3">EQUIPO</th><th className="px-3 py-3">TEMPORADA</th><th className="px-3 py-3">COMPETICIÓN</th><th className="px-3 py-3 text-right">PJ</th><th className="px-3 py-3 text-right">MIN</th><th className="px-3 py-3 text-right">NOTA</th>{columns.map(id=><th key={id} className="whitespace-nowrap px-3 py-3 text-right">{metricLabel(id)}</th>)}<th className="px-3 py-3">FICHA</th></tr></thead>
      <tbody>{filtered.map(({record:r,player:p},i)=>{const team=byTeam.get(String(r?.team_id||p?.team_id||""));return <tr key={(r?.id||r?.external_record_id||p?.id||"")+":"+i} className="border-b border-slate-100 odd:bg-white even:bg-[#f6f8f6] hover:bg-[#eef3fb]"><td className="px-3 py-3 text-right font-bold text-slate-400">{page*50+i+1}</td><td className="px-3 py-2"><button onClick={()=>openDetail({record:r,player:p})} className="flex items-center gap-2 text-left"><Avatar name={p?.name||r?.player_name} photo={playerPhoto(p)}/><span><span className="block font-extrabold text-[#0f3156] hover:underline">{p?.name||r?.player_name||"Jugador"}</span><span className="text-[10px] text-slate-400">FM {playerUID(p)||"—"} · FotMob {r?.fotmob_player_id||"—"}</span></span></button></td><td className="px-3 py-2 text-slate-700">{(r?.team_id||team?.id)?<button className="hover:underline" onClick={()=>navigate("/teams?stats_team="+encodeURIComponent(r?.team_id||team?.id))}><TeamBadge teamName={r?.team_name||team?.name} logo={teamLogo(team)}/></button>:<TeamBadge teamName={r?.team_name||team?.name} logo={teamLogo(team)}/>}</td><td className="px-3 py-3">{r?.season||"—"}</td><td className="px-3 py-3">{r?.competition||"Sin datos"}</td><td className="px-3 py-3 text-right">{show(r?.appearances)}</td><td className="px-3 py-3 text-right">{show(r?.minutes)}</td><td className="px-3 py-3 text-right font-bold">{show(r?.rating,2)}</td>{columns.map(id=><td key={id} className="px-3 py-3 text-right">{show(getMetric(r,id),["xg","xa","xgot"].includes(id)?2:0)}</td>)}<td className="px-3 py-3"><button onClick={()=>openDetail({record:r,player:p})} className="rounded-lg border border-blue-200 px-3 py-2 font-bold text-[#003399] hover:bg-blue-50">Ver stats</button></td></tr>})}
      {!filtered.length&&<tr><td colSpan={9+columns.length} className="px-6 py-12 text-center"><Database className="mx-auto mb-3 text-slate-300" size={36}/><p className="font-bold text-slate-600">Todavía no hay estadísticas para estos filtros</p><p className="mt-1 text-xs text-slate-400">Puedes cambiar los filtros o importar archivos de FotMob Studio.</p></td></tr>}</tbody></table></div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"><p className="text-xs text-slate-500">Página {page+1} · Los campos no disponibles se indican con —</p><div className="flex gap-2">{page>0&&<button onClick={()=>setPage(x=>x-1)} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold">Anterior</button>}{(page+1)*50<visible.length&&<button onClick={()=>setPage(x=>x+1)} className="rounded-lg bg-[#003399] px-4 py-2 text-xs font-bold text-white">Siguiente</button>}{hasMore&&<button disabled={busy} onClick={loadMore} className="rounded-lg border border-blue-300 px-4 py-2 text-xs font-bold text-[#003399] disabled:opacity-40">Cargar 500 más</button>}</div></div></div>
      <p className="pb-5 text-xs text-slate-500">Estadísticas asociadas exclusivamente a IDs confirmados. Los atributos de Football Manager permanecen en PLAYERS y nunca se modifican al importar estadísticas. Las cifras pueden requerir revisión y permisos de reutilización antes de publicarse.</p>
    </div>
    {importOpen&&<StatsImport players={players} teams={teams} onClose={()=>setImportOpen(false)} onImported={importComplete}/>}
    {selected&&<StatDetail player={selected.player} stats={detailRows.length?detailRows:selected.record?[selected.record]:[]} teams={teams} onClose={()=>setSelected(null)} onPlayer={id=>{setSelected(null);navigate("/players?stats_player="+encodeURIComponent(id));}} onTeam={id=>{setSelected(null);navigate("/teams?stats_team="+encodeURIComponent(id));}}/>}
  </div>;
}

