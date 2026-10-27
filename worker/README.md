# MF LEGACY V3 — Worker Python para Base44

**Opción gratuita para Windows:** lee [COMO_ACTIVAR_SIN_PAGAR.md](COMO_ACTIVAR_SIN_PAGAR.md), ejecuta INSTALAR_TRABAJADOR_V3.bat una vez y después INICIAR_TRABAJADOR_V3.bat. El alojamiento en la nube es opcional, no un requisito.

Reparación publicada y verificada el 27/10/2026: 19 registros de Milan Škriniar, 1.217 valores y 1.166 percentiles, incluidas las siete filas adicionales autorizadas. Persistencia comprobada tras recarga y reapertura. Véase [verificación y auditoría](../docs/IMPORT_STATS_VERIFICATION.md). **No crea ni cambia registros STATS sin la revisión posterior del backend.**

## Componentes

La alimentación automática de Understat, FIFA/FC y mercado ya está implementada en `historical_sources.py`. El lanzador normal descarga una vez los archivos públicos permitidos y reutiliza SQLite y SHA-256. Consulta [fuentes, reglas temporales y prueba real](../docs/HISTORICAL_SOURCE_AUTOMATION.md). No requiere preparar catálogos JSON manualmente. `-SoloLocal` desactiva lecturas externas; `-SincronizarRevisiones` actualiza los estados guardados sin consultar proveedores.

