import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Database } from "lucide-react";

/**
 * Understat Explorer de MF LEGACY.
 * El explorador se sirve como documento propio del mismo origen.
 * La copia histórica del CSV está publicada en /understat/players_snapshot.csv.
 * Es solo lectura: no modifica PlayerSeasonStats ni UnderstatSeasonRate.
 */
export default function UnderstatExplorer() {
  const [frameHeight, setFrameHeight] = useState(1350);

  useEffect(() => {
    const onFrameMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "mf-legacy-understat-height") return;
      const next = Number(event.data.height);
      if (!Number.isFinite(next) || next <= 0) return;
      setFrameHeight(Math.min(Math.max(next + 20, 800), 12000));
    };
    window.addEventListener("message", onFrameMessage);
    return () => window.removeEventListener("message", onFrameMessage);
  }, []);

  return (
    <div className="w-full min-w-0 bg-[#0b1220] pb-5">
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4 text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <Database size={15} className="text-teal-300" />
          <span className="font-semibold tracking-wide">MF LEGACY · Understat histórico</span>
        </div>
        <Link to="/stats" className="inline-flex items-center gap-1 rounded-lg border border-slate-500/50 px-3 py-2 text-slate-200 hover:bg-slate-800">
          <ArrowLeft size={14} /> Volver a Stats
        </Link>
      </div>
      <p className="px-5 pt-2 text-xs text-amber-200">
        Modo consulta. Los resultados proceden de una captura histórica y no sustituyen datos guardados en Stats.
      </p>
      <iframe
        title="MF LEGACY — Understat Explorer"
        src="/understat-explorer.html"
        className="block w-full border-0"
        style={{ height: frameHeight }}
        loading="eager"
      />
    </div>
  );
}
