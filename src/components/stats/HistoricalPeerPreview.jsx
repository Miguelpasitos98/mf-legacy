import React,{useMemo,useState} from "react";
import { AlertTriangle, BarChart3, ClipboardList, Database, RefreshCw } from "lucide-react";
import { useHistoricalPeerDataset } from "@/hooks/useHistoricalPeerDataset";
import { compareHistoricalObservation, historicalRole, historicalNationalCompetition } from "@/utils/historicalPeers";
import { POSITION_SOURCES } from "@/utils/historicalPositions";
import OverviewManualEditor from "@/components/stats/OverviewManualEditor";
import { formatEur } from "@/utils/historicalValuation";
const EDIT_METRIC_NAMES={npxg_p90:"xG excl. penalty",xa_p90:"xA",xgot_p90:"xGOT",shots_on_target_p90:"Shots on target",big_chances_created_p90:"Big chances created",possession_won_final_3rd_p90:"Possession won final 3rd",accurate_long_balls_p90:"Accurate long balls",successful_dribbles_p90:"Dribbles",dispossessed_p90:"Dispossessed",dribbled_past_p90:"Dribbled past",goals_prevented_p90:"Goals prevented",accurate_passes_p90:"Accurate passes",def_actions_poss_adj_p90:"PAdj defensive actions",aerial_duels_won_pct:"Aerials won %",ground_duels_won_pct:"Ground duels won %",save_pct:"Save percentage"};
const NON_EDITABLE_COMPOSITE=new Set(["fc27_ovr","market_value","play_share","finishing_xgot_minus_npxg","rating"]);
import { buildMissingDataPrompt } from "@/utils/missingDataPrompt";
const show=(v,d=2)=>v===null||v===undefined||!Number.isFinite(Number(v))?"—":
 Number(v).toLocaleString("es-ES",{minimumFractionDigits:d,maximumFractionDigits:d});
// Reuse the same colour thresholds as the original CraftedFC breakdown.
const strength = item => item.penalty ? 100-item.percentile : item.percentile;
const barColor = value => value>=85?"bg-emerald-500":value>=65?"bg-cyan-500":
  value>=40?"bg-sky-500":value>=20?"bg-amber-400":"bg-rose-400";
