// Comparación conservadora: evita interpretar como divergencia dos
// totales obtenidos de competiciones, temporadas o fechas distintas.
const value = x => x == null || x === "" ? null : Number.isFinite(Number(x)) ? Number(x) : null;
const normSeason = s => {
  const match = String(s||"").match(/^(\d{4})[/-](\d{2}|\d{4})$/);
  return match ? match[1] + "/" + (match[2].length===2?match[1].slice(0,2)+match[2]:match[2]) : String(s||"");
};
const normCompetition = s => String(s||"")
  .replace(/^[A-Z]{3,6}-/, "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
  .toLowerCase().replace(/[^a-z0-9]/g,"");

export function coverageForComparison(snapshot, rows) {
  const source = snapshot?.payload;
  if (!source) return {comparable:false,reason:"Sin snapshot de CraftedFC."};
  if (!Array.isArray(rows) || rows.length !== 1) return {
    comparable:false,reason:"Selecciona una única competición. CraftedFC muestra un registro actual, no un subtotal de varias competiciones."
  };
  const row = rows[0];
  if (normSeason(row?.season) !== normSeason(source.current_season)) return {
    comparable:false,reason:"Temporadas diferentes. Las cifras no deben interpretarse como discrepancias."
  };
  if (!normCompetition(row?.competition) || normCompetition(row?.competition) !== normCompetition(source.current_comp)) return {
    comparable:false,reason:"Competiciones diferentes o no identificadas con seguridad."
  };
  const teamA = value(row?.fotmob_team_id);
  const teamB = value(source.current_team_id);
  if (teamA == null || teamB == null || teamA !== teamB) return {
    comparable:false,reason:"No se puede comprobar que ambas fuentes correspondan al mismo equipo."
  };
  const a = value(row?.appearances), b = value(source.current_matches_played);
  const minsA = value(row?.minutes), minsB = value(source.current_minutes);
  if (a == null || b == null || minsA == null || minsB == null || a !== b || minsA !== minsB) return {
    comparable:false,reason:"Cobertura de partidos o minutos distinta o incompleta."
  };
  return {
    comparable:true,
    reason:"Misma temporada, competición, equipo, partidos y minutos. Las definiciones estadísticas de las fuentes aún pueden variar."
  };
}
