import React, { useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  X,
  Users,
  CalendarDays,
  Building2,
  Globe2,
} from "lucide-react";
import PlayersDetail from "@/pages/PlayerDetail";
import { useLocation, useSearchParams } from "react-router-dom";

import { base44 } from "@/api/base44Client";

const inputClassName =
  "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#003399] focus:ring-2 focus:ring-[#003399]/10";

const emptyPlayerForm = {
  name: "",
  dateOfBirth: "",
  teamId: "",
  countryId: "",
  photoUrl: "",
  newTeamName: "",
  newCountryName: "",
  newCountryContinent: "Europe",
};

const NEW_TEAM_VALUE = "__new_team__";
const NEW_COUNTRY_VALUE = "__new_country__";

const getList = (result) => {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  if (Array.isArray(result?.items)) return result.items;
  if (Array.isArray(result?.results)) return result.results;
  return [];
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

  dateOfBirth:
    player?.date_of_birth ||
    player?.dateOfBirth ||
    player?.birth_date ||
    player?.birthDate ||
    "",

  teamId:
    player?.team_id ||
    player?.teamId ||
    player?.club_id ||
    player?.clubId ||
    "",

  countryId:
    player?.country_id ||
    player?.countryId ||
    "",

  photoUrl:
    player?.photo_url ||
    player?.photoUrl ||
    player?.image_url ||
    player?.imageUrl ||
    "",
});

const normalizeTeam = (team) => ({
  ...team,

  id:
    team?.id ||
    team?._id ||
    team?.data?.id ||
    "",

  name:
    team?.name ||
    "",

  logo:
    team?.logo ||
    team?.logo_url ||
    team?.logoUrl ||
    "",

  countryId:
    team?.country_id ||
    team?.countryId ||
    "",
});

const normalizeCountry = (country) => ({
  ...country,

  id:
    country?.id ||
    country?._id ||
    country?.data?.id ||
    "",

  name:
    country?.name ||
    "",

  code:
    country?.code ||
    country?.country_code ||
    "",

  flag:
    country?.flag ||
    country?.flag_url ||
    country?.flagUrl ||
    "",
});

const normalizeDateOfBirth = (value) => {
  const trimmed = String(value || "").trim();

  if (!trimmed) {
    return "";
  }

  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (!match) {
    return trimmed;
  }

  const [, dayValue, monthValue, yearValue] = match;

  const day = Number(dayValue);
  const month = Number(monthValue);
  const year = Number(yearValue);

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return trimmed;
  }

  return [
    String(day).padStart(2, "0"),
    String(month).padStart(2, "0"),
    String(year),
  ].join("/");
};

const formatDate = (value) => {
  if (!value) return "—";

  const stringValue = String(value).trim();

  const normalizedDate = normalizeDateOfBirth(stringValue);

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(normalizedDate)) {
    return normalizedDate;
  }

  const date = new Date(stringValue);

  if (Number.isNaN(date.getTime())) {
    return stringValue;
  }

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

const isValidDateOfBirth = (value) => {
  const trimmed = String(value || "").trim();

  if (!trimmed) {
    return true;
  }

  const normalizedDate = normalizeDateOfBirth(trimmed);

  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(normalizedDate)) {
    return false;
  }

  return true;
};

const normalizeCountryLabel = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const COUNTRY_NAME_TO_ISO2 = (() => {
  const map = {};

  try {
    const spanishNames = new Intl.DisplayNames(["es"], {
      type: "region",
    });

    const englishNames = new Intl.DisplayNames(["en"], {
      type: "region",
    });

    for (let first = 65; first <= 90; first += 1) {
      for (let second = 65; second <= 90; second += 1) {
        const iso2 = String.fromCharCode(first, second);

        const spanishName = normalizeCountryLabel(
          spanishNames.of(iso2)
        );

        const englishName = normalizeCountryLabel(
          englishNames.of(iso2)
        );

        if (spanishName && spanishName !== iso2.toLowerCase()) {
          map[spanishName] = iso2;
        }

        if (englishName && englishName !== iso2.toLowerCase()) {
          map[englishName] = iso2;
        }
      }
    }
  } catch {
    return {};
  }

  return map;
})();