const PercentileBar = ({item}) => {
  if(item.percentile===null)return <span className="text-slate-400">—</span>;
  const good=strength(item);
  return <div className="inline-flex w-full items-center justify-end gap-2"
    title={`Percentil bruto ${show(item.percentile,2)} de 100 · ${item.n} temporadas de ${item.nPlayers} jugadores${item.penalty?" · Indicador penalizado (menos es mejor)":""}`}>
    <div className="h-3 w-full min-w-[70px] max-w-[130px] overflow-hidden rounded-full bg-slate-200 ring-1 ring-inset ring-slate-300"
      role="meter" aria-label={`Percentil de ${item.name}`}
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={Number(item.percentile.toFixed(1))}>
      <div className={`h-full rounded-full transition-all ${barColor(good)}`}
        style={{width:Math.max(0,Math.min(100,item.percentile))+"%"}}/>
    </div>
    <span className="min-w-[46px] text-right font-extrabold tabular-nums text-slate-800">
      {show(item.percentile,1)}<span className="text-slate-400">º</span>{item.provisional&&<span className="text-amber-600">*</span>}
    </span>
  </div>;
};
const PositionBar = ({item}) => {
  if(item.rank===null)return <span className="text-slate-400">—</span>;
  const good=strength(item);
  return <div className="inline-flex w-full items-center justify-end gap-2"
    title={`Puesto ${item.rank} de ${item.n} temporadas del mismo arquetipo comparables en esta estadística. No es un ranking de ${item.n} jugadores distintos.`}>
    <div className="h-2.5 w-full min-w-[46px] max-w-[80px] overflow-hidden rounded-full bg-slate-200 ring-1 ring-inset ring-slate-300"
      role="meter" aria-label={`Barra de posición histórica de ${item.name}`}
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={Number(good.toFixed(1))}>
      <div className={`h-full rounded-full transition-all ${barColor(good)}`}
        style={{width:Math.max(0,Math.min(100,good))+"%"}}/>
    </div>
    <span className="min-w-[59px] text-right font-bold tabular-nums text-slate-700">
      {item.rank}º <span className="font-normal text-slate-400">/ {item.n}</span>
    </span>
  </div>;
};
export default function HistoricalPeerPreview({playerId,position="",seasons=[],initialSeason="",main=false,playerName="",editableRows=[],onSetMetric}){
  const [picked,setPicked]=useState("");
  const [manualMode,setManualMode]=useState(null);
  const [copyStatus,setCopyStatus]=useState("");
  const {data,error,isFetching,refetch}=useHistoricalPeerDataset(main);
  const season=seasons.includes(picked)?picked:seasons.includes(initialSeason)?initialSeason:seasons[0]||"";
  // La posición histórica efectiva de la temporada decide el arquetipo; la
  // posición actual de la ficha solo actúa como respaldo provisional.
  const observation=useMemo(()=>data?.observations?.find(o=>o.playerId===String(playerId)&&o.season===season)||null,[data,playerId,season]);
  const role=historicalRole(observation?.position)||historicalRole(position);
  const positionSource=POSITION_SOURCES[observation?.positionSource]||null;
  const rowsToEdit=useMemo(()=>editableRows.filter(r=>r.season===season&&!historicalNationalCompetition(r.competition)),[editableRows,season]);
  const result=useMemo(()=>{
    if(!data?.observations?.length||!playerId||!season)return null;
    const observation=data.observations.find(o=>o.playerId===String(playerId)&&o.season===season);
    if(!observation)return {missing:true};
    try{return compareHistoricalObservation(observation,data.observations,10);}catch(e){console.error("Error Composite de temporada",season,e);return {calculationError:e.message||"Error calculando Composite"};}
  },[data,playerId,season]);
  const previewRows=result?.rows||[];
  // Keep unavailable indicators visible but grouped at the bottom, without affecting calculation.
  const displayedRows=[...previewRows].sort((a,b)=>Number(a.value===null)-Number(b.value===null));
  const missingUnderstat=previewRows.some(r=>(r.key==="xg_chain_p90"||r.key==="xg_buildup_p90")&&r.value===null);
  const isThin=previewRows.some(r=>r.provisional);
  const validCount=previewRows.filter(r=>r.percentile!==null).length;
  const missingData=previewRows.filter(r=>r.value===null).map(r=>r.name);
  const copyMissingPrompt=async()=>{
    const allSeasons=seasons.map(year=>{const obs=data?.observations?.find(o=>o.playerId===String(playerId)&&o.season===year);if(!obs)return null;let cmp;try{cmp=compareHistoricalObservation(obs,data.observations,10);}catch(e){console.error("Comparación no disponible",year,e);return null;}return {season:year,role:cmp?.role||historicalRole(obs.position),competitions:[...new Set(editableRows.filter(r=>r.season===year&&!historicalNationalCompetition(r.competition)).map(r=>r.competition).filter(Boolean))],missing:(cmp?.rows||[]).filter(x=>x.value===null).map(x=>x.name)};}).filter(x=>x&&x.missing.length);
    if(!allSeasons.length){setCopyStatus("No se han detectado estadísticas faltantes en las temporadas cargadas.");return;}
    const text=buildMissingDataPrompt({playerName,seasons:allSeasons});
    const done="Investigación copiada ("+allSeasons.length+" temporadas). Pégala en un chat y trae los valores de vuelta para añadirlos a mano.";
    try{
      await navigator.clipboard.writeText(text);
      setCopyStatus(done);
    }catch{
      try{
        const area=document.createElement("textarea");area.value=text;area.style.position="fixed";area.style.opacity="0";
        document.body.appendChild(area);area.select();
        const ok=document.execCommand("copy");document.body.removeChild(area);
        if(!ok)throw Error("No disponible");
        setCopyStatus(done);
      }catch{setCopyStatus("El navegador ha bloqueado la copia. Revisa sus permisos de portapapeles.");}
    }
  };
  return (
    <section className={(main?"mt-0 ":"mt-4 ")+"space-y-3 rounded-xl border-2 border-indigo-300 bg-[#f8faff] p-4 shadow-sm"}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="flex items-center gap-2 text-base font-black uppercase tracking-wide text-[#003399]">
            <BarChart3 size={19}/> {main?"Composite MF LEGACY · vs nuestra base de datos":"vs jugadores MF LEGACY · vista previa"}
          </h4>
          <p className="mt-1 text-xs text-slate-600">
            Percentiles propios por posición, calculados con todas las temporadas de clubes de nuestra base. La temporada se consolida entre competiciones antes de comparar. Nunca se utilizan los percentiles originales de FotMob.
          </p>
          {observation?.pAdjCoverage?.total>0&&observation.pAdjCoverage.covered<observation.pAdjCoverage.total&&<div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">Acciones defensivas ajustadas /90: cobertura parcial ({observation.pAdjCoverage.covered}/{observation.pAdjCoverage.total} competiciones, {show(observation.pAdjCoverage.minutesCovered,0)} minutos cubiertos). El resultado solo representa los partidos con acciones, minutos y posesión. {observation.pAdjCoverage.excluded.map(x=>x.competition+": "+x.reasons.map(reason=>reason==="team_possession"?"posesión de equipo":reason==="defensive_actions"?"acciones defensivas":"minutos").join(", ")).join("; ")}</div>}
          {observation?.pAdjMethod==="mf_possession_50_experimental"&&<p className="mt-1 text-xs font-semibold text-amber-700">PAdj /90: cálculo experimental MF LEGACY normalizado al 50 % de posesión; no reproduce necesariamente la fórmula interna de CraftedFC.</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {main&&<button type="button" onClick={copyMissingPrompt} disabled={!playerId||!season}
            title="Copia las estadísticas vacías de todas las temporadas del jugador, separadas por temporada"
            className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-bold text-[#003399] disabled:opacity-50">
            <ClipboardList size={15}/> Investigar estadísticas vacías · todas las temporadas
          </button>}
          <button type="button" onClick={()=>refetch()} disabled={isFetching||!playerId}
            className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-bold text-[#003399] disabled:opacity-50">
            <RefreshCw size={15} className={isFetching?"animate-spin":""}/>
            {isFetching?"Cargando base completa…":data?"Actualizar comparación":main?"Reintentar carga":"Calcular con nuestra BD"}
          </button>
        </div>
      </div>
      {copyStatus&&<p role="status" className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-900">{copyStatus}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs font-bold text-slate-600">
          Temporada
          <select className="ml-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800"
            value={season} onChange={e=>setPicked(e.target.value)}>
            {seasons.map(s=><option value={s} key={s}>{s}</option>)}
          </select>
        </label>
        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800"
          title={positionSource?positionSource.label:"Posición no identificada"}>
          vs {role||"posición no identificada"}
          {observation?.position&&<span className="ml-1 font-normal">· {observation.position}{positionSource?" ("+positionSource.short+")":""}</span>}
        </span>
        {data&&<span className="text-xs text-slate-500">
          {data.loadedCounts.PlayerSeasonStats} registros estadísticos · {data.observations.length} temporadas de jugadores
        </span>}
      </div>
      {!data&&!isFetching&&!error&&<p className="rounded-lg border border-blue-100 bg-white p-3 text-xs text-slate-600">
        Pulsa «Calcular con nuestra BD». La primera lectura puede tardar: se consultan las temporadas, jugadores, valoraciones y PJ Equipo paginados, sin modificar ningún registro.
      </p>}
      {isFetching&&<p role="status" className="rounded-lg bg-white p-3 text-xs text-indigo-800">
        Leyendo todas las entidades; los percentiles solo se mostrarán si termina la carga completa.
      </p>}
      {error&&<p role="alert" className={"flex items-start gap-2 rounded-lg border p-3 text-xs "+(data?"border-amber-200 bg-amber-50 text-amber-900":"border-red-200 bg-red-50 text-red-800")}>
        <AlertTriangle size={17} className="shrink-0"/>
        {data?"La sincronización remota no se completó ("+error.message+"). Se muestran los datos de la comparación ya cargada; puedes reintentarlo cuando quieras.":"No se ha podido cargar por completo la población histórica ("+error.message+"). Pulsa «Reintentar carga»; nunca se calcularán percentiles con registros incompletos."}
      </p>}
      {data&&result?.calculationError&&<p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">No se pudo calcular el Composite de esta temporada: {result.calculationError}. El resto del informe permanece disponible.</p>}
      {data&&result?.missing&&<p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        Esta ficha no tiene una temporada comparable con Player ID confirmado y posición identificada. No se calcula percentil.
      </p>}
      {data&&!role&&<p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        Ni la posición histórica de esta temporada ni la posición actual del jugador se corresponden con ningún arquetipo. No se utilizará otra posición por aproximación.
      </p>}
      {data&&result&&!result.missing&&!result.calculationError&&<>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Arquetipo",result.role],
            ["Temporadas comparables",result.population],
            ["Jugadores distintos",result.players],
            ["Indicadores valorables",validCount+"/"+previewRows.length],
            ["Cobertura",result.composite?show(result.composite.coverage,1)+" %":"—"],
            ["Composite final",result.composite?show(result.composite.score,1):"—"],
          ].map(([label,value],i,arr)=>{const final=i===arr.length-1;return <div className={"rounded-lg border p-3 "+(final?"border-indigo-300 bg-indigo-50":"border-slate-100 bg-white")} key={label}>
            <div className="text-[10px] font-bold uppercase text-slate-500">{label}</div>
            <div className={"mt-1 font-black tabular-nums "+(final?"text-2xl text-[#003399]":"text-lg text-[#003399]")}>
              {value}{final&&result.composite?<span className="text-xs font-normal text-slate-400"> /100</span>:null}
            </div>
          </div>;})}
        </div>

        {result.composite&&<p className="text-[11px] text-slate-600">
          Composite MF LEGACY · <strong>{result.composite.status==="partial"?"Parcial":"Calculado"}</strong> · vs {result.role} · {result.population} temporadas de {result.players} jugadores distintos · {result.composite.count}/{result.composite.total} indicadores.{" "}
          <span className="text-amber-700">{result.players<10?"Muestra reducida: índice experimental, no nota definitiva.":"Ponderaciones experimentales; no equivale al rating oficial CraftedFC."}</span>
        </p>}
        {!result.composite&&<p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          Este arquetipo todavía no tiene pesos de Composite definidos; los percentiles se muestran independientemente.
        </p>}
        {isThin&&<p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          Percentiles provisionales: aún hay menos de 10 jugadores distintos del mismo arquetipo con datos de estas métricas. Las temporadas de un solo jugador no bastan para crear un percentil.
        </p>}
        {observation?.positionMixed&&<p className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-xs text-violet-900">
          Las correcciones por competición de esta temporada no coinciden entre sí, así que el Composite usa la posición de referencia de la temporada. Puedes unificarlas o cambiarlas en «Valores históricos · temporada».
        </p>}
        {missingUnderstat&&onSetMetric&&<p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs leading-relaxed text-blue-900">Los xG Chain /90 y xG Buildup /90 que aparecen como «—» no están disponibles para esta temporada en las competiciones guardadas. <strong>No se rellenan con el snapshot global de CraftedFC.</strong> Puedes pulsar «Añadir +» e introducir cifras verificadas de Understat para la competición correspondiente.</p>}
        <div className="max-h-[640px] overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[980px] text-left text-xs">
            <thead className="sticky top-0 z-10 bg-[#e2eaf6] shadow-[0_1px_0_0_rgba(15,49,86,0.15)]">
              <tr>
                <th className="px-3 py-2.5">Indicador</th>
                <th className="bg-[#d3e0f2] px-3 py-2.5 text-right">Tu valor (temporada)</th>
                <th className="min-w-[165px] bg-[#d3e0f2] px-3 py-2.5 text-right">vs {result.role}</th>
                <th className="min-w-[145px] bg-[#d3e0f2] px-3 py-2.5 text-right">Posición histórica</th>
                <th className="px-3 py-2.5 text-right">Muestra (temp. / jugadores)</th>
                <th className="px-3 py-2.5 text-right">Peso</th>
                <th className="bg-[#d3e0f2] px-3 py-2.5 text-right">Aporta</th>
              </tr>
            </thead>
            <tbody>{displayedRows.map(item=><tr className={"border-t border-slate-100 "+(item.value===null?"bg-slate-50 text-slate-400":"hover:bg-slate-50")} key={item.key}>
              <td className={"px-3 py-2.5 font-semibold "+(item.value===null?"text-slate-400":"text-slate-800")}>{item.name}{result.role==="CB"&&["xg_buildup_p90","xg_chain_p90"].includes(item.key)&&item.value===null&&<span className="mt-1 block max-w-[320px] text-[10px] font-normal italic leading-snug text-slate-400">Sin datos · peso redistribuido: pases precisos /90 (45 %), pases largos precisos /90 (40 %) y acciones defensivas ajustadas /90 (15 %)</span>}{result.role==="GK"&&item.key==="xg_buildup_p90"&&item.value===null&&<span className="mt-1 block max-w-[290px] text-[10px] font-normal italic leading-snug text-slate-400">Sin datos · peso redistribuido: pases largos precisos /90 (60 %) y pases precisos /90 (40 %)</span>}{item.penalty&&<span className="ml-1 text-[10px] text-rose-700">(penalización)</span>}</td>
              <td className="bg-indigo-50/50 px-3 py-2.5 text-right font-semibold tabular-nums text-slate-800">
                {onSetMetric&&!NON_EDITABLE_COMPOSITE.has(item.key)?
                  <button type="button"
                    onClick={()=>setManualMode(item.key==="xg_chain_p90"?"chain":item.key==="xg_buildup_p90"?"buildup":item.key==="ground_duels_won_pct"?"ground":{mode:"other",name:EDIT_METRIC_NAMES[item.key]||item.name,per90:/_p90$/.test(item.key)})}
                    className="inline-flex items-center justify-end gap-1 rounded px-2 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                    title={(item.value===null?"Añadir":"Corregir")+" estadística de origen por competición (el Composite se recalcula después)"}>
                    {item.value===null?"Añadir +":show(item.value,2)}{item.value!==null&&<span className="text-[10px] text-blue-500">✎</span>}
                  </button>:
                  item.key==="market_value"?formatEur(item.value):show(item.value,item.key==="fc27_ovr"?0:2)}
              </td>
              <td className="bg-indigo-50/50 px-3 py-2.5 text-right"><PercentileBar item={item}/></td>
              <td className="bg-indigo-50/50 px-3 py-2.5 text-right"><PositionBar item={item}/></td>
              <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{item.n} / {item.nPlayers}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{item.value===null&&item.transferred===0&&item.baseWeight>0?<span className="text-slate-400">{item.baseWeight} %</span>:<><span>{item.weight===null?"—":(item.weight>0?"+":"")+Number(item.weight.toFixed(1))+" %"}</span>{item.transferred>0&&<span className="block text-[10px] text-slate-400">base {item.baseWeight} %</span>}</>}</td>
              <td className={"bg-indigo-50/50 px-3 py-2.5 text-right text-sm font-black tabular-nums "+(item.contribution<0?"text-rose-700":"text-emerald-700")}>
                {item.contribution===null?"—":(item.contribution>0?"+":"")+show(item.contribution,2)}
              </td>
            </tr>)}</tbody>
          </table>
        </div>
        <p className="flex items-center gap-2 text-[11px] text-slate-500">
          <Database size={14}/> Consulta de solo lectura · FotMob, FC histórico y Transfermarkt previamente almacenados en MF LEGACY · {new Date(data.loadedAt).toLocaleString("es-ES")}
        </p>
      </>}
      <OverviewManualEditor mode={manualMode!==null&&typeof manualMode==="object"?manualMode.mode:manualMode} defaultName={manualMode!==null&&typeof manualMode==="object"?manualMode.name:""} per90={manualMode!==null&&typeof manualMode==="object"?Boolean(manualMode.per90):false} records={rowsToEdit} onClose={()=>setManualMode(null)} onSave={onSetMetric}/>
    </section>
  );
}