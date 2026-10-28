import {playPctFromTeamMatches} from "@/utils/statsPlayPct";
import React,{useState} from "react";
import {ArrowRight,Shield} from "lucide-react";
import SortHeader from "@/components/stats/SortHeader";
import {rankIdentity} from "@/utils/statsRank";
import {statDisplay} from "@/utils/statsSeason";
import {getColumn,columnValue,formulaCoverage,initialConfig,formatStatRate} from "@/utils/statsColumns";
import {metricLabel} from "@/utils/statsImport";
import {seasonActive} from "@/utils/statsViews";
import {compositeSeasonKey,displaySeasonPosition} from "@/utils/statsCompositeRanking";

export const seasonColumns={
 Resumen:["goals","assists","xg","xa","gaper90","xgaper90"],
 Ataque:["goals","assists","ga","goalsper90","assistsper90","gaper90","xg","xa","xgper90","xaper90","xgaper90","shots","shotsontarget"],
 Creación:["chancescreated","bigchancescreated","accuratepasses","successfulcrosses","xa","xaper90"],
 Defensa:["tackles","interceptions","recoveries","clearances","cleansheets"],
 Portería:["saves","savesper90","xaper90","cleansheets","goalsconcededwhileonpitch"],
 Físico:["totaldistancecovered","numberofsprints"]
};
const labels={ga:"G + A",gaper90:"G + A /90",xgaper90:"xG + xA /90",xga:"xG + xA",goalsper90:"Goles /90",assistsper90:"Asist. /90",xgper90:"xG /90",xaper90:"xA /90",totaldistancecovered:"Distancia (m)",numberofsprints:"Sprints",goalsconcededwhileonpitch:"Goles encajados (en campo)"};
const shortSeason=s=>String(s||"").replace(/^(\d{4})[/-](\d{4})$/,(_,start,end)=>start+"/"+end.slice(-2));
const fmt=(v,d=0)=>v===null||v===undefined||v===""||!Number.isFinite(Number(v))?"—":Number(v).toLocaleString("es-ES",{minimumFractionDigits:d,maximumFractionDigits:d});
const dec=k=>["xg","xa","xga","gaper90","xgaper90","goalsper90","assistsper90","xgper90","xaper90"].includes(k);
const GK_OFFENSE=new Set(["goals","assists","ga","gaper90","goalsper90","assistsper90","xg","xa","xga","xgper90","xaper90","xgaper90","shots","shotsontarget","chancescreated","bigchancescreated"]);
const goalkeeper=p=>/^(GK|POR|G)$/i.test(String(p?.position||p?.position_raw||"").trim());

