import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { aggregate, defaultSeason, groupStatRows, nationalCompetition, resolveTeam, seasonActive } from "@/utils/statsViews";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, ClipboardPaste, Copy, Database, Search, Shield, Settings2, Upload, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { usePlayersQuery, useTeamsQuery } from "@/hooks/useSharedData";
import { normalizeLabel, metricLabel } from "@/utils/statsImport";
import StatsImport from "@/components/stats/StatsImport";
import HistoricalSingleEntryImporter from "@/components/stats/HistoricalSingleEntryImporter";
import HistoricalValuationsTable from "@/components/stats/HistoricalValuationsTable";
import { useHistoricalValuations } from "@/hooks/useHistoricalValuations";
import { useTeamMatchesLookup } from "@/hooks/useTeamMatchesLookup";
import ImportUnified from "@/pages/ImportUnified";
import SeasonStatsTable from "@/components/stats/SeasonStatsTable";
import SortHeader from "@/components/stats/SortHeader";
import {nextSorting,sortStatsItems,defaultSortDirection} from "@/utils/statsSort";
import StatsColumnSettings from "@/components/stats/StatsColumnSettings";
import TeamLinkPicker from "@/components/stats/TeamLinkPicker";
import {initialConfig,sanitizeConfig,getColumn,columnValue,RAW_METRICS} from "@/utils/statsColumns";
import {bestSeasonPerPlayer} from "@/utils/statsBestSeason";
import {buildSeasonSummaries} from "@/utils/statsSeason";
import {rankPositions,rankIdentity,playerRankPositions} from "@/utils/statsRank";
import {useCraftedfcSnapshot} from "@/hooks/useCraftedfcSnapshot";
import CraftedfcOverview from "@/components/stats/CraftedfcOverview";
import CraftedfcAnalysis from "@/components/stats/CraftedfcAnalysis";
import CraftedfcCompare from "@/components/stats/CraftedfcCompare";

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
  useEffect(()=>{let ignore=false;setFetched([]);setNext(null);
    const fetch=async()=>{setBusy(true);setError("");
      try{
        const filter={};if(season!=="Todas")filter.season=season;if(competition!=="Todas")filter.competition=competition;
        let cursor=null,continuation=null,all=[];
        // Todas las temporadas se cargan con paginación real de Base44.
        // 40 páginas (20.000 registros) para evitar solicitudes interminables; el resto queda cargable manualmente.
        for(let index=0;index<40&&!ignore;index++){
          const options={limit:500,...(cursor?{cursor}:{})};
          const response=Object.keys(filter).length?await base44.entities.PlayerSeasonStats.filter(filter,options):await base44.entities.PlayerSeasonStats.list(options);
          const page=unpack(response).map(parseData);
          all=all.concat(page);
          const nextCursor=response?.next_cursor||response?.nextCursor||null;
          continuation=nextCursor&&nextCursor!==cursor?nextCursor:null;
          if(!ignore){setFetched([...all]);setNext(continuation);}
          if(!continuation||page.length===0)break;
          cursor=continuation;
        }
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
function StatDetail({player,stats,teams,initialSeason,onClose,onPlayer,onLinkTeams,onOpenSettings,onSetTeamMatches,config}) {
  const seasons=useMemo(()=>[...new Set(stats.map(s=>s.season).filter(Boolean))].sort().reverse(),[stats]);
  const {valuations:historicalValuations,loading:historicalLoading,refresh:historicalRefresh}=useHistoricalValuations(player?.id||stats[0]?.player_id);
  const {getTeamMatches,refresh:refreshTeamMatches}=useTeamMatchesLookup(stats);
  const [valuationImporterOpen,setValuationImporterOpen]=useState(false);
  const fotmobPlayerId=stats[0]?.fotmob_player_id||"";
  const [copySeasonsStatus,setCopySeasonsStatus]=useState("");
  const copySeasonsForValuation=async()=>{
    const name=String(player?.name||stats[0]?.player_name||"").trim();
    if(!name||!seasons.length){setCopySeasonsStatus("No hay temporadas disponibles para copiar.");return;}
    const text=["Jugador | Temporada",...seasons.slice().reverse().map(s=>name+" | "+s)].join("\n");
    try{
      await navigator.clipboard.writeText(text);
      setCopySeasonsStatus("Copiado: "+seasons.length+" temporadas. Pégalo en otro chat.");
    }catch{
      try{
        const area=document.createElement("textarea");area.value=text;area.style.position="fixed";area.style.opacity="0";document.body.appendChild(area);area.select();
        const copied=document.execCommand("copy");document.body.removeChild(area);
        if(!copied)throw Error("No disponible");
        setCopySeasonsStatus("Copiado: "+seasons.length+" temporadas. Pégalo en otro chat.");
      }catch{setCopySeasonsStatus("El navegador ha bloqueado la copia. Revisa sus permisos de portapapeles.");}
    }
  };
  const [section,setSection]=useState("performance");
  const {snapshot:cfcSnapshot,status:cfcStatus}=useCraftedfcSnapshot(player?.id);
  const [season,setSeason]=useState("auto");
  const activeSeason=season==="auto"?defaultSeason(stats,initialSeason):season;
  const [competition,setCompetition]=useState("Todas");
  const [scope,setScope]=useState("clubs");
  const [category,setCategory]=useState("Resumen");
  const [teamLinkTarget,setTeamLinkTarget]=useState(null);
  const [teamMatchesTarget,setTeamMatchesTarget]=useState(null);
  const [teamMatchesValue,setTeamMatchesValue]=useState("");
  const [teamMatchesBusy,setTeamMatchesBusy]=useState(false);
  const [teamMatchesError,setTeamMatchesError]=useState("");
  const editTeamMatches=record=>{setTeamMatchesTarget(record);setTeamMatchesValue(record.team_matches==null?"":String(record.team_matches));setTeamMatchesError("");};
  const saveTeamMatches=async event=>{
    event.preventDefault();
    const matches=Number(teamMatchesValue);
    if(!Number.isInteger(matches)||matches<1||matches>200){setTeamMatchesError("Introduce un número entero de 1 a 200.");return;}
    setTeamMatchesBusy(true);setTeamMatchesError("");
    try{await onSetTeamMatches(teamMatchesTarget,matches);setTeamMatchesTarget(null);}
    catch(error){setTeamMatchesError(error?.message||"No se pudo guardar el número de partidos.");}
    finally{setTeamMatchesBusy(false);}
  };
  const byTeam=useMemo(()=>new Map(teams.map(t=>[String(t.id),t])),[teams]);
  const uniqueRecords=useMemo(()=>groupStatRows(stats),[stats]);
  const seasonRows=uniqueRecords.filter(s=>activeSeason==="Todas"||s.season===activeSeason);
  const competitions=[...new Set(seasonRows.map(s=>s.competition))].sort();
  const shown=seasonRows.filter(r=>(scope==="all"||!nationalCompetition(r.competition))&&(competition==="Todas"||r.competition===competition)).map(r=>{
    const tm=getTeamMatches(r);
    return tm?{...r,team_matches:tm.team_matches,_teamMatchesSource:"team"}:r;
  });
  const sums=aggregate(shown);
  const summaryBasics=aggregate(shown,["appearances","minutes"]);
  const ratingRows=shown.filter(r=>num(r.rating)!==null&&num(r.appearances)>0);
  const ratedGames=ratingRows.reduce((v,r)=>v+Number(r.appearances),0);
  const estimatedRating=ratedGames?ratingRows.reduce((v,r)=>v+Number(r.rating)*Number(r.appearances),0)/ratedGames:null;
  const selected=config.columns.competition[category]||[];
  const divider=new Set(config.dividers?.competition?.[category]||[]);
  const line=id=>divider.has(id)?" border-r-[3px] border-r-blue-300":"";
  const allSeasons=activeSeason==="Todas";
  const partial=Object.values(sums).some(x=>x.partial)||ratingRows.length!==shown.length;
  const inProgress=!allSeasons&&seasonActive(activeSeason);
  const totalsTitle=allSeasons?"Subtotal histórico (no total de carrera)":competition==="Todas"?"Subtotal de temporada":"Estadísticas de la competición";
  const teamCell=r=>{
    const info=resolveTeam(r,teams,uniqueRecords);
    if(info.status==="national")return <span className="text-slate-500">Selección nacional</span>;
    const team=info.team;
    const suggested=info.status==="suggested";
    const name=team?.name||r.team_name||"Asignar club";
    const title=info.status==="confirmed"?"Pulsa el nombre para cambiar el club de esta competición":suggested?"Club sugerido, pendiente de confirmar. Pulsa para elegir el correcto.":"Pulsa para buscar y asignar el club de esta competición";
    const label=<span className="group inline-flex max-w-[195px] items-center gap-1.5 text-left">
      <TeamBadge teamName={name} logo={teamLogo(team)}/>
      {suggested&&<span className="text-[10px] font-bold text-amber-600" aria-label="Club sin confirmar">?</span>}
      {r.id&&<span className="text-[10px] text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">✎</span>}
    </span>;
    return r.id?<button type="button" onClick={()=>setTeamLinkTarget(r)} title={title} aria-label={"Cambiar club de "+r.competition+" "+r.season+": "+name} className="rounded-md py-1 text-slate-800 hover:text-[#003399] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#003399]">{label}</button>:label;
  };
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Ficha estadística">
      <div className="flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center gap-4 bg-[#0e2844] p-4 text-white sm:p-5">
          <Avatar size="lg" name={player?.name||stats[0]?.player_name} photo={playerPhoto(player)}/>
          <div className="min-w-0 flex-1"><p className="text-[10px] uppercase tracking-[.2em] text-blue-200">MY LEGACY · INFORME DE RENDIMIENTO</p>
            <h2 className="truncate text-2xl font-black">{player?.name||stats[0]?.player_name||"Jugador FotMob"}</h2>
            <p className="text-xs text-blue-200">Estadísticas importadas · pendientes de validación de fuente · independientes de FM26</p>
          </div>
          <button type="button" onClick={copySeasonsForValuation} className="inline-flex items-center gap-2 rounded-lg border border-cyan-300 bg-cyan-50 px-3 py-2 text-xs font-bold text-[#0e2844] hover:bg-cyan-100" title="Copiar nombre y todas las temporadas del jugador para valorar FIFA/FC y Transfermarkt"><Copy size={15}/> Copiar temporadas para valorar</button>
          <button type="button" onClick={()=>setValuationImporterOpen(true)} className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-[#0e2844] hover:bg-amber-100" title="Introducir individualmente FIFA/FC, Transfermarkt o PJ Equipo"><ClipboardPaste size={15}/> <span className="hidden lg:inline">Introducir datos históricos</span></button>
          <button type="button" onClick={()=>onOpenSettings(category,shown[0]||stats[0]||null)} className="inline-flex items-center gap-2 rounded-lg border border-blue-300 px-3 py-2 text-xs font-bold hover:bg-white/10" title="Configurar las columnas, los nombres y las fórmulas del desglose" aria-label="Ajustes del informe estadístico"><Settings2 size={16}/> <span className="hidden sm:inline">Ajustes</span></button>
          {player&&<button onClick={()=>onPlayer(player.id)} className="hidden rounded-lg border border-blue-300 px-4 py-2 text-xs font-bold hover:bg-white/10 sm:block">Ver ficha en PLAYERS <ArrowRight size={13} className="ml-1 inline"/></button>}
          <button className="rounded-lg p-2 hover:bg-white/10" onClick={onClose} aria-label="Cerrar"><X size={21}/></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {copySeasonsStatus&&<p role="status" className="mb-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-900">{copySeasonsStatus}</p>}
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <label className="text-xs font-bold text-slate-500">Temporada
              <select className="mt-1 block min-w-36 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800" value={activeSeason}
                onChange={e=>{setSeason(e.target.value);setCompetition("Todas");}}>
                <option value="Todas">Todas las temporadas (histórico)</option>
                {seasons.map(x=><option key={x} value={x}>{x}</option>)}
              </select>
            </label>
            <label className="text-xs font-bold text-slate-500">Competición
              <select className="mt-1 block min-w-44 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800" value={competition} onChange={e=>setCompetition(e.target.value)}>
                <option value="Todas">{activeSeason==="Todas"?"Subtotal histórico disponible":"Total temporada disponible"}</option>
                {competitions.map(x=><option key={x}>{x}</option>)}
              </select>
            </label>
            <label className="text-xs font-bold text-slate-500">Ámbito
              <select className="mt-1 block min-w-40 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" value={scope} onChange={e=>setScope(e.target.value)}>
                <option value="clubs">Solo clubes</option><option value="all">Clubes + selecciones</option>
              </select>
            </label>
            <button type="button" title="Gestionar clubes de una o varias temporadas" onClick={()=>setTeamLinkTarget("bulk")} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-[#003399]">Gestionar clubes por año…</button>
            <span className="ml-auto rounded-full bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800">{shown.length} competiciones visibles</span>
          </div>
          <div className="mb-3 flex flex-wrap gap-1">
            <button onClick={()=>setSection("overview")} className={"rounded-lg px-3 py-1.5 text-xs font-bold "+(section==="overview"?"bg-[#003399] text-white":"border border-slate-200 bg-white text-slate-700 hover:bg-slate-50")}>Overview</button>
            <button onClick={()=>setSection("performance")} className={"rounded-lg px-3 py-1.5 text-xs font-bold "+(section==="performance"?"bg-[#003399] text-white":"border border-slate-200 bg-white text-slate-700 hover:bg-slate-50")}>Performance</button>
            <button onClick={()=>setSection("craftedfc")} className={"rounded-lg px-3 py-1.5 text-xs font-bold "+(section==="craftedfc"?"bg-[#003399] text-white":"border border-slate-200 bg-white text-slate-700 hover:bg-slate-50")}>CraftedFC</button>
            <button onClick={()=>setSection("compare")} className={"rounded-lg px-3 py-1.5 text-xs font-bold "+(section==="compare"?"bg-[#003399] text-white":"border border-slate-200 bg-white text-slate-700 hover:bg-slate-50")}>Compare</button>
          </div>
          {section==="overview"&&<CraftedfcOverview snapshot={cfcSnapshot} status={cfcStatus} fotmobRating={estimatedRating}/>}
          {section==="craftedfc"&&<CraftedfcAnalysis snapshot={cfcSnapshot} status={cfcStatus} fotmobRows={shown} position={player?.position||player?.primary_position||""} historicalValuations={historicalValuations}/>}
          {section==="compare"&&<CraftedfcCompare snapshot={cfcSnapshot} status={cfcStatus} fotmobRows={shown} fotmobSummary={{...sums,appearances:summaryBasics.appearances,minutes:summaryBasics.minutes}}/>}
          {section==="performance"&&<>
          {inProgress&&<p className="mb-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">Temporada en curso: las estadísticas pueden cambiar y no representan el cierre definitivo.</p>}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="font-black text-[#123456]">{totalsTitle}</h3>
            {allSeasons&&<span className="rounded bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-900">Varias temporadas: no es una cifra oficial de carrera</span>}
            {partial&&<span className="rounded bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-900">Cobertura parcial</span>}
          </div>
          <div className="mb-3 flex flex-wrap gap-3 rounded-lg border border-slate-200 bg-[#f8fbff] px-4 py-3 text-xs text-slate-700"><span><strong>PJ:</strong> {show(summaryBasics.appearances.value)}{summaryBasics.appearances.partial?" (parcial)":""}</span><span><strong>Minutos:</strong> {show(summaryBasics.minutes.value)}{summaryBasics.minutes.partial?" (parcial)":""}</span><span><strong>Nota media aproximada:</strong> {show(estimatedRating,2)}{ratingRows.length<shown.length?" (parcial)":""}</span><span className="text-slate-500">Media ponderada por partidos; no equivale al rating Crafted.</span></div>
          <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-5">
            {[["Goles",sums.goals],["Asistencias",sums.assists],["xG",sums.xg],["xA",sums.xa],["Tiros",sums.shots]].map(([label,d])=><div key={label} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <div className="text-[10px] font-bold uppercase text-slate-500">{label}</div>
              <div className="mt-1 text-2xl font-black text-[#0d315b]">{d.value===null?"—":show(d.value,["xG","xA"].includes(label)?2:0)}</div>
              <p className="text-[10px] text-slate-500">{d.value===null?"Sin datos":d.available+"/"+d.total+" competiciones con cifra"}</p>
            </div>)}
          </div>
          <p className="mb-4 text-xs text-slate-500">Cada estadística aprovecha todos sus valores conocidos. Los cálculos /90 y Play % utilizan solo competiciones que tienen todas las variables de su fórmula y los minutos correspondientes. Los datos ausentes no se convierten en cero. Las selecciones están excluidas por defecto.</p>
          <div className="mb-3 flex flex-wrap gap-2">{CAT_TABS.map(x=><button key={x} onClick={()=>setCategory(x)} className={"rounded-lg px-3 py-2 text-xs font-bold "+(category===x?"bg-[#003399] text-white":"border border-slate-200 bg-white text-slate-700 hover:bg-slate-50")}>{x}</button>)}</div>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="bg-[#eaf0f8] text-slate-700"><tr><th className={"px-3 py-3"+line("season_competition")}>Temporada / competición</th><th className={"px-3 py-3"+line("club")}>Club en esa temporada</th><th className={"px-3 py-3"+line("appearances")}>PJ</th><th className={"px-3 py-3"+line("minutes")}>Min</th><th className={"whitespace-nowrap px-2 py-3"+line("team_matches")} title="Partidos disputados por el equipo en esta competición, a la fecha del registro; pulsa el dato para editarlo">PJ equipo</th><th className={"px-3 py-3"+line("rating")}>Nota</th>{selected.map(id=><th key={id} className={"whitespace-nowrap px-3 py-3"+line(id)}>{getColumn(config,id)?.name||metricLabel(id)}</th>)}</tr></thead>
              <tbody>{shown.length?shown.sort((a,b)=>b.season.localeCompare(a.season)||a.competition.localeCompare(b.competition)).map((r,i)=><tr key={r.id||r.external_record_id||i} className="border-t border-slate-100 hover:bg-slate-50">
                <td className={"px-3 py-3 font-semibold"+line("season_competition")}>{r.season}<div className="font-normal text-slate-500">{r.competition}</div>{r._sourceRows>1&&<span className="text-[10px] text-blue-700">Fuentes consolidadas: {r._sourceRows}</span>}</td>
                <td className={"px-3 py-3"+line("club")}>{teamCell(r)}</td>
                <td className={"px-3 py-3"+line("appearances")}>{show(r.appearances)}</td><td className={"px-3 py-3"+line("minutes")}>{show(r.minutes)}</td><td className={"px-2 py-3"+line("team_matches")}><button type="button" onClick={()=>editTeamMatches(r)} disabled={!r.id} aria-label={"Editar partidos del equipo de "+r.competition+" "+r.season} title="Editar partidos disputados por el equipo en esta competición" className="whitespace-nowrap rounded-md border border-transparent px-2 py-1 font-semibold text-[#003399] hover:border-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:text-slate-400">{r.team_matches==null?"Añadir +":show(r.team_matches)}{r._teamMatchesSource==="team"&&<span className="ml-1 text-[9px] text-emerald-600" title="PJ equipo importado a nivel de club">club</span>}</button></td><td className={"px-3 py-3"+line("rating")}>{show(r.rating,2)}</td>
                {selected.map(id=><td key={id} className={"px-3 py-3 font-semibold"+line(id)}>{show(columnValue(r,"competition",id,config),getColumn(config,id)?.decimals??0)}{columnValue(r,"competition",id,config)!==null&&getColumn(config,id)?.unit?" "+getColumn(config,id).unit:""}</td>)}
              </tr>):<tr><td colSpan={6+selected.length} className="p-8 text-center text-slate-500">No hay registros para esta selección. Cambia el ámbito o la temporada.</td></tr>}</tbody>
            </table>
          </div>
          {shown.some(r=>r.metrics?.length>0)&&<section className="mt-5 rounded-xl border border-slate-200 p-4">
            <h3 className="mb-3 font-black text-slate-800">Todas las métricas importadas</h3>
            {shown.map((r,i)=><details key={r.id||i} className="mb-2 rounded-lg border border-slate-100 bg-slate-50 p-3">
              <summary className="cursor-pointer text-xs font-bold text-blue-900">{r.season} · {r.competition} · {r.metrics?.length||0} métricas</summary>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">{(r.metrics||[]).map((m,j)=><div key={j} className="rounded-lg bg-white px-3 py-2"><p className="text-[11px] text-slate-500">{metricLabel(m.name)}</p><p className="font-extrabold">{show(m.value,Number(m.value)%1?2:0)}</p></div>)}</div>
            </details>)}
          </section>}
          </>}
          <HistoricalValuationsTable valuations={historicalValuations} loading={historicalLoading} onRefresh={historicalRefresh}/>
        </div>
        <div className="flex justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <span className="text-xs text-slate-500">Fuente: archivos FotMob Studio · registros sujetos a revisión.</span>
          <button onClick={onClose} className="rounded-lg bg-[#003399] px-5 py-2 text-xs font-bold text-white">Cerrar</button>
        </div>
      </div>
      {teamMatchesTarget&&<div className="absolute inset-0 z-[2] flex items-center justify-center bg-slate-950/65 p-4" role="dialog" aria-modal="true" aria-label="Editar partidos disputados por el equipo">
        <form onSubmit={saveTeamMatches} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div><h3 className="text-base font-black text-[#0c2e51]">Partidos del equipo</h3><p className="mt-1 text-xs text-slate-500">{teamMatchesTarget.season} · {teamMatchesTarget.competition}</p></div>
            <button type="button" onClick={()=>setTeamMatchesTarget(null)} disabled={teamMatchesBusy} aria-label="Cerrar"><X size={18}/></button>
          </div>
          <p className="text-xs text-slate-600">Indica cuántos partidos había disputado el equipo en esta competición <strong>hasta la fecha de los datos del jugador</strong>. No son los partidos jugados por el futbolista ni los programados para toda la temporada.</p>
          <label className="block text-xs font-bold text-slate-700">PJ del equipo
            <input type="number" min="1" max="200" step="1" required value={teamMatchesValue} onChange={event=>setTeamMatchesValue(event.target.value)} placeholder="Ejemplo: 22" className="mt-1 block w-full rounded-lg border border-slate-200 p-3 text-base outline-none focus:border-[#003399]"/>
          </label>
          <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-900">Play % = minutos del jugador ÷ (PJ del equipo × 90) × 100. Es una estimación de minutos reglamentarios: las prórrogas y períodos añadidos pueden alterar el porcentaje.</p>
          {teamMatchesError&&<p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{teamMatchesError}</p>}
          <div className="flex justify-end gap-2"><button type="button" onClick={()=>setTeamMatchesTarget(null)} disabled={teamMatchesBusy} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold">Cancelar</button><button type="submit" disabled={teamMatchesBusy} className="rounded-lg bg-[#003399] px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{teamMatchesBusy?"Guardando…":"Guardar PJ equipo"}</button></div>
        </form>
      </div>}
      {teamLinkTarget&&<TeamLinkPicker season={activeSeason} records={stats} teams={teams} initialRecord={teamLinkTarget==="bulk"?null:teamLinkTarget} onClose={()=>setTeamLinkTarget(null)} onApply={onLinkTeams}/>}
      <HistoricalSingleEntryImporter open={valuationImporterOpen} onClose={()=>setValuationImporterOpen(false)} player={player} fotmobPlayerId={fotmobPlayerId} fm26Uid={player?.fm26_uid||""} onSaved={()=>{historicalRefresh();refreshTeamMatches();}} stats={stats} teams={teams} initialSeason={activeSeason}/>
    </div>,document.body
  );
}
export default function Stats(){
  const navigate=useNavigate(),queryClient=useQueryClient();
  const [statsParams]=useSearchParams();
  const pq=usePlayersQuery(),tq=useTeamsQuery();
  const [season,setSeason]=useState("Todas"),[competition,setCompetition]=useState("Todas"),[search,setSearch]=useState(statsParams.get("stats_player")||"");
  const [viewMode,setViewMode]=useState("season"),[minMinutes,setMinMinutes]=useState(0);
  const [seasonDisplay,setSeasonDisplay]=useState("all"),[bestMetric,setBestMetric]=useState("rating");
  const [tab,setTab]=useState("con"),[category,setCategory]=useState("Resumen"),[sort,setSort]=useState("rating"),[sortDirection,setSortDirection]=useState("desc"),[importOpen,setImportOpen]=useState(false),[selected,setSelected]=useState(null),[revision,setRevision]=useState(0),[page,setPage]=useState(0);
  const {rows,hasMore,loadMore,busy,error}=useStatsRows(season,competition,revision);
  const [columnConfig,setColumnConfig]=useState(initialConfig);
  const [settingsOpen,setSettingsOpen]=useState(false),[settingsContext,setSettingsContext]=useState(null),[prefsRecord,setPrefsRecord]=useState(null),[prefsWarning,setPrefsWarning]=useState("");
  const [unifiedOpen,setUnifiedOpen]=useState(false);
  useEffect(()=>{let mounted=true;(async()=>{
    try{const res=await base44.entities.StatsViewPreference.list({limit:50});
      const mine=unpack(res).find(r=>r.key==="stats_layout_personal_v1");
      if(mounted&&mine){setColumnConfig(sanitizeConfig(JSON.parse(mine.config_json)));setPrefsRecord(mine);}
    }catch(e){if(mounted)setPrefsWarning("No se pudieron recuperar los ajustes personales: "+(e?.message||e));}
  })();return()=>{mounted=false;};},[]);
  const players=pq.data||[],teams=tq.data||[];
  const byID=useMemo(()=>new Map(players.map(p=>[String(p.id),p])),[players]);
  const byTeam=useMemo(()=>new Map(teams.map(t=>[String(t.id),t])),[teams]);
  const stats=useMemo(()=>groupStatRows(rows.filter(r=>r.player_id)),[rows]);
  const seasonSummaries=useMemo(()=>buildSeasonSummaries(rows.filter(r=>r.player_id),teams),[rows,teams]);
  const competitions=useMemo(()=>[...new Set(rows.map(r=>r.competition))].filter(Boolean).sort(),[rows]);
  const allCompetitionsRanked=useMemo(()=>{
    let rs=stats.map(r=>({record:r,player:byID.get(String(r.player_id))||null}));
    if(tab==="todos"){
      const ids=new Set(stats.map(r=>String(r.player_id)));
      rs=rs.concat(players.filter(p=>!ids.has(String(p.id))).map(p=>({record:null,player:p})));
    }
    return sortStatsItems(rs,"competition",sort,sortDirection,columnConfig);
  },[stats,players,tab,sort,sortDirection,byID,columnConfig]);
  const visible=useMemo(()=>{
    const q=normalizeLabel(search);
    if(!q)return allCompetitionsRanked;
    return allCompetitionsRanked.filter(({record:r,player:p})=>[r?.player_name,p?.name,p?.id,r?.team_name,byTeam.get(String(p?.team_id))?.name,r?.fotmob_player_id,playerUID(p)].some(v=>normalizeLabel(v).includes(q)));
  },[allCompetitionsRanked,search,byTeam]);
  const globalCompetitionRanks=useMemo(()=>rankPositions(allCompetitionsRanked,"competition"),[allCompetitionsRanked]);
  const playerCompetitionRanks=useMemo(()=>playerRankPositions(allCompetitionsRanked,"competition"),[allCompetitionsRanked]);
  const bestCriteria=useMemo(()=>{
    const preferred=["rating","goals","assists","xg","xa","gaper90","xgaper90","appearances","minutes"];
    const known=[...preferred,...RAW_METRICS.map(([id])=>id),...columnConfig.computed.map(d=>d.id)];
    return [...new Set(known)].map(id=>getColumn(columnConfig,id)).filter(Boolean);
  },[columnConfig]);
  const allSeasonsRanked=useMemo(()=>{
    const mapped=seasonSummaries.map(summary=>({summary,player:byID.get(String(summary.player_id))||null}));
    if(tab==="todos"){
      const existing=new Set(seasonSummaries.map(s=>String(s.player_id)));
      mapped.push(...players.filter(p=>!existing.has(String(p.id))).map(player=>({summary:null,player})));
    }
    const enough=mapped.filter(({summary})=>summary?(summary.totals.minutes.value||0)>=minMinutes:minMinutes===0);
    const ranked=seasonDisplay==="best"?bestSeasonPerPlayer(enough,bestMetric,columnConfig):enough;
    return sortStatsItems(ranked,"season",sort,sortDirection,columnConfig);
  },[seasonSummaries,byID,players,tab,minMinutes,sort,sortDirection,columnConfig,seasonDisplay,bestMetric]);
  const seasonVisible=useMemo(()=>{
    const q=normalizeLabel(search);
    if(!q)return allSeasonsRanked;
    return allSeasonsRanked.filter(({summary,player})=>[player?.name,player?.id,playerUID(player),summary?.player_name,summary?.fotmob_player_id,summary?.mainClub?.name,summary?.season].some(v=>normalizeLabel(v).includes(q)));
  },[allSeasonsRanked,search]);
  const globalSeasonRanks=useMemo(()=>rankPositions(allSeasonsRanked,"season"),[allSeasonsRanked]);
  const playerSeasonRanks=useMemo(()=>playerRankPositions(allSeasonsRanked,"season"),[allSeasonsRanked]);
  const chooseSort=key=>{
    const next=nextSorting(sort,sortDirection,key);
    setSort(next.key);setSortDirection(next.direction);
    if(viewMode==="season"&&seasonDisplay==="best"&&bestCriteria.some(c=>c.id===key))setBestMetric(key);
    setPage(0);
  };
  const filtered=visible.slice(page*50,(page+1)*50);
  const activeCount=viewMode==="season"?seasonVisible.length:visible.length;
  const [detailRows,setDetailRows]=useState([]),[detailLoading,setDetailLoading]=useState(false);
  const updateTeamMatches=async(record,matches)=>{
    if(!record?.id)throw Error("Este registro no tiene identificador y no puede modificarse.");
    if(!Number.isInteger(matches)||matches<1||matches>200)throw Error("Los PJ del equipo deben ser un entero entre 1 y 200.");
    await base44.entities.PlayerSeasonStats.update(record.id,{team_matches:matches});
    setDetailRows(current=>current.map(r=>String(r.id)===String(record.id)?{...r,team_matches:matches}:r));
    setRevision(v=>v+1);
  };
  const openDetailSettings=(detailCategory,sample)=>{setSettingsContext({mode:"competition",category:detailCategory,sample});setSettingsOpen(true);};
  const linkHistoricalTeams=async(ids,teamId)=>{
    const team=teams.find(t=>String(t.id)===String(teamId));
    if(!team)throw Error("No se ha encontrado el equipo elegido.");
    const matching=detailRows.filter(r=>ids.includes(String(r.id))&&!nationalCompetition(r.competition));
    if(!matching.length)throw Error("Espera a que se termine de cargar la ficha completa antes de vincular equipos.");
    const updatedIds=[];
    const failed=ids.filter(id=>!matching.some(r=>String(r.id)===String(id))).map(id=>({id,label:"Registro no encontrado en la ficha actual"}));
    for(const record of matching){
      try{await base44.entities.PlayerSeasonStats.update(record.id,{team_id:String(team.id)});updatedIds.push(String(record.id));}
      catch(e){failed.push({id:record.id,label:record.competition+" ("+record.season+"): "+(e?.message||"error")});}
    }
    if(updatedIds.length){setDetailRows(current=>current.map(r=>updatedIds.includes(String(r.id))?{...r,team_id:String(team.id)}:r));setRevision(v=>v+1);}
    return {updated:updatedIds.length,failed};
  };
  const openSeasonDetail=(summary,player)=>openDetail({record:summary?.records?.[0]||null,player,season:summary?.season});
  const openDetail=async(row)=>{
    setSelected(row);setDetailRows([]);setDetailLoading(true);
    try{const filter=row.player?{player_id:String(row.player.id)}:{fotmob_player_id:row.record.fotmob_player_id};
      const r=await base44.entities.PlayerSeasonStats.filter(filter,{limit:500});
      setDetailRows(unpack(r).map(parseData));
    }catch{setDetailRows(row.record?[row.record]:[]);}
    finally{setDetailLoading(false);}
  };
  const columns=columnConfig.columns.competition[category]||[];
  const listDividers=new Set(columnConfig.dividers?.competition?.[category]||[]);
  const listLine=id=>listDividers.has(id)?" border-r-[3px] border-r-blue-300":"";
  const saveColumns=async(draft)=>{
    const clean=sanitizeConfig(draft);
    const payload={key:"stats_layout_personal_v1",version:clean.version,config_json:JSON.stringify(clean)};
    if(prefsRecord?.id){await base44.entities.StatsViewPreference.update(prefsRecord.id,payload);}
    else{const created=await base44.entities.StatsViewPreference.create(payload);setPrefsRecord({...payload,id:created?.id||created?.data?.id});}
    setColumnConfig(clean);setPrefsWarning("");
  };
  const importComplete=()=>{setRevision(x=>x+1);queryClient.invalidateQueries({queryKey:["mf-legacy","stats"]});};
  return <div className="h-full w-full overflow-y-auto bg-[#f3f5f8]">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2 md:px-5">
      <p className="text-xs font-black uppercase tracking-[.12em] text-[#0d315b]">STATS <span className="ml-2 font-normal normal-case tracking-normal text-slate-400">Rendimiento por temporada</span></p>
      <div className="flex items-center gap-2">
        <button type="button" onClick={()=>{setSettingsContext(null);setSettingsOpen(true);}} title="Configurar columnas, cálculos y categorías" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"><Settings2 size={16}/> Ajustes</button>
        <button onClick={()=>setImportOpen(true)} className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-[#003399] hover:bg-blue-50"><Upload size={15}/> Solo FotMob</button>
        <button onClick={()=>setUnifiedOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-[#003399] px-3 py-2 text-xs font-bold text-white hover:bg-[#002777]"><Upload size={15}/> Importar FotMob + CraftedFC</button>
      </div>
    </div>
    <div className="space-y-2 px-3 py-3 md:px-5">
      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm"><div className="flex flex-wrap items-end gap-2"><label className="text-[11px] font-bold text-slate-500">TEMPORADA<select className="mt-1 block min-w-36 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-[#193a5b]" value={season} onChange={e=>{setSeason(e.target.value);setCompetition("Todas");setPage(0);}}><option>Todas</option>{options.map(x=><option key={x}>{x}</option>)}</select></label><label className="text-[11px] font-bold text-slate-500">COMPETICIÓN<select disabled={viewMode==="season"} title={viewMode==="season"?"El resumen suma las competiciones de club disponibles":"Filtra una competición"} className="mt-1 block min-w-40 rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-400" value={competition} onChange={e=>{setCompetition(e.target.value);setPage(0);}}><option>Todas</option>{competitions.map(x=><option key={x}>{x}</option>)}</select></label><label className="min-w-[220px] flex-1 text-[11px] font-bold text-slate-500">BUSCAR JUGADOR, CLUB O ID<div className="mt-1 flex items-center gap-2 rounded-lg border border-slate-200 px-3"><Search size={16} className="text-slate-400"/><input value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}} className="w-full bg-transparent py-2 text-sm font-normal outline-none" placeholder="Buscar en MY LEGACY…"/></div></label><label className="text-[11px] font-bold text-slate-500">ORDENAR<select className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm" value={sort} onChange={e=>{setSort(e.target.value);setSortDirection(defaultSortDirection(e.target.value));if(viewMode==="season"&&seasonDisplay==="best"&&bestCriteria.some(c=>c.id===e.target.value))setBestMetric(e.target.value);setPage(0);}}>{!["rating","goals","assists","xg","xa","tackles","minutes","appearances","gaper90","xgaper90"].includes(sort)&&<option value={sort}>{getColumn(columnConfig,sort)?.name||sort}</option>}<option value="rating">Nota FotMob</option><option value="goals">Goles</option><option value="assists">Asistencias</option><option value="xg">xG</option><option value="xa">xA</option><option value="tackles">Entradas</option>{viewMode==="season"&&<><option value="minutes">Minutos</option><option value="appearances">Partidos</option><option value="gaper90">G+A /90</option><option value="xgaper90">xG+xA /90</option></>}</select></label>{viewMode==="season"&&<label className="text-[11px] font-bold text-slate-500">MÍNIMO DE MINUTOS<select className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm" value={minMinutes} onChange={e=>{setMinMinutes(Number(e.target.value));setPage(0);}}><option value={0}>Sin mínimo</option><option value={500}>500 min</option><option value={900}>900 min</option><option value={1800}>1800 min</option></select></label>}</div></div>
      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm"><div className="mb-2 flex flex-wrap items-center gap-2"><p className="mr-1 text-[10px] font-black uppercase tracking-widest text-slate-500">VISTA</p><div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1"><button onClick={()=>{setViewMode("season");setCompetition("Todas");setPage(0);}} className={"rounded-md px-4 py-2 text-xs font-bold "+(viewMode==="season"?"bg-[#003399] text-white shadow-sm":"text-slate-600 hover:bg-white")}>Temporadas</button><button onClick={()=>{setViewMode("competition");setSort("rating");setPage(0);}} className={"rounded-md px-4 py-2 text-xs font-bold "+(viewMode==="competition"?"bg-[#003399] text-white shadow-sm":"text-slate-600 hover:bg-white")}>Competiciones</button></div><p className="text-xs text-slate-500">{viewMode==="season"?"Una fila por jugador y temporada; subtotales de todas las competiciones de clubes cargadas.":"Una fila por competición, sin agregación."}</p></div>{viewMode==="season"&&<div className="mb-2 flex flex-wrap items-center gap-2 border-y border-slate-100 py-2">
        <span className="mr-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">JUGADORES</span>
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1">
          <button type="button" onClick={()=>{setSeasonDisplay("all");setPage(0);}} className={"rounded-md px-3 py-1.5 text-xs font-bold "+(seasonDisplay==="all"?"bg-[#003399] text-white shadow-sm":"text-slate-600 hover:bg-white")}>Todas las temporadas</button>
          <button type="button" onClick={()=>{setSeasonDisplay("best");setSort(bestMetric);setSortDirection("desc");setPage(0);}} className={"rounded-md px-3 py-1.5 text-xs font-bold "+(seasonDisplay==="best"?"bg-[#003399] text-white shadow-sm":"text-slate-600 hover:bg-white")}>Mejor temporada por jugador</button>
        </div>
        {seasonDisplay==="best"&&<label className="flex items-center gap-2 text-[11px] font-bold text-slate-600">MEJOR POR
          <select value={bestMetric} onChange={e=>{setBestMetric(e.target.value);setSort(e.target.value);setSortDirection("desc");setPage(0);}} className="max-w-56 rounded-lg border border-blue-200 bg-white px-2 py-1.5 text-xs font-semibold text-[#003399]">
            {bestCriteria.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>}
        <span className="text-[11px] text-slate-500">{seasonDisplay==="best"?"Una fila por jugador, con su máximo en el indicador elegido; se omiten jugadores sin esa estadística.":"Se muestran todas las temporadas importadas de cada jugador."}</span>
      </div>}
      <p className="sr-only">STAT COLUMNS</p><div className="flex flex-wrap gap-1">{CAT_TABS.map(label=><button key={label} onClick={()=>{setCategory(label);setPage(0);}} className={"rounded-lg px-3 py-1.5 text-xs font-bold "+(category===label?"bg-[#003399] text-white":"border border-slate-200 text-slate-700 hover:bg-slate-50")}>{label}</button>)}</div></div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3"><div className="text-xs font-bold text-[#0d315b]">{viewMode==="season"?(seasonDisplay==="best"?"Mejor temporada de cada jugador · "+(getColumn(columnConfig,bestMetric)?.name||bestMetric):"Ranking por temporada"):"Detalle por competición"}</div><p className="text-xs text-slate-500">{activeCount.toLocaleString("es")} filas · {rows.length} registros consultados {hasMore?"(cobertura parcial: hay más por cargar)":""}</p></div>
      {error&&<div className="border-b border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">Error al cargar estadísticas: {error}</div>}
      {viewMode==="season"?<SeasonStatsTable items={seasonVisible} globalRanks={globalSeasonRanks} playerRanks={playerSeasonRanks} category={category} config={columnConfig} page={page} sortKey={sort} sortDirection={sortDirection} onSort={chooseSort} onOpen={openSeasonDetail} onTeam={id=>navigate("/teams?stats_team="+encodeURIComponent(id))}/>:<div className="max-w-full overflow-x-auto"><table className="w-full min-w-[920px] text-left text-xs"><thead className="bg-[#003399] text-white"><tr><th className={"px-2 py-3 text-center"+listLine("rank")} title="Posición entre las competiciones del jugador (posición entre todos los jugadores)">RANK</th><SortHeader column="player" label="JUGADOR" active={sort} direction={sortDirection} onSort={chooseSort} align="left" className={"min-w-[190px]"+listLine("player")}/><SortHeader column="club" label="EQUIPO" active={sort} direction={sortDirection} onSort={chooseSort} align="left" className={listLine("club")}/><SortHeader column="season" label="TEMPORADA" active={sort} direction={sortDirection} onSort={chooseSort} align="left" className={listLine("season")}/><SortHeader column="competition" label="COMPETICIÓN" active={sort} direction={sortDirection} onSort={chooseSort} align="left" className={listLine("competition")}/><SortHeader column="appearances" label="PJ" active={sort} direction={sortDirection} onSort={chooseSort} className={listLine("appearances")}/><SortHeader column="minutes" label="MIN" active={sort} direction={sortDirection} onSort={chooseSort} className={listLine("minutes")}/><SortHeader column="rating" label="NOTA" active={sort} direction={sortDirection} onSort={chooseSort} className={listLine("rating")}/>{columns.map(id=><SortHeader key={id} column={id} label={getColumn(columnConfig,id)?.name||metricLabel(id)} active={sort} direction={sortDirection} onSort={chooseSort} className={listLine(id)}/>)}<th className="px-3 py-3">FICHA</th></tr></thead>
      <tbody>{filtered.map(({record:r,player:p},i)=>{const info=r?resolveTeam(r,teams,stats):null;const team=r?info?.team:byTeam.get(String(p?.team_id||""));const linkable=!r||info?.status==="confirmed";return <tr key={(r?.id||r?.external_record_id||p?.id||"")+":"+i} className="border-b border-slate-100 odd:bg-white even:bg-[#f6f8f6] hover:bg-[#eef3fb]"><td className={"whitespace-nowrap px-2 py-3 text-center"+listLine("rank")}><strong className="font-black text-slate-800">{playerCompetitionRanks.get(rankIdentity({record:r,player:p},"competition"))??"—"}</strong><span className="ml-1 text-[10px] font-normal text-slate-500">({globalCompetitionRanks.get(rankIdentity({record:r,player:p},"competition"))??"—"})</span></td><td className={"px-3 py-2"+listLine("player")}><button onClick={()=>openDetail({record:r,player:p})} className="flex items-center gap-2 text-left"><Avatar name={p?.name||r?.player_name} photo={playerPhoto(p)}/><span><span className="block font-extrabold text-[#0f3156] hover:underline">{p?.name||r?.player_name||"Jugador"}</span><span className="text-[10px] text-slate-400">FM {playerUID(p)||"—"} · FotMob {r?.fotmob_player_id||"—"}</span></span></button></td><td className={"px-3 py-2 text-slate-700"+listLine("club")}>{r&&info?.status==="national"?<span className="text-slate-500">Selección nacional</span>:r&&!linkable?<span className="text-amber-800">{info?.label||"Club pendiente"}{info?.status==="suggested"&&<span className="block text-[10px]">Sin verificar</span>}</span>:team?.id?<button className="hover:underline" onClick={()=>navigate("/teams?stats_team="+encodeURIComponent(team.id))}><TeamBadge teamName={team.name} logo={teamLogo(team)}/></button>:<TeamBadge teamName={r?.team_name||team?.name} logo={teamLogo(team)}/>}</td><td className={"px-3 py-3"+listLine("season")}>{r?.season||"—"}</td><td className={"px-3 py-3"+listLine("competition")}>{r?.competition||"Sin datos"}</td><td className={"px-3 py-3 text-right"+listLine("appearances")}>{show(r?.appearances)}</td><td className={"px-3 py-3 text-right"+listLine("minutes")}>{show(r?.minutes)}</td><td className={"px-3 py-3 text-right font-bold"+listLine("rating")}>{show(r?.rating,2)}</td>{columns.map(id=><td key={id} className={"px-3 py-3 text-right"+listLine(id)}>{show(columnValue(r,"competition",id,columnConfig),getColumn(columnConfig,id)?.decimals??0)}{columnValue(r,"competition",id,columnConfig)!==null&&getColumn(columnConfig,id)?.unit?" "+getColumn(columnConfig,id).unit:""}</td>)}<td className="px-3 py-3"><button onClick={()=>openDetail({record:r,player:p})} className="rounded-lg border border-blue-200 px-3 py-2 font-bold text-[#003399] hover:bg-blue-50">Ver stats</button></td></tr>})}
      {!filtered.length&&<tr><td colSpan={9+columns.length} className="px-6 py-12 text-center"><Database className="mx-auto mb-3 text-slate-300" size={36}/><p className="font-bold text-slate-600">Todavía no hay estadísticas para estos filtros</p><p className="mt-1 text-xs text-slate-400">Puedes cambiar los filtros o importar archivos de FotMob Studio.</p></td></tr>}</tbody></table></div>}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"><p className="text-xs text-slate-500">Página {page+1} · Los campos no disponibles se indican con —</p><div className="flex gap-2">{page>0&&<button onClick={()=>setPage(x=>x-1)} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold">Anterior</button>}{(page+1)*50<activeCount&&<button onClick={()=>setPage(x=>x+1)} className="rounded-lg bg-[#003399] px-4 py-2 text-xs font-bold text-white">Siguiente</button>}{hasMore&&<button disabled={busy} onClick={loadMore} className="rounded-lg border border-blue-300 px-4 py-2 text-xs font-bold text-[#003399] disabled:opacity-40">Cargar 500 más</button>}</div></div></div>

    </div>
    {prefsWarning&&<p className="px-5 py-2 text-xs text-amber-700">{prefsWarning}</p>}
    {settingsOpen&&<StatsColumnSettings config={columnConfig} mode={settingsContext?.mode||viewMode} category={settingsContext?.category||category} sample={settingsContext?.sample||(viewMode==="season"?seasonSummaries[0]:stats[0])} onClose={()=>setSettingsOpen(false)} onSave={saveColumns}/>}
    {importOpen&&<StatsImport players={players} teams={teams} onClose={()=>setImportOpen(false)} onImported={importComplete} onOpenUnified={()=>{setImportOpen(false);setUnifiedOpen(true);}}/>}
    {unifiedOpen&&createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Importar FotMob y CraftedFC">
        <div className="flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="flex shrink-0 items-center justify-between bg-[#0e2844] px-5 py-3 text-white">
            <p className="text-sm font-black">STATS · Importación FotMob + CraftedFC</p>
            <button onClick={()=>{setUnifiedOpen(false);importComplete();}} className="rounded-lg p-2 hover:bg-white/10" aria-label="Cerrar importador unificado"><X size={20}/></button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto"><ImportUnified/></div>
        </div>
      </div>,document.body
    )}
    {selected&&<StatDetail player={selected.player} stats={detailRows.length?detailRows:selected.record?[selected.record]:[]} initialSeason={selected.season||selected.record?.season||""} teams={teams} config={columnConfig} onLinkTeams={linkHistoricalTeams} onOpenSettings={openDetailSettings} onSetTeamMatches={updateTeamMatches} onClose={()=>setSelected(null)} onPlayer={id=>{setSelected(null);navigate("/players?stats_player="+encodeURIComponent(id));}} />}
  </div>;
}