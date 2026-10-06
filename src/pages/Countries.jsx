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
  Plus,
  X,
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

  const [countryModalOpen, setCountryModalOpen] = useState(false);
  const [countryModalContinent, setCountryModalContinent] = useState("Europe");
  const [isCreatingCountry, setIsCreatingCountry] = useState(false);
  const [countryFormError, setCountryFormError] = useState("");
  const [countryForm, setCountryForm] = useState({
    name: "",
    code: "",
    flag: "",
  });

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

  const continentOrder = [
    "Europe",
    "South America",
    "North America",
    "Asia",
    "Africa",
    "Oceania",
  ];

  const continentLabels = {
    Europe: "Europa",
    "South America": "Sudamérica",
    "North America": "Norteamérica",
    Asia: "Asia",
    Africa: "África",
    Oceania: "Oceanía",
    "Unknown": "Sin continente",
  };

  const groupedCountriesByContinent = useMemo(() => {
    const groups = new Map();

    filteredCountries.forEach((country) => {
      const continent = String(country?.continent || "").trim() || "Unknown";

      if (!groups.has(continent)) {
        groups.set(continent, []);
      }

      groups.get(continent).push(country);
    });

    for (const list of groups.values()) {
      list.sort((a, b) =>
        (a.name || "").localeCompare(b.name || "", "es", {
          sensitivity: "base",
        })
      );
    }

    return Array.from(groups.entries()).sort(([continentA], [continentB]) => {
      const indexA =
        continentOrder.indexOf(continentA) === -1
          ? continentOrder.length
          : continentOrder.indexOf(continentA);
      const indexB =
        continentOrder.indexOf(continentB) === -1
          ? continentOrder.length
          : continentOrder.indexOf(continentB);

      if (indexA !== indexB) {
        return indexA - indexB;
      }

      return (continentLabels[continentA] || continentA).localeCompare(
        continentLabels[continentB] || continentB,
        "es",
        { sensitivity: "base" }
      );
    });
  }, [filteredCountries]);

  const openCountryModal = (continent) => {
    setCountryModalContinent(continent);
    setCountryForm({
      name: "",
      code: "",
      flag: "",
    });
    setCountryFormError("");
    setCountryModalOpen(true);
  };

  const closeCountryModal = () => {
    if (isCreatingCountry) return;

    setCountryModalOpen(false);
    setCountryFormError("");
  };

  const handleCreateCountry = async (event) => {
    event.preventDefault();

    const name = String(countryForm.name || "").trim();
    const code = String(countryForm.code || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .slice(0, 3);
    const flag = String(countryForm.flag || "").trim();

    if (!name) {
      setCountryFormError("El nombre del país es obligatorio.");
      return;
    }

    const existingCountry = countries.find(
      (country) =>
        String(country?.name || "").trim().toLocaleLowerCase("es") ===
        name.toLocaleLowerCase("es")
    );

    if (existingCountry) {
      setCountryFormError("Ese país ya existe en la base de datos.");
      return;
    }

    setIsCreatingCountry(true);
    setCountryFormError("");

    try {
      const generatedCode =
        code ||
        name
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toUpperCase()
          .replace(/[^A-Z]/g, "")
          .slice(0, 3)
          .padEnd(3, "X");

      const created = await base44.entities.Country.create({
        name,
        code: generatedCode,
        continent: countryModalContinent,
        flag,
        is_active: true,
      });

      const createdCountry = normalizeCountry(created?.data || created);

      if (!createdCountry.id) {
        throw new Error("El país se creó pero Base44 no devolvió su ID.");
      }

      setCountries((current) =>
        [...current, createdCountry].sort((a, b) =>
          (a.name || "").localeCompare(b.name || "", "es", {
            sensitivity: "base",
          })
        )
      );

      setCountryModalOpen(false);
      setCountryForm({
        name: "",
        code: "",
        flag: "",
      });
    } catch (error) {
      console.error("Error creating country:", error);
      setCountryFormError(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          error?.message ||
          "No se ha podido crear el país."
      );
    } finally {
      setIsCreatingCountry(false);
    }
  };

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
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-[#F1F5F9] text-5xl">
                {selectedCountry.flag || "🏳️"}
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
      <div className="mx-auto max-w-[1700px]">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-[#64748B]">
              MF LEGACY
            </p>

            <h1 className="text-3xl font-bold tracking-tight text-[#0F172A]">
              Países
            </h1>

            <p className="mt-2 text-sm text-[#64748B]">
              Explora los países organizados por continentes.
            </p>
          </div>

          <div className="rounded-xl bg-[#003399] px-4 py-3 text-sm font-semibold text-white">
            {countries.length} países
          </div>
        </div>

        <div className="mb-7 flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm">
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
          <div className="space-y-7">
            {Array.from({ length: 3 }).map((_, index) => (
              <section key={index}>
                <div className="mb-3 h-7 w-48 animate-pulse rounded-lg bg-slate-200" />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 3 }).map((__, cardIndex) => (
                    <div
                      key={cardIndex}
                      className="h-[106px] animate-pulse rounded-2xl border border-slate-200 bg-white"
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : groupedCountriesByContinent.length > 0 ? (
          <div className="space-y-7">
            {groupedCountriesByContinent.map(([continent, continentCountries]) => (
              <section key={continent}>
                <div className="mb-3 flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-end gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#94A3B8]">
                        Continente
                      </p>
                      <h2 className="text-xl font-extrabold tracking-tight text-[#0F172A]">
                        {continentLabels[continent] || continent}
                      </h2>
                    </div>

                    <span className="pb-0.5 text-xs font-medium text-[#94A3B8]">
                      {continentCountries.length}{" "}
                      {continentCountries.length === 1 ? "país" : "países"}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => openCountryModal(continent)}
                    className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#003399] px-3.5 py-2.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-[#002477] hover:shadow-md"
                  >
                    <Plus size={15} />
                    Añadir bandera
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {continentCountries.map((country) => {
                    const countryPlayers = players.filter(
                      (player) =>
                        String(player.countryId) === String(country.id)
                    );

                    const countryTeams = teams.filter(
                      (team) =>
                        String(team.countryId) === String(country.id)
                    );

                    const countryLeagueIds = new Set(
                      teamLeagues
                        .filter((relation) =>
                          countryTeams.some(
                            (team) =>
                              String(team.id) === String(relation.teamId)
                          )
                        )
                        .map((relation) => relation.leagueId)
                    );

                    return (
                      <button
                        key={country.id}
                        type="button"
                        onClick={() => setSelectedCountryId(country.id)}
                        className="group flex items-center gap-4 rounded-2xl border border-white/70 bg-white p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
                      >
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#F1F5F9] text-4xl">
                          {String(country.flag || "").startsWith("http") ? (
                            <img
                              src={normalizeImageUrl(country.flag)}
                              alt={`Bandera de ${country.name}`}
                              className="max-h-full max-w-full object-contain"
                            />
                          ) : (
                            <span>{country.flag || "🏳️"}</span>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <h2 className="text-lg font-bold text-[#0F172A]">
                            {country.name}
                          </h2>

                          <p className="mt-1 text-xs text-[#64748B]">
                            {countryLeagueIds.size}{" "}
                            {countryLeagueIds.size === 1 ? "liga" : "ligas"}{" "}
                            · {countryTeams.length}{" "}
                            {countryTeams.length === 1 ? "equipo" : "equipos"}{" "}
                            · {countryPlayers.length}{" "}
                            {countryPlayers.length === 1 ? "jugador" : "jugadores"}
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
              </section>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[#CBD5E1] bg-white/50 p-12 text-center">
            <Globe2
              size={36}
              className="mx-auto mb-3 text-[#94A3B8]"
            />

            <h2 className="text-lg font-semibold text-[#0F172A]">
              {search
                ? "No se han encontrado países"
                : "No hay países registrados"}
            </h2>

            <p className="mt-2 text-sm text-[#64748B]">
              {search
                ? "Prueba con otro nombre."
                : "Añade una bandera desde el continente correspondiente."}
            </p>
          </div>
        )}
      </div>

      {countryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  {continentLabels[countryModalContinent] || countryModalContinent}
                </p>
                <h2 className="mt-1 text-xl font-extrabold text-slate-900">
                  Añadir bandera
                </h2>
              </div>

              <button
                type="button"
                onClick={closeCountryModal}
                disabled={isCreatingCountry}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
                aria-label="Cerrar"
              >
                <X size={17} />
              </button>
            </div>

            <form onSubmit={handleCreateCountry} className="p-6">
              {countryFormError && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {countryFormError}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Nombre del país
                  </label>
                  <input
                    type="text"
                    value={countryForm.name}
                    onChange={(event) =>
                      setCountryForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="Ej. Marruecos"
                    className={inputClassName}
                    autoFocus
                    disabled={isCreatingCountry}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Código ISO
                  </label>
                  <input
                    type="text"
                    value={countryForm.code}
                    onChange={(event) =>
                      setCountryForm((current) => ({
                        ...current,
                        code: event.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="Ej. MAR"
                    maxLength={3}
                    className={inputClassName}
                    disabled={isCreatingCountry}
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    Opcional. Si lo dejas vacío, se genera automáticamente.
                  </p>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Bandera
                  </label>
                  <input
                    type="text"
                    value={countryForm.flag}
                    onChange={(event) =>
                      setCountryForm((current) => ({
                        ...current,
                        flag: event.target.value,
                      }))
                    }
                    placeholder="Emoji o URL de la bandera"
                    className={inputClassName}
                    disabled={isCreatingCountry}
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    Puedes usar un emoji (🇲🇦) o una URL de imagen.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeCountryModal}
                  disabled={isCreatingCountry}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isCreatingCountry}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#003399] px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-[#002477] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus size={16} />
                  {isCreatingCountry ? "Guardando..." : "Añadir bandera"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
