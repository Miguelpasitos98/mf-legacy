# MF LEGACY · Importación de palmarés de Football Manager 2024

**Lote de origen:** Real Madrid CF · Rob's History Update FM24 v4.00 · tres capturas facilitadas por el usuario el 03-11-2026.

## Archivos

- `research/fm24_palmares/real_madrid_screenshots_2026-11-03.json`: 44 competiciones / 332 líneas de puesto-año, con nombres, descripciones y anotaciones de denominación histórica donde aparecen.
- `public/data/fm24_real_madrid_palmares_v1.json`: copia pública que usa el botón «Real Madrid · 3 capturas».
- `src/utils/trophyPalmaresImport.js`: validador, detector de coincidencias, tratamiento de alias, control de años históricos, claves idempotentes y generación de filas.
- `base44/entities/TrophyPalmaresEntry.jsonc`: almacenamiento separado de campeones, subcampeones y terceros puestos, fuente y revisión.
- `src/components/trophies/TrophyPalmaresImportWorkbench.jsx`: panel de importación y revisión.

## Alcance y limitaciones

Este lote procede **exclusivamente de capturas**, no de fuentes oficiales contrastadas. Las fechas numéricas están almacenadas como **años de la pantalla**, no se ha inventado el inicio de temporada. Algunos textos históricos que aparecen entre paréntesis están guardados como `source_note` y `year_annotations`.

Las 44 competiciones son las observadas en las capturas; los 332 registros son los desgloses por posición y año. **NO** se han generado `TrophyHonour` ni créditos de jugadores, y ninguna fila es oficialmente verificada.

## Protocolo de revisión de identidades

- Nombre exacto y único / alias histórico único: propuesta de enlace automatizada.
- Coincidencia aproximada, trofeo no identificado, dos candidatos o años fuera de periodo: revisión obligatoria.
- Mundialito de clubes: distinguir la competición FIFA histórica, las variantes del trofeo y la Copa Intercontinental.
- Copa de Europa y Champions: misma competición identificada en periodos históricos; no duplicar el trofeo.
- Copa del Rey y sus denominaciones antiguas: mantener la identidad canónica, conservar su nombre histórico como nota.
- Trofeos amistosos: se identifican como tales y **no** se convierten automáticamente en títulos oficiales.
- Un trofeo no encontrado se almacena como pendiente, sin `trophy_source_id`, hasta que el usuario indique la coincidencia.
- Antes de guardar se consulta una instantánea completa de `TrophyPalmaresEntry`; se omiten las claves preexistentes, permitiendo reintentar importaciones parciales.
- La vista de Clubes muestra resultados provisionales solo después de su vinculación; los años de campeón ya presentes en finales de Rob se deduplican.

## Cómo usarlo

1. En Base44: **Trophies → Sincronizar → Palmarés FM24 · capturas**.
2. Pulsa **Real Madrid · 3 capturas** o carga otro JSON compatible.
3. Confirma el equipo de la ficha `Team`.
4. Revisa las **discordancias**; en cada una puedes buscar un trofeo por nombre/ID, confirmar una sugerencia o dejarla pendiente.
5. Pulsa **Guardar registros sin verificar**. La importación se realiza por lotes y es idempotente.
6. En **Revisión de palmarés FM24 guardado** puedes vincular más adelante los pendientes.
7. En **Trophies → Clubes → Real Madrid CF** se muestran campeonatos provisionales, subcampeonatos y terceros puestos sin alterar los títulos oficiales.
