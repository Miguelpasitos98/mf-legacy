// Breve ayuda contextual, independiente de los cálculos del Composite.
export const INDICATOR_DESCRIPTIONS={
  xg_chain_p90:"xG de las jugadas en las que participa, incluido el tiro y la asistencia.",
  xg_buildup_p90:"xG de las jugadas que construye, excluyendo tiro y asistencia final.",
  ball_security:"Seguridad de balón (MF Legacy): regates completados ÷ (regates completados + veces desposeído). Suavizado hacia el 50 % con 10 acciones virtuales por temporada para reducir los extremos en muestras pequeñas. Aproximación experimental, no fórmula interna confirmada de CraftedFC."
};
export const indicatorDescription=key=>INDICATOR_DESCRIPTIONS[key]||null;
