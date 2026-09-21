
import React, { useMemo, useState } from "react";
import { Search, Shield } from "lucide-react";

const initialTeams = [
  {
    id: 1,
    name: "Real Madrid",
    country: "España",
    continent: "Europe",
    competition: "LaLiga",
    shortName: "RMA",
  },
  {
    id: 2,
    name: "FC Barcelona",
    country: "España",
    continent: "Europe",
    competition: "LaLiga",
    shortName: "BAR",
  },
  {
    id: 3,
    name: "Manchester City",
    country: "Inglaterra",
    continent: "Europe",
    competition: "Premier League",
    shortName: "MCI",
  },
];

const continentFilters = [
  "All",
  "Europe",
  "South America",
  "North America",
  "Asia",
  "Africa",
  "Oceania",
];

const continentLabels = {
  All: "All",
  Europe: "Europe",
  "South America": "South America",
  "North America": "North America",
  Asia: "Asia",
  Africa: "Africa",
  Oceania: "Oceania",
};

const competitionDetails = {
  LaLiga: {
    level: "Level 1",
    logo: "LALIGA",
  },
  "Premier League": {
    level: "Level 1",
    logo: "PL",
  },
};

function TeamLogo({ team }) {
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-50">
      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-[10px] font-extrabold tracking-tight text-slate-800">
        {team.shortName}
      </div>
    </div>
  );
}

export default function Teams() {
  const [search, setSearch] = useState("");
  const [continent, setContinent] = useState("All");

  const filteredTeams = useMemo(() => {
    return initialTeams.filter((team) => {
      const normalizedSearch = search.toLowerCase().trim();

      const matchesSearch =
        team.name.toLowerCase().includes(normalizedSearch) ||
        team.country.toLowerCase().includes(normalizedSearch) ||
        team.competition.toLowerCase().includes(normalizedSearch);

      const matchesContinent =
        continent === "All" || team.continent === continent;

      return matchesSearch && matchesContinent;
    });
  }, [search, continent]);

  const groupedCompetitions = useMemo(() => {
    return filteredTeams.reduce((groups, team) => {
      if (!groups[team.competition]) {
        groups[team.competition] = [];
      }

      groups[team.competition].push(team);

      return groups;
    }, {});
  }, [filteredTeams]);

  const totalTeams = filteredTeams.length;

  return (
    <div className="min-h-full bg-[#F6F7F9] p-6 md:p-8">

      {/* CABECERA */}

      <div className="mb-7 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">

        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#111827]">
            Teams
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Explore all clubs from the world's top leagues.
          </p>
        </div>

        {/* BUSCADOR */}

        <div className="relative w-full xl:w-[270px]">
          <Search
            size={18}
            strokeWidth={2}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
          />

          <input
            type="text"
            placeholder="Search teams..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#003399] focus:ring-2 focus:ring-[#003399]/10"
          />
        </div>

      </div>

      {/* FILTROS POR CONTINENTE */}

      <div className="mb-7 flex flex-wrap items-center gap-2">

        {continentFilters.map((item) => {
          const isActive = continent === item;

          return (
            <button
              key={item}
              type="button"
              onClick={() => setContinent(item)}
              className={`rounded-xl border px-4 py-2 text-xs font-semibold transition ${
                isActive
                  ? "border-[#172033] bg-[#172033] text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              {continentLabels[item]}
            </button>
          );
        })}

      </div>

      {/* RESUMEN */}

      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500">
          {totalTeams} {totalTeams === 1 ? "team" : "teams"}
        </p>
      </div>

      {/* COMPETICIONES */}

      <div className="space-y-5">

        {Object.entries(groupedCompetitions).map(
          ([competitionName, teams]) => {
            const competition =
              competitionDetails[competitionName] || {
                level: "Level 1",
                logo: "FC",
              };

            return (
              <section
                key={competitionName}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.02)] md:p-5"
              >

                {/* CABECERA DE LA COMPETICIÓN */}

                <div className="mb-4 flex items-center justify-between gap-4">

                  <div className="flex min-w-0 items-center gap-3">

                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-[9px] font-black text-slate-700">
                      {competition.logo}
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-sm font-bold text-slate-900">
                        {competitionName}
                      </h2>

                      <span className="text-xs text-slate-400">
                        {competition.level}
                      </span>
                    </div>

                  </div>

                  <span className="shrink-0 text-xs font-medium text-slate-400">
                    {teams.length} {teams.length === 1 ? "team" : "teams"}
                  </span>

                </div>

                {/* TARJETAS HORIZONTALES */}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">

                  {teams.map((team) => (
                    <button
                      key={team.id}
                      type="button"
                      className="group flex h-[66px] items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm"
                    >

                      <TeamLogo team={team} />

                      <span className="min-w-0 truncate text-xs font-bold text-slate-800 transition group-hover:text-[#003399]">
                        {team.name}
                      </span>

                    </button>
                  ))}

                </div>

              </section>
            );
          }
        )}

      </div>

      {/* ESTADO SIN RESULTADOS */}

      {filteredTeams.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">

          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-50">
            <Shield size={22} className="text-slate-400" />
          </div>

          <h2 className="mt-4 text-base font-bold text-slate-800">
            No teams found
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Try another search or select a different continent.
          </p>

          <button
            type="button"
            onClick={() => {
              setSearch("");
              setContinent("All");
            }}
            className="mt-5 rounded-xl bg-[#003399] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#002477]"
          >
            Clear filters
          </button>

        </div>
      )}

    </div>
  );
}
