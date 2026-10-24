# Investigación de FotMob — 22 de octubre de 2026

## Fuente y estado

- Directorio: `GET https://www.fotmob.com/api/data/allLeagues?locale=en&country=ESP`. HTTP 200; IDs de las 18 denominaciones contrastados por país e ID, no solo por nombre. El catálogo agrupa 16 proveedores, pero no fusiona las 18 entidades de MF Legacy.
- Descubrimiento: `GET https://www.fotmob.com/api/data/leagueseasondeepstats?id=55&type=teams`. HTTP 200; devuelve `seasons`. Sin temporada ni métrica, `statsData` está vacío y `currentSeasonId` / `currentStatName` son cadenas vacías: no hay que interpretarlo como posesión cero.
- Tabla: `GET https://www.fotmob.com/api/data/leagueseasondeepstats?id=55&season=27044&type=teams&stat=possession_percentage_team`. HTTP 200 sin cookies ni firmas añadidas en la comprobación puntual. `season` es el ID interno, no la etiqueta `2025/2026`.
- El componente público de estadísticas utiliza `/api/data/leagueseasondeepstats`, quita `page` y `position` de la consulta y pasa los parámetros de ruta al cargador. Esos dos filtros no se utilizan en este extractor. `teamId` existe como filtro opcional en el esquema de la web; no se envía para obtener todos los equipos.
- La [página de referencia](https://www.fotmob.com/es/leagues/55/stats/season/27044/teams/possession_percentage_team/serie-teams) también incluye los datos iniciales en `__NEXT_DATA__.props.pageProps.data`. Se inspeccionó para confirmar la estructura, no se implementó como vía alternativa ante bloqueos.
- Componente observado: `/_next/static/chunks/62495-274a1c5dfff6a599.js`, build `production:ff5f54dcc8ffb72d61471086dce24022ed9f4612`. Los nombres de chunks no son una API estable y el extractor no depende de ellos.

El endpoint indicado sigue siendo el utilizado. No se han eludido autenticación, firmas, CAPTCHA, antibots ni límites. Los [términos del proveedor](https://www.fotmob.com/tos.txt), apartado DATA USAGE & SCRAPING, requieren consentimiento escrito y prohíben la recuperación automática/sistemática. HTTP 200 no prueba autorización de reutilización. No se ha obtenido dicho permiso: se entrega el modo de respuestas guardadas y un transporte preparado, sin afirmar que exista una campaña masiva autorizada operativa.

## Respuesta observada

Campos principales: `statsData`, `seasons`, `statsList`, `leagueDetails`, `type`, `teamName`, `currentSeasonId`, `currentStatName`, `teamColors`, `substatTitle` y `substatLocalizedTitleId`.

Una fila de Serie A tiene `id=8636`, `teamId=8636`, `name=Inter`, `type=teams` y `statValue={name: possession_percentage_team, value: 59.7, format: percent, fractions: 1}`. `substatValue.value=89` corresponde a **goles marcados**, según `substatTitle=Total goals scored`. No se publica número de partidos cubiertos en estas tablas: queda ausente, sin estimaciones.

Cada entrada de `seasons` declara `id`, `name`, `leagueId` y `leagueName`. El extractor conserva esa relación y comprueba que la tabla solicitada la repita; si el proveedor devuelve otra temporada, liga o métrica, retiene los datos. Cuando el catálogo incluye un `leagueId` específico de temporada, se usa ese ID, no se fuerza el actual.

## Disponibilidad realmente observada

La siguiente tabla refleja el **catálogo de estadísticas** de las respuestas del 22-10-2026. Solo se solicitaron las tres tablas indicadas abajo; anunciar una temporada no confirma que tenga valores de posesión.

| Serie A | ID de temporada | MLS | ID de temporada |
|---|---:|---|---:|
| 2016/2017 | 10692 | 2016 | 10095 |
| 2017/2018 | 11768 | 2017 | 11140 |
| 2018/2019 | 13037 | 2018 | 12376 |
| 2019/2020 | 14290 | 2019 | 13473 |
| 2020/2021 | 15604 | 2020 | 14818 |
| 2021/2022 | 16621 | 2021 | 16168 |
| 2022/2023 | 17866 | 2022 | 17185 |
| 2023/2024 | 20956 | 2023 | 18572 |
| 2024/2025 | 23819 | 2024 | 22602 |
| 2025/2026 | 27044 | 2025 | 24524 |
| 2026/2027 | 36072 | 2026 | 29580 |

2015/2016 de Serie A y 2015 de MLS no figuran en estos catálogos; se informa `unavailable`, sin inventar IDs ni extrapolar posesión. El resumen general de MLS muestra temporadas desde 2010, pero eso no acredita estadísticas profundas desde ese año.

## Tablas contrastadas y registros

| Competición | Liga FotMob | Temporada | ID | Filas válidas | Comprobación |
|---|---:|---|---:|---:|---|
| Serie A | 55 | 2025/2026 | 27044 | 20 | Como 61,6; Inter 59,7; Napoli 58,9; Juventus 57,5; Roma 56,3; Milan 51,9 |
| Serie A | 55 | 2016/2017 | 10692 | 20 | Napoli 61,9; temporada navegada en el selector de la web |
| MLS | 130 | 2026 | 29580 | 30 | San Diego FC 60,2; temporada de año natural, provisional |

Las tres respuestas completas se conservan en `fixtures/`, con URL y momento de captura en `manifest.json`. Son muestras de investigación, no una campaña automática ni una garantía de derechos de reutilización. Las 70 filas pasan el parser y el validador JavaScript real de MF Legacy, permanecen `pending` y no se han escrito en producción.

## Competiciones del catálogo

| Nombre MF Legacy | ID FotMob | País | Cobertura histórica investigada |
|---|---:|---|---|
| Eredivisie | 57 | NED | Pendiente |
| Liga Profesional | 112 | ARG | Pendiente |
| Saudi Pro League | 536 | KSA | Pendiente |
| Eliteserien | 59 | NOR | Pendiente |
| Austrian Bundesliga | 38 | AUT | Pendiente |
| Campeonato Brasileiro Série A | 268 | BRA | Pendiente; conflicto de denominación |
| Série A | 268 | BRA | Pendiente; conflicto de denominación |
| Primeira Liga | 61 | POR | Pendiente |
| EFL Championship | 48 | ENG | Pendiente; conflicto de denominación |
| Sky Bet Championship | 48 | ENG | Pendiente; conflicto de denominación |
| Turkish Super League | 71 | TUR | Pendiente |
| Super League Greece | 135 | GRE | Pendiente |
| Ligue 1 | 53 | FRA | Pendiente |
| MLS | 130 | USA | Catálogo 2016–2026; tabla 2026 |
| Bundesliga | 54 | GER | Pendiente |
| Premier League | 47 | ENG | Pendiente |
| Serie A | 55 | ITA | Catálogo 2016/2017–2026/2027; dos tablas |
| LaLiga EA Sports | 87 | ESP | Pendiente |

Los dos grupos duplicados requieren selección explícita de un nombre por ejecución. Compartir un ID de proveedor no modifica ni fusiona entidades de MF Legacy.

## Protección de los datos existentes

No hay llamadas al SDK de Base44 ni escrituras remotas. `--existing` compara el export actual y excluye todos los registros existentes, sean manuales, verificados o pendientes, con valores iguales o diferentes. Las propuestas quedan en el informe. `--teams` solo utiliza IDs internos existentes con una relación FotMob unívoca. Un alias sin identidad externa puede retener una temporada entera para revisión. Esto prioriza no duplicar sobre exportar más filas. Sin esos exports se deja constancia de la comparación pendiente; no se afirma que los 70 equipos estén vinculados al catálogo real.

La aplicación limita a 1.000 filas por lote. El extractor genera fragmentos dentro de un directorio exclusivo de cada ejecución. La fuente, IDs y fecha de captura también se guardan en `notes`, un campo que sí conserva el validador de la entidad; los metadatos externos adicionales se descartan al importar sin alterar el esquema.

## Pendientes y alcance de las pruebas

- Obtener permiso escrito o una vía de datos con condiciones que permitan esta recuperación. No se ha contactado con FotMob en nombre del usuario.
- Investigar cobertura y tablas de las otras 16 denominaciones, más las temporadas anunciadas pero no solicitadas de Serie A/MLS, mediante esa vía permitida.
- Resolver los dos grupos de nombres duplicados dentro del catálogo del usuario; el programa no los fusiona.
- Comparar con exports actuales de equipos y posesiones antes de preparar una importación real. No hay autorización de sobrescritura.
- La provisionalidad se marca de forma conservadora por catálogo y año inicial; no se ha certificado el cierre exacto de cada torneo.
- El transporte de red cuenta con pruebas simuladas de caché, reintentos y bloqueos. La prueba real de extracción y formato se limita a las tres muestras puntuales. No se ha probado una descarga masiva autorizada.

Las instrucciones y comandos exactos están en [README.md](README.md). Las pruebas son offline y no requieren abrir Base44, ejecutar su editor, instalar dependencias del frontend ni utilizar credenciales de producción.