function PlayerPhoto({player,name}){
 const src=player?.card_photo_url||player?.cardPhotoUrl||player?.photo_url||player?.photoUrl;
 const [broken,setBroken]=useState(false);
 return <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#e9f0f9] font-bold text-[#31557b]">{src&&!broken?<img src={src} alt="" className="h-full w-full object-cover" onError={()=>setBroken(true)}/>:String(name||"?").slice(0,2).toUpperCase()}</div>;
}
function ClubBadge({summary,onTeam}){
 const {mainClub,otherClubs,unresolvedTeams}=summary;
 const [broken,setBroken]=useState(false);
 if(!mainClub)return <div className="flex items-center gap-1 text-amber-700"><Shield size={14}/>Sin club confirmado</div>;
 const photo=mainClub.logo||mainClub.logo_url||"";
 return <div className="min-w-36">
  <button className="inline-flex items-center gap-2 font-semibold text-slate-800 hover:text-[#003399] hover:underline" onClick={()=>onTeam(mainClub.id)} title="Club con más minutos identificados, no se asignan competiciones sin club">
   {photo&&!broken?<img src={photo} alt="" className="h-5 w-5 object-contain" onError={()=>setBroken(true)}/>:<Shield size={15} className="text-slate-400"/>}{mainClub.name}
  </button>
  {(otherClubs.length>0||unresolvedTeams>0)&&<p className="mt-0.5 text-[10px] text-amber-700">{otherClubs.length>0?("+"+otherClubs.length+" club(es)"):""} {unresolvedTeams>0?("· "+unresolvedTeams+" competiciones sin club confirmado"):""}</p>}
 </div>;
}
export default function SeasonStatsTable({items=[],category="Resumen",page=0,onOpen,onTeam,minimumMinutes=0,config=initialConfig(),sortKey="composite",sortDirection="desc",onSort=()=>{},globalRanks=new Map(),playerRanks=new Map(),compositeBySeason=new Map(),peerLoading=false,peerError=null,teamSeasonMatches=[],selection=new Set(),onToggleSelect=()=>{},onToggleSelectPage=()=>{}}){
 const columns=(config.columns?.season?.[category]||seasonColumns[category]||seasonColumns.Resumen).filter(k=>k!=="rating");
 const divider=new Set(config.dividers?.season?.[category]||[]);
 const line=id=>divider.has(id)?" border-r-[3px] border-r-blue-300":"";
 // The parent supplies rows ALREADY sorted by the same Composite used by
 // the global rank. Never independently sort here: that would misalign RANK.
 const pageRows=items.filter(({summary})=>summary?(summary.totals.minutes.value||0)>=minimumMinutes:minimumMinutes===0).slice(page*50,(page+1)*50);
 const pageSelectable=pageRows.filter(({summary})=>summary).map(({summary})=>summary.id);
 return <div>
  <div data-stats-horizontal className="max-w-full overflow-x-auto">
   <table className="w-full min-w-[900px] text-left text-[11px]">
    <thead className="bg-[#003399] text-white"><tr>
     <th className="w-8 px-2 py-3 text-center"><input type="checkbox" aria-label="Seleccionar todas las temporadas de esta página" disabled={!pageSelectable.length} checked={pageSelectable.length>0&&pageSelectable.every(id=>selection.has(id))} onChange={e=>onToggleSelectPage(e.target.checked)} className="h-3.5 w-3.5 cursor-pointer accent-[#1D4ED8] disabled:cursor-not-allowed"/></th>
     <th className={"px-3 py-3 text-center"+line("rank")} title="Posición entre las temporadas del mismo jugador (posición entre todos los jugadores)">RANK</th>
     <SortHeader column="player" label="JUGADOR" active={sortKey} direction={sortDirection} onSort={onSort} align="left" className={"min-w-36"+line("player")}/>
     <SortHeader column="season" label="TEMP." active={sortKey} direction={sortDirection} onSort={onSort} align="left" className={line("season")}/>
     <SortHeader column="club" label="CLUB PRINCIPAL" active={sortKey} direction={sortDirection} onSort={onSort} align="left" className={"min-w-36"+line("club")}/>
     <SortHeader column="appearances" label="PJ" active={sortKey} direction={sortDirection} onSort={onSort} className={line("appearances")}/>
     <SortHeader column="minutes" label="MIN" active={sortKey} direction={sortDirection} onSort={onSort} className={line("minutes")}/>
     <th className="px-2 py-2 text-center whitespace-nowrap" title="Posición histórica efectiva: manual por competición, manual por temporada, FIFA/FC o respaldo provisional">POS.</th>
     <SortHeader column="composite" label="COMPOSITE" active={sortKey} direction={sortDirection} onSort={onSort} className={line("composite")}/>
     {columns.map(k=><SortHeader key={k} column={k} label={getColumn(config,k)?.name||labels[k]||metricLabel(k)} active={sortKey} direction={sortDirection} onSort={onSort} className={line(k)}/>)}
     <th className="px-3 py-3">DETALLE</th>
    </tr></thead>
    <tbody>{pageRows.map(({summary,player},i)=>{
     const name=player?.name||summary?.player_name||"Jugador";
     if(!summary)return <tr key={String(player?.id||i)} className="border-b border-slate-100 text-xs"><td className="px-2 py-3"/><td className={"whitespace-nowrap px-2 py-3 text-center"+line("rank")}><strong className="font-black text-slate-800">{playerRanks.get(rankIdentity({summary,player},"season"))??"—"}</strong><span className="ml-1 text-[10px] font-normal text-slate-500">({globalRanks.get(rankIdentity({summary,player},"season"))??"—"})</span></td><td className="px-3 py-2"><div className="flex items-center gap-2"><PlayerPhoto player={player} name={name}/><span className="font-semibold text-slate-700">{name}</span></div></td><td colSpan={7+columns.length} className="px-3 py-3 text-slate-400">Sin estadísticas importadas para esta temporada</td></tr>;
     return <tr key={summary.id} className="border-b border-slate-100 align-middle odd:bg-white even:bg-[#f6f8f6] hover:bg-[#edf3fb]">
      <td className="px-2 py-3 text-center"><input type="checkbox" aria-label={"Seleccionar "+name+" "+summary.season} checked={selection.has(summary.id)} onChange={()=>onToggleSelect(summary.id)} className="h-3.5 w-3.5 cursor-pointer accent-[#1D4ED8]"/></td>
      <td className={"whitespace-nowrap px-2 py-3 text-center"+line("rank")}><strong className="font-black text-slate-800">{playerRanks.get(rankIdentity({summary,player},"season"))??"—"}</strong><span className="ml-1 text-[10px] font-normal text-slate-500">({globalRanks.get(rankIdentity({summary,player},"season"))??"—"})</span></td>
      <td className={"px-3 py-2"+line("player")}><button onClick={()=>onOpen(summary,player)} className="flex items-center gap-2 text-left">
       <PlayerPhoto player={player} name={name}/><span className="font-extrabold text-[#0f3156] hover:underline">{name}</span>
      </button></td>
      <td className={"whitespace-nowrap px-2 py-2 font-semibold"+line("season")}>{shortSeason(summary.season)}{seasonActive(summary.season)&&<span className="ml-1 text-[10px] font-normal text-blue-700">(en curso)</span>}</td>
      <td className={"px-2 py-2"+line("club")}><ClubBadge summary={summary} onTeam={onTeam}/></td>
      <td className={"px-2 py-2 text-right"+line("appearances")}>{fmt(statDisplay(summary,"appearances"))}</td>
      <td className={"px-2 py-2 text-right"+line("minutes")}>{fmt(statDisplay(summary,"minutes"))}</td>
      {(()=>{const x=compositeBySeason.get(compositeSeasonKey(summary.player_id,summary.season));return <>
        <td className="px-2 py-2 text-center font-bold text-slate-700" title={x?.source==="fallback"?"Posición actual, solo respaldo provisional":x?.source==="fifa"?"Posición de la carta FIFA/FC":x?.source==="season"?"Posición histórica manual":x?.source==="competition"?"Posición manual por competición":"Posición histórica no disponible"}>{displaySeasonPosition(x?.position)}{x?.source==="fallback"&&<span className="text-amber-600">*</span>}</td>
        <td className={"px-2 py-2 text-right font-extrabold tabular-nums "+(x?.score!=null?"text-[#003399]":"text-slate-400")} title={x?.score!=null?"Composite "+x.role+" · cobertura "+fmt(x.coverage,1)+"% · no es el Legacy Rating definitivo":peerError?"No se pudo sincronizar toda la base; se conserva la comparación cargada":peerLoading?"Calculando con la base completa":"Sin Composite calculable"}>{x?.score==null?"—":fmt(x.score,1)}</td>
      </>})()}
      {columns.map(k=>{
       const computed=columnValue(summary,"season",k,config);
       const value=k==="playpct"&&computed===null?playPctFromTeamMatches(summary,teamSeasonMatches):computed;
       const coverage=formulaCoverage(summary,"season",k,config);
       const partial=coverage?coverage.available<coverage.total:summary.totals[k]?.partial;
       const hint=coverage?coverage.available+" de "+coverage.total+" competiciones · "+coverage.minutes.toLocaleString("es-ES")+" minutos disponibles para esta fórmula":partial?"Subtotal parcial: faltan estadísticas":undefined;
       const missingKeeperOffense=value===null&&goalkeeper(player)&&GK_OFFENSE.has(k);
       const missingOffenseZero=value===null&&(k==="penaltygoals"||k==="ga")&&!missingKeeperOffense;
       return <td key={k} className={"px-2 py-2 text-right"+line(k)} title={missingKeeperOffense||missingOffenseZero?"0 visual: estadística ausente, no es un cero confirmado.":hint}>{missingKeeperOffense||missingOffenseZero?<span className="text-slate-400">0<sup>†</sup></span>:formatStatRate(value,getColumn(config,k)?.decimals??(dec(k)?2:0))}{value!==null&&getColumn(config,k)?.unit?" "+getColumn(config,k).unit:""}{partial&&value!==null?<span className="text-amber-600">*</span>:null}</td>;
      })}
      <td className="px-3 py-3"><button onClick={()=>onOpen(summary,player)} className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-blue-200 px-3 py-2 font-bold text-[#003399] hover:bg-blue-50">Desglose <ArrowRight size={13}/></button></td>
     </tr>;
    })}
    {!pageRows.length&&<tr><td colSpan={10+columns.length} className="px-6 py-12 text-center text-slate-500">No hay temporadas con estadísticas para esta selección.</td></tr>}
    </tbody>
   </table>
  </div>
  <p className="px-3 py-2 text-[10px] text-slate-500">† El cero visual en métricas ausentes (ofensivas de porteros, Pen y G + A) no es un cero estadístico y no se guarda ni interviene en cálculos o Composite.</p>
 </div>;
}
