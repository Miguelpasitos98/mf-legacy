import React, {useState, useMemo} from "react";
import {calculateCompositeMF, COMPOSITE_ROLES, normalizeRole} from "@/utils/compositeEngine";
import { payloadField } from "@/utils/craftedfc";
import { formatEur } from "@/utils/historicalValuation";

const show = (v, d = 0) =>
  v === null || v === undefined || !Number.isFinite(Number(v))
    ? "—"
    : Number(v).toLocaleString("es-ES", {
        minimumFractionDigits: d,
        maximumFractionDigits: d,
      });

const ADVANCED_LABELS = {
  goals_per_90: "Goles /90",
  assists_per_90: "Asistencias /90",
  goals_plus_assists_per_90: "G+A /90",
  xg_per_90: "xG /90",
  xa_per_90: "xA /90",
  xg_plus_xa_per_90: "xG+xA /90",
  np_xg_per_90: "xG sin penaltis /90",
  np_xg_plus_xa_per_90: "xG+xA sin penaltis /90",
  shots_per_90: "Tiros /90",
  shots_on_target_per_90: "Tiros a puerta /90",
  xgot_per_90: "xGOT /90",
  chances_created_per_90: "Ocasiones creadas /90",
  big_chances_created_per_90: "Ocasiones claras creadas /90",
  big_chances_missed_per_90: "Ocasiones claras falladas /90",
  accurate_passes_per_90: "Pases precisos /90",
  accurate_long_balls_per_90: "Pases largos precisos /90",
  successful_dribbles_per_90: "Regates exitosos /90",
  tackles_per_90: "Entradas /90",
  interceptions_per_90: "Intercepciones /90",
  recoveries_per_90: "Recuperaciones /90",
  clearances_per_90: "Despejes /90",
  defensive_actions_per_90: "Acciones defensivas /90",
  padj_defensive_actions_per_90: "Acciones defensivas (aj.) /90",
  aerial_duels_won_pct: "Duelos aéreos ganados (%)",
  ground_duels_won_pct: "Duelos de suelo ganados (%)",
  ball_security: "Seguridad de balón",
  blocks_per_90: "Bloqueos /90",
  dispossessed_per_90: "Pérdidas de balón /90",
  dribbled_past_per_90: "Regateado /90",
  fouls_per_90: "Faltas cometidas /90",
  penalties_won_per_90: "Penaltis provocados /90",
  possession_won_final_3rd_per_90: "Recuperaciones en campo rival /90",
  us_xGChain90: "xG Chain /90",
  us_xGBuildup90: "xG Buildup /90",
  finishing_per_90: "Remate /90",
  sofifa_overall: "FIFA Overall",
  sofifa_potential: "FIFA Potential",
  team_strength: "Team Strength",
  league_strength: "League Strength",
};

const percentileColor = percentile => {
  if (percentile === null || percentile === undefined) return "bg-slate-200";
  if (percentile >= 85) return "bg-emerald-500";
  if (percentile >= 65) return "bg-cyan-500";
  if (percentile >= 40) return "bg-sky-500";
  if (percentile >= 20) return "bg-amber-400";
  return "bg-rose-400";
};
const contributionColor = value => value == null ? "text-slate-400" : value < 0 ? "text-rose-600" : "text-emerald-700";
const MiniCard = ({ label, value, accent }) => (
  <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
    <p className="text-[10px] font-bold uppercase text-slate-500">{label}</p>
    <p className={"text-xl font-black " + (accent || "text-[#003399]")}>{value}</p>
  </div>
);

