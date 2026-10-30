import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, RefreshCw, Loader2, Globe2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

/**
 * FlagSyncModal — sincronización de Country.flag con las imágenes
 * de la carpeta `Flags` del repositorio público Miguelpasitos98/My-Legacy.
 *
 * - Lee el listado real de archivos de GitHub (API pública, sin token).
 * - Empareja por nombre normalizado o alias explícito (Arabia Saudí).
 * - Verifica que cada URL propuesta carga en el navegador.
 * - Muestra una vista previa clasificada antes de escribir.
 * - Solo actualiza Country.flag; no crea ni elimina países.
 * - Invalida la caché de Countries, Players y Teams al aplicar.
 */

const REPO_OWNER = "Miguelpasitos98";
const REPO_NAME = "My-Legacy";
const REPO_BRANCH = "main";
const FLAGS_FOLDER = "Flags";
const CONTENTS_API = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FLAGS_FOLDER}?ref=${REPO_BRANCH}`;
const RAW_BASE = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${REPO_BRANCH}/${FLAGS_FOLDER}/`;

// Alias explícitos: clave = nombre de país normalizado, valor = basename normalizado del archivo.
const FLAG_ALIASES = {
  "arabia-saudi": "arabia-saudita",
};

const IMAGE_EXT_RE = /\.(png|jpg|jpeg|gif|webp|svg)$/i;

const normalizeForMatch = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const stripExtension = (filename) =>
  String(filename || "").replace(/\.(png|jpg|jpeg|gif|webp|svg)$/i, "");

const verifyImage = (url, timeout = 8000) =>
  new Promise((resolve) => {
    if (typeof Image === "undefined") {
      resolve(true);
      return;
    }
    const img = new Image();
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      img.onload = null;
      img.onerror = null;
      resolve(ok);
    };
    img.onload = () => finish(true);
    img.onerror = () => finish(false);
    img.src = url;
    setTimeout(() => finish(false), timeout);
  });

