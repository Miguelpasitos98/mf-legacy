import React, { useMemo, useState } from "react";
import {
  Globe2,
  Search,
  ChevronRight,
  ArrowLeft,
  Users,
  Shield,
  Trophy,
  CalendarDays,
  Pencil,
  RefreshCw,
} from "lucide-react";

import { useQueryClient } from "@tanstack/react-query";
import {
  useCountriesQuery,
  usePlayersQuery,
  useTeamsQuery,
  useLeaguesQuery,
  useTeamLeaguesQuery,
} from "@/hooks/useSharedData";
import { base44 } from "@/api/base44Client";
import FlagSyncModal from "@/components/countries/FlagSyncModal";

const inputClassName =
  "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#003399] focus:ring-2 focus:ring-[#003399]/10";

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

const ISO3_TO_ISO2 = {
  ESP: "es", DEU: "de", GBR: "gb", ENG: "gb", SAU: "sa", BEL: "be", BRA: "br",
  ITA: "it", FRA: "fr", PRT: "pt", NLD: "nl", POL: "pl", ARG: "ar", URY: "uy",
  CHL: "cl", COL: "co", MEX: "mx", USA: "us", CAN: "ca", JPN: "jp", KOR: "kr",
  AUS: "au", MAR: "ma", NGA: "ng", CIV: "ci", SEN: "sn", EGY: "eg", GEO: "ge", HUN: "hu",
};

const getFlagUrl = (country) => {
  const rawFlag = String(country?.flag || "").trim();
  if (/^(https?:|data:|blob:)/i.test(rawFlag)) return rawFlag;

  const code = String(country?.code || "").trim().toUpperCase();
  const iso2 = code.length === 2 ? code.toLowerCase() : ISO3_TO_ISO2[code] || "";
  return iso2 ? `https://flagcdn.com/w80/${iso2}.png` : "";
};

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
  leagueId:
    team?.league_id ||
    team?.leagueId ||
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

const PlayerRow = React.memo(function PlayerRow({ player, team }) {
  const photoUrl = normalizeImageUrl(player.photoUrl);

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm">
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={player.name || "Player"}
            className="h-full w-full object-cover object-top"
            loading="lazy"
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
});

