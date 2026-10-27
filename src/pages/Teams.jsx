import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useOutletContext, useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCountriesQuery,
  useLeaguesQuery,
  useTeamsQuery,
} from "@/hooks/useSharedData";
import {
  Search,
  Globe,
  Star,
  TrendingUp,
  Map as MapIcon,
  CircleAlert,
  Plus,
  X,
  Users,
  Trash2,
  FileJson,
  Shirt,
} from "lucide-react";

import { base44 } from "@/api/base44Client";
import {
  careerStatusLogo,
  emptyTeamForm,
  formatMarketValue,
  numericValue,
  normalizeImageUrl,
  mapTeamToForm,
} from "@/components/teams/teamUtils";
import { TeamCard, CompetitionHeader } from "@/components/teams/TeamCard";
import { AddTeamModal, ImportTeamJsonModal } from "@/components/teams/TeamFormComponents";
import TeamDetail from "@/components/teams/TeamDetail";

const normalizeCountry = (country) => ({
  ...country,
  id: country?.id || country?._id || country?.data?.id || "",
  name: country?.name || "",
  code: country?.code || country?.country_code || "",
  continent: country?.continent || "",
});

const normalizeLeague = (league) => ({
  ...league,
  id: league?.id || league?._id || league?.data?.id || "",
  name: league?.name || "",
  shortName: league?.short_name || league?.shortName || "",
  countryId: league?.country_id || league?.countryId || "",
  level: league?.level ?? league?.league_level ?? "",
  reputation: league?.reputation ?? league?.league_reputation ?? 0,
  logo: league?.logo || league?.logo_url || "",
  isActive: league?.is_active ?? league?.isActive ?? true,
});

const navigationFilters = [
  { id: "countries", label: "Countries", icon: Globe },
  { id: "custom", label: "Mis clubes", icon: Shirt },
  { id: "continents", label: "Continents", icon: MapIcon },
  { id: "reputation", label: "Reputation", icon: Star },
  { id: "market", label: "Market", icon: TrendingUp },
  { id: "incomplete", label: "Incomplete", icon: CircleAlert },
  { id: "unattached", label: "Sin equipo", icon: Users },
];

