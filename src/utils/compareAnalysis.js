// Modelo compartido de la comparativa MF LEGACY: análisis por temporada,
// líder y diferencia de cada indicador, y ranking por Composite.
// Solo presentación: reutiliza el mismo motor que el desglose individual.
import { compareHistoricalObservation } from "./historicalPeers.js";

const round = (value, decimals = 1) => Number.isFinite(Number(value)) ? Math.round(Number(value) * 10 ** decimals) / 10 ** decimals : null;
const mean = values => values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;

// Mismo criterio que el desglose individual: en indicadores penalizados
// (menos es mejor) el percentil se invierte para poder comparar fuerzas.
export const strengthOf = item => item?.penalty ? 100 - item.percentile : item?.percentile ?? null;

export function buildCompareAnalysis(entries = [], observations = [], minimum = 10) {
  const analyses = entries.map(({ summary, player }) => {
    if (!summary || !observations.length) return { summary, player, analysis: null };
    const observation = observations.find(o => o.playerId === String(summary.player_id) && o.season === summary.season);
    if (!observation) return { summary, player, analysis: null };
    try { return { summary, player, analysis: compareHistoricalObservation(observation, observations, minimum) }; }
    catch (error) { console.error("Error en la comparación MF LEGACY de", summary.season, error); return { summary, player, analysis: null }; }
  });

  // Orden estable de indicadores: el del primer análisis que los define.
  const keys = [];
  for (const { analysis } of analyses) for (const row of analysis?.rows || [])
    if (!keys.some(x => x.key === row.key)) keys.push({ key: row.key, name: row.name, penalty: row.penalty });

  const indicators = keys.map(({ key, name, penalty }) => {
    const cells = analyses.map(({ analysis }, index) => {
      const row = analysis?.rows.find(r => r.key === key) || null;
      return { index, row, strength: row && row.percentile !== null ? strengthOf(row) : null };
    });
    const ordered = cells.filter(c => c.strength !== null).slice().sort((a, b) => b.strength - a.strength);
    const weight = analyses.map(({ analysis }) => analysis?.rows.find(r => r.key === key)?.weight).find(w => w !== null && w !== undefined);
    return {
      key, name, penalty,
      weight: weight === undefined ? null : weight,
      cells,
      best: ordered[0] || null,
      second: ordered[1] || null,
      gap: ordered.length > 1 ? round(ordered[0].strength - ordered[1].strength) : null,
    };
  });

  const seasons = analyses.map(({ summary, player, analysis }, index) => {
    const rows = (analysis?.rows || []).filter(r => r.percentile !== null);
    return {
      index, summary, player, analysis,
      role: analysis?.role || null,
      population: analysis?.population ?? null,
      players: analysis?.players ?? null,
      score: analysis?.composite?.score ?? null,
      coverage: analysis?.composite?.coverage ?? null,
      count: analysis?.composite?.count ?? null,
      total: analysis?.composite?.total ?? null,
      average: mean(rows.map(strengthOf)),
      strongest: rows.length ? rows.reduce((a, b) => strengthOf(a) >= strengthOf(b) ? a : b) : null,
      weakest: rows.length ? rows.reduce((a, b) => strengthOf(a) <= strengthOf(b) ? a : b) : null,
      wins: 0,
      contested: 0,
    };
  });

  // Un indicador solo se "gana" cuando al menos dos temporadas tienen percentil.
  const contested = indicators.filter(indicator => indicator.cells.filter(c => c.strength !== null).length > 1);
  seasons.forEach(season => { season.contested = contested.length; });
  for (const indicator of contested)
    for (const cell of indicator.cells)
      if (cell.strength !== null && cell.strength === indicator.best.strength) seasons[cell.index].wins += 1;

  const ranking = seasons.filter(s => s.score !== null).slice().sort((a, b) => b.score - a.score);
  ranking.forEach((season, position) => {
    season.rank = position + 1;
    season.gapToLeader = round(season.score - ranking[0].score);
  });
  const leader = ranking[0] || null;
  const runnerUp = ranking[1] || null;
  const biggest = contested.slice().sort((a, b) => b.gap - a.gap)[0] || null;

  return {
    analyses, indicators, seasons, ranking, leader, runnerUp,
    contested: contested.length,
    averageGap: mean(contested.map(indicator => indicator.gap)),
    biggest,
    headline: leader && runnerUp ? {
      winner: leader, loser: runnerUp,
      gap: round(leader.score - runnerUp.score),
      relative: runnerUp.score ? round((leader.score - runnerUp.score) / runnerUp.score * 100) : null,
    } : null,
  };
}