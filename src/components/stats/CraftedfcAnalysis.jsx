import React from "react";
import { payloadField } from "@/utils/craftedfc";

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

const MiniCard = ({ label, value, accent }) => (
  <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
    <p className="text-[10px] font-bold uppercase text-slate-500">{label}</p>
    <p className={"text-xl font-black " + (accent || "text-[#003399]")}>{value}</p>
  </div>
);

// CraftedFC Analysis: muestra los datos reales del snapshot y una tabla
// Rating Breakdown extensible. El Composite solo se muestra si existe en una
// fuente verificable; si no, se indica "Desglose no disponible".
export default function CraftedfcAnalysis({ snapshot, status }) {
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
        No hay snapshot de CraftedFC para este jugador. Solo se muestran datos de FotMob.
      </div>
    );
  }

  const stats = payloadField(snapshot, "stats") || {};
  const advancedEntries = Object.entries(stats)
    .filter(([, v]) => v !== null && v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));

  // Estructura extensible: se poblará con desgloses oficiales por métrica cuando
  // CraftedFC publique percentiles y pesos verificables por competición/temporada.
  // No se crean puntuaciones artificiales.
  const breakdownRows = [];

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

      {/* Rating Breakdown — estructura extensible */}
      <div>
        <h4 className="mb-2 text-xs font-black uppercase tracking-widest text-slate-600">
          Rating Breakdown
        </h4>
        {breakdownRows.length ? (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead className="bg-[#eaf0f8] text-slate-700">
                <tr>
                  <th className="px-3 py-2">Métrica</th>
                  <th className="px-3 py-2 text-right">Tu valor</th>
                  <th className="px-3 py-2 text-right">vs Peers</th>
                  <th className="px-3 py-2 text-right">Peso</th>
                  <th className="px-3 py-2 text-right">Aportación</th>
                </tr>
              </thead>
              <tbody>
                {breakdownRows.map((r, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-semibold text-slate-700">{r.metric}</td>
                    <td className="px-3 py-2 text-right">{show(r.value)}</td>
                    <td className="px-3 py-2 text-right">{show(r.peers)}</td>
                    <td className="px-3 py-2 text-right">{show(r.weight)}</td>
                    <td className="px-3 py-2 text-right">{show(r.adds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-xs text-slate-500">
            <p className="font-bold text-slate-700">Desglose no disponible</p>
            <p className="mt-1">
              No existe un desglose oficial de Composite por métrica para este jugador. Cuando CraftedFC publique
              percentiles y pesos verificables por competición y temporada, se mostrarán aquí sin crear puntuaciones
              artificiales.
            </p>
          </div>
        )}
      </div>

      {/* Estadísticas avanzadas disponibles en el snapshot */}
      {advancedEntries.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-black uppercase tracking-widest text-slate-600">
            Estadísticas avanzadas (per 90 / %)
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