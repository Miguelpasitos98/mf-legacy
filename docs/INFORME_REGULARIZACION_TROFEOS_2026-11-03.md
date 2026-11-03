# MF LEGACY — Auditoría y regularización del catálogo de trofeos
**Fecha:** 3 de noviembre de 2026  
**Aplicación:** MF LEGACY / Base44  
**Alcance:** 598 fichas persistidas en `Trophy`, 155 entidades `Country`.

## Resumen ejecutivo

Se ha aplicado una revisión conservadora de los trofeos importados desde FM24 y del catálogo de títulos ya presente en Base44. La operación preserva los 598 `source_id` originales, las imágenes existentes y el palmarés (`TrophyHonour`) sin modificaciones. Los datos del editor de Football Manager son fuentes históricas de trabajo, pero **no equivalen por sí solos a verificación federativa ni a la confirmación del ID de una competición**.

### Resultado verificado en Base44

| Métrica | Valor |
|---|---:|
| Fichas `Trophy` persistidas | 598 |
| Fichas con reputación numérica (0–200) | 598 |
| Fichas con categoría no vacía | 598 |
| Fichas con país asociado por `Country.id` | 445 |
| País sugerido por el nombre o contexto histórico | 433 |
| País contrastado con documentación externa | 12 |
| Competiciones de ámbito multinacional, sin país único | 50 |
| Sin país suficientemente sustentado | 103 |
| Entidades `Country` | 155 |
| Países añadidos durante esta intervención | 37 |
| Entidades `Country` con URL de bandera | 155 |
| Fichas con URL de investigación externa | 18 |
| IDs de trofeo repetidos | 0 |
| Categorías sin resolver | 0 |
| IDs de origen FM24 aún marcados para revisar | 338 |
| Fichas anteriormente marcadas como identificadas | 260 |

### Distribución por categorías

| Categoría editorial | Fichas |
|---|---:|
| Cup | 242 |
| League | 188 |
| Other | 99 |
| Supercup | 44 |
| International | 25 |

**Precaución:** `Cup`, `League`, `Supercup`, `International` y `Other` clasifican el formato/ámbito. No indican automáticamente si la competición tuvo reconocimiento oficial de la federación. Un amistoso puede ser una copa y una copa histórica puede no tener identidad inequívoca.

## Cómo funciona la reputación de MF LEGACY

La puntuación es **editorial, subjetiva, de 0 a 200**. No se ha extraído como atributo oficial de FM24 ni calculado a partir de ganadores inventados. El sistema combina referencias documentadas para torneos destacados y una estimación prudente por denominación, alcance general, tradición histórica, categoría, nivel aparente y participación juvenil, femenina, regional o amistosa. Cada uno de los 598 valores guardados incluye `reputation_basis` y `reputation_method`.

| Ejemplo | Reputación | Interpretación |
|---|---:|---|
| Copa del Mundo FIFA | 200 | Máxima notoriedad mundial |
| UEFA Champions League | 195 | Copa anual de clubes de mayor exposición global |
| Eurocopa | 190 | Competición de selecciones de gran alcance |
| LaLiga | 183 | Liga nacional de difusión internacional |
| Copa del Rey | 169 | Copa nacional histórica de primer nivel |
| Superliga Africana / African Football League | 132 | Competición continental de clubes CAF/FIFA; historia reciente |
| Trofeo Joan Gamper | 112 | Gran tradición amistosa e identidad internacional del FC Barcelona |
| Trofeo Ramón de Carranza | 100 | Amistoso de gran tradición histórica en España |
| Copa de los Campeones de España (1940) | 94 | Encuentro amistoso, antecedente pero no edición de la Supercopa actual |
| Bass Charity Vase | 74 | Trofeo benéfico amistoso inglés de larga historia |
| Corinthian Bowl | 66 | Copa sueca de 1906–1913 de relevancia patrimonial |

Una estimación inicial no equivale a un estudio federativo independiente. Puede revisarse manualmente desde la ficha, y la interfaz distingue una puntuación estimada de una ajustada a mano.

## Vinculación de países y banderas

Se ha añadido `Trophy.country_id` como vínculo canónico con `Country.id`, y campos `region` y `country_resolution`. Los nombres históricos se mantienen para trazabilidad, pero **no son claves de relación**. El resultado es:

- `verified` (12): país localizado con respaldo externo.
- `inferred` (433): denominación o referencia histórica inequívoca; aún sin comprobación documental individual.
- `international` (50): no corresponde atribuir un único país.
- `pending` (103): falta prueba suficiente, o el torneo corresponde a un territorio o marco político histórico que exige revisión.

Se han incorporado 37 países o territorios deportivos antes ausentes de `Country`, y se han completado cuatro banderas previamente vacías. Todas las 155 entidades tienen ahora una URL de bandera, y se comprobaron varias URLs representativas con respuesta HTTP 200. Persisten dos colisiones históricas de código en `Country` (`ARG`: Argentina/Argelia; `ESL`: Eslovaquia/Eslovenia). **No se han cambiado esos códigos globalmente** porque otras secciones de MF LEGACY podrían utilizarlos; el selector trabaja por `Country.id` y nombre.