- Base44 \`ImportJob\`: solicitudes y progreso de los jugadores.
- Base44 \`ImportCandidate\`: observaciones independientes (fuente, jugador, temporada, club, competición, valor, unidad, evidencia).
- \`import-control\`: autorización del administrador, vinculación FotMob, crear, cancelar y reintentar.
- \`import-worker\`: endpoint para servidor externo, secreto en entorno, lotes idempotentes, heartbeat y resultado.
- \`import-review\`: validación explícita y actualización conservadora de métricas u overall/valor históricos.
- \`mf_v3_worker.py\`: adaptador para Studio existente, con cachés y fuentes históricas verificadas opcionales.

## Configuración para ejecución real

1. Publicar los esquemas, las tres funciones y la pantalla ImportCenter con el editor, el conector oficial o la CLI autenticada por el propietario.
2. Crear en los secretos de Base44 \`MF_V3_WORKER_TOKEN\` con al menos 32 caracteres aleatorios. Configurar exactamente el mismo token en el entorno del worker. **Nunca** incluirlo en frontend, el repositorio o URLs.
3. Identificar la URL HTTPS real que Base44 asigna a \`import-worker\` tras publicar. Configurarla como \`MF_V3_WORKER_URL\`.
4. Ejecutar el trabajador en el PC Windows con Studio y las cachés locales. Puede trasladarse opcionalmente a un servidor persistente; no se necesita contratar alojamiento para usarlo en el PC.
5. Ejecutar una prueba de extremo a extremo con un jugador previamente vinculado, empezando con \`--once\` y fuentes locales.

## Variables de entorno del worker

- \`MF_V3_WORKER_URL\`: endpoint HTTPS real de la función (sin inventar URL).
- \`MF_V3_WORKER_TOKEN\`: token de servicio compartido con secreto Base44.
- \`MF_STUDIO_ROOT\`: carpeta que contiene \`app/\` y \`datos/\` de MF Legacy Studio.
- \`MF_V3_FIFA_JSON\`: catálogo local opcional (lista JSON) de ratings de cartas base por edición.
- \`MF_V3_MARKET_JSON\`: catálogo opcional (lista JSON) de valores de mercado con fecha exacta.
- \`MF_V3_ALLOW_FOTMOB_NETWORK=0\` (predeterminado): no nuevas consultas.
- \`MF_V3_MAX_FOTMOB_REQUESTS=0\` (predeterminado): máximo de nuevas peticiones por trabajo, con tope absoluto de 15.
- \`--max-candidates 6000\`: máximo por fuente y trabajo. Limitar al iniciar en producción.

Se recomienda utilizar los registros de caché existentes primero. No hay rastreo masivo de FotMob ni scraping de Transfermarkt; la lectura de históricos FIFA/mercado parte de datos con evidencias registradas.

## Formato de catálogos FIA/mercado

Archivos JSON con una lista de registros. El \`fotmob_player_id\` debe coincidir exactamente con el jugador solicitado.

FIFA/FC: \`fotmob_player_id\`, \`season\`, \`fifa_edition\`, \`fifa_fc_overall\`, \`fifa_fc_position\`, \`source_url\`, \`verified\`.

Mercado: \`fotmob_player_id\`, \`season\`, \`transfermarkt_value_eur\`, \`market_value_as_of\` (YYYY-MM-DD), \`source_url\`, \`verified\`.

\`verified=true\` solo si la fila se comprobó de manera independiente. No es una suposición basada en tener una URL.

## Uso

\`\`\`bash
python3 worker/mf_v3_worker.py --dry-run 276738
python3 worker/mf_v3_worker.py --once
python3 worker/mf_v3_worker.py
python3 -m unittest discover -s worker/tests -v
\`\`\`

El primer comando no toca Base44. El tercero ejecuta un proceso persistente **solo mientras el entorno anfitrión siga encendido**. Usar un gestor de servicios/reinicios al desplegarlo.

## Garantías y límites

- Jugador existente: vinculación precisa con ID FotMob.
- FotMob: \`playerData\` y \`playerStats\` de la caché del Studio; si el equipo no es deducible con reglas seguras se conserva el diagnóstico pendiente de conciliación.
- Understat: observaciones con jugador/temporada/competición/equipo conciliados; no se fusionan distintos clubes.
- FIFA/FC: solo overall carta base aportado por catálogo, no potencial/CA/PA.
- Mercado: valor publicado en fecha concreta, no precio de traspaso.
- La fuente y la unidad se mantienen separadas: total, /90, porcentaje.
- Los candidatos no alteran STATS hasta aprobarse; el aprobador conserva valores existentes distintos y correcciones manuales.
- Las funciones serverless sin desplegar y el worker sin alojamiento no ejecutan trabajos por sí solos.
- Comunicación real worker–Base44 comprobada: revisión de 1.217 observaciones y persistencia en 19 registros autorizados. Las siete propuestas adicionales (345 valores) ya están aplicadas; los candidatos repetidos se conciliaron sin reescribir STATS.

## Seguridad

Nunca usar un token del navegador como secreto del worker. El worker debe poder llamar solamente al endpoint que valida \`X-MF-Worker-Token\`; \`import-control\` e \`import-review\` exigen rol de administrador. Mantener el token en el gestor de secretos de ambas plataformas.

## Reparación de primera importación (26/10/2026)

El adaptador conserva las ramas de clubes/selecciones, `leagueId` del historial,
`entryId` del perfil y el formato original de las estadísticas. Una competición
no se identifica por el número de edición `careerHistory.tournamentId`.
El mapa de tiros solo acredita al jugador exacto y nunca divide un agregado
que puede contener varios clubes. Las asignaciones manuales existentes se conservan.

1. Instalar el parche en una copia existente de Studio:
   `python worker/apply_studio_patch.py "RUTA_STUDIO"`. Se guardan respaldos en
   `RESPALDOS/IMPORT_STATS_*`; no se modifican cachés ni asignaciones manuales.
2. Diagnóstico sin red, incluso si el entorno permite peticiones:
   `python worker/mf_v3_worker.py --dry-run 309328 --output worker/review/extraction.json`.
   Alternativa Windows: `./worker/MF_V3_LOCAL.ps1 -Diagnosticar 309328 -Salida resultado.json`.
3. El archivo de contexto para `prepare_stats_review.mjs` contiene `player`
   (id y name), `links` (vinculaciones verificadas), `existing_stats`, `teams`
   y `national_teams`, obtenidos por lectura de Base44. Ejecutar:
   `node worker/prepare_stats_review.mjs extraction.json contexto.json propuestas.json`.
   Es un constructor offline: no invoca funciones ni escribe datos remotos.
4. Publicar conjuntamente los esquemas ImportCandidate/PlayerSeasonStats,
   import-worker/import-review y la pantalla ImportCenter. Se puede revisar
   la escritura propuesta por temporada antes de confirmar su incorporación.
5. Tras autorización, el administrador confirma la evidencia por temporada.
   Se crea una fila nueva o se completan campos vacíos, incluidos PJ/MIN/Rating.
   Valores distintos, duplicados y vínculos de identidad contradictorios bloquean
   el lote completo antes de escribir. El proceso no crea jugadores.

`MF_V3_LOCAL.ps1 -SoloLocal` procesa trabajos únicamente con cachés. El límite
configurado de peticiones se respeta también cuando el proveedor falla.
El límite de 6000 observaciones por fuente no corta una temporada a la mitad;
las omitidas por límite se identifican explícitamente. Las observaciones y
el diagnóstico se paginan para superar los antiguos topes de 200/500.

Las métricas derivadas conservan una explicación; porcentajes, totales, tasas
por 90 y por partido se guardan separados. Las cifras repetidas de Rating,
Minutes y Matches en el slot `per90` de FotMob no se importan como tasas.
Los equipos del catálogo se vinculan solo por ID oficial único; una identidad
externa válida puede quedar con su enlace interno pendiente, sin crear equipos.

Pruebas: `python -m unittest discover -s worker/tests -v` (establecer
`MF_STUDIO_ROOT` para las pruebas reales de Studio) y
`node --test tests/importReviewCreation.test.mjs tests/importWorkerBridge.test.mjs tests/statsReviewManifest.test.mjs`.
Las pruebas del manifiesto real requieren el artefacto local
`worker/review/skriniar-extraction.json`; no se suben cachés ni datos internos a GitHub.


## Arranque independiente — verificación 27/10/2026

El lanzador importa el módulo Security de su propio PSHOME para evitar conflictos entre PowerShell 5 y 7. Se comprobó un arranque oculto independiente y su proceso Python persistente. La sesión de auditoría deja el trabajador en modo `-SoloLocal`: usa cachés existentes y no consulta FotMob. El inicio normal conserva el presupuesto configurado. No se guardan credenciales en el repositorio.
