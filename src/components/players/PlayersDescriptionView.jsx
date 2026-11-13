import React, { useCallback, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import PlayerCard from "@/components/players/PlayerCard";

// Vista "separar por descripciones" de PLAYERS. Cada categoría y cada
// descripción se pliegan de verdad: el chevron oculta y vuelve a mostrar su
// bloque de jugadores.
export default function PlayersDescriptionView({
  categories = [],
  bulkMode = false,
  bulkIds = [],
  onToggleSelection,
  onSelect,
  teamById = {},
  countryById = {},
  playersWithStats,
}) {
  const [collapsed, setCollapsed] = useState({});
  const toggle = useCallback(
    (key) => setCollapsed((old) => ({ ...old, [key]: !old[key] })),
    []
  );
  const hasStats = (id) => Boolean(playersWithStats?.has(String(id)));

  return (
    <div className="space-y-4">
      {categories.map((category) => {
        const categoryKey = `category:${category.id}`;
        const categoryClosed = Boolean(collapsed[categoryKey]);
        const categoryCount = category.subgroups.reduce(
          (total, subgroup) => total + subgroup.players.length,
          0
        );
        return (
          <section
            key={category.id}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
          >
            <button
              type="button"
              aria-expanded={!categoryClosed}
              aria-label={(categoryClosed ? "Mostrar " : "Ocultar ") + category.name}
              onClick={() => toggle(categoryKey)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
                  {categoryClosed ? (
                    <ChevronRight size={17} className="text-slate-500" />
                  ) : (
                    <ChevronDown size={17} className="text-slate-500" />
                  )}
                </span>
                <div className="min-w-0">
                  <h2 className="truncate text-base font-extrabold tracking-tight text-slate-900">
                    {category.name}
                  </h2>
                  <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
                    {category.subgroups.length} subgroups
                  </p>
                </div>
              </div>
              <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                {categoryCount} {categoryCount === 1 ? "player" : "players"}
              </span>
            </button>

            {!categoryClosed && (
              <div className="border-t border-slate-100 bg-slate-50/40 p-3">
                <div className="space-y-2">
                  {category.subgroups.map((subgroup) => {
                    const subgroupKey = `group:${subgroup.id}`;
                    const subgroupClosed = Boolean(collapsed[subgroupKey]);
                    return (
                      <div
                        key={subgroup.id}
                        className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                      >
                        <button
                          type="button"
                          aria-expanded={!subgroupClosed}
                          aria-label={(subgroupClosed ? "Mostrar " : "Ocultar ") + subgroup.name}
                          onClick={() => toggle(subgroupKey)}
                          className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-slate-50"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50">
                              {subgroupClosed ? (
                                <ChevronRight size={15} className="text-slate-400" />
                              ) : (
                                <ChevronDown size={15} className="text-slate-400" />
                              )}
                            </span>
                            <span className="min-w-0 truncate text-sm font-semibold text-slate-800">
                              {subgroup.name}
                            </span>
                          </div>
                          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                            {subgroup.players.length}{" "}
                            {subgroup.players.length === 1 ? "player" : "players"}
                          </span>
                        </button>

                        {!subgroupClosed && (
                          <div className="border-t border-slate-100 bg-slate-50/30 p-3">
                            {subgroup.players.length > 0 ? (
                              <div className="mf-player-grid gap-x-4 gap-y-4">
                                {subgroup.players.map((player) => (
                                  <PlayerCard
                                    key={player.id || `${player.name}-${player.dateOfBirth}`}
                                    player={player}
                                    hasStats={hasStats(player.id)}
                                    team={teamById[player.teamId]}
                                    country={countryById[player.countryId]}
                                    compact
                                    onSelect={onSelect}
                                    selectionMode={bulkMode}
                                    selected={bulkIds.includes(String(player.id))}
                                    onToggleSelection={onToggleSelection}
                                  />
                                ))}
                              </div>
                            ) : (
                              <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-xs font-medium text-slate-400">
                                No players in this subgroup.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}