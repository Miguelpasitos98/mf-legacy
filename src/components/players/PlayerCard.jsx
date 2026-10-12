/**
 * MF LEGACY — Optimized PlayerCard + GroupHeader
 *
 * Performance:
 * - Wrapped in React.memo so cards only re-render when their props change.
 * - Photos use loading="lazy" to defer off-screen image fetches.
 * - All per-card computations (legacy title, positions, age) run only on
 *   actual re-render, not on every parent render.
 */
import React, { memo } from "react";
import { Users, Building2, Globe2 } from "lucide-react";
import {
  careerStatusLogo,
  normalizeImageUrl,
  calculateAge,
  ageCircleColor,
  getPrimaryPosition,
  getPlayerCardPositions,
  computePlayerDescription,
  computeLegacyTitle,
} from "./playerUtils";

function PlayerCard({
  player,
  team,
  country,
  onSelect,
  selectionMode = false,
  selected = false,
  onToggleSelection,
  compact = false,
  hideTeam = false,
  useNationalCardPhoto = false,
}) {
  const preferredCardPhoto = useNationalCardPhoto
    ? player.nationalCardPhotoUrl || player.cardPhotoUrl || player.photoUrl
    : player.cardPhotoUrl || player.photoUrl;

  const photoUrl = normalizeImageUrl(preferredCardPhoto);
  const cardCareerStatus = player?.career_status || (player?.teamId || player?.team_id ? "active" : "free_agent");
  const teamLogo = cardCareerStatus !== "active" ? careerStatusLogo(cardCareerStatus) : normalizeImageUrl(team?.logo);
  const teamDisplayName = cardCareerStatus === "retired" ? "Retirado" : cardCareerStatus === "free_agent" ? "Agente libre" : (team?.name || "No club associated");

  const age = calculateAge(player.dateOfBirth);
  const legacyTitle = computeLegacyTitle({ ...player, age: age ?? undefined });
  const cardPositions = getPlayerCardPositions(player);
  const description = computePlayerDescription(player);

  const countryFlagUrl = normalizeImageUrl(country?.flag);
  const countryCode = String(country?.code || "").trim().toLowerCase();
  const fallbackFlagUrl = !countryFlagUrl && countryCode.length === 2 ? `https://flagcdn.com/${countryCode}.svg` : "";

  return (
    <button
      type="button"
      onClick={selectionMode ? () => onToggleSelection?.(player.id) : () => onSelect?.(player)}
      className={`group w-full overflow-hidden rounded-2xl border ${selected ? "border-blue-700 ring-2 ring-blue-300" : "border-slate-200"} bg-white text-left shadow-[0_2px_8px_rgba(15,23,42,0.02)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_12px_30px_rgba(15,23,42,0.07)] ${compact ? "" : ""}`}
    >
      {selectionMode && <div className="flex items-center gap-2 border-b border-slate-100 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-900"><span className={`inline-flex h-4 w-4 items-center justify-center rounded border ${selected ? "bg-blue-700 text-white border-blue-700" : "border-slate-400 bg-white"}`}>{selected ? "✓" : ""}</span>{selected ? "Seleccionado" : "Seleccionar jugador"}</div>}
      {/* PHOTO */}
      <div className={`relative w-full overflow-hidden bg-slate-50 ${compact ? "aspect-[5/4]" : "aspect-[4/3]"}`}>
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={player.name || "Player"}
            loading="lazy"
            className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.025]"
            onError={(event) => { event.currentTarget.style.display = "none"; }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Users size={56} strokeWidth={1.25} className="text-slate-200" />
          </div>
        )}
      </div>

      {/* INFO */}
      <div className={`border-t border-slate-100 ${compact ? "px-3 pb-3 pt-2.5" : "px-4 pb-4 pt-3"}`}>
        {/* NAME + FLAG */}
        <div className="flex min-w-0 items-center gap-2">
          {countryFlagUrl || fallbackFlagUrl ? (
            <img
              src={countryFlagUrl || fallbackFlagUrl}
              alt={country?.name || ""}
              className="h-4 w-6 shrink-0 rounded-[2px] object-cover"
              loading="lazy"
            />
          ) : null}

          <h3 className={`player-display-title min-w-0 truncate ${compact ? "text-sm" : "text-base"}`}>
            {player.name || "Unnamed player"}
          </h3>
        </div>

        {/* LEGACY TITLE + CA/CP */}
        <div className={`${compact ? "mt-1.5" : "mt-2"} flex min-w-0 items-center gap-1.5 text-xs`}>
          <span className="shrink-0 font-semibold text-slate-900">{legacyTitle}</span>
          <span className="shrink-0 text-slate-300">|</span>
          <span className="shrink-0 font-semibold text-slate-500">
            {player.ca !== "" && player.ca != null ? player.ca : "—"} / {player.cp !== "" && player.cp != null ? player.cp : "—"}
          </span>
        </div>

        {/* AGE + POSITION RATINGS */}
        <div className={`${compact ? "mt-1.5" : "mt-2"} flex min-w-0 items-start gap-1.5 text-xs`}>
          <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${ageCircleColor(age)}`} />
          <span className="shrink-0 font-semibold text-slate-700">{age ?? "—"}</span>

          {cardPositions.length > 0 && (
            <>
              <span className="shrink-0 text-slate-300">|</span>
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-slate-700">
                {cardPositions.map(({ key, label, rating }, index) => (
                  <React.Fragment key={key}>
                    {index > 0 && <span className="shrink-0 text-slate-300">·</span>}
                    <span
                      className={`shrink-0 whitespace-nowrap ${rating === 20 ? "font-extrabold text-slate-800" : "font-normal text-slate-500"}`}
                      title={`${label}: ${rating}/20`}
                    >
                      {label}
                    </span>
                  </React.Fragment>
                ))}
              </div>
            </>
          )}
        </div>

        {/* DESCRIPTION */}
        {description && (
          <div className={`${compact ? "mt-1" : "mt-1.5"} min-w-0 break-words text-xs font-medium leading-4 text-slate-500`}>
            {description}
          </div>
        )}

        {/* CLUB */}
        {!hideTeam && (
          <div className={`${compact ? "mt-2" : "mt-3"} flex min-w-0 items-center gap-2 text-xs text-slate-400`}>
            {teamLogo ? (
              <img src={teamLogo} alt="" className="h-4 w-4 shrink-0 object-contain" loading="lazy" />
            ) : (
              <Building2 size={14} strokeWidth={1.7} className="shrink-0" />
            )}
            <span className="truncate">{teamDisplayName}</span>
          </div>
        )}
      </div>
    </button>
  );
}

function GroupHeader({ type, name, logo, code, count }) {
  const normalizedLogo = normalizeImageUrl(logo);

  return (
    <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white">
          {normalizedLogo ? (
            <img src={normalizedLogo} alt="" className="h-7 w-7 object-contain" />
          ) : type === "team" ? (
            <Building2 size={18} className="text-slate-400" />
          ) : (
            <Globe2 size={18} className="text-slate-400" />
          )}
        </div>

        <div className="min-w-0">
          <h2 className="truncate text-base font-extrabold tracking-tight text-slate-900">{name}</h2>
          {code && <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">{code}</p>}
        </div>
      </div>

      <div className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        {count} {count === 1 ? "player" : "players"}
      </div>
    </div>
  );
}

export default memo(PlayerCard);
export { GroupHeader };