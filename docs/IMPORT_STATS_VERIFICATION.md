# Importación STATS — verificación del 26/10/2026

La reparación web está publicada en Base44. Una prueba real con Milan Škriniar (FotMob 309328) creó, tras autorización explícita, 12 registros sobre su Player existente: 872 valores/unidades, 505 métricas y 836 percentiles originales sin diferencias frente a la extracción. Son nueve registros de clubes y tres de selección. Se verificaron en la tabla STATS después de recargar, cerrar y volver a abrir la página.

El recorrido verificado fue PLAYERS → perfil/cachés FotMob → Studio Windows → worker Python → Base44 → revisión de administrador → STATS. El job recibió 872 candidatos únicos y terminó con todos aplicados. La reanudación tras un límite real de actualizaciones Base44 no duplicó la temporada ya creada.

La extracción inicial fue offline. Una comprobación posterior limitada a ocho consultas FotMob recuperó siete propuestas adicionales (345 valores), pendientes de una autorización separada. Treinta y una opciones siguen sin caché. Los conflictos de equipo o datos se retienen y no se transforman en estadísticas.

Las pruebas adicionales utilizaron cachés reales y un baseline de producción: De Bruyne (3672 valores), Courtois (1592), Valverde (2843) y Rüdiger (3702). No escribieron sus STATS. La lectura final confirmó que los 47 registros de Courtois y los 62 de Rüdiger conservan exactamente el baseline. Los grupos por proveedor pueden corresponder a la misma fila STATS, por lo que no se cuentan como filas independientes.

## Validación

- 309/309 pruebas Node.
- 23/23 pruebas Python worker/Studio.
- 5/5 pruebas de cobertura defensiva Studio.
- Lint y build correctos.
- Typecheck global mantiene los mismos 206 errores del baseline, sin errores nuevos. Este comando no pasa y sigue como deuda previa.

Se corrigió el uso de minutos estimados como denominador; las fórmulas de tasas y Play % exigen minutos reales. Se actualizaron pruebas anteriores para reflejar contratos ya presentes (tasa manual directa, selección pendiente, cobertura explícita y componentes separados) y se retiraron ocho imports sin uso.

## Conservación y límites

No se crean Players, equipos o selecciones desde esta reparación. Se vincula únicamente por identidad oficial única. El nombre y el ID FotMob se conservan cuando el enlace interno del catálogo está pendiente. Solo se completan valores vacíos y los conflictos bloquean el lote antes de escribir. Las tasas, los porcentajes, los valores GK negativos y los percentiles total/per90 permanecen separados.

Understat no tenía datos locales del jugador inicial; FIFA/EA FC y mercado no tenían catálogo histórico autorizado configurado. No se sustituyen esas ausencias por ceros. Las métricas derivadas de duelos conservan una explicación. Las evidencias de producción, capturas y contextos internos permanecen en worker/review/ y se excluyen de Git.

El parche portable de Studio se instala con worker/apply_studio_patch.py, que guarda respaldos. Véase worker/README.md para configuración, diagnóstico offline, revisión y ejecución dirigida a un job_id.
