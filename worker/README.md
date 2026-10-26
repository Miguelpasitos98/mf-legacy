# MF LEGACY V3 — Worker Python para Base44

**Opción gratuita para Windows:** lee [COMO_ACTIVAR_SIN_PAGAR.md](COMO_ACTIVAR_SIN_PAGAR.md), ejecuta INSTALAR_TRABAJADOR_V3.bat una vez y después INICIAR_TRABAJADOR_V3.bat. El alojamiento en la nube es opcional, no un requisito.

Estado: código preparado, no alojado ni activado. **No crea ni cambia registros STATS sin la revisión posterior del backend.**

## Componentes

- Base44 \`ImportJob\`: solicitudes y progreso de los jugadores.
- Base44 \`ImportCandidate\`: observaciones independientes (fuente, jugador, temporada, club, competición, valor, unidad, evidencia).
- \`import-control\`: autorización del administrador, vinculación FotMob, crear, cancelar y reintentar.
- \`import-worker\`: endpoint para servidor externo, secreto en entorno, lotes idempotentes, heartbeat y resultado.
- \`import-review\`: validación explícita y actualización conservadora de métricas u overall/valor históricos.
- \`mf_v3_worker.py\`: adaptador para Studio existente, con cachés y fuentes históricas verificadas opcionales.

## Pasos pendientes para ejecución real

1. Publicar las tres funciones de Base44 con la CLI **autenticada por el propietario** o el editor. La sesión actual de edición no tiene login de CLI.
2. Crear en los secretos de Base44 \`MF_V3_WORKER_TOKEN\` con al menos 32 caracteres aleatorios. Configurar exactamente el mismo token en el entorno del worker. **Nunca** incluirlo en frontend, el repositorio o URLs.
3. Identificar la URL HTTPS real que Base44 asigna a \`import-worker\` tras publicar. Configurarla como \`MF_V3_WORKER_URL\`.
4. Alojar el trabajador Python en un servidor persistente (contenedor/servicio gestionado) con copia de los módulos originales de Studio y el almacenamiento de cachés. El proyecto no proporciona alojamiento externo ni credenciales por sí solo.
5. Ejecutar una prueba de extremo a extremo con un jugador previamente vinculado, empezando con \`--once\` y fuentes locales.

## Variables de entorno del worker

- \`MF_V3_WORKER_URL\`: endpoint HTTPS real de la función (sin inventar URL).
- \`MF_V3_WORKER_TOKEN\`: token de servicio compartido con secreto Base44.
- \`MF_STUDIO_ROOT\`: carpeta que contiene \`app/\` y \`datos/\` de MF Legacy Studio.
- \`MF_V3_FIFA_JSON\`: catálogo local opcional (lista JSON) de ratings de cartas base por edición.
- \`MF_V3_MARKET_JSON\`: catálogo opcional (lista JSON) de valores de mercado con fecha exacta.
- \`MF_V3_ALLOW_FOTMOB_NETWORK=0\` (predeterminado): no nuevas consultas.
- \`MF_V3_MAX_FOTMOB_REQUESTS=0\` (predeterminado): máximo de nuevas peticiones por trabajo, con tope absoluto de 15.
- \`--max-candidates 300\`: máximo por fuente y trabajo. Limitar al iniciar en producción.

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
- FotMob: \`playerData\` y \`playerStats\` de la caché del Studio; si el club no es deducible con reglas seguras se omite.
- Understat: observaciones con jugador/temporada/competición/equipo conciliados; no se fusionan distintos clubes.
- FIFA/FC: solo overall carta base aportado por catálogo, no potencial/CA/PA.
- Mercado: valor publicado en fecha concreta, no precio de traspaso.
- La fuente y la unidad se mantienen separadas: total, /90, porcentaje.
- Los candidatos no alteran STATS hasta aprobarse; el aprobador conserva valores existentes distintos y correcciones manuales.
- Las funciones serverless sin desplegar y el worker sin alojamiento no ejecutan trabajos por sí solos.
- No se ha comprobado el webhook externo con credenciales y endpoint reales.

## Seguridad

Nunca usar un token del navegador como secreto del worker. El worker debe poder llamar solamente al endpoint que valida \`X-MF-Worker-Token\`; \`import-control\` e \`import-review\` exigen rol de administrador. Mantener el token en el gestor de secretos de ambas plataformas.