const alpha3ToAlpha2 = {
  ARG: "AR",
  BRA: "BR",
  FRA: "FR",
  NOR: "NO",
};

const getCountryIso2 = (country) => {
  const code = String(country?.code || "").trim().toUpperCase();

  if (/^[A-Z]{2}$/.test(code)) {
    return code;
  }

  if (/^[A-Z]{3}$/.test(code) && alpha3ToAlpha2[code]) {
    return alpha3ToAlpha2[code];
  }

  return (
    COUNTRY_NAME_TO_ISO2[
      normalizeCountryLabel(country?.name)
    ] || ""
  );
};

const getCountryFlag = (country) => {
  const storedFlag = String(country?.flag || "").trim();

  if (storedFlag) {
    return storedFlag;
  }

  const iso2 = getCountryIso2(country);

  if (!iso2) {
    return "";
  }

  return [...iso2]
    .map((letter) =>
      String.fromCodePoint(
        letter.charCodeAt(0) + 127397
      )
    )
    .join("");
};

function CountryFlag({ country, size = "text-sm" }) {
  const flag = getCountryFlag(country);

  if (!flag) {
    return (
      <Globe2
        size={14}
        strokeWidth={1.8}
        className="shrink-0 text-slate-300"
      />
    );
  }

  const isImage =
    /^(https?:|data:|blob:|\/\/)/i.test(flag);

  if (isImage) {
    return (
      <img
        src={normalizeImageUrl(flag)}
        alt=""
        className="h-4 w-4 shrink-0 object-contain"
      />
    );
  }

  return (
    <span
      className={`shrink-0 leading-none ${size}`}
      aria-hidden="true"
    >
      {flag}
    </span>
  );
}

