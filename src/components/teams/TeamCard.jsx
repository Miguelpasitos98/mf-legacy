import React, { useEffect, useState } from "react";
import { Building2, ChevronDown, Search, Plus } from "lucide-react";
import {
  competitionDetails,
  inputClassName,
  normalizeImageUrl,
  getCountryFlagUrl,
} from "./teamUtils";

export function TeamLogo({ team }) {
  const logoUrl = normalizeImageUrl(team.logo || team.logo_url || team.logoUrl);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [logoUrl]);

  if (logoUrl && !imageError) {
    return (
      <div className="flex h-16 w-16 shrink-0 items-center justify-center bg-transparent">
        <img
          src={logoUrl}
          alt={`${team.name} logo`}
          className="h-full w-full object-contain"
          loading="lazy"
          onError={() => setImageError(true)}
        />
      </div>
    );
  }

  return (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
      <span className="max-w-[90%] px-1 text-center text-[10px] font-extrabold leading-tight tracking-tight text-slate-800">
        {team.shortName || team.short_name || "FC"}
      </span>
    </div>
  );
}

export const TeamCard = React.memo(function TeamCard({
  team,
  onOpen,
  showReputation = false,
  selectionMode = false,
  isSelected = false,
  disabled = false,
}) {
  const reputationValue = Number(team?.reputation);
  const normalizedReputation = Number.isFinite(reputationValue) ? reputationValue : 0;

  return (
    <button
      type="button"
      onClick={() => onOpen(team)}
      disabled={disabled}
      aria-pressed={selectionMode ? isSelected : undefined}
      aria-label={selectionMode ? `${isSelected ? "Deseleccionar" : "Seleccionar"} ${team.name}` : undefined}
      className={`group relative flex min-h-[100px] w-full flex-col items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2.5 text-center transition hover:-translate-y-0.5 hover:shadow-sm disabled:cursor-wait disabled:opacity-60 ${selectionMode && isSelected ? "border-blue-500 bg-blue-50 ring-2 ring-blue-300" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"}`}
    >
      {selectionMode && (
        <span className={`absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-md border text-[11px] font-black ${isSelected ? "border-[#003399] bg-[#003399] text-white" : "border-slate-300 bg-white text-transparent"}`} aria-hidden="true">✓</span>
      )}
      <TeamLogo team={team} />
      <span className="w-full truncate text-[11px] font-bold text-slate-800 transition group-hover:text-[#003399]">
        {team.name}
      </span>
      {showReputation && (
        <span className="text-[10px] font-semibold text-slate-400">
          Reputation: {normalizedReputation}
        </span>
      )}
    </button>
  );
});

export function CompetitionHeader({ competitionName, teams }) {
  const competition = competitionDetails[competitionName] || { level: "Competition", logo: "" };
  const competitionLogo =
    teams.find((team) => team.competitionLogo)?.competitionLogo || competition.logo || "";

  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-50 p-1">
          {competitionLogo ? (
            <img src={competitionLogo} alt={`${competitionName} logo`} className="h-full w-full object-contain" />
          ) : (
            <span className="text-[8px] font-black text-slate-700">FC</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-sm font-bold text-slate-900">{competitionName || "Without competition"}</h3>
          <span className="text-xs text-slate-400">{competition.level}</span>
        </div>
      </div>
      <span className="shrink-0 text-xs font-medium text-slate-400">
        {teams.length} {teams.length === 1 ? "team" : "teams"}
      </span>
    </div>
  );
}

// Re-export for SearchableTeamSelect consumers that live outside this file.
export { SearchableTeamSelect } from "./TeamFormComponents";
export { inputClassName, normalizeImageUrl, getCountryFlagUrl };