const normalizeImageUrl = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (/^(https?:|data:|blob:)/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

const STATUS_META = {
  ready: { label: "Ready to Update", badge: "bg-blue-50 text-blue-700 ring-blue-200" },
  correct: { label: "Already Correct", badge: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  review: { label: "Needs Review", badge: "bg-amber-50 text-amber-700 ring-amber-200" },
  none: { label: "No Match", badge: "bg-slate-100 text-slate-600 ring-slate-200" },
};

const TABS = [
  { key: "ready", label: "Ready to Update" },
  { key: "correct", label: "Already Correct" },
  { key: "review", label: "Needs Review" },
  { key: "none", label: "No Match" },
];

export default function FlagSyncModal({ open, onClose, countries, queryClient }) {
  const [status, setStatus] = useState("idle");
  const [files, setFiles] = useState([]);
  const [listError, setListError] = useState("");
  const [verified, setVerified] = useState({});
  const [verifyProgress, setVerifyProgress] = useState({ done: 0, total: 0 });
  const [activeTab, setActiveTab] = useState("ready");
  const [progress, setProgress] = useState({ current: 0, total: 0, updated: 0, errors: 0, failed: [] });
  const [report, setReport] = useState(null);
  const [applying, setApplying] = useState(false);

  const countriesRef = useRef(countries);
  countriesRef.current = countries;

  // Fetch GitHub file list when the modal opens.
  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setStatus("loading");
    setFiles([]);
    setListError("");
    setVerified({});
    setVerifyProgress({ done: 0, total: 0 });
    setReport(null);
    setProgress({ current: 0, total: 0, updated: 0, errors: 0, failed: [] });

    fetch(CONTENTS_API, { headers: { Accept: "application/vnd.github+json" } })
      .then(async (res) => {
        if (res.status === 403) {
          let message = "GitHub API: límite de peticiones alcanzado (403).";
          try {
            const body = await res.json();
            if (body?.message) message = `GitHub API: ${body.message}`;
          } catch {
            /* ignore body parse errors */
          }
          throw new Error(message);
        }
        if (!res.ok) throw new Error(`GitHub API: error HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        const imageFiles = list
          .filter((item) => item?.type === "file" && IMAGE_EXT_RE.test(item?.name || ""))
          .map((item) => {
            const name = item.name;
            const url = item.download_url || `${RAW_BASE}${encodeURIComponent(name)}`;
            return { name, url, key: normalizeForMatch(stripExtension(name)) };
          });
        setFiles(imageFiles);

        // Build a temporary index to know which proposed URLs need verification.
        const index = new Map();
        for (const f of imageFiles) {
          if (!index.has(f.key)) index.set(f.key, []);
          index.get(f.key).push(f);
        }
        const urlsToVerify = new Set();
        for (const country of countriesRef.current) {
          const norm = normalizeForMatch(country.name);
          const target = FLAG_ALIASES[norm] || norm;
          const cands = index.get(target) || [];
          if (cands.length === 1) urlsToVerify.add(cands[0].url);
        }
        const urlList = Array.from(urlsToVerify);
        setVerifyProgress({ done: 0, total: urlList.length });
        setStatus("verifying");
        let done = 0;
        Promise.all(
          urlList.map(async (url) => {
            const ok = await verifyImage(url);
            done += 1;
            if (!cancelled) setVerifyProgress({ done, total: urlList.length });
            return [url, ok];
          })
        ).then((entries) => {
          if (cancelled) return;
          const map = {};
          for (const [url, ok] of entries) map[url] = ok;
          setVerified(map);
          setStatus("ready");
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setListError(err?.message || "No se pudo leer la carpeta Flags del repositorio.");
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  const fileIndex = useMemo(() => {
    const map = new Map();
    for (const f of files) {
      if (!map.has(f.key)) map.set(f.key, []);
      map.get(f.key).push(f);
    }
    return map;
  }, [files]);

  const matches = useMemo(() => {
    return countries.map((country) => {
      const normName = normalizeForMatch(country.name);
      const aliasTarget = FLAG_ALIASES[normName];
      const targetKey = aliasTarget || normName;
      const candidates = fileIndex.get(targetKey) || [];
      const currentFlag = String(country.flag || "").trim();
      let baseStatus = "none";
      let proposedUrl = "";
      let reason = "";
      let alternatives = [];
      if (candidates.length === 0) {
        baseStatus = "none";
        reason = aliasTarget
          ? `Alias «${aliasTarget}.png» no encontrado en la carpeta Flags.`
          : "No existe un archivo con este nombre en Flags.";
      } else if (candidates.length > 1) {
        baseStatus = "review";
        reason = "Varios archivos coinciden con el nombre del país. Revisión manual necesaria.";
        alternatives = candidates;
      } else {
        proposedUrl = candidates[0].url;
        baseStatus = currentFlag && currentFlag === proposedUrl ? "correct" : "ready";
      }
      return {
        country,
        normName,
        aliasUsed: !!aliasTarget,
        currentFlag,
        proposedUrl,
        baseStatus,
        reason,
        alternatives,
        fileName: candidates[0]?.name || "",
      };
    });
  }, [countries, fileIndex]);

  const classified = useMemo(() => {
    return matches.map((m) => {
      if (m.baseStatus === "ready" && verified[m.proposedUrl] === false) {
        return { ...m, baseStatus: "review", reason: "La URL propuesta no se pudo cargar en el navegador." };
      }
      return m;
    });
  }, [matches, verified]);

  const stats = useMemo(() => {
    const s = { total: classified.length, ready: 0, correct: 0, review: 0, none: 0 };
    for (const m of classified) s[m.baseStatus] += 1;
    return s;
  }, [classified]);

  const grouped = useMemo(() => {
    const groups = { ready: [], correct: [], review: [], none: [] };
    for (const m of classified) groups[m.baseStatus].push(m);
    return groups;
  }, [classified]);

  const refreshCache = (cacheUpdates) => {
    if (!cacheUpdates.length) return;
    queryClient.setQueryData(["mf-legacy", "countries"], (oldData) => {
      const list = Array.isArray(oldData) ? oldData : [];
      return list.map((country) => {
        const upd = cacheUpdates.find(
          (u) => String(u.id) === String(country?.id || country?._id || "")
        );
        return upd ? { ...country, flag: upd.flag } : country;
      });
    });
    queryClient.invalidateQueries({ queryKey: ["mf-legacy", "countries"] });
    queryClient.invalidateQueries({ queryKey: ["mf-legacy", "players"] });
    queryClient.invalidateQueries({ queryKey: ["mf-legacy", "teams"] });
  };

  const handleApply = async () => {
    const toUpdate = classified.filter((m) => m.baseStatus === "ready");
    if (!toUpdate.length || applying) return;
    setApplying(true);
    setStatus("applying");
    setReport(null);
    let updated = 0;
    let errors = 0;
    const failed = [];
    const cacheUpdates = [];
    const batchSize = 6;

    for (let i = 0; i < toUpdate.length; i++) {
      const item = toUpdate[i];
      setProgress({ current: i, total: toUpdate.length, updated, errors, failed: [...failed] });
      try {
        await base44.entities.Country.update(item.country.id, { flag: item.proposedUrl });
        cacheUpdates.push({ id: item.country.id, flag: item.proposedUrl });
        updated += 1;
      } catch (err) {
        errors += 1;
        failed.push({
          id: item.country.id,
          name: item.country.name,
          url: item.proposedUrl,
          error: err?.response?.data?.message || err?.message || "Error al actualizar",
        });
      }
      if ((i + 1) % batchSize === 0) {
        await new Promise((resolve) => setTimeout(resolve, 120));
      }
    }

    refreshCache(cacheUpdates);

    setProgress({ current: toUpdate.length, total: toUpdate.length, updated, errors, failed });
    setReport({
      updated,
      correct: stats.correct,
      review: stats.review,
      none: stats.none,
      errors,
      failed,
      total: toUpdate.length,
    });
    setApplying(false);
    setStatus("done");
  };

  const handleRetryFailed = async () => {
    if (!report?.failed?.length || applying) return;
    const toRetry = report.failed;
    setApplying(true);
    setStatus("applying");
    const previousUpdated = report.updated || 0;
    let updated = 0;
    let errors = 0;
    const failed = [];
    const cacheUpdates = [];

    for (let i = 0; i < toRetry.length; i++) {
      const item = toRetry[i];
      setProgress({ current: i, total: toRetry.length, updated, errors, failed: [...failed] });
      try {
        await base44.entities.Country.update(item.id, { flag: item.url });
        cacheUpdates.push({ id: item.id, flag: item.url });
        updated += 1;
      } catch (err) {
        errors += 1;
        failed.push({ ...item, error: err?.response?.data?.message || err?.message || "Error al actualizar" });
      }
    }

    refreshCache(cacheUpdates);

    setProgress({ current: toRetry.length, total: toRetry.length, updated, errors, failed });
    setReport((prev) => ({
      ...prev,
      updated: previousUpdated + updated,
      errors: failed.length,
      failed,
    }));
    setApplying(false);
    setStatus("done");
  };

  if (!open) return null;

  const visibleList = grouped[activeTab] || [];
  const applyingInProgress = applying || status === "applying";

  return (
    <div
      className="mf-modal-overlay fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !applyingInProgress) onClose();
      }}
    >
      <div className="mf-modal-panel flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              MF LEGACY · GitHub
            </p>
            <h2 className="mt-1 text-lg font-extrabold text-slate-900">Sync Flags</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Vincula <code className="rounded bg-slate-100 px-1">Country.flag</code> con las imágenes de{" "}
              <code className="rounded bg-slate-100 px-1">{`${REPO_OWNER}/${REPO_NAME}/${FLAGS_FOLDER}`}</code>.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={applyingInProgress}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
            aria-label="Cerrar"
          >
            <X size={17} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {status === "loading" && (
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-4 text-sm text-slate-600">
              <Loader2 size={16} className="animate-spin" />
              Leyendo la carpeta <strong>Flags</strong> del repositorio…
            </div>
          )}

          {status === "error" && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
              <p className="font-semibold">No se pudo obtener el listado de archivos.</p>
              <p className="mt-1 text-xs text-red-500">{listError}</p>
              <p className="mt-2 text-xs text-red-500">
                GitHub limita las peticiones anónimas a 60 por hora. Reintenta más tarde.
              </p>
            </div>
          )}

          {(status === "verifying" || status === "ready" || status === "applying" || status === "done") && (
            <>
              <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
                <StatCard label="Países" value={stats.total} tone="slate" />
                <StatCard label="Actualizar" value={stats.ready} tone="blue" />
                <StatCard label="Correctas" value={stats.correct} tone="emerald" />
                <StatCard label="Revisar" value={stats.review} tone="amber" />
                <StatCard label="Sin coincidencia" value={stats.none} tone="slate" />
              </div>

              {status === "verifying" && (
                <div className="mb-4 flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">
                  <Loader2 size={14} className="animate-spin" />
                  Verificando imágenes… {verifyProgress.done}/{verifyProgress.total}
                </div>
              )}

              <div className="mb-4 flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
                {TABS.map((tab) => {
                  const count = stats[tab.key] || 0;
                  const active = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold transition ${
                        active ? "bg-white text-[#003399] shadow-sm" : "text-slate-500 hover:bg-white/70"
                      }`}
                    >
                      {tab.label} · {count}
                    </button>
                  );
                })}
              </div>

              <div className="space-y-2">
                {visibleList.length === 0 && (
                  <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs text-slate-400">
                    No hay países en esta categoría.
                  </p>
                )}
                {visibleList.map((item) => (
                  <CountryRow key={item.country.id} item={item} />
                ))}
              </div>
            </>
          )}
        </div>

        <div className="border-t border-slate-100 bg-white px-6 py-4">
          {status === "applying" && (
            <div className="mb-3">
              <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-600">
                <span>Aplicando actualizaciones…</span>
                <span>
                  {progress.current}/{progress.total} · {progress.updated} ok · {progress.errors} errores
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#003399] to-[#3b82f6] transition-all"
                  style={{
                    width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          )}

          {status === "done" && report && (
            <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs">
              <p className="font-bold text-slate-800">Informe de sincronización</p>
              <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-slate-600 sm:grid-cols-4">
                <span>Actualizadas: <strong className="text-emerald-700">{report.updated}</strong></span>
                <span>Ya correctas: <strong className="text-slate-800">{report.correct}</strong></span>
                <span>Pendientes de revisar: <strong className="text-amber-700">{report.review}</strong></span>
                <span>Errores: <strong className="text-red-700">{report.errors}</strong></span>
              </div>
              {!!report.failed?.length && (
                <div className="mt-2">
                  <p className="font-semibold text-red-700">Fallidos:</p>
                  <ul className="mt-1 space-y-0.5 text-[11px] text-red-600">
                    {report.failed.map((f) => (
                      <li key={f.id}>
                        {f.name} — {f.error}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={handleRetryFailed}
                    disabled={applying}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                  >
                    <RefreshCw size={12} /> Reintentar fallidos ({report.failed.length})
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] text-slate-400">
              Solo se actualiza <code className="rounded bg-slate-100 px-1">Country.flag</code>. No se crean ni eliminan países.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={applyingInProgress}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={applyingInProgress || status !== "ready" || stats.ready === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-[#003399] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#002477] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw size={15} />
                {applyingInProgress ? "Aplicando…" : `Apply Flag Updates (${stats.ready})`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, tone }) {
  const tones = {
    slate: "bg-slate-50 text-slate-700",
    blue: "bg-blue-50 text-blue-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
  };
  return (
    <div className={`rounded-xl px-3 py-2.5 ${tones[tone] || tones.slate}`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] opacity-70">{label}</p>
      <p className="mt-0.5 text-lg font-extrabold">{value}</p>
    </div>
  );
}

function CountryRow({ item }) {
  const meta = STATUS_META[item.baseStatus];
  const currentImg = normalizeImageUrl(item.currentFlag);
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <div className="flex h-9 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-50">
        {currentImg ? (
          <img
            src={currentImg}
            alt=""
            className="h-full w-full object-contain"
            loading="lazy"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        ) : (
          <Globe2 size={15} className="text-slate-300" />
        )}
      </div>
      <span className="text-slate-300">→</span>
      <div className="flex h-9 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-50">
        {item.proposedUrl ? (
          <img
            src={item.proposedUrl}
            alt=""
            className="h-full w-full object-contain"
            loading="lazy"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        ) : (
          <Globe2 size={15} className="text-slate-300" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-slate-900">{item.country.name}</p>
        <p className="truncate text-[11px] text-slate-400">
          {item.proposedUrl ? item.fileName : item.reason}
        </p>
        {item.aliasUsed && (
          <p className="text-[10px] font-semibold text-blue-600">Alias explícito aplicado</p>
        )}
        {!!item.alternatives.length && (
          <div className="mt-1 flex flex-wrap gap-1">
            {item.alternatives.map((alt) => (
              <span key={alt.url} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{alt.name}</span>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col items-end gap-1">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${meta.badge}`}>{meta.label}</span>
        {item.currentFlag && item.proposedUrl && item.currentFlag !== item.proposedUrl && (
          <span className="max-w-[160px] truncate text-[9px] text-slate-400" title={item.currentFlag}>URL antigua</span>
        )}
      </div>
    </div>
  );
}