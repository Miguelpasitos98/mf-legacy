# Importación histórica de posesión — fase 1

Este módulo **no consulta FotMob automáticamente**. Convierte capturas JSON de datos a los que se tenga acceso autorizado a un lote compatible con la pantalla existente **Posesión histórica · equipos** (`/possession`).

## Alcance

Solo acepta competiciones presentes en el catálogo real de `League` de MF Legacy. No crea competiciones ni equipos, no rellena valores faltantes, no inventa IDs y **no escribe en Base44**. Los registros quedan con estado `pending` hasta comprobar su fuente e identidad.

## Preparación

1. Exporta tu catálogo actual de `League` como un array JSON, por ejemplo `[{"name":"Serie A"},{"name":"Premier League"}]`, en `leagues.json`.
2. Guarda uno o varios archivos JSON en una carpeta `snapshots/`. Cada archivo debe identificar la competición y la temporada, y contener una lista de equipos con porcentaje verificable.
3. Ejecuta:

```bash
python scripts/possession/import_fotmob_snapshots.py \
  --leagues leagues.json \
  --snapshots snapshots \
  --output possession_import.json
```

Ejemplo de snapshot preparado a partir de una fuente autorizada:

```json
{
  "competition": "Serie A",
  "season": "2025/2026",
  "source_url": "https://www.fotmob.com/es/leagues/55/stats/season/27044/teams/possession_percentage_team/serie-teams",
  "records": [
    {"team_name": "Inter", "fotmob_team_id": "8636", "team_possession_pct": 59.7}
  ]
}
```

El identificador de equipo mostrado arriba es únicamente ilustrativo: confirma todo ID antes de importarlo.

El programa genera `possession_import.json` con `records` y `possession_import.report.json` con errores detectados. Si alguna entrada es inválida, devuelve código 2 y es obligatorio revisar el informe antes de cargar datos.

## Próximas fases

- Adaptadores específicos para cada formato de exportación autorizado de FotMob.
- Resolver alias de competiciones duplicadas (Championship, Série A brasileña) tras verificar IDs; jamás fusionar solo por nombre.
- Previsualización de equipos vinculados/no vinculados y estadísticas por cobertura de temporadas.
- Recolección automática **solo tras confirmar una vía autorizada de acceso a datos** y sus condiciones.

La temporada se conserva tal y como corresponde: `2015/2016` o `2016`, sin asumir que todas las ligas usan campañas partidas.
