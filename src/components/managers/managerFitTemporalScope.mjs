import {profileScope,validSeason} from "./managerModel.mjs";

/**
 * A manager's era and the observed player season are separate timelines.
 * Comparing Klopp 2015/20 with a player from 2025/26 is a counterfactual,
 * not evidence of having played under Klopp in that period.
 */
export function managerFitTemporalScope(profile,season){
 const scope=profileScope(profile);
 if(!validSeason(season))return {status:"invalid",label:"Temporada del jugador no válida",warning:"Comprueba el formato YYYY/YYYY antes de interpretar las estadísticas."};
 if(scope==="general")return {status:"general",label:"Filosofía general, sin periodo acotado",warning:"El perfil del entrenador es representativo y no está restringido a una temporada concreta."};
 if(scope==="season"){
  if(!validSeason(profile?.season))return {status:"unverified",label:"Etapa del entrenador sin fecha válida",warning:"El ADN necesita una temporada verificable."};
  return profile.season===season?
   {status:"aligned",label:"Misma campaña en el perfil y en las estadísticas",warning:"La coincidencia cronológica no implica que el jugador haya estado en ese equipo."}:
   {status:"counterfactual",label:"Cruce entre campañas diferentes",
    warning:"ADN del entrenador de "+profile.season+" frente a estadísticas del jugador de "+season+". Es una comparación hipotética, no rendimiento bajo ese entrenador."};
 }
 const start=String(profile?.period_start||""),end=String(profile?.period_end||"");
 if(!validSeason(start)||!validSeason(end)||start>end)return {status:"unverified",label:"Etapa del entrenador sin periodo válido",warning:"El ADN de esta etapa carece de fechas contrastables."};
 return start<=season&&season<=end?
  {status:"aligned",label:"Temporada incluida en la etapa del entrenador",warning:"La coincidencia temporal no prueba que el jugador trabajara con ese técnico."}:
  {status:"counterfactual",label:"Cruce entre etapas históricas distintas",
   warning:"ADN de "+start+"–"+end+" frente a estadísticas del jugador de "+season+". Es una simulación contrafactual, no una asociación histórica real."};
}
