import React from "react";
import { payloadField } from "@/utils/craftedfc";
import { coverageForComparison } from "@/utils/craftedfcCoverage";

const show = (v, d = 0) =>
  v === null || v === undefined || !Number.isFinite(Number(v))
    ? "—"
    : Number(v).toLocaleString("es-ES", {
        minimumFractionDigits: d,
        maximumFractionDigits: d,
      });

const isX = (label) => label.includes("xG") || label.includes("xA");

// Métricas compatibles entre fuentes. FotMob = temporada seleccionada;
// CraftedFC = temporada actual del snapshot; MF Legacy = sin equivalente por ahora.
const COMPARE_ROWS = [
  { label: "Goles", fotmob: (s) => s?.goals?.value, cfc: (snap) => payloadField(snap, "current_goals") },
  { label: "Asistencias", fotmob: (s) => s?.assists?.value, cfc: (snap) => payloadField(snap, "current_assists") },
  { label: "xG", fotmob: (s) => s?.xg?.value, cfc: (snap) => payloadField(snap, "current_xg") },
  { label: "xA", fotmob: (s) => s?.xa?.value, cfc: (snap) => payloadField(snap, "current_xa") },
  { label: "Minutos", fotmob: (s) => s?.minutes?.value, cfc: (snap) => payloadField(snap, "current_minutes") },
  { label: "Partidos", fotmob: (s) => s?.appearances?.value, cfc: (snap) => payloadField(snap, "current_matches_played") },
];

const cellStatus = (fotmob, cfc, aligned) => {
  if (!aligned) return { label: "Cobertura no comparable", color: "text-slate-500" };
  const values = [fotmob, cfc].filter((v) => v !== null && v !== undefined);
  if (values.length === 0) return { label: "Dato ausente", color: "text-slate-400" };
  if (values.length === 1) return { label: "Fuente no comparable", color: "text-slate-500" };
  const allMatch = values.every((v) => Number(v) === Number(values[0]));
  if (allMatch) return { label: "Valor coincidente", color: "text-emerald-700" };
  return { label: "Valor distinto", color: "text-amber-700" };
};

// Compare Sources: compara estadísticas compatibles entre FotMob, CraftedFC y
// MF Legacy. No promedia automáticamente estadísticas de distinta cobertura.
export default function CraftedfcCompare({ snapshot, status, fotmobSummary, fotmobRows }) {
  const coverage = coverageForComparison(snapshot, fotmobRows);
  if (status === "loading") {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
        Cargando comparador…
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-black uppercase tracking-widest text-[#003399]">Compare Sources</h3>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead className="bg-[#003399] text-white">
            <tr>
              <th className="px-3 py-3">Métrica</th>
              <th className="px-3 py-3 text-right">FotMob (temp.)</th>
              <th className="px-3 py-3 text-right">CraftedFC (actual)</th>
              <th className="px-3 py-3 text-right">MF Legacy</th>
              <th className="px-3 py-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {COMPARE_ROWS.map((row) => {
              const f = row.fotmob(fotmobSummary) ?? null;
              const c = snapshot ? row.cfc(snapshot) ?? null : null;
              const st = cellStatus(f, c, coverage.comparable);
              return (
                <tr key={row.label} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-3 font-semibold text-slate-700">{row.label}</td>
                  <td className="px-3 py-3 text-right">{show(f, isX(row.label) ? 2 : 0)}</td>
                  <td className="px-3 py-3 text-right">{show(c, isX(row.label) ? 2 : 0)}</td>
                  <td className="px-3 py-3 text-right text-slate-400">—</td>
                  <td className={"px-3 py-3 font-bold " + st.color}>{st.label}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-900">
        <strong>{coverage.comparable ? "Cobertura preliminar alineada" : "Fuentes no comparables directamente"}</strong>
        <p className="mt-1">{coverage.reason}</p>
      </div>
      <p className="text-[11px] text-slate-500">
        FotMob muestra los datos de la selección actual; CraftedFC, los de su propia competición y temporada actual
        en la fecha del snapshot. No se promedian automáticamente valores de coberturas distintas.
      </p>
    </div>
  );
}