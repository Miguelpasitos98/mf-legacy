import React from "react";
import {
  ArrowLeft,
  Menu,
  CalendarDays,
  Building2,
  UserRound,
} from "lucide-react";

function normalizeImageUrl(value) {
  if (!value) return "";

  const url = String(value).trim();

  if (!url) return "";

  if (/^(https?:|data:|blob:)/i.test(url)) {
    return url;
  }

  if (url.startsWith("//")) {
    return `https:${url}`;
  }

  return `https://${url}`;
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function calculateAge(value) {
  if (!value) return null;

  const birth = new Date(value);

  if (Number.isNaN(birth.getTime())) {
    return null;
  }

  const today = new Date();

  let age = today.getFullYear() - birth.getFullYear();

  const month = today.getMonth() - birth.getMonth();

  if (
    month < 0 ||
    (month === 0 && today.getDate() < birth.getDate())
  ) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

export default function PlayerDetail({ player, team, onBack }) {
  const playerName = player?.name || "Unnamed player";

  const photoUrl = normalizeImageUrl(
    player?.photoUrl || player?.photo_url
  );

  const teamLogo = normalizeImageUrl(
    team?.logo || team?.logo_url
  );

  const teamName = team?.name || "No club associated";

  const dateOfBirth =
    player?.dateOfBirth ||
    player?.date_of_birth ||
    "";

  const age = calculateAge(dateOfBirth);

  const [firstName, ...rest] = playerName.split(" ");

  const lastName = rest.join(" ");

  return (
    <main className="relative h-full min-h-0 overflow-visible bg-[#eef1f5] text-slate-900">

      {/* BACKGROUND */}

      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,#eef1f5_0%,#eef1f5_53%,#dfe4ea_53%,#dfe4ea_100%)]" />

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_64%_42%,rgba(255,255,255,0.95),transparent_34%)]" />

      {/* HEADER */}

      <header className="absolute inset-x-0 top-0 z-50 flex items-center justify-between px-6 py-5 md:px-10 lg:px-14">

        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-600 transition hover:text-[#003399]"
        >
          <ArrowLeft size={16} />
          Back to players
        </button>

        <div className="text-xs font-black tracking-[0.2em] text-slate-500">
          MF LEGACY
        </div>

        <button
          type="button"
          className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500"
          aria-label="Open player menu"
        >
          MENU
          <Menu size={16} />
        </button>

      </header>

      {/* MAIN PLAYER AREA */}

      <section className="relative z-10 grid h-full min-h-0 grid-cols-1 items-center gap-4 overflow-visible px-6 pb-0 pt-20 md:px-10 lg:grid-cols-[0.85fr_1.35fr_0.7fr] lg:px-14 xl:px-20">

        {/* GIANT BACKGROUND PLAYER NAME */}

        <div className="pointer-events-none absolute bottom-[-10px] left-[3%] z-0 select-none whitespace-nowrap text-[clamp(5rem,14vw,15rem)] font-black uppercase leading-[0.72] tracking-[-0.09em] text-slate-900/[0.055]">
          {playerName}
        </div>

        {/* LEFT — PLAYER INFORMATION */}

        <div className="relative z-30 flex min-h-0 flex-col justify-center py-8 lg:h-full lg:min-h-0">

          <p className="mb-4 text-xs font-bold uppercase tracking-[0.28em] text-slate-400">
            Player profile
          </p>

          <h1 className="max-w-xl text-6xl font-black uppercase leading-[0.82] tracking-[-0.065em] text-slate-950 md:text-7xl xl:text-8xl">

            <span className="block">
              {firstName}
            </span>

            {lastName && (
              <span className="block">
                {lastName}
              </span>
            )}

          </h1>

          <div className="mt-7 h-px w-24 bg-[#003399]" />

          <div className="mt-7 space-y-4 text-sm">

            {/* CLUB */}

            <div className="flex items-center gap-3 text-slate-600">

              {teamLogo ? (
                <img
                  src={teamLogo}
                  alt=""
                  className="h-6 w-6 object-contain"
                />
              ) : (
                <Building2 size={17} />
              )}

              <div>

                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  Club
                </p>

                <p className="font-bold text-slate-900">
                  {teamName}
                </p>

              </div>

            </div>

            {/* DATE OF BIRTH */}

            <div className="flex items-center gap-3 text-slate-600">

              <CalendarDays size={18} />

              <div>

                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  Date of birth
                </p>

                <p className="font-bold text-slate-900">
                  {formatDate(dateOfBirth)}
                  {age !== null
                    ? ` · ${age} years`
                    : ""}
                </p>

              </div>

            </div>

            {/* PLAYER ID */}

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

        {/* CENTER — PLAYER IMAGE */}

        <div className="relative z-20 flex h-full min-h-0 items-end justify-center overflow-visible">

          {/* AGE WATERMARK */}

          <div className="pointer-events-none absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-1/2 select-none text-[clamp(12rem,25vw,24rem)] font-black leading-none tracking-[-0.1em] text-[#003399]/[0.06]">
            {age ?? ""}
          </div>

          {/* PLAYER */}

          {photoUrl ? (
            <img
              src={photoUrl}
              alt={playerName}
              className="
                relative z-20
                w-auto max-w-none
                object-contain object-bottom
                drop-shadow-[0_30px_28px_rgba(15,23,42,0.22)]
                lg:absolute
                lg:left-1/2
                lg:bottom-0
                lg:h-[1100px]
                lg:w-auto
                lg:max-w-none
                lg:-translate-x-1/2
              "
            />
          ) : (
            <div className="relative z-20 flex h-[420px] w-[320px] items-center justify-center rounded-[2rem] border border-slate-300 bg-white/60 text-slate-300">
              <UsersPlaceholder />
            </div>
          )}

        </div>

        {/* RIGHT — CURRENT CLUB */}

        <aside className="relative z-30 flex min-h-0 flex-col justify-center py-8 lg:h-full lg:min-h-0">

          <div className="rounded-2xl border border-white/70 bg-white/70 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.07)] backdrop-blur-sm">

            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
              Current club
            </p>

            <div className="mt-5 flex items-center gap-4">

              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-slate-50">

                {teamLogo ? (
                  <img
                    src={teamLogo}
                    alt=""
                    className="h-12 w-12 object-contain"
                  />
                ) : (
                  <Building2
                    size={25}
                    className="text-slate-300"
                  />
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

    </main>
  );
}

function UsersPlaceholder() {
  return (
    <div className="flex flex-col items-center gap-3 text-center">

      <UserRound
        size={52}
        strokeWidth={1.2}
      />

      <span className="text-[10px] font-bold uppercase tracking-[0.18em]">
        Add player photo
      </span>

    </div>
  );
}
