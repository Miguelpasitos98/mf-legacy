import React, { useEffect, useMemo, useState } from "react";
import {
  Globe2,
  Search,
  ChevronRight,
  ArrowLeft,
  Users,
  Shield,
  Trophy,
  CalendarDays,
} from "lucide-react";

import { base44 } from "@/api/base44Client";

const inputClassName =
  "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#003399] focus:ring-2 focus:ring-[#003399]/10";

const getList = (result) => {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  if (Array.isArray(result?.items)) return result.items;
  if (Array.isArray(result?.results)) return result.results;
  return [];
};

const normalizeCountry = (country) => ({
  ...country,
  id:
    country?.id ||
    country?._id ||
    country?.data?.id ||
    "",
  name: country?.name || "",
  code:
    country?.code ||
    country?.country_code ||
    "",
  flag: country?.flag || "",
  continent: country?.continent || "",
});

const normalizePlayer = (player) => ({
  ...player,
  id:
    player?.id ||
    player?._id ||
    player?.data?.id ||
    "",
  name:
    player?.name ||
    player?.full_name ||
    player?.fullName ||
    "",
  countryId:
    player?.country_id ||
    player?.countryId ||
    "",
  teamId:
    player?.team_id ||
    player?.teamId ||
    "",
  photoUrl:
    player?.photo_url ||
    player?.photoUrl ||
    player?.image_url ||
    player?.imageUrl ||
    "",
  dateOfBirth:
    player?.date_of_birth ||
    player?.dateOfBirth ||
    "",
});

const normalizeTeam = (team) => ({
  ...team,
  id:
    team?.id ||
    team?._id ||
    team?.data?.id ||
    "",
  name: team?.name || "",
  shortName: team?.short_name || team?.shortName || "",
  countryId:
    team?.country_id ||
    team?.countryId ||
    "",
  logo:
    team?.logo ||
    team?.logo_url ||
    team?.logoUrl ||
    "",
});

const normalizeLeague = (league) => ({
  ...league,
  id:
    league?.id ||
    league?._id ||
    league?.data?.id ||
    "",
  name: league?.name || "",
  shortName:
    league?.short_name ||
    league?.shortName ||
    "",
  countryId:
    league?.country_id ||
    league?.countryId ||
    "",
  level: league?.level ?? 99,
  logo: league?.logo || "",
});

const normalizeTeamLeague = (relation) => ({
  ...relation,
  teamId:
    relation?.team_id ||
    relation?.teamId ||
    "",
  leagueId:
    relation?.league_id ||
    relation?.leagueId ||
    "",
  season:
    relation?.season ||
    "",
  isCurrent:
    relation?.is_current !== false,
});


const ISO3_TO_ISO2 = {
  ESP: "es",
  DEU: "de",
  GBR: "gb",
  ENG: "gb",
  SAU: "sa",
  BEL: "be",
  BRA: "br",
  ITA: "it",
  FRA: "fr",
  PRT: "pt",
  NLD: "nl",
  ARG: "ar",
  URY: "uy",
  CHL: "cl",
  COL: "co",
  MEX: "mx",
  USA: "us",
  CAN: "ca",
  JPN: "jp",
  KOR: "kr",
  AUS: "au",
  MAR: "ma",
  NGA: "ng",
  CIV: "ci",
  SEN: "sn",
  EGY: "eg",
};

const getFlagUrl = (country) => {
  const rawFlag = String(country?.flag || "").trim();

  if (/^(https?:|data:|blob:)/i.test(rawFlag)) {
    return rawFlag;
  }

  const rawCode = String(country?.code || "").trim().toUpperCase();

  const iso2 =
    rawCode.length === 2
      ? rawCode.toLowerCase()
      : ISO3_TO_ISO2[rawCode] || "";

  if (!iso2) {
    return "";
  }

  return `https://flagcdn.com/w80/${iso2}.png`;
};

const normalizeImageUrl = (value) => {
  const trimmed = String(value || "").trim();

  if (!trimmed) return "";

  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }

  if (/^(https?:|data:|blob:)/i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
};

