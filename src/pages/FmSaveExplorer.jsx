import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Database, Download, FileUp, Loader2, Search, ShieldCheck, Users, X } from "lucide-react";
import { buildFmSaveIndex, findFmPlayers, findFmClubs, filterFmTeamDetails, buildFmExport } from "@/utils/fmSaveSearch.mjs";

const fmNumber = (value) => Number.isFinite(value) ? Math.round(value) : "—";
const smallNumber = (value) => Number(value || 0).toLocaleString("es-ES");
const filenamePart = (value) => String(value || "seleccion").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 75) || "seleccion";

function downloadSelection(payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function DataBadge({ label, value }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-3">
    <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
    <strong className="mt-1 block text-xl font-black tabular-nums text-[#003399]">{value ?? "—"}</strong>
  </div>;
}

const STAGES = {
  boot: "Preparando Python y fmsave en el navegador...",
  open: "Abriendo la partida de Football Manager...",
  players: "Leyendo los jugadores de la partida...",
  indexing: "Creando el buscador...",
};

export default function FmSaveExplorer() {
  const workerRef = useRef(null);
  const generationRef = useRef(0);
  const pendingRef = useRef(new Map());
  const detailCacheRef = useRef(new Map());
  const metaRef = useRef(null);
  const pickerRef = useRef(null);
  const [reader, setReader] = useState(null);
  const [stage, setStage] = useState("boot");
  const [fileName, setFileName] = useState("");
  const [meta, setMeta] = useState(null);
  const [index, setIndex] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mode, setMode] = useState("player");
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState(null);
  const [playerDetail, setPlayerDetail] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [exportProgress, setExportProgress] = useState({ done: 0, total: 0 });
  const [firstTeamOnly, setFirstTeamOnly] = useState(true);

  useEffect(() => {
    const worker = new Worker("/fmsave/worker.js", { type: "module" });
    workerRef.current = worker;
    worker.onmessage = ({ data: message }) => {
      if (message.generation !== undefined && message.generation !== generationRef.current) return;
      if (message.type === "ready") {
        setReader({ fmsave: message.fmsave, pyodide: message.pyodide });
        setStage("idle");
      } else if (message.type === "stage") {
        setStage(message.stage);
      } else if (message.type === "meta") {
        metaRef.current = message.meta;
        setMeta(message.meta);
      } else if (message.type === "players") {
        setStage("indexing");
        try {
          setIndex(buildFmSaveIndex(message));
          setStage("ready");
          setWarnings(message.warnings || []);
        } catch (caught) {
          setError(caught.message);
          setStage("failed");
        }
      } else if (message.type === "stats") {
        if (message.warnings?.length) setWarnings(current => [...current, ...message.warnings]);
      } else if (message.type === "detail") {
        detailCacheRef.current.set(String(message.uid), message.detail);
        const pending = pendingRef.current.get(String(message.uid));
        if (pending) {
          pendingRef.current.delete(String(message.uid));
          pending.resolve(message.detail);
        }
      } else if (message.type === "error") {
        if (message.request === "stats") {
          setWarnings(current => [...current, "Las estadísticas de temporada no pudieron leerse. Los datos de jugadores siguen disponibles."]);
        } else if (message.request === "detail") {
          const pending = pendingRef.current.get(String(message.uid));
          if (pending) {
            pendingRef.current.delete(String(message.uid));
            pending.reject(new Error(message.text));
          }
        } else {
          setError(message.text || "No se ha podido leer la partida.");
          setStage("failed");
        }
      }
    };
    worker.onerror = () => {
      setError("El lector de Football Manager se ha detenido. Recarga esta página para volver a iniciarlo.");
      setStage("failed");
    };
    worker.postMessage({
      type: "boot",
      base: new URL("/fmsave/", window.location.href).href,
      version: "mf-legacy-1",
    });
    return () => {
      pendingRef.current.forEach(({ reject }) => reject(new Error("El lector se ha cerrado.")));
      pendingRef.current.clear();
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const readFile = (file) => {
    if (!file || !reader || ["boot", "open", "players", "indexing"].includes(stage) || downloading) return;
    if (!/\.fm$/i.test(file.name)) {
      setError("Selecciona una partida .fm de Football Manager 26 o 27.");
      return;
    }
    generationRef.current += 1;
    pendingRef.current.forEach(({ reject }) => reject(new Error("Se ha cargado otra partida.")));
    pendingRef.current.clear();
    detailCacheRef.current.clear();
    metaRef.current = null;
    setFileName(file.name);
    setMeta(null);
    setIndex(null);
    setSelection(null);
    setPlayerDetail(null);
    setError("");
    setNotice("");
    setWarnings([]);
    setQuery("");
    setExportProgress({ done: 0, total: 0 });
    setStage("open");
    workerRef.current?.postMessage({ type: "open", file, generation: generationRef.current });
  };

  const requestDetail = (uid) => {
    const key = String(uid);
    if (detailCacheRef.current.has(key)) return Promise.resolve(detailCacheRef.current.get(key));
    if (!workerRef.current || !index) return Promise.reject(new Error("Primero carga una partida válida."));
    return new Promise((resolve, reject) => {
      const previous = pendingRef.current.get(key);
      if (previous) {
        const originalResolve = previous.resolve;
        const originalReject = previous.reject;
        previous.resolve = data => { originalResolve(data); resolve(data); };
        previous.reject = error => { originalReject(error); reject(error); };
        return;
      }
      pendingRef.current.set(key, { resolve, reject });
      workerRef.current.postMessage({ type: "detail", uid, generation: generationRef.current });
    });
  };

  const showPlayer = async (rowIndex) => {
    const uid = index?.uid[rowIndex];
    if (!Number.isFinite(uid)) return;
    setSelection({ type: "player", index: rowIndex });
    setPlayerDetail(null);
    setError("");
    try {
      const detail = await requestDetail(uid);
      if (detailCacheRef.current.get(String(uid)) === detail) setPlayerDetail(detail);
    } catch (caught) {
      setError(caught.message);
    }
  };

  const chooseClub = club => {
    setSelection({ type: "club", club });
    setPlayerDetail(null);
    setFirstTeamOnly(true);
    setError("");
  };

  const playerResults = useMemo(() => mode === "player" ? findFmPlayers(index, query) : [], [index, mode, query]);
  const clubResults = useMemo(() => mode === "club" ? findFmClubs(index, query) : [], [index, mode, query]);
  const selectedClubMembers = useMemo(() => {
    if (!index || selection?.type !== "club") return [];
    return selection.club.members.filter(i => !firstTeamOnly || index.teamSlot[i] === 0)
      .sort((a, b) => (index.ca[b] || 0) - (index.ca[a] || 0));
  }, [firstTeamOnly, index, selection]);

  const exportJson = async () => {
    if (!selection || downloading || !index) return;
    const indexes = selection.type === "player" ? [selection.index] : selectedClubMembers;
    if (!indexes.length) {
      setError("Esta selección no contiene jugadores que cumplan el filtro.");
      return;
    }
    setDownloading(true);
    setError("");
    setNotice("");
    setExportProgress({ done: 0, total: indexes.length });
    try {
      const details = [];
      // Small batches keep a large youth squad from queuing thousands of worker messages.
      for (let start = 0; start < indexes.length; start += 16) {
        const group = indexes.slice(start, start + 16);
        details.push(...await Promise.all(group.map(i => requestDetail(index.uid[i]))));
        setExportProgress({ done: details.length, total: indexes.length });
      }
      const included = selection.type === "club" ? filterFmTeamDetails(details, firstTeamOnly) : details;
      if (!included.length) throw new Error("No se encontraron jugadores del primer equipo en estos registros.");
      const identifier = selection.type === "player" ? index.names[selection.index] : selection.club.name;
      const selectionInfo = selection.type === "player"
        ? { type: "player", uid: index.uid[selection.index], name: identifier }
        : { type: "club_players", club_uid: selection.club.uid, club_name: identifier, first_team_only: firstTeamOnly };
      const data = buildFmExport({ meta: metaRef.current, selection: selectionInfo, details: included });
      const game = (metaRef.current?.game || "FM").toLowerCase();
      const suffix = selection.type === "club" ? (firstTeamOnly ? "_first_team" : "_all_teams") : "";
      downloadSelection(data, `${game}_${filenamePart(identifier)}${suffix}.json`);
      setNotice(`JSON descargado: ${included.length} jugador(es) con todos los campos disponibles y sus estadísticas de temporada, si existen.`);
    } catch (caught) {
      setError(caught.message || "No se ha podido generar la descarga.");
    } finally {
      setDownloading(false);
    }
  };

  const working = ["boot", "open", "players", "indexing"].includes(stage);

  return <div className="mf-page-scroll min-h-full bg-[#f7f9fc] p-4 text-slate-800 md:p-7">
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#003399]">MF LEGACY · STUDIO</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-[#0d315b] md:text-3xl">Explorador Football Manager</h1>
          <p className="mt-1 text-sm text-slate-600">Busca jugadores o plantillas de FM26 y FM27 y descarga un JSON completo sin salir de MF Legacy.</p>
        </div>
        <a className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-[#003399] hover:bg-blue-50"
          href="https://github.com/rhiever/fmsave" target="_blank" rel="noreferrer">Motor fmsave · MIT ↗</a>
      </header>

      <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-3"><div className="rounded-xl bg-blue-50 p-3 text-[#003399]"><FileUp size={22} /></div>
          <div><h2 className="font-bold text-slate-900">1. Cargar una partida .fm</h2>
            <p className="text-xs text-slate-500">El archivo se lee en tu navegador; no se sube a Base44 ni se almacena en el servidor.</p></div></div>
        <div onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); readFile(event.dataTransfer.files?.[0]); }}
          className="rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/30 p-6 text-center">
          <input ref={pickerRef} type="file" accept=".fm" className="hidden" onChange={event => { readFile(event.target.files?.[0]); event.target.value = ""; }} />
          <button type="button" disabled={working || downloading || !reader} onClick={() => pickerRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-xl bg-[#003399] px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-50">
            {working ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} />}
            {fileName ? "Cambiar partida" : "Seleccionar archivo .fm"}
          </button>
          <p className="mt-2 text-xs text-slate-500">{fileName || "También puedes arrastrar aquí tu partida guardada."}</p>
          {working && <p role="status" className="mt-3 text-sm font-semibold text-[#003399]">{STAGES[stage]}</p>}
        </div>
        {meta && <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <DataBadge label="Juego" value={meta.game || "—"} />
          <DataBadge label="Versión de fmsave" value={meta.fmsave || reader?.fmsave} />
          <DataBadge label="Jugadores encontrados" value={index ? smallNumber(index.count) : "…"} />
          <p className="col-span-full text-xs text-slate-500">Build: {meta.build || "—"} · Fecha de partida: {meta.date || "—"}</p>
        </div>}
        {index && <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-emerald-700"><CheckCircle2 size={16} />Datos disponibles para consultar y descargar.</p>}
        {meta?.game === "FM27" && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          FM27 tiene campos aún no verificados. Comprueba CA, PA y atributos con el videojuego antes de incorporarlos a MF Legacy. Este explorador no modifica automáticamente la base de datos.
        </p>}
        {!!warnings.length && <details className="mt-3 rounded-lg border border-amber-100 p-3 text-xs text-amber-900">
          <summary className="cursor-pointer font-semibold">Avisos del lector ({warnings.length})</summary>
          <ul className="mt-2 list-inside list-disc space-y-1">{warnings.slice(0, 12).map((warning, i) => <li key={i}>{warning}</li>)}</ul>
        </details>}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-bold text-slate-900">2. Buscar un jugador o un equipo</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button onClick={() => { setMode("player"); setSelection(null); setQuery(""); }} type="button"
            className={`rounded-lg px-4 py-2 text-sm font-bold ${mode === "player" ? "bg-[#003399] text-white" : "bg-slate-100 text-slate-700"}`}>Jugadores</button>
          <button onClick={() => { setMode("club"); setSelection(null); setQuery(""); }} type="button"
            className={`rounded-lg px-4 py-2 text-sm font-bold ${mode === "club" ? "bg-[#003399] text-white" : "bg-slate-100 text-slate-700"}`}>Equipos</button>
          {index && <span className="ml-auto text-xs text-slate-500">{mode === "player" ? smallNumber(index.count) + " jugadores" : smallNumber(index.clubs.length) + " clubes con jugadores"}</span>}
        </div>
        <label className="relative mt-4 block">
          <Search size={18} className="pointer-events-none absolute left-3 top-3 text-slate-400" />
          <input disabled={!index} value={query} onChange={event => { setQuery(event.target.value); setSelection(null); setPlayerDetail(null); }}
            placeholder={mode === "player" ? "Ej.: Cristiano Ronaldo, Messi, Isco..." : "Ej.: Sevilla, Arsenal, FC Barcelona..."}
            aria-label={mode === "player" ? "Buscar jugador en la partida" : "Buscar equipo en la partida"}
            className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-9 text-sm outline-none focus:border-[#003399] disabled:bg-slate-100" />
          {!!query && <button type="button" className="absolute right-3 top-3 text-slate-400" onClick={() => setQuery("")} aria-label="Limpiar búsqueda"><X size={15} /></button>}
        </label>
        {!index && <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Carga primero una partida para activar el buscador.</p>}
        {index && mode === "player" && query.trim().length < 2 && <p className="mt-4 text-xs text-slate-500">Escribe al menos dos letras para buscar entre todos los jugadores.</p>}
        {index && <div className="mt-4 max-h-[380px] divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
          {mode === "player" ? playerResults.map(i => <button type="button" key={index.uid[i]}
            onClick={() => showPlayer(i)} className={`flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-blue-50 ${selection?.type === "player" && selection.index === i ? "bg-blue-50" : ""}`}>
            <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{index.names[i]}</strong><span className="block truncate text-xs text-slate-500">{index.clubNames[i] || "Sin equipo"} · {index.positions[i] || "Sin posición"}</span></span>
            <span className="text-xs text-slate-500">CA <b className="text-slate-900">{fmNumber(index.ca[i])}</b> · PA <b className="text-slate-900">{fmNumber(index.pa[i])}</b></span>
          </button>) : clubResults.map(club => <button type="button" key={club.uid}
            onClick={() => chooseClub(club)} className={`flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-blue-50 ${selection?.club?.uid === club.uid ? "bg-blue-50" : ""}`}>
            <Users size={16} className="shrink-0 text-[#003399]" />
            <span className="min-w-0 flex-1 truncate text-sm font-bold">{club.name}</span>
            <span className="text-xs text-slate-500">{club.members.length} jugadores</span>
          </button>)}
          {mode === "player" && query.trim().length >= 2 && playerResults.length === 0 && <p className="p-4 text-sm text-slate-500">No hay jugadores con ese nombre.</p>}
          {mode === "club" && clubResults.length === 0 && <p className="p-4 text-sm text-slate-500">No hay equipos con ese nombre.</p>}
        </div>}
        {!!index && ((mode === "player" && playerResults.length === 80) || (mode === "club" && clubResults.length === 80)) &&
          <p className="mt-2 text-xs text-slate-500">Mostrando las primeras 80 coincidencias. Escribe un nombre más concreto para afinar.</p>}
      </section>

      {selection && index && <section className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold text-[#0d315b]">3. Revisar y descargar datos completos</h2>
          <button type="button" className="flex items-center gap-1 text-xs font-semibold text-slate-500" onClick={() => { setSelection(null); setPlayerDetail(null); }}><ArrowLeft size={14} /> Volver</button>
        </div>
        {selection.type === "player" && <div className="mt-3 space-y-3">
          <h3 className="text-lg font-black">{index.names[selection.index]}</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <DataBadge label="CA" value={fmNumber(index.ca[selection.index])} />
            <DataBadge label="PA" value={fmNumber(index.pa[selection.index])} />
            <DataBadge label="Edad" value={fmNumber(index.age[selection.index])} />
            <DataBadge label="ID de la partida" value={index.uid[selection.index]} />
          </div>
          {!playerDetail && <p className="text-xs text-slate-500">Recuperando ficha completa de fmsave...</p>}
          {playerDetail && <details className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
            <summary className="cursor-pointer font-bold text-[#003399]">Ver todos los campos disponibles del jugador</summary>
            <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-all">{JSON.stringify(playerDetail.player, null, 2)}</pre>
          </details>}
        </div>}
        {selection.type === "club" && <div className="mt-3">
          <h3 className="text-lg font-black">{selection.club.name}</h3>
          <label className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" checked={firstTeamOnly} onChange={event => setFirstTeamOnly(event.target.checked)} />
            Solo primera plantilla (team_slot = 0)
          </label>
          <p className="mt-2 text-xs text-slate-500">{smallNumber(selectedClubMembers.length)} jugadores en la selección. {firstTeamOnly ? "Reservas y juveniles excluidos." : "Se incluyen equipos B y categorías inferiores."}</p>
          <div className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-slate-200">
            {selectedClubMembers.slice(0, 70).map(i => <div key={index.uid[i]} className="flex justify-between gap-3 border-b border-slate-100 px-3 py-2 text-xs">
              <span className="truncate">{index.names[i]}</span><span className="shrink-0 text-slate-500">CA {fmNumber(index.ca[i])} · PA {fmNumber(index.pa[i])}</span>
            </div>)}
            {!selectedClubMembers.length && <p className="p-3 text-sm text-slate-500">No hay jugadores con este filtro.</p>}
          </div>
        </div>}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={exportJson} disabled={downloading || !reader || (selection.type === "club" && !selectedClubMembers.length)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#003399] px-5 py-3 text-sm font-bold text-white hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-50">
            {downloading ? <Loader2 size={17} className="animate-spin" /> : <Download size={17} />}
            {downloading ? `Preparando ${exportProgress.done}/${exportProgress.total}...` : "Descargar JSON completo"}
          </button>
          <span className="inline-flex items-center gap-1 text-xs text-slate-500"><ShieldCheck size={15} /> No se modifican jugadores de MF Legacy</span>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">El JSON contiene los registros íntegros que fmsave puede leer, además de las estadísticas disponibles de esta temporada. Mantiene el array <code>players</code> para facilitar una futura importación revisada. No incluye fotografías ni estadísticas reales de FotMob.</p>
      </section>}

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800">{notice}</div>}
      <p className="flex items-center gap-2 text-xs text-slate-500"><Database size={14} /> Fuente: fmsave, proyecto de Randal S. Olson (MIT). Los datos proceden del archivo de partida seleccionado, no de la base de datos oficial en tiempo real.</p>
    </div>
  </div>;
}
