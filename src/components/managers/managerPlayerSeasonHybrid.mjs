import {assessCoachFunctionsFM26} from "./managerFitDeep.mjs";

const validScore=value=>typeof value==="number"&&Number.isFinite(value)&&value>=0&&value<=100;

/**
 * Principal scouting rating.
 * 70% measured FM26 role/coach attributes (0-100)
 * 30% an independently evaluated real historical player-season (0-100).
 *
 * CA/PA, transfer value and positional suitability do not masquerade as
 * football statistics. A missing evidence source cannot be replaced by zero.
 */
export function evaluatePlayerSeasonHybrid({player,role,profile,advanced,career}={}){
 const functions=assessCoachFunctionsFM26(player,role,profile);
 const roleScore=validScore(advanced?.attributes)?advanced.attributes:null;
 const tacticalScore=validScore(functions.score)?functions.score:null;
 const fmScore=roleScore===null?null:tacticalScore===null?roleScore:
  Math.round(roleScore*.4+tacticalScore*.6);
 const seasonalScore=validScore(career?.bestScore)?career.bestScore:null;
 const score=fmScore!==null&&seasonalScore!==null?
  Math.round(fmScore*.7+seasonalScore*.3):null;
 const fmCoverage=roleScore===null?0:advanced?.coverage??0;
 const historicalCoverage=seasonalScore===null?0:career?.coverage??0;
 return {
  score,fmScore,seasonScore:seasonalScore,season:seasonalScore===null?null:career.bestSeason,
  seasonBasis:career?.basis||null,seasonCount:career?.seasonCount||0,
  fmRoleScore:roleScore,fmCoachFunctionsScore:tacticalScore,
  coverage:score===null?0:Math.round(fmCoverage*.7+historicalCoverage*.3),
  confidence:score===null?"insufficient":career?.confidence==="medium"&&functions.validFunctions>0&&fmCoverage>=75?"medium":"low",
  functions: {score:functions.score,measured:functions.validFunctions,requested:functions.requestedFunctions},
  sourceLabels:["Atributos del jugador FM26","Rendimiento real de la mejor temporada histórica"],
  missing:[roleScore===null?"Faltan atributos del rol FM26":null,
   seasonalScore===null?"No hay temporada histórica evaluable para esta posición":null].filter(Boolean),
  explanation:score===null?
   "No se presenta una nota 70/30 sin datos medidos de ambas fuentes.":
   "70% atributos FM26 del rol (y funciones del entrenador si son medibles) + 30% estadísticas reales de la mejor temporada histórica; no es una predicción de rendimiento."
 };
}
