import React, { useMemo, useState } from "react";
import { ChevronDown, Users, AlertTriangle, ArrowRightLeft } from "lucide-react";

/**
 * Fm26ClubPlayers — desplegable de inspección de jugadores dentro de un
 * grupo de club detectado en el importador FM26.
 *
 * Componente puramente presentacional. No modifica datos, asignaciones,
 * caché ni lógica de importación. Sólo lee `group.players` y
 * `group.nameVariants` ya derivados en Players.jsx.
 *
 * Cada instancia gestiona su propio estado de apertura (cerrado por
 * defecto, independiente por club).
 */

const normalizeUid = (uid) => {
  const value = String(uid ?? "").trim();
  if (!value || value === "undefined" || value === "null") return "";
  return value;
};

const PlayerRow = ({ player }) => {
  const playerUid = normalizeUid(player.uid);
  const clubUid = normalizeUid(player.club_uid);
  const clubName = String(player.club_name || "").trim();
  const teamSlot = player.team_slot ?? null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="truncate font-bold text-slate-800">{player.name || "Jugador sin nombre"}</span>
        {player.on_loan && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
            <ArrowRightLeft size={10} /> Cedido
          </span>
        )}
      </div>

      <div className="mt-1.5 grid grid-cols-1 gap-1 text-[11px] text-slate-500 sm:grid-cols-2">
        <p>
          <span className="font-semibold text-slate-600">Jugador UID:</span>{" "}
          {playerUid ? <span className="font-mono text-slate-700">{playerUid}</span> : <span className="italic text-slate-400">no disponible</span>}
        </p>
        <p>
          <span className="font-semibold text-slate-600">club_uid:</span>{" "}
          {clubUid ? <span className="font-mono text-slate-700">{clubUid}</span> : <span className="italic text-rose-500">no identificado</span>}
        </p>
        <p>
          <span className="font-semibold text-slate-600">club_name:</span>{" "}
          {clubName ? <span className="text-slate-700">{clubName}</span> : <span className="italic text-slate-400">—</span>}
        </p>
        <p>
          <span className="font-semibold text-slate-600">team_slot:</span>{" "}
          {teamSlot !== null && teamSlot !== "" ? <span className="text-slate-700">{String(teamSlot)}</span> : <span className="italic text-slate-400">—</span>}
        </p>
      </div>

      {player.on_loan && (
        <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
          <p className="font-bold">Cesión detectada</p>
          <p className="mt-0.5">
            Club propietario:{" "}
            {normalizeUid(player.loan_parent_club_uid) ? (
              <span className="font-mono">{normalizeUid(player.loan_parent_club_uid)}</span>
            ) : <span className="italic">UID no indicado</span>}
            {player.loan_parent_club_name ? ` · ${player.loan_parent_club_name}` : ""}
          </p>
        </div>
      )}
    </div>
  );
};

const UidSubGroup = ({ uid, players }) => {
  const hasUid = Boolean(normalizeUid(uid));
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
        {hasUid ? (
          <>club_uid <span className="font-mono text-slate-700">{normalizeUid(uid)}</span> · {players.length} jugadores</>
        ) : (
          <span className="text-rose-500">Sin club_uid (no identificado) · {players.length} jugadores</span>
        )}
      </p>
      {players.map((player, index) => (
        <PlayerRow key={`${player.uid || "no-uid"}-${index}`} player={player} />
      ))}
    </div>
  );
};

export default function Fm26ClubPlayers({ group }) {
  const [open, setOpen] = useState(false);
  const players = group?.players || [];
  const nameVariants = group?.nameVariants || [];

  // Sub-agrupar por club_uid original dentro del grupo.
  const uidGroups = useMemo(() => {
    const map = new Map();
    for (const player of players) {
      const key = normalizeUid(player.club_uid) || "__no_uid__";
      if (!map.has(key)) map.set(key, { uid: player.club_uid, players: [] });
      map.get(key).players.push(player);
    }
    return [...map.values()].sort((a, b) => {
      const aUid = normalizeUid(a.uid);
      const bUid = normalizeUid(b.uid);
      if (!aUid && bUid) return 1;
      if (aUid && !bUid) return -1;
      return String(aUid).localeCompare(String(bUid));
    });
  }, [players]);

  const hasUidConflict = nameVariants.length > 1;

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <button
        type="button"
        disabled={!players.length}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-40"
      >
        <span className="flex items-center gap-2">
          <Users size={14} />
          Ver jugadores ({players.length})
        </span>
        <ChevronDown
          size={15}
          className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {hasUidConflict && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
              <p className="flex items-center gap-1.5 font-bold">
                <AlertTriangle size={13} /> Este nombre de club aparece con {nameVariants.length} UIDs distintos
              </p>
              <p className="mt-1 text-amber-700">
                No se asume que sean el mismo equipo. Revisa cada grupo antes de asignar destino.
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {nameVariants.map((variant) => (
                  <span
                    key={variant.key}
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                      variant.key === group.key
                        ? "border-amber-500 bg-amber-100 text-amber-900"
                        : "border-amber-200 bg-white text-amber-700"
                    }`}
                  >
                    UID {normalizeUid(variant.uid) || "—"} · {variant.count} jugadores
                  </span>
                ))}
              </div>
            </div>
          )}

          {uidGroups.map((sub, index) => (
            <UidSubGroup key={`${normalizeUid(sub.uid) || "no-uid"}-${index}`} uid={sub.uid} players={sub.players} />
          ))}

          {!players.length && (
            <p className="text-center text-[11px] text-slate-400">No hay jugadores en este grupo.</p>
          )}
        </div>
      )}
    </div>
  );
}