
import React, { useMemo, useState } from "react";
import {
  Search,
  Shield,
  Plus,
  SlidersHorizontal,
  X,
} from "lucide-react";

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

  const [searchOpen, setSearchOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const countries = [
    "Todos",
    ...new Set(initialTeams.map((team) => team.country)),
  ];

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
        competition === "Todas" ||
        team.competition === competition;

      return (
        matchesSearch &&
        matchesCountry &&
        matchesCompetition
      );
    });
  }, [search, country, competition]);

  return (
    <div className="min-h-full p-6 md:p-8">

      {/* CABECERA COMPACTA */}

      <div className="mb-6 flex items-center justify-between">

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#003399] shadow-sm">
            <Shield size={21} strokeWidth={1.7} />
          </div>

          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Teams
            </h1>

            <p className="text-xs text-slate-500">
              {filteredTeams.length} equipos
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">

          {/* BOTÓN DE BÚSQUEDA */}

          <button
            type="button"
            onClick={() => setSearchOpen((open) => !open)}
            className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
              searchOpen
                ? "bg-[#003399] text-white"
                : "bg-white text-[#003399] hover:bg-slate-100"
            }`}
            aria-label="Buscar equipos"
          >
            {searchOpen ? (
              <X size={18} />
            ) : (
              <Search size={18} />
            )}
          </button>

          {/* BOTÓN DE FILTROS */}

          <button
            type="button"
            onClick={() => setFiltersOpen((open) => !open)}
            className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
              filtersOpen
                ? "bg-[#003399] text-white"
                : "bg-white text-[#003399] hover:bg-slate-100"
            }`}
            aria-label="Mostrar filtros"
          >
            <SlidersHorizontal size={18} />
          </button>

          {/* AÑADIR EQUIPO */}

          <button
            type="button"
            className="flex h-10 items-center justify-center gap-2 rounded-xl bg-[#003399] px-4 text-sm font-semibold text-white transition hover:bg-[#002477]"
          >
            <Plus size={17} />
            <span className="hidden sm:inline">
              Añadir equipo
            </span>
          </button>

        </div>
      </div>

      {/* BUSCADOR DESPLEGABLE */}

      {searchOpen && (
        <div className="mb-4">
          <div className="relative">

            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              type="text"
              autoFocus
              placeholder="Buscar equipo..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none transition focus:border-[#003399]"
            />

          </div>
        </div>
      )}

      {/* FILTROS DESPLEGABLES */}

      {filtersOpen && (
        <div className="mb-5 grid gap-3 rounded-2xl bg-white p-4 shadow-sm md:grid-cols-2">

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">
              País
            </label>

            <select
              value={country}
              onChange={(event) => setCountry(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none"
            >
              {countries.map((item) => (
                <option key={item} value={item}>
                  {item === "Todos"
                    ? "Todos los países"
                    : item}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">
              Competición
            </label>

            <select
              value={competition}
              onChange={(event) => setCompetition(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none"
            >
              {competitions.map((item) => (
                <option key={item} value={item}>
                  {item === "Todas"
                    ? "Todas las competiciones"
                    : item}
                </option>
              ))}
            </select>
          </div>

        </div>
      )}

      {/* TARJETAS DE EQUIPOS */}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">

        {filteredTeams.map((team) => (
          <article
            key={team.id}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          >
            <div className="flex items-center gap-4">

              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-[#003399]">
                <Shield size={28} strokeWidth={1.5} />
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

      {/* ESTADO SIN RESULTADOS */}

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