// CraftedFC Analysis shows the published snapshot independently from
// MF Legacy's experimental percentile-weighted Composite for one FotMob season.
// Neither value is presented as the official CraftedFC season Composite.
export default function CraftedfcAnalysis({ snapshot, status, fotmobRows=[], position="", historicalValuations=[] }) {
  const [rowIndex,setRowIndex] = useState(0);
  const [chosenRole,setChosenRole] = useState("");
  const available=Array.isArray(fotmobRows)?fotmobRows:[];
  const active=available[Math.min(rowIndex,Math.max(0,available.length-1))]||null;
  const historicalForSeason=useMemo(()=>{
    if(!active?.season)return null;
    return (historicalValuations||[]).find(v=>String(v.season)===String(active.season))||null;
  },[historicalValuations,active?.season]);
  if (status === "loading") {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
        Cargando análisis de CraftedFC…
      </div>
    );
  }
  if (!snapshot) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
        No hay snapshot de CraftedFC vinculado a este jugador. Importa datos de CraftedFC para ver el análisis.
      </div>
    );
  }
  const stats = payloadField(snapshot, "stats") || {};
  const advancedEntries = Object.entries(stats)
    .filter(([, v]) => v !== null && v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));

  const inferredRole=normalizeRole(snapshot?.archetype||payloadField(snapshot,"primary_archetype")||position);
  const appliedRole=chosenRole||inferredRole||"";
  const historicalValues=historicalForSeason?{fifa_fc_overall:historicalForSeason.fifa_fc_overall??null,transfermarkt_value_eur:historicalForSeason.transfermarkt_value_eur??null}:null;
  const composite=calculateCompositeMF(active,appliedRole,null,historicalValues);
  const breakdownRows=composite.rows;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-2 text-xs font-black uppercase tracking-widest text-[#003399]">
          CraftedFC Analysis
        </h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <MiniCard label="Global Rating" value={show(snapshot.rating, 1)} />
          <MiniCard label="World Rank" value={show(snapshot.rank)} />
          <MiniCard label="Archetype" value={snapshot.archetype || payloadField(snapshot, "primary_archetype") || "—"} />
          <MiniCard label="Raw Score" value={show(snapshot.raw_score ?? payloadField(snapshot, "score"), 2)} />
          <MiniCard label="Team Strength" value={show(snapshot.team_strength, 1)} />
          <MiniCard label="League Strength" value={show(snapshot.league_strength, 1)} />
        </div>
      </div>

      <section className="rounded-xl border border-blue-200 bg-[#f7faff] p-4">
        <h4 className="text-sm font-black uppercase tracking-widest text-[#003399]">Composite MF Legacy · cálculo propio</h4>
        <p className="mt-1 text-xs text-slate-600">Utiliza los pesos observados de los 8 arquetipos de CraftedFC, pero percentiles FotMob de la temporada seleccionada. Es un índice experimental, NO el Composite oficial de CraftedFC ni una nota de Football Manager.</p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-[11px] font-bold text-slate-600">ARQUETIPO
            <select className="mt-1 block rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" value={appliedRole} onChange={e=>setChosenRole(e.target.value)}>
              {!appliedRole&&<option value="">Seleccionar posición</option>}
              {COMPOSITE_ROLES.map(role=><option key={role} value={role}>{role}</option>)}
            </select>
          </label>
          <label className="max-w-full text-[11px] font-bold text-slate-600">TEMPORADA · COMPETICIÓN
            <select className="mt-1 block max-w-[350px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" value={Math.min(rowIndex,Math.max(0,available.length-1))} onChange={e=>setRowIndex(Number(e.target.value))}>
              {!available.length&&<option value={0}>Sin estadísticas FotMob</option>}
              {available.map((r,i)=><option key={(r.external_record_id||i)+":"+i} value={i}>{r.season} · {r.competition} · {r.team_name||"Equipo por confirmar"}</option>)}
            </select>
          </label>
          <div className="ml-auto rounded-lg border border-blue-100 bg-white px-4 py-2 text-right">
            <div className="text-[10px] font-black uppercase text-slate-500">Composite MF Legacy {composite.status==="partial"?"· Parcial":""}</div>
            <div className="text-2xl font-black text-[#003399]">{show(composite.score,1)} <span className="text-sm font-normal text-slate-400">/100</span></div>
            <div className="text-[11px] text-slate-600">Cobertura: {show(composite.coverage,1)} % · {composite.count||0}/{composite.total||0} indicadores</div>
          </div>
        </div>
        {historicalForSeason&&<div className="mt-3 flex flex-wrap gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <div>
              <p className="text-[9px] font-black uppercase tracking-wide text-amber-700">FC Overall</p>
              <p className="text-lg font-black text-amber-900">{historicalForSeason.fifa_fc_overall!=null?historicalForSeason.fifa_fc_overall:"—"}</p>
              <p className="text-[9px] text-amber-600">FIFA/EA SPORTS FC historico{historicalForSeason.fifa_edition?` · ${historicalForSeason.fifa_edition}`:""}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
            <div>
              <p className="text-[9px] font-black uppercase tracking-wide text-emerald-700">Valor de mercado</p>
              <p className="text-lg font-black text-emerald-900">{formatEur(historicalForSeason.transfermarkt_value_eur)}</p>
              <p className="text-[9px] text-emerald-600">Transfermarkt historico{historicalForSeason.market_value_as_of?` · ${historicalForSeason.market_value_as_of}`:""}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <div>
              <p className="text-[9px] font-black uppercase tracking-wide text-slate-500">Demas indicadores</p>
              <p className="text-xs font-bold text-slate-600">FotMob</p>
              <p className="text-[9px] text-slate-400">Rendimiento por temporada</p>
            </div>
          </div>
        </div>}
        {!historicalForSeason&&active?.season&&<p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-500">Sin valoraciones historicas importadas para {active.season}. Usa "Importar valores historicos" para anadir FIFA/FC Overall y Transfermarkt.</p>}
        {(!active||!appliedRole)&&<p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Hace falta una competición con métricas y elegir un arquetipo. DM/MCD no se equipara automáticamente a CM hasta definir su baremo.</p>}
        {composite.status==="partial"&&<p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Cálculo parcial: los indicadores que faltan no reciben cero ni se inventan. El índice renormaliza únicamente los pesos disponibles y no se debe comparar directamente con un Composite de cobertura distinta.</p>}
        {!!breakdownRows.length&&<div className="mt-4 max-h-[430px] overflow-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[600px] text-left text-xs">
            <thead className="sticky top-0 bg-[#eaf0f8] text-slate-700">
              <tr><th className="px-3 py-2">Indicador</th><th className="px-3 py-2 text-right">Tu valor</th><th className="min-w-[150px] px-3 py-2 text-center">vs jugadores</th><th className="px-3 py-2 text-right">Peso</th><th className="px-3 py-2 text-right">Aporta</th></tr>
            </thead>
            <tbody>{breakdownRows.map(r=><tr key={r.key} className={"border-t border-slate-100 "+(r.percentile===null?"text-slate-400":"text-slate-800")}>
              <td className="px-3 py-3 font-semibold">
                {r.name}
                {r.key==="fc27_ovr"&&<span className="ml-1 rounded bg-amber-100 px-1 text-[8px] font-normal text-amber-700">FIFA/FC hist.</span>}
                {r.key==="market_value"&&<span className="ml-1 rounded bg-emerald-100 px-1 text-[8px] font-normal text-emerald-700">Transfermarkt hist.</span>}
                {!["fc27_ovr","market_value"].includes(r.key)&&<span className="ml-1 rounded bg-slate-100 px-1 text-[8px] font-normal text-slate-500">FotMob</span>}
              </td>
              <td className="px-3 py-3 text-right font-semibold">{r.key==="market_value"?formatEur(r.derivedValue):show(r.derivedValue, r.key==="play_share"?1:2)}{r.derivedValue!==null&&r.derivedValue!==undefined&&["play_share","aerial_duels_won_pct","ground_duels_won_pct","save_pct"].includes(r.key)?" %":""}</td>
              <td className="px-3 py-3">
                {r.percentile===null?<span className="block text-center text-slate-400" title="Sin percentil comparable">—</span>:<div className="flex items-center justify-end gap-2" title={"Percentil FotMob: "+show(r.percentile,1)+" de 100"}>
                  <div className="h-2.5 w-full min-w-[65px] max-w-[110px] overflow-hidden rounded-full bg-slate-200" role="meter" aria-label={"Percentil de "+r.name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(r.percentile)}>
                    <div className={"h-full rounded-full transition-all "+percentileColor(r.percentile)} style={{width:Math.min(100,Math.max(0,r.percentile))+"%"}}/>
                  </div>
                  <span className="min-w-[37px] text-right font-bold tabular-nums">{show(r.percentile,0)}<span className="font-normal text-slate-400">º</span></span>
                </div>}
              </td>
              <td className="px-3 py-3 text-right tabular-nums">{r.weight>0?"+":""}{r.weight} %</td>
              <td className={"px-3 py-3 text-right font-extrabold tabular-nums "+contributionColor(r.contribution)}>{r.contribution!==null?(r.contribution>0?"+":"")+show(r.contribution,2):"—"}</td>
            </tr>)}</tbody>
            <tfoot><tr className="border-t-2 border-blue-200 bg-blue-50 font-bold"><td colSpan={4} className="px-3 py-3 text-right">Suma de aportaciones conocidas</td><td className="px-3 py-3 text-right text-[#003399]">{show(composite.observedAdds,2)}</td></tr></tfoot>
          </table>
        </div>}
        <p className="mt-3 text-[11px] text-slate-500">Método: suma de aportaciones ponderadas (con penalizaciones negativas), normalizada por los pesos disponibles. Los valores disponibles por 90 y porcentajes proceden del registro FotMob de esta competición; Finishing y Play Share se derivan de él (Play Share usa PJ equipo × 90 como aproximación). Los derivados sin percentil no generan aportaciones hasta disponer de comparaciones válidas. El percentil de FotMob no representa necesariamente el mismo grupo de comparación que CraftedFC. Los pesos de Rating no visibles se infieren como diferencia hasta 100 % a partir de las capturas, no como especificación oficial.</p>
      </section>

      {/* Estadísticas avanzadas disponibles en el snapshot */}
      {advancedEntries.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-black uppercase tracking-widest text-slate-600">
            CraftedFC — snapshot global (no necesariamente esta temporada)
          </h4>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {advancedEntries.map(([key, value]) => (
              <div key={key} className="rounded-lg border border-slate-100 bg-white px-3 py-2">
                <p className="text-[11px] text-slate-500">{ADVANCED_LABELS[key] || key.replace(/_/g, " ")}</p>
                <p className="font-extrabold text-[#0d315b]">
                  {show(value, Number(value) % 1 ? 2 : 0)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-[11px] text-slate-500">
        <span>Snapshot: {snapshot.snapshot_date || "Sin fecha"}</span>
        <span>Fuente: {snapshot.source || "CraftedFC"}</span>
        <span>Comps: {payloadField(snapshot, "comps") || "—"}</span>
      </div>
    </div>
  );
}