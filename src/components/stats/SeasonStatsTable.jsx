import React,{useState} from "react";
import {ArrowRight,Shield,AlertCircle} from "lucide-react";
import {statDisplay} from "@/utils/statsSeason";
import {getColumn,columnValue,initialConfig} from "@/utils/statsColumns";
import {metricLabel} from "@/utils/statsImport";
import {seasonActive} from "@/utils/statsViews";

export const seasonColumns={
 Resumen:["goals","assists","xg","xa","gaper90","xgaper90"],
 Ataque:["goals","assists","ga","goalsper90","assistsper90","gaper90","xg","xa","xgper90","xaper90","xgaper90","shots","shotsontarget"],
 Creación:["chancescreated","bigchancescreated","accuratepasses","successfulcrosses","xa","xaper90"],
 Defensa:["tackles","interceptions","recoveries","clearances","cleansheets"],
 Portería:["saves","cleansheets","goalsconcededwhileonpitch"],
 Físico:["totaldistancecovered","numberofsprints"]
};
const labels={ga:"G + A",gaper90:"G + A /90",xgaper90:"xG + xA /90",xga:"xG + xA",goalsper90:"Goles /90",assistsper90:"Asist. /90",xgper90:"xG /90",xaper90:"xA /90",totaldistancecovered:"Distancia (m)",numberofsprints:"Sprints",goalsconcededwhileonpitch:"Goles encajados (en campo)"};
const fmt=(v,d=0)=>v===null||v===undefined||v===""||!Number.isFinite(Number(v))?"—":Number(v).toLocaleString("es-ES",{minimumFractionDigits:d,maximumFractionDigits:d});
const dec=k=>["xg","xa","xga","gaper90","xgaper90","goalsper90","assistsper90","xgper90","xaper90"].includes(k);
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
export default function SeasonStatsTable({items=[],category="Resumen",page=0,onOpen,onTeam,minimumMinutes=0,config=initialConfig()}){
 const columns=config.columns?.season?.[category]||seasonColumns[category]||seasonColumns.Resumen;
 const filtered=items.filter(({summary})=>summary?(summary.totals.minutes.value||0)>=minimumMinutes:minimumMinutes===0);
 const pageRows=filtered.slice(page*50,(page+1)*50);
 return <div>
  <div className="max-w-full overflow-x-auto">
   <table className="w-full min-w-[1040px] text-left text-xs">
    <thead className="bg-[#102e23] text-white"><tr>
     <th className="px-3 py-3">#</th><th className="min-w-44 px-3 py-3">JUGADOR</th>
     <th className="px-3 py-3">TEMPORADA</th><th className="min-w-44 px-3 py-3">CLUB PRINCIPAL</th>
     <th className="px-3 py-3 text-right">PJ</th><th className="px-3 py-3 text-right">MIN</th>
     <th className="whitespace-nowrap px-3 py-3 text-right">NOTA MEDIA*</th>
     {columns.map(k=><th className="whitespace-nowrap px-3 py-3 text-right" key={k}>{getColumn(config,k)?.name||labels[k]||metricLabel(k)}</th>)}
     <th className="px-3 py-3">DETALLE</th>
    </tr></thead>
    <tbody>{pageRows.map(({summary,player},i)=>{
     const name=player?.name||summary?.player_name||"Jugador";
     if(!summary)return <tr key={String(player?.id||i)} className="border-b border-slate-100 text-xs"><td className="px-3 py-3 text-right text-slate-400">{page*50+i+1}</td><td className="px-3 py-2"><div className="flex items-center gap-2"><PlayerPhoto player={player} name={name}/><span className="font-semibold text-slate-700">{name}</span></div></td><td colSpan={6+columns.length} className="px-3 py-3 text-slate-400">Sin estadísticas importadas para esta temporada</td></tr>;
     return <tr key={summary.id} className="border-b border-slate-100 align-middle odd:bg-white even:bg-[#f6f8f6] hover:bg-[#edf3fb]">
      <td className="px-3 py-3 text-right text-slate-400">{page*50+i+1}</td>
      <td className="px-3 py-2"><button onClick={()=>onOpen(summary,player)} className="flex items-center gap-2 text-left">
       <PlayerPhoto player={player} name={name}/><span className="font-extrabold text-[#0f3156] hover:underline">{name}</span>
      </button></td>
      <td className="whitespace-nowrap px-3 py-3 font-semibold">{summary.season}{seasonActive(summary.season)&&<span className="ml-1 text-[10px] font-normal text-blue-700">(en curso)</span>}</td>
      <td className="px-3 py-3"><ClubBadge summary={summary} onTeam={onTeam}/></td>
      <td className="px-3 py-3 text-right">{fmt(statDisplay(summary,"appearances"))}</td>
      <td className="px-3 py-3 text-right">{fmt(statDisplay(summary,"minutes"))}</td>
      <td className="px-3 py-3 text-right font-bold">{fmt(statDisplay(summary,"rating"),2)}{summary.ratingPartial?"*":""}</td>
      {columns.map(k=>{
       const value=columnValue(summary,"season",k,config);
       const partial=summary.totals[k]?.partial;
       return <td key={k} className="px-3 py-3 text-right" title={partial?"Subtotal parcial: faltan estadísticas":undefined}>{fmt(value,getColumn(config,k)?.decimals??(dec(k)?2:0))}{partial&&value!==null?<span className="text-amber-600">*</span>:null}</td>;
      })}
      <td className="px-3 py-3"><button onClick={()=>onOpen(summary,player)} className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-blue-200 px-3 py-2 font-bold text-[#003399] hover:bg-blue-50">Desglose <ArrowRight size={13}/></button></td>
     </tr>;
    })}
    {!pageRows.length&&<tr><td colSpan={8+columns.length} className="px-6 py-12 text-center text-slate-500">No hay temporadas con estadísticas para esta selección.</td></tr>}
    </tbody>
   </table>
  </div>
  <div className="flex items-start gap-2 border-t border-slate-100 bg-amber-50/40 px-4 py-3 text-xs text-slate-600">
   <AlertCircle size={15} className="mt-0.5 shrink-0 text-amber-700"/>
   <p>* La nota media es una estimación ponderada por partidos, no el índice Crafted. Los totales corresponden a competiciones de clubes importadas. Una cifra marcada con * tiene cobertura parcial. Los ratios /90 se omiten si faltan minutos o métricas; las selecciones están en el desglose.</p>
  </div>
 </div>;
}
