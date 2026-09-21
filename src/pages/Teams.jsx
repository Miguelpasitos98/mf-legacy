
import React, { useMemo, useState } from "react";
import {
  Search,
  Globe,
  Star,
  TrendingUp,
  Map,
  CircleAlert,
} from "lucide-react";

const initialTeams = [
  {
    id: 1,
    name: "Real Madrid",
    country: "España",
    continent: "Europe",
    competition: "LaLiga",
    shortName: "RMA",
    reputation: "Elite",
    market: "High",
    incomplete: false,
  },
  {
    id: 2,
    name: "FC Barcelona",
    country: "España",
    continent: "Europe",
    competition: "LaLiga",
    shortName: "BAR",
    reputation: "Elite",
    market: "High",
    incomplete: false,
  },
  {
    id: 3,
    name: "Manchester City",
    country: "Inglaterra",
    continent: "Europe",
    competition: "Premier League",
    shortName: "MCI",
    reputation: "Elite",
    market: "High",
    incomplete: false,
  },
];

const navigationFilters = [
  {
    id: "countries",
    label: "Countries",
    icon: Globe,
  },
  {
    id: "continents",
    label: "Continents",
    icon: Map,
  },
  {
    id: "reputation",
    label: "Reputation",
    icon: Star,
  },
  {
    id: "market",
    label: "Market",
    icon: TrendingUp,
  },
  {
    id: "incomplete",
    label: "Incomplete",
    icon: CircleAlert,
  },
];

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
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white">
      <span className="text-[10px] font-extrabold tracking-tight text-slate-800">
        {team.shortName}
      </span>
    </div>
  );
}

function CompetitionHeader({ competitionName, teams }) {
  const competition =
    competitionDetails[competitionName] || {
      level: "Level 1",
      logo: "FC",
    };

  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-[8px] font-black text-slate-700">
          {competition.logo}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-sm font-bold text-slate-900">
            {competitionName}
          </h3>

          <span className="text-xs text-slate-400">
            {competition.level}
          </span>
        </div>
      </div>

      <span className="shrink-0 text-xs font-medium text-slate-400">
        {teams.length} {teams.length === 1 ? "team" : "teams"}
      </span>
    </div>
  );
}

function TeamCard({ team }) {
  return (
    <button
      type="button"
      className="group flex h-[64px] items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm"
    >
      <TeamLogo team={team} />

      <span className="min-w-0 truncate text-xs font-bold text-slate-800 transition group-hover:text-[#003399]">
        {team.name}
      </span>
    </button>
  );
}

export default function Teams() {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("countries");

  const filteredTeams = useMemo(() => {
    const normalizedSearch = search.toLowerCase().trim();

    return initialTeams.filter((team) => {
      if (!normalizedSearch) return true;

      return (
        team.name.toLowerCase().includes(normalizedSearch) ||
        team.country.toLowerCase().includes(normalizedSearch) ||
        team.competition.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [search]);

  const groupedTeams = useMemo(() => {
    const groups = {};

    filteredTeams.forEach((team) => {
      let groupName;

      if (activeFilter === "countries") {
        groupName = team.country;
      } else if (activeFilter === "continents") {
        groupName = team.continent;
      } else if (activeFilter === "reputation") {
        groupName = team.reputation || "Unclassified";
      } else if (activeFilter === "market") {
        groupName = team.market || "Unclassified";
      } else if (activeFilter === "incomplete") {
        if (!team.incomplete) return;
        groupName = "Incomplete information";
      }

      if (!groups[groupName]) {
        groups[groupName] = [];
      }

      groups[groupName].push(team);
    });

    return groups;
  }, [filteredTeams, activeFilter]);

  const hasResults = Object.keys(groupedTeams).length > 0;

  return (
    <div className="min-h-full bg-[#F6F7F9] p-6 md:p-8">

      {/* FILTROS Y BUSCADOR */}

      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">

        <div className="flex flex-wrap items-center gap-2">

          {navigationFilters.map((filter) => {
            const Icon = filter.icon;
            const isActive = activeFilter === filter.id;

            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => setActiveFilter(filter.id)}
                className={`flex h-10 items-center gap-2 rounded-xl border px-4 text-xs font-semibold transition ${
                  isActive
                    ? "border-[#073B35] bg-[#073B35] text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <Icon size={14} strokeWidth={1.8} />
                {filter.label}
              </button>
            );
          })}

        </div>

        {/* BUSCADOR */}

        <div className="relative w-full xl:w-[270px]">
          <Search
            size={17}
            strokeWidth={2}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          />

          <input
            type="text"
            placeholder="Search teams..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#003399] focus:ring-2 focus:ring-[#003399]/10"
          />
        </div>

      </div>

      {/* CONTENIDO AGRUPADO */}

      {hasResults ? (
        <div className="space-y-5">

          {Object.entries(groupedTeams).map(
            ([groupName, teams]) => {
              const competitions = teams.reduce((groups, team) => {
                if (!groups[team.competition]) {
                  groups[team.competition] = [];
                }

                groups[team.competition].push(team);

                return groups;
              }, {});

              return (
                <section
                  key={groupName}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.02)] md:p-5"
                >

                  {/* NOMBRE DEL GRUPO */}

                  <div className="mb-5 flex items-center justify-between gap-4">
                    <h2 className="text-base font-extrabold text-slate-900">
                      {groupName}
                    </h2>

                    <span className="text-xs font-medium text-slate-400">
                      {teams.length}{" "}
                      {teams.length === 1 ? "team" : "teams"}
                    </span>
                  </div>

                  {/* COMPETICIONES */}

                  <div className="space-y-6">

                    {Object.entries(competitions).map(
                      ([competitionName, competitionTeams]) => (
                        <div key={competitionName}>

                          <CompetitionHeader
                            competitionName={competitionName}
                            teams={competitionTeams}
                          />

                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                            {competitionTeams.map((team) => (
                              <TeamCard
                                key={team.id}
                                team={team}
                              />
                            ))}
                          </div>

                        </div>
                      )
                    )}

                  </div>

                </section>
              );
            }
          )}

        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">

          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-50">
            <CircleAlert size={22} className="text-slate-400" />
          </div>

          <h2 className="mt-4 text-base font-bold text-slate-800">
            No teams found
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Try another search or select a different category.
          </p>

          <button
            type="button"
            onClick={() => setSearch("")}
            className="mt-5 rounded-xl bg-[#003399] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#002477]"
          >
            Clear search
          </button>

        </div>
      )}

    </div>
  );
}
