import React,{useMemo,useState} from "react";
import { AlertTriangle, BarChart3, Database, RefreshCw } from "lucide-react";
import { useHistoricalPeerDataset } from "@/hooks/useHistoricalPeerDataset";
import { compareHistoricalObservation, historicalRole } from "@/utils/historicalPeers";
import { formatEur } from "@/utils/historicalValuation";
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
    <div className="h-2.5 w-full min-w-[65px] max-w-[116px] overflow-hidden rounded-full bg-slate-200"
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
    title={`Puesto ${item.rank} de ${item.n} temporadas ST comparables en esta estadística. No es un ranking de ${item.n} jugadores distintos.`}>
    <div className="h-2 w-full min-w-[40px] max-w-[65px] overflow-hidden rounded-full bg-slate-200"
      role="meter" aria-label={`Posición histórica de ${item.name}`}
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={Number(good.toFixed(1))}>
      <div className={`h-full rounded-full transition-all ${barColor(good)}`}
        style={{width:Math.max(0,Math.min(100,good))+"%"}}/>
    </div>
    <span className="min-w-[59px] text-right font-bold tabular-nums text-slate-700">
      {item.rank}º <span className="font-normal text-slate-400">/ {item.n}</span>
    </span>
  </div>;
};
export default function HistoricalPeerPreview({playerId,position="",seasons=[],initialSeason=""}){
  const [picked,setPicked]=useState("");
  const {data,error,isFetching,refetch}=useHistoricalPeerDataset();
  const season=seasons.includes(picked)?picked:seasons.includes(initialSeason)?initialSeason:seasons[0]||"";
  const role=historicalRole(position);
  const result=useMemo(()=>{
    if(!data?.observations?.length||!playerId||!season)return null;
    const observation=data.observations.find(o=>o.playerId===String(playerId)&&o.season===season);
    if(!observation)return {missing:true};
    return compareHistoricalObservation(observation,data.observations,10);
  },[data,playerId,season]);
  const previewRows=result?.rows||[];
  const isThin=previewRows.some(r=>r.provisional);
  const validCount=previewRows.filter(r=>r.percentile!==null).length;
  return (
    <section className="mt-4 space-y-3 rounded-xl border border-indigo-200 bg-[#f8faff] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-[#003399]">
            <BarChart3 size={17}/> vs jugadores MF LEGACY · vista previa
          </h4>
          <p className="mt-1 text-xs text-slate-600">
            Nuestra base histórica completa · una observación por jugador/temporada · mismo arquetipo · solo competiciones de clubes. FIFA/Transfermarkt requieren datos de al menos dos jugadores.
          </p>
        </div>
        <button type="button" onClick={()=>refetch()} disabled={isFetching||!playerId}
          className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-bold text-[#003399] disabled:opacity-50">
          <RefreshCw size={15} className={isFetching?"animate-spin":""}/>
          {isFetching?"Cargando base completa…":data?"Actualizar comparación":"Calcular con nuestra BD"}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs font-bold text-slate-600">
          Temporada
          <select className="ml-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800"
            value={season} onChange={e=>setPicked(e.target.value)}>
            {seasons.map(s=><option value={s} key={s}>{s}</option>)}
          </select>
        </label>
        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">
          vs {role||"posición no identificada"}
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
      {error&&<p role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
        <AlertTriangle size={17} className="shrink-0"/> {error.message}. Se conserva el Composite anterior.
      </p>}
      {data&&result?.missing&&<p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        Esta ficha no tiene una temporada comparable con Player ID confirmado y posición identificada. No se calcula percentil.
      </p>}
      {data&&!role&&<p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        La posición actual del jugador no se corresponde con ningún arquetipo. No se utilizará otra posición por aproximación.
      </p>}
      {data&&result&&!result.missing&&<>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Arquetipo",result.role],
            ["Temporadas comparables",result.population],
            ["Jugadores distintos",result.players],
            ["Indicadores valorables",validCount+"/"+previewRows.length],
          ].map(([label,value])=><div className="rounded-lg border border-slate-100 bg-white p-3" key={label}>
            <div className="text-[10px] font-bold uppercase text-slate-500">{label}</div>
            <div className="mt-1 text-lg font-black text-[#003399]">{value}</div>
          </div>)}
        </div>
        {result.composite&&<div className="rounded-lg border border-indigo-100 bg-white p-3 text-xs">
          <strong>Composite experimental de la BD: {show(result.composite.score,1)}/100</strong>
          {" · "}Cobertura {show(result.composite.coverage,1)} %.
          <span className="text-slate-600"> No sustituye el Composite actual. Un score con cobertura o muestra diferente no es directamente comparable.</span>
        </div>}
        {!result.composite&&<p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          Este arquetipo todavía no tiene pesos de Composite definidos; los percentiles se muestran independientemente.
        </p>}
        {isThin&&<p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          Percentiles provisionales: aún hay menos de 10 jugadores distintos del mismo arquetipo con datos de estas métricas. Las temporadas de un solo jugador no bastan para crear un percentil.
        </p>}
        <div className="max-h-[480px] overflow-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[840px] text-left text-xs">
            <thead className="sticky top-0 bg-[#eaf0f8]">
              <tr>
                <th className="px-3 py-2">Indicador</th><th className="px-3 py-2 text-right">Tu valor (temporada)</th>
                <th className="min-w-[155px] px-3 py-2 text-right">vs {result.role}</th>
                <th className="min-w-[135px] px-3 py-2 text-right">Posición histórica</th>
                <th className="px-3 py-2 text-right">Muestra (temp. / jugadores)</th>
                <th className="px-3 py-2 text-right">Peso</th><th className="px-3 py-2 text-right">Aporta</th>
              </tr>
            </thead>
            <tbody>{previewRows.map(item=><tr className="border-t border-slate-100" key={item.key}>
              <td className="px-3 py-2 font-semibold text-slate-800">{item.name}{item.penalty&&<span className="ml-1 text-[10px] text-rose-700">(penalización)</span>}</td>
              <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                {item.key==="market_value"?formatEur(item.value):show(item.value,item.key==="fc27_ovr"?0:2)}
              </td>
              <td className="px-3 py-2 text-right"><PercentileBar item={item}/></td>
              <td className="px-3 py-2 text-right"><PositionBar item={item}/></td>
              <td className="px-3 py-2 text-right tabular-nums text-slate-600">{item.n} / {item.nPlayers}</td>
              <td className="px-3 py-2 text-right tabular-nums text-slate-600">{item.weight===null?"—":(item.weight>0?"+":"")+item.weight+" %"}</td>
              <td className={"px-3 py-2 text-right font-bold tabular-nums "+(item.contribution<0?"text-rose-700":"text-emerald-700")}>
                {item.contribution===null?"—":(item.contribution>0?"+":"")+show(item.contribution,2)}
              </td>
            </tr>)}</tbody>
          </table>
        </div>
        <p className="text-[11px] text-slate-600">
          Método: percentil histórico de rango medio (empates compartidos), dentro del mismo arquetipo; 0 es el mínimo observado y 100 el máximo. Para métricas por 90 se suman sus totales con minutos alineados. Los porcentajes son promedios ponderados por minutos, la nota por partidos. Las métricas faltantes no se convierten en cero. Los indicadores con peso negativo se penalizan más cuanto mayor sea su valor bruto. El arquetipo procede de la posición <strong>actual</strong> de la ficha, no de una posición histórica verificada.
          {" "}Las barras recuperan los colores originales (verde: percentil favorable alto; amarillo/rojo: bajo); en pérdidas y otras penalizaciones se invierte el color porque menos es mejor, sin alterar el percentil bruto ni el cálculo de Aporta. «Posición histórica» indica el puesto entre temporadas con datos, no entre jugadores distintos; los empates comparten puesto.
          {" "}Los resultados cambian al ampliar nuestra base de datos y no están ajustados todavía por época ni fuerza de liga. * Menos de 10 jugadores distintos. Los indicadores con datos de un solo jugador no generan percentil.
        </p>
        <p className="flex items-center gap-2 text-[11px] text-slate-500">
          <Database size={14}/> Consulta de solo lectura · FotMob, FC histórico y Transfermarkt previamente almacenados en MF LEGACY · {new Date(data.loadedAt).toLocaleString("es-ES")}
        </p>
      </>}
    </section>
  );
}
