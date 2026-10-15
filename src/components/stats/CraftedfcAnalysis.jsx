import React, { useState } from "react";
import { ChevronDown, Info } from "lucide-react";
import { payloadField } from "@/utils/craftedfc";
import HistoricalPeerPreview from "@/components/stats/HistoricalPeerPreview";

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

const MiniCard = ({ label, value }) => (
  <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
    <p className="text-[10px] font-bold uppercase text-slate-500">{label}</p>
    <p className="text-xl font-black text-[#003399]">{value}</p>
  </div>
);

// MF LEGACY es el sistema principal: el Composite (calculado con nuestra base
// de datos) abre el panel y ocupa el protagonismo visual. CraftedFC queda como
// referencia externa secundaria, dentro de un acordeón plegado por defecto.
// CraftedFC provides a seasonless reference snapshot ONLY.
// The MAIN MF LEGACY Composite now comes exclusively from our historical
// position-based player-season database. Never fall back to FotMob percentiles.
export default function CraftedfcAnalysis({
  snapshot, status, position = "", playerId, seasons = [], initialSeason = "", editableRows = [], onSetMetric,
}) {
  const [externalOpen, setExternalOpen] = useState(false);
  const stats = snapshot ? (payloadField(snapshot, "stats") || {}) : {};
  const advancedEntries = Object.entries(stats)
    .filter(([, value]) => value !== null && value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="space-y-3">
      {/* 1. Bloque principal y protagonista: Composite MF LEGACY */}
      <HistoricalPeerPreview main playerId={playerId} position={position}
        seasons={seasons} initialSeason={initialSeason} editableRows={editableRows} onSetMetric={onSetMetric}/>

      {/* 2. Referencia externa, secundaria y plegada por defecto */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <button type="button" onClick={()=>setExternalOpen(v=>!v)} aria-expanded={externalOpen}
          className="flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left hover:bg-slate-50">
          <span className="min-w-0">
            <span className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-600">
              <Info size={15} className="text-slate-400"/>
              Referencia externa CraftedFC (opcional)
            </span>
            <span className="mt-0.5 block text-[11px] text-slate-500">
              Snapshot global publicado por CraftedFC. Es apoyo externo: no forma parte del Composite MF LEGACY ni de nuestros cálculos.
            </span>
          </span>
          <ChevronDown size={18}
            className={"shrink-0 text-slate-400 transition-transform "+(externalOpen?"rotate-180":"")}/>
        </button>

        {externalOpen&&(
          <div className="space-y-4 border-t border-slate-100 px-4 py-4">
            <div>
              <h3 className="mb-2 text-xs font-black uppercase tracking-widest text-slate-500">
                CraftedFC · valoración global (referencia)
              </h3>
              {snapshot ? (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  <MiniCard label="Global Rating" value={show(snapshot.rating, 1)}/>
                  <MiniCard label="World Rank" value={show(snapshot.rank)}/>
                  <MiniCard label="Archetype" value={snapshot.archetype || payloadField(snapshot, "primary_archetype") || "—"}/>
                  <MiniCard label="Raw Score" value={show(snapshot.raw_score ?? payloadField(snapshot, "score"), 2)}/>
                  <MiniCard label="Team Strength" value={show(snapshot.team_strength, 1)}/>
                  <MiniCard label="League Strength" value={show(snapshot.league_strength, 1)}/>
                </div>
              ) : (
                <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                  {status === "loading"
                    ? "Cargando snapshot global de CraftedFC…"
                    : "No hay snapshot global de CraftedFC. El Composite MF LEGACY puede calcularse igualmente con nuestros datos."}
                </p>
              )}
            </div>

            {advancedEntries.length > 0 && (
              <div>
                <h4 className="mb-2 text-xs font-black uppercase tracking-widest text-slate-600">
                  CraftedFC — snapshot global (no necesariamente esta temporada)
                </h4>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {advancedEntries.map(([key, value]) => (
                    <div key={key} className="rounded-lg border border-slate-100 bg-white px-3 py-2">
                      <p className="text-[11px] text-slate-500">
                        {ADVANCED_LABELS[key] || key.replace(/_/g, " ")}
                      </p>
                      <p className="font-extrabold text-[#0d315b]">
                        {show(value, Number(value) % 1 ? 2 : 0)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {snapshot && (
              <div className="flex flex-wrap gap-3 text-[11px] text-slate-500">
                <span>Snapshot: {snapshot.snapshot_date || "Sin fecha"}</span>
                <span>Fuente: {snapshot.source || "CraftedFC"}</span>
                <span>Comps: {payloadField(snapshot, "comps") || "—"}</span>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}