const TeamCard = React.memo(function TeamCard({ team }) {
  const logoUrl = normalizeImageUrl(team.logo);

  return (
    <div className="flex min-h-[112px] flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-center transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm">
      <div className="flex h-16 w-16 items-center justify-center">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={`${team.name} logo`}
            className="h-full w-full object-contain"
            loading="lazy"
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
});

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
                loading="lazy"
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

const CONTINENT_OPTIONS = [
  { value: "Europe", label: "Europa" },
  { value: "South America", label: "Sudamérica" },
  { value: "North America", label: "Norteamérica" },
  { value: "Asia", label: "Asia" },
  { value: "Africa", label: "África" },
  { value: "Oceania", label: "Oceanía" },
];

const CONTINENT_ORDER = [
  "Europe",
  "South America",
  "North America",
  "Asia",
  "Africa",
  "Oceania",
];

const CONTINENT_LABELS = {
  Europe: "Europa",
  "South America": "Sudamérica",
  "North America": "Norteamérica",
  Asia: "Asia",
  Africa: "África",
  Oceania: "Oceanía",
};

export default function Countries() {
  const queryClient = useQueryClient();
  const countriesQuery = useCountriesQuery();
  const playersQuery = usePlayersQuery();
  const teamsQuery = useTeamsQuery();
  const leaguesQuery = useLeaguesQuery();
  const teamLeaguesQuery = useTeamLeaguesQuery();

  const [search, setSearch] = useState("");
  const [selectedCountryId, setSelectedCountryId] = useState(null);
  const [editCountryOpen, setEditCountryOpen] = useState(false);
  const [editCountryForm, setEditCountryForm] = useState({
    flag: "",
    continent: "Europe",
  });
  const [isSavingCountry, setIsSavingCountry] = useState(false);
  const [countryEditError, setCountryEditError] = useState("");
  const [flagSyncOpen, setFlagSyncOpen] = useState(false);

  // --- DERIVED DATA FROM SHARED CACHE (synchronous, no flash) ---

  const countries = useMemo(
    () =>
      (countriesQuery.data || [])
        .map(normalizeCountry)
        .filter((country) => country.id && country.name)
        .sort((a, b) =>
          a.name.localeCompare(b.name, "es", { sensitivity: "base" })
        ),
    [countriesQuery.data]
  );

  const players = useMemo(
    () =>
      (playersQuery.data || [])
        .map(normalizePlayer)
        .filter((player) => player.id || player.name),
    [playersQuery.data]
  );

  const teams = useMemo(
    () =>
      (teamsQuery.data || [])
        .map(normalizeTeam)
        .filter((team) => team.id && team.name),
    [teamsQuery.data]
  );

  const leagues = useMemo(
    () =>
      (leaguesQuery.data || [])
        .map(normalizeLeague)
        .filter((league) => league.id && league.name),
    [leaguesQuery.data]
  );

  const teamLeagues = useMemo(
    () =>
      (teamLeaguesQuery.data || [])
        .map(normalizeTeamLeague)
        .filter((relation) => relation.teamId && relation.leagueId),
    [teamLeaguesQuery.data]
  );

  // --- LOADING STATES (each query is independent) ---

  const countriesLoading = countriesQuery.isLoading && !countriesQuery.data;
  const countriesError = countriesQuery.error && !countriesQuery.data;
  const playersLoading = playersQuery.isLoading && !playersQuery.data;
  const playersError = playersQuery.error && !playersQuery.data;
  const playersStaleError = playersQuery.error && playersQuery.data;
  const teamsLoading = teamsQuery.isLoading && !teamsQuery.data;
  const teamsError = teamsQuery.error && !teamsQuery.data;
  const teamsStaleError = teamsQuery.error && teamsQuery.data;
  const teamRelationsLoading =
    teamsLoading ||
    (leaguesQuery.isLoading && !leaguesQuery.data) ||
    (teamLeaguesQuery.isLoading && !teamLeaguesQuery.data);
  const teamRelationsError =
    teamsError ||
    (leaguesQuery.error && !leaguesQuery.data) ||
    (teamLeaguesQuery.error && !teamLeaguesQuery.data);
  const teamRelationsStaleError =
    teamsStaleError ||
    (leaguesQuery.error && leaguesQuery.data) ||
    (teamLeaguesQuery.error && teamLeaguesQuery.data);

  // --- LOOKUP MAPS (O(1) access) ---

  const filteredCountries = useMemo(() => {
    const normalizedSearch = search.toLowerCase().trim();

    if (!normalizedSearch) {
      return countries;
    }

    return countries.filter((country) =>
      country.name.toLowerCase().includes(normalizedSearch)
    );
  }, [countries, search]);

  const countryById = useMemo(() => {
    const map = new Map();
    for (const country of countries) {
      map.set(String(country.id), country);
    }
    return map;
  }, [countries]);

  const teamById = useMemo(() => {
    const map = new Map();
    for (const team of teams) {
      map.set(String(team.id), team);
    }
    return map;
  }, [teams]);

  const leagueById = useMemo(() => {
    const map = new Map();
    for (const league of leagues) {
      map.set(String(league.id), league);
    }
    return map;
  }, [leagues]);

  // Player counts per countryId — single pass over players (replaces per-card filter).
  const playerCountByCountryId = useMemo(() => {
    const map = new Map();
    for (const player of players) {
      const key = String(player.countryId || "");
      if (!key) continue;
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [players]);

  // TeamLeague index by teamId — single pass (replaces per-team filter).
  const teamLeagueIndex = useMemo(() => {
    const map = new Map();
    for (const relation of teamLeagues) {
      const key = String(relation.teamId || "");
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(relation);
    }
    return map;
  }, [teamLeagues]);

  const selectedCountry = selectedCountryId
    ? countryById.get(String(selectedCountryId))
    : null;

  const handleOpenEditCountry = () => {
    if (!selectedCountry) return;

    setEditCountryForm({
      flag:
        /^(https?:|data:|blob:)/i.test(String(selectedCountry.flag || "").trim())
          ? String(selectedCountry.flag || "").trim()
          : "",
      continent: selectedCountry.continent || "Europe",
    });
    setCountryEditError("");
    setEditCountryOpen(true);
  };

  const handleCloseEditCountry = () => {
    if (isSavingCountry) return;
    setEditCountryOpen(false);
    setCountryEditError("");
  };

  const handleSaveCountry = async () => {
    if (!selectedCountry?.id || isSavingCountry) return;

    const continent = String(editCountryForm.continent || "").trim();
    const flag = String(editCountryForm.flag || "").trim();

    if (!CONTINENT_OPTIONS.some((option) => option.value === continent)) {
      setCountryEditError("Selecciona un continente válido.");
      return;
    }

    if (flag && !/^(https?:|data:|blob:)/i.test(flag)) {
      setCountryEditError("La bandera debe ser una URL de imagen válida.");
      return;
    }

    setIsSavingCountry(true);
    setCountryEditError("");

    try {
      await base44.entities.Country.update(selectedCountry.id, {
        flag,
        continent,
      });

      // Update the shared cache immediately so Players and Teams see the same
      // values without waiting for a background refetch.
      queryClient.setQueryData(["mf-legacy", "countries"], (oldData) => {
        const list = Array.isArray(oldData) ? oldData : [];
        return list.map((country) =>
          String(country?.id || country?._id || "") ===
          String(selectedCountry.id)
            ? { ...country, flag, continent }
            : country
        );
      });

      // Background refetch to guarantee server consistency.
      queryClient.invalidateQueries({ queryKey: ["mf-legacy", "countries"] });

      setEditCountryOpen(false);
    } catch (error) {
      console.error("Error updating country:", error);
      setCountryEditError(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          error?.message ||
          "No se ha podido actualizar el país."
      );
    } finally {
      setIsSavingCountry(false);
    }
  };

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
    const normalizeForCompare = (value) =>
      String(value || "")
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();

    const normalizedSelectedId = normalizeForCompare(selectedCountryId);
    const normalizedSelectedName = normalizeForCompare(selectedCountry?.name || "");

    const matchesSelectedCountry = (leagueCountryId) => {
      const raw = String(leagueCountryId || "").trim();
      if (!raw) return true;
      const normalized = normalizeForCompare(raw);
      return (
        normalized === normalizedSelectedId ||
        normalized === normalizedSelectedName
      );
    };

    const groups = new Map();

    selectedCountryTeams.forEach((team) => {
      // Primary: Team.league_id. Complement: TeamLeague relations.
      const leagueIds = new Set();
      if (team.leagueId) leagueIds.add(String(team.leagueId));

      const relations = (teamLeagueIndex.get(String(team.id)) || []).filter(
        (relation) => relation.isCurrent !== false
      );
      for (const relation of relations) {
        if (relation.leagueId) leagueIds.add(String(relation.leagueId));
      }

      if (leagueIds.size === 0) {
        const key = "__without_league__";
        if (!groups.has(key)) {
          groups.set(key, {
            league: { id: key, name: "Without league", level: 99, logo: "" },
            teams: [],
          });
        }
        groups.get(key).teams.push(team);
        return;
      }

      let addedToAnyGroup = false;

      leagueIds.forEach((leagueId) => {
        const league = leagueById.get(leagueId) || {
          id: leagueId,
          name: "Without league",
          level: 99,
          logo: "",
        };

        if (!matchesSelectedCountry(league.countryId)) return;

        if (!groups.has(league.id)) {
          groups.set(league.id, { league, teams: [] });
        }

        const group = groups.get(league.id);
        if (!group.teams.some((item) => item.id === team.id)) {
          group.teams.push(team);
        }
        addedToAnyGroup = true;
      });

      // Safety net: if every league was filtered by country, keep the team visible.
      if (!addedToAnyGroup) {
        const key = "__without_league__";
        if (!groups.has(key)) {
          groups.set(key, {
            league: { id: key, name: "Without league", level: 99, logo: "" },
            teams: [],
          });
        }
        const group = groups.get(key);
        if (!group.teams.some((item) => item.id === team.id)) {
          group.teams.push(team);
        }
      }
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
    teamLeagueIndex,
    leagueById,
    selectedCountryId,
    selectedCountry,
  ]);

  const groupedCountriesByContinent = useMemo(() => {
    const groups = new Map();

    filteredCountries.forEach((country) => {
      const rawContinent = String(country?.continent || "").trim();
      const continent = CONTINENT_ORDER.includes(rawContinent)
        ? rawContinent
        : "Other";

      if (!groups.has(continent)) {
        groups.set(continent, []);
      }

      groups.get(continent).push(country);
    });

    return Array.from(groups.entries())
      .sort((a, b) => {
        const ia = CONTINENT_ORDER.indexOf(a[0]);
        const ib = CONTINENT_ORDER.indexOf(b[0]);
        if (a[0] === "Other") return 1;
        if (b[0] === "Other") return -1;
        return ia - ib;
      })
      .map(([continent, items]) => ({
        continent,
        label: CONTINENT_LABELS[continent] || "Otros",
        countries: items.sort((a, b) =>
          a.name.localeCompare(b.name, "es", { sensitivity: "base" })
        ),
      }));
  }, [filteredCountries]);

  if (selectedCountry) {
    return (
      <div className="mf-page-scroll bg-[#E8E9EC] px-4 py-6 sm:px-6 sm:py-8 md:px-10">
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
                {getFlagUrl(selectedCountry) ? (
                  <img
                    src={getFlagUrl(selectedCountry)}
                    alt={`Bandera de ${selectedCountry.name}`}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  selectedCountry.flag || "🏳️"
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

            <div className="flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleOpenEditCountry}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <Pencil size={15} />
                Editar
              </button>

              <div className="rounded-xl bg-[#F1F5F9] px-4 py-3 text-center">
                <div className="text-lg font-extrabold text-slate-900">
                  {playersLoading || playersError ? "—" : selectedCountryPlayers.length}
                </div>
                <div className="text-[11px] text-slate-500">
                  players
                </div>
              </div>

              <div className="rounded-xl bg-[#F1F5F9] px-4 py-3 text-center">
                <div className="text-lg font-extrabold text-slate-900">
                  {teamsLoading || teamsError ? "—" : selectedCountryTeams.length}
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
                {playersLoading || playersError ? "—" : `${selectedCountryPlayers.length} ${selectedCountryPlayers.length === 1 ? "jugador" : "jugadores"}`}
              </span>
            </div>

            {playersLoading ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-20 animate-pulse rounded-2xl border border-slate-200 bg-white"
                  />
                ))}
              </div>
            ) : playersError ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
                <Users size={28} className="mx-auto mb-3 text-red-300" />
                <p className="text-sm font-semibold text-red-700">
                  No se han podido cargar los jugadores.
                </p>
                <p className="mt-1 text-xs text-red-400">
                  Comprueba tu conexión e inténtalo de nuevo.
                </p>
              </div>
            ) : (
              <>
                {playersStaleError && (
                  <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    No se ha podido actualizar la lista de jugadores. Mostrando datos guardados.
                  </div>
                )}
                {selectedCountryPlayers.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {selectedCountryPlayers.map((player) => (
                      <PlayerRow
                        key={
                          player.id ||
                          `${player.name}-${player.teamId}`
                        }
                        player={player}
                        team={teamById.get(String(player.teamId))}
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
              </>
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
                {teamRelationsLoading || teamRelationsError ? "—" : `${selectedCountryTeams.length} ${selectedCountryTeams.length === 1 ? "equipo" : "equipos"}`}
              </span>
            </div>

            {teamRelationsLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 2 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-white"
                  />
                ))}
              </div>
            ) : teamRelationsError ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
                <Shield size={28} className="mx-auto mb-3 text-red-300" />
                <p className="text-sm font-semibold text-red-700">
                  No se han podido cargar los equipos.
                </p>
                <p className="mt-1 text-xs text-red-400">
                  Comprueba tu conexión e inténtalo de nuevo.
                </p>
              </div>
            ) : (
              <>
                {teamRelationsStaleError && (
                  <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    No se ha podido actualizar la lista de equipos. Mostrando datos guardados.
                  </div>
                )}
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
              </>
            )}
          </section>

          {editCountryOpen && (
            <div className="mf-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[2px]">
              <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                      MF LEGACY
                    </p>
                    <h2 className="mt-1 text-xl font-extrabold text-slate-900">
                      Editar {selectedCountry.name}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Modifica la bandera y el continente del país.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleCloseEditCountry}
                    className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50"
                    aria-label="Cerrar"
                  >
                    <ChevronRight size={16} className="rotate-45" />
                  </button>
                </div>

                <div className="space-y-5 px-6 py-6">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                      Bandera
                    </label>

                    <div className="flex gap-3">
                      <div className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#F1F5F9]">
                        {editCountryForm.flag ? (
                          <img
                            src={editCountryForm.flag}
                            alt={`Vista previa de la bandera de ${selectedCountry.name}`}
                            className="h-full w-full object-contain"
                            onError={(event) => {
                              event.currentTarget.style.display = "none";
                            }}
                          />
                        ) : (
                          <span className="text-2xl">🏳️</span>
                        )}
                      </div>

                      <input
                        type="url"
                        value={editCountryForm.flag}
                        onChange={(event) =>
                          setEditCountryForm((current) => ({
                            ...current,
                            flag: event.target.value,
                          }))
                        }
                        placeholder="https://.../flag.png"
                        className={`${inputClassName} min-w-0 flex-1`}
                      />
                    </div>

                    <p className="mt-1.5 text-[11px] text-slate-400">
                      Introduce la URL de la imagen de la bandera.
                    </p>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                      Continente
                    </label>
                    <select
                      value={editCountryForm.continent}
                      onChange={(event) =>
                        setEditCountryForm((current) => ({
                          ...current,
                          continent: event.target.value,
                        }))
                      }
                      className={inputClassName}
                    >
                      {CONTINENT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {countryEditError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {countryEditError}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
                  <button
                    type="button"
                    onClick={handleCloseEditCountry}
                    disabled={isSavingCountry}
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveCountry}
                    disabled={isSavingCountry}
                    className="rounded-xl bg-[#003399] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#002477] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSavingCountry ? "Guardando..." : "Guardar cambios"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mf-page-scroll bg-[#E8E9EC] px-4 py-6 sm:px-6 sm:py-8 md:px-10">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
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

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setFlagSyncOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <RefreshCw size={14} />
              Sync Flags
            </button>
            <div className="hidden rounded-xl bg-[#003399] px-4 py-3 text-sm font-semibold text-white md:block">
              {countries.length} países
            </div>
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
            className="min-w-0 w-full bg-transparent text-sm text-[#0F172A] outline-none placeholder:text-[#94A3B8]"
          />
        </div>

        {countriesError ? (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            No se han podido cargar los países.
          </div>
        ) : countriesLoading ? (
          <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, groupIndex) => (
              <section key={groupIndex}>
                <div className="mb-3 h-8 w-48 animate-pulse rounded bg-slate-200" />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-[76px] animate-pulse rounded-xl border border-slate-200 bg-white"
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : groupedCountriesByContinent.length > 0 ? (
          <div className="space-y-7">
            {groupedCountriesByContinent.map((group) => (
              <section key={group.continent}>
                <div className="mb-3 flex items-end gap-2">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                      Continente
                    </p>
                    <h2 className="text-lg font-extrabold text-[#0F172A]">
                      {group.label}
                    </h2>
                  </div>
                  <span className="pb-0.5 text-xs font-medium text-slate-400">
                    {group.countries.length} {group.countries.length === 1 ? "país" : "países"}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                  {group.countries.map((country) => {
                    const playerCount = playerCountByCountryId.get(String(country.id)) || 0;

                    const flagUrl = getFlagUrl(country);

                    return (
                      <button
                        key={country.id}
                        type="button"
                        onClick={() => setSelectedCountryId(country.id)}
                        className="group flex min-h-[76px] items-center gap-3 rounded-xl border border-white/70 bg-white px-3.5 py-3 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                      >
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#F1F5F9]">
                          {flagUrl ? (
                            <img
                              src={flagUrl}
                              alt={`Bandera de ${country.name}`}
                              className="h-full w-full object-contain"
                              loading="lazy"
                            />
                          ) : (
                            <span className="text-2xl">
                              {country.flag || "🏳️"}
                            </span>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <h2 className="truncate text-[15px] font-extrabold text-[#0F172A]">
                            {country.name}
                          </h2>
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            {playersLoading || playersError
                              ? "—"
                              : `${playerCount} ${playerCount === 1 ? "jugador" : "jugadores"}`}
                          </p>
                        </div>

                        <ChevronRight
                          size={16}
                          className="shrink-0 text-[#94A3B8] transition-transform group-hover:translate-x-0.5"
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
              No se han encontrado países
            </h2>

            <p className="mt-2 text-sm text-[#64748B]">
              Prueba con otro nombre.
            </p>
          </div>
        )}

        {flagSyncOpen && (
          <FlagSyncModal
            open={flagSyncOpen}
            onClose={() => setFlagSyncOpen(false)}
            countries={countries}
            queryClient={queryClient}
          />
        )}
      </div>
    </div>
  );
}