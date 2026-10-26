# MF LEGACY V3: MOTOR NATIVO WEB

Este módulo se ha integrado en la aplicación existente de Base44.

## Estado real

Funciona: validación de identidad, normalización estadística JS, conciliación por club/competición/temporada, deduplicación, revisión y creación de PRIMERAS temporadas en PlayerSeasonStats. Se admiten observaciones archivadas y lotes estructurados de fuentes permitidas.

No funciona aún: obtención automática en línea de perfiles y estadísticas nuevas desde FotMob/Understat/FC/Transfermarkt sin una conexión autorizada a sus fuentes. Ninguna función del motor nativo llama a esas webs de manera automática. No hay API comercial de pago.

## Flujo

1. IMPORT -> Motor web V3.
2. Se selecciona Player existente y se verifica PlayerFotmobLink.
3. Un conector aprobado entrega un lote estructurado, o se pueden preparar observaciones ya archivadas en PlayerProviderRecord.
4. Backend import-native normaliza, valida y almacena NativeSeasonCandidate; no escribe directamente en STATS.
5. Administrador aprueba una temporada: review-native comprueba club/competición/temporada, detecta duplicados y crea PlayerSeasonStats; nunca sobreescribe registros existentes.
6. STATS reutiliza PlayerSeasonStats sin migración de esquema.

## Esquema de entrada para un conector permitido

{
  "schema": "mf_legacy_native_snapshot_v1",
  "records": [
    {
      "provider": "fotmob",
      "fotmob_player_id": "795179",
      "season": "2021/2022",
      "competition": "Premier League",
      "team_name": "Arsenal",
      "fotmob_team_id": "9825",
      "source_record_id": "season-local-unique-id",
      "evidence_url": "https://enlace-al-registro-especifico-permitido",
      "statistics": {
        "statsSection": {
          "items": [
            {"localizedTitleId": "clearances", "statValue": "96", "per90": 2.89},
            {"localizedTitleId": "interceptions", "statValue": "0"}
          ]
        }
      }
    }
  ]
}

ATENCIÓN: las cifras anteriores SON SOLO EJEMPLOS DE FORMATO y NO deben importarse como estadísticas reales; para pruebas automatizadas se usan datos ficticios. No es un endpoint real ni una afirmación de datos deportivos.

El paquete se divide en lotes de 1-12 competiciones con límite de 180 KB. La identidad del jugador se comprueba de nuevo en backend. El ID del equipo es obligatorio para aplicar una temporada. Se conserva la distinción entre ausencia y cero, y entre fuente total, /90 y percentiles.

## Fuentes y limitaciones

FotMob y Understat: la normalización está preparada para estructuras históricas conocidas, pero la disponibilidad legal/técnica de nuevos datos debe resolverse antes de activar un conector remoto.
FIFA / EA FC y Transfermarkt: los valores ya verificados se gestionan mediante ImportCandidate/PlayerHistoricalValuation; el motor web de temporadas NO finge recuperarlos en línea.
Studio Windows: permanece como alternativa mientras se consigue el acceso permitido a las fuentes y la plena paridad de estadísticas.

## Pruebas

tests/nativeImportCore.test.mjs
tests/nativeImportIntegration.test.mjs

Las pruebas ejecutan una base falsa aislada, sin escribir en el Base44 real del usuario.
