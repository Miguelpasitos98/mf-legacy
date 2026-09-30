import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Building2,
  UserRound,
  X,
  Save,
  Pencil,
} from "lucide-react";
import { base44 } from "@/api/base44Client";

const POSITION_CODES = [
  "GK",
  "DFC",
  "LD",
  "LI",
  "CRD",
  "CRI",
  "CDM",
  "CM",
  "CAM",
  "EI",
  "ED",
  "DC",
];

const DESCRIPTION_OPTIONS = [
  {
    group: "Goalkeepers",
    options: [
      "🧤 Traditional Goalkeeper",
      "🕹️ Modern Goalkeeper",
      "🧱 Positional Goalkeeper",
      "🚀 Sweeper Distributor",
      "🪟 Sweeper Keeper",
      "🪞 Penalty Specialist",
      "🔁 Reliable Backup Keeper",
    ],
  },
  {
    group: "Centre-Backs",
    options: [
      "🧱 The Sweeper",
      "🧠 Ball-Playing Defender",
      "🦍 Physical Dominator",
      "🛡️ Aggressive Front-Foot Defender",
      "🧲 Libero Defender",
      "📐 Tactical Defender",
      "👑 Defensive Leader",
      "🧬 Hybrid Defender",
    ],
  },
  {
    group: "Full-Backs / Wing-Backs",
    options: [
      "🚪 Defensive Full-Back",
      "🛞 Overlapping Wing-Back",
      "🌀 Complete Full-Back",
      "🧩 Versatile Full-Back",
      "🪫 Defensive Wing-Back",
      "⚡ Explosive Full-Back",
      "🪙 Technical Full-Back",
      "🏗️ Inverted Full-Back",
    ],
  },
  {
    group: "Central Midfielders",
    options: [
      "⚓ The Anchorman",
      "💥 The Destroyer",
      "🧭 Regista",
      "🔄 Box-to-Box Controller",
      "🧠 Advanced Playmaker",
      "📡 Deep-Lying Playmaker",
      "🧯 Firefighter Midfielder",
      "🧮 Methodical Midfielder",
      "🛠️ Workhorse Midfielder",
    ],
  },
  {
    group: "Attacking Midfielders",
    options: [
      "🎨 The Architect",
      "🎩 Space Creator",
      "🧃 The Classic 10",
      "🔁 The Connector",
      "🧱 Physical Playmaker",
      "🪛 Pressing Midfielder",
      "🎬 Late Runner",
      "🧲 Gravitational Playmaker",
      "🛠️ Physical Creator",
    ],
  },
  {
    group: "Wingers",
    options: [
      "⚡ Line Breaker",
      "🔁 Wide Connector",
      "🧨 Inside Finisher",
      "🛼 Wide Ball Carrier",
      "🪄 Creative Winger",
      "🌪️ Chaotic Winger",
      "🧤 Defensive Winger",
      "📦 Functional Winger",
      "🎯 Wide Forward",
    ],
  },
  {
    group: "Strikers",
    options: [
      "🎯 Clinical Finisher",
      "🐍 Dynamic Threat",
      "🦍 Target Man",
      "🔁 Second Striker",
      "🌀 Space Creator",
      "🧃 Space Attacker",
      "🔫 Goal Hunter",
      "🧠 Intelligent Forward",
      "🚀 Breakaway Forward",
      "🧊 Ice-Cold Finisher",
    ],
  },
  {
    group: "Special Roles",
    options: [
      "🧩 Utility Player",
      "👑 Tactical Leader",
      "🔋 Super Sub",
      "🎮 Free Spirit",
      "🧠 Hidden Genius",
      "🎭 Classic Enganche",
      "🎢 Inconsistent Talent",
      "🪶 Elegant Technician",
      "🪨 Rock-Solid Player",
      "🧪 Tactical Experiment",
      "🧳 Journeyman",
      "🫥 The Invisible One",
    ],
  },
];

const INPUT_CLASS =
  "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-[#003399] focus:ring-2 focus:ring-[#003399]/10";

