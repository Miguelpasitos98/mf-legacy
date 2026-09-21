import React, { useMemo, useState } from "react";
import {
  Search,
  Globe,
  Star,
  TrendingUp,
  Map,
  CircleAlert,
  Plus,
  X,
  Shield,
  Building2,
  Users,
  Shirt,
  Palette,
  Database,
} from "lucide-react";

const navigationFilters = [
  { id: "countries", label: "Countries", icon: Globe },
  { id: "continents", label: "Continents", icon: Map },
  { id: "reputation", label: "Reputation", icon: Star },
  { id: "market", label: "Market", icon: TrendingUp },
  { id: "incomplete", label: "Incomplete", icon: CircleAlert },
];

const competitionDetails = {};

const emptyTeamForm = {
  name: "",
  shortName: "",
  country: "",
  countryId: "",
  continent: "Europe",
  city: "",
  logo: "",
  primaryColor: "",
  secondaryColor: "",
  foundedYear: "",
  stadium: "",
  stadiumId: "",
  stadiumCapacity: "",
  stadiumBuiltYear: "",
  stadiumRenovation: "",
  pitchDimensions: "",
  stadiumInteriorUrl: "",
  stadiumExteriorUrl: "",
  reputation: "Unclassified",
  market: "Unclassified",
  history: "",
  coachName: "",
  coachPhotoUrl: "",
  captainName: "",
  captainPhotoUrl: "",
  secondCaptainName: "",
  secondCaptainPhotoUrl: "",
  keyPlayerName: "",
  keyPlayerPhotoUrl: "",
  kit1PhotoUrl: "",
  kit1ShopUrl: "",
  kit1BadgeBg: "",
  kit1BadgeText: "",
  kit2PhotoUrl: "",
  kit2ShopUrl: "",
  kit2BadgeBg: "",
  kit2BadgeText: "",
  kit3PhotoUrl: "",
  kit3ShopUrl: "",
  kit3BadgeBg: "",
  kit3BadgeText: "",
  dataSource: "Manual",
  isActive: true,
};

const inputClassName =
  "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#003399] focus:ring-2 focus:ring-[#003399]/10";

const textareaClassName =
  "min-h-[104px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#003399] focus:ring-2 focus:ring-[#003399]/10";

function FormField({ label, children, hint }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}

function SectionHeader({ icon: Icon, title, description }) {
  return (
    <div className="mb-4 flex items-start gap-3 border-b border-slate-100 pb-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
        <Icon size={16} />
      </div>
      <div>
        <h3 className="text-sm font-extrabold text-slate-900">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      </div>
    </div>
  );
}

function TeamLogo({ team }) {
  if (team.logo) {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white">
        <img src={team.logo} alt={`${team.name} logo`} className="h-full w-full object-contain" />
      </div>
    );
  }

  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white">
      <span className="text-[10px] font-extrabold tracking-tight text-slate-800">{team.shortName || "FC"}</span>
    </div>
  );
}