function PlayerRow({ player, team }) {
  const photoUrl = normalizeImageUrl(player.photoUrl);

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm">
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={player.name || "Player"}
            className="h-full w-full object-cover object-top"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-300">
            <Users size={24} />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-extrabold text-slate-900">
          {player.name || "Unnamed player"}
        </h3>

        <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
          <Shield size={13} />
          <span className="truncate">
            {team?.name || "No club associated"}
          </span>
        </div>

        {player.dateOfBirth && (
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
            <CalendarDays size={13} />
            <span>{player.dateOfBirth}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function TeamCard({ team }) {
  const logoUrl = normalizeImageUrl(team.logo);

  return (
    <div className="flex min-h-[112px] flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-center transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm">
      <div className="flex h-16 w-16 items-center justify-center">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={`${team.name} logo`}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-[10px] font-extrabold text-slate-700">
            {team.shortName || "FC"}
          </div>
        )}
      </div>

      <span className="w-full truncate text-xs font-bold text-slate-800">
        {team.name}
      </span>
    </div>
  );
}

function LeagueSection({ league, teams }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 p-1">
            {league.logo ? (
              <img
                src={normalizeImageUrl(league.logo)}
                alt=""
                className="h-full w-full object-contain"
              />
            ) : (
              <Trophy size={15} className="text-slate-500" />
            )}
          </div>

          <div className="min-w-0">
            <h3 className="truncate text-sm font-extrabold text-slate-900">
              {league.name}
            </h3>

            <p className="mt-0.5 text-xs text-slate-400">
              {league.level === 99
                ? "Competition"
                : `Level ${league.level}`}
            </p>
          </div>
        </div>

        <span className="shrink-0 text-xs font-medium text-slate-400">
          {teams.length} {teams.length === 1 ? "team" : "teams"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-4">
        {teams.map((team) => (
          <TeamCard key={team.id || team.name} team={team} />
        ))}
      </div>
    </section>
  );
}

export default function Countries() {
  const [countries, setCountries] = useState([]);
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [leagues, setLeagues] = useState([]);
  const [teamLeagues, setTeamLeagues] = useState([]);

  const [search, setSearch] = useState("");
  const [selectedCountryId, setSelectedCountryId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const [
          countriesResult,
          playersResult,
          teamsResult,
          leaguesResult,
          teamLeaguesResult,
        ] = await Promise.all([
          base44.entities.Country.list(),
          base44.entities.Player.list(),
          base44.entities.Team.list(),
          base44.entities.League.list(),
          base44.entities.TeamLeague.list(),
        ]);

        setCountries(
          getList(countriesResult)
            .map(normalizeCountry)
            .filter((country) => country.id && country.name)
            .sort((a, b) =>
              a.name.localeCompare(b.name, "es", {
                sensitivity: "base",
              })
            )
        );

        setPlayers(
          getList(playersResult)
            .map(normalizePlayer)
            .filter((player) => player.id || player.name)
        );

        setTeams(
          getList(teamsResult)
            .map(normalizeTeam)
            .filter((team) => team.id && team.name)
        );

        setLeagues(
          getList(leaguesResult)
            .map(normalizeLeague)
            .filter((league) => league.id && league.name)
        );

        setTeamLeagues(
          getList(teamLeaguesResult)
            .map(normalizeTeamLeague)
            .filter(
              (relation) =>
                relation.teamId && relation.leagueId
            )
        );
      } catch (error) {
        console.error("Error loading countries:", error);

        setErrorMessage(
          "No se han podido cargar los países, jugadores, equipos o ligas."
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const filteredCountries = useMemo(() => {
    const normalizedSearch = search.toLowerCase().trim();

    if (!normalizedSearch) {
      return countries;
    }

    return countries.filter((country) =>
      country.name.toLowerCase().includes(normalizedSearch)
    );
  }, [countries, search]);

  const countryById = useMemo(
    () =>
      countries.reduce((map, country) => {
        map[country.id] = country;
        return map;
      }, {}),
    [countries]
  );

  const teamById = useMemo(
    () =>
      teams.reduce((map, team) => {
        map[team.id] = team;
        return map;
      }, {}),
    [teams]
  );

  const leagueById = useMemo(
    () =>
      leagues.reduce((map, league) => {
        map[league.id] = league;
        return map;
      }, {}),
    [leagues]
  );

  const selectedCountry = selectedCountryId
    ? countryById[selectedCountryId]
    : null;

  const selectedCountryPlayers = useMemo(() => {
    if (!selectedCountryId) return [];

    return players
      .filter(
        (player) =>
          String(player.countryId) ===
          String(selectedCountryId)
      )
      .sort((a, b) =>
        (a.name || "").localeCompare(
          b.name || "",
          "es",
          { sensitivity: "base" }
        )
      );
  }, [players, selectedCountryId]);

  const selectedCountryTeams = useMemo(() => {
    if (!selectedCountryId) return [];

    return teams
      .filter(
        (team) =>
          String(team.countryId) ===
          String(selectedCountryId)
      )
      .sort((a, b) =>
        (a.name || "").localeCompare(
          b.name || "",
          "es",
          { sensitivity: "base" }
        )
      );
  }, [teams, selectedCountryId]);

  const groupedTeamsByLeague = useMemo(() => {
    const groups = new Map();

    selectedCountryTeams.forEach((team) => {
      const relations = teamLeagues.filter(
        (relation) =>
          String(relation.teamId) === String(team.id) &&
          relation.isCurrent !== false
      );

      if (relations.length === 0) {
        const key = "__without_league__";

        if (!groups.has(key)) {
          groups.set(key, {
            league: {
              id: key,
              name: "Without league",
              level: 99,
              logo: "",
            },
            teams: [],
          });
        }

        groups.get(key).teams.push(team);
        return;
      }

      relations.forEach((relation) => {
        const league =
          leagueById[relation.leagueId] || {
            id: relation.leagueId,
            name: "Without league",
            level: 99,
            logo: "",
          };

        if (
          String(league.countryId || "") &&
          String(league.countryId) !==
            String(selectedCountryId)
        ) {
          return;
        }

        if (!groups.has(league.id)) {
          groups.set(league.id, {
            league,
            teams: [],
          });
        }

        const group = groups.get(league.id);

        if (!group.teams.some((item) => item.id === team.id)) {
          group.teams.push(team);
        }
      });
    });

    return Array.from(groups.values()).sort((a, b) => {
      const levelA = Number(a.league.level ?? 99);
      const levelB = Number(b.league.level ?? 99);

      if (levelA !== levelB) {
        return levelA - levelB;
      }

      return a.league.name.localeCompare(
        b.league.name,
        "es",
        { sensitivity: "base" }
      );
    });
  }, [
    selectedCountryTeams,
    teamLeagues,
    leagueById,
    selectedCountryId,
  ]);

  if (selectedCountry) {
    return (
      <div className="h-full min-h-0 overflow-y-auto bg-[#E8E9EC] px-6 py-8 md:px-10">
        <div className="mx-auto max-w-[1800px]">
          <button
            type="button"
            onClick={() => setSelectedCountryId(null)}
            className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-[#003399] transition hover:gap-3"
          >
            <ArrowLeft size={16} />
            Volver a países
          </button>

          <div className="mb-8 flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-6 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-5">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#F1F5F9]">
                {getFlagUrl(selectedCountry) ? (
                  <img
                    src={getFlagUrl(selectedCountry)}
                    alt={`Bandera de ${selectedCountry.name}`}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <span className="text-4xl">
                    {selectedCountry.flag || "🏳️"}
                  </span>
                )}
              </div>

              <div className="min-w-0">
                <p className="mb-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                  MF LEGACY
                </p>

                <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
                  {selectedCountry.name}
                </h1>

                <p className="mt-1 text-sm text-slate-500">
                  {selectedCountry.continent || "Country"}
                  {selectedCountry.code
                    ? ` · ${selectedCountry.code}`
                    : ""}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="rounded-xl bg-[#F1F5F9] px-4 py-3 text-center">
                <div className="text-lg font-extrabold text-slate-900">
                  {selectedCountryPlayers.length}
                </div>
                <div className="text-[11px] text-slate-500">
                  players
                </div>
              </div>

              <div className="rounded-xl bg-[#F1F5F9] px-4 py-3 text-center">
                <div className="text-lg font-extrabold text-slate-900">
                  {selectedCountryTeams.length}
                </div>
                <div className="text-[11px] text-slate-500">
                  teams
                </div>
              </div>
            </div>
          </div>

          {/* PLAYERS FIRST */}
          <section className="mb-10">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Players
                </p>
                <h2 className="text-xl font-extrabold text-slate-900">
                  Jugadores de {selectedCountry.name}
                </h2>
              </div>

              <span className="text-xs font-medium text-slate-400">
                {selectedCountryPlayers.length}{" "}
                {selectedCountryPlayers.length === 1
                  ? "jugador"
                  : "jugadores"}
              </span>
            </div>

            {selectedCountryPlayers.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {selectedCountryPlayers.map((player) => (
                  <PlayerRow
                    key={
                      player.id ||
                      `${player.name}-${player.teamId}`
                    }
                    player={player}
                    team={teamById[player.teamId]}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-10 text-center">
                <Users
                  size={32}
                  className="mx-auto mb-3 text-slate-300"
                />
                <p className="text-sm font-semibold text-slate-700">
                  No hay jugadores registrados
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Los jugadores asociados a este país aparecerán aquí.
                </p>
              </div>
            )}
          </section>

          {/* TEAMS SECOND */}
          <section className="pb-8">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Teams
                </p>
                <h2 className="text-xl font-extrabold text-slate-900">
                  Equipos de {selectedCountry.name}
                </h2>
              </div>

              <span className="text-xs font-medium text-slate-400">
                {selectedCountryTeams.length}{" "}
                {selectedCountryTeams.length === 1
                  ? "equipo"
                  : "equipos"}
              </span>
            </div>

            {groupedTeamsByLeague.length > 0 ? (
              <div className="space-y-4">
                {groupedTeamsByLeague.map((group) => (
                  <LeagueSection
                    key={group.league.id}
                    league={group.league}
                    teams={group.teams}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-10 text-center">
                <Shield
                  size={32}
                  className="mx-auto mb-3 text-slate-300"
                />
                <p className="text-sm font-semibold text-slate-700">
                  No hay equipos registrados
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Los equipos asociados a este país aparecerán aquí.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-[#E8E9EC] px-6 py-8 md:px-10">
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
              Explora los países y sus jugadores, equipos y competiciones.
            </p>
          </div>

          <div className="hidden rounded-xl bg-[#003399] px-4 py-3 text-sm font-semibold text-white md:block">
            {countries.length} países
          </div>
        </div>

        <div className="mb-6 flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm">
          <Search
            size={19}
            className="shrink-0 text-[#94A3B8]"
          />

          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar país..."
            className="w-full bg-transparent text-sm text-[#0F172A] outline-none placeholder:text-[#94A3B8]"
          />
        </div>

        {errorMessage && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-[106px] animate-pulse rounded-2xl border border-slate-200 bg-white"
              />
            ))}
          </div>
        ) : filteredCountries.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredCountries.map((country) => {
              const countryPlayers = players.filter(
                (player) =>
                  String(player.countryId) ===
                  String(country.id)
              );

              const countryTeams = teams.filter(
                (team) =>
                  String(team.countryId) ===
                  String(country.id)
              );

              const countryLeagueIds = new Set(
                teamLeagues
                  .filter((relation) =>
                    countryTeams.some(
                      (team) =>
                        String(team.id) ===
                        String(relation.teamId)
                    )
                  )
                  .map((relation) => relation.leagueId)
              );

              return (
                <button
                  key={country.id}
                  type="button"
                  onClick={() =>
                    setSelectedCountryId(country.id)
                  }
                  className="group flex items-center gap-4 rounded-2xl border border-white/70 bg-white p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
                >
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#F1F5F9]">
                    {getFlagUrl(country) ? (
                      <img
                        src={getFlagUrl(country)}
                        alt={`Bandera de ${country.name}`}
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <span className="text-4xl">
                        {country.flag || "🏳️"}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-bold text-[#0F172A]">
                      {country.name}
                    </h2>

                    <p className="mt-1 text-xs text-[#64748B]">
                      {countryLeagueIds.size}{" "}
                      {countryLeagueIds.size === 1
                        ? "liga"
                        : "ligas"}{" "}
                      · {countryTeams.length}{" "}
                      {countryTeams.length === 1
                        ? "equipo"
                        : "equipos"}{" "}
                      · {countryPlayers.length}{" "}
                      {countryPlayers.length === 1
                        ? "jugador"
                        : "jugadores"}
                    </p>
                  </div>

                  <ChevronRight
                    size={20}
                    className="shrink-0 text-[#94A3B8] transition-transform group-hover:translate-x-1"
                  />
                </button>
              );
            })}
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
