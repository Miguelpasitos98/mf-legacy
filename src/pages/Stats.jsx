import {nationalLinkPlan} from "@/utils/nationalAutoLink";
import {POSITION_OPTIONS,normalizeHistoricalPosition,positionGroup} from "@/utils/historicalPositions.js";
import React, { useEffect, useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { aggregate, defaultSeason, groupStatRows, nationalCompetition, resolveTeam, seasonActive } from "@/utils/statsViews";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeftRight, ArrowRight, ClipboardPaste, Copy, Database, RefreshCw, Search, Shield, Settings2, Upload, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { usePlayersQuery, useTeamsQuery, useCountriesQuery } from "@/hooks/useSharedData";
import { normalizeLabel, metricLabel } from "@/utils/statsImport";
import { buildValuationPrompt } from "@/utils/valuationPrompt";
import {buildMissingMarketPrompt,missingMarketSeasons} from "@/utils/missingMarketPrompt";
import StatsImport from "@/components/stats/StatsImport";
import HistoricalSingleEntryImporter from "@/components/stats/HistoricalSingleEntryImporter";
import HistoricalValuationsTable from "@/components/stats/HistoricalValuationsTable";
import { useHistoricalValuations } from "@/hooks/useHistoricalValuations";
import { useTeamMatchesLookup } from "@/hooks/useTeamMatchesLookup";
import ImportUnified from "@/pages/ImportUnified";
import SeasonStatsTable from "@/components/stats/SeasonStatsTable";
import SeasonCompareView from "@/components/stats/SeasonCompareView";
import StatsControlBar from "@/components/stats/StatsControlBar";
import SortHeader from "@/components/stats/SortHeader";
import {nextSorting,sortStatsItems,defaultSortDirection} from "@/utils/statsSort";
import StatsColumnSettings from "@/components/stats/StatsColumnSettings";
import TeamLinkPicker from "@/components/stats/TeamLinkPicker";
import {saveTeamLinkSafely} from "@/utils/teamLinkSave";
import {initialConfig,sanitizeConfig,getColumn,columnValue,RAW_METRICS} from "@/utils/statsColumns";
import {bestSeasonPerPlayer} from "@/utils/statsBestSeason";
import {useHistoricalPeerDataset} from "@/hooks/useHistoricalPeerDataset";
import {buildCompositeSeasonIndex,bestSeasonByComposite,sortByComposite} from "@/utils/statsCompositeRanking";
import ManualMetricEditor from "@/components/stats/ManualMetricEditor";
import {applyManualStatChange,applyManualStatChanges} from "@/utils/manualStats";
import {advancedTotals} from "@/utils/statsAdvanced";
import {metricName} from "@/utils/compositeEngine";
import {buildSeasonSummaries} from "@/utils/statsSeason";
import {patchHistoricalPeerCache,HISTORICAL_PEER_KEY} from "@/utils/historicalPeerCache";
import {rankPositions,rankIdentity,playerRankPositions} from "@/utils/statsRank";
import {useStatsRows} from "@/hooks/useStatsRows";
import {patchStatsCaches,STATS_ROWS_KEY,STATS_DETAIL_KEY,STATS_ROWS_STALE_MS,STATS_CACHE_GC_MS,STATS_LAYOUT_KEY,statsDetailKey} from "@/utils/statsRowsCache";
import {useCraftedfcSnapshot} from "@/hooks/useCraftedfcSnapshot";
import MfLegacyOverview from "@/components/stats/MfLegacyOverview";
import CraftedfcAnalysis from "@/components/stats/CraftedfcAnalysis";
import AnalysisErrorBoundary from "@/components/stats/AnalysisErrorBoundary";
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
function Avatar({name,photo,size="md"}) {
  const [broken,setBroken]=useState(false);
  const classes=size==="lg"?"h-16 w-16":"h-9 w-9";
  return <div className={classes+" flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#e9f0f9] font-black text-[#31557b]"}>{photo&&!broken?<img src={photo} alt="" className="h-full w-full object-cover" loading="lazy" onError={()=>setBroken(true)}/>:String(name||"?").slice(0,2).toUpperCase()}</div>;
}
function TeamBadge({teamName,logo}){const [broken,setBroken]=useState(false);return <span className="inline-flex max-w-[170px] items-center gap-2">{logo&&!broken?<img src={logo} alt="" className="h-5 w-5 object-contain" onError={()=>setBroken(true)}/>:<Shield size={16} className="text-slate-300"/>}<span className="truncate">{teamName||"Sin equipo"}</span></span>;}
const seasonForView=r=>{
 const override=String(r?.display_season||"");
 if(/^\d{4}\/\d{4}$/.test(override))return override;
 const raw=String(r?.season||"").trim();
 if(/^\d{4}\/\d{4}$/.test(raw))return raw;
 if(!/^\d{4}$/.test(raw))return raw;
 const year=Number(raw);
 const competition=String(r?.competition||"").toLowerCase();
 // Summer national tournaments close the previous European football season.
 const summerNational=/world cup|worldcup|copa america|copa américa|euro 20|european championship|summer olympics|olympic games|finalissima/i.test(competition);
 const start=summerNational?year-1:year;
 return start+"/"+(start+1);
};
function StatDetail({player,stats,teams,initialSeason,onClose,onPlayer,onLinkTeams,onOpenSettings,onSetTeamMatches,onSetMetric,config}) {
  const queryClient=useQueryClient();
  const seasons=useMemo(()=>[...new Set(stats.map(seasonForView).filter(Boolean))].sort().reverse(),[stats]);
  const {valuations:historicalValuations,loading:historicalLoading,refresh:historicalRefresh}=useHistoricalValuations(player?.id||stats[0]?.player_id);
  const {getTeamMatches,refresh:refreshTeamMatches}=useTeamMatchesLookup(stats);
  const [valuationImporterOpen,setValuationImporterOpen]=useState(false);
  const fotmobPlayerId=stats[0]?.fotmob_player_id||"";
  const [copySeasonsStatus,setCopySeasonsStatus]=useState("");
  const missingMarket=useMemo(()=>missingMarketSeasons(seasons,historicalValuations),[seasons,historicalValuations]);
  const copyMissingMarket=async()=>{
    if(!missingMarket.length){setCopySeasonsStatus("Todas las temporadas registradas tienen un valor de mercado.");return;}
    const text=buildMissingMarketPrompt({playerName:player?.name||stats[0]?.player_name||"",fotmobId:fotmobPlayerId,fm26Uid:player?.fm26_uid||"",seasons,valuations:historicalValuations});
    try{await navigator.clipboard.writeText(text);setCopySeasonsStatus("Investigación de Transfermarkt copiada para "+missingMarket.length+" temporadas. Trae el JSON y pégalo en «Introducir datos históricos → Pegar JSON completo».");}
    catch{setCopySeasonsStatus("El navegador bloqueó la copia; comprueba el permiso del portapapeles.");}
  };
  const copySeasonsForValuation=async()=>{
    const name=String(player?.name||stats[0]?.player_name||"").trim();
    if(!name||!seasons.length){setCopySeasonsStatus("No hay temporadas disponibles para copiar.");return;}
    // Prompt completo: temporadas + formato exacto de respuesta (Overall,
    // posición FIFA de cada edición y valor de Transfermarkt).
    const text=buildValuationPrompt({playerName:name,seasons:seasons.slice().reverse(),fm26Uid:player?.fm26_uid||"",fotmobPlayerId});
    const done="Prompt copiado ("+seasons.length+" temporadas). Pégalo en el chat externo y trae el JSON al importador histórico.";
    try{
      await navigator.clipboard.writeText(text);
      setCopySeasonsStatus(done);
    }catch{
      try{
        const area=document.createElement("textarea");area.value=text;area.style.position="fixed";area.style.opacity="0";document.body.appendChild(area);area.select();
        const copied=document.execCommand("copy");document.body.removeChild(area);
        if(!copied)throw Error("No disponible");
        setCopySeasonsStatus(done);
      }catch{setCopySeasonsStatus("El navegador ha bloqueado la copia. Revisa sus permisos de portapapeles.");}
    }
  };
  const [section,setSection]=useState("overview");
  const {snapshot:cfcSnapshot,status:cfcStatus}=useCraftedfcSnapshot(player?.id);
  const [season,setSeason]=useState("auto");
  const [seasonOverrides,setSeasonOverrides]=useState({});
  const [seasonEdit,setSeasonEdit]=useState(null);
  const [seasonSaving,setSeasonSaving]=useState(false);
  const [seasonError,setSeasonError]=useState("");
  const activeSeason=season==="auto"?seasonForView(stats.find(r=>r.season===defaultSeason(stats,initialSeason))||stats[0]||{}):season;
  const [competition,setCompetition]=useState("Todas");
  const [scope,setScope]=useState("all");
  const [category,setCategory]=useState("Resumen");
  const [teamLinkTarget,setTeamLinkTarget]=useState(null);
  const [nationalTarget,setNationalTarget]=useState(null);
  const [nationalChoice,setNationalChoice]=useState("");
  const [countrySearch,setCountrySearch]=useState("");
  const [nationalCategory,setNationalCategory]=useState("senior");
  const countriesQuery=useCountriesQuery();
  const countries=countriesQuery.data||[];
  const [nationalError,setNationalError]=useState("");
  const [nationalBusy,setNationalBusy]=useState(false);
  const [nationalLinks,setNationalLinks]=useState({});
  const [nationalTeams,setNationalTeams]=useState([]);
  const nationalAutoBusy=useRef(false);
  useEffect(()=>{
    if(nationalAutoBusy.current||!player?.country_id||!nationalTeams.length||!stats.length)return;
    const plan=nationalLinkPlan({player,records:stats,nationalTeams});
    if(!plan.length)return;
    let cancelled=false;
    nationalAutoBusy.current=true;
    (async()=>{
      try{
        for(const item of plan){
          if(cancelled)break;
          const current=await base44.entities.PlayerSeasonStats.get(item.id);
          if(String(current.player_id)!==String(item.player_id)||current.season!==item.season||
            current.competition!==item.competition||current.national_team_id||current.national_country_id)continue;
          await base44.entities.PlayerSeasonStats.update(item.id,item.patch);
          if(!cancelled)setNationalLinks(old=>({...old,[String(item.id)]:item.patch}));
        }
        if(!cancelled){queryClient.invalidateQueries({queryKey:HISTORICAL_PEER_KEY});queryClient.invalidateQueries({queryKey:STATS_ROWS_KEY});}
      }catch(error){console.warn("Vinculación automática de selecciones pendiente",error);}
      finally{nationalAutoBusy.current=false;}
    })();
    return ()=>{cancelled=true;};
  },[player?.id,player?.country_id,stats,nationalTeams,queryClient]);

  useEffect(()=>{let live=true;base44.entities.NationalTeam.list({limit:500}).then(result=>{if(live)setNationalTeams(Array.isArray(result)?result:result?.items||result?.data||[]);}).catch(()=>{});return()=>{live=false;};},[]);
  const [teamMatchesTarget,setTeamMatchesTarget]=useState(null);
  const [teamMatchesValue,setTeamMatchesValue]=useState("");
  const [metricTarget,setMetricTarget]=useState(null);
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
  const displayedSeason=r=>seasonForView({...r,display_season:seasonOverrides[String(r.id)]??r.display_season});
  const seasonRows=uniqueRecords.filter(s=>activeSeason==="Todas"||displayedSeason(s)===activeSeason);
  const competitions=[...new Set(seasonRows.map(s=>s.competition))].sort();
  const shown=seasonRows.filter(r=>(scope==="all"||!nationalCompetition(r.competition))&&(competition==="Todas"||r.competition===competition)).map(r=>{
    const tm=getTeamMatches(r);
    return tm?{...r,team_matches:tm.team_matches,_teamMatchesSource:"team"}:r;
  });
  const sums=aggregate(shown);
  const advanced=advancedTotals(shown,{includeSeasonRates:competition==="Todas"});
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
  const beginMetricEdit=(r,name,field=null)=>{
    if(!r?.id||r._sourceRows>1)return;
    const current=field?r[field]:(r.metrics||[]).find(m=>metricName(m.name)===metricName(name))?.value;
    setMetricTarget({record:r,metric:name,field,current});
  };
  const valueButton=(r,name,value,decimals=2,field=null)=>{
    const audit=(r.manual_metric_history||[]).filter(h=>h.metric_name===(field?"$field:"+field:name)).at(-1);
    return <button type="button" disabled={!r.id||r._sourceRows>1}
      onClick={()=>beginMetricEdit(r,name,field)} title={audit?"Edición manual · antes: "+(audit.old_value??"sin dato")+" · fuente: "+audit.source_note:"Pulsa para editar o añadir esta cifra"}
      className="rounded px-1.5 py-1 font-semibold text-[#003399] hover:bg-blue-50 disabled:opacity-50">
      {value==null?"Añadir +":show(value,decimals)}{audit&&<span className="ml-1 text-[9px] text-indigo-500">✎</span>}
    </button>;
  };
  const columnMetricName=(r,id)=>{
    const names={goals:"Goals",assists:"Assists",xg:"xG",xa:"xA",xgot:"xGOT",shots:"Shots",
      shotsontarget:"Shots on target",bigchancescreated:"Big chances created",
      xgexclpenalty:"xG excl. penalty",duelswon:"Duels won",
      duelswonvariante2:"Duels won %",aerialswon:"Aerials won",aerialswonvariante2:"Aerials won %"};
    const candidate=names[id]||id;
    return (r.metrics||[]).find(m=>metricName(m.name)===metricName(candidate))?.name||candidate;
  };
  const teamCell=r=>{
    const linked=nationalLinks[String(r.id)];
    const info=resolveTeam(linked?{...r,...linked}:r,teams,uniqueRecords);
    if(nationalCompetition(r.competition)){
      const nationalTeam=nationalTeams.find(t=>String(t.id)===String(linked?.national_team_id||r.national_team_id));
      const name=nationalTeam?.name||linked?.team_name||r.team_name||"Selección sin vincular";
      const country=countries.find(c=>String(c.id)===String(linked?.national_country_id||r.national_country_id||nationalTeam?.country_id)||(name===c.name||name.startsWith(c.name+" ")));
      const flag=country?.flag;
      const flagNode=flag&&/^(https?:|data:)/i.test(flag)?<img src={flag} alt="" className="h-4 w-6 shrink-0 object-contain"/>:<span className="w-6 shrink-0 text-center">{flag&&!/^(https?:|data:)/i.test(flag)?flag:"🏳️"}</span>;
      return <button type="button" onClick={()=>{setNationalTarget(r);setNationalChoice("");setCountrySearch("");setNationalCategory(/(?:u20|sub.?20)/i.test(r.competition)?"u20":/(?:olympic|olimpic|u23|sub.?23)/i.test(r.competition)?"u23":"senior");setNationalError("");}} className="text-left text-xs font-semibold text-blue-800 hover:underline" title="Vincular selección nacional"><span className="inline-flex max-w-[210px] items-center gap-2">{flagNode}<span className="truncate">{name}</span><span className="text-[10px] text-slate-400">{linked||nationalTeam?"✓":"✎"}</span></span></button>;
    }
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
        <header className="shrink-0 border-b border-white/10 bg-[#0e2844] px-4 py-4 text-white sm:px-6 sm:py-5">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <Avatar size="lg" name={player?.name||stats[0]?.player_name} photo={playerPhoto(player)}/>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[.15em] text-blue-200">MY LEGACY · INFORME DE RENDIMIENTO</p>
              <h2 className="mt-0.5 truncate text-xl font-black leading-tight sm:text-2xl" title={player?.name||stats[0]?.player_name||"Jugador FotMob"}>{player?.name||stats[0]?.player_name||"Jugador FotMob"}</h2>
              <p className="mt-1 hidden truncate text-[11px] text-blue-200/85 sm:block">Estadísticas por temporada · fuentes externas · independientes de FM26</p>
            </div>
            <nav aria-label="Acciones del informe" className="hidden shrink-0 items-center gap-2 lg:flex">
              <button type="button" onClick={()=>onOpenSettings(category,shown[0]||stats[0]||null)} className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-blue-400/50 px-3 text-xs font-bold hover:bg-white/10"><Settings2 size={15}/> Ajustes</button>
              {player&&<button type="button" onClick={()=>onPlayer(player.id)} className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-blue-400/50 px-3 text-xs font-bold hover:bg-white/10">Ver en PLAYERS <ArrowRight size={14}/></button>}
            </nav>
            <button type="button" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-blue-100 hover:bg-white/10" onClick={onClose} aria-label="Cerrar informe"><X size={20}/></button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-blue-300/20 pt-3" aria-label="Herramientas de datos históricos">
            <button type="button" onClick={copyMissingMarket} disabled={historicalLoading||!missingMarket.length}
              className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-950 transition hover:bg-emerald-100 disabled:opacity-50"
              title="Investigar solo las temporadas sin valor Transfermarkt"><Copy size={14} className="shrink-0"/> Completar valores ausentes <span className="rounded bg-emerald-200/70 px-1.5 py-0.5 tabular-nums">{historicalLoading?"…":missingMarket.length}</span></button>
            <button type="button" onClick={copySeasonsForValuation}
              className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-bold text-[#0e2844] transition hover:bg-cyan-100"
              title="Copiar investigación de Overall, posición FIFA y Transfermarkt por año"><Copy size={14} className="shrink-0"/> Investigar temporadas (JSON)</button>
            <button type="button" onClick={()=>setValuationImporterOpen(true)}
              className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-[#0e2844] transition hover:bg-amber-100"
              title="Importar o añadir datos históricos"><ClipboardPaste size={14} className="shrink-0"/> Introducir datos históricos</button>
            <div className="flex items-center gap-2 lg:hidden">
              <button type="button" onClick={()=>onOpenSettings(category,shown[0]||stats[0]||null)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-blue-400/50 px-3 py-2 text-xs font-bold hover:bg-white/10"><Settings2 size={14}/> Ajustes</button>
              {player&&<button type="button" onClick={()=>onPlayer(player.id)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-blue-400/50 px-3 py-2 text-xs font-bold hover:bg-white/10">PLAYERS <ArrowRight size={14}/></button>}
            </div>
          </div>
        </header>
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
            <button onClick={()=>setSection("craftedfc")} className={"rounded-lg px-3 py-1.5 text-xs font-bold "+(section==="craftedfc"?"bg-[#003399] text-white":"border border-slate-200 bg-white text-slate-700 hover:bg-slate-50")}>Análisis MF Legacy</button>
            <button onClick={()=>setSection("compare")} className={"rounded-lg px-3 py-1.5 text-xs font-bold "+(section==="compare"?"bg-[#003399] text-white":"border border-slate-200 bg-white text-slate-700 hover:bg-slate-50")}>Compare</button>
          </div>
          {section==="overview"&&<MfLegacyOverview playerId={player?.id||stats[0]?.player_id} position={player?.position||player?.position_raw||""} season={activeSeason} competition={competition} scope={scope} shown={shown} estimatedRating={estimatedRating} snapshot={cfcSnapshot} cfcStatus={cfcStatus} historicalValuations={historicalValuations} historicalLoading={historicalLoading} historicalRefresh={historicalRefresh} editableRows={stats} onSetMetric={onSetMetric} onSeasonChange={newSeason=>{setSeason(newSeason);setCompetition("Todas");}} onPerformance={()=>setSection("performance")} onAnalysis={()=>setSection("craftedfc")}/>}
          {section==="craftedfc"&&<AnalysisErrorBoundary resetKey={String(player?.id||stats[0]?.player_id)+"|"+activeSeason}><CraftedfcAnalysis snapshot={cfcSnapshot} status={cfcStatus} playerId={player?.id||stats[0]?.player_id} playerName={player?.name||stats[0]?.player_name||""} position={player?.position||player?.position_raw||""} seasons={seasons} initialSeason={activeSeason} editableRows={stats} onSetMetric={onSetMetric}/></AnalysisErrorBoundary>}
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
          <div className="mb-3 rounded-xl border border-blue-100 bg-blue-50/50 p-3">
            <h4 className="mb-2 text-xs font-black uppercase tracking-wider text-[#003399]">Estadísticas avanzadas · temporada / competición</h4>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {[
                ["xG Chain /90",advanced.xg_chain_p90,"Understat",advanced.understatRows],
                ["xG Buildup /90",advanced.xg_buildup_p90,"Understat",advanced.understatRows],
                ["Duelos terrestres ganados (%)",advanced.ground_duels_won_pct,"FotMob · derivado",advanced.duelRows]
              ].map(([label,value,source,count])=><div key={label} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <p className="text-[10px] font-bold text-slate-500">{label}</p>
                <p className="text-xl font-black text-[#003399]">{value==null?"—":show(value,2)+(label.includes("(%)")?" %":"")}</p>
                <p className="text-[10px] text-slate-500">{source} · {count}/{advanced.totalRows} competiciones</p>
              </div>)}
            </div>
            {advanced.duelRows>0&&<p className="mt-2 text-[10px] text-slate-600">Duelos terrestres: {advanced.duelsWon} ganados de {advanced.duelsTotal} disputados. Los porcentajes se calculan desde recuentos y los xG por 90 usan exclusivamente minutos Understat.</p>}
          </div>
          <p className="mb-4 text-xs text-slate-500">Cada estadística aprovecha todos sus valores conocidos. Los cálculos /90 y Play % utilizan solo competiciones que tienen todas las variables de su fórmula y los minutos correspondientes. Los datos ausentes no se convierten en cero. Las selecciones están excluidas por defecto.</p>
          <div className="mb-3 flex flex-wrap gap-2">{CAT_TABS.map(x=><button key={x} onClick={()=>setCategory(x)} className={"rounded-lg px-3 py-2 text-xs font-bold "+(category===x?"bg-[#003399] text-white":"border border-slate-200 bg-white text-slate-700 hover:bg-slate-50")}>{x}</button>)}</div>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="bg-[#eaf0f8] text-slate-700"><tr><th className={"px-3 py-3"+line("season_competition")}>Temporada / competición</th><th className={"px-3 py-3"+line("club")}>Equipo / selección</th><th className={"px-3 py-3"+line("appearances")}>PJ</th><th className={"px-3 py-3"+line("minutes")}>Min</th><th className={"whitespace-nowrap px-2 py-3"+line("team_matches")} title="Partidos disputados por el equipo en esta competición, a la fecha del registro; pulsa el dato para editarlo">PJ equipo</th><th className={"px-3 py-3"+line("rating")}>Nota</th>{selected.map(id=><th key={id} className={"whitespace-nowrap px-3 py-3"+line(id)}>{getColumn(config,id)?.name||metricLabel(id)}</th>)}</tr></thead>
              <tbody>{shown.length?shown.slice().sort((a,b)=>b.season.localeCompare(a.season)||(num(b.minutes)||num(b.appearances)||0)-(num(a.minutes)||num(a.appearances)||0)||a.competition.localeCompare(b.competition)).map((r,i)=><tr key={r.id||r.external_record_id||i} className="border-t border-slate-100 hover:bg-slate-50">
                <td className={"px-3 py-3 font-semibold"+line("season_competition")}>{displayedSeason(r)} <button type="button" title="Cambiar temporada de visualización" className="ml-1 text-[10px] text-blue-700 underline" onClick={()=>{setSeasonEdit({row:r,chosen:displayedSeason(r)});setSeasonError("");}}>Editar</button><div className="font-normal text-slate-500">{r.competition}{/^\d{4}$/.test(String(r.season||""))&&<span className="ml-1 text-amber-700">(origen: {r.season})</span>}</div>{r._sourceRows>1&&<span className="text-[10px] text-blue-700">Fuentes consolidadas: {r._sourceRows}</span>}</td>
                <td className={"px-3 py-3"+line("club")}>{teamCell(r)}</td>
                <td className={"px-3 py-3"+line("appearances")}>{valueButton(r,"Partidos",r.appearances,0,"appearances")}</td><td className={"px-3 py-3"+line("minutes")}>{valueButton(r,"Minutos",r.minutes,0,"minutes")}</td><td className={"px-2 py-3"+line("team_matches")}><button type="button" onClick={()=>editTeamMatches(r)} disabled={!r.id} aria-label={"Editar partidos del equipo de "+r.competition+" "+r.season} title="Editar partidos disputados por el equipo en esta competición" className="whitespace-nowrap rounded-md border border-transparent px-2 py-1 font-semibold text-[#003399] hover:border-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:text-slate-400">{r.team_matches==null?"Añadir +":show(r.team_matches)}{r._teamMatchesSource==="team"&&<span className="ml-1 text-[9px] text-emerald-600" title="PJ equipo importado a nivel de club">club</span>}</button></td><td className={"px-3 py-3"+line("rating")}>{valueButton(r,"Nota FotMob",r.rating,2,"rating")}</td>
                {selected.map(id=><td key={id} className={"px-3 py-3 font-semibold"+line(id)}>{getColumn(config,id)?.kind==="raw"?valueButton(r,columnMetricName(r,id),columnValue(r,"competition",id,config),getColumn(config,id)?.decimals??0):["calc_goals_prevented","calc_goals_prevented_p90"].includes(id)?<span title="Introduce Goals prevented original de FotMob; /90 se calculará usando los minutos de la competición">{valueButton(r,"Goals prevented",columnValue(r,"competition",id,config),getColumn(config,id)?.decimals??2)}</span>:<span title="Calculado automáticamente a partir de las estadísticas originales">{show(columnValue(r,"competition",id,config),getColumn(config,id)?.decimals??0)}{columnValue(r,"competition",id,config)!==null&&getColumn(config,id)?.unit?" "+getColumn(config,id).unit:""}</span>}</td>)}
              </tr>):<tr><td colSpan={6+selected.length} className="p-8 text-center text-slate-500">No hay registros para esta selección. Cambia el ámbito o la temporada.</td></tr>}</tbody>
            </table>
          </div>
          {shown.length>0&&<section className="mt-5 rounded-xl border border-slate-200 p-4">
            <h3 className="mb-3 font-black text-slate-800">Todas las métricas importadas</h3>
            {shown.map((r,i)=><details key={r.id||i} className="mb-2 rounded-lg border border-slate-100 bg-slate-50 p-3">
              <summary className="cursor-pointer text-xs font-bold text-blue-900">{r.season} · {r.competition} · {r.metrics?.length||0} métricas</summary><button type="button" disabled={!r.id||r._sourceRows>1} onClick={()=>setMetricTarget({record:r,metric:"",field:null,current:null,newMetric:true})} className="mt-2 rounded border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-900 disabled:opacity-40">+ Añadir estadística manual</button>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">{(r.metrics||[]).map((m,j)=><div key={j} className="rounded-lg bg-white px-3 py-2"><p className="text-[11px] text-slate-500">{metricLabel(m.name)}</p><div className="font-extrabold">{valueButton(r,m.name,m.value,Number(m.value)%1?2:0)}</div></div>)}</div>
            </details>)}
          </section>}
          </>}
          {section==="performance"&&<HistoricalValuationsTable valuations={historicalValuations} loading={historicalLoading} onRefresh={historicalRefresh} stats={stats} fallbackPosition={player?.position||player?.position_raw||""}/>}
        </div>
        <div className="flex justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <span className="text-xs text-slate-500">Fuente: archivos FotMob Studio · registros sujetos a revisión.</span>
          <button onClick={onClose} className="rounded-lg bg-[#003399] px-5 py-2 text-xs font-bold text-white">Cerrar</button>
        </div>
      </div>
      <ManualMetricEditor target={metricTarget} onClose={()=>setMetricTarget(null)} onSave={onSetMetric}/>
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
      {seasonEdit&&<div className="fixed inset-0 z-[12000] flex items-center justify-center bg-slate-950/70 p-4" role="dialog" aria-modal="true" aria-label="Cambiar temporada de visualización"><div className="w-full max-w-md space-y-3 rounded-xl bg-white p-5 shadow-xl"><h3 className="font-bold text-[#0e2844]">Temporada de visualización</h3><p className="text-xs text-slate-600">{seasonEdit.row.competition} · origen {seasonEdit.row.season}. No se cambian las estadísticas ni el identificador original.</p><select className="w-full rounded border p-2" value={seasonEdit.chosen} onChange={e=>setSeasonEdit(v=>({...v,chosen:e.target.value}))}>{[...new Set([seasonEdit.chosen,...seasons,...Array.from({length:20},(_,i)=>String(2013+i)+"/"+String(2014+i))])].sort().reverse().map(y=><option key={y} value={y}>{y}</option>)}</select>{seasonError&&<p role="alert" className="text-xs text-red-700">{seasonError}</p>}<div className="flex justify-end gap-2"><button type="button" disabled={seasonSaving} onClick={()=>setSeasonEdit(null)} className="rounded border px-3 py-2">Cancelar</button><button type="button" disabled={seasonSaving||!seasonEdit.row.id} className="rounded bg-[#003399] px-3 py-2 text-white disabled:opacity-40" onClick={async()=>{setSeasonSaving(true);setSeasonError("");try{const original=seasonEdit.row;const fresh=await base44.entities.PlayerSeasonStats.get(original.id);if(String(fresh.player_id)!==String(original.player_id)||fresh.competition!==original.competition||fresh.season!==original.season)throw Error("El registro ha cambiado; recarga los datos.");await base44.entities.PlayerSeasonStats.update(fresh.id,{display_season:seasonEdit.chosen});setSeasonOverrides(v=>({...v,[String(fresh.id)]:seasonEdit.chosen}));setSeason(seasonEdit.chosen);setCompetition("Todas");setSeasonEdit(null);queryClient.invalidateQueries({queryKey:HISTORICAL_PEER_KEY});}catch(e){setSeasonError(e.message||"No se pudo guardar.");}finally{setSeasonSaving(false);}}}>Guardar temporada</button></div></div></div>}
      {nationalTarget&&<div className="fixed inset-0 z-[12000] flex items-center justify-center bg-slate-950/70 p-4" role="dialog" aria-modal="true" aria-label="Vincular selección nacional">
        <div className="w-full max-w-lg space-y-3 rounded-xl bg-white p-5 shadow-xl">
          <h3 className="text-base font-black text-[#0e2844]">Vincular selección nacional</h3>
          <p className="text-xs text-slate-600">{nationalTarget.season} · {nationalTarget.competition}. Solo cambia la selección asociada, no las estadísticas.</p>
          <div className="space-y-1">
            <label className="block text-xs font-semibold" htmlFor="national-country-search">Buscar país</label>
            <input id="national-country-search" type="search" autoComplete="off" value={countrySearch} onChange={e=>{setCountrySearch(e.target.value);setNationalChoice("");}} placeholder="Escribe Argentina, España, Francia…" className="w-full rounded border p-2 text-sm"/>
            <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-200" role="listbox" aria-label="Países de MF Legacy">
              {[...countries].filter(c=>c.id&&c.name&&String(c.name).toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g,"").includes(countrySearch.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g,""))).sort((a,b)=>a.name.localeCompare(b.name,"es")).slice(0,60).map(c=><button key={c.id} role="option" aria-selected={nationalChoice===String(c.id)} type="button" onClick={()=>{setNationalChoice(String(c.id));setCountrySearch(c.name);}} className={"flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-blue-50 "+(nationalChoice===String(c.id)?"bg-blue-100 font-bold":"")}>
                {c.flag&&/^(https?:|data:)/i.test(c.flag)?<img src={c.flag} alt="" className="h-5 w-7 shrink-0 object-contain"/>:<span className="inline-block w-7 text-center text-lg">{c.flag&&!/^https?:/i.test(c.flag)?c.flag:"🏳️"}</span>}
                <span>{c.name}</span>{nationalChoice===String(c.id)&&<span className="ml-auto text-blue-800">✓</span>}
              </button>)}
              {!countries.some(c=>c.id&&String(c.name||"").toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g,"").includes(countrySearch.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g,"")))&&<p className="p-3 text-xs text-slate-500">No se encontraron países.</p>}
            </div>
          </div>
          <label className="block text-xs font-semibold">Categoría de selección
            <select value={nationalCategory} onChange={e=>setNationalCategory(e.target.value)} className="mt-1 w-full rounded border p-2 text-sm">
              <option value="senior">Selección absoluta</option>
              <option value="u20">Sub-20</option>
              <option value="u23">Olímpica / Sub-23</option>
              <option value="u17">Sub-17</option>
              <option value="u21">Sub-21</option>
            </select>
          </label>
          <p className="text-[11px] text-amber-800">La selección se obtiene del país y categoría elegidos. Si no existe, se crea en NationalTeam, nunca en la tabla de clubes.</p>
          {nationalError&&<p role="alert" className="text-xs text-red-700">{nationalError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" disabled={nationalBusy} onClick={()=>setNationalTarget(null)} className="rounded border px-3 py-2 text-xs">Cancelar</button>
            <button type="button" disabled={nationalBusy||!nationalChoice} onClick={async()=>{
              setNationalBusy(true);setNationalError("");
              try{
                const country=countries.find(c=>String(c.id)===nationalChoice);
                if(!country)throw Error("Selecciona un país de la tabla de países.");
                const suffix={senior:"",u20:" Sub-20",u23:" Olímpica (Sub-23)",u17:" Sub-17",u21:" Sub-21"}[nationalCategory];
                const name=String(country.name).trim()+suffix;
                const norm=n=>String(n||"").toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").replace(/[^a-z0-9]/g,"");
                const matches=nationalTeams.filter(t=>String(t.country_id)===nationalChoice&&t.category===nationalCategory);
                if(matches.length>1)throw Error("Hay selecciones duplicadas en NationalTeam.");
                let chosen=matches[0];
                if(!chosen)chosen=await base44.entities.NationalTeam.create({name,country_id:nationalChoice,category:nationalCategory});
                if(!chosen?.id)throw Error("No se pudo crear la selección.");
                setNationalTeams(old=>old.some(t=>String(t.id)===String(chosen.id))?old:[...old,chosen]);
                const current=await base44.entities.PlayerSeasonStats.get(nationalTarget.id);
                if(!current||current.season!==nationalTarget.season||current.competition!==nationalTarget.competition||String(current.player_id)!==String(nationalTarget.player_id))throw Error("La identidad del registro cambió; vuelve a abrirlo.");
                const patch={national_team_id:String(chosen.id),national_country_id:nationalChoice,team_id:"",team_name:chosen.name,fotmob_team_id:""};
                await base44.entities.PlayerSeasonStats.update(current.id,patch);
                setNationalLinks(old=>({...old,[String(current.id)]:{...patch,country_id:nationalChoice}}));
                setNationalTarget(null);
                queryClient.invalidateQueries({queryKey:HISTORICAL_PEER_KEY});
                queryClient.invalidateQueries({queryKey:["mf-legacy","national-teams"]});
              }catch(e){setNationalError(e?.message||"Error al vincular.");}
              finally{setNationalBusy(false);}
            }} className="rounded bg-[#003399] px-3 py-2 text-xs font-bold text-white disabled:opacity-40">{nationalBusy?"Guardando…":"Vincular selección"}</button>
          </div>
        </div>
      </div>}
      {teamLinkTarget&&<TeamLinkPicker season={activeSeason} records={stats} teams={teams} initialRecord={teamLinkTarget==="bulk"?null:teamLinkTarget} onClose={()=>setTeamLinkTarget(null)} onApply={onLinkTeams}/>}
      <HistoricalSingleEntryImporter open={valuationImporterOpen} onClose={()=>setValuationImporterOpen(false)} player={player} fotmobPlayerId={fotmobPlayerId} fm26Uid={player?.fm26_uid||""} stats={stats} teams={teams} onSaved={change=>{
        historicalRefresh();refreshTeamMatches();
        if(change?.entity&&change?.id){
          if(!patchHistoricalPeerCache(queryClient,change.entity,change.id,change.patch))
            queryClient.invalidateQueries({queryKey:HISTORICAL_PEER_KEY});
        }else if(change===undefined||change?.refresh){
          // JSON batch imports and genuinely new records alter the comparison population.
          queryClient.invalidateQueries({queryKey:HISTORICAL_PEER_KEY});
        }
      }} stats={stats} teams={teams} initialSeason={activeSeason}/>
    </div>,document.body
  );
}
export default function Stats(){
  const navigate=useNavigate(),queryClient=useQueryClient();
  const [statsParams]=useSearchParams();
  const pq=usePlayersQuery(),tq=useTeamsQuery();
  const [season,setSeason]=useState("Todas"),[competition,setCompetition]=useState("Todas"),[search,setSearch]=useState(statsParams.get("stats_player")||"");
  const [viewMode,setViewMode]=useState("season"),[minMinutes,setMinMinutes]=useState(0),[positionFilter,setPositionFilter]=useState("Todas");
  const [seasonDisplay,setSeasonDisplay]=useState("all"),[bestMetric,setBestMetric]=useState("composite");
  const [tab,setTab]=useState("con"),[category,setCategory]=useState("Resumen"),[sort,setSort]=useState("composite"),[sortDirection,setSortDirection]=useState("desc"),[importOpen,setImportOpen]=useState(false),[selected,setSelected]=useState(null),[page,setPage]=useState(0);
  const {rows,hasMore,loadMore,applyLocalRecord,refresh:refreshStats,busy,error,cached,refreshedAt}=useStatsRows(season,competition);
  const {data:peerDataset,isFetching:peerLoading,error:peerError}=useHistoricalPeerDataset(viewMode==="season");
  const compositeIndex=useMemo(()=>buildCompositeSeasonIndex(peerDataset?.observations||[]),[peerDataset]);
  const [columnConfig,setColumnConfig]=useState(initialConfig);
  const [settingsOpen,setSettingsOpen]=useState(false),[settingsContext,setSettingsContext]=useState(null),[prefsRecord,setPrefsRecord]=useState(null),[prefsWarning,setPrefsWarning]=useState("");
  const [unifiedOpen,setUnifiedOpen]=useState(false);
  useEffect(()=>{let mounted=true;(async()=>{
    try{const mine=await queryClient.fetchQuery({
      queryKey:STATS_LAYOUT_KEY,
      queryFn:async()=>{
        const res=await base44.entities.StatsViewPreference.list({limit:50});
        return unpack(res).find(r=>r.key==="stats_layout_personal_v1")||null;
      },
      staleTime:STATS_ROWS_STALE_MS,
      gcTime:STATS_CACHE_GC_MS,
    });
      if(mounted&&mine){setColumnConfig(sanitizeConfig(JSON.parse(mine.config_json)));setPrefsRecord(mine);}
    }catch(e){if(mounted)setPrefsWarning("No se pudieron recuperar los ajustes personales: "+(e?.message||e));}
  })();return()=>{mounted=false;};},[]);
  const players=pq.data||[],teams=tq.data||[];
  const byID=useMemo(()=>new Map(players.map(p=>[String(p.id),p])),[players]);
  const byTeam=useMemo(()=>new Map(teams.map(t=>[String(t.id),t])),[teams]);
  const stats=useMemo(()=>groupStatRows(rows.filter(r=>r.player_id)),[rows]);
  const seasonSummaries=useMemo(()=>buildSeasonSummaries(rows.filter(r=>r.player_id),teams),[rows,teams]);
  const competitions=useMemo(()=>[...new Set(rows.map(r=>r.competition))].filter(Boolean).sort(),[rows]);
  const positionOptions=useMemo(()=>[
    {value:"grupo:gk",label:"Porteros (GK)"},
    {value:"grupo:def",label:"Defensas"},
    {value:"grupo:mid",label:"Centrocampistas"},
    {value:"grupo:att",label:"Atacantes"},
    ...[...new Set(POSITION_OPTIONS)].map(value=>({value,label:value}))
  ],[]);
  const matchesPosition=value=>{
    if(positionFilter==="Todas")return true;
    const pos=normalizeHistoricalPosition(value);
    return positionFilter.startsWith("grupo:")?positionGroup(pos)===positionFilter.slice(6):pos===positionFilter;
  };
  const allCompetitionsRanked=useMemo(()=>{
    let rs=stats.map(r=>({record:r,player:byID.get(String(r.player_id))||null}));
    if(tab==="todos"){
      const ids=new Set(stats.map(r=>String(r.player_id)));
      rs=rs.concat(players.filter(p=>!ids.has(String(p.id))).map(p=>({record:null,player:p})));
    }
    return sortStatsItems(rs.filter(({record,player})=>matchesPosition(record?.position||player?.position||player?.position_raw)),"competition",sort,sortDirection,columnConfig);
  },[stats,players,tab,sort,sortDirection,byID,columnConfig,positionFilter]);
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
    // Keep unfinished seasons out of historical rankings and historical bests.
    const displayedSummaries=seasonSummaries.filter(summary=>seasonDisplay==="current" ? seasonActive(summary.season) : !seasonActive(summary.season));
    const mapped=displayedSummaries.map(summary=>({summary,player:byID.get(String(summary.player_id))||null}));
    if(tab==="todos"){
      const existing=new Set(seasonSummaries.map(s=>String(s.player_id)));
      if(seasonDisplay!=="current")mapped.push(...players.filter(p=>!existing.has(String(p.id))).map(player=>({summary:null,player})));
    }
    const positioned=mapped.filter(({summary,player})=>matchesPosition(compositeIndex.get(String(summary?.player_id||"")+"|"+String(summary?.season||""))?.position||player?.position||player?.position_raw));
    const enough=positioned.filter(({summary})=>summary?(summary.totals.minutes.value||0)>=minMinutes:minMinutes===0);
    const ranked=seasonDisplay==="best" ?
      (bestMetric==="composite"?bestSeasonByComposite(enough,compositeIndex):bestSeasonPerPlayer(enough,bestMetric,columnConfig)) : enough;
    return sort==="composite"?sortByComposite(ranked,compositeIndex,sortDirection):sortStatsItems(ranked,"season",sort,sortDirection,columnConfig);
  },[seasonSummaries,byID,players,tab,minMinutes,sort,sortDirection,columnConfig,seasonDisplay,bestMetric,compositeIndex,positionFilter]);
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
    if(viewMode==="season"&&seasonDisplay==="best"&&(key==="composite"||bestCriteria.some(c=>c.id===key)))setBestMetric(key);
    setPage(0);
  };
  const filtered=visible.slice(page*50,(page+1)*50);
  const activeCount=viewMode==="season"?seasonVisible.length:visible.length;
  const [bulkSelection,setBulkSelection]=useState(()=>new Set());
  const [compareOpen,setCompareOpen]=useState(false);
  const [bulkConfirm,setBulkConfirm]=useState("");
  const [bulkBusy,setBulkBusy]=useState(false);
  const [bulkStatus,setBulkStatus]=useState("");
  const bulkRows=useMemo(()=>seasonVisible.filter(({summary})=>summary&&bulkSelection.has(summary.id)),[seasonVisible,bulkSelection]);
  const bulkPlayerCount=useMemo(()=>new Set(bulkRows.map(({summary})=>summary.player_id?("p:"+summary.player_id):summary.fotmob_player_id?("f:"+summary.fotmob_player_id):"")).size,[bulkRows]);
  const toggleBulk=id=>setBulkSelection(prev=>{const next=new Set(prev);if(next.has(id))next.delete(id);else next.add(id);return next;});
  const toggleBulkPage=checked=>{
    const ids=seasonVisible.slice(page*50,(page+1)*50).filter(({summary})=>summary).map(({summary})=>summary.id);
    setBulkSelection(prev=>{const next=new Set(prev);ids.forEach(id=>{if(checked)next.add(id);else next.delete(id);});return next;});
  };
  const changeViewMode=mode=>{
    setBulkSelection(new Set());setCompareOpen(false);setBulkConfirm("");
    if(mode==="season"){setViewMode("season");setCompetition("Todas");setSort("composite");setSortDirection("desc");}
    else{setViewMode("competition");setSort("rating");}
    setPage(0);
  };
  const changeSeasonDisplay=mode=>{
    setBulkConfirm("");setSeasonDisplay(mode);setSort("composite");setSortDirection("desc");
    if(mode==="best")setBestMetric("composite");
    setPage(0);
  };
  const changeSort=value=>{
    setSort(value);setSortDirection(defaultSortDirection(value));
    if(viewMode==="season"&&seasonDisplay==="best"&&(value==="composite"||bestCriteria.some(c=>c.id===value)))setBestMetric(value);
    setPage(0);
  };
  const sortOptions=useMemo(()=>{
    const list=[];
    if(!["composite","rating","goals","assists","xg","xa","tackles","minutes","appearances","gaper90","xgaper90"].includes(sort))
      list.push({value:sort,label:getColumn(columnConfig,sort)?.name||sort});
    if(viewMode==="season")list.push({value:"composite",label:"Composite MF LEGACY"});
    list.push({value:"rating",label:"Nota FotMob"},{value:"goals",label:"Goles"},{value:"assists",label:"Asistencias"},{value:"xg",label:"xG"},{value:"xa",label:"xA"},{value:"tackles",label:"Entradas"});
    if(viewMode==="season")list.push({value:"minutes",label:"Minutos"},{value:"appearances",label:"Partidos"},{value:"gaper90",label:"G+A /90"},{value:"xgaper90",label:"xG+xA /90"});
    return list;
  },[sort,viewMode,columnConfig]);
  const bestOptions=useMemo(()=>[{value:"composite",label:"Composite MF LEGACY"},...bestCriteria.map(c=>({value:c.id,label:c.name}))],[bestCriteria]);
  const runBulkDelete=async kind=>{
    if(!bulkRows.length){setBulkStatus("No hay filas seleccionadas.");return;}
    setBulkBusy(true);setBulkStatus("");
    try{
      if(kind==="season"){
        for(const {summary} of bulkRows){
          if(summary.player_id)await base44.entities.PlayerSeasonStats.deleteMany({player_id:String(summary.player_id),season:summary.season});
          else if(summary.fotmob_player_id)await base44.entities.PlayerSeasonStats.deleteMany({fotmob_player_id:String(summary.fotmob_player_id),season:summary.season});
          else throw Error("Una de las temporadas seleccionadas no tiene identificador de jugador.");
        }
      }else{
        const seen=new Set();
        for(const {summary} of bulkRows){
          const key=summary.player_id?("p:"+summary.player_id):summary.fotmob_player_id?("f:"+summary.fotmob_player_id):"";
          if(!key)throw Error("Uno de los jugadores seleccionados no tiene identificador.");
          if(seen.has(key))continue;
          seen.add(key);
          await base44.entities.PlayerSeasonStats.deleteMany(summary.player_id?{player_id:String(summary.player_id)}:{fotmob_player_id:String(summary.fotmob_player_id)});
        }
      }
      setBulkStatus(kind==="season"?"Temporadas eliminadas: "+bulkRows.length+".":"Estadísticas eliminadas de "+bulkPlayerCount+" jugador(es), en todas sus temporadas.");
      setBulkSelection(new Set());setBulkConfirm("");
      refreshStats();
      queryClient.invalidateQueries({queryKey:STATS_DETAIL_KEY});
      queryClient.invalidateQueries({queryKey:HISTORICAL_PEER_KEY});
    }catch(error){
      setBulkStatus("No se pudo eliminar: "+(error?.message||"error de permisos o conexión"));
    }finally{setBulkBusy(false);}
  };
  const [detailRows,setDetailRows]=useState([]),[detailLoading,setDetailLoading]=useState(false);
  const detailRequest=useRef(0);
  const updateMetric=async(record,change)=>{
    if(!record?.id)throw Error("El registro no tiene identificador válido.");
    const filters=record.external_record_id?{external_record_id:record.external_record_id}:
      {player_id:record.player_id,season:record.season,competition:record.competition};
    const found=unpack(await base44.entities.PlayerSeasonStats.filter(filters,{limit:25}));
    const exact=found.filter(r=>String(r.id)===String(record.id));
    if(exact.length!==1)throw Error("Registro no encontrado o duplicado; vuelve a abrir la ficha.");
    const current=exact[0];
    if(String(current.player_id)!==String(record.player_id)||
      current.season!==record.season||current.competition!==record.competition)
      throw Error("La identidad del historial ha cambiado.");
    const changes=Array.isArray(change)?change:[change];
    for(const c of changes){
      const actualValue=r=>c.field?num(r[c.field]):
        num((r.metrics||[]).find(m=>metricName(m.name)===metricName(c.name))?.value);
      if(actualValue(record)!==actualValue(current))
        throw Error("El dato cambió desde que abriste la ficha. Actualízala antes de editar.");
    }
    // All components of the requested statistic are persisted in ONE update.
    const {update}=Array.isArray(change)?applyManualStatChanges(current,changes):applyManualStatChange(current,change);
    await base44.entities.PlayerSeasonStats.update(record.id,update);
    setDetailRows(rows=>rows.map(r=>String(r.id)===String(record.id)?{...r,...update}:r));
    applyLocalRecord(record.id,update);
    // Rebuild percentiles immediately from our complete in-memory population.
    // No global refetch, no redundant full STATS download after a single edit.
    if(!patchHistoricalPeerCache(queryClient,"PlayerSeasonStats",record.id,update))
      queryClient.invalidateQueries({queryKey:HISTORICAL_PEER_KEY});
  };
  const updateTeamMatches=async(record,matches)=>{
    if(!record?.id)throw Error("Este registro no tiene identificador y no puede modificarse.");
    if(!Number.isInteger(matches)||matches<1||matches>200)throw Error("Los PJ del equipo deben ser un entero entre 1 y 200.");
    await base44.entities.PlayerSeasonStats.update(record.id,{team_matches:matches});
    setDetailRows(current=>current.map(r=>String(r.id)===String(record.id)?{...r,team_matches:matches}:r));
    applyLocalRecord(record.id,{team_matches:matches});
    if(!patchHistoricalPeerCache(queryClient,"PlayerSeasonStats",record.id,{team_matches:matches}))
      queryClient.invalidateQueries({queryKey:HISTORICAL_PEER_KEY});
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
      try{
        await saveTeamLinkSafely({id:record.id,teamId:team.id,
          read:async id=>base44.entities.PlayerSeasonStats.get(id),
          update:(id,patch)=>base44.entities.PlayerSeasonStats.update(id,patch)});
        updatedIds.push(String(record.id));
      }catch(e){failed.push({id:record.id,label:record.competition+" ("+record.season+"): "+(e?.message||"error")});}
    }
    if(updatedIds.length){
      setDetailRows(current=>current.map(r=>updatedIds.includes(String(r.id))?{...r,team_id:String(team.id)}:r));
      for(const id of updatedIds){
        applyLocalRecord(id,{team_id:String(team.id)});
        if(!patchHistoricalPeerCache(queryClient,"PlayerSeasonStats",id,{team_id:String(team.id)}))
          queryClient.invalidateQueries({queryKey:HISTORICAL_PEER_KEY});
      }
    }
    return {updated:updatedIds.length,failed};
  };
  const openSeasonDetail=(summary,player)=>openDetail({record:summary?.records?.[0]||null,player,season:summary?.season});
  const openDetail=async(row)=>{
    const seq=++detailRequest.current;
    const filter=row.player?{player_id:String(row.player.id)}:{fotmob_player_id:String(row.record?.fotmob_player_id||"")};
    const kind=row.player?"player":"fotmob", value=row.player?.id||row.record?.fotmob_player_id;
    if(!value)return;
    const key=statsDetailKey(kind,value);
    const cachedRows=queryClient.getQueryData(key);
    setSelected(row);
    setDetailRows(cachedRows||[]);
    setDetailLoading(!cachedRows);
    try{
      const detail=await queryClient.fetchQuery({
        queryKey:key,
        queryFn:async()=>unpack(await base44.entities.PlayerSeasonStats.filter(filter,{limit:500})).map(parseData),
        staleTime:STATS_ROWS_STALE_MS,
        gcTime:STATS_CACHE_GC_MS,
        retry:1,
      });
      if(seq===detailRequest.current)setDetailRows(detail);
    }catch{
      if(seq===detailRequest.current&&!cachedRows)setDetailRows(row.record?[row.record]:[]);
    }finally{
      if(seq===detailRequest.current)setDetailLoading(false);
    }
  };
  const columns=columnConfig.columns.competition[category]||[];
  const listDividers=new Set(columnConfig.dividers?.competition?.[category]||[]);
  const listLine=id=>listDividers.has(id)?" border-r-[3px] border-r-blue-300":"";
  const saveColumns=async(draft)=>{
    const clean=sanitizeConfig(draft);
    const payload={key:"stats_layout_personal_v1",version:clean.version,config_json:JSON.stringify(clean)};
    let savedId=prefsRecord?.id||null;
    if(savedId){await base44.entities.StatsViewPreference.update(savedId,payload);}
    else{const created=await base44.entities.StatsViewPreference.create(payload);savedId=created?.id||created?.data?.id||null;setPrefsRecord({...payload,id:savedId});}
    queryClient.setQueryData(STATS_LAYOUT_KEY,{...payload,id:savedId});
    setColumnConfig(clean);setPrefsWarning("");
  };
  const importComplete=()=>{
    // A successful import can add entire seasons or new Player/Team links.
    // Invalidate only affected datasets; leave layout/preferences in cache.
    queryClient.invalidateQueries({queryKey:STATS_ROWS_KEY});
    queryClient.invalidateQueries({queryKey:STATS_DETAIL_KEY});
    queryClient.invalidateQueries({queryKey:["mf-legacy","players"]});
    queryClient.invalidateQueries({queryKey:["mf-legacy","teams"]});
    queryClient.invalidateQueries({queryKey:HISTORICAL_PEER_KEY});
  };
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
      <StatsControlBar
        position={positionFilter}
        positionOptions={positionOptions}
        onPosition={value=>{setPositionFilter(value);setPage(0);setBulkSelection(new Set());}}
        season={season}
        seasonOptions={options}
        onSeason={value=>{setSeason(value);setCompetition("Todas");setPage(0);}}
        competition={competition}
        competitions={competitions}
        onCompetition={value=>{setCompetition(value);setPage(0);}}
        search={search}
        onSearch={value=>{setSearch(value);setPage(0);}}
        sort={sort}
        sortOptions={sortOptions}
        onSort={changeSort}
        minMinutes={minMinutes}
        onMinMinutes={value=>{setMinMinutes(value);setPage(0);}}
        viewMode={viewMode}
        onViewMode={changeViewMode}
        seasonDisplay={seasonDisplay}
        onSeasonDisplay={changeSeasonDisplay}
        bestMetric={bestMetric}
        bestOptions={bestOptions}
        onBestMetric={value=>{setBestMetric(value);setSort(value);setSortDirection("desc");setPage(0);}}
        categories={CAT_TABS}
        category={category}
        onCategory={label=>{setCategory(label);setPage(0);}}
      />
      <p className="sr-only">STAT COLUMNS</p>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3"><div className="text-xs font-bold text-[#0d315b]">{viewMode==="season"?(seasonDisplay==="current"?"Ranking de la temporada actual (en curso)":seasonDisplay==="best"?"Mejor temporada finalizada por jugador · "+(bestMetric==="composite"?"Composite MF LEGACY":getColumn(columnConfig,bestMetric)?.name||bestMetric):"Ranking histórico · temporadas finalizadas"):"Detalle por competición"}</div><div className="flex flex-wrap items-center gap-2"><span role="status" className="text-[11px] text-slate-500">{busy?(cached?"Actualizando en segundo plano…":"Cargando estadísticas…"):cached?"En caché · acceso rápido":"Sin datos cargados"}{refreshedAt&&!busy?" · "+new Date(refreshedAt).toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"}):""}</span><button type="button" onClick={()=>{refreshStats();queryClient.invalidateQueries({queryKey:HISTORICAL_PEER_KEY});}} disabled={busy} title="Sincronizar estadísticas y Composite con Base44" className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1.5 text-[11px] font-bold text-blue-900 disabled:opacity-40"><RefreshCw size={13} className={busy?"animate-spin":""}/> Actualizar datos</button><p className="text-xs text-slate-500">{activeCount.toLocaleString("es")} filas · {rows.length} registros consultados {hasMore?"(cobertura parcial: hay más por cargar)":""}</p></div></div>
      {viewMode==="season"&&(bulkSelection.size>0||bulkStatus)&&<div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-[#eef2f7] px-4 py-2">
        {bulkSelection.size>0&&<span className="text-[11px] font-black uppercase tracking-wider text-[#173B67]">{bulkSelection.size} seleccionado{bulkSelection.size===1?"":"s"}</span>}
        {bulkSelection.size>0&&!bulkConfirm&&<>
          {bulkSelection.size>1?<button type="button" onClick={()=>setCompareOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-[#003399] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#002777]"><ArrowLeftRight size={13}/> Comparar seleccionados</button>:<span className="text-[11px] text-slate-500">Selecciona dos o más temporadas para compararlas.</span>}
          <button type="button" onClick={()=>setBulkConfirm("season")} className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-50">Eliminar temporadas</button>
          <button type="button" onClick={()=>setBulkConfirm("player")} className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-50">Eliminar jugadores completos</button>
        </>}
        {bulkConfirm&&<>
          <span role="alert" className="text-[11px] font-semibold text-rose-800">{bulkConfirm==="season"?"Se eliminarán todas las estadísticas de las "+bulkSelection.size+" temporadas seleccionadas. La ficha del jugador se conserva.":"Se eliminarán todas las estadísticas de "+bulkPlayerCount+" jugador(es), en todas sus temporadas. La ficha del jugador se conserva."}</span>
          <button type="button" disabled={bulkBusy} onClick={()=>runBulkDelete(bulkConfirm)} className="rounded-lg bg-rose-600 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-40">{bulkBusy?"Eliminando…":"Sí, eliminar"}</button>
          <button type="button" disabled={bulkBusy} onClick={()=>setBulkConfirm("")} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 disabled:opacity-40">Cancelar</button>
        </>}
        {bulkStatus&&<span role="status" className="text-[11px] font-semibold text-[#173B67]">{bulkStatus}</span>}
        {bulkSelection.size>0&&<button type="button" onClick={()=>{setBulkSelection(new Set());setBulkConfirm("");}} className="ml-auto rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700">Quitar selección</button>}
      </div>}
      {error&&<div className="border-b border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">Error al cargar estadísticas: {error}</div>}
      {viewMode==="season"?<SeasonStatsTable items={seasonVisible} compositeBySeason={compositeIndex} peerLoading={peerLoading} peerError={peerError} globalRanks={globalSeasonRanks} playerRanks={playerSeasonRanks} category={category} config={columnConfig} page={page} sortKey={sort} sortDirection={sortDirection} onSort={chooseSort} onOpen={openSeasonDetail} onTeam={id=>navigate("/teams?stats_team="+encodeURIComponent(id))} selection={bulkSelection} onToggleSelect={toggleBulk} onToggleSelectPage={toggleBulkPage}/>:<div className="max-w-full overflow-x-auto"><table className="w-full min-w-[920px] text-left text-xs"><thead className="bg-[#003399] text-white"><tr><th className={"px-2 py-3 text-center"+listLine("rank")} title="Posición entre las competiciones del jugador (posición entre todos los jugadores)">RANK</th><SortHeader column="player" label="JUGADOR" active={sort} direction={sortDirection} onSort={chooseSort} align="left" className={"min-w-[190px]"+listLine("player")}/><SortHeader column="club" label="EQUIPO" active={sort} direction={sortDirection} onSort={chooseSort} align="left" className={listLine("club")}/><SortHeader column="season" label="TEMPORADA" active={sort} direction={sortDirection} onSort={chooseSort} align="left" className={listLine("season")}/><SortHeader column="competition" label="COMPETICIÓN" active={sort} direction={sortDirection} onSort={chooseSort} align="left" className={listLine("competition")}/><SortHeader column="appearances" label="PJ" active={sort} direction={sortDirection} onSort={chooseSort} className={listLine("appearances")}/><SortHeader column="minutes" label="MIN" active={sort} direction={sortDirection} onSort={chooseSort} className={listLine("minutes")}/><SortHeader column="rating" label="NOTA" active={sort} direction={sortDirection} onSort={chooseSort} className={listLine("rating")}/>{columns.map(id=><SortHeader key={id} column={id} label={getColumn(columnConfig,id)?.name||metricLabel(id)} active={sort} direction={sortDirection} onSort={chooseSort} className={listLine(id)}/>)}<th className="px-3 py-3">FICHA</th></tr></thead>
      <tbody>{filtered.map(({record:r,player:p},i)=>{const info=r?resolveTeam(r,teams,stats):null;const team=r?info?.team:byTeam.get(String(p?.team_id||""));const linkable=!r||info?.status==="confirmed";return <tr key={(r?.id||r?.external_record_id||p?.id||"")+":"+i} className="border-b border-slate-100 odd:bg-white even:bg-[#f6f8f6] hover:bg-[#eef3fb]"><td className={"whitespace-nowrap px-2 py-3 text-center"+listLine("rank")}><strong className="font-black text-slate-800">{playerCompetitionRanks.get(rankIdentity({record:r,player:p},"competition"))??"—"}</strong><span className="ml-1 text-[10px] font-normal text-slate-500">({globalCompetitionRanks.get(rankIdentity({record:r,player:p},"competition"))??"—"})</span></td><td className={"px-3 py-2"+listLine("player")}><button onClick={()=>openDetail({record:r,player:p})} className="flex items-center gap-2 text-left"><Avatar name={p?.name||r?.player_name} photo={playerPhoto(p)}/><span><span className="block font-extrabold text-[#0f3156] hover:underline">{p?.name||r?.player_name||"Jugador"}</span><span className="text-[10px] text-slate-400">FM {playerUID(p)||"—"} · FotMob {r?.fotmob_player_id||"—"}</span></span></button></td><td className={"px-3 py-2 text-slate-700"+listLine("club")}>{r&&info?.status==="national"?<span className="text-slate-500">Selección nacional</span>:r&&!linkable?<span className="text-amber-800">{info?.label||"Club pendiente"}{info?.status==="suggested"&&<span className="block text-[10px]">Sin verificar</span>}</span>:team?.id?<button className="hover:underline" onClick={()=>navigate("/teams?stats_team="+encodeURIComponent(team.id))}><TeamBadge teamName={team.name} logo={teamLogo(team)}/></button>:<TeamBadge teamName={r?.team_name||team?.name} logo={teamLogo(team)}/>}</td><td className={"px-3 py-3"+listLine("season")}>{r?.season||"—"}</td><td className={"px-3 py-3"+listLine("competition")}>{r?.competition||"Sin datos"}</td><td className={"px-3 py-3 text-right"+listLine("appearances")}>{show(r?.appearances)}</td><td className={"px-3 py-3 text-right"+listLine("minutes")}>{show(r?.minutes)}</td><td className={"px-3 py-3 text-right font-bold"+listLine("rating")}>{show(r?.rating,2)}</td>{columns.map(id=><td key={id} className={"px-3 py-3 text-right"+listLine(id)}>{show(columnValue(r,"competition",id,columnConfig),getColumn(columnConfig,id)?.decimals??0)}{columnValue(r,"competition",id,columnConfig)!==null&&getColumn(columnConfig,id)?.unit?" "+getColumn(columnConfig,id).unit:""}</td>)}<td className="px-3 py-3"><button onClick={()=>openDetail({record:r,player:p})} className="rounded-lg border border-blue-200 px-3 py-2 font-bold text-[#003399] hover:bg-blue-50">Ver stats</button></td></tr>})}
      {!filtered.length&&<tr><td colSpan={9+columns.length} className="px-6 py-12 text-center"><Database className="mx-auto mb-3 text-slate-300" size={36}/><p className="font-bold text-slate-600">Todavía no hay estadísticas para estos filtros</p><p className="mt-1 text-xs text-slate-400">Puedes cambiar los filtros o importar archivos de FotMob Studio.</p></td></tr>}</tbody></table></div>}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"><p className="text-xs text-slate-500">Página {page+1} · Los campos no disponibles se indican con —</p><div className="flex gap-2">{page>0&&<button onClick={()=>setPage(x=>x-1)} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold">Anterior</button>}{(page+1)*50<activeCount&&<button onClick={()=>setPage(x=>x+1)} className="rounded-lg bg-[#003399] px-4 py-2 text-xs font-bold text-white">Siguiente</button>}{hasMore&&<button disabled={busy} onClick={loadMore} className="rounded-lg border border-blue-300 px-4 py-2 text-xs font-bold text-[#003399] disabled:opacity-40">Cargar más</button>}</div></div></div>

    </div>
    {prefsWarning&&<p className="px-5 py-2 text-xs text-amber-700">{prefsWarning}</p>}
    {settingsOpen&&<StatsColumnSettings config={columnConfig} mode={settingsContext?.mode||viewMode} category={settingsContext?.category||category} sample={settingsContext?.sample||(viewMode==="season"?seasonSummaries[0]:stats[0])} onClose={()=>setSettingsOpen(false)} onSave={saveColumns}/>}
    {importOpen&&<StatsImport players={players} teams={teams} onClose={()=>setImportOpen(false)} onImported={importComplete} onOpenUnified={()=>{setImportOpen(false);setUnifiedOpen(true);}}/>}
    {unifiedOpen&&createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Importar FotMob y CraftedFC">
        <div className="flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="flex shrink-0 items-center justify-between bg-[#0e2844] px-5 py-3 text-white">
            <p className="text-sm font-black">STATS · Importación FotMob + CraftedFC</p>
            <button onClick={()=>setUnifiedOpen(false)} className="rounded-lg p-2 hover:bg-white/10" aria-label="Cerrar importador unificado"><X size={20}/></button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto"><ImportUnified onImported={importComplete}/></div>
        </div>
      </div>,document.body
    )}
    {selected&&<StatDetail player={selected.player} stats={detailRows.length?detailRows:selected.record?[selected.record]:[]} initialSeason={selected.season||selected.record?.season||""} teams={teams} config={columnConfig} onLinkTeams={linkHistoricalTeams} onOpenSettings={openDetailSettings} onSetTeamMatches={updateTeamMatches} onSetMetric={updateMetric} onClose={()=>{detailRequest.current++;setSelected(null);}} onPlayer={id=>{detailRequest.current++;setSelected(null);navigate("/players?stats_player="+encodeURIComponent(id));}} />}
    {compareOpen&&bulkRows.length>1&&<SeasonCompareView entries={bulkRows} compositeBySeason={compositeIndex} config={columnConfig} observations={peerDataset?.observations||[]} peerLoading={peerLoading} peerError={peerError} onClose={()=>setCompareOpen(false)} onOpenDetail={(summary,player)=>{setCompareOpen(false);openSeasonDetail(summary,player);}} onTeam={id=>navigate("/teams?stats_team="+encodeURIComponent(id))}/>}
  </div>;
}