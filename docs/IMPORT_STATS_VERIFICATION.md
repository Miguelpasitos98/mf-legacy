# Importación y estabilidad STATS — 27/10/2026

La auditoría del 27/10/2026 verifica **19 filas de Milan Škriniar**, 1.217 valores/unidades, 710 métricas y 1.166 percentiles. Los 872 valores originales y los 345 adicionales autorizados coinciden con sus fuentes; cero duplicados y cero candidatos pendientes en el trabajo revisado. Se cerraron únicamente 872 candidatos repetidos ya aplicados y documentados.

La web está publicada en Base44. La prueba comparable de escritorio pasó de 19.96 s a 5.35 s hasta la tabla y de 36 a 16 solicitudes de entidades. Los cambios de temporada mantuvieron la tabla montada, sin nuevas lecturas; el desplazamiento visual observado bajó de 0,288999 a 0.002039. Son mediciones de esta sesión, con recarga completa y caché HTTP caliente; no representan un SLA ni un percentil estadístico.

## Conservación de datos

Las 1.235 filas STATS conservan sus campos estadísticos y manuales. Los 712 registros de posesión son idénticos a su copia previa, incluidos los no vinculados. Courtois conserva 47 filas y Rüdiger 62. No se crearon jugadores ni equipos para estas pruebas.

La vinculación nacional existente borraba el ID FotMob. Se corrigieron las rutas automática y manual y se recuperaron los cuatro IDs de Eslovaquia documentados en la extracción aprobada. Se conservaron los enlaces internos ya asignados. Por tanto, las filas originales conservan íntegramente sus estadísticas, aunque algunos metadatos de vinculación han cambiado. Quedan cuatro filas PSG sin enlace interno confirmado; sus nombres e IDs externos están preservados.

## Cambios de código

Una caché canónica completa de STATS alimenta filtros locales y Composite. Las páginas se leen por cursor con dos solicitudes simultáneas como máximo; una respuesta fallida, duplicada o incompleta conserva la instantánea anterior. Las mutaciones cancelan lecturas obsoletas antes de actualizar la caché. PLAYERS, equipos, países, ligas y posesión comparten lecturas completas. ImportCenter pagina candidatos, protege la selección frente a respuestas atrasadas y distingue carga de ausencia de observaciones.

STATS conserva búsqueda, filtros, ordenación y ambos scrolls al cambiar de sección o recargar la misma pestaña. Una pestaña nueva inicia su propio estado. No se persiste la selección de edición. La paginación visible continúa en 50 filas; no se añadió virtualización sin una mejora demostrada.

La normalización de nombres de métricas usa una caché acotada. Benchmark alternado de tres ejecuciones sobre los mismos 1.235 registros: comparación histórica 411.1 → 178.5 ms; resúmenes de temporada 400.7 → 82.7 ms (medianas). Se comprobaron salidas idénticas, sin cambiar fórmulas o pesos.

También se corrigió la interpretación DD/MM/YYYY en la ficha, el recorte de controles en móvil y la etiqueta de selecciones ya vinculadas.

## Pruebas

- 322/322 Node; 23/23 Python del worker; 265/265 Studio.
- Build y lint pasan localmente; también se ejecutaron en el sandbox Base44.
- Typecheck global falla con 204 errores previos, sin errores nuevos frente al baseline normalizado.
- Navegador publicado: búsqueda, filtros, temporadas, ordenación, actualización activa, scroll, navegación PLAYERS/ficha/STATS, recarga y reapertura; posesión 712 tras actualizar/recargar; vista de 390 px.
- Edición controlada aislada: un único registro sintético, un guardado, historial manual conservado y persistencia al abrir una pestaña nueva. Un fallo de red simulado conserva sus tres filas y muestra un error recuperable. Ningún dato deportivo real se editó para esa prueba.

## Publicación y límites

Publicación web final: commit `1d42aadbab5ec06ab0704b537b89deb621a3da36`, checkpoint `6ae0899ce99e0e42fd0f1d80`. El PR #65 conserva el parche portable del importador y agrega las pruebas y correcciones Windows; no se fusiona automáticamente.

El arranque independiente carga explícitamente el módulo Security de la versión de PowerShell en ejecución. Se verificaron configuración cifrada, proceso PowerShell/Python persistente y comunicación sin errores. Queda arrancado en modo SoloLocal; no realiza nuevas consultas FotMob.

Persisten 31 opciones FotMob sin caché, cuatro grupos retenidos por conciliación y ausencia de catálogos históricos autorizados para las fuentes que no los tienen. Se conservan como pendientes, sin fabricar datos. La posesión conserva 549 registros pendientes de enlace interno; no se eliminan ni se reconstruyen. El cálculo inicial aún contiene tareas largas y el build avisa de un bundle grande; no se afirma haber eliminado todo el trabajo síncrono de la aplicación. Evidencias detalladas y datos internos: `worker/review/`, excluido de Git.
