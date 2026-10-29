// Breve ayuda contextual, independiente de los cálculos del Composite.
export const INDICATOR_DESCRIPTIONS={
  xg_chain_p90:"xG de las jugadas en las que participa, incluido el tiro y la asistencia.",
  xg_buildup_p90:"xG de las jugadas que construye, excluyendo tiro y asistencia final."
};
export const indicatorDescription=key=>INDICATOR_DESCRIPTIONS[key]||null;
