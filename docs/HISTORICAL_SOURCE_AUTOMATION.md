# Automatización de fuentes históricas — 27/10/2026

ImportCenter V3 solicita un trabajo por jugador existente y vinculado con FotMob. El trabajador local reúne las tres fuentes, envía candidatos con procedencia y espera la revisión del administrador. La revisión completa campos vacíos y rechaza cifras, posiciones o fechas incompatibles con correcciones existentes. No modifica FM26.

## Fuentes consultadas

| Fuente | Archivo gratuito comprobado | Cobertura comprobada |
| --- | --- | --- |
| Understat | [vibedatascience, revisión 768b7ca](https://github.com/vibedatascience/understat_players_aggregated/tree/768b7ca0b977a5e6b4b429c7b0cf750e8269f2fc) | Premier League, LaLiga, Bundesliga, Serie A, Ligue 1 y liga rusa; campañas desde 2014/15, con snapshot parcial de 2025/26 del 21/09/2025. |
| FIFA/FC | [Stefano Leone, EA Sports FC 24 complete player dataset](https://www.kaggle.com/datasets/stefanoleone992/ea-sports-fc-24-complete-player-dataset), versión 1 | Career Mode masculino, ediciones FIFA 15 a FC 24. CC0 según los metadatos publicados. |
| FC 26 | [rovnez, FC 26 FIFA 26 player data](https://www.kaggle.com/datasets/rovnez/fc-26-fifa-26-player-data), versión 3, `FC26_20250921.csv` | Career Mode, revisión 260004 de 19/09/2025, anterior al lanzamiento 26/09. CC BY 4.0, atribución rovnez. Archivo y SHA fijados. |
| Understat reciente, apoyo | [Perfil público de Crafted](https://craftedfc.com/player-ratings/federico-valverde) y [metodología](https://craftedfc.com/methodology) | Filas `season_rows`, liga/club/temporada. Valverde 2025/26 y 2026/27 contrastados con identidad FotMob y totales históricos Understat. No se usan mezclas, radar, valor modelado ni Overall actual como histórico. |
| Transfermarkt | [dcaribou/transfermarkt-datasets](https://github.com/dcaribou/transfermarkt-datasets) | Archivo publicado de jugadores y valoraciones, snapshot 06/07/2026; última fecha observada 12/06/2026. Licencia CC0 del repositorio. |

Se reutilizan archivos públicos acotados: unos 7 MB de Understat, 32 MB del ZIP FIFA, 10,6 MB del CSV FC 26 y 4,4 + 7,2 MB de Transfermarkt, una sola vez por caché/revisión. Para Understat reciente se consulta únicamente el perfil público del jugador solicitado en Crafted, con un máximo de 4 MB y caché de 24 horas. No se descargan partidos ni perfiles masivamente. Understat bloquea robots; FIFAIndex/SoFIFA y Transfermarkt rechazaron consultas directas durante la investigación. No se eluden estos controles. Las copias públicas sin licencia general se conservan localmente con atribución y no se redistribuyen en GitHub.

## Identidad, alcance y reglas

- Understat: nombre exacto y dos contextos de club/temporada de la trayectoria FotMob; correspondencia persistente de IDs. Solo liga y club exactos, sin repartir agregados de varios clubes. Los totales se dividen por sus propios minutos Understat. Las tasas ya importadas como `per90` se leen directamente. Se mantienen los minutos FotMob existentes.
- FIFA/FC: nombre, nacimiento del perfil original FotMob y club de la trayectoria; un único ID del archivo. Temporada 2022/23 → FIFA 23; 2023/24 → FC 24. Se elige el último snapshot disponible anterior o igual a la fecha de lanzamiento documentada. Se conserva fecha y revisión, sin afirmar que el archivo pruebe todas las revisiones intermedias del lanzamiento. Solo Overall entero 1–99 y primera posición exacta de Career Mode; no Potential, cartas especiales ni valor monetario del juego.
- Mercado: nombre y nacimiento exactos, con un único ID Transfermarkt. Última valoración fechada dentro de 1 de julio–30 de junio; en temporada abierta, hasta la fecha actual. No se arrastra una cifra fuera de ese intervalo. Conflictos de una misma fecha se rechazan. Euros enteros y fecha exacta; cero explícito es válido.
- Los enlaces internos de club usan un ID FotMob único del catálogo. Si falta, la revisión puede reutilizar únicamente el club actual del jugador cuando coinciden su pertenencia, el nombre del club y cualquier ID externo ya registrado. Las coincidencias no resueltas quedan pendientes, sin crear clubes.

## Persistencia y reutilización

`worker/historical_sources.py` alimenta automáticamente `FUENTES/AUTOMATION/catalogues.sqlite3` en Studio. Guarda archivos con SHA-256, correspondencias, resultados por jugador/fuente/temporada/edición/snapshot y trabajos enviados. Estados: no consultado (sin fila), consulta pendiente, encontrado, pendiente de verificación, verificado y guardado, fuera de cobertura y error temporal. Un fallo de red nunca demuestra ausencia de cobertura. Hay enfriamiento de seis horas tras errores y reintento explícito de fuentes pendientes. La conciliación rota entre trabajos para no abandonar los posteriores.

`--sync-reviews` consulta únicamente el estado de revisión en Base44. Una temporada/fuente se marca guardada cuando todos sus candidatos se han aplicado sin descartes. Futuras consultas omiten esos candidatos. `-SoloLocal` desactiva toda lectura externa de proveedores. El lanzador normal habilita los archivos públicos; no hacen falta cuatro búsquedas manuales ni JSON aportados por el usuario. Las variables `MF_V3_FIFA_JSON` y `MF_V3_MARKET_JSON` siguen admitidas como alternativa explícita.

Base44 conserva procedencia en `ImportCandidate.provenance`, métricas de `PlayerSeasonStats` y `PlayerHistoricalValuation.source_provenance`: ID, archivo, SHA, fecha/revisión y regla. Overall/mercado residen en la valoración de jugador/temporada y se integran con STATS/COMPARACIÓN mediante las consultas compartidas existentes.

## Prueba real de producción

Trabajos creados desde la interfaz: Valverde `6ae0c57a7843d60da4bff195` y Škriniar `6ae0c6449030f1611e5092d6`. Ejecutados con el trabajador real, secreto DPAPI y caché local, sin lecturas externas durante estos trabajos.

| Jugador / temporada de prueba | Understat / minutos | Chain/90 | Buildup/90 | FC 24 / revisión | Mercado |
| --- | --- | --- | --- | --- | --- |
| Škriniar / PSG Ligue 1 2023/24 | 1223 / 1613 | 0,5161540821 | 0,5161540821 | 84 / CB / 240002, 22/09/2023 | 30.000.000 EUR, 03/06/2024 |
| Valverde / Real Madrid LaLiga 2023/24 | 6241 / 2931 | 0,8587722672 | 0,6407344310 | 88 / CM / 240002, 22/09/2023 | 120.000.000 EUR, 07/06/2024 |

Se aprobaron únicamente 16 candidatos de esta prueba: cinco métricas de Škriniar, siete de Valverde y dos valoraciones por jugador. Škriniar conserva sus 19 STATS; se completó una fila existente. Valverde obtuvo su primera fila STATS. Se creó una valoración de Škriniar y se completó la valoración existente de Valverde, conservando 88/CM y su URL anterior. Los demás candidatos siguen pendientes de revisión; no se realizó una aplicación masiva.

Lectura posterior: los 710 objetos de métricas y 1.217 valores originales de Škriniar conservan todos sus campos. Las copas y selecciones originales no reciben cifras Understat de liga. La segunda ejecución comprobada devuelve cero candidatos de 2023/24 y hace cero peticiones externas. Los cuatro indicadores aparecen en la comparación de ambos jugadores. La falta de una población comparable suficiente para Valverde se representa sin percentil ni Composite inventado.

## Límites pendientes

- FC 26 ya dispone del archivo contrastado descrito arriba: Škriniar 81/CB y Valverde 89/CM. FC 25 y 27 siguen pendientes de un snapshot Career Mode de lanzamiento verificable. Los archivos públicos examinados eran Ultimate Team o revisiones sin edición/fecha inequívoca. Las valoraciones anteriores se conservan.
- El archivo Understat fijo sigue siendo parcial para 2025/26. Crafted amplía las temporadas recientes cuando su fila pública pasa ID FotMob, nombre, nacimiento, trayectoria y contraste histórico. No se generaliza la cobertura a otros clubes, copas o selecciones. Škriniar no añade temporadas mediante esta vía. Exportaciones sin contraste independiente siguen sin verificar.
- La temporada 2026/27 de mercado no tiene observaciones en este snapshot. Un archivo más reciente deberá incorporarse explícitamente a la lista permitida; no se convierte una caché en un rastreador.
- El PC y trabajador deben estar encendidos para ejecutar trabajos nuevos. Se reutiliza la configuración existente y no se contrata infraestructura.
- Los esquemas nuevos son opcionales y se fusionaron con los existentes conservando RLS. Typecheck conserva problemas previos del proyecto; véase el informe local para el recuento actual.

## Verificación

`node --test tests/*.test.mjs`, `python -m unittest discover -s worker/tests -v` con `MF_STUDIO_ROOT`, `npm run lint` y `npm run build`. Pruebas de identidad, periodos, revisión de lanzamiento, conflictos/manuales, errores temporales, caché, límites y división por minutos. Evidencias completas y manifiesto limitado en `worker/review/source-automation/`, excluido de Git por contener capturas y datos reales de producción.

## Revisión conjunta y reanudación

«Revisar todas las temporadas disponibles» prepara una fila por destino STATS o valoración histórica. FIFA y mercado de una temporada comparten destino. Cada fila muestra los valores encontrados, existentes y nuevos, proveedor, evidencia y verificación. Los candidatos sin verificar permanecen excluidos incluso si comparten destino con candidatos verificados. Ninguna extracción ni apertura de pantalla aprueba automáticamente datos.

La selección necesita confirmación explícita. `ImportReviewBatch` conserva la propuesta, copias anteriores, huella, cursor y resultado por destino. Se procesan tres destinos por llamada y se comprueba la lectura posterior antes de marcar candidatos aplicados. Una concesión corta evita revisiones simultáneas; las actualizaciones exigen la misma versión del destino. Los cortes tras una escritura se concilian por su ID de lote y contenido, sin repetir creaciones. Una corrección manual de xG Chain/Buildup o sus minutos bloquea nuevas representaciones incompatibles.

El trabajador guarda el conjunto exacto de candidatos antes del primer envío. Reanudar un trabajo interrumpido conserva su ID y reutiliza ese conjunto. «Reintentar fuentes pendientes» crea una consulta limitada a los periodos no resueltos; no vuelve a pedir datos ya encontrados. Un pulso independiente mantiene la concesión durante consultas lentas.

## Precisión de Crafted

Se decodifica únicamente el JSON SSR público, sin ejecutar JavaScript. Se conservan URL, SHA-256 y fecha de recuperación. Caché de 24 horas, espera de seis horas tras error y parada ante una denegación; sin proxies ni evasión. El contenido se usa como referencia local del jugador solicitado, no para entrenamiento ni redistribución del catálogo.

Valverde: tasas publicadas Chain/Buildup de 2025/26 **0,6203 / 0,4981**, y de 2026/27 **0,5615 / 0,4586**. Los totales 2023/24 coinciden con el archivo Understat original. Crafted no expone el denominador Understat de esas filas recientes: las tasas se guardan como `/90` y no se dividen por minutos FotMob. Sus resúmenes de partidos/minutos llevan proveedor `craftedfc_match_context`; no se convierten en «Understat minutes». Una sola liga cubierta se muestra con cobertura parcial; varios contextos sin denominadores compatibles no se promedian.

El Overall actual y el valor modelado de Crafted se repiten entre temporadas sin una revisión histórica: se excluyen de las importaciones FIFA/Transfermarkt. La temporada activa sigue oculta en los rankings STATS conforme a la configuración existente, sin borrar sus candidatos o datos.
