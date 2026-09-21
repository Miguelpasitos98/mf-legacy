
import React, { useMemo, useState } from "react";
import { Globe2, Search, ChevronRight } from "lucide-react";

const countries = [
  {
    id: "spain",
    name: "España",
    code: "ES",
    flag: "🇪🇸",
    leagues: 2,
    teams: 8,
    players: 2,
  },
  {
    id: "germany",
    name: "Alemania",
    code: "DE",
    flag: "🇩🇪",
    leagues: 1,
    teams: 4,
    players: 1,
  },
  {
    id: "england",
    name: "Inglaterra",
    code: "EN",
    flag: "🏴",
    leagues: 1,
    teams: 3,
    players: 0,
  },
  {
    id: "saudi-arabia",
    name: "Arabia Saudí",
    code: "SA",
    flag: "🇸🇦",
    leagues: 1,
    teams: 2,
    players: 0,
  },
  {
    id: "belgium",
    name: "Bélgica",
    code: "BE",
    flag: "🇧🇪",
    leagues: 1,
    teams: 1,
    players: 0,
  },
  {
    id: "brazil",
    name: "Brasil",
    code: "BR",
    flag: "🇧🇷",
    leagues: 1,
    teams: 1,
    players: 0,
  },
];

export default function Countries() {
  const [search, setSearch] = useState("");

  const filteredCountries = useMemo(() => {
    const normalizedSearch = search.toLowerCase().trim();

    if (!normalizedSearch) {
      return countries;
    }

    return countries.filter((country) =>
      country.name.toLowerCase().includes(normalizedSearch)
    );
  }, [search]);

  return (
    <div className="min-h-full px-6 py-8 md:px-10">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-[#64748B]">
              MF LEGACY
            </p>

            <h1 className="text-3xl font-bold tracking-tight text-[#0F172A]">
              Países
            </h1>

            <p className="mt-2 text-sm text-[#64748B]">
              Explora los países y sus competiciones, equipos y jugadores.
            </p>
          </div>

          <div className="hidden rounded-xl bg-[#003399] px-4 py-3 text-sm font-semibold text-white md:block">
            {countries.length} países
          </div>
        </div>

        <div className="mb-6 flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm">
          <Search size={19} className="shrink-0 text-[#94A3B8]" />

          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar país..."
            className="w-full bg-transparent text-sm text-[#0F172A] outline-none placeholder:text-[#94A3B8]"
          />
        </div>

        {filteredCountries.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredCountries.map((country) => (
              <button
                key={country.id}
                type="button"
                className="group flex items-center gap-4 rounded-2xl border border-white/70 bg-white p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
              >
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#F1F5F9] text-4xl">
                  {country.flag}
                </div>

                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-bold text-[#0F172A]">
                    {country.name}
                  </h2>

                  <p className="mt-1 text-xs text-[#64748B]">
                    {country.leagues}{" "}
                    {country.leagues === 1 ? "liga" : "ligas"} ·{" "}
                    {country.teams}{" "}
                    {country.teams === 1 ? "equipo" : "equipos"} ·{" "}
                    {country.players}{" "}
                    {country.players === 1 ? "jugador" : "jugadores"}
                  </p>
                </div>

                <ChevronRight
                  size={20}
                  className="shrink-0 text-[#94A3B8] transition-transform group-hover:translate-x-1"
                />
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[#CBD5E1] bg-white/50 p-12 text-center">
            <Globe2
              size={36}
              className="mx-auto mb-3 text-[#94A3B8]"
            />

            <h2 className="text-lg font-semibold text-[#0F172A]">
              No se han encontrado países
            </h2>

            <p className="mt-2 text-sm text-[#64748B]">
              Prueba con otro nombre.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
