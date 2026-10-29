# MF Legacy · Trophies fase 8: sincronización incremental STATS → candidatos

## Ubicación
TROPHIES → **Revisar** → «Sincronización incremental desde STATS».

### Detección automática
- Al **entrar en Revisar**, después de cargar por completo los títulos y catálogo, se vuelven a consultar las estadísticas reales y los créditos existentes.
- Solo se procesan títulos de primer equipo marcados `verified: true`, vinculados mediante IDs reales de Team y Trophy.
- La coincidencia es **ID de Player + ID de Team + temporada + competición exacta o alias controlado** con `appearances > 0`.
- Se crean como máximo **40 candidatos** automáticamente por apertura para evitar saturar Base44.
- El botón «Buscar y sincronizar novedades» permite añadir **200 candidatos más por lote**. Repite para terminar con los restantes.
- Una importación de STATS completada mientras Revisar está cerrado se detecta al **volver a entrar a Revisar**, no mediante un trabajador permanente ni cron.
- Las ediciones con jugadores de club/temporada pero sin participación demostrada en su competición permanecen en una lista de **ediciones que necesitan más datos**.

### Datos
Solo se crean nuevos `PlayerTrophyCredit`:
```json
{"status":"candidate","verified":false,"evidence_type":"competition_appearance","source_url":""}
```
Con `trophy_honour_id`, `trophy_source_id`, `player_id`, `team_id`, `season`, y `evidence_note` de apariciones y fuente STATS. No se otorga ningún título automáticamente.

### Idempotencia y seguridad
- Clave lógica: `team_id + season + trophy_source_id + player_id`.
- Reimportar la misma temporada, repetir STATS, o usar una copia del mismo `TrophyHonour` **no genera nuevos candidatos**.
- Los créditos `candidate`, `confirmed` y `excluded` ya existentes se omiten y **nunca se sobreescriben**.
- Nunca se adjudican ganadores por parecido de nombre, valor de Transfermarkt o pertenencia al club sin participación.
- El sistema lee una instantánea completa y falla de forma explícita cuando no puede comprobarla; no publica resultados parciales como si fueran completos.
- El navegador no puede garantizar atomicidad entre distintos usuarios concurrentes: no existe una restricción de unicidad de servidor para estos registros. La conciliación protege frente a duplicados existentes y dos ejecuciones simultáneas dentro del mismo panel.
- Puede haber importaciones demasiado grandes para la lectura de instantánea completa predeterminada de STATS (20.000 filas); se mostrará un error y **no se modificarán títulos ni adjudicaciones confirmadas**. Una evolución posterior es ejecutar la conciliación paginada en backend por club y temporada.

### Relación con fase 7
Los nuevos candidatos aparecen automáticamente en «Revisar». La aprobación continúa requiriendo inspección manual de una URL oficial para ese **jugador y edición concreta**. Un enlace HTTPS válido no sustituye verificar que la fuente acredita la elegibilidad.

### No incluido
La fase 8 no instala un proceso residente, tarea programada o gancho de backend en todos los importadores. La actualización se ejecuta cuando se abre Revisar y cuando se pulsa el botón de sincronización.
