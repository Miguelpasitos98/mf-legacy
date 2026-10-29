// Contextual, compact explanations displayed only when opening an indicator's
// historical ranking. These formulas describe MF Legacy's actual aggregation,
// not FotMob/CraftedFC proprietary models.
const PER90="Suma del dato en competiciones válidas × 90 ÷ minutos de esas competiciones.";
export const INDICATOR_EXPLANATIONS={
  rating:{
    description:"Media de la valoración FotMob del jugador.",
    formula:"Σ(nota de competición × PJ) ÷ Σ(PJ con nota)."
  },
  npxg_p90:{
    description:"Calidad esperada de los tiros sin contar penaltis.",
    formula:"Σ(xG sin penaltis) × 90 ÷ minutos con el dato."
  },
  xg_chain_p90:{
    description:"xG de las jugadas en las que interviene, incluyendo finalización.",
    formula:"Σ(xG Chain) × 90 ÷ minutos alineados de Understat."
  },
  xg_buildup_p90:{
    description:"xG de las jugadas construidas, sin tiro ni asistencia final.",
    formula:"Σ(xG Buildup) × 90 ÷ minutos alineados de Understat."
  },
  fc27_ovr:{
    description:"Valoración base FIFA/EA FC correspondiente a esa temporada.",
    formula:"Overall histórico registrado; no se calcula a partir de estadísticas."
  },
  xa_p90:{
    description:"Asistencias esperadas por la calidad de las ocasiones creadas.",
    formula:"Σ(xA) × 90 ÷ minutos con xA; si solo hay tasa /90 se pondera por minutos."
  },
  xgot_p90:{
    description:"Calidad esperada de los tiros a puerta tras su ejecución.",
    formula:"Σ(xGOT) × 90 ÷ minutos con xGOT."
  },
  market_value:{
    description:"Valor de mercado histórico asociado a la temporada.",
    formula:"Valor registrado en Transfermarkt; sin conversión desde el precio de traspaso."
  },
  finishing_xgot_minus_npxg:{
    description:"Diferencia entre la calidad del tiro ejecutado y la esperada antes del golpeo.",
    formula:"Σ(xGOT − xG sin penaltis) × 90 ÷ minutos con ambos datos."
  },
  play_share:{
    description:"Porcentaje de minutos disponibles del equipo jugados por el futbolista.",
    formula:"Σ(minutos del jugador) ÷ [Σ(PJ del equipo × 90)] × 100; PJ × 90 si faltan minutos."
  },
  shots_on_target_p90:{
    description:"Tiros del jugador que van entre los tres palos.",
    formula:PER90
  },
  big_chances_created_p90:{
    description:"Ocasiones de gol de alta probabilidad generadas para compañeros.",
    formula:PER90
  },
  possession_won_final_3rd_p90:{
    description:"Veces que recupera la posesión en el tercio ofensivo.",
    formula:PER90
  },
  aerial_duels_won_pct:{
    description:"Porcentaje de duelos aéreos ganados.",
    formula:"Media de los % disponibles, ponderada por minutos de cada competición."
  },
  accurate_long_balls_p90:{
    description:"Pases largos que alcanzan correctamente a un compañero.",
    formula:PER90
  },
  ground_duels_won_pct:{
    description:"Proporción de duelos a ras de suelo ganados.",
    formula:"Σ(duelos terrestres ganados) ÷ Σ(duelos terrestres disputados) × 100."
  },
  successful_dribbles_p90:{
    description:"Regates completados con éxito.",
    formula:PER90
  },
  dispossessed_p90:{
    description:"Veces que un rival le desposee del balón; menos es mejor.",
    formula:PER90
  },
  dribbled_past_p90:{
    description:"Veces que un rival le supera mediante un regate; menos es mejor.",
    formula:PER90
  },
  ball_security:{
    description:"Proporción de regates completados respecto a regates y desposesiones.",
    formula:"(Regates completados + 5) ÷ (regates + desposesiones + 10) × 100."
  },
  def_actions_poss_adj_p90:{
    description:"Acciones defensivas normalizadas al 50 % de posesión del equipo.",
    formula:"Σ[acciones × 50 ÷ (100 − posesión %)] × 90 ÷ minutos válidos; prioridad al dato ajustado importado."
  },
  goals_prevented_p90:{
    description:"Goles evitados por el portero frente a la expectativa del proveedor.",
    formula:"Σ(goles evitados) × 90 ÷ minutos con el dato."
  },
  save_pct:{
    description:"Porcentaje de paradas del portero.",
    formula:"Media de los % por competición ponderada por minutos (PJ × 90 si faltan)."
  },
  accurate_passes_p90:{
    description:"Pases que llegan correctamente a un compañero.",
    formula:PER90
  }
};
export const indicatorExplanation=key=>INDICATOR_EXPLANATIONS[key]||null;
// Backward compatibility for legacy callers that only need a short definition.
export const indicatorDescription=key=>indicatorExplanation(key)?.description||null;
export const INDICATOR_DESCRIPTIONS=Object.fromEntries(
 Object.entries(INDICATOR_EXPLANATIONS).map(([key,value])=>[key,value.description])
);
