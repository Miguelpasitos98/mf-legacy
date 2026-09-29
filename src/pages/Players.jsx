import React, { useEffect, useMemo, useState } from "react";

import { Search, Plus, X, Users, CalendarDays, Building2 } from "lucide-react";
import PlayerDetail from "@/components/PlayerDetail";

import { base44 } from "@/api/base44Client";

const inputClassName =
  "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#003399] focus:ring-2 focus:ring-[#003399]/10";

const emptyPlayerForm = {
  name: "",
  dateOfBirth: "",
  teamId: "",
  photoUrl: "",
};

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
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (/^(https?:|data:|blob:)/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

const normalizePlayer = (player) => ({
  ...player,
  id: player?.id || player?._id || player?.data?.id || "",
  name: player?.name || player?.full_name || player?.fullName || "",
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
  photoUrl:
    player?.photo_url ||
    player?.photoUrl ||
    player?.image_url ||
    player?.imageUrl ||
    "",
});

const normalizeTeam = (team) => ({
  ...team,
  id: team?.id || team?._id || team?.data?.id || "",
  name: team?.name || "",
  logo: team?.logo || team?.logo_url || team?.logoUrl || "",
});

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

function PlayerCard({ player, team, onClick }) {
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
          <h3 className="truncate text-sm font-extrabold text-slate-900">
            {player.name || "Unnamed player"}
          </h3>

          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
            <CalendarDays size={14} strokeWidth={1.8} />
            <span>{formatDate(player.dateOfBirth)}</span>
          </div>

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
        </div>
      </div>
    </button>
  );
}

export default function Players() {
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyPlayerForm });
  const [isSaving, setIsSaving] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  const loadData = async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const [playersResult, teamsResult] = await Promise.all([
        base44.entities.Player.list(),
        base44.entities.Team.list(),
      ]);

      const loadedPlayers = getList(playersResult)
        .map(normalizePlayer)
        .filter((player) => player.id || player.name);

      const loadedTeams = getList(teamsResult)
        .map(normalizeTeam)
        .filter((team) => team.id && team.name)
        .sort((a, b) =>
          a.name.localeCompare(b.name, "es", { sensitivity: "base" })
        );

      setPlayers(loadedPlayers);
      setTeams(loadedTeams);
    } catch (error) {
      console.error("Error loading players:", error);
      setErrorMessage(
        "No se han podido cargar los jugadores. Comprueba que la entidad Player existe en Base44."
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const teamById = useMemo(() => {
    return teams.reduce((map, team) => {
      map[team.id] = team;
      return map;
    }, {});
  }, [teams]);

  const filteredPlayers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return players
      .filter((player) => {
        if (!query) return true;
        const team = teamById[player.teamId];
        return (
          (player.name || "").toLowerCase().includes(query) ||
          (team?.name || "").toLowerCase().includes(query)
        );
      })
      .sort((a, b) =>
        (a.name || "").localeCompare(b.name || "", "es", {
          sensitivity: "base",
        })
      );
  }, [players, search, teamById]);

  const handleOpenAddPlayer = () => {
    setForm({ ...emptyPlayerForm });
    setAddModalOpen(true);
  };

  const handleSavePlayer = async (event) => {
    event.preventDefault();

    if (!form.name.trim()) return;

    setIsSaving(true);
    setErrorMessage("");

    try {
      await base44.entities.Player.create({
        name: form.name.trim(),
        date_of_birth: form.dateOfBirth || "",
        team_id: form.teamId || "",
        photo_url: normalizeImageUrl(form.photoUrl),
      });

      setAddModalOpen(false);
      setForm({ ...emptyPlayerForm });
      await loadData();
    } catch (error) {
      console.error("Error creating player:", error);
      setErrorMessage(
        "No se ha podido crear el jugador. Revisa los campos de la entidad Player."
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (selectedPlayer) {
    return (
      <PlayerDetail
        player={selectedPlayer}
        team={teamById[selectedPlayer.teamId]}
        onBack={() => setSelectedPlayer(null)}
      />
    );
  }

  return (
    <div className="relative h-[calc(100vh-0px)] overflow-y-auto scroll-smooth bg-[#f5f7fa] p-3 sm:p-4 md:p-6">
      <div className="mx-auto max-w-[1800px]">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              MF LEGACY
            </p>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Players
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Explore and manage the player database.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {searchOpen && (
              <div className="w-[220px] sm:w-[280px]">
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search players..."
                  autoFocus
                  className={inputClassName}
                />
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setSearchOpen((open) => !open);
                if (searchOpen) setSearch("");
              }}
              className={`flex h-10 w-10 items-center justify-center rounded-xl border transition ${
                searchOpen
                  ? "border-[#003399] bg-[#003399] text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              }`}
              aria-label="Search players"
              title="Search players"
            >
              {searchOpen ? <X size={17} /> : <Search size={17} />}
            </button>

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

        {errorMessage && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        <div className="mb-5 flex items-center justify-between">
          <div className="text-xs font-medium text-slate-400">
            {isLoading
              ? "Loading players..."
              : `${filteredPlayers.length} ${
                  filteredPlayers.length === 1 ? "player" : "players"
                }`}
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="h-[106px] animate-pulse rounded-2xl border border-slate-200 bg-white"
              />
            ))}
          </div>
        ) : filteredPlayers.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filteredPlayers.map((player) => (
              <PlayerCard
                key={player.id || `${player.name}-${player.dateOfBirth}`}
                player={player}
                team={teamById[player.teamId]}
                onClick={() => setSelectedPlayer(player)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-300">
              <Users size={24} />
            </div>

            <h2 className="mt-4 text-sm font-extrabold text-slate-900">
              {search ? "No players found" : "No players created yet"}
            </h2>

            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
              {search
                ? "Try another player or club name."
                : "Create your first player using the + button."}
            </p>

            {!search && (
              <button
                type="button"
                onClick={handleOpenAddPlayer}
                className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-[#003399] px-4 text-sm font-semibold text-white transition hover:bg-[#002477]"
              >
                <Plus size={16} />
                Add player
              </button>
            )}
          </div>
        )}

        {addModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px]"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setAddModalOpen(false);
              }
            }}
          >
            <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
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
                  onClick={() => setAddModalOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50"
                  aria-label="Close"
                >
                  <X size={17} />
                </button>
              </div>

              <form onSubmit={handleSavePlayer} className="space-y-5 p-5">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Player name
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="e.g. Jude Bellingham"
                    className={inputClassName}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                      Date of birth
                    </label>
                    <input
                      type="date"
                      value={form.dateOfBirth}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          dateOfBirth: event.target.value,
                        }))
                      }
                      className={inputClassName}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                      Associated club
                    </label>
                    <select
                      value={form.teamId}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          teamId: event.target.value,
                        }))
                      }
                      className={inputClassName}
                    >
                      <option value="">No club</option>
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Player photo URL
                  </label>
                  <input
                    type="url"
                    value={form.photoUrl}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        photoUrl: event.target.value,
                      }))
                    }
                    placeholder="https://..."
                    className={inputClassName}
                  />
                </div>

                {form.photoUrl && (
                  <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <img
                      src={normalizeImageUrl(form.photoUrl)}
                      alt=""
                      className="h-16 w-16 rounded-lg object-cover object-top"
                    />
                    <div className="text-xs text-slate-500">
                      Preview of the player photo.
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() => setAddModalOpen(false)}
                    className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={isSaving || !form.name.trim()}
                    className="h-10 rounded-xl bg-[#003399] px-4 text-sm font-semibold text-white transition hover:bg-[#002477] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSaving ? "Saving..." : "Create player"}
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
