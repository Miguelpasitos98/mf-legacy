import React from "react";

// Ficha de lectura: muestra los textos personalizados que ya están guardados
// en tactical_roles. Nunca guarda datos ni genera descripciones nuevas.
export default function TacticalIdentityCard({ player, selectedRoleIndex = 0 }) {
  const stored = Array.isArray(player?.tactical_roles) ? player.tactical_roles : [];
  const roles = [0, 1].map((index) => ({
    name: String(stored[index]?.name || (index === 0 ? player?.description || "" : "")).trim(),
    description: String(stored[index]?.description || "").trim(),
  }));
  const index = roles[selectedRoleIndex]?.name
    ? selectedRoleIndex
    : roles.findIndex((role) => role.name);
  const selected = index >= 0 ? roles[index] : null;

  return (
    <section className="mf-tactical-identity flex h-full min-h-0 w-full flex-col" aria-label="Identidad táctica">
      <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
          Tactical identity
        </p>
        {selected && (
          <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {index === 0 ? "Principal" : "Secundario"}
          </span>
        )}
      </div>
      <div key={selected ? `${index}:${selected.name}` : "empty"} className="mf-tactical-identity-content min-h-0 flex-1">
        {selected ? (
          <>
            <h2 className="mb-2 text-[16px] font-bold leading-tight text-slate-900">
              {selected.name}
            </h2>
            <p className="whitespace-pre-line text-[12px] font-normal leading-[1.55] text-slate-600">
              {selected.description || "Este rol todavía no tiene una descripción personalizada."}
            </p>
          </>
        ) : (
          <p className="text-[12px] font-normal leading-relaxed text-slate-500">
            Aún no hay roles tácticos asignados a este jugador.
          </p>
        )}
      </div>
    </section>
  );
}
