
import React, { useMemo, useState } from "react";
import { Search, Shield, Plus } from "lucide-react";

const initialTeams = [
  {
    id: 1,
    name: "Real Madrid",
    country: "España",
    competition: "LaLiga",
    shortName: "RMA",
  },
  {
    id: 2,
    name: "FC Barcelona",
    country: "España",
    competition: "LaLiga",
    shortName: "BAR",
  },
  {
    id: 3,
    name: "Manchester City",
    country: "Inglaterra",
    competition: "Premier League",
    shortName: "MCI",
  },
];

export default function Teams() {
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("Todos");
  const [competition, setCompetition] = useState("Todas");

  const countries = ["Todos", ...new Set(initialTeams.map((team) => team.country))];
  const competitions = [
    "Todas",
    ...new Set(initialTeams.map((team) => team.competition)),
  ];

  const filteredTeams = useMemo(() => {
    return initialTeams.filter((team) => {
      const matchesSearch = team.name
        .toLowerCase()
        .includes(search.toLowerCase());

      const matchesCountry =
        country === "Todos" || team.country === country;

      const matchesCompetition =
        competition === "Todas" || team.competition === competition;

      return matchesSearch && matchesCountry && matchesCompetition;
    });
  }, [search, country, competition]);

  return (
    <div className="min-h-full p-6 md:p-8">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
            MF LEGACY
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Equipos
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Explora y gestiona la base de datos de clubes.
          </p>
        </div>

        <button
          type="button"
          className="flex items-center justify-center gap-2 rounded-xl bg-[#003399] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#002477]"
        >
          <Plus size={17} />
          Añadir equipo
        </button>
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-[1fr_180px_200px]">
        <div className="relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />

          <input
            type="text"
            placeholder="Buscar equipo..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none transition focus:border-[#003399]"
          />
        </div>

        <select
          value={country}
          onChange={(event) => setCountry(event.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none"
        >
          {countries.map((item) => (
            <option key={item} value={item}>
              {item === "Todos" ? "Todos los países" : item}
            </option>
          ))}
        </select>

        <select
          value={competition}
          onChange={(event) => setCompetition(event.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none"
        >
          {competitions.map((item) => (
            <option key={item} value={item}>
              {item === "Todas" ? "Todas las competiciones" : item}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredTeams.map((team) => (
          <article
            key={team.id}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-[#003399]">
                <Shield size={30} strokeWidth={1.5} />
              </div>

              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold text-slate-900">
                  {team.name}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {team.country}
                </p>

                <p className="mt-1 text-xs font-medium text-[#003399]">
                  {team.competition}
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>

      {filteredTeams.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <h2 className="text-lg font-semibold text-slate-800">
            No se han encontrado equipos
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Prueba con otro nombre o modifica los filtros.
          </p>
        </div>
      )}
    </div>
  );
}