function CompetitionHeader({ competitionName, teams }) {
  const competition = competitionDetails[competitionName] || { level: "Competition", logo: "FC" };

  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-[8px] font-black text-slate-700">
          {competition.logo}
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

function TeamCard({ team }) {
  return (
    <button
      type="button"
      className="group flex h-[64px] items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm"
    >
      <TeamLogo team={team} />
      <span className="min-w-0 truncate text-xs font-bold text-slate-800 transition group-hover:text-[#003399]">{team.name}</span>
    </button>
  );
}

function AddTeamModal({ form, setForm, onClose, onSubmit }) {
  const updateField = (field, value) => {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
  };

  const textField = (field, label, placeholder, options = {}) => (
    <FormField label={label} hint={options.hint}>
      <input
        type={options.type || "text"}
        value={form[field]}
        onChange={(event) => updateField(field, event.target.value)}
        placeholder={placeholder}
        className={inputClassName}
        min={options.min}
        max={options.max}
      />
    </FormField>
  );

  const selectField = (field, label, values) => (
    <FormField label={label}>
      <select value={form[field]} onChange={(event) => updateField(field, event.target.value)} className={inputClassName}>
        {values.map((value) => <option key={value} value={value}>{value}</option>)}
      </select>
    </FormField>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="add-team-title">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl md:p-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h2 id="add-team-title" className="text-lg font-extrabold text-slate-900">Add team</h2>
            <p className="mt-1 text-xs text-slate-500">Create a complete club profile manually.</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800" aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-7">
          <section>
            <SectionHeader icon={Shield} title="Basic information" description="Official identity and location of the club." />
            <div className="grid gap-4 md:grid-cols-2">
              {textField("name", "Team name *", "e.g. Real Madrid")}
              {textField("shortName", "Short name *", "e.g. RMA")}
              {textField("country", "Country name", "e.g. Spain", { hint: "Display value. The Base44 country ID can be added below." })}
              {textField("countryId", "Country ID (Base44)", "Internal Country record ID")}
              {selectField("continent", "Continent", ["Europe", "South America", "North America", "Asia", "Africa", "Oceania"])}
              {textField("city", "City", "e.g. Madrid")}
              {textField("foundedYear", "Founded year", "1902", { type: "number", min: 1800, max: 2100 })}
              {textField("logo", "Logo URL", "https://...")}
            </div>
          </section>

          <section>
            <SectionHeader icon={Palette} title="Identity & classification" description="Colors and internal club categories." />
            <div className="grid gap-4 md:grid-cols-2">
              {textField("primaryColor", "Primary color", "#FFFFFF")}
              {textField("secondaryColor", "Secondary color", "#000000")}
              {selectField("reputation", "Reputation", ["Elite", "High", "Medium", "Low", "Unclassified"])}
              {selectField("market", "Market", ["High", "Medium", "Low", "Unclassified"])}
            </div>
          </section>

          <section>
            <SectionHeader icon={Building2} title="Stadium" description="Main stadium information and images." />
            <div className="grid gap-4 md:grid-cols-2">
              {textField("stadium", "Stadium name", "e.g. Santiago Bernabéu")}
              {textField("stadiumId", "Stadium ID", "Internal Stadium record ID")}
              {textField("stadiumCapacity", "Capacity", "81000", { type: "number", min: 0 })}
              {textField("stadiumBuiltYear", "Built year", "1947", { type: "number", min: 1800, max: 2100 })}
              {textField("stadiumRenovation", "Last renovation year", "2024", { type: "number", min: 1800, max: 2100 })}
              {textField("pitchDimensions", "Pitch dimensions", "105 x 68 m")}
              {textField("stadiumInteriorUrl", "Interior image URL", "https://...")}
              {textField("stadiumExteriorUrl", "Exterior image URL", "https://...")}
            </div>
          </section>

          <section>
            <SectionHeader icon={Users} title="Staff & key players" description="Current personnel. Leave fields blank when unknown." />
            <div className="grid gap-4 md:grid-cols-2">
              {textField("coachName", "Coach name", "e.g. Coach name")}
              {textField("coachPhotoUrl", "Coach photo URL", "https://...")}
              {textField("captainName", "Captain name", "e.g. Captain name")}
              {textField("captainPhotoUrl", "Captain photo URL", "https://...")}
              {textField("secondCaptainName", "Second captain", "e.g. Second captain")}
              {textField("secondCaptainPhotoUrl", "Second captain photo URL", "https://...")}
              {textField("keyPlayerName", "Key player", "e.g. Player name")}
              {textField("keyPlayerPhotoUrl", "Key player photo URL", "https://...")}
            </div>
          </section>

          <section>
            <SectionHeader icon={Shirt} title="Kits" description="Home, away and third kit information." />
            <div className="space-y-5">
              {[1, 2, 3].map((kitNumber) => (
                <div key={kitNumber} className="rounded-xl border border-slate-200 p-4">
                  <h4 className="mb-3 text-xs font-extrabold uppercase tracking-wide text-slate-700">{kitNumber === 1 ? "First kit" : kitNumber === 2 ? "Second kit" : "Third kit"}</h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    {textField(`kit${kitNumber}PhotoUrl`, "Photo URL", "https://...")}
                    {textField(`kit${kitNumber}ShopUrl`, "Shop URL", "https://...")}
                    {textField(`kit${kitNumber}BadgeBg`, "Badge background", "#FFFFFF")}
                    {textField(`kit${kitNumber}BadgeText`, "Badge text color", "#000000")}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <SectionHeader icon={Database} title="History & status" description="Additional information and completion state." />
            <div className="space-y-4">
              <FormField label="Club history">
                <textarea value={form.history} onChange={(event) => updateField("history", event.target.value)} placeholder="Write the club history here..." className={textareaClassName} />
              </FormField>
              <div className="grid gap-4 md:grid-cols-2">
                {selectField("dataSource", "Data source", ["Manual", "Other"])}
                <FormField label="Active club">
                  <label className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm text-slate-700">
                    <input type="checkbox" checked={form.isActive} onChange={(event) => updateField("isActive", event.target.checked)} />
                    Team is active
                  </label>
                </FormField>
              </div>
            </div>
          </section>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-5">
            <button type="button" onClick={onClose} className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">Cancel</button>
            <button type="submit" className="flex h-10 items-center gap-2 rounded-xl bg-[#073B35] px-4 text-xs font-semibold text-white transition hover:bg-[#0A5047]">
              <Plus size={15} />
              Add team
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Teams() {
  const [teams, setTeams] = useState([]);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("countries");
  const [searchOpen, setSearchOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [form, setForm] = useState(emptyTeamForm);

  const filteredTeams = useMemo(() => {
    const normalizedSearch = search.toLowerCase().trim();

    return teams.filter((team) => {
      if (!normalizedSearch) return true;

      return [team.name, team.country, team.competition, team.city]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedSearch));
    });
  }, [teams, search]);

  const groupedTeams = useMemo(() => {
    const groups = {};

    filteredTeams.forEach((team) => {
      let groupName;

      if (activeFilter === "countries") groupName = team.country || "Unknown country";
      else if (activeFilter === "continents") groupName = team.continent || "Unknown continent";
      else if (activeFilter === "reputation") groupName = team.reputation || "Unclassified";
      else if (activeFilter === "market") groupName = team.market || "Unclassified";
      else if (activeFilter === "incomplete") {
        if (!team.incomplete) return;
        groupName = "Incomplete information";
      }

      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(team);
    });

    return groups;
  }, [filteredTeams, activeFilter]);

  const handleAddTeam = (event) => {
    event.preventDefault();

    const newTeam = {
      id: `manual-${Date.now()}`,
      name: form.name.trim(),
      shortName: form.shortName.trim().toUpperCase(),
      country: form.country.trim(),
      countryId: form.countryId.trim(),
      continent: form.continent,
      city: form.city.trim(),
      logo: form.logo.trim(),
      primaryColor: form.primaryColor.trim(),
      secondaryColor: form.secondaryColor.trim(),
      foundedYear: form.foundedYear ? Number(form.foundedYear) : null,
      stadium: form.stadium.trim(),
      stadiumId: form.stadiumId.trim(),
      stadiumCapacity: form.stadiumCapacity ? Number(form.stadiumCapacity) : null,
      stadiumBuiltYear: form.stadiumBuiltYear ? Number(form.stadiumBuiltYear) : null,
      stadiumRenovation: form.stadiumRenovation ? Number(form.stadiumRenovation) : null,
      pitchDimensions: form.pitchDimensions.trim(),
      stadiumInteriorUrl: form.stadiumInteriorUrl.trim(),
      stadiumExteriorUrl: form.stadiumExteriorUrl.trim(),
      reputation: form.reputation,
      market: form.market,
      history: form.history.trim(),
      coachName: form.coachName.trim(),
      coachPhotoUrl: form.coachPhotoUrl.trim(),
      captainName: form.captainName.trim(),
      captainPhotoUrl: form.captainPhotoUrl.trim(),
      secondCaptainName: form.secondCaptainName.trim(),
      secondCaptainPhotoUrl: form.secondCaptainPhotoUrl.trim(),
      keyPlayerName: form.keyPlayerName.trim(),
      keyPlayerPhotoUrl: form.keyPlayerPhotoUrl.trim(),
      kit1PhotoUrl: form.kit1PhotoUrl.trim(),
      kit1ShopUrl: form.kit1ShopUrl.trim(),
      kit1BadgeBg: form.kit1BadgeBg.trim(),
      kit1BadgeText: form.kit1BadgeText.trim(),
      kit2PhotoUrl: form.kit2PhotoUrl.trim(),
      kit2ShopUrl: form.kit2ShopUrl.trim(),
      kit2BadgeBg: form.kit2BadgeBg.trim(),
      kit2BadgeText: form.kit2BadgeText.trim(),
      kit3PhotoUrl: form.kit3PhotoUrl.trim(),
      kit3ShopUrl: form.kit3ShopUrl.trim(),
      kit3BadgeBg: form.kit3BadgeBg.trim(),
      kit3BadgeText: form.kit3BadgeText.trim(),
      dataSource: form.dataSource,
      isActive: form.isActive,
      incomplete: !form.name.trim() || !form.shortName.trim() || !form.countryId.trim() || !form.logo.trim(),
      competition: "Without competition",
    };

    setTeams((currentTeams) => [...currentTeams, newTeam]);
    setForm(emptyTeamForm);
    setAddModalOpen(false);
    setActiveFilter("countries");
  };

  const handleCloseSearch = () => {
    setSearch("");
    setSearchOpen(false);
  };

  return (
    <div className="min-h-full bg-[#F6F7F9] p-6 md:p-8">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {navigationFilters.map((filter) => {
            const Icon = filter.icon;
            const isActive = activeFilter === filter.id;

            return (
              <button key={filter.id} type="button" onClick={() => setActiveFilter(filter.id)} className={`flex h-10 items-center gap-2 rounded-xl border px-4 text-xs font-semibold transition ${isActive ? "border-[#073B35] bg-[#073B35] text-white shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"}`}>
                <Icon size={14} strokeWidth={1.8} />
                {filter.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {searchOpen && (
            <div className="relative w-[220px]">
              <Search size={16} strokeWidth={2} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Search teams..." value={search} onChange={(event) => setSearch(event.target.value)} autoFocus className={`${inputClassName} pl-9 pr-9 text-xs`} />
              <button type="button" onClick={handleCloseSearch} className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Close search">
                <X size={14} />
              </button>
            </div>
          )}

          <button type="button" onClick={() => setSearchOpen((open) => !open)} className={`flex h-10 w-10 items-center justify-center rounded-xl border transition ${searchOpen ? "border-[#073B35] bg-[#073B35] text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"}`} aria-label="Search teams" title="Search teams">
            {searchOpen ? <X size={17} strokeWidth={2} /> : <Search size={17} strokeWidth={2} />}
          </button>

          <button type="button" onClick={() => setAddModalOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#073B35] text-white transition hover:bg-[#0A5047]" aria-label="Add team" title="Add team">
            <Plus size={18} strokeWidth={2} />
          </button>
        </div>
      </div>

      {Object.keys(groupedTeams).length > 0 ? (
        <div className="space-y-5">
          {Object.entries(groupedTeams).map(([groupName, groupTeams]) => {
            const competitions = groupTeams.reduce((groups, team) => {
              const competition = team.competition || "Without competition";
              if (!groups[competition]) groups[competition] = [];
              groups[competition].push(team);
              return groups;
            }, {});

            return (
              <section key={groupName} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.02)] md:p-5">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <h2 className="text-base font-extrabold text-slate-900">{groupName}</h2>
                  <span className="text-xs font-medium text-slate-400">{groupTeams.length} {groupTeams.length === 1 ? "team" : "teams"}</span>
                </div>
                <div className="space-y-6">
                  {Object.entries(competitions).map(([competitionName, competitionTeams]) => (
                    <div key={competitionName}>
                      <CompetitionHeader competitionName={competitionName} teams={competitionTeams} />
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                        {competitionTeams.map((team) => <TeamCard key={team.id} team={team} />)}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-50"><CircleAlert size={22} className="text-slate-400" /></div>
          <h2 className="mt-4 text-base font-bold text-slate-800">No teams found</h2>
          <p className="mt-2 text-sm text-slate-500">Add your first team using the plus button.</p>
          <button type="button" onClick={() => setAddModalOpen(true)} className="mt-5 rounded-xl bg-[#073B35] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#0A5047]">Add first team</button>
        </div>
      )}

      {addModalOpen && <AddTeamModal form={form} setForm={setForm} onClose={() => setAddModalOpen(false)} onSubmit={handleAddTeam} />}
    </div>
  );
}