## Correcciones históricas destacadas

**Corinthian Bowl (1906–1913).** La competición corresponde a Suecia, aunque se llamó así por el club inglés Corinthian. Se corrigió la asociación a `Country=Suecia`, categoría Cup, reputación 66, y se guardó una fuente de resultados: https://globalsportsarchive.com/en/soccer/competition/corinthian-bowl-1906/10099. El archivo contemporáneo del Djurgårdens también menciona el torneo: https://difhistoria.se/wp-content/uploads/djurgardens_idrotts-forenings_medlemsblad_1910_08.pdf

**Bass Charity Vase.** Campeonato benéfico inglés de naturaleza amistosa, con gran tradición. Reputación 74, `Country=Inglaterra`; referencia histórica oficial del Leicester City: https://www.lcfc.com/media-article/The-Bass-Charity-Vase-A-History

**Copa de los Campeones de España (1940).** La RFEF explica que tuvo carácter amistoso y una sola edición, mientras que la posterior Copa Eva Duarte fue oficial. No se fusionan ambos trofeos ni se añaden títulos de forma automática. Fuente: https://rfef.es/es/crees-que-lo-sabes-todo-nuestros23

**Superliga Africana (African Football League).** No debe clasificarse como una liga nacional: se trata de la competición CAF/FIFA de clubes de varios países africanos. Categoría International, reputación 132, sin `Country` único. Fuente: https://www.cafonline.com/en/news/caf-president-dr-motsepe-launches-the-african-football-league-trophy/

**Central American Cup y Caribbean Cup.** Se han categorizado como torneos internacionales oficiales de Concacaf, con reputaciones editoriales 117 y 111 respectivamente y sin país único. Fuentes: https://www.concacaf.com/competitions/central-american-cup y https://www.concacaf.com/competitions/caribbean-cup

**Budha Subba Gold Cup.** Torneo internacional por invitación celebrado en Dharan, Nepal, que no debe inferirse como la Gold Cup de Concacaf. Corregida la regla de categoría para que el nombre Gold Cup no implique automáticamente ámbito CONCACAF. Fuente: https://www.nrt.org.np/champion-tittle-achievements/

## Cambios visibles en la app

1. Selector de país enlazado a entidad `Country` con bandera y teclado, búsqueda por nombre/código, selección con flechas y Enter, y opciones explícitas «Internacional» y «Sin país confirmado».
2. Filtro de países del catálogo con banderas y búsqueda por nombre/código, no solo un desplegable sin búsqueda.
3. Bandera en encabezados de grupo, tarjetas y ficha de resumen cuando existe país enlazado.
4. Reputación de 0–200 en tarjetas, resumen y formulario de edición, con descripción editorial y ordenación ascendente/descendente.
5. Estado visible «REVISAR ID» para los trofeos del pack FM24 cuya vinculación de imagen/nombre/ID todavía no se ha confirmado.
6. Formulario para registrar la confirmación manual de identidad, con aviso previo para no verificar un ID no contrastado.
7. Conservación de fotos, nombres originales, IDs existentes y adjudicaciones de títulos.

## Límites y siguientes controles recomendados

1. **338 entradas FM24 siguen en `Pending`** en el campo `identification_status`. Esta condición NO implica que no tengan nombre o fotografía; señala que la relación del ID gráfico con la competición original no se ha confirmado. No se ha cambiado masivamente a `Verified`.
2. **103 nombres permanecen sin país**, normalmente por ambigüedad histórica, procedencia plurinacional o información de origen insuficiente.
3. El archivo FM24 aporta otros elementos gráficos sin relación inequívoca con la base, cuya adjudicación requeriría investigación adicional.
4. Los valores 0–200 son comparables solo dentro del sistema editorial MF LEGACY, no con el campo `reputation` de FM24 ni con el de ligas (0–10000).
5. La biblioteca externa de aproximadamente 2.180 referencias gráficas de GitHub es distinta de las 598 fichas registradas en Base44. Esas referencias externas pueden mostrarse y recibir una **estimación dinámica**; no todas tienen ficha persistente ni país confirmado.
6. No se han creado ni modificado ganadores de `TrophyHonour`; las participaciones históricas no cuentan como títulos.

## Exportación y validaciones

Se ha generado un CSV público de auditoría: `public/data/trophies_regularized_2026-11-03.csv`. Contiene las 598 fichas persistidas con ID original, nombre, categoría, relación `Country`, resolución, reputación, criterio editorial, estado de identificación y fuente externa, sin notas privadas ni ganadores.

**Pruebas técnicas:** 70 pruebas del módulo de trofeos completadas, análisis estático del código modificado correcto, y compilación Vite correcta. Se mantiene el conjunto de 598 IDs únicos y sin reputaciones fuera de 0–200.
