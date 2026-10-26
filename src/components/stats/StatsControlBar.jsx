import React, {useMemo,useState} from "react";
import { Search, RefreshCw } from "lucide-react";

function SearchableSort({value,options,onChange}){
  const [open,setOpen]=useState(false);
  const [query,setQuery]=useState("");
  const normalized=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  const selected=options.find(o=>o.value===value);
  const filtered=useMemo(()=>options.filter(o=>normalized(o.label+" "+o.group+" "+o.value).includes(normalized(query))),[options,query]);
  const choose=item=>{onChange(item.value);setOpen(false);setQuery("");};
  return <div className="relative min-w-[165px]">
    <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={()=>setOpen(x=>!x)} className="sort flex w-full items-center justify-between gap-2 text-left" title="Buscar indicador para ordenar el ranking">
      <span className="max-w-[180px] truncate">{selected?.label||"Elegir indicador"}</span><Search size={13}/>
    </button>
    {open&&<>
      <button type="button" tabIndex={-1} aria-label="Cerrar búsqueda de indicadores" onClick={()=>setOpen(false)} className="fixed inset-0 z-[30] cursor-default bg-transparent"/>
      <div className="absolute right-0 top-full z-[31] mt-1 w-[min(370px,90vw)] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
        <label className="block border-b border-slate-100 p-2">
          <span className="sr-only">Buscar estadística para ordenar</span>
          <input autoFocus type="search" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==="Escape")setOpen(false);if(e.key==="Enter"&&filtered.length===1)choose(filtered[0]);}} placeholder="Buscar: paradas, xG, duelos, goles..." className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" />
        </label>
        <div role="listbox" aria-label="Indicadores para ordenar" className="max-h-72 overflow-y-auto py-1">
          {filtered.map(item=><button type="button" role="option" aria-selected={value===item.value} key={item.value} onClick={()=>choose(item)} className={"flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs hover:bg-blue-50 "+(value===item.value?"bg-blue-50 font-bold text-blue-800":"text-slate-700")}>
            <span>{item.label}</span><span className="shrink-0 text-[10px] text-slate-400">{item.group}</span>
          </button>)}
          {!filtered.length&&<p className="p-4 text-xs text-slate-500">Sin indicadores coincidentes.</p>}
        </div>
      </div>
    </>}
  </div>;
}
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
  onRefresh = () => {},
  refreshing = false,
  position = "Todas",
  positionOptions = [],
  onPosition = () => {},
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
        <label className="field">
          POSICIÓN
          <select className="position" value={position} onChange={(event) => onPosition(event.target.value)} aria-label="Filtrar por posición">
            <option value="Todas">Todas las posiciones</option>
            {positionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="field searchfield mf-statsbar-search-compact">
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
          <SearchableSort value={sort} options={sortOptions} onChange={onSort}/>
        </label>
        <div className="field">
          <span className="text-[10px] font-semibold uppercase text-transparent select-none" aria-hidden="true">Actualizar</span>
          <button type="button" onClick={onRefresh} disabled={refreshing} title="Actualizar estadísticas y Composite desde Base44" className="flex h-[34px] items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-blue-200 bg-blue-50 px-3 text-[11px] font-bold text-blue-900 hover:bg-blue-100 disabled:opacity-50">
            <RefreshCw size={13} className={refreshing?"animate-spin":""}/> Actualizar datos
          </button>
        </div>
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