import React from "react";
import { Search } from "lucide-react";

// Barra de control compacta de STATS. Mantiene exactamente los mismos
// controles, opciones y estados que tenía la página: solo cambia su presentación.
export default function StatsControlBar({
  season = "Todas",
  seasonOptions = [],
  onSeason = () => {},
  competition = "Todas",
  competitions = [],
  onCompetition = () => {},
  search = "",
  onSearch = () => {},
  sort = "composite",
  sortOptions = [],
  onSort = () => {},
  minMinutes = 0,
  onMinMinutes = () => {},
  viewMode = "season",
  onViewMode = () => {},
  seasonDisplay = "all",
  onSeasonDisplay = () => {},
  bestMetric = "composite",
  bestOptions = [],
  onBestMetric = () => {},
  categories = [],
  category = "Resumen",
  onCategory = () => {},
}) {
  return (
    <div className="mf-statsbar">
      <div className="filters">
        <label className="field">
          TEMPORADA
          <select className="season" value={season} onChange={(event) => onSeason(event.target.value)}>
            <option value="Todas">Todas</option>
            {seasonOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <label className="field">
          COMPETICIÓN
          <select
            className="competition"
            disabled={viewMode === "season"}
            title={viewMode === "season" ? "El resumen suma las competiciones de club disponibles" : "Filtra una competición"}
            value={competition}
            onChange={(event) => onCompetition(event.target.value)}
          >
            <option value="Todas">Todas</option>
            {competitions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <label className="field searchfield">
          BUSCAR JUGADOR, CLUB O ID
          <div className="searchbox">
            <Search size={13} aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Buscar en MY LEGACY…"
            />
          </div>
        </label>
        <label className="field">
          ORDENAR
          <select className="sort" value={sort} onChange={(event) => onSort(event.target.value)}>
            {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        {viewMode === "season" && (
          <label className="field">
            MÍNIMO DE MINUTOS
            <select className="minutes" value={minMinutes} onChange={(event) => onMinMinutes(Number(event.target.value))}>
              <option value={0}>Sin mínimo</option>
              <option value={500}>500 min</option>
              <option value={900}>900 min</option>
              <option value={1800}>1800 min</option>
            </select>
          </label>
        )}
      </div>
      <div className="lower">
        <div className="row playerrow">
          <span className="label">VISTA</span>
          <div className="group">
            <button
              type="button"
              aria-pressed={viewMode === "season"}
              className={"button" + (viewMode === "season" ? " selected" : "")}
              onClick={() => onViewMode("season")}
            >
              Temporadas
            </button>
            <button
              type="button"
              aria-pressed={viewMode === "competition"}
              className={"button" + (viewMode === "competition" ? " selected" : "")}
              onClick={() => onViewMode("competition")}
            >
              Competiciones
            </button>
          </div>
          {viewMode === "season" && <>
            <span className="divider" aria-hidden="true" />
            <span className="label players">JUGADORES</span>
            <div className="group">
              <button
                type="button"
                aria-pressed={seasonDisplay === "all"}
                className={"button" + (seasonDisplay === "all" ? " selected" : "")}
                onClick={() => onSeasonDisplay("all")}
              >
                Todas las temporadas
              </button>
              <button
                type="button"
                aria-pressed={seasonDisplay === "best"}
                className={"button" + (seasonDisplay === "best" ? " selected" : "")}
                onClick={() => onSeasonDisplay("best")}
              >
                Mejor temporada por jugador
              </button>
              <button
                type="button"
                aria-pressed={seasonDisplay === "current"}
                className={"button" + (seasonDisplay === "current" ? " selected" : "")}
                onClick={() => onSeasonDisplay("current")}
              >
                Temporada actual
              </button>
            </div>
          </>}
        </div>
        <div className="row">
          <div className="categories">
            {categories.map((label) => (
              <button
                key={label}
                type="button"
                aria-pressed={category === label}
                className={"category" + (category === label ? " selected" : "")}
                onClick={() => onCategory(label)}
              >
                {label}
              </button>
            ))}
          </div>
          {viewMode === "season" && seasonDisplay === "best" && (
            <label className="field">
              MEJOR POR
              <select className="sort" value={bestMetric} onChange={(event) => onBestMetric(event.target.value)}>
                {bestOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          )}
        </div>
      </div>
    </div>
  );
}