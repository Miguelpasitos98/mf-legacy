import React from "react";
import { ArrowLeft, Menu, MapPin, CalendarDays, Trophy } from "lucide-react";

function safeColor(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeImageUrl(value) {
  if (!value) return "";
  const url = String(value).trim();
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

export default function TeamDetail({ team, onBack }) {
  const primary = safeColor(team.primaryColor || team.primary_color, "#151515");
  const secondary = safeColor(team.secondaryColor || team.secondary_color, "#E9EDF2");
  const logo = normalizeImageUrl(team.logo);
  const kit = normalizeImageUrl(
    team.kit1PhotoUrl || team.kit1_photo_url || team.kit1?.photo_url
  );
  const teamName = team.name || "Unnamed club";
  const shortName = team.shortName || team.short_name || teamName;
  const city = team.city || "";
  const country = team.country || "";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#dfe4eb] text-white">
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(76deg, ${primary} 0%, ${primary} 29%, #17191d 29%, #17191d 48%, ${secondary} 48%, ${secondary} 100%)`,
        }}
      />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_40%,rgba(255,255,255,0.4),transparent_30%)]" />
      <div className="absolute -right-[12%] top-[15%] h-[70%] w-[48%] rotate-[18deg] bg-white/10" />

      <header className="relative z-10 flex items-center justify-between px-6 py-5 md:px-12">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-white/85 transition hover:text-white"
        >
          <ArrowLeft size={16} />
          Back to teams
        </button>
        <div className="text-xs font-black tracking-[0.2em] text-white/80">MF LEGACY</div>
        <button
          type="button"
          className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-white/85"
          aria-label="Open team menu"
        >
          MENU <Menu size={16} />
        </button>
      </header>

      <section className="relative z-10 grid min-h-[calc(100vh-76px)] grid-cols-1 items-center gap-8 px-6 pb-12 pt-4 md:grid-cols-[1.05fr_1fr] md:px-12 lg:px-20">
        <div className="pointer-events-none absolute left-[5%] top-[18%] select-none text-[clamp(4rem,12vw,12rem)] font-black uppercase leading-[0.78] tracking-[-0.08em] text-white/90">
          {teamName}
        </div>

        <div className="relative z-20 flex min-h-[420px] flex-col justify-between py-8 md:min-h-[560px]">
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-white/65">Club profile</p>
            <h1 className="max-w-xl text-5xl font-black uppercase leading-[0.88] tracking-[-0.055em] text-white md:text-7xl lg:text-8xl">
              {teamName}
            </h1>
            <p className="mt-5 max-w-md text-sm font-medium uppercase tracking-[0.14em] text-white/70">
              {shortName}
              {city ? ` · ${city}` : ""}
              {country ? ` · ${country}` : ""}
            </p>
          </div>

          <div className="mt-10 flex items-center gap-4">
            {logo ? (
              <img src={logo} alt={`${teamName} crest`} className="h-20 w-20 object-contain" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center border border-white/40 text-xs font-black">FC</div>
            )}
            <div className="text-xs uppercase tracking-[0.18em] text-white/75">
              <p className="font-black text-white">{teamName}</p>
              <p className="mt-1">Official club profile</p>
            </div>
          </div>
        </div>

        <div className="relative z-20 flex min-h-[420px] items-center justify-center md:min-h-[560px]">
          {kit ? (
            <img
              src={kit}
              alt={`${teamName} home kit`}
              className="max-h-[580px] w-full max-w-[560px] object-contain drop-shadow-[0_28px_24px_rgba(0,0,0,0.35)]"
            />
          ) : (
            <div className="max-w-sm text-center text-xs font-bold uppercase tracking-[0.16em] text-black/45">
              Add the home kit image URL to display the shirt here.
            </div>
          )}
        </div>
      </section>

      <footer className="relative z-10 grid grid-cols-1 gap-3 border-t border-white/20 px-6 py-5 text-xs uppercase tracking-[0.12em] text-white/75 md:grid-cols-3 md:px-12 lg:px-20">
        <div className="flex items-center gap-2"><MapPin size={14} /> {city || "City unknown"}</div>
        <div className="flex items-center gap-2"><CalendarDays size={14} /> Founded {team.foundedYear || team.founded_year || "—"}</div>
        <div className="flex items-center gap-2"><Trophy size={14} /> {team.competition || "Club profile"}</div>
      </footer>
    </main>
  );
}
