import React from "react";
import { Calendar, Database, Globe } from "lucide-react";
import { payloadField } from "@/utils/craftedfc";

const show = (v, d = 0) =>
  v === null || v === undefined || !Number.isFinite(Number(v))
    ? "—"
    : Number(v).toLocaleString("es-ES", {
        minimumFractionDigits: d,
        maximumFractionDigits: d,
      });

const Card = ({ label, value, sub, accent }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4">
    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
    <p className={"mt-1 text-2xl font-black " + (accent || "text-[#0d315b]")}>{value}</p>
    {sub && <p className="text-[10px] text-slate-500">{sub}</p>}
  </div>
);

// Overview: tarjetas compactas con la valoración global de CraftedFC y la nota
// media de FotMob de la temporada seleccionada. Diferencia visualmente ambos
// ratings: el CFC Rating es global, la nota FotMob es por partidos.
export default function CraftedfcOverview({ snapshot, status, fotmobRating }) {
  if (status === "loading") {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
        Cargando datos de CraftedFC…
      </div>
    );
  }
  const hasSnap = Boolean(snapshot);
  const level = hasSnap ? payloadField(snapshot, "level_name") : null;
  const tier = hasSnap ? payloadField(snapshot, "level_tier") : null;
  const percentile = hasSnap ? payloadField(snapshot, "level_percentile") : null;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-2 text-xs font-black uppercase tracking-widest text-[#003399]">Overview</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card
            label="Nota FotMob (temp.)"
            value={show(fotmobRating, 2)}
            sub="Media ponderada por partidos"
            accent="text-[#0d315b]"
          />
          <Card
            label="CFC Rating"
            value={show(snapshot?.rating, 1)}
            sub={hasSnap ? "Rating global CraftedFC" : "Sin snapshot"}
            accent="text-[#003399]"
          />
          <Card
            label="World Rank"
            value={show(snapshot?.rank)}
            sub={hasSnap ? "Ranking global publicado" : "—"}
            accent="text-[#003399]"
          />
          <Card
            label="Archetype"
            value={snapshot?.archetype || payloadField(snapshot, "primary_archetype") || "—"}
            sub={hasSnap ? payloadField(snapshot, "primary_position") : "—"}
          />
          <Card
            label="Team Strength"
            value={show(snapshot?.team_strength, 1)}
            sub={hasSnap ? payloadField(snapshot, "display_team") : "—"}
          />
          <Card
            label="League Strength"
            value={show(snapshot?.league_strength, 1)}
          />
          <Card
            label="Raw Score"
            value={show(snapshot?.raw_score ?? payloadField(snapshot, "score"), 2)}
          />
          <Card
            label="Nivel"
            value={level || "—"}
            sub={tier != null ? `Tier ${tier}${percentile != null ? " · " + percentile + "%" : ""}` : ""}
          />
        </div>
      </div>
      <p className="rounded-lg bg-blue-50 px-3 py-2 text-[11px] text-blue-900">
        El <strong>CFC Rating</strong> y el <strong>World Rank</strong> son datos globales de la captura CraftedFC y no
        representan el ranking histórico de una temporada concreta. La <strong>Nota FotMob</strong> es la media ponderada
        por partidos de la temporada seleccionada.
      </p>
      {hasSnap && (
        <div className="flex flex-wrap gap-3 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1">
            <Calendar size={12} /> {snapshot.snapshot_date || "Sin fecha"}
          </span>
          <span className="inline-flex items-center gap-1">
            <Database size={12} /> {snapshot.source || "CraftedFC"}
          </span>
          <span className="inline-flex items-center gap-1">
            <Globe size={12} />{" "}
            {payloadField(snapshot, "player_country_name") ||
              payloadField(snapshot, "player_country") ||
              "—"}
          </span>
        </div>
      )}
    </div>
  );
}