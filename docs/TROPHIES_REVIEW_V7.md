# MF Legacy · Trophies: fase 7 — Centro de revisión

## Uso
TROPHIES → **Revisar** presenta las adjudicaciones de `PlayerTrophyCredit`.
Filtra por estado, ID interno del equipo (buscador con escudos), trofeo,
temporada, texto libre o incidencias. La vista también muestra los títulos
confirmados y los excluidos, sin cambiar sus datos.

**Primera vez / cola vacía:** TROPHIES → Sincronizar → Jugadores elegibles →
seleccionar `TrophyHonour` verificado → Cruzar con STATS → Registrar
candidatos. El botón del centro de revisión abre directamente esa fase.

## Confirmación de una adjudicación
1. Pulsa «Revisar candidato» en una adjudicación pendiente y sin incidencias.
2. Abre la fuente del campeón y la evidencia del futbolista. Pega una
   URL HTTPS de una plantilla, acta, fuente federativa u otra fuente
   oficial que acredite **la elegibilidad de ese jugador y esa edición**.
3. Comprueba el contenido de la fuente y marca explícitamente la casilla.
4. Pulsa «Confirmar».

**Importante:** comprobar el formato de un enlace no equivale a verificar
el contenido remoto. La comprobación de elegibilidad es responsabilidad
del revisor. No hay confirmación automática basada solo en minutos,
pertenencia al club, valores de mercado o STATS.

### Revisión por lotes
Se pueden seleccionar hasta 50 candidatos filtrados/visibles.
- **Confirmar seleccionados:** exige URL individual válida y confirmación
  individual para **cada** jugador antes de realizar la primera escritura.
- **Excluir seleccionados:** requiere aceptar un diálogo explícito.
- Un plan inválido aborta **antes** de guardar cualquiera de sus filas.
- Las escrituras son secuenciales. Si una falla a mitad, se muestra cuántas
  se guardaron para permitir recuperación sin asumir una transacción atómica.

## Verificaciones
La adjudicación debe cumplir simultáneamente:
- `TrophyHonour` existe, está verificado y es del tipo `Team`;
- coinciden exactamente `recipient_id/team_id`, temporada,
  `trophy_source_id` e ID interno de `Player`;
- el equipo, el jugador y el trofeo están presentes en los catálogos;
- no hay adjudicaciones duplicadas del mismo jugador y título/edición,
  incluyendo copias de un `TrophyHonour` histórico;
- el estado es `candidate` y `verified !== true`.

Los registros inconsistentes quedan visibles, **bloqueados** y sin
modificaciones. Antes de escribir se releen las instantáneas completas
de `PlayerTrophyCredit` y `TrophyHonour` para detectar cambios.

## Persistencia
La confirmación actualiza `PlayerTrophyCredit.status="confirmed"`,
`verified=true`, `source_url` y añade una nota de revisión sin
perder la evidencia original de STATS. La exclusión establece
`status="excluded"`, `verified=false` y conserva la fuente.

**No se modifican** `Trophy`, `TrophyHonour`, `Team`,
`Player`, `PlayerSeasonStats`, `PlayerCareer` ni valoraciones
históricas. La entidad de créditos tiene restricciones de escritura
para administradores en Base44.

El resultado confirmado aparecerá automáticamente en el palmarés
del jugador, club y edición mediante las proyecciones ya existentes.
