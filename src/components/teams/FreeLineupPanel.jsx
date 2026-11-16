import React, { useMemo } from "react";
import TacticalBuilder from "./TacticalBuilder";

// Once libre: se elige cualquier jugador de la base y se guarda en un clic.
// No depende de un club, de una plantilla ni de una temporada.
const FREE_TEAM = { id: "standalone", name: "Once sin equipo", short_name: "LIBRE", logo: "" };

export default function FreeLineupPanel({ players, onDirtyChange }) {
  const roster = useMemo(() => players.map(player => ({
    player_id: String(player.id), player, shirt_number: player.shirt_number
  })), [players]);
  return <div>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 className="text-2xl font-extrabold">Once sin equipo</h2>
        <p className="text-sm text-slate-500">Elige cualquier jugador de la base. No se vincula a ningún club ni crea plantilla.</p>
      </div>
      <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-800">{players.length} jugadores disponibles</span>
    </div>
    <TacticalBuilder
      key="once-libre"
      standalone
      team={FREE_TEAM}
      season=""
      roster={roster}
      allPlayers={players}
      comparison={[]}
      balanceComparison={[]}
      onEnsurePlayer={async () => {}}
      onDirtyChange={onDirtyChange}
    />
  </div>;
}