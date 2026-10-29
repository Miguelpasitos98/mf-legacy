# MF Legacy · Trophies Sync V2

## Estado
Implementado en Trophies, Teams y Players. El sistema **no investiga la web por sí solo**:
genera un prompt por club, recibe resultados con evidencia y muestra una vista previa.
No crea títulos reales hasta que el administrador revisa y guarda el lote.

## Fase 1 · Trofeo → Club + Edición
- La fuente de identidad es el `source_id` del catálogo original de 2.181 trofeos.
- El premio debe corresponder a un **Team Trophy**, nunca a un premio individual.
- El JSON `mf_legacy_trophy_honours_v1` contiene `honours: [{team_id, team_name,
  season, trophy_source_id, trophy_name, source_url, verified}]`.
- Si falta el ID, el nombre se resuelve **únicamente** si hay una coincidencia exacta única.
  Si el trofeo está pendiente de identificación no se incorpora.
- La edición debe tener un ganador del modelo Team con ID válido y una URL HTTPS de respaldo.
- Vista previa: Nuevo / Existente / Duplicado / Revisar. Las filas sin coincidencia no se guardan.
- El usuario marca explícitamente que revisó las fuentes antes de guardar.
- El catálogo persistente Trophy se materializa **solo** cuando hace falta;
  TrophyHonour registra el equipo y la temporada sin replicar fichas.
- En Trophies, las ediciones con fuente pueden marcarse verificadas tras revisión manual.

## Fase 2 · Club → Jugadores
- Entidad nueva: `PlayerTrophyCredit`:
  `trophy_honour_id + player_id` es la clave lógica, estable y sin duplicados.
- Se cruzan PlayerSeasonStats por ID de equipo, temporada y competición.
- `appearances > 0` en la competición sirve para proponer un candidato,
  **nunca confirma la elegibilidad oficial o el derecho al trofeo**.
- Un jugador con minutos en otra competición del club solo queda en revisión.
- PlayerCareer con etapa aprobada y fechas compatibles permite hallar
  jugadores sin stats como pistas de investigación; no se les adjudica un título.
- Las valoraciones de Transfermarkt/FC no identifican el club histórico
  y por ello NO se usan para acreditar la pertenencia.
- El administrador selecciona candidatos, introduce enlaces a plantilla/
  resultados oficiales y decide Confirmar / Excluir.
- Solo el estado `confirmed + verified` se muestra como título colectivo del jugador.

## Fase 3 · Palmarés visible
- Teams: botón PALMARÉS en la ficha, con títulos de equipo verificados.
- Players: botón PALMARÉS, separando los títulos colectivos y premios
  individuales en galerías desplazables independientes.
- Imágenes: manifest `/trophy-images.json` + catálogo Trophies; fallback neutro.
- La ficha no duplica registros ni copia las imágenes al jugador.
- Los candidatos en revisión no cuentan como títulos.
- Los registros siguen siendo una sola fuente de verdad en Base44.

## Sincronización
La revisión de jugadores se ejecuta desde Trophies → Jugadores elegibles → Cruzar
con STATS. Reutiliza la caché de STATS y PlayerCareer. Repite el cruce después de
importar nuevas temporadas; los candidatos ya registrados no se duplican.
No hay investigación autónoma, cron, consulta encubierta a fuentes de pago ni
adjudicación silenciosa tras una importación.

## Seguridad
Nunca se crean ganadores inventados, clubes por comparación aproximada de nombres,
jugadores identificados solo por nombre o títulos personales heredados del club.
Cada escritura conserva IDs reales y exige acciones explícitas del administrador.
