# Importación histórica V3 — verificación de 27/10/2026

La revisión histórica conjunta está implementada y probada en MF LEGACY. Las fuentes nuevas añaden FC 26 Career Mode y tasas Understat recientes publicadas por Crafted. Se mantiene la aprobación explícita: extraer o abrir una pantalla no aplica candidatos automáticamente.

## Resultado funcional

- Una solicitud recupera el historial compatible del jugador registrado, conservando IDs, procedencia, hashes y unidades.
- La tabla conjunta agrupa por destino STATS o valoración. Muestra datos encontrados, existentes, nuevos, proveedor, verificación, conflictos y acción. FIFA y mercado de la misma temporada comparten registro.
- Los datos sin verificar quedan excluidos de la selección conjunta aunque compartan destino con candidatos válidos. Los valores manuales o existentes distintos se conservan.
- La selección confirmada se procesa en bloques de tres destinos. Se guardan propuesta, copias anteriores, cursor y resultados. Las propuestas grandes se fragmentan en campos administrativos de hasta 12.000 caracteres, con hashes individuales y de conjunto.
- Se comprueba la lectura posterior y se concilian respuestas perdidas sin repetir creaciones. La comprobación acepta propiedades opcionales que Base44 añade como `null`, manteniendo estrictos los valores solicitados, el orden y longitud de métricas y los ceros explícitos.
- El trabajador conserva un diario local del trabajo antes de enviar candidatos. Reanudar reutiliza el ID y el contenido original. Antes de una nueva extracción prioriza la conciliación de revisiones del mismo jugador; no quedan pendientes detrás de trabajos de otros jugadores.
- Se mantienen los avances concurrentes de cobertura FotMob, inventario por competición, cachés antiguas, espera entre bloques y parada ante restricciones del proveedor. La incorporación deportiva continúa requiriendo revisión explícita.

## Auditoría de los nueve fallos

Se reprodujeron los siete fallos Node y dos Python sobre la copia de main `4bb73f0bee37e828b4a302c043d51a94d8afa834`. Eran expectativas o mocks anteriores a las correcciones ya implementadas: IDs únicos, tasas directas sin total inventado, estado persistido de STATS, caché completa de consultas, selecciones sin enlace interno, observaciones sin identidad verificada, posesión ajustada con cobertura parcial y dos mocks antiguos del resolver/lectura de Studio.

PR 65 se integró mediante `5bf376ec6288e710e5e800ed756273b0acd3940c`. Además se repararon problemas funcionales comprobados: tasas de liga que desaparecían al incluir copas, reanudación y periodos pendientes, límites de campos de Base44 y diferencias entre la propuesta y los campos opcionales normalizados por el servidor. Las pruebas nuevas comprueban comportamiento y protección de datos, no solo nombres o texto del código.

## Fuentes y cobertura comprobada

| Fuente | Resultado |
| --- | --- |
| FotMob | Cachés de perfil y estadísticas con contexto exacto. La ejecución real recuperó 2.689 candidatos desde 42 recursos de caché, sin nuevas peticiones FotMob. Los candidatos sin verificar permanecen pendientes. |
| Understat histórico | Archivo público fijado por revisión, identidad y contexto liga/club/temporada. Se conservan sus denominadores propios y su precisión original. |
| Crafted como apoyo Understat | JSON SSR público de `season_rows`; se verifica ID FotMob, nombre, nacimiento, trayectoria y coincidencia de totales históricos con Understat. Valverde 2025/26: **0,6203 / 0,4981**; 2026/27: **0,5615 / 0,4586**. No se reconstruyen minutos Understat ni se promedian contextos sin denominador. Škriniar no añade temporadas verificables mediante esta vía. |
| FC 26 | CSV Career Mode de rovnez, versión 3, revisión 260004 de 19/09/2025, anterior al lanzamiento. SHA fijado, CC BY 4.0 con atribución. Škriniar **81/CB**; Valverde **89/CM**. |
| FIFA 15–FC 24 | Catálogo histórico gratuito ya contrastado; conserva edición, revisión, fecha y posición principal. |
| Transfermarkt | Archivo de valoraciones fechado; nunca precio de fichaje ni estimación del juego. Se conservan las fechas y los valores existentes. |

Fuentes, licencias y reglas detalladas: [HISTORICAL_SOURCE_AUTOMATION.md](HISTORICAL_SOURCE_AUTOMATION.md). Los archivos completos de proveedores no se publican en GitHub.

## Prueba real completa

Desde la sesión administradora se creó un trabajo de Valverde con las cuatro fuentes. Se recibieron **2.761 candidatos**: 2.689 FotMob, 57 Understat, 7 FIFA/FC y 8 mercado. La propuesta conjunta contenía **50 destinos**, con 9 nuevos, 8 para completar y 33 pendientes de verificación.

Se seleccionó únicamente **LaLiga 2025/26, Real Madrid**, con cuatro valores contrastados: Chain/90 **0,6203**, Buildup/90 **0,4981**, **2.746 minutos** y **33 partidos**. Los resúmenes de partidos/minutos conservan proveedor `craftedfc_match_context`; no se etiquetan como minutos Understat.

El circuito real detectó el límite del campo de propuesta y, posteriormente, la materialización de propiedades opcionales como `null`. Tras corregir ambas causas, se reanudó la selección original y se concilió la fila ya creada. Resultado: **1 registro creado, 4 valores conciliados, 0 conflictos y ninguna creación duplicada**. El navegador volvió automáticamente a STATS con ese resumen. Las tasas aparecen en el Overview y en el análisis comparativo, también después de recargar y reabrir la ficha. FC 26 89/CM y la valoración de 90 M€ del 05/06/2026 ya existentes se conservaron.

Se compararon todos los campos de los **20 STATS y 11 valoraciones anteriores** de Škriniar y Valverde: **ninguna diferencia**. El resultado pasó a 21 STATS y 11 valoraciones. Una segunda extracción Understat produjo 53 candidatos de otros periodos y **cero de 2025/26**. Los 21 STATS y 11 valoraciones permanecieron idénticos después de repetir. Los demás candidatos siguen pendientes de aprobación; no se realizó una aprobación masiva.

Copias antes/después, manifiesto limitado, trabajos, capturas tras recargar y logs completos se conservan localmente en `worker/review/v3-completion/`, excluido de Git.

## Validación y límites

- **353/353 Node**, **49/49 Python del trabajador** y **265/265 Studio** correctas, sin omisiones en las suites ejecutadas.
- **ESLint y compilación correctos**. Typecheck sigue notificando **203 errores preexistentes** del proyecto; no se presenta como una comprobación superada.
- FC 25 y FC 27 siguen pendientes de un archivo Career Mode de lanzamiento verificable. Los catálogos investigados eran Ultimate Team o no acreditaban edición/fecha; el Overall actual de Crafted no resuelve ese histórico.
- El proveedor del archivo Transfermarkt anunció la pausa de actualizaciones; no hay observaciones posteriores al corte de junio de 2026 en el catálogo contrastado. El endpoint R2 rechazó nuevas descargas durante la investigación; las cachés existentes siguen disponibles.
- La cobertura reciente de Crafted depende de cada jugador y liga y de poder corroborar la identidad. Sus valores modelados y Overall repetidos entre temporadas se excluyen.
- Copas y selecciones sin cobertura Understat no reciben cifras de liga. La temporada activa continúa oculta en los rankings STATS conforme a la configuración existente, sin borrar sus candidatos.
- El PC debe permanecer encendido con el trabajador activo para nuevas extracciones. No se ha contratado infraestructura ni ningún servicio de pago: **coste adicional 0 €**.