export default function Teams() {
  const queryClient = useQueryClient();
  const navigateFromStats = useNavigate();
  const [statsQueryParams] = useSearchParams();
  const statsTeamId = statsQueryParams.get("stats_team");
  const countriesQuery = useCountriesQuery();
  const leaguesQuery = useLeaguesQuery();
  const teamsQuery = useTeamsQuery();

  const [unattachedPlayers, setUnattachedPlayers] = useState([]);
  const [unattachedError, setUnattachedError] = useState("");
  const [unattachedLoading, setUnattachedLoading] = useState(false);
  const [unattachedTab, setUnattachedTab] = useState("free_agent");
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("countries");
  const [searchOpen, setSearchOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [importJsonModalOpen, setImportJsonModalOpen] = useState(false);
  const [form, setForm] = useState(emptyTeamForm);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [editingTeam, setEditingTeam] = useState(null);
  const [editingLeague, setEditingLeague] = useState(null);
  const [leagueDraft, setLeagueDraft] = useState(null);
  const [leagueSaving, setLeagueSaving] = useState(false);
  const [leagueError, setLeagueError] = useState("");
  const [teamFormError, setTeamFormError] = useState("");
  const [bulkTeamsMode, setBulkTeamsMode] = useState(false);
  const [bulkTeamIds, setBulkTeamIds] = useState([]);
  const [bulkTeamsConfirmOpen, setBulkTeamsConfirmOpen] = useState(false);
  const [bulkTeamsBusy, setBulkTeamsBusy] = useState(false);
  const [bulkTeamsMessage, setBulkTeamsMessage] = useState("");

  // --- DATA LOADING ---

  useEffect(() => {
    if (activeFilter !== "unattached") return;
    let cancelled = false;
    setUnattachedLoading(true);
    base44.entities.Player.filter({
      $or: [
        { career_status: { $in: ["free_agent", "retired"] } },
        { team_id: { $in: [null, ""] } },
      ],
    }, { limit: 1000 }).then((result) => {
      if (cancelled) return;
      const rows = Array.isArray(result) ? result : (result?.data || result?.items || []);
      setUnattachedPlayers(rows.filter((p) => ["free_agent", "retired"].includes(p.career_status) || (!p.team_id && !p.teamId)));
      setUnattachedError("");
      setUnattachedLoading(false);
    }).catch((err) => { if (!cancelled) { setUnattachedError(err?.message || "No se pudieron cargar los jugadores"); setUnattachedLoading(false); } });
    return () => { cancelled = true; };
  }, [activeFilter]);

  useEffect(() => {
    if (editingTeam) setForm(mapTeamToForm(editingTeam));
  }, [editingTeam]);

  const { setTeamTheme, setSidebarVisible } = useOutletContext() || {};

  useEffect(() => {
    if (!setTeamTheme) return;
    if (!selectedTeam) {
      setTeamTheme({ primaryColor: "#003399", secondaryColor: "#FFFFFF" });
      if (setSidebarVisible) setSidebarVisible(true);
      return;
    }
    const primaryColor = selectedTeam.primaryColor || selectedTeam.primary_color || "#063B78";
    const secondaryColor = selectedTeam.secondaryColor || selectedTeam.secondary_color || "#941638";
    setTeamTheme({ primaryColor, secondaryColor });
  }, [selectedTeam, setTeamTheme, setSidebarVisible]);

  const countries = useMemo(
    () => (countriesQuery.data || []).map(normalizeCountry),
    [countriesQuery.data]
  );

  const leagues = useMemo(
    () => (leaguesQuery.data || []).map(normalizeLeague).filter((league) => league.id && league.name && league.isActive !== false),
    [leaguesQuery.data]
  );

  const teams = useMemo(() => {
    const rawTeams = teamsQuery.data || [];
    if (!rawTeams.length) return [];

    const countryByIdMap = new Map();
    for (const country of countries) {
      const key = String(country.id || "");
      if (key && !countryByIdMap.has(key)) countryByIdMap.set(key, country);
    }
    const leagueByIdMap = new Map();
    for (const league of leagues) {
      const key = String(league.id || "");
      if (key && !leagueByIdMap.has(key)) leagueByIdMap.set(key, league);
    }

    return rawTeams.map((team) => {
      const teamId = team.id || team._id || "";
      const teamCountryId = team.country_id || team.countryId || "";
      const country = countryByIdMap.get(String(teamCountryId));
      const leagueId = team.league_id || team.leagueId || "";
      const league = leagueByIdMap.get(String(leagueId));
      return {
        ...team,
        id: teamId,
        name: team.name || "",
        shortName: team.short_name || team.shortName || "",
        countryId: teamCountryId,
        country: team.country || team.country_name || team.countryName || country?.name || "Unknown country",
        countryCode: team.country_code || team.countryCode || country?.code || "",
        continent: team.continent || country?.continent || "Unknown continent",
        city: team.city || "",
        logo: team.logo || team.logo_url || "",
        primaryColor: team.primary_color || team.primaryColor || "",
        secondaryColor: team.secondary_color || team.secondaryColor || "",
        foundedYear: team.founded_year || team.foundedYear || null,
        stadium: team.stadium || "",
        stadiumId: team.stadium_id || team.stadiumId || "",
        stadiumCapacity: team.stadium_capacity || team.stadiumCapacity || null,
        stadiumBuiltYear: team.stadium_built_year || team.stadiumBuiltYear || null,
        stadiumRenovation: team.stadium_renovation || team.stadiumRenovation || null,
        pitchDimensions: team.pitch_dimensions || team.pitchDimensions || "",
        stadiumInteriorUrl: team.stadium_interior_url || team.stadiumInteriorUrl || "",
        stadiumExteriorUrl: team.stadium_exterior_url || team.stadiumExteriorUrl || "",
        reputation: numericValue(team.reputation, "0"),
        market: formatMarketValue(team.market, ""),
        history: team.history || "",
        coachName: team.coach_name || team.coachName || "",
        coachPhotoUrl: team.coach_photo_url || team.coachPhotoUrl || "",
        captainName: team.captain_name || team.captainName || "",
        captainPhotoUrl: team.captain_photo_url || team.captainPhotoUrl || "",
        secondCaptainName: team.second_captain_name || team.secondCaptainName || "",
        secondCaptainPhotoUrl: team.second_captain_photo_url || team.secondCaptainPhotoUrl || "",
        keyPlayerName: team.key_player_name || team.keyPlayerName || "",
        keyPlayerPhotoUrl: team.key_player_photo_url || team.keyPlayerPhotoUrl || "",
        isCustomClub: team.is_custom_club ?? team.isCustomClub ?? false,
        dataSource: team.data_source || team.dataSource || "Manual",
        isActive: team.is_active ?? team.isActive ?? true,
        leagueId,
        competition: league?.name || "Without competition",
        competitionLogo: league?.logo || "",
        competitionLevel: league?.level !== undefined && league?.level !== null && league?.level !== "" ? Number(league.level) : 999,
        incomplete: !team.name || !team.short_name || !teamCountryId || !team.logo,
      };
    });
  }, [teamsQuery.data, countries, leagues]);

  useEffect(() => {
    if (!statsTeamId) return;
    const found = teams.find((t) => String(t.id) === String(statsTeamId));
    if (found) setSelectedTeam(found);
  }, [statsTeamId, teams]);

  const isLoading = countriesQuery.isLoading || leaguesQuery.isLoading || teamsQuery.isLoading;
  const loadError = (countriesQuery.error || leaguesQuery.error || teamsQuery.error)
    ? "No se han podido cargar los datos. Comprueba tu conexión e inténtalo de nuevo."
    : "";

  // --- DERIVED DATA (memoized) ---

  const filteredTeams = useMemo(() => {
    const normalizedSearch = search.toLowerCase().trim();

    const getReputation = (team) => {
      const rawValue = team?.reputation;
      if (rawValue === null || rawValue === undefined || String(rawValue).trim() === "") return null;
      const value = Number(rawValue);
      return Number.isFinite(value) ? value : null;
    };

    return teams
      .filter((team) => {
        if (!normalizedSearch) return true;
        return [team.name, team.country, team.competition, team.city]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch));
      })
      .sort((a, b) => {
        const reputationA = getReputation(a);
        const reputationB = getReputation(b);
        if (reputationA === null && reputationB !== null) return 1;
        if (reputationA !== null && reputationB === null) return -1;
        if (reputationA !== null && reputationB !== null && reputationA !== reputationB) return reputationB - reputationA;
        return String(a?.name || "").localeCompare(String(b?.name || ""), "es", { sensitivity: "base" });
      });
  }, [teams, search]);

  const leagueByIdMap = useMemo(
    () => new Map(leagues.map((league) => [String(league?.id || ""), league])),
    [leagues]
  );

  const teamByIdMap = useMemo(
    () => new Map(teams.map((team) => [String(team?.id || ""), team])),
    [teams]
  );

  const countryReputationMap = useMemo(() => {
    const normalize = (value) =>
      String(value || "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const map = new Map();

    for (const country of countries) {
      const countryKeys = new Set(
        [country?.id, country?.name, country?.code, country?.country_code]
          .filter(Boolean)
          .map(normalize)
      );

      let maxReputation = 0;
      for (const league of leagues) {
        if (Number(league?.level) !== 1) continue;
        const leagueCountryKeys = [league?.countryId, league?.country_id].filter(Boolean).map(normalize);
        if (leagueCountryKeys.some((key) => countryKeys.has(key))) {
          const reputation = Number(league?.reputation);
          if (Number.isFinite(reputation) && reputation > maxReputation) maxReputation = reputation;
        }
      }

      for (const key of countryKeys) {
        if (!map.has(key) || maxReputation > map.get(key)) map.set(key, maxReputation);
      }
    }
    return map;
  }, [countries, leagues]);

  const groupedTeams = useMemo(() => {
    const normalizeComparable = (value) =>
      String(value || "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

    const getCountryReputation = (countryId, countryName, countryCode) => {
      for (const key of [countryId, countryName, countryCode]) {
        if (!key) continue;
        const reputation = countryReputationMap.get(normalizeComparable(key));
        if (reputation !== undefined) return reputation;
      }
      return 0;
    };

    if (activeFilter === "reputation") {
      const reputationRanges = [
        { key: "Elite", min: 9000, max: 9500 },
        { key: "World Class", min: 8750, max: 8999 },
        { key: "Top", min: 8500, max: 8749 },
        { key: "Very Strong", min: 8250, max: 8499 },
        { key: "Strong", min: 8000, max: 8249 },
        { key: "High", min: 7500, max: 7999 },
        { key: "Competitive", min: 7000, max: 7499 },
        { key: "Solid", min: 6000, max: 6999 },
        { key: "Mid", min: 5000, max: 5999 },
        { key: "Low", min: 4000, max: 4999 },
        { key: "Very Low", min: 3000, max: 3999 },
        { key: "Minor", min: 0, max: 2999 },
      ];

      const getReputationGroup = (value) => {
        if (value === null || value === undefined || String(value).trim() === "") return "Unclassified";
        const reputation = Number(value);
        if (!Number.isFinite(reputation)) return "Unclassified";
        return reputationRanges.find((range) => reputation >= range.min && reputation <= range.max)?.key || "Unclassified";
      };

      const groupedReputationTeams = reputationRanges.reduce((result, range) => { result[range.key] = []; return result; }, {});

      filteredTeams.forEach((team) => {
        const groupName = getReputationGroup(team?.reputation);
        groupedReputationTeams[groupName].push(team);
      });

      Object.keys(groupedReputationTeams).forEach((groupName) => {
        groupedReputationTeams[groupName].sort((a, b) => {
          const reputationA = Number(a?.reputation);
          const reputationB = Number(b?.reputation);
          const normalizedReputationA = Number.isFinite(reputationA) ? reputationA : 0;
          const normalizedReputationB = Number.isFinite(reputationB) ? reputationB : 0;
          if (normalizedReputationA !== normalizedReputationB) return normalizedReputationB - normalizedReputationA;
          return (a?.name || "").localeCompare(b?.name || "", "es", { sensitivity: "base" });
        });
      });

      return Object.fromEntries(Object.entries(groupedReputationTeams).filter(([, groupTeams]) => groupTeams.length > 0));
    }

    const groups = {};

    filteredTeams.forEach((team) => {
      let groupName;
      if (activeFilter === "countries") {
        groupName = team.country || "Unknown country";
      } else if (activeFilter === "continents") {
        groupName = team.continent || "Unknown continent";
      } else if (activeFilter === "market") {
        groupName = team.market || "Unclassified";
      } else if (activeFilter === "incomplete") {
        if (!team.incomplete) return;
        groupName = "Incomplete information";
      }
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(team);
    });

    const entries = Object.entries(groups);

    if (activeFilter !== "countries") return Object.fromEntries(entries);

    entries.sort(([countryA, teamsA], [countryB, teamsB]) => {
      const teamA = teamsA?.[0] || {};
      const teamB = teamsB?.[0] || {};
      const reputationA = getCountryReputation(teamA.countryId, teamA.country, teamA.countryCode);
      const reputationB = getCountryReputation(teamB.countryId, teamB.country, teamB.countryCode);
      if (reputationA !== reputationB) return reputationB - reputationA;
      return String(countryA || "").localeCompare(String(countryB || ""), "es", { sensitivity: "base" });
    });

    return Object.fromEntries(entries);
  }, [filteredTeams, activeFilter, leagues, countries, countryReputationMap]);

  const bulkTeamIdSet = useMemo(() => new Set(bulkTeamIds), [bulkTeamIds]);

  const selectedBulkTeams = useMemo(
    () => teams.filter((team) => bulkTeamIdSet.has(String(team.id))),
    [teams, bulkTeamIdSet]
  );

  const visibleBulkTeamIds = useMemo(
    () => filteredTeams.map((team) => String(team.id)).filter(Boolean),
    [filteredTeams]
  );

  const toggleBulkTeam = useCallback((id) => {
    if (bulkTeamsBusy) return;
    const value = String(id);
    setBulkTeamIds((previous) => previous.includes(value) ? previous.filter((item) => item !== value) : [...previous, value]);
    setBulkTeamsMessage("");
  }, [bulkTeamsBusy]);

  const handleTeamOpen = useCallback((team) => {
    if (bulkTeamsMode) toggleBulkTeam(team.id);
    else setSelectedTeam(team);
  }, [bulkTeamsMode, toggleBulkTeam]);

  const unattachedTabPlayers = useMemo(() => {
    const normalizedSearch = search.toLowerCase().trim();
    return unattachedPlayers
      .filter((p) => (p.career_status || (!p.team_id && !p.teamId ? "free_agent" : "active")) === unattachedTab)
      .filter((p) => !normalizedSearch || String(p.name || "").toLowerCase().includes(normalizedSearch));
  }, [unattachedPlayers, unattachedTab, search]);

  const unattachedCounts = useMemo(() => {
    const counts = { free_agent: 0, retired: 0 };
    for (const p of unattachedPlayers) {
      const status = p.career_status || (!p.team_id && !p.teamId ? "free_agent" : "active");
      if (counts[status] !== undefined) counts[status] += 1;
    }
    return counts;
  }, [unattachedPlayers]);

  const openLeagueEditor = (league) => {
    if (!league?.id) return;
    setLeagueDraft({name:league.name||"",country_id:league.countryId||league.country_id||"",reputation:String(league.reputation??""),logo:league.logo||""});
    setLeagueError("");
    setEditingLeague(league);
  };
  const closeLeagueEditor = () => {
    if(leagueSaving)return;
    setEditingLeague(null);setLeagueDraft(null);setLeagueError("");
  };
  const saveLeague = async (event) => {
    event.preventDefault();
    if(!editingLeague?.id||!leagueDraft||leagueSaving)return;
    const reputation=Number(leagueDraft.reputation);
    if(!leagueDraft.name.trim()||!leagueDraft.country_id||!Number.isInteger(reputation)||reputation<0||reputation>10000){
      setLeagueError("Completa nombre, país y reputación entre 0 y 10000.");return;
    }
    const logo=leagueDraft.logo.trim();
    if(logo&&!/^https?:\/\//i.test(logo)){setLeagueError("Introduce una URL http(s) para la imagen.");return;}
    setLeagueSaving(true);setLeagueError("");
    try{
      await base44.entities.League.update(editingLeague.id,{name:leagueDraft.name.trim(),country_id:leagueDraft.country_id,reputation,logo});
      await queryClient.invalidateQueries({queryKey:["mf-legacy","leagues"]});
      setEditingLeague(null);setLeagueDraft(null);
    }catch(error){setLeagueError(error?.response?.data?.message||error?.message||"No se pudo guardar la liga.");}
    finally{setLeagueSaving(false);}
  };

  // --- HANDLERS ---

  const handleOpenAddTeam = () => {
    setTeamFormError("");
    setEditingTeam(null);
    setForm({ ...emptyTeamForm });
    setAddModalOpen(true);
  };

  const handleImportJson = (importedForm) => {
    setTeamFormError("");
    setForm(importedForm);
    setImportJsonModalOpen(false);
    setAddModalOpen(true);
  };

  const toggleVisibleTeams = () => {
    if (bulkTeamsBusy) return;
    const allVisibleSelected = visibleBulkTeamIds.every((id) => bulkTeamIds.includes(id));
    setBulkTeamIds((previous) => allVisibleSelected ? previous.filter((id) => !visibleBulkTeamIds.includes(id)) : [...new Set([...previous, ...visibleBulkTeamIds])]);
  };

  const deleteSelectedTeams = async () => {
    if (bulkTeamsBusy || !bulkTeamsConfirmOpen || !selectedBulkTeams.length) return;
    const targets = [...selectedBulkTeams];
    setBulkTeamsBusy(true);
    const deletedIds = [];
    const errors = [];
    try {
      for (const team of targets) {
        try {
          await base44.entities.Team.delete(team.id);
          deletedIds.push(String(team.id));
        } catch (error) {
          errors.push(`${team.name}: ${error?.message || "Error desconocido"}`);
        }
      }
      if (deletedIds.length) {
        queryClient.invalidateQueries({ queryKey: ["mf-legacy", "teams"] });
        setBulkTeamIds((previous) => previous.filter((id) => !deletedIds.includes(id)));
      }
      setBulkTeamsMessage(`${deletedIds.length} de ${targets.length} equipos eliminados.${errors.length ? ` No se pudieron eliminar ${errors.length}: ${errors.slice(0, 3).join(" · ")}` : ""}`);
    } finally {
      setBulkTeamsBusy(false);
      setBulkTeamsConfirmOpen(false);
    }
  };

  const handleCloseSearch = () => {
    setSearch("");
    setSearchOpen(false);
  };

  const handleAddTeam = async (event) => {
    event.preventDefault();
    setTeamFormError("");
    const wasEditing = Boolean(editingTeam);

    const newTeam = {
      id: `manual-${Date.now()}`,
      name: form.name.trim(),
      shortName: form.shortName.trim().toUpperCase(),
      country: form.country.trim(),
      countryId: form.countryId.trim(),
      countryCode: form.countryCode.trim().toUpperCase(),
      countryMapUrl: form.countryMapUrl.trim(),
      countryTeamMapUrl: form.countryTeamMapUrl.trim(),
      locationMapUrl: form.locationMapUrl.trim(),
      leagueId: form.leagueId.trim(),
      newLeagueName: form.newLeagueName.trim(),
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
      reputation: Number(form.reputation || 0),
      market: formatMarketValue(form.market, ""),
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
      kitsOverviewUrl: form.kitsOverviewUrl.trim(),
      dataSource: form.dataSource,
      isCustomClub: Boolean(form.isCustomClub),
      isActive: form.isActive,
      incomplete: !form.name.trim() || !form.shortName.trim() || !form.country.trim() || !form.logo.trim(),
      competition: "Without competition",
    };

    try {
      if (!form.name.trim() || !form.shortName.trim() || !form.country.trim()) {
        setTeamFormError("El nombre, el código corto y el país son obligatorios.");
        return;
      }

      let countryId = form.countryId.trim();
      const normalizedCountryName = form.country.trim().toLowerCase();
      const existingCountry = countries.find((country) => country.name?.trim().toLowerCase() === normalizedCountryName);

      if (!countryId && existingCountry?.id) countryId = existingCountry.id;

      if (!countryId) {
        if (!form.countryCode.trim()) {
          setTeamFormError("Introduce el código de país para crearlo automáticamente.");
          return;
        }
        const createdCountry = await base44.entities.Country.create({
          name: form.country.trim(),
          code: form.countryCode.trim().toUpperCase(),
          continent: form.continent || "Europe",
          is_active: true,
        });
        const countryData = createdCountry?.data || createdCountry;
        countryId = countryData?.id || countryData?._id || createdCountry?.id || createdCountry?._id || "";
        if (!countryId) {
          setTeamFormError("El país se creó, pero Base44 no devolvió su identificador. Actualiza el listado antes de reintentar.");
          return;
        }
        queryClient.invalidateQueries({ queryKey: ["mf-legacy", "countries"] });
      }

      newTeam.countryId = countryId;

      let leagueId = newTeam.leagueId;
      let selectedLeague = leagues.find((league) => String(league.id) === String(leagueId));

      if (!leagueId && newTeam.newLeagueName) {
        const existingLeague = leagues.find((league) => league.name?.trim().toLowerCase() === newTeam.newLeagueName.toLowerCase());
        if (existingLeague?.id) {
          leagueId = existingLeague.id;
          selectedLeague = existingLeague;
        } else {
          const createdLeague = await base44.entities.League.create({
            name: newTeam.newLeagueName,
            league_level: 1,
            level: 1,
            reputation: 0,
            country_id: countryId,
            is_active: true,
            status: "Incompleto",
          });
          leagueId = createdLeague?.id || createdLeague?.data?.id || createdLeague?._id || "";
          if (!leagueId) {
            setTeamFormError("La competición se creó, pero Base44 no devolvió su identificador. Actualiza y comprueba la lista antes de reintentar.");
            return;
          }
          selectedLeague = { ...createdLeague, id: leagueId, name: newTeam.newLeagueName };
          queryClient.invalidateQueries({ queryKey: ["mf-legacy", "leagues"] });
        }
      }

      if (!leagueId) {
        setTeamFormError("Selecciona o crea una competición antes de guardar el club.");
        return false;
      }

      const generatedCode = newTeam.shortName.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12) || `TEAM${Date.now()}`;

      const savedTeam = editingTeam
        ? await base44.entities.Team.update(editingTeam.id, {
            name: newTeam.name, short_name: newTeam.shortName, code: generatedCode, continent: newTeam.continent || "Europe",
            country_id: countryId, league_id: leagueId, city: newTeam.city, logo: newTeam.logo,
            country_map_url: newTeam.countryMapUrl, country_team_map_url: newTeam.countryTeamMapUrl, location_map_url: newTeam.locationMapUrl,
            primary_color: newTeam.primaryColor, secondary_color: newTeam.secondaryColor,
            kit1_photo_url: newTeam.kit1PhotoUrl, kit2_photo_url: newTeam.kit2PhotoUrl, kit3_photo_url: newTeam.kit3PhotoUrl,
            founded_year: newTeam.foundedYear, stadium_id: newTeam.stadiumId, stadium: newTeam.stadium,
            stadium_capacity: newTeam.stadiumCapacity, stadium_built_year: newTeam.stadiumBuiltYear, stadium_renovation: newTeam.stadiumRenovation,
            pitch_dimensions: newTeam.pitchDimensions, stadium_interior_url: newTeam.stadiumInteriorUrl, stadium_exterior_url: newTeam.stadiumExteriorUrl,
            reputation: String(newTeam.reputation ?? ""), market: String(newTeam.market ?? ""), history: newTeam.history,
            coach_name: newTeam.coachName, coach_photo_url: newTeam.coachPhotoUrl, captain_name: newTeam.captainName, captain_photo_url: newTeam.captainPhotoUrl,
            second_captain_name: newTeam.secondCaptainName, second_captain_photo_url: newTeam.secondCaptainPhotoUrl,
            key_player_name: newTeam.keyPlayerName, key_player_photo_url: newTeam.keyPlayerPhotoUrl,
            data_source: newTeam.dataSource, is_custom_club: newTeam.isCustomClub, is_active: newTeam.isActive,
          })
        : await base44.entities.Team.create({
            name: newTeam.name, short_name: newTeam.shortName, code: generatedCode, continent: newTeam.continent || "Europe",
            country_id: countryId, league_id: leagueId, city: newTeam.city, logo: newTeam.logo,
            country_map_url: newTeam.countryMapUrl, country_team_map_url: newTeam.countryTeamMapUrl, location_map_url: newTeam.locationMapUrl,
            primary_color: newTeam.primaryColor, secondary_color: newTeam.secondaryColor,
            kit1_photo_url: newTeam.kit1PhotoUrl, kit2_photo_url: newTeam.kit2PhotoUrl, kit3_photo_url: newTeam.kit3PhotoUrl,
            founded_year: newTeam.foundedYear, stadium_id: newTeam.stadiumId, stadium: newTeam.stadium,
            stadium_capacity: newTeam.stadiumCapacity, stadium_built_year: newTeam.stadiumBuiltYear, stadium_renovation: newTeam.stadiumRenovation,
            pitch_dimensions: newTeam.pitchDimensions, stadium_interior_url: newTeam.stadiumInteriorUrl, stadium_exterior_url: newTeam.stadiumExteriorUrl,
            reputation: String(newTeam.reputation ?? ""), market: String(newTeam.market ?? ""), history: newTeam.history,
            coach_name: newTeam.coachName, coach_photo_url: newTeam.coachPhotoUrl, captain_name: newTeam.captainName, captain_photo_url: newTeam.captainPhotoUrl,
            second_captain_name: newTeam.secondCaptainName, second_captain_photo_url: newTeam.secondCaptainPhotoUrl,
            key_player_name: newTeam.keyPlayerName, key_player_photo_url: newTeam.keyPlayerPhotoUrl,
            data_source: newTeam.dataSource, is_custom_club: newTeam.isCustomClub, is_active: newTeam.isActive,
          });

      const updatedTeam = { ...newTeam, id: savedTeam.id, competition: selectedLeague?.name || "Without competition", leagueId };

      queryClient.invalidateQueries({ queryKey: ["mf-legacy", "teams"] });

      if (wasEditing) setSelectedTeam(updatedTeam);

      setForm(emptyTeamForm);
      setEditingTeam(null);
      setAddModalOpen(false);
      setActiveFilter("countries");
      return true;
    } catch (error) {
      console.error("Error saving team:", error);
      const errorMessage = error?.response?.data?.message || error?.response?.data?.error || error?.message || (typeof error === "string" ? error : JSON.stringify(error));
      setTeamFormError(`Error al guardar el equipo: ${errorMessage}`);
      return false;
    }
  };

  // --- RENDER ---

  if (selectedTeam) {
    return (
      <TeamDetail
        team={selectedTeam}
        onClose={() => {
          setSelectedTeam(null);
          if (statsTeamId) navigateFromStats("/teams", { replace: true });
        }}
        onEdit={(team) => setEditingTeam(team)}
        form={form}
        setForm={setForm}
        countries={countries}
        leagues={leagues}
        onCloseEdit={() => setEditingTeam(null)}
        onSubmit={handleAddTeam}
        formError={teamFormError}
      />
    );
  }

  return (
    <div className="min-h-full bg-[#F6F7F9] p-6 md:p-8">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {navigationFilters.map((filter) => {
            const Icon = filter.icon;
            const isActive = activeFilter === filter.id;
            return (
              <button key={filter.id} type="button" onClick={() => setActiveFilter(filter.id)} className={`flex h-10 items-center gap-2 rounded-xl border px-4 text-xs font-semibold transition ${isActive ? "border-[#073B35] bg-[#003399] text-white shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"}`}>
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
              <input type="text" placeholder="Search teams..." value={search} onChange={(event) => setSearch(event.target.value)} autoFocus className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-9 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#003399] focus:ring-2 focus:ring-[#003399]/10" />
              <button type="button" onClick={handleCloseSearch} className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Close search"><X size={14} /></button>
            </div>
          )}
          <button type="button" onClick={() => setSearchOpen((open) => !open)} className={`flex h-10 w-10 items-center justify-center rounded-xl border transition ${searchOpen ? "border-[#073B35] bg-[#003399] text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"}`} aria-label="Search teams" title="Search teams">{searchOpen ? <X size={17} strokeWidth={2} /> : <Search size={17} strokeWidth={2} />}</button>
          <button type="button" disabled={bulkTeamsBusy} onClick={() => { setBulkTeamsMode((previous) => !previous); setBulkTeamIds([]); setBulkTeamsMessage(""); setBulkTeamsConfirmOpen(false); }} className={`h-10 whitespace-nowrap rounded-xl border px-3 text-xs font-bold transition ${bulkTeamsMode ? "border-[#003399] bg-blue-50 text-[#003399]" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>{bulkTeamsMode ? "Terminar selección" : "Selección múltiple"}</button>
          <button type="button" onClick={() => setImportJsonModalOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50" aria-label="Import team from text or JSON" title="Import team from text or JSON"><FileJson size={17} strokeWidth={2} /></button>
          <button type="button" onClick={handleOpenAddTeam} className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#003399] text-white transition hover:bg-[#002477]" aria-label="Add team" title="Add team"><Plus size={18} strokeWidth={2} /></button>
        </div>
      </div>

      {activeFilter === "custom" && (
        <section className="mb-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">Mis clubes</h2>
              <p className="mt-1 text-sm text-slate-500">Equipos creados por ti. Abre una ficha para consultar o editar su información.</p>
            </div>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
              {teams.filter(team => team.isCustomClub).length} clubes
            </span>
          </div>
          {!teams.some(team => team.isCustomClub) ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <Shirt size={28} className="mx-auto mb-3 text-slate-300"/>
              <p className="text-sm font-bold text-slate-800">Todavía no hay clubes creados por ti</p>
              <p className="mt-2 text-xs text-slate-500">En la ficha de un club activa la casilla «Es un club ficticio o creado por mí».</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {teams.filter(team => team.isCustomClub && (
                !search.trim() || [team.name,team.country,team.city,team.competition]
                  .some(value => String(value || "").toLocaleLowerCase("es").includes(search.trim().toLocaleLowerCase("es")))
              )).sort((a,b)=>a.name.localeCompare(b.name,"es")).map(team => (
                <button key={team.id} type="button" onClick={()=>handleTeamOpen(team)}
                  className="group min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md">
                  <div className="relative flex h-36 items-center justify-center overflow-hidden p-5"
                    style={{background:`linear-gradient(135deg, ${/^#[0-9a-f]{6}$/i.test(team.primaryColor||"")?team.primaryColor+"18":"#f8fafc"}, #ffffff)`}}>
                    {team.logo
                      ? <img src={normalizeImageUrl(team.logo)} alt={team.name+" escudo"} loading="lazy" className="relative z-10 h-28 w-28 object-contain drop-shadow-sm"/>
                      : <Shirt size={48} className="text-slate-300"/>}
                  </div>
                  <div className="border-t border-slate-100 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-extrabold text-slate-900">{team.name}</h3>
                        <p className="mt-1 truncate text-xs text-slate-500">{[team.city,team.country].filter(Boolean).join(" · ")}</p>
                      </div>
                      <span className="shrink-0 rounded-md bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-800">{team.shortName || "FC"}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                      <span className="truncate text-[11px] text-slate-500">{team.competition||"Sin competición"}</span>
                      <span className="shrink-0 text-[11px] font-semibold text-[#003399]">Ver ficha</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      )}
      {bulkTeamsMode && (
        <div className="mb-5 rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <strong className="text-sm text-[#003399]">{selectedBulkTeams.length} equipos seleccionados</strong>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={bulkTeamsBusy || !visibleBulkTeamIds.length} onClick={toggleVisibleTeams} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50">{visibleBulkTeamIds.length && visibleBulkTeamIds.every((id) => bulkTeamIds.includes(id)) ? "Deseleccionar visibles" : `Seleccionar visibles (${visibleBulkTeamIds.length})`}</button>
              <button type="button" disabled={bulkTeamsBusy || !bulkTeamIds.length} onClick={() => setBulkTeamIds([])} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50">Deseleccionar todos</button>
            </div>
          </div>
          <div className="mt-3 border-t border-blue-200 pt-3">
            <button type="button" disabled={bulkTeamsBusy || !selectedBulkTeams.length} onClick={() => setBulkTeamsConfirmOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"><Trash2 size={15} /> Eliminar seleccionados ({selectedBulkTeams.length})</button>
            <p className="mt-2 text-xs text-slate-500">Se solicitará una segunda confirmación antes de borrar ningún equipo.</p>
          </div>
        </div>
      )}
      {bulkTeamsMessage && <div role="status" className="mb-5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-700">{bulkTeamsMessage}</div>}

      {activeFilter === "unattached" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-black text-slate-900">Jugadores sin equipo</h2><p className="text-xs text-slate-500">Agentes libres y retirados: no se crean equipos ficticios.</p></div><div className="flex gap-2">{[{id:"free_agent",title:"Agentes libres"},{id:"retired",title:"Retirados"}].map(tab=><button type="button" key={tab.id} onClick={()=>setUnattachedTab(tab.id)} className={`rounded-xl px-4 py-2 text-xs font-bold ${unattachedTab===tab.id ? "bg-[#003399] text-white" : "border border-slate-200 bg-slate-50 text-slate-700"}`}><img src={careerStatusLogo(tab.id)} alt="" className="mr-1.5 inline-block h-5 w-5 align-middle" />{tab.title} ({unattachedCounts[tab.id] || 0})</button>)}</div></div>
          {unattachedError && <p className="mb-3 text-sm text-red-600">{unattachedError}</p>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{unattachedTabPlayers.map(p=><div key={p.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3"><div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-slate-100"><img src={normalizeImageUrl(p.photo_url || p.photoUrl) || careerStatusLogo(unattachedTab)} alt="" className="h-full w-full object-contain" /></div><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900">{p.name}</p><p className="flex items-center gap-1 text-[11px] font-semibold text-slate-500"><img src={careerStatusLogo(unattachedTab)} alt="" className="h-4 w-4" />{unattachedTab === "retired" ? "Retirado" : "Agente libre"}</p><p className="text-xs text-slate-500">Último club: {teamByIdMap.get(String(p.last_team_id || ""))?.name || "No registrado"}</p>{unattachedTab==="retired" && p.retirement_year && <p className="text-xs text-slate-400">Retirado en {p.retirement_year}</p>}</div></div>)}</div>
          {unattachedLoading ? (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[72px] animate-pulse rounded-xl border border-slate-200 bg-slate-100" />)}
            </div>
          ) : unattachedTabPlayers.length === 0 && <p className="mt-4 rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">No se encontraron jugadores en esta categoría.</p>}
        </section>
      ) : loadError ? (
        <div className="rounded-2xl border border-rose-200 bg-white px-6 py-16 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50"><CircleAlert size={22} className="text-rose-400" /></div>
          <h2 className="mt-4 text-base font-bold text-slate-800">No se han podido cargar los datos</h2>
          <p className="mt-2 text-sm text-slate-500">{loadError}</p>
        </div>
      ) : isLoading ? (
        <div className="space-y-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-4 h-5 w-40 animate-pulse rounded bg-slate-100"></div>
              <div className="grid grid-cols-2 gap-2 xl:grid-cols-6">
                {Array.from({ length: 6 }).map((_, j) => (
                  <div key={j} className="h-[100px] animate-pulse rounded-xl bg-slate-100"></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : activeFilter === "custom" ? null : Object.keys(groupedTeams).length > 0 ? (
        <div className="space-y-5">
          {Object.entries(groupedTeams).map(([groupName, groupTeams]) => {
            if (activeFilter === "reputation") {
              return (
                <section key={groupName} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_2px_8px_rgba(15,23,42,0.02)] md:p-4">
                  <div className="mb-5 flex items-center justify-between gap-4">
                    <h2 className="text-base font-extrabold text-slate-900">{groupName}</h2>
                    <span className="text-xs font-medium text-slate-400">{groupTeams.length} {groupTeams.length === 1 ? "team" : "teams"}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-6 2xl:grid-cols-6">
                    {groupTeams.map((team) => (
                      <TeamCard key={team.id} team={team} showReputation selectionMode={bulkTeamsMode} isSelected={bulkTeamIdSet.has(String(team.id))} disabled={bulkTeamsBusy} onOpen={handleTeamOpen} />
                    ))}
                  </div>
                </section>
              );
            }

            const competitions = groupTeams.reduce((groups, team) => {
              const competition = team.competition || "Without competition";
              if (!groups[competition]) groups[competition] = [];
              groups[competition].push(team);
              return groups;
            }, {});

            return (
              <section key={groupName} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_2px_8px_rgba(15,23,42,0.02)] md:p-4">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <h2 className="text-base font-extrabold text-slate-900">{groupName}</h2>
                  <span className="text-xs font-medium text-slate-400">{groupTeams.length} {groupTeams.length === 1 ? "team" : "teams"}</span>
                </div>
                <div className="space-y-4">
                  {Object.entries(competitions)
                    .sort(([competitionNameA, teamsA], [competitionNameB, teamsB]) => {
                      const teamA = teamsA?.[0] || {};
                      const teamB = teamsB?.[0] || {};
                      const leagueA = leagueByIdMap.get(String(teamA?.leagueId || ""));
                      const leagueB = leagueByIdMap.get(String(teamB?.leagueId || ""));
                      const levelA = Number(leagueA?.level ?? teamA?.competitionLevel ?? 999);
                      const levelB = Number(leagueB?.level ?? teamB?.competitionLevel ?? 999);
                      const normalizedLevelA = Number.isFinite(levelA) ? levelA : 999;
                      const normalizedLevelB = Number.isFinite(levelB) ? levelB : 999;
                      if (normalizedLevelA !== normalizedLevelB) return normalizedLevelA - normalizedLevelB;
                      return String(competitionNameA || "").localeCompare(String(competitionNameB || ""), "es", { sensitivity: "base" });
                    })
                    .map(([competitionName, competitionTeams]) => {
                      const sortedTeams = [...(competitionTeams || [])].sort((a, b) => {
                        const reputationA = Number(a?.reputation);
                        const reputationB = Number(b?.reputation);
                        const normalizedReputationA = Number.isFinite(reputationA) ? reputationA : 0;
                        const normalizedReputationB = Number.isFinite(reputationB) ? reputationB : 0;
                        if (normalizedReputationA !== normalizedReputationB) return normalizedReputationB - normalizedReputationA;
                        return (a.name || "").localeCompare(b.name || "", "es", { sensitivity: "base" });
                      });
                      return (
                        <div key={competitionName}>
                          <CompetitionHeader competitionName={competitionName} teams={sortedTeams} league={leagueByIdMap.get(String(sortedTeams[0]?.leagueId||""))} onEdit={openLeagueEditor} />
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-6 2xl:grid-cols-6">
                            {sortedTeams.map((team) => (
                              <TeamCard key={team.id} team={team} selectionMode={bulkTeamsMode} isSelected={bulkTeamIdSet.has(String(team.id))} disabled={bulkTeamsBusy} onOpen={handleTeamOpen} />
                            ))}
                          </div>
                        </div>
                      );
                    })}
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
          <button type="button" onClick={handleOpenAddTeam} className="mt-5 rounded-xl bg-[#003399] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#002477]">Add first team</button>
        </div>
      )}

      {editingLeague && leagueDraft && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/50 p-4" onMouseDown={event=>{if(event.target===event.currentTarget)closeLeagueEditor();}}>
          <section role="dialog" aria-modal="true" aria-labelledby="edit-league-title" className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div><h2 id="edit-league-title" className="text-lg font-extrabold text-slate-900">Editar competición</h2><p className="text-xs text-slate-500">Se conservan el ID y los equipos vinculados.</p></div>
              <button type="button" disabled={leagueSaving} onClick={closeLeagueEditor} className="rounded-lg px-3 py-2 text-xs text-slate-600 hover:bg-slate-100">Cerrar</button>
            </div>
            <form onSubmit={saveLeague} className="space-y-4">
              <label className="block text-xs font-semibold text-slate-700">Nombre<input required value={leagueDraft.name} onChange={event=>setLeagueDraft(d=>({...d,name:event.target.value}))} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"/></label>
              <label className="block text-xs font-semibold text-slate-700">País
                <select required value={leagueDraft.country_id} onChange={event=>setLeagueDraft(d=>({...d,country_id:event.target.value}))} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm">
                  <option value="">Seleccionar país</option>
                  {countries.map(country=><option key={country.id} value={country.id}>{country.name}</option>)}
                </select>
              </label>
              <label className="block text-xs font-semibold text-slate-700">Reputación (0–10000)<input type="number" min="0" max="10000" step="1" required value={leagueDraft.reputation} onChange={event=>setLeagueDraft(d=>({...d,reputation:event.target.value}))} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"/></label>
              <label className="block text-xs font-semibold text-slate-700">URL del escudo<input type="url" value={leagueDraft.logo} placeholder="https://..." onChange={event=>setLeagueDraft(d=>({...d,logo:event.target.value}))} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"/></label>
              {leagueDraft.logo&&<div className="flex h-28 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-3"><img src={normalizeImageUrl(leagueDraft.logo)} alt="Vista previa" className="h-full max-w-full object-contain"/></div>}
              {leagueError&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{leagueError}</p>}
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" disabled={leagueSaving} onClick={closeLeagueEditor} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold">Cancelar</button>
                <button type="submit" disabled={leagueSaving} className="rounded-lg bg-[#003399] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{leagueSaving?"Guardando…":"Guardar competición"}</button>
              </div>
            </form>
          </section>
        </div>
      )}
      {(addModalOpen || editingTeam) && (
        <AddTeamModal form={form} setForm={setForm} countries={countries} leagues={leagues} isEditing={Boolean(editingTeam)} formError={teamFormError} onClose={() => { setTeamFormError(""); setAddModalOpen(false); setEditingTeam(null); }} onSubmit={handleAddTeam} />
      )}
      {bulkTeamsConfirmOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" role="presentation">
          <div role="alertdialog" aria-modal="true" aria-labelledby="bulk-delete-team-title" aria-describedby="bulk-delete-team-description" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600"><Trash2 size={21} /></div>
              <h2 id="bulk-delete-team-title" className="text-lg font-black text-slate-900">¿Eliminar {selectedBulkTeams.length} {selectedBulkTeams.length === 1 ? "equipo" : "equipos"}?</h2>
            </div>
            <p id="bulk-delete-team-description" className="text-sm leading-6 text-slate-600">Esta acción es permanente. Se eliminarán los equipos seleccionados de Base44. Los jugadores o relaciones que apunten a estos clubes pueden quedar sin una asociación válida.</p>
            <div className="mt-4 max-h-32 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              {selectedBulkTeams.slice(0, 15).map((team) => <div key={team.id} className="py-0.5">• {team.name}</div>)}
              {selectedBulkTeams.length > 15 && <div className="mt-1 font-semibold">Y {selectedBulkTeams.length - 15} equipos más…</div>}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" disabled={bulkTeamsBusy} onClick={() => setBulkTeamsConfirmOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-40">Cancelar</button>
              <button type="button" disabled={bulkTeamsBusy || !selectedBulkTeams.length} onClick={deleteSelectedTeams} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-40">{bulkTeamsBusy ? "Eliminando..." : `Sí, eliminar ${selectedBulkTeams.length}`}</button>
            </div>
          </div>
        </div>
      )}
      {importJsonModalOpen && <ImportTeamJsonModal onClose={() => setImportJsonModalOpen(false)} onImport={handleImportJson} />}
    </div>
  );
}