function normalizeImageUrl(value) {
  if (!value) return "";
  const url = String(value).trim();
  if (!url) return "";
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  if (url.startsWith("//")) return `https:${url}`;
  return `https://${url}`;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function calculateAge(value) {
  if (!value) return null;
  const birth = new Date(value);
  if (Number.isNaN(birth.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const month = today.getMonth() - birth.getMonth();

  if (month < 0 || (month === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

export default function PlayerDetail({ player, team, onBack, onPlayerUpdated }) {
  const initialPositionRatings = useMemo(
    () => ({
      GK: 0,
      DFC: 0,
      LD: 0,
      LI: 0,
      CRD: 0,
      CRI: 0,
      CDM: 0,
      CM: 0,
      CAM: 0,
      EI: 0,
      ED: 0,
      DC: 0,
      ...(player?.position_ratings || player?.positionRatings || {}),
    }),
    [player]
  );

  const initialForm = useMemo(
    () => ({
      name: player?.name || "",
      dateOfBirth: player?.dateOfBirth || player?.date_of_birth || "",
      photoUrl: player?.photoUrl || player?.photo_url || "",
      cardPhotoUrl: player?.cardPhotoUrl || player?.card_photo_url || "",
      ca: player?.ca ?? "",
      cp: player?.cp ?? "",
      description: player?.description || "",
      positionRatings: initialPositionRatings,
    }),
    [player, initialPositionRatings]
  );

  const [editOpen, setEditOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [editablePlayer, setEditablePlayer] = useState(player);
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    setEditablePlayer(player);
    setForm(initialForm);
  }, [player, initialForm]);

  const playerName = editablePlayer?.name || "Unnamed player";
  const photoUrl = normalizeImageUrl(
    editablePlayer?.photoUrl || editablePlayer?.photo_url
  );
  const teamLogo = normalizeImageUrl(team?.logo || team?.logo_url);
  const teamName = team?.name || "No club associated";
  const dateOfBirth =
    editablePlayer?.dateOfBirth ||
    editablePlayer?.date_of_birth ||
    "";
  const age = calculateAge(dateOfBirth);

  const [firstName, ...rest] = playerName.split(" ");
  const lastName = rest.join(" ");

  const openEditor = () => {
    setForm(initialForm);
    setEditError("");
    setEditOpen(true);
  };

  const closeEditor = () => {
    if (isSaving) return;
    setForm(initialForm);
    setEditError("");
    setEditOpen(false);
  };

  const handleSave = async (event) => {
    event.preventDefault();

    if (!editablePlayer?.id) {
      setEditError("No se ha encontrado el ID del jugador.");
      return;
    }

    if (!form.name.trim()) {
      setEditError("El nombre del jugador es obligatorio.");
      return;
    }

    const numericCA = Number(form.ca);
    const numericCP = Number(form.cp);

    if (
      form.ca === "" ||
      !Number.isFinite(numericCA) ||
      numericCA < 0 ||
      numericCA > 200
    ) {
      setEditError("El CA debe estar entre 0 y 200.");
      return;
    }

    if (
      form.cp === "" ||
      !Number.isFinite(numericCP) ||
      numericCP < 0 ||
      numericCP > 200
    ) {
      setEditError("El CP debe estar entre 0 y 200.");
      return;
    }

    const positionRatings = POSITION_CODES.reduce((result, code) => {
      const value = Number(form.positionRatings?.[code] ?? 0);
      result[code] = Number.isFinite(value)
        ? Math.min(20, Math.max(0, value))
        : 0;
      return result;
    }, {});

    setIsSaving(true);
    setEditError("");

    try {
      await base44.entities.Player.update(editablePlayer.id, {
        name: form.name.trim(),
        date_of_birth: form.dateOfBirth.trim(),
        photo_url: normalizeImageUrl(form.photoUrl),
        card_photo_url: normalizeImageUrl(form.cardPhotoUrl),
        ca: numericCA,
        cp: numericCP,
        position_ratings: positionRatings,
        description: form.description || "",
      });

      const updatedPlayer = {
        ...editablePlayer,
        name: form.name.trim(),
        dateOfBirth: form.dateOfBirth.trim(),
        date_of_birth: form.dateOfBirth.trim(),
        photoUrl: form.photoUrl.trim(),
        photo_url: form.photoUrl.trim(),
        cardPhotoUrl: form.cardPhotoUrl.trim(),
        card_photo_url: form.cardPhotoUrl.trim(),
        ca: numericCA,
        cp: numericCP,
        positionRatings,
        position_ratings: positionRatings,
        description: form.description || "",
      };

      setEditablePlayer(updatedPlayer);
      setForm((current) => ({
        ...current,
        positionRatings,
      }));
      setEditOpen(false);

      if (onPlayerUpdated) {
        onPlayerUpdated(updatedPlayer);
      }
    } catch (error) {
      console.error("Error updating player:", error);
      setEditError(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          error?.message ||
          "No se ha podido actualizar el jugador."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="relative h-full min-h-0 overflow-hidden bg-[#eef1f5] text-slate-900">
      <div className="absolute inset-0 bg-[linear-gradient(110deg,#eef1f5_0%,#eef1f5_53%,#dfe4ea_53%,#dfe4ea_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_64%_42%,rgba(255,255,255,0.95),transparent_34%)]" />

      <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-6 py-5 md:px-10 lg:px-14">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-600 transition hover:text-[#003399]"
        >
          <ArrowLeft size={16} />
          Back to players
        </button>

        <button
          type="button"
          onClick={openEditor}
          className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500 transition hover:text-[#003399]"
          aria-label="Edit player"
        >
          EDIT <Pencil size={15} />
        </button>
      </header>

      <section className="relative z-10 grid h-full min-h-0 grid-cols-1 items-center gap-4 overflow-visible px-6 pb-2 pt-20 md:px-10 lg:grid-cols-[0.85fr_1.35fr_0.7fr] lg:px-14 xl:px-20">
        <div className="pointer-events-none absolute bottom-[2%] left-[3%] select-none whitespace-nowrap text-[clamp(5rem,14vw,15rem)] font-black uppercase leading-[0.72] tracking-[-0.09em] text-slate-900/[0.055]">
          {playerName}
        </div>

        <div className="relative z-20 flex min-h-0 flex-col justify-center py-8 lg:h-full lg:min-h-0">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.28em] text-slate-400">
            Player profile
          </p>

          <h1 className="max-w-xl text-6xl font-black uppercase leading-[0.82] tracking-[-0.065em] text-slate-950 md:text-7xl xl:text-8xl">
            <span className="block">{firstName}</span>
            {lastName && <span className="block">{lastName}</span>}
          </h1>

          <div className="mt-7 h-px w-24 bg-[#003399]" />

          <div className="mt-7 space-y-4 text-sm">
            <div className="flex items-center gap-3 text-slate-600">
              {teamLogo ? (
                <img src={teamLogo} alt="" className="h-6 w-6 object-contain" />
              ) : (
                <Building2 size={17} />
              )}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  Club
                </p>
                <p className="font-bold text-slate-900">{teamName}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-slate-600">
              <CalendarDays size={18} />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  Date of birth
                </p>
                <p className="font-bold text-slate-900">
                  {formatDate(dateOfBirth)}
                  {age !== null ? ` · ${age} years` : ""}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-slate-600">
              <UserRound size={18} />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  Player ID
                </p>
                <p className="max-w-[220px] truncate font-mono text-xs font-semibold text-slate-700">
                  {player?.id || "—"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-20 flex h-full min-h-0 items-end justify-center overflow-visible">
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none text-[clamp(12rem,25vw,24rem)] font-black leading-none tracking-[-0.1em] text-[#003399]/[0.06]">
            {age ?? ""}
          </div>

          {photoUrl ? (
            <img
              src={photoUrl}
              alt={playerName}
              className="relative z-10 h-full w-auto max-w-none object-contain object-bottom drop-shadow-[0_30px_28px_rgba(15,23,42,0.22)] lg:absolute lg:bottom-[-150px] lg:left-1/2 lg:h-[calc(100%+150px)] lg:w-auto lg:max-w-none lg:-translate-x-1/2"
            />
          ) : (
            <div className="relative z-10 flex h-[420px] w-[320px] items-center justify-center rounded-[2rem] border border-slate-300 bg-white/60 text-slate-300">
              <UsersPlaceholder />
            </div>
          )}
        </div>

        <aside className="relative z-20 flex min-h-0 flex-col justify-center py-8 lg:h-full lg:min-h-0">
          <div className="rounded-2xl border border-white/70 bg-white/70 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.07)] backdrop-blur-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
              Current club
            </p>

            <div className="mt-5 flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-slate-50">
                {teamLogo ? (
                  <img src={teamLogo} alt="" className="h-12 w-12 object-contain" />
                ) : (
                  <Building2 size={25} className="text-slate-300" />
                )}
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-black uppercase tracking-tight text-slate-900">
                  {teamName}
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400">
                  Official club
                </p>
              </div>
            </div>
          </div>
        </aside>
      </section>

      {editOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeEditor();
            }
          }}
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  Edit player
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  Update the player's information.
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditor}
                disabled={isSaving}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
                aria-label="Close editor"
              >
                <X size={17} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-5 p-5">
              {editError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {editError}
                </div>
              )}

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
                  className={INPUT_CLASS}
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Date of birth
                </label>
                <input
                  type="text"
                  value={form.dateOfBirth}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      dateOfBirth: event.target.value,
                    }))
                  }
                  placeholder="DD/MM/YYYY"
                  className={INPUT_CLASS}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    CA
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={200}
                    step={1}
                    value={form.ca}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        ca: event.target.value,
                      }))
                    }
                    className={INPUT_CLASS}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    CP
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={200}
                    step={1}
                    value={form.cp}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        cp: event.target.value,
                      }))
                    }
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Description
                </label>

                <select
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  className={INPUT_CLASS}
                >
                  <option value="">Sin descripción</option>

                  {DESCRIPTION_OPTIONS.map((group) => (
                    <optgroup key={group.group} label={group.group}>
                      {group.options.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Profile photo URL
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
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Card photo URL
                </label>
                <input
                  type="url"
                  value={form.cardPhotoUrl}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      cardPhotoUrl: event.target.value,
                    }))
                  }
                  placeholder="https://..."
                  className={INPUT_CLASS}
                />
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Position ratings
                    </label>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Valora cada posición de 0 a 20.
                    </p>
                  </div>

                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                    0-20
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {POSITION_CODES.map((code) => (
                    <div key={code}>
                      <label className="mb-1 block text-[11px] font-semibold text-slate-600">
                        {code}
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={20}
                        step={1}
                        value={form.positionRatings?.[code] ?? 0}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            positionRatings: {
                              ...current.positionRatings,
                              [code]: event.target.value,
                            },
                          }))
                        }
                        className={INPUT_CLASS}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={closeEditor}
                  disabled={isSaving}
                  className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#003399] px-4 text-sm font-semibold text-white transition hover:bg-[#002477] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Save size={16} />
                  {isSaving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

function UsersPlaceholder() {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <UserRound size={52} strokeWidth={1.2} />
      <span className="text-[10px] font-bold uppercase tracking-[0.18em]">
        Add player photo
      </span>
    </div>
  );
}
