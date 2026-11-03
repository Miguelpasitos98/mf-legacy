# MF LEGACY — Champions / Copa de Europa: extracción provisional de Rob FM24

**Fecha de incorporación:** 2026-11-03  
**Trofeo Base44:** Trophy.id = \`6ae28d39b84f31b9499777ae\` / Trophy.source_id = \`1301394\`  
**Material:** cuatro capturas de la pantalla «Últimos ganadores» de Rob's History Update 2024 v4.00.

## Datos importados

- **TrophyEdition:** 68 finales consecutivas de 1955/56 a 2022/23.
- **TrophyHistoricalEvent:** 29 notas históricas, con fechas de la pantalla, resumidas en español, algunas anteriores a la primera competición.
- **Team.id:** 62 campeones y 60 subcampeones relacionados por correspondencia inequívoca con Team. Los demás quedan deliberadamente sin ID.
- **TrophyHonour:** **0 adjudicaciones creadas**. No se ha alterado el palmarés verificado.
- **Marcadores:** no se importan; la tabla de FM24 no los proporcionaba en esas columnas.
- **Sedes:** se conserva la denominación de la captura, que puede ser una marca/nombre moderno de un estadio antiguo. Las sedes NO están aún vinculadas a Stadium.id.
- **Narrativas:** las filas de Rob con «No se celebró la competición» se interpretan como registros narrativos separados y no como anulaciones reales de cada temporada.

Los textos \`TrophyHistoricalEvent.description_es\` son **resúmenes fieles**, NO transcripciones literales. \`original_text\` queda vacío hasta disponer de la exportación textual de Rob.

## Archivos de origen y validación

- \`scripts/rob_ucl_1955_2023_finals.json\`
- \`scripts/rob_ucl_historical_events.json\`
- \`tests/trophyRobImport.test.mjs\`

El campo \`verification_status = source_extracted\` refleja **origen en el mod**, no verificación por UEFA/FIFA. El booleano \`is_officially_verified = false\` impide equipararlo a una fuente oficial.

## Cómo incorporar nuevos lotes de capturas

1. Identificar \`Trophy.source_id\` sin inventar IDs.
2. Extraer separadamente ediciones reales y eventos narrativos, indicando la procedencia de cada uno.
3. Generar claves estables \`edition_key = rob_fm24_<competicion>_<temporada>\` y \`event_key\` (temporada + orden/título del evento).
4. Antes de insertar, consultar \`TrophyEdition\` por \`edition_key\` o \`TrophyHistoricalEvent\` por \`event_key\`. **Actualizar** los existentes cuando se haya mejorado su fuente; insertar solo los no existentes.
5. Mantener \`TrophyHonour\` sin alterar hasta verificar el campeón en una fuente fiable y resolver Team.id.
6. No fusionar distintas competiciones históricas solo porque sus nombres coincidan.
7. No marcar como oficialmente verificadas las descripciones del mod.

**Estado de las capturas: CHAMPIONS COMPLETA (confirmado por el usuario).** El lote de cuatro capturas está cerrado: 68 finales, 29 notas narrativas. La **verificación externa** del contenido histórico sigue pendiente. Es posible ampliar posteriormente con datos oficiales, sin sobrescribir el material original del mod.
