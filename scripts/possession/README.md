# Posesión histórica de FotMob → MF Legacy

Extractor Python 3.12+ sin dependencias externas: descubrimiento de temporadas, respuestas nativas, caché reanudable, comparación con registros existentes y lotes para la pantalla **Posesión histórica · equipos**. Node 22+ solo para probar la compatibilidad con el importador real. No utiliza el editor ni escribe en Base44.

## Estado y acceso

El endpoint respondió HTTP 200 en tres comprobaciones puntuales. El parser se ha probado con **70 filas reales**. **Eso no acredita permiso para una descarga masiva**: los [términos de FotMob](https://www.fotmob.com/tos.txt) exigen consentimiento escrito y prohíben la recuperación automática o sistemática. No se ha acreditado ese permiso ni ejecutado una campaña de las 18 competiciones. El transporte HTTP se prueba con simulaciones, no como servicio masivo autorizado. Ver [RESEARCH.md](RESEARCH.md).

El programa funciona **sin red por defecto**. Las muestras son capturas de investigación con procedencia y fecha, no una licencia de reutilización ni autorización de importación. El modo `--online` exige una referencia a un permiso real ya existente del proveedor: el argumento lo documenta, no lo concede ni verifica su validez. No usarlo sin ese permiso.

## Reproducir las comprobaciones reales

Desde la raíz del repositorio; estos comandos no contactan con FotMob:

```sh
python scripts/possession/extract_fotmob.py --leagues scripts/possession/catalog/league_snapshot_2026-10-22.json --responses scripts/possession/fixtures --competition "Serie A" --season 2025/2026 --season 2016/2017 --output exports/serie_a.json
python scripts/possession/extract_fotmob.py --leagues scripts/possession/catalog/league_snapshot_2026-10-22.json --responses scripts/possession/fixtures --competition MLS --season 2026 --output exports/mls.json
```

Generan 40 y 30 filas respectivamente. Todas quedan `pending`; MLS 2026 se marca provisional. Sin los exports reales de equipos y posesiones no se consideran comparadas ni vinculadas a producción.

## Flujo de ejecución

1. Seleccionar nombres exactos del catálogo existente con `--competition`, repetible. Los nombres ajenos se rechazan. Sin selección se procesan las entradas no ambiguas del catálogo.
2. Elegir `--from-year 2015 --to-year 2026` (año inicial inclusive), o varios `--season` exactos. Las etiquetas e IDs se toman de `seasons`; no se convierte MLS `2026` en `2026/2027`. Un mismo `--season` se aplica a todas las competiciones seleccionadas; para calendarios distintos conviene usar intervalo o ejecuciones separadas.
3. Añadir `--discover-only` para consultar disponibilidad sin descargar tablas. `catalogs` conserva las temporadas anunciadas; `coverage` distingue `available_unfetched`, `unavailable`, `empty`, `extracted` y `error`. Anunciada no significa que tenga posesión.
4. Usar `--responses DIRECTORIO` con respuestas completas obtenidas por una vía permitida, o reproducir la caché con `--offline`. El directorio incluye un `manifest.json` como el de `fixtures/`: cada respuesta declara `file`, `source_url` y `fetched_at`. No requiere transcribir posesiones.
5. Añadir `--teams teams.json --existing existing_possessions.json`, exports actuales de `Team` y `TeamSeasonPossession`. Solo vincula IDs internos por un único `Team.fotmob_id` coincidente. No crea equipos ni hace asociaciones aproximadas.
6. Revisar el resumen y el informe: filas exportables, vinculadas, pendientes, comparaciones y errores. Todo registro ya existente se excluye del lote, incluso si la posesión coincide. Los cambios quedan en `comparisons`; nunca se autorizan automáticamente. Un alias antiguo sin FotMob ID puede retener toda la temporada por precaución. Si faltan exports, `existing_checked=false` lo deja explícito.
7. Importar solo después de revisión humana. Utilizar los archivos enumerados en `batches`, de hasta **1.000 filas**, para la previsualización de MF Legacy. El JSON agregado permite inspección. Cada ejecución crea su propio directorio de lotes para evitar fragmentos obsoletos. El extractor no importa, actualiza ni publica nada.

Ejemplo de disponibilidad desde las muestras guardadas:

```sh
python scripts/possession/extract_fotmob.py --leagues scripts/possession/catalog/league_snapshot_2026-10-22.json --responses scripts/possession/fixtures --competition "Serie A" --competition MLS --from-year 2015 --to-year 2026 --discover-only --output exports/availability.json
```

2015 aparece ausente y provoca código 2; las otras temporadas del catálogo son anunciadas, no todas extraídas.

## Duplicidades sin fusión

`catalog/fotmob_leagues.json` cubre los 18 nombres con IDs contrastados en el directorio de FotMob. `EFL Championship` y `Sky Bet Championship` apuntan al proveedor 48; `Campeonato Brasileiro Série A` y `Série A`, al 268. Si ambos nombres de un grupo están seleccionados, o no hay selección, ese grupo queda como `ambiguous_mapping`: sin solicitudes ni filas. Seleccionar exactamente uno permite usar ese nombre, sin fusionar ni modificar entidades. Las otras 14 entradas se procesan por separado. Sus IDs contrastados no acreditan cobertura histórica comprobada.

## Red y reanudación: solo con permiso real del proveedor

Una vez obtenido ese permiso, el comando preparado es:

```sh
python scripts/possession/extract_fotmob.py --leagues scripts/possession/catalog/league_snapshot_2026-10-22.json --competition "Serie A" --from-year 2015 --to-year 2026 --discover-only --online --permission-reference "referencia-del-acuerdo-real" --cache-dir .local-possession-cache --output exports/availability.json
```

Revisar el catálogo antes de quitar `--discover-only`. Añadir los exports de equipos y posesiones antes de preparar lotes para importación. Repetir reutiliza las respuestas completas y solicita solo las faltantes. El informe indica `cached` y la fecha original: no promete frescura. `--refresh` requiere `--online` y renueva deliberadamente la caché, especialmente las temporadas provisionales. `--offline` reproduce sin peticiones. Guardar la caché en una carpeta local de trabajo, no en un repositorio público.

Por defecto: `--delay 1 --timeout 30 --retries 2`. Reintentos limitados para fallos transitorios, espera de `Retry-After` y detención de nuevas solicitudes tras 401/403 o 429 agotado. Si `Retry-After` pide más de 60 segundos o usa una fecha, detiene las solicitudes para reanudar más tarde. No genera firmas, copia cookies, resuelve CAPTCHA, cambia de proxy ni utiliza scraping HTML como alternativa a bloqueos. Cada respuesta se guarda de forma atómica.

## Validación y formato

Una temporada se valida completa antes de exportarla: liga, ID y nombre de temporada, `type=teams`, métrica solicitada, formato `percent`, IDs numéricos coherentes, unicidad y porcentaje finito estrictamente entre 0 y 100. Una fila inválida retiene toda la temporada. Clave externa: `(fotmob_team_id, fotmob_league_id, fotmob_season_id)`; se conserva el nombre exacto de la competición de MF Legacy.

Los registros incluyen los campos de `TeamSeasonPossession`, más `fotmob_league_id`, `fotmob_season_id` y `season_status`. El validador real de la interfaz conserva los campos de la entidad y las notas de procedencia; descarta los metadatos adicionales sin necesitar cambios de esquema. Los IDs de liga y temporada también quedan en las notas. `substatValue` contiene goles marcados en las muestras, **no partidos cubiertos**; se omite `matches_covered`.

La última temporada anunciada y cualquier temporada cuyo año inicial no sea anterior al actual se marcan conservadoramente `provisional`; las anteriores, `historical_unconfirmed`. No certifica el calendario exacto, el cierre ni la integridad. Todas quedan `pending`.

Salida 0: tablas solicitadas válidas, o descubrimiento sin ausencias. Salida 2: ausencias, conflictos, errores o argumentos inválidos. Los valores existentes iguales no son un error, pero se excluyen igualmente. Un 0 no implica autorización ni verificación para producción.

## Herramientas anteriores

`import_fotmob_snapshots.py` sigue aceptando snapshots normalizados `{competition, season, source_url, records}` y ahora rechaza directorios vacíos e IDs ficticios. `plan_coverage.py` sigue siendo un plan offline orientativo; su clasificación de calendarios no prueba disponibilidad en FotMob. Para disponibilidad observada utilizar `--discover-only`.

## Pruebas locales

```sh
python -m unittest discover -s scripts/possession -p "test_*.py" -v
node --test scripts/possession/test_compatibility.mjs
```

Incluyen las tres muestras reales, seis valores de referencia, ausencias y provisionalidad, contextos incorrectos, duplicados, porcentajes inválidos, identidades ambiguas, datos existentes/manuales/verificados, caché, lotes de 1.000 y límites HTTP. La prueba Node pasa la salida de Python al validador JavaScript de la interfaz. No contactan con FotMob ni Base44. El workflow de GitHub ejecuta las mismas comprobaciones.