function PlayerCard({
  player,
  team,
  country,
  onClick,
}) {
  const photoUrl = normalizeImageUrl(player.photoUrl);
  const teamLogo = normalizeImageUrl(team?.logo);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-[0_2px_8px_rgba(15,23,42,0.02)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_8px_24px_rgba(15,23,42,0.06)]"
    >
      <div className="flex items-center gap-4">

        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
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
              <Users size={28} strokeWidth={1.6} />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">

          {/* PLAYER NAME */}
          <h3 className="player-display-title truncate text-sm">
            {player.name || "Unnamed player"}
          </h3>

          {/* DATE OF BIRTH */}
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
            <CalendarDays size={14} strokeWidth={1.8} />
            <span>{formatDate(player.dateOfBirth)}</span>
          </div>

          {/* CLUB */}
          <div className="mt-2 flex min-w-0 items-center gap-2 text-xs text-slate-500">
            {teamLogo ? (
              <img
                src={teamLogo}
                alt=""
                className="h-4 w-4 shrink-0 object-contain"
              />
            ) : (
              <Building2 size={14} strokeWidth={1.8} />
            )}

            <span className="truncate">
              {team?.name || "No club associated"}
            </span>
          </div>

          {/* COUNTRY */}
          {country?.name && (
            <div className="mt-2 flex min-w-0 items-center gap-2 text-xs text-slate-400">
              <CountryFlag country={country} />

              <span className="truncate">
                {country.name}
              </span>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}


function GroupHeader({
  type,
  name,
  logo,
  code,
  country,
  count,
}) {
  const normalizedLogo = normalizeImageUrl(logo);

  return (
    <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white">
          {normalizedLogo ? (
            <img
              src={normalizedLogo}
              alt=""
              className="h-7 w-7 object-contain"
            />
          ) : type === "team" ? (
            <Building2 size={18} className="text-slate-400" />
          ) : (
            <CountryFlag country={country} size="text-lg" />
          )}
        </div>

        <div className="min-w-0">
          <h2 className="truncate text-base font-extrabold tracking-tight text-slate-900">
            {name}
          </h2>
          {code && (
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
              {code}
            </p>
          )}
        </div>
      </div>

      <div className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        {count} {count === 1 ? "player" : "players"}
      </div>
    </div>
  );
}

export default function Players() {
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [countries, setCountries] = useState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");

  const [addModalOpen, setAddModalOpen] = useState(false);

  const [form, setForm] = useState({
    ...emptyPlayerForm,
  });

  const [isSaving, setIsSaving] = useState(false);

  const [selectedPlayer, setSelectedPlayer] = useState(null);

  const location = useLocation();
  const [searchParams] = useSearchParams();

  const rawViewMode = searchParams.get("view");
  const viewMode =
    rawViewMode === "teams" || rawViewMode === "countries"
      ? rawViewMode
      : "all";

  const loadData = async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const [
        playersResult,
        teamsResult,
        countriesResult,
      ] = await Promise.all([
        base44.entities.Player.list(),
        base44.entities.Team.list(),
        base44.entities.Country.list(),
      ]);

      const loadedPlayers = getList(playersResult)
        .map(normalizePlayer)
        .filter((player) => player.id || player.name);

      const loadedTeams = getList(teamsResult)
        .map(normalizeTeam)
        .filter((team) => team.id && team.name)
        .sort((a, b) =>
          a.name.localeCompare(b.name, "es", {
            sensitivity: "base",
          })
        );

      const loadedCountries = getList(countriesResult)
        .map(normalizeCountry)
        .filter((country) => country.id && country.name)
        .sort((a, b) =>
          a.name.localeCompare(b.name, "es", {
            sensitivity: "base",
          })
        );

      setPlayers(loadedPlayers);
      setTeams(loadedTeams);
      setCountries(loadedCountries);
    } catch (error) {
      console.error("Error loading players:", error);

      setErrorMessage(
        "No se han podido cargar los jugadores, equipos o países. Comprueba que las entidades Player, Team y Country existen en Base44."
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (location.state?.mfPlayerViewChange) {
      setSelectedPlayer(null);
    }
  }, [location.key, location.state]);

  useEffect(() => {
    setSelectedPlayer(null);
  }, [viewMode]);

  const teamById = useMemo(() => {
    return teams.reduce((map, team) => {
      map[team.id] = team;
      return map;
    }, {});
  }, [teams]);

  const countryById = useMemo(() => {
    return countries.reduce((map, country) => {
      map[country.id] = country;
      return map;
    }, {});
  }, [countries]);

  const filteredPlayers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return players
      .filter((player) => {
        if (!query) {
          return true;
        }

        const team = teamById[player.teamId];
        const country = countryById[player.countryId];

        return (
          (player.name || "")
            .toLowerCase()
            .includes(query) ||
          (team?.name || "")
            .toLowerCase()
            .includes(query) ||
          (country?.name || "")
            .toLowerCase()
            .includes(query)
        );
      })
      .sort((a, b) =>
        (a.name || "").localeCompare(
          b.name || "",
          "es",
          {
            sensitivity: "base",
          }
        )
      );
  }, [
    players,
    search,
    teamById,
    countryById,
  ]);



  const groupedByTeam = useMemo(() => {
    const groups = {};

    filteredPlayers.forEach((player) => {
      const key = player.teamId || "__no_team__";

      if (!groups[key]) {
        groups[key] = {
          id: key,
          team: teamById[player.teamId] || null,
          players: [],
        };
      }

      groups[key].players.push(player);
    });

    return Object.values(groups).sort((a, b) => {
      const nameA = a.team?.name || "No club";
      const nameB = b.team?.name || "No club";

      return nameA.localeCompare(nameB, "es", {
        sensitivity: "base",
      });
    });
  }, [filteredPlayers, teamById]);

  const groupedByCountry = useMemo(() => {
    const groups = {};

    filteredPlayers.forEach((player) => {
      const key = player.countryId || "__no_country__";

      if (!groups[key]) {
        groups[key] = {
          id: key,
          country: countryById[player.countryId] || null,
          players: [],
        };
      }

      groups[key].players.push(player);
    });

    return Object.values(groups).sort((a, b) => {
      const nameA = a.country?.name || "No country";
      const nameB = b.country?.name || "No country";

      return nameA.localeCompare(nameB, "es", {
        sensitivity: "base",
      });
    });
  }, [filteredPlayers, countryById]);

  const handleOpenAddPlayer = () => {
    setForm({
      ...emptyPlayerForm,
    });

    setAddModalOpen(true);
  };

  const handleCloseAddPlayer = () => {
    if (isSaving) {
      return;
    }

    setAddModalOpen(false);

    setForm({
      ...emptyPlayerForm,
    });
  };

  const handleSavePlayer = async (event) => {
    event.preventDefault();

    if (!form.name.trim()) {
      return;
    }

    if (!isValidDateOfBirth(form.dateOfBirth)) {
      setErrorMessage(
        "La fecha de nacimiento debe tener el formato DD/MM/YYYY. Ejemplo: 28/09/1998."
      );
      return;
    }

    if (
      form.teamId === NEW_TEAM_VALUE &&
      !form.newTeamName.trim()
    ) {
      setErrorMessage(
        "Introduce el nombre del nuevo club."
      );
      return;
    }

    if (
      form.countryId === NEW_COUNTRY_VALUE &&
      !form.newCountryName.trim()
    ) {
      setErrorMessage(
        "Introduce el nombre del nuevo país."
      );
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    try {
      let teamId = form.teamId || "";
      let countryId = form.countryId || "";

      /* CREATE NEW TEAM */
      if (teamId === NEW_TEAM_VALUE) {
        const newTeamName = form.newTeamName.trim();

        const normalizedNewTeamName =
          newTeamName.toLowerCase();

        const existingTeam = teams.find(
          (team) =>
            String(team.name || "")
              .trim()
              .toLowerCase() ===
            normalizedNewTeamName
        );

        if (existingTeam?.id) {
          teamId = existingTeam.id;
        } else {
          const generatedShortName =
            newTeamName
              .toUpperCase()
              .replace(/[^A-Z0-9À-ÿ]/g, "")
              .slice(0, 12) ||
            `TEAM${Date.now()}`;

          const createdTeam =
            await base44.entities.Team.create({
              name: newTeamName,
              short_name: generatedShortName,
              country_id:
                form.countryId || "",
              continent: "Europe",
              is_active: true,
            });

          const createdTeamData =
            createdTeam?.data ||
            createdTeam;

          teamId =
            createdTeamData?.id ||
            createdTeamData?._id ||
            createdTeam?.id ||
            createdTeam?._id ||
            "";

          if (!teamId) {
            throw new Error(
              "El club se creó pero Base44 no devolvió su ID."
            );
          }
        }
      }

      /* CREATE NEW COUNTRY */
      if (countryId === NEW_COUNTRY_VALUE) {
        const newCountryName =
          form.newCountryName.trim();

        const normalizedNewCountryName =
          newCountryName.toLowerCase();

        const existingCountry = countries.find(
          (country) =>
            String(country.name || "")
              .trim()
              .toLowerCase() ===
            normalizedNewCountryName
        );

        if (existingCountry?.id) {
          countryId = existingCountry.id;
        } else {
          const generatedCountryCode =
            newCountryName
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .toUpperCase()
              .replace(/[^A-Z]/g, "")
              .slice(0, 3)
              .padEnd(3, "X");

          const createdCountry =
            await base44.entities.Country.create({
              name: newCountryName,
              code: generatedCountryCode,
              continent: form.newCountryContinent,
              flag: "",
              is_active: true,
            });

          const createdCountryData =
            createdCountry?.data ||
            createdCountry;

          countryId =
            createdCountryData?.id ||
            createdCountryData?._id ||
            createdCountry?.id ||
            createdCountry?._id ||
            "";

          if (!countryId) {
            throw new Error(
              "El país se creó pero Base44 no devolvió su ID."
            );
          }
        }
      }

      /* CREATE PLAYER */
      await base44.entities.Player.create({
        name: form.name.trim(),

        date_of_birth:
          normalizeDateOfBirth(
            form.dateOfBirth
          ),

        team_id: teamId,

        country_id:
          countryId || "",

        photo_url:
          normalizeImageUrl(form.photoUrl),
      });

      setAddModalOpen(false);

      setForm({
        ...emptyPlayerForm,
      });

      await loadData();
    } catch (error) {
      console.error(
        "Error creating player:",
        error
      );

      const errorMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "No se ha podido crear el jugador.";

      setErrorMessage(
        `Error al crear el jugador: ${errorMessage}`
      );
    } finally {
      setIsSaving(false);
    }
  };

  /*
   * =========================================================
   * PLAYER DETAIL
   * =========================================================
   *
   * Cuando selectedPlayer tiene valor, dejamos la lista
   * y mostramos directamente PlayerDetail.
   *
   * =========================================================
   */

  if (selectedPlayer) {
    return (
      <PlayersDetail
        player={selectedPlayer}
        team={teamById[selectedPlayer.teamId]}
        onBack={() => {
          setSelectedPlayer(null);
        }}
      />
    );
  }

  return (
    <div className="relative h-full min-h-0 overflow-y-auto scroll-smooth bg-[#f5f7fa] p-3 sm:p-4 md:p-6">
      <div className="mx-auto max-w-[1800px]">

        {/* HEADER */}
        <div className="mb-4 flex items-center justify-end">
          <div className="flex items-center gap-2">

            {/* SEARCH */}
            {searchOpen && (
              <div className="w-[220px] sm:w-[280px]">
                <input
                  type="text"
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search players..."
                  autoFocus
                  className={inputClassName}
                />
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setSearchOpen(
                  (open) => !open
                );

                if (searchOpen) {
                  setSearch("");
                }
              }}
              className={`flex h-10 w-10 items-center justify-center rounded-xl border transition ${
                searchOpen
                  ? "border-[#003399] bg-[#003399] text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              }`}
              aria-label="Search players"
              title="Search players"
            >
              {searchOpen ? (
                <X size={17} />
              ) : (
                <Search size={17} />
              )}
            </button>

            {/* ADD PLAYER */}
            <button
              type="button"
              onClick={handleOpenAddPlayer}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#003399] text-white transition hover:bg-[#002477]"
              aria-label="Add player"
              title="Add player"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>

        {/* ERROR */}
        {errorMessage && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {/* COUNTER */}
        <div className="mb-4 flex items-center justify-between">
          <div className="text-xs font-medium text-slate-400">
            {isLoading
              ? "Loading players..."
              : `${filteredPlayers.length} ${
                  filteredPlayers.length === 1
                    ? "player"
                    : "players"
                }`}
          </div>
        </div>

        {/* LOADING */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 8 }).map(
              (_, index) => (
                <div
                  key={index}
                  className="h-[106px] animate-pulse rounded-2xl border border-slate-200 bg-white"
                />
              )
            )}
          </div>
        ) : filteredPlayers.length > 0 ? (

          /* PLAYERS */
          <div className="space-y-8">

            {/* ALL PLAYERS */}
            {viewMode === "all" && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {filteredPlayers.map(
                  (player) => (
                    <PlayerCard
                      key={
                        player.id ||
                        `${player.name}-${player.dateOfBirth}`
                      }
                      player={player}
                      team={
                        teamById[player.teamId]
                      }
                      country={
                        countryById[
                          player.countryId
                        ]
                      }
                      onClick={() => {
                        console.log(
                          "PLAYER CLICKED:",
                          player
                        );

                        setSelectedPlayer(player);
                      }}
                    />
                  )
                )}
              </div>
            )}

            {/* BY TEAMS */}
            {viewMode === "teams" && (
              <div className="space-y-8">
                {groupedByTeam.map(
                  (group) => (
                    <section key={group.id}>
                      <GroupHeader
                        type="team"
                        name={
                          group.team?.name ||
                          "No club"
                        }
                        logo={group.team?.logo}
                        count={group.players.length}
                      />

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                        {group.players.map(
                          (player) => (
                            <PlayerCard
                              key={
                                player.id ||
                                `${player.name}-${player.dateOfBirth}`
                              }
                              player={player}
                              team={
                                teamById[player.teamId]
                              }
                              country={
                                countryById[player.countryId]
                              }
                              onClick={() => {
                                console.log(
                                  "PLAYER CLICKED:",
                                  player
                                );

                                setSelectedPlayer(player);
                              }}
                            />
                          )
                        )}
                      </div>
                    </section>
                  )
                )}
              </div>
            )}

            {/* BY COUNTRIES */}
            {viewMode === "countries" && (
              <div className="space-y-8">
                {groupedByCountry.map(
                  (group) => (
                    <section key={group.id}>
                      <GroupHeader
                        type="country"
                        name={
                          group.country?.name ||
                          "No country"
                        }
                        code={
                          group.country?.code
                        }
                        country={group.country}
                        count={group.players.length}
                      />

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                        {group.players.map(
                          (player) => (
                            <PlayerCard
                              key={
                                player.id ||
                                `${player.name}-${player.dateOfBirth}`
                              }
                              player={player}
                              team={
                                teamById[player.teamId]
                              }
                              country={
                                countryById[player.countryId]
                              }
                              onClick={() => {
                                console.log(
                                  "PLAYER CLICKED:",
                                  player
                                );

                                setSelectedPlayer(player);
                              }}
                            />
                          )
                        )}
                      </div>
                    </section>
                  )
                )}
              </div>
            )}
          </div>

        ) : (

          /* EMPTY STATE */
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">

            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-300">
              <Users size={24} />
            </div>

            <h2 className="mt-4 text-sm font-extrabold text-slate-900">
              {search
                ? "No players found"
                : "No players created yet"}
            </h2>

            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
              {search
                ? "Try another player, club or country name."
                : "Create your first player using the + button."}
            </p>

            {!search && (
              <button
                type="button"
                onClick={
                  handleOpenAddPlayer
                }
                className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-[#003399] px-4 text-sm font-semibold text-white transition hover:bg-[#002477]"
              >
                <Plus size={16} />
                Add player
              </button>
            )}

          </div>
        )}

        {/* ADD PLAYER MODAL */}
        {addModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px]"
            onMouseDown={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                handleCloseAddPlayer();
              }
            }}
          >
            <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">

              {/* MODAL HEADER */}
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    Add player
                  </h2>

                  <p className="mt-0.5 text-xs text-slate-400">
                    Create a new player in the database.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    handleCloseAddPlayer
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50"
                  aria-label="Close"
                >
                  <X size={17} />
                </button>
              </div>

              <form
                onSubmit={
                  handleSavePlayer
                }
                className="space-y-5 p-5"
              >

                {/* PLAYER NAME */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Player name
                  </label>

                  <input
                    type="text"
                    value={form.name}
                    onChange={(event) =>
                      setForm(
                        (current) => ({
                          ...current,
                          name:
                            event.target
                              .value,
                        })
                      )
                    }
                    placeholder="e.g. Neymar Jr"
                    className={
                      inputClassName
                    }
                    required
                  />
                </div>

                {/* DATE OF BIRTH */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Date of birth
                  </label>

                  <input
                    type="text"
                    value={
                      form.dateOfBirth
                    }
                    onChange={(event) =>
                      setForm(
                        (current) => ({
                          ...current,
                          dateOfBirth:
                            event.target
                              .value,
                        })
                      )
                    }
                    placeholder="5/2/1999 o 05/02/1999"
                    inputMode="numeric"
                    maxLength={10}
                    className={
                      inputClassName
                    }
                  />

                  <p className="mt-1.5 text-[11px] text-slate-400">
                    Format: DD/MM/YYYY
                  </p>
                </div>

                {/* COUNTRY */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Country
                  </label>

                  <select
                    value={
                      form.countryId
                    }
                    onChange={(event) =>
                      setForm(
                        (current) => ({
                          ...current,
                          countryId:
                            event.target
                              .value,
                          newCountryName:
                            "",
                        })
                      )
                    }
                    className={
                      inputClassName
                    }
                  >
                    <option value="">
                      Select country
                    </option>

                    {countries.map(
                      (country) => (
                        <option
                          key={
                            country.id
                          }
                          value={
                            country.id
                          }
                        >
                          {country.name}
                          {country.code
                            ? ` (${country.code})`
                            : ""}
                        </option>
                      )
                    )}

                    <option
                      value={
                        NEW_COUNTRY_VALUE
                      }
                    >
                      New
                    </option>
                  </select>

                  {form.countryId ===
                    NEW_COUNTRY_VALUE && (
                    <div className="mt-3 rounded-xl border border-[#003399]/15 bg-[#003399]/[0.035] p-4">

                      <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                        New country
                      </label>

                      <input
                        type="text"
                        value={
                          form.newCountryName
                        }
                        onChange={(event) =>
                          setForm(
                            (current) => ({
                              ...current,
                              newCountryName:
                                event.target.value,
                            })
                          )
                        }
                        placeholder="e.g. Argentina"
                        className={
                          inputClassName
                        }
                        autoFocus
                      />

                      <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                        The country will be created
                        automatically when you save
                        the player. Its 3-letter code
                        will be generated automatically.
                      </p>
                    </div>
                  )}

                  {countries.length ===
                    0 && (
                    <p className="mt-1.5 text-[11px] text-slate-400">
                      No countries have
                      been created yet.
                    </p>
                  )}
                </div>

                {/* CLUB */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Associated club
                  </label>

                  <select
                    value={
                      form.teamId
                    }
                    onChange={(event) =>
                      setForm(
                        (current) => ({
                          ...current,
                          teamId:
                            event.target
                              .value,
                          newTeamName:
                            "",
                        })
                      )
                    }
                    className={
                      inputClassName
                    }
                  >
                    <option value="">
                      No club
                    </option>

                    {teams.map(
                      (team) => (
                        <option
                          key={team.id}
                          value={team.id}
                        >
                          {team.name}
                        </option>
                      )
                    )}

                    <option
                      value={
                        NEW_TEAM_VALUE
                      }
                    >
                      + Create new club
                    </option>
                  </select>
                </div>

                {/* NEW CLUB */}
                {form.teamId ===
                  NEW_TEAM_VALUE && (
                  <div className="rounded-xl border border-[#003399]/15 bg-[#003399]/[0.035] p-4">

                    <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                      New club
                    </label>

                    <input
                      type="text"
                      value={
                        form.newTeamName
                      }
                      onChange={(event) =>
                        setForm(
                          (current) => ({
                            ...current,
                            newTeamName:
                              event.target.value,
                          })
                        )
                      }
                      placeholder="e.g. Santos FC"
                      className={
                        inputClassName
                      }
                      autoFocus
                    />

                    <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                      The club will be
                      created automatically
                      when you save the player.
                      The selected country will be
                      assigned to the new club.
                    </p>

                  </div>
                )}

                {/* PLAYER PHOTO */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Player photo URL
                  </label>

                  <input
                    type="url"
                    value={
                      form.photoUrl
                    }
                    onChange={(event) =>
                      setForm(
                        (current) => ({
                          ...current,
                          photoUrl:
                            event.target
                              .value,
                        })
                      )
                    }
                    placeholder="https://..."
                    className={
                      inputClassName
                    }
                  />
                </div>

                {/* PHOTO PREVIEW */}
                {form.photoUrl && (
                  <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">

                    <img
                      src={normalizeImageUrl(
                        form.photoUrl
                      )}
                      alt=""
                      className="h-16 w-16 rounded-lg object-cover object-top"
                      onError={(event) => {
                        event.currentTarget.style.display =
                          "none";
                      }}
                    />

                    <div className="text-xs text-slate-500">
                      Preview of the player photo.
                    </div>

                  </div>
                )}

                {/* ACTIONS */}
                <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">

                  <button
                    type="button"
                    onClick={
                      handleCloseAddPlayer
                    }
                    disabled={isSaving}
                    className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={
                      isSaving ||
                      !form.name.trim() ||
                      ((form.teamId ===
                        NEW_TEAM_VALUE &&
                        !form.newTeamName.trim()) ||
                      (form.countryId ===
                        NEW_COUNTRY_VALUE &&
                        !form.newCountryName.trim()))
                    }
                    className="h-10 rounded-xl bg-[#003399] px-4 text-sm font-semibold text-white transition hover:bg-[#002477] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSaving
                      ? "Saving..."
                      : "Create player"}
                  </button>